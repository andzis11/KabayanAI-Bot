import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import axios from 'axios';
import { logger } from '../utils/logger';
import { executeSwap } from '../execution/swap';
import { withRateLimit } from '../security/apiRateLimit';

interface ArbOpportunity {
  tokenMint: string;
  spreadPercent: number;
  estimatedProfitLamports: number;
}

interface ArbConfig {
  minSpreadPercent: number;
  tradeAmountSol: number;
  tipLamports: number;
  jitoApiKey: string;
}

interface SwapResult {
  success: boolean;
  txHash: string | null;
  outAmount?: number;
  method: string;
  attempts: number;
  error: string | null;
}

async function getQuote(input: string, output: string, amount: number): Promise<{ outAmount: number } | null> {
  try {
    const r = await withRateLimit('jupiter', () =>
      axios.get('https://quote-api.jup.ag/v6/quote', {
        params: { inputMint: input, outputMint: output, amount, slippageBps: 100 },
        timeout: 5000,
      })
    );
    const outAmount = Number(r.data?.outAmount || 0);
    if (outAmount <= 0) return null;
    return { outAmount };
  } catch { return null; }
}

export async function scanArbitrage(mint: string): Promise<ArbOpportunity | null> {
  const SOL = 'So11111111111111111111111111111111111111112';
  const testAmt = LAMPORTS_PER_SOL; // 1 SOL dalam lamports

  const buyQuote = await getQuote(SOL, mint, testAmt);
  if (!buyQuote) return null;

  const sellQuote = await getQuote(mint, SOL, buyQuote.outAmount);
  if (!sellQuote) return null;

  const returnedLamports = sellQuote.outAmount;
  const spread = ((returnedLamports - testAmt) / testAmt) * 100;

  if (spread > 0) {
    logger.info(`[MEV] Arbitrage: ${mint.slice(0, 8)}... | Spread: ${spread.toFixed(2)}% | Profit est: ${((returnedLamports - testAmt) / 1e9).toFixed(4)} SOL`);
    return {
      tokenMint: mint,
      spreadPercent: spread,
      estimatedProfitLamports: returnedLamports - testAmt,
    };
  }
  return null;
}

export async function executeArbitrage(
  conn: Connection,
  opp: ArbOpportunity,
  _wallet: PublicKey,
  config: ArbConfig
): Promise<boolean> {
  if (opp.spreadPercent < config.minSpreadPercent) {
    logger.info(`[MEV] Spread ${opp.spreadPercent.toFixed(2)}% < min ${config.minSpreadPercent}% — skip`);
    return false;
  }

  logger.info(`[MEV] Executing arb: ${opp.tokenMint.slice(0, 8)}... | ${opp.spreadPercent.toFixed(2)}%`);

  // Step 1: Buy token dengan SOL
  const buyResult = await executeSwap(conn, 'SOL', opp.tokenMint, config.tradeAmountSol, 5) as SwapResult;
  if (!buyResult.success) {
    logger.warn('[MEV] Arb buy failed');
    return false;
  }

  // Step 2: Dapatkan actual token balance untuk dijual
  // outAmount dari swap dalam unit terkecil token
  const tokenAmountReceived = buyResult.outAmount;
  if (!tokenAmountReceived || tokenAmountReceived <= 0) {
    logger.warn('[MEV] Arb buy succeeded but outAmount unknown — skip sell to avoid loss');
    return false;
  }

  // Konversi outAmount (lamports/smallest unit) ke UI amount
  // Jupiter return dalam smallest unit, executeSwap perlu amount dalam SOL equivalent
  // Gunakan 100% dari token yang diterima
  const tokenAmountForSell = tokenAmountReceived / 1e9; // adjust decimals sesuai token

  // Step 3: Sell semua token kembali ke SOL
  const sellResult = await executeSwap(conn, opp.tokenMint, 'SOL', tokenAmountForSell, 5);
  if (!sellResult.success) {
    logger.error('[MEV] Arb sell FAILED — posisi terbuka! Mint: ' + opp.tokenMint);
    return false;
  }

  logger.info('[MEV] Arb completed successfully');
  return true;
}

