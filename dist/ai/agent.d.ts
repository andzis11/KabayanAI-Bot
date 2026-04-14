import { Connection } from '@solana/web3.js';
import { AIOutput, AIAgentConfig, DailyState, Position, AlphaWalletEvent } from './types';
export declare const DEFAULT_CONFIG: AIAgentConfig;
export declare class KabayanAgent {
    private config;
    private dailyState;
    private connection;
    constructor(connection: Connection, config?: Partial<AIAgentConfig>);
    private warnIfCapitalTooSmall;
    private loadOrCreateState;
    private persistState;
    evaluateBuy(mint: string, devWallet: string | null, ageSec: number, vol1Min: number, buyTxns: number, hasAlpha?: boolean): Promise<AIOutput>;
    evaluateSell(pos: Position, price: number, deployer: string): Promise<AIOutput>;
    handleAlphaSignal(event: AlphaWalletEvent): Promise<AIOutput>;
    addPosition(pos: Position): void;
    updatePosition(pos: Position): void;
    closePosition(mint: string, pnl: number, reason: string): void;
    private makeOutput;
    getState(): DailyState;
    getConfig(): AIAgentConfig;
    getPositions(): Position[];
}
