import { Connection, PublicKey, VersionedTransaction } from '@solana/web3.js';
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
export declare function buildSwapTransaction(conn: Connection, input: string, output: string, amount: number, walletPk: PublicKey, slippage: number): Promise<VersionedTransaction | null>;
export declare function executeSwap(conn: Connection, input: string, output: string, amount: number, slippage: number, options?: Partial<SwapOptions>): Promise<SwapResult>;
export {};
