import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { logger } from '../utils/logger';

const DB_PATH = path.join(process.cwd(), 'data', 'kabayan.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');

    initTables();
    logger.info('[DB] Connected: ' + DB_PATH);
  }
  return db;
}

function initTables(): void {
  if (!db) return;

  db.exec(`
    CREATE TABLE IF NOT EXISTS positions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token_mint TEXT NOT NULL,
      entry_price REAL NOT NULL,
      amount REAL NOT NULL,
      amount_sol REAL NOT NULL,
      fee_mode TEXT DEFAULT 'NORMAL',
      is_moonbag INTEGER DEFAULT 0,
      trailing_active INTEGER DEFAULT 0,
      trailing_stop REAL DEFAULT 0,
      tp1_hit INTEGER DEFAULT 0,
      initial_sl REAL DEFAULT 0,
      tp1_target REAL DEFAULT 0,
      tp2_target REAL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS daily_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      starting_capital REAL NOT NULL,
      ending_capital REAL NOT NULL,
      total_trades INTEGER DEFAULT 0,
      wins INTEGER DEFAULT 0,
      losses INTEGER DEFAULT 0,
      total_pnl REAL DEFAULT 0,
      total_fees REAL DEFAULT 0,
      max_drawdown REAL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS trade_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token_mint TEXT NOT NULL,
      action TEXT NOT NULL,
      price REAL NOT NULL,
      amount REAL NOT NULL,
      amount_sol REAL NOT NULL,
      pnl REAL DEFAULT 0,
      reason TEXT,
      tx_hash TEXT,
      fee_mode TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_positions_mint ON positions(token_mint);
    CREATE INDEX IF NOT EXISTS idx_daily_stats_date ON daily_stats(date);
    CREATE INDEX IF NOT EXISTS idx_trade_history_mint ON trade_history(token_mint);
    CREATE INDEX IF NOT EXISTS idx_trade_history_created ON trade_history(created_at);
  `);

  logger.info('[DB] Tables initialized');
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
    logger.info('[DB] Connection closed');
  }
}
