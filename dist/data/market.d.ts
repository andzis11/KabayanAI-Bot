export interface MarketData {
    tokenMint: string;
    priceUsd: number;
    priceSol: number;
    liquiditySol: number;
    liquidityUsd: number;
    volume24h: number;
    volume1MinSol: number;
    volumeToMcap24h: number;
    marketCap: number;
    pairAddress: string;
    pairCreatedAt: number;
    dexId: string;
}
export declare function getMarketData(tokenMint: string): Promise<MarketData | null>;
export declare function getTokenPrice(tokenMint: string): Promise<number | null>;
