import { AIAgentConfig } from './types';
import { logger } from '../utils/logger';

interface PositionSizeResult {
  sizeSol: number;
  riskPercent: number;
  reason: string;
  feeRatioPct: number; // fee sebagai % dari trade size — untuk monitoring
}

// Fixed cost minimum per trade berdasarkan fee mode
// Ini adalah biaya yang PASTI keluar terlepas dari ukuran trade
const FIXED_COST_BY_MODE: Record<string, number> = {
  SAFE:       0.0001 + 0.001,  // jito + priority = 0.0011 SOL
  NORMAL:     0.005  + 0.005,  // = 0.010 SOL
  AGGRESSIVE: 0.01   + 0.01,   // = 0.020 SOL
};

// Trade harus minimal N kali lipat dari fixed cost agar masuk akal
// Kalau fixed cost = 50% dari trade, mustahil profit konsisten
const MIN_TRADE_TO_FIXED_COST_RATIO = 5; // trade size minimal 5x fixed cost

export function calculatePositionSize(
  config: AIAgentConfig,
  hasAlpha: boolean,
  dailyPnl: number,
  positionsCount: number,
  feeMode: string = 'NORMAL'
): PositionSizeResult {
  // Circuit breaker
  if (dailyPnl <= -config.circuitBreakerPercent) {
    return { sizeSol: 0, riskPercent: 0, reason: 'CIRCUIT_BREAKER', feeRatioPct: 0 };
  }

  let risk = config.baseRiskPercent;
  let reason = 'BASE_RISK';

  // Alpha signal multiplier
  if (hasAlpha) {
    risk = config.baseRiskPercent * config.alphaMultiplier;
    reason = 'ALPHA_1.5X';
  }

  // Hitung trade size awal
  let size = (config.dailyCapital * risk) / 100;

  // Fee cap
  if (size > config.feeCap) {
    size = config.feeCap;
    reason += '_FEE_CAPPED';
  }

  // Max 50% of capital per trade
  if (size > config.dailyCapital * 0.5) {
    size = config.dailyCapital * 0.5;
    reason += '_MAX_CAPPED';
  }

  // === FEE-AWARE MINIMUM CHECK ===
  // Cek apakah trade size viable secara ekonomi vs fixed cost
  const fixedCost = FIXED_COST_BY_MODE[feeMode] ?? FIXED_COST_BY_MODE.NORMAL;
  const minViableSize = fixedCost * MIN_TRADE_TO_FIXED_COST_RATIO;

  if (size < minViableSize) {
    logger.warn(
      `[SIZER] Trade size ${size.toFixed(4)} SOL terlalu kecil vs fixed cost ${fixedCost.toFixed(4)} SOL (${feeMode}). ` +
      `Min viable: ${minViableSize.toFixed(4)} SOL. Gunakan modal lebih besar atau kurangi scan frequency.`
    );
    return { sizeSol: 0, riskPercent: 0, reason: 'FEE_RATIO_TOO_HIGH', feeRatioPct: (fixedCost / size) * 100 };
  }

  // Hard minimum absolut: 0.01 SOL (batas bawah apapun kondisinya)
  if (size < 0.01) {
    return { sizeSol: 0, riskPercent: 0, reason: 'SIZE_BELOW_ABSOLUTE_MIN', feeRatioPct: 0 };
  }

  // Hitung fee ratio untuk monitoring
  const estimatedTotalFee = fixedCost + (size * 0.01); // fixed + DEX fee ~1% round trip
  const feeRatioPct = (estimatedTotalFee / size) * 100;

  // Warning kalau fee ratio masih tinggi (tapi tidak di-block)
  if (feeRatioPct > 15) {
    logger.warn(
      `[SIZER] Fee ratio tinggi: ${feeRatioPct.toFixed(1)}% dari trade ${size.toFixed(4)} SOL. ` +
      `Pertimbangkan modal lebih besar atau kurangi frekuensi trading.`
    );
    reason += '_HIGH_FEE_RATIO';
  }

  return { sizeSol: size, riskPercent: risk, reason, feeRatioPct };
}

// Helper: cek apakah modal cukup untuk trading yang viable
export function checkCapitalViability(
  capitalSol: number,
  baseRiskPercent: number,
  feeMode: string = 'NORMAL'
): { viable: boolean; minCapital: number; currentFeeRatio: number; recommendation: string } {
  const fixedCost = FIXED_COST_BY_MODE[feeMode] ?? FIXED_COST_BY_MODE.NORMAL;
  const tradeSize = (capitalSol * baseRiskPercent) / 100;
  const minViableTradeSize = fixedCost * MIN_TRADE_TO_FIXED_COST_RATIO;
  const minCapital = (minViableTradeSize / baseRiskPercent) * 100;
  const feeRatio = tradeSize > 0 ? (fixedCost / tradeSize) * 100 : 999;

  let recommendation = '';
  if (feeRatio > 50) {
    recommendation = `Modal terlalu kecil untuk ${feeMode} mode. Minimum: ${minCapital.toFixed(2)} SOL, atau gunakan SAFE mode.`;
  } else if (feeRatio > 20) {
    recommendation = `Fee ratio tinggi (${feeRatio.toFixed(0)}%). Kurangi frekuensi scan atau tambah modal ke ${minCapital.toFixed(2)} SOL.`;
  } else {
    recommendation = `Fee ratio acceptable (${feeRatio.toFixed(0)}%).`;
  }

  return {
    viable: feeRatio <= 20,
    minCapital,
    currentFeeRatio: feeRatio,
    recommendation,
  };
}
