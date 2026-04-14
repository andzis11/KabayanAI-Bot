export interface HoneypotResult {
    isHoneypot: boolean;
    canBuy: boolean;
    canSell: boolean;
    buyTax: number;
    sellTax: number;
    totalTax: number;
    maxSellPercent: number;
    reason: string;
    details: {
        buyQuoteOk: boolean;
        sellQuoteOk: boolean;
        sellRouteFound: boolean;
        highTax: boolean;
        maxSellLimited: boolean;
    };
}
export declare function deepHoneypotCheck(tokenMint: string): Promise<HoneypotResult>;
export declare function quickHoneypotCheck(tokenMint: string): Promise<boolean>;
