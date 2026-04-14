import { Connection } from '@solana/web3.js';
import { logger } from '../utils/logger';
import { getTokenPrice } from '../data/market';

interface TPSLConfig {
  tokenMint: string;
  entryPrice: number;
  takeProfitPercent: number;
  stopLossPercent: number;
}

interface Callbacks {
  onTP: (mint: string, price: number) => void;
  onSL: (mint: string, price: number) => void;
}

export function startTPSLMonitor(
  _conn: Connection,
  config: TPSLConfig,
  cb: Callbacks,
  intervalMs: number = 3000
): NodeJS.Timeout {
  const tp = config.entryPrice * (1 + config.takeProfitPercent / 100);
  const sl = config.entryPrice * (1 - config.stopLossPercent / 100);

  logger.info(`[MONITOR] ${config.tokenMint.slice(0, 8)}... | TP: ${tp} | SL: ${sl}`);

  return setInterval(async () => {
    const price = await getTokenPrice(config.tokenMint);
    if (!price) return;
    if (price >= tp) cb.onTP(config.tokenMint, price);
    else if (price <= sl) cb.onSL(config.tokenMint, price);
  }, intervalMs) as any;
}

