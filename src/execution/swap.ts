import {
  Connection,
  PublicKey,
  VersionedTransaction,
} from '@solana/web3.js';
import { wallet } from '../config/wallet';
import { logger } from '../utils/logger';
import { withRateLimit } from '../security/apiRateLimit';
import { raydiumSwap } from './raydium';
import axios from 'axios';

interface SwapOptions {
  maxRetries: number;
  retryDelayMs: number;
  skipPreflight: boolean;
}

interface SwapResult {
  success: boolean;
  txHash: string | null;
  method: 'jupiter' | 'raydium' | 'none';
  attempts: number;
  error: string | null;
}

const SOL_MINT = 'So11111111111111111111111111111111111111112';

const DEFAULT_OPTIONS: SwapOptions = {
  maxRetries: 3,
  retryDelayMs: 1500,
  skipPreflight: false,
};

export async function buildSwapTransaction(
  conn: Connection,
  input: string,
  output: string,
  amount: number,
  walletPk: PublicKey,
  slippage: number
): Promise<VersionedTransaction | null> {
  const inp = input === 'SOL' ? SOL_MINT : input;
  const out = output === 'SOL' ? SOL_MINT : output;
  const lamports = Math.round(amount * 1e9);

  try {
    const quote = await withRateLimit('jupiter', () =>
      axios.get('https://quote-api.jup.ag/v6/quote', {
        params: { inputMint: inp, outputMint: out, amount: lamports, slippageBps: Math.round(slippage * 100) },
        timeout: 10000,
      })
    );

    if (!quote.data?.inputMint) { logger.error('[SWAP] Invalid quote'); return null; }

    const swap = await withRateLimit('jupiter', () =>
      axios.post('https://quote-api.jup.ag/v6/swap', {
        quoteResponse: quote.data,
        userPublicKey: walletPk.toBase58(),
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: 'auto',
      }, { timeout: 15000 })
    );

    const txBuf = Buffer.from(swap.data.swapTransaction, 'base64');
    const tx = VersionedTransaction.deserialize(txBuf);
    tx.sign([wallet]);
    return tx;
  } catch (error: any) {
    logger.error(`[SWAP] Build error: ${error.message}`);
    return null;
  }
}

export async function executeSwap(
  conn: Connection,
  input: string,
  output: string,
  amount: number,
  slippage: number,
  options: Partial<SwapOptions> = {}
): Promise<SwapResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError = '';

  for (let attempt = 1; attempt <= opts.maxRetries; attempt++) {
    try {
      logger.info(`[SWAP] Attempt ${attempt}/${opts.maxRetries}: ${input.slice(0, 6)}... → ${output.slice(0, 6)}... | ${amount.toFixed(4)} SOL`);

      const adjustedSlippage = slippage * (1 + (attempt - 1) * 0.15);
      const tx = await buildSwapTransaction(conn, input, output, amount, wallet.publicKey, adjustedSlippage);

      if (!tx) {
        lastError = 'BUILD_FAILED';
        if (attempt === opts.maxRetries) break;
        await sleep(opts.retryDelayMs * attempt);
        continue;
      }

      const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash('confirmed');
      const raw = tx.serialize();
      const sig = await conn.sendRawTransaction(raw, {
        skipPreflight: attempt > 1 ? true : opts.skipPreflight,
        maxRetries: 2,
        preflightCommitment: 'confirmed',
      });

      logger.info(`[SWAP] TX sent: ${sig}`);

      const confirmation = await Promise.race([
        conn.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed'),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 30000)),
      ]);

      if ((confirmation as any).value?.err) {
        lastError = JSON.stringify((confirmation as any).value.err);
        logger.warn(`[SWAP] TX error: ${lastError}`);
        if (isRetryable(lastError)) { await sleep(opts.retryDelayMs * attempt); continue; }
        return { success: false, txHash: sig, method: 'jupiter', attempts: attempt, error: lastError };
      }

      logger.info(`[SWAP] ✅ Success: ${sig}`);
      return { success: true, txHash: sig, method: 'jupiter', attempts: attempt, error: null };
    } catch (error: any) {
      lastError = error.message || 'UNKNOWN';
      logger.warn(`[SWAP] Attempt ${attempt} failed: ${lastError}`);
      if (isRetryable(lastError)) { await sleep(opts.retryDelayMs * Math.pow(1.5, attempt - 1)); continue; }
    }
  }

  // Raydium fallback
  logger.info('[SWAP] Trying Raydium fallback...');
  try {
    const ray = await withRateLimit('raydium', () => raydiumSwap(conn, input, output, amount, slippage));
    if (ray.success) {
      logger.info(`[SWAP] ✅ Raydium: ${ray.txHash}`);
      return { success: true, txHash: ray.txHash, method: 'raydium', attempts: opts.maxRetries + 1, error: null };
    }
  } catch (e: any) {
    lastError += ` | Raydium: ${e.message}`;
  }

  logger.error(`[SWAP] ❌ All failed: ${lastError}`);
  return { success: false, txHash: null, method: 'none', attempts: opts.maxRetries + 1, error: lastError };
}

function isRetryable(error: string): boolean {
  const patterns = ['BlockhashNotFound', 'BlockhashExpired', 'TransactionExpired', 'timeout', 'ECONNRESET', 'ETIMEDOUT', '429', 'rate limit', '503', '502', '500', 'CONFIRMATION_TIMEOUT', 'blockhash', 'expired'];
  const el = error.toLowerCase();
  return patterns.some(p => el.includes(p.toLowerCase()));
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

