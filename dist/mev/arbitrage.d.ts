import { Connection, PublicKey } from '@solana/web3.js';
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
export declare function scanArbitrage(mint: string): Promise<ArbOpportunity | null>;
export declare function executeArbitrage(conn: Connection, opp: ArbOpportunity, _wallet: PublicKey, config: ArbConfig): Promise<boolean>;
export {};
