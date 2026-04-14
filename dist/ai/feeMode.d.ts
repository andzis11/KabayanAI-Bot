export type FeeMode = 'SAFE' | 'NORMAL' | 'AGGRESSIVE';
export interface FeeSchedule {
    jitoTip: number;
    priorityFee: number;
    slippageBuy: number;
    slippageSell: number;
    buyFee: number;
    sellFee: number;
}
export declare const FEE_SCHEDULES: Record<FeeMode, FeeSchedule>;
export interface FeeModeInput {
    tokenAgeSeconds?: number;
    action?: string;
    buyTxnsLastBlock?: number;
    volume1MinSol?: number;
    tradeSizeSol?: number;
    capitalSol?: number;
}
export declare function getFeeSchedule(mode: FeeMode | string): FeeSchedule;
export declare function selectFeeMode(input: FeeModeInput): FeeMode;
export declare function estimateTotalCost(tradeSizeSol: number, mode: FeeMode): number;
export declare function calcFeeRatio(tradeSizeSol: number, mode: FeeMode): number;
export declare function getCurrentFeeMode(): FeeMode;
