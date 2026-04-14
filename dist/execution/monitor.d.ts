import { Connection } from '@solana/web3.js';
interface TPSLConfig {
    tokenMint: string;
    entryPrice: number;
    takeProfitPercent: number;
    stopLossPercent: number;
}
interface Callbacks {
    onTP: (mint: string, price: number) => void;
    onSL: (mint: string, price: number) => void;
}
export declare function startTPSLMonitor(_conn: Connection, config: TPSLConfig, cb: Callbacks, intervalMs?: number): NodeJS.Timeout;
export {};
