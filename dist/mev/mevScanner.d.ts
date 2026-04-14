import WebSocket from 'ws';
import { Connection } from '@solana/web3.js';
interface MEVState {
    sandwichEnabled: boolean;
    arbitrageEnabled: boolean;
    totalSandwiches: number;
    totalArbitrages: number;
    totalProfit: number;
    lastActivity: number;
}
interface MEVConfig {
    minTargetSizeSol: number;
    maxSlippage: number;
    tipLamports: number;
    jitoApiKey: string;
    minSpreadPercent: number;
    tradeAmountSol: number;
}
export declare function configureMEV(conn: Connection, config: Partial<MEVConfig>): void;
export declare function startMempoolScanner(url: string): WebSocket;
export declare function getMEVState(): MEVState;
export declare function setMEVSandwich(on: boolean): void;
export declare function setMEVArbitrage(on: boolean): void;
export {};
