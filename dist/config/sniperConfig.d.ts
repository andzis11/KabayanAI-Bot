export interface SniperConfig {
    amountSol: number;
    feeMode: string;
    maxAgeSeconds: number;
    minLiquidity: number;
    maxTopHolder: number;
    honeypotCheck: boolean;
    securityGate: boolean;
    enabled: boolean;
    minCapitalRequired: number;
    maxDailyTrades: number;
}
export declare function getSniperConfig(): SniperConfig;
export declare function updateSniperConfig(partial: Partial<SniperConfig>): SniperConfig;
export declare function resetSniperConfig(): SniperConfig;
export declare function validateSniperActivation(currentCapital: number): {
    allowed: boolean;
    reason: string;
};
