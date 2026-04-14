import { Position, FeeMode } from './types';
interface MonitorResult {
    action: 'HOLD' | 'SELL' | 'TP1';
    sellPercent: number;
    reason: string;
    updatedPosition: Position;
}
export declare function createPosition(mint: string, entryPrice: number, amount: number, amountSol: number, feeMode: FeeMode, alpha: boolean): Position;
export declare function monitorPosition(pos: Position, price: number): MonitorResult;
export {};
