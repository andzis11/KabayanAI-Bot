export interface TradeRecord {
    id?: number;
    token_mint: string;
    token_name?: string;
    action: 'BUY' | 'SELL';
    amount_sol: number;
    amount_token?: number;
    price?: number;
    tx_hash?: string;
    fee_mode?: string;
    reason?: string;
    pnl_sol?: number;
    created_at: number;
}
export declare function insertTrade(trade: TradeRecord): number;
export declare function getRecentTrades(limit?: number): TradeRecord[];
export declare function getDailyTrades(start: number, end: number): TradeRecord[];
export declare function getTotalPnl(): number;
