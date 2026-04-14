interface HealthStatus {
    solanaRpc: boolean;
    database: boolean;
    memoryMb: number;
    uptime: string;
}
export declare function checkHealth(): Promise<HealthStatus>;
export {};
