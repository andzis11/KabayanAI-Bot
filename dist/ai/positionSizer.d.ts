import { AIAgentConfig } from './types';
interface PositionSizeResult {
    sizeSol: number;
    riskPercent: number;
    reason: string;
    feeRatioPct: number;
}
export declare function calculatePositionSize(config: AIAgentConfig, hasAlpha: boolean, dailyPnl: number, positionsCount: number, feeMode?: string): PositionSizeResult;
export declare function checkCapitalViability(capitalSol: number, baseRiskPercent: number, feeMode?: string): {
    viable: boolean;
    minCapital: number;
    currentFeeRatio: number;
    recommendation: string;
};
export {};
