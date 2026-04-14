import { Connection } from '@solana/web3.js';
import { logger } from '../utils/logger';
import { AlphaWalletEvent, AIAgentConfig } from './types';
import { runSecurityGate } from './securityGate';
import { getDb } from '../database/db';

// In-memory cache untuk kecepatan lookup
const TRACKED: Set<string> = new Set();
let initialized = false;

function ensureTable(): void {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS alpha_wallets (
      address TEXT PRIMARY KEY,
      label TEXT,
      added_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_alpha_wallets_address ON alpha_wallets(address);
  `);
}

export function loadAlphaWalletsFromDB(): void {
  if (initialized) return;
  try {
    ensureTable();
    const db = getDb();
    const rows = db.prepare('SELECT address FROM alpha_wallets').all() as { address: string }[];
    rows.forEach(r => TRACKED.add(r.address));
    initialized = true;
    logger.info('[ALPHA] Loaded ' + rows.length + ' wallets from DB');
  } catch (e: any) {
    logger.warn('[ALPHA] Failed to load from DB: ' + e.message);
    initialized = true;
  }
}

export function addAlphaWallet(address: string, label?: string): void {
  loadAlphaWalletsFromDB();
  try {
    ensureTable();
    const db = getDb();
    db.prepare(
      'INSERT OR IGNORE INTO alpha_wallets(address, label, added_at) VALUES(?, ?, ?)'
    ).run(address, label || null, Date.now());
    TRACKED.add(address);
    logger.info('[ALPHA] Added: ' + address.slice(0, 8) + '...' + (label ? ' (' + label + ')' : ''));
  } catch (e: any) {
    logger.warn('[ALPHA] DB insert failed: ' + e.message);
    TRACKED.add(address); // tetap tambah ke memory
  }
}

export function removeAlphaWallet(address: string): void {
  loadAlphaWalletsFromDB();
  try {
    const db = getDb();
    db.prepare('DELETE FROM alpha_wallets WHERE address = ?').run(address);
    TRACKED.delete(address);
    logger.info('[ALPHA] Removed: ' + address.slice(0, 8) + '...');
  } catch (e: any) {
    logger.warn('[ALPHA] DB delete failed: ' + e.message);
    TRACKED.delete(address);
  }
}

export function getAlphaWallets(): string[] {
  loadAlphaWalletsFromDB();
  return Array.from(TRACKED);
}

export function getAlphaWalletCount(): number {
  loadAlphaWalletsFromDB();
  return TRACKED.size;
}

export async function evaluateAlphaSignal(
  conn: Connection,
  event: AlphaWalletEvent,
  config: AIAgentConfig
): Promise<{ shouldBuy: boolean; reason: string }> {
  loadAlphaWalletsFromDB();

  if (!TRACKED.has(event.wallet)) return { shouldBuy: false, reason: 'NOT_TRACKED' };
  if (event.amountSol < config.alphaMinSol) return { shouldBuy: false, reason: `LOW_AMOUNT_${event.amountSol}` };

  const age = (event.timestamp - event.pairCreatedAt) / 1000;
  if (age > config.alphaMaxAgeSeconds) return { shouldBuy: false, reason: `OLD_PAIR_${age}s` };

  const gate = await runSecurityGate(conn, event.tokenMint, null);
  if (!gate.passed) return { shouldBuy: false, reason: `GATE_FAIL_${gate.failedReason}` };

  return { shouldBuy: true, reason: 'ALPHA_PASS' };
}

