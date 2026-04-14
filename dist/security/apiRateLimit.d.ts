export declare function withRateLimit<T>(endpoint: string, fn: () => Promise<T>): Promise<T>;
interface RateLimitStats {
    currentCount: number;
    maxRequests: number;
    blocked: boolean;
    totalRequests: number;
}
export declare function getRateLimitStats(): Record<string, RateLimitStats>;
export {};
