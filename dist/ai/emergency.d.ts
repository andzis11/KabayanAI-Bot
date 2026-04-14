interface EmergencyCheck {
    triggered: boolean;
    reason: string | null;
    description: string;
}
export declare function checkLiquidityDrained(mint: string): Promise<EmergencyCheck>;
export declare function checkRugDetected(mint: string, deployer: string): Promise<EmergencyCheck>;
export declare function checkInsiderDump(mint: string): Promise<EmergencyCheck>;
export declare function runAllEmergencyChecks(mint: string, deployer: string): Promise<EmergencyCheck>;
export {};
