export type FeeMode = 'SAFE' | 'NORMAL' | 'AGGRESSIVE';

export interface FeeSchedule {
  jitoTip: number;
  priorityFee: number;
  slippageBuy: number;
  slippageSell: number;
  buyFee: number;
  sellFee: number;
}

export const FEE_SCHEDULES: Record<FeeMode, FeeSchedule> = {
  SAFE: {
    jitoTip: 0.0001,
    priorityFee: 0.001,
    slippageBuy: 10,
    slippageSell: 10,
    buyFee: 0.003,
    sellFee: 0.003,
  },
  NORMAL: {
    jitoTip: 0.005,
    priorityFee: 0.005,
    slippageBuy: 15,
    slippageSell: 15,
    buyFee: 0.005,
    sellFee: 0.005,
  },
  AGGRESSIVE: {
    jitoTip: 0.01,
    priorityFee: 0.01,
    slippageBuy: 25,
    slippageSell: 30,
    buyFee: 0.008,
    sellFee: 0.008,
  },
};

export interface FeeModeInput {
  tokenAgeSeconds?: number;
  action?: string;
  buyTxnsLastBlock?: number;
  volume1MinSol?: number;
  tradeSizeSol?: number;   // tambahan: ukuran trade untuk capital-aware selection
  capitalSol?: number;     // tambahan: modal saat ini
}

export function getFeeSchedule(mode: FeeMode | string): FeeSchedule {
  if (mode === 'SAFE') return FEE_SCHEDULES.SAFE;
  if (mode === 'AGGRESSIVE') return FEE_SCHEDULES.AGGRESSIVE;
  return FEE_SCHEDULES.NORMAL;
}

export function selectFeeMode(input: FeeModeInput): FeeMode {
  const age   = input.tokenAgeSeconds  ?? 0;
  const txns  = input.buyTxnsLastBlock ?? 0;
  const vol   = input.volume1MinSol    ?? 0;
  const size  = input.tradeSizeSol     ?? 0;
  const cap   = input.capitalSol       ?? 999;

  // === CAPITAL-AWARE OVERRIDE ===
  // Kalau modal kecil atau trade size kecil, paksa SAFE mode
  // NORMAL fixed cost 0.010 SOL — tidak masuk akal untuk trade < 0.05 SOL
  if (size > 0 && size < 0.05) return 'SAFE';
  if (cap < 0.3) return 'SAFE';

  // NORMAL mode threshold: trade < 0.2 SOL, downgrade AGGRESSIVE -> NORMAL
  if (size > 0 && size < 0.20) {
    // Kalau kondisi minta AGGRESSIVE tapi trade kecil, pakai NORMAL saja
    const wouldBeAggressive = (age < 30 || txns > 50 || vol > 10);
    if (wouldBeAggressive) return 'NORMAL';
  }

  // Original logic
  if (age < 30 || txns > 50 || vol > 10) return 'AGGRESSIVE';
  if (age < 300 || txns > 20 || vol > 5) return 'NORMAL';
  return 'SAFE';
}

// Hitung total biaya estimasi untuk satu round trip (buy + sell)
export function estimateTotalCost(tradeSizeSol: number, mode: FeeMode): number {
  const schedule = FEE_SCHEDULES[mode];
  const fixedCost = schedule.jitoTip + schedule.priorityFee;
  const variableCost = tradeSizeSol * (schedule.buyFee + schedule.sellFee);
  return fixedCost + variableCost;
}

// Fee ratio: berapa % dari trade size yang habis untuk biaya
export function calcFeeRatio(tradeSizeSol: number, mode: FeeMode): number {
  if (tradeSizeSol <= 0) return 999;
  return (estimateTotalCost(tradeSizeSol, mode) / tradeSizeSol) * 100;
}

export function getCurrentFeeMode(): FeeMode {
  return 'NORMAL';
}
