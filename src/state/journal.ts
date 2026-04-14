import { insertTrade } from '../database/tradeRepo';

export function logBuy(mint: string, name: string | undefined, sol: number, tokens: number, price: number, tx: string, fee: string, reason: string): void {
  insertTrade({ token_mint: mint, token_name: name, action: 'BUY', amount_sol: sol, amount_token: tokens, price, tx_hash: tx, fee_mode: fee, reason, pnl_sol: 0, created_at: Date.now() });
}

export function logSell(mint: string, name: string | undefined, sol: number, tokens: number, price: number, tx: string, fee: string, reason: string, pnl: number): void {
  insertTrade({ token_mint: mint, token_name: name, action: 'SELL', amount_sol: sol, amount_token: tokens, price, tx_hash: tx, fee_mode: fee, reason, pnl_sol: pnl, created_at: Date.now() });
}

