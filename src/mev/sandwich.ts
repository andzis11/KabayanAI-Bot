import { Connection, PublicKey, SystemProgram } from '@solana/web3.js';
import { logger } from '../utils/logger';
import { sendJitoBundle, getRandomTipAccount } from './jito';
import { executeSwap } from '../execution/swap';

interface SandwichConfig {
  minTargetSizeSol: number;
  maxSlippage: number;
  tipLamports: number;
  jitoApiKey: string;
}

interface PendingSwap {
  signature: string;
  mint: string;
  amountSol: number;
  poolAddress: string;
}

export async function executeSandwich(
  conn: Connection,
  target: PendingSwap,
  wallet: PublicKey,
  config: SandwichConfig
): Promise<boolean> {
  try {
    logger.info(`[SANDWICH] Target: ${target.mint.slice(0, 8)}... | ${target.amountSol} SOL`);

    const frontrun = await executeSwap(conn, 'SOL', target.mint, target.amountSol * 0.3, config.maxSlippage);
    if (!frontrun.success) { logger.warn('[SANDWICH] Frontrun failed'); return false; }

    const backrun = await executeSwap(conn, target.mint, 'SOL', 100, config.maxSlippage);
    if (!backrun.success) { logger.warn('[SANDWICH] Backrun failed'); return false; }

    logger.info('[SANDWICH] Executed');
    return true;
  } catch (e: any) {
    logger.error(`[SANDWICH] Error: ${e.message}`);
    return false;
  }
}

