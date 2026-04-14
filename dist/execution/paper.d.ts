interface PaperTrade {
    tokenMint: string;
    entryPrice: number;
    amount: number;
    amountSol: number;
    timestamp: number;
}
export declare function paperBuy(mint: string, price: number, sol: number): boolean;
export declare function paperSell(mint: string, price: number, pct?: number): number;
export declare function getPaperBalance(): number;
export declare function getPaperTrades(): PaperTrade[];
export declare function resetPaper(): void;
export {};
