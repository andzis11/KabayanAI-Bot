"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSniperConfig = getSniperConfig;
exports.updateSniperConfig = updateSniperConfig;
exports.resetSniperConfig = resetSniperConfig;
exports.validateSniperActivation = validateSniperActivation;
const logger_1 = require("../utils/logger");
const DEFAULT = {
    amountSol: 0.05, // naik dari 0.02 — minimum viable dengan NORMAL fee
    feeMode: 'NORMAL', // turun dari AGGRESSIVE — lebih aman untuk modal standar
    maxAgeSeconds: 300,
    minLiquidity: 5000,
    maxTopHolder: 25,
    honeypotCheck: true,
    securityGate: true,
    enabled: false,
    minCapitalRequired: 0.5, // sniper tidak boleh aktif kalau modal < 0.5 SOL
    maxDailyTrades: 20, // max 20 trade/hari untuk kontrol fee drain
};
let config = { ...DEFAULT };
function getSniperConfig() {
    return { ...config };
}
function updateSniperConfig(partial) {
    config = { ...config, ...partial };
    logger_1.logger.info('[SNIPER_CONFIG] Updated: ' + JSON.stringify(partial));
    return { ...config };
}
function resetSniperConfig() {
    config = { ...DEFAULT };
    return { ...config };
}
// Validasi apakah sniper boleh diaktifkan berdasarkan modal saat ini
function validateSniperActivation(currentCapital) {
    if (currentCapital < config.minCapitalRequired) {
        return {
            allowed: false,
            reason: `Modal ${currentCapital.toFixed(3)} SOL di bawah minimum ${config.minCapitalRequired} SOL untuk sniper. ` +
                `Dengan modal kecil, fee (${config.feeMode} mode) akan menghabiskan profit. ` +
                `Tambah modal atau gunakan paper trading mode dulu.`,
        };
    }
    // Cek fee ratio untuk trade size yang dikonfigurasi
    const { calcFeeRatio } = require('./feeMode');
    const feeRatio = calcFeeRatio(config.amountSol, config.feeMode);
    if (feeRatio > 25) {
        return {
            allowed: false,
            reason: `Fee ratio terlalu tinggi: ${feeRatio.toFixed(1)}% dari trade size ${config.amountSol} SOL. ` +
                `Naikkan amountSol minimal ke ${(config.amountSol * (feeRatio / 15)).toFixed(3)} SOL atau ganti ke SAFE mode.`,
        };
    }
    return { allowed: true, reason: 'OK' };
}
//# sourceMappingURL=sniperConfig.js.map