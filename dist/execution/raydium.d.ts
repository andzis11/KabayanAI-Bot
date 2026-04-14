import { Connection } from '@solana/web3.js';
export declare function raydiumSwap(conn: Connection, inputMint: string, outputMint: string, amount: number, slippage: number): Promise<{
    success: boolean;
    txHash: string | null;
}>;
