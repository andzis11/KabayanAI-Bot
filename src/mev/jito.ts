import axios from 'axios';
import { Transaction, VersionedTransaction, SystemProgram, PublicKey } from '@solana/web3.js';
import { logger } from '../utils/logger';
import { withRateLimit } from '../security/apiRateLimit';

const JITO_URL = 'https://mainnet.block-engine.jito.wtf';
const TIP_ACCOUNTS = [
  '96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5',
  'HFqU5x63VTqvQss8hp11i4bPuAjicwGcMmMipKxzNzG',
  'Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY',
  'ADaUMid9yfUytqMBgopwjb2DTLSuITxZk6GFCjPhZDx',
  'DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh',
  'ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt',
  'DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL',
  '3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT',
];

export async function sendJitoBundle(
  txs: (Transaction | VersionedTransaction)[],
  apiKey: string
): Promise<string | null> {
  try {
    const serialized = txs.map(tx =>
      Buffer.from(
        tx instanceof VersionedTransaction
          ? tx.serialize()
          : tx.serialize({ requireAllSignatures: false })
      ).toString('base64')
    );

    const resp = await withRateLimit('jito', () =>
      axios.post(`${JITO_URL}/api/v1/bundles`, {
        jsonrpc: '2.0',
        id: 1,
        method: 'sendBundle',
        params: [serialized],
      }, {
        headers: { 'Content-Type': 'application/json', 'x-jito-auth': apiKey },
        timeout: 10000,
      })
    );

    const id = resp.data?.result;
    logger.info(`[JITO] Bundle sent: ${id}`);
    return id;
  } catch (e: any) {
    logger.error(`[JITO] Failed: ${e.message}`);
    return null;
  }
}

export function getRandomTipAccount(): string {
  return TIP_ACCOUNTS[Math.floor(Math.random() * TIP_ACCOUNTS.length)];
}

export function buildTipInstruction(fromPubkey: PublicKey, tipLamports: number) {
  return SystemProgram.transfer({
    fromPubkey,
    toPubkey: new PublicKey(getRandomTipAccount()),
    lamports: tipLamports,
  });
}

