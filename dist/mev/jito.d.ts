import { Transaction, VersionedTransaction, PublicKey } from '@solana/web3.js';
export declare function sendJitoBundle(txs: (Transaction | VersionedTransaction)[], apiKey: string): Promise<string | null>;
export declare function getRandomTipAccount(): string;
export declare function buildTipInstruction(fromPubkey: PublicKey, tipLamports: number): import("@solana/web3.js").TransactionInstruction;
