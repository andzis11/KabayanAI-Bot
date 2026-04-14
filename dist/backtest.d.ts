export interface BacktestConfig {
    strategy: string;
    startingCapital: number;
    baseRiskPercent: number;
    tp1Percent: number;
    tp2Percent: number;
    hardSlPercent: number;
    trailingDelta: number;
    circuitBreakerPercent: number;
    maxPositions: number;
    simulationDays: number;
    tokensPerDay: number;
}
export interface BacktestResult {
    config: BacktestConfig;
    startingCapital: number;
    endingCapital: number;
    totalReturn: number;
    totalReturnPercent: number;
    totalTrades: number;
    wins: number;
    losses: number;
    winRate: number;
    profitFactor: number;
    maxDrawdown: number;
    maxDrawdownPercent: number;
    sharpeRatio: number;
    evPerTrade: number;
    totalFeesPaid: number;
    trades: BacktestTrade[];
}
export interface BacktestTrade {
    tokenMint: string;
    entryPrice: number;
    exitPrice: number;
    entryTime: number;
    exitTime: number;
    amountSol: number;
    pnlSol: number;
    pnlPercent: number;
    exitReason: string;
    fees: number;
}
export interface ComparisonResult {
    metrics: StrategyMetric[];
    winner: string;
}
export interface StrategyMetric {
    name: string;
    returnPercent: number;
    winRate: number;
    profitFactor: number;
    maxDrawdown: number;
    sharpeRatio: number;
    evPerTrade: number;
}
export declare function runBacktest(config?: BacktestConfig): Promise<BacktestResult>;
export declare const STRATEGIES: Record<string, BacktestConfig>;
export declare function compareStrategies(names: string[], overrides?: Partial<BacktestConfig>): Promise<ComparisonResult>;
export declare function exportResults(result: BacktestResult | ComparisonResult, filename: string): string;
