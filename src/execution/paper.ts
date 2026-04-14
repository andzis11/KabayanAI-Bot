import { logger } from '../utils/logger';

interface PaperTrade {
  tokenMint: string;
  entryPrice: number;
  amount: number;
  amountSol: number;
  timestamp: number;
}

let trades: PaperTrade[] = [];
let balance = 10;

export function paperBuy(mint: string, price: number, sol: number): boolean {
  if (sol > balance) {
    logger.warn('[PAPER] Insufficient: ' + balance + ' SOL');
    return false;
  }
  trades.push({
    tokenMint: mint,
    entryPrice: price,
    amount: sol / price,
    amountSol: sol,
    timestamp: Date.now(),
  });
  balance -= sol;
  logger.info('[PAPER] BUY: ' + mint.slice(0, 8) + '... | ' + sol.toFixed(4) + ' SOL');
  return true;
}

export function paperSell(mint: string, price: number, pct: number = 1.0): number {
  const idx = trades.findIndex((t) => t.tokenMint === mint);
  if (idx === -1) return 0;

  const t = trades[idx];
  const sellAmt = t.amount * pct;
  const received = sellAmt * price;
  const pnl = received - t.amountSol * pct;

  balance += received;

  if (pct >= 1.0) {
    trades.splice(idx, 1);
  } else {
    t.amount -= sellAmt;
    t.amountSol -= t.amountSol * pct;
  }

  logger.info('[PAPER] SELL: ' + mint.slice(0, 8) + '... | PnL: ' + (pnl > 0 ? '+' : '') + pnl.toFixed(4));
  return pnl;
}

export function getPaperBalance(): number {
  return balance;
}

export function getPaperTrades(): PaperTrade[] {
  return [...trades];
}

export function resetPaper(): void {
  trades = [];
  balance = 10;
}
