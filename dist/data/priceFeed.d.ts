interface PriceUpdate {
    mint: string;
    price: number;
    timestamp: number;
}
interface CachedPrice {
    price: number;
    timestamp: number;
    source: 'websocket' | 'api' | 'cache';
}
type OnPriceUpdate = (update: PriceUpdate) => void;
export declare class WebSocketPriceFeed {
    private wsUrl;
    private ws;
    private subscriptions;
    private priceCache;
    private subscriptionIdToMint;
    private mintToSubscriptionId;
    private nextSubId;
    private reconnectAttempts;
    private maxReconnect;
    private connected;
    constructor(wsUrl: string);
    connect(): void;
    subscribe(mint: string, callback?: OnPriceUpdate): void;
    unsubscribe(mint: string): void;
    getCachedPrice(mint: string): CachedPrice | null;
    setApiPrice(mint: string, price: number): void;
    isConnected(): boolean;
    getStats(): {
        subscribed: number;
        cached: number;
        connected: boolean;
    };
    disconnect(): void;
    private subscribeAccount;
    private getMintBySubId;
    private parsePrice;
}
export declare class HybridPriceFeed {
    private wsFeed;
    private apiCache;
    private activeTokens;
    constructor(heliusWsUrl: string);
    start(): void;
    getPrice(mint: string): Promise<{
        price: number;
        source: string;
    } | null>;
    warmCache(mints: string[]): Promise<void>;
    removeToken(mint: string): void;
    getStats(): {
        apiCached: number;
        activeTokens: number;
        subscribed: number;
        cached: number;
        connected: boolean;
    };
    stop(): void;
}
export {};
