export interface RugCheckData {
    mintAuthority: boolean;
    freezeAuthority: boolean;
    topHolderPercent: number;
    bundledWallets: number;
    score: number;
    riskLevel: string;
}
export declare function checkRugCheck(tokenMint: string): Promise<RugCheckData>;
