interface PnLData {
    tokenName: string;
    tokenMint: string;
    entryPrice: number;
    exitPrice: number;
    pnlPercent: number;
    pnlSol: number;
    holdingTime: string;
}
export declare function generatePnLCard(data: PnLData): Promise<Buffer | null>;
export {};
