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
declare function loadSniperConfig(): void;
declare function saveSniperConfigToFile(): void;
export declare function getSniperConfig(): SniperConfig;
export declare function updateSniperConfig(partial: Partial<SniperConfig>): SniperConfig;
export declare function resetSniperConfig(): SniperConfig;
export { loadSniperConfig, saveSniperConfigToFile as saveSniperConfig };
export declare function validateSniperActivation(currentCapital: number): {
    allowed: boolean;
    reason: string;
};
