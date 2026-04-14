import { Connection } from '@solana/web3.js';
export interface AlphaEvent {
    wallet: string;
    tokenMint: string;
    amountSol: number;
    timestamp: number;
    type: string;
}
export declare function startAlphaMonitor(connection: Connection, onSignal: (event: AlphaEvent) => Promise<void>): ReturnType<typeof setInterval>;
