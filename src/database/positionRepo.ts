import { getDb } from './db';
import { Position } from '../ai/types';
import { logger } from '../utils/logger';

export function savePosition(position: Position): void {
  const db = getDb();
  const now = Date.now();

  db.prepare(`
    INSERT OR REPLACE INTO positions
    (token_mint, entry_price, amount, amount_sol, initial_sl, trailing_delta,
     trailing_activation, tp1_target, peak, trailing_active, is_moonbag,
     moonbag_sl, ath, fee_mode, alpha_signal, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    position.tokenMint,
    position.entryPrice,
    position.amount,
    position.amountSol,
    position.initialSL,
    position.trailingDelta,
    position.trailingActivation,
    position.tp1Target,
    position.peak,
    position.trailingActive ? 1 : 0,
    position.isMoonbag ? 1 : 0,
    position.moonbagSL,
    position.ath,
    position.feeMode,
    position.alphaSignal ? 1 : 0,
    position.timestamp,
    now
  );
}

export function loadPositions(): Position[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM positions').all() as any[];

  return rows.map((row) => ({
    tokenMint: row.token_mint,
    entryPrice: row.entry_price,
    amount: row.amount,
    amountSol: row.amount_sol,
    initialSL: row.initial_sl,
    trailingDelta: row.trailing_delta,
    trailingActivation: row.trailing_activation,
    tp1Target: row.tp1_target,
    peak: row.peak,
    trailingActive: row.trailing_active === 1,
    isMoonbag: row.is_moonbag === 1,
    moonbagSL: row.moonbag_sl,
    ath: row.ath,
    timestamp: row.created_at,
    feeMode: row.fee_mode,
    alphaSignal: row.alpha_signal === 1,
  }));
}

export function deletePosition(tokenMint: string): void {
  getDb().prepare('DELETE FROM positions WHERE token_mint = ?').run(tokenMint);
}

export function clearAllPositions(): void {
  getDb().prepare('DELETE FROM positions').run();
}
