import { Connection, VersionedTransaction } from '@solana/web3.js';
import { wallet } from '../config/wallet';
import { logger } from '../utils/logger';
import axios from 'axios';

export async function raydiumSwap(
  conn: Connection,
  inputMint: string,
  outputMint: string,
  amount: number,
  slippage: number
): Promise<{ success: boolean; txHash: string | null }> {
  try {
    const resp = await axios.post('https://transaction-v1.raydium.io/swap', {
      inputMint,
      outputMint,
      amount: Math.round(amount * 1e9),
      slippageBps: Math.round(slippage * 100),
      txVersion: 'V0',
      wallet: wallet.publicKey.toBase58(),
    }, { timeout: 15000 });

    const txData = resp.data?.data?.[0]?.transaction;
    if (!txData) return { success: false, txHash: null };

    const tx = VersionedTransaction.deserialize(Buffer.from(txData, 'base64'));
    tx.sign([wallet]);

    const sig = await conn.sendRawTransaction(tx.serialize(), { skipPreflight: false, maxRetries: 3 });
    await conn.confirmTransaction(sig, 'confirmed');
    return { success: true, txHash: sig };
  } catch (error: any) {
    logger.error(`[RAYDIUM] Error: ${error.message}`);
    return { success: false, txHash: null };
  }
}

