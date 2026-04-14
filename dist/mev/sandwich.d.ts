import { Connection, PublicKey } from '@solana/web3.js';
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
export declare function executeSandwich(conn: Connection, target: PendingSwap, wallet: PublicKey, config: SandwichConfig): Promise<boolean>;
export {};
