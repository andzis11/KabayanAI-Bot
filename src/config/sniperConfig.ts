import { logger } from '../utils/logger';

export interface SniperConfig {
  amountSol: number;
  feeMode: string;
  maxAgeSeconds: number;
  minLiquidity: number;
  maxTopHolder: number;
  honeypotCheck: boolean;
  securityGate: boolean;
  enabled: boolean;
  minCapitalRequired: number;  // modal minimum sebelum sniper boleh aktif
  maxDailyTrades: number;      // batas jumlah trade per hari
}

const DEFAULT: SniperConfig = {
  amountSol: 0.05,           // naik dari 0.02 — minimum viable dengan NORMAL fee
  feeMode: 'NORMAL',         // turun dari AGGRESSIVE — lebih aman untuk modal standar
  maxAgeSeconds: 300,
  minLiquidity: 5000,
  maxTopHolder: 25,
  honeypotCheck: true,
  securityGate: true,
  enabled: false,
  minCapitalRequired: 0.5,   // sniper tidak boleh aktif kalau modal < 0.5 SOL
  maxDailyTrades: 20,        // max 20 trade/hari untuk kontrol fee drain
};

let config: SniperConfig = { ...DEFAULT };

export function getSniperConfig(): SniperConfig {
  return { ...config };
}

export function updateSniperConfig(partial: Partial<SniperConfig>): SniperConfig {
  config = { ...config, ...partial };
  logger.info('[SNIPER_CONFIG] Updated: ' + JSON.stringify(partial));
  return { ...config };
}

export function resetSniperConfig(): SniperConfig {
  config = { ...DEFAULT };
  return { ...config };
}

// Validasi apakah sniper boleh diaktifkan berdasarkan modal saat ini
export function validateSniperActivation(currentCapital: number): {
  allowed: boolean;
  reason: string;
} {
  if (currentCapital < config.minCapitalRequired) {
    return {
      allowed: false,
      reason:
        `Modal ${currentCapital.toFixed(3)} SOL di bawah minimum ${config.minCapitalRequired} SOL untuk sniper. ` +
        `Dengan modal kecil, fee (${config.feeMode} mode) akan menghabiskan profit. ` +
        `Tambah modal atau gunakan paper trading mode dulu.`,
    };
  }

  // Cek fee ratio untuk trade size yang dikonfigurasi
  const { calcFeeRatio } = require('./feeMode');
  const feeRatio = calcFeeRatio(config.amountSol, config.feeMode as any);
  if (feeRatio > 25) {
    return {
      allowed: false,
      reason:
        `Fee ratio terlalu tinggi: ${feeRatio.toFixed(1)}% dari trade size ${config.amountSol} SOL. ` +
        `Naikkan amountSol minimal ke ${(config.amountSol * (feeRatio / 15)).toFixed(3)} SOL atau ganti ke SAFE mode.`,
    };
  }

  return { allowed: true, reason: 'OK' };
}
