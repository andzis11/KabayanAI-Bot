import { DailyState } from '../ai/types';
export declare function saveDailyState(state: DailyState): void;
export declare function loadDailyState(date: string): DailyState | null;
