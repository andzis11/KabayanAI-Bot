import fs from 'fs';
import path from 'path';
import { insertTrade } from './tradeRepo';
import { logger } from '../utils/logger';

const OLD_DATA_PATH = path.join(process.cwd(), 'trades.json');

export function migrateOldData(): void {
  if (!fs.existsSync(OLD_DATA_PATH)) {
    logger.info('[MIGRATE] No trades.json — skipping');
    return;
  }

  try {
    const raw = fs.readFileSync(OLD_DATA_PATH, 'utf-8');
    const trades = JSON.parse(raw);
    if (!Array.isArray(trades) || trades.length === 0) return;

    let migrated = 0;
    for (const t of trades) {
      try {
        insertTrade({
          token_mint: t.tokenMint || t.token_mint || 'unknown',
          token_name: t.tokenName || t.token_name,
          action: t.action || 'BUY',
          amount_sol: t.amountSol || t.amount_sol || 0,
          amount_token: t.amountToken || t.amount_token,
          price: t.price,
          tx_hash: t.txHash || t.tx_hash,
          fee_mode: t.feeMode || t.fee_mode,
          reason: t.reason,
          pnl_sol: t.pnlSol || t.pnl_sol || 0,
          created_at: t.timestamp || t.created_at || Date.now(),
        });
        migrated++;
      } catch { /* skip */ }
    }

    fs.renameSync(OLD_DATA_PATH, `${OLD_DATA_PATH}.bak`);
    logger.info(`[MIGRATE] Migrated ${migrated} trades`);
  } catch (error: any) {
    logger.error(`[MIGRATE] Error: ${error.message}`);
  }
}
