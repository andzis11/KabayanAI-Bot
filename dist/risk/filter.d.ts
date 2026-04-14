interface FilterResult {
    passed: boolean;
    score: number;
    checks: Record<string, boolean>;
    failedReason: string | null;
}
export declare function run9LayerFilter(tokenMint: string): Promise<FilterResult>;
export {};
