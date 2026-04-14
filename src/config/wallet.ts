import {
  Connection,
  Keypair,
  PublicKey,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import bs58 from 'bs58';
import { ENV } from './env';
import { logger } from '../utils/logger';

const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${ENV.HELIUS_API_KEY}`;

export const connection = new Connection(HELIUS_RPC, {
  commitment: 'confirmed',
  confirmTransactionInitialTimeout: 30000,
});

export const wallet = Keypair.fromSecretKey(bs58.decode(ENV.SOLANA_PRIVATE_KEY));
export const walletPubkey: PublicKey = wallet.publicKey;

export async function getBalance(): Promise<number> {
  try {
    const balance = await connection.getBalance(walletPubkey);
    return balance / LAMPORTS_PER_SOL;
  } catch (error: any) {
    logger.error(`[WALLET] Balance error: ${error.message}`);
    return 0;
  }
}

export async function getWalletAddress(): Promise<string> {
  return walletPubkey.toBase58();
}

