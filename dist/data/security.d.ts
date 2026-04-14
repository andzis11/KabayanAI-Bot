export interface GoPlusResult {
    isHoneypot: boolean;
    buyTax: number;
    sellTax: number;
    canSell: boolean;
    canBuy: boolean;
    ownerCanChangeBalance: boolean;
    isProxy: boolean;
    isMintable: boolean;
    ownerAddress: string;
    unavailable?: boolean;
}
export declare function checkGoPlus(tokenMint: string): Promise<GoPlusResult>;
