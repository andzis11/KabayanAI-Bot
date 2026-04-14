interface DailyReport {
    date: string;
    totalTrades: number;
    wins: number;
    losses: number;
    winRate: number;
    totalPnl: number;
    bestTrade: number;
    worstTrade: number;
}
export declare function generateDailyReport(): DailyReport;
export declare function formatDailyReport(r: DailyReport): string;
export {};
