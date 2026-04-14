"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSniperConfig = getSniperConfig;
exports.updateSniperConfig = updateSniperConfig;
exports.resetSniperConfig = resetSniperConfig;
exports.loadSniperConfig = loadSniperConfig;
exports.saveSniperConfig = saveSniperConfigToFile;
exports.validateSniperActivation = validateSniperActivation;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const logger_1 = require("../utils/logger");
const CONFIG_FILE = path.join(__dirname, "../../data/sniper_config.json");
const DEFAULT = {
    amountSol: 0.05, // naik dari 0.02 — minimum viable dengan NORMAL fee
    feeMode: "NORMAL", // turun dari AGGRESSIVE — lebih aman untuk modal standar
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
function loadSniperConfig() {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const raw = fs.readFileSync(CONFIG_FILE, "utf8");
            const saved = JSON.parse(raw);
            config = { ...DEFAULT, ...saved };
            logger_1.logger.info("[SNIPER_CONFIG] Loaded from file");
        }
        else {
            logger_1.logger.info("[SNIPER_CONFIG] No saved config, using defaults");
        }
    }
    catch (error) {
        logger_1.logger.warn("[SNIPER_CONFIG] Failed to load: " + error.message + ", using defaults");
    }
}
function saveSniperConfigToFile() {
    try {
        const dir = path.dirname(CONFIG_FILE);
        if (!fs.existsSync(dir))
            fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf8");
        logger_1.logger.info("[SNIPER_CONFIG] Saved to file");
    }
    catch (error) {
        logger_1.logger.warn("[SNIPER_CONFIG] Failed to save: " + error.message);
    }
}
// Load config at module init
loadSniperConfig();
function getSniperConfig() {
    return { ...config };
}
function updateSniperConfig(partial) {
    config = { ...config, ...partial };
    saveSniperConfigToFile();
    logger_1.logger.info("[SNIPER_CONFIG] Updated: " + JSON.stringify(partial));
    return { ...config };
}
function resetSniperConfig() {
    config = { ...DEFAULT };
    saveSniperConfigToFile();
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
    const { calcFeeRatio } = require("./feeMode");
    const feeRatio = calcFeeRatio(config.amountSol, config.feeMode);
    if (feeRatio > 25) {
        return {
            allowed: false,
            reason: `Fee ratio terlalu tinggi: ${feeRatio.toFixed(1)}% dari trade size ${config.amountSol} SOL. ` +
                `Naikkan amountSol minimal ke ${(config.amountSol * (feeRatio / 15)).toFixed(3)} SOL atau ganti ke SAFE mode.`,
        };
    }
    return { allowed: true, reason: "OK" };
}
//# sourceMappingURL=sniperConfig.js.map