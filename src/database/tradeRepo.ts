import { getDb } from './db';
import { logger } from '../utils/logger';

export interface TradeRecord {
  id?: number;
  token_mint: string;
  token_name?: string;
  action: 'BUY' | 'SELL';
  amount_sol: number;
  amount_token?: number;
  price?: number;
  tx_hash?: string;
  fee_mode?: string;
  reason?: string;
  pnl_sol?: number;
  created_at: number;
}

export function insertTrade(trade: TradeRecord): number {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO trades (token_mint, token_name, action, amount_sol, amount_token, price, tx_hash, fee_mode, reason, pnl_sol, created_at)
    VALUES (@token_mint, @token_name, @action, @amount_sol, @amount_token, @price, @tx_hash, @fee_mode, @reason, @pnl_sol, @created_at)
  `);
  const result = stmt.run(trade);
  return Number(result.lastInsertRowid);
}

export function getRecentTrades(limit: number = 50): TradeRecord[] {
  return getDb().prepare('SELECT * FROM trades ORDER BY created_at DESC LIMIT ?').all(limit) as TradeRecord[];
}

export function getDailyTrades(start: number, end: number): TradeRecord[] {
  return getDb().prepare('SELECT * FROM trades WHERE created_at >= ? AND created_at < ? ORDER BY created_at DESC').all(start, end) as TradeRecord[];
}

export function getTotalPnl(): number {
  const result = getDb().prepare('SELECT COALESCE(SUM(pnl_sol), 0) as total FROM trades WHERE action = ?').get('SELL') as any;
  return result?.total || 0;
}
