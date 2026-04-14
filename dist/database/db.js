"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDb = getDb;
exports.closeDb = closeDb;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const logger_1 = require("../utils/logger");
const DB_PATH = path_1.default.join(process.cwd(), 'data', 'kabayan.db');
let db = null;
function getDb() {
    if (!db) {
        const dir = path_1.default.dirname(DB_PATH);
        if (!fs_1.default.existsSync(dir)) {
            fs_1.default.mkdirSync(dir, { recursive: true });
        }
        db = new better_sqlite3_1.default(DB_PATH);
        db.pragma('journal_mode = WAL');
        db.pragma('synchronous = NORMAL');
        initTables();
        logger_1.logger.info('[DB] Connected: ' + DB_PATH);
    }
    return db;
}
function initTables() {
    if (!db)
        return;
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
    logger_1.logger.info('[DB] Tables initialized');
}
function closeDb() {
    if (db) {
        db.close();
        db = null;
        logger_1.logger.info('[DB] Connection closed');
    }
}
//# sourceMappingURL=db.js.map