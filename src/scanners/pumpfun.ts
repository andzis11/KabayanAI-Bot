import WebSocket from 'ws';
import { logger } from '../utils/logger';

export interface PumpFunToken {
  mint: string;
  name: string;
  symbol: string;
  creator: string;
  timestamp: number;
}

type OnNewToken = (token: PumpFunToken) => void;

export function startPumpFunScanner(cb: OnNewToken): WebSocket {
  const ws = new WebSocket('wss://pumpportal.fun/api/data');

  ws.on('open', () => {
    logger.info('[PUMPFUN] Connected');
    ws.send(JSON.stringify({ method: 'subscribeNewToken' }));
  });

  ws.on('message', (data: string) => {
    try {
      const p = JSON.parse(data);
      if (p.mint) {
        cb({
          mint: p.mint,
          name: p.name || 'Unknown',
          symbol: p.symbol || '???',
          creator: p.traderPublicKey || '',
          timestamp: Date.now(),
        });
      }
    } catch { /* skip */ }
  });

  ws.on('error', (err) => logger.error(`[PUMPFUN] Error: ${err.message}`));
  ws.on('close', () => {
    logger.warn('[PUMPFUN] Reconnecting in 5s');
    setTimeout(() => startPumpFunScanner(cb), 5000);
  });

  return ws;
}

