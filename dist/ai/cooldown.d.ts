import { DailyState } from './types';
interface CooldownResult {
    active: boolean;
    remainingMs: number;
    reason: string;
}
export declare function checkCooldown(state: DailyState): CooldownResult;
export {};
