import WebSocket from 'ws';
import { Connection, PublicKey } from '@solana/web3.js';
import { logger } from '../utils/logger';
import { scanArbitrage, executeArbitrage } from './arbitrage';
import { executeSandwich } from './sandwich';
import { wallet } from '../config/wallet';

interface MEVState {
  sandwichEnabled: boolean;
  arbitrageEnabled: boolean;
  totalSandwiches: number;
  totalArbitrages: number;
  totalProfit: number;
  lastActivity: number;
}

interface MEVConfig {
  minTargetSizeSol: number;
  maxSlippage: number;
  tipLamports: number;
  jitoApiKey: string;
  minSpreadPercent: number;
  tradeAmountSol: number;
}

let state: MEVState = {
  sandwichEnabled: false,
  arbitrageEnabled: false,
  totalSandwiches: 0,
  totalArbitrages: 0,
  totalProfit: 0,
  lastActivity: 0,
};

let mevConfig: MEVConfig = {
  minTargetSizeSol: 0.5,
  maxSlippage: 10,
  tipLamports: 10000,
  jitoApiKey: '',
  minSpreadPercent: 2,
  tradeAmountSol: 0.1,
};

let connection: Connection | null = null;

export function configureMEV(conn: Connection, config: Partial<MEVConfig>): void {
  connection = conn;
  mevConfig = { ...mevConfig, ...config };
}

// Throttle untuk cegah spam eksekusi pada target yang sama
const recentTargets: Map<string, number> = new Map();
const TARGET_COOLDOWN_MS = 30_000;

function parseSwapFromTx(tx: any): { mint: string; amountSol: number; poolAddress: string; signature: string } | null {
  try {
    const instructions = tx?.transaction?.message?.instructions || [];
    const pre = tx?.meta?.preBalances || [];
    const post = tx?.meta?.postBalances || [];
    const sig = tx?.transaction?.signatures?.[0] || '';

    // Cari program Jupiter atau Raydium
    const JUP = 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4';
    const RAY = '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8';

    let isSwap = false;
    let poolAddress = '';

    for (const ix of instructions) {
      if (ix?.programId === JUP || ix?.programId === RAY) {
        isSwap = true;
        poolAddress = ix.accounts?.[0] || '';
        break;
      }
    }

    if (!isSwap) return null;

    // Hitung SOL amount dari balance changes
    let maxChange = 0;
    for (let i = 0; i < pre.length; i++) {
      const change = Math.abs((pre[i] - post[i]) / 1e9);
      if (change > maxChange) maxChange = change;
    }

    if (maxChange < mevConfig.minTargetSizeSol) return null;

    // Ambil mint dari token balances
    const postTB = tx?.meta?.postTokenBalances || [];
    const mint = postTB[0]?.mint || '';
    if (!mint) return null;

    return { mint, amountSol: maxChange, poolAddress, signature: sig };
  } catch {
    return null;
  }
}

export function startMempoolScanner(url: string): WebSocket {
  const ws = new WebSocket(url);

  ws.on('open', () => {
    logger.info('[MEV] Scanner connected');
    ws.send(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'transactionSubscribe',
        params: [
          { vote: false, failed: false },
          { commitment: 'processed', encoding: 'jsonParsed' },
        ],
      })
    );
  });

  ws.on('message', async (data: string) => {
    try {
      const p = JSON.parse(data);
      const tx = p?.params?.result?.transaction;
      if (!tx || !connection) return;

      const swap = parseSwapFromTx(tx);
      if (!swap) return;

      logger.info(`[MEV] Large swap detected: ${swap.amountSol.toFixed(2)} SOL | ${swap.mint.slice(0, 8)}...`);
      state.lastActivity = Date.now();

      // Throttle: skip jika baru saja proses target ini
      const lastSeen = recentTargets.get(swap.mint);
      if (lastSeen && Date.now() - lastSeen < TARGET_COOLDOWN_MS) return;
      recentTargets.set(swap.mint, Date.now());

      // Sandwich Attack
      if (state.sandwichEnabled && mevConfig.jitoApiKey) {
        const sandwichSuccess = await executeSandwich(
          connection,
          { signature: swap.signature, mint: swap.mint, amountSol: swap.amountSol, poolAddress: swap.poolAddress },
          wallet.publicKey,
          {
            minTargetSizeSol: mevConfig.minTargetSizeSol,
            maxSlippage: mevConfig.maxSlippage,
            tipLamports: mevConfig.tipLamports,
            jitoApiKey: mevConfig.jitoApiKey,
          }
        );
        if (sandwichSuccess) {
          state.totalSandwiches++;
          logger.info('[MEV] Sandwich #' + state.totalSandwiches + ' completed');
        }
        return; // Tidak run arb setelah sandwich attempt
      }

      // Arbitrage Scan
      if (state.arbitrageEnabled) {
        const opp = await scanArbitrage(swap.mint);
        if (opp) {
          const arbSuccess = await executeArbitrage(
            connection,
            opp,
            wallet.publicKey,
            {
              minSpreadPercent: mevConfig.minSpreadPercent,
              tradeAmountSol: mevConfig.tradeAmountSol,
              tipLamports: mevConfig.tipLamports,
              jitoApiKey: mevConfig.jitoApiKey,
            }
          );
          if (arbSuccess) {
            state.totalArbitrages++;
            logger.info('[MEV] Arbitrage #' + state.totalArbitrages + ' completed');
          }
        }
      }
    } catch (e: any) {
      logger.warn('[MEV] Message parse error: ' + e.message);
    }
  });

  ws.on('error', (err: Error) => {
    logger.error('[MEV] Error: ' + err.message);
  });

  ws.on('close', () => {
    logger.warn('[MEV] Reconnecting in 5s');
    setTimeout(() => startMempoolScanner(url), 5000);
  });

  return ws;
}

export function getMEVState(): MEVState {
  return { ...state };
}

export function setMEVSandwich(on: boolean): void {
  state.sandwichEnabled = on;
  logger.info('[MEV] Sandwich: ' + (on ? 'ON' : 'OFF'));
}

export function setMEVArbitrage(on: boolean): void {
  state.arbitrageEnabled = on;
  logger.info('[MEV] Arbitrage: ' + (on ? 'ON' : 'OFF'));
}
