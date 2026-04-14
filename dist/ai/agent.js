"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KabayanAgent = exports.DEFAULT_CONFIG = void 0;
const logger_1 = require("../utils/logger");
const securityGate_1 = require("./securityGate");
const feeMode_1 = require("./feeMode");
const positionSizer_1 = require("./positionSizer");
const emergency_1 = require("./emergency");
const cooldown_1 = require("./cooldown");
const alphaWallet_1 = require("./alphaWallet");
const sltpEngine_1 = require("./sltpEngine");
const positionRepo_1 = require("../database/positionRepo");
const dailyStatsRepo_1 = require("../database/dailyStatsRepo");
exports.DEFAULT_CONFIG = {
    dailyCapital: 1.0,
    baseRiskPercent: 2,
    alphaMultiplier: 1.5,
    feeCap: 0.5,
    minPoolLiquiditySol: 75,
    minPoolLiquidityUsd: 10000,
    minVolumeToMcap: 0.8,
    maxTop10HoldersPercent: 25,
    maxBundledWallets: 5,
    alphaMinSol: 2,
    alphaMaxAgeSeconds: 60,
    circuitBreakerPercent: 15,
    monitoringIntervalMs: 500,
};
class KabayanAgent {
    config;
    dailyState;
    connection;
    constructor(connection, config) {
        this.connection = connection;
        this.config = { ...exports.DEFAULT_CONFIG, ...config };
        this.dailyState = this.loadOrCreateState();
        // Cek viabilitas modal saat startup
        this.warnIfCapitalTooSmall();
    }
    warnIfCapitalTooSmall() {
        const viability = (0, positionSizer_1.checkCapitalViability)(this.config.dailyCapital, this.config.baseRiskPercent, 'NORMAL');
        if (!viability.viable) {
            logger_1.logger.warn('[AGENT] ⚠️  CAPITAL WARNING: ' + viability.recommendation +
                ' | Fee ratio saat ini: ' + viability.currentFeeRatio.toFixed(1) + '%' +
                ' | Min capital: ' + viability.minCapital.toFixed(3) + ' SOL');
        }
        else {
            logger_1.logger.info('[AGENT] Capital check OK: ' + this.config.dailyCapital + ' SOL' +
                ' | Fee ratio: ' + viability.currentFeeRatio.toFixed(1) + '%');
        }
    }
    loadOrCreateState() {
        const today = new Date().toISOString().split('T')[0];
        const saved = (0, dailyStatsRepo_1.loadDailyState)(today);
        if (saved) {
            logger_1.logger.info('[AGENT] Loaded state: ' +
                today +
                ' | PnL: ' +
                saved.dailyPnlPercent.toFixed(2) +
                '%');
            return saved;
        }
        return {
            date: today,
            startingCapital: this.config.dailyCapital,
            currentCapital: this.config.dailyCapital,
            totalTrades: 0,
            wins: 0,
            losses: 0,
            dailyPnlPercent: 0,
            circuitBreakerActive: false,
            circuitBreakerUntil: 0,
            lastTpExit: 0,
            lastSlHit: 0,
            lastRugEmergency: 0,
            positions: [],
        };
    }
    persistState() {
        (0, dailyStatsRepo_1.saveDailyState)(this.dailyState);
    }
    async evaluateBuy(mint, devWallet, ageSec, vol1Min, buyTxns, hasAlpha = false) {
        const cd = (0, cooldown_1.checkCooldown)(this.dailyState);
        if (cd.active) {
            return this.makeOutput('TAHAN', 0, 'COOLDOWN_ACTIVE', 'SAFE', 0);
        }
        if (this.dailyState.circuitBreakerActive) {
            return this.makeOutput('TAHAN', 0, 'CIRCUIT_BREAKER', 'SAFE', 0);
        }
        const gate = await (0, securityGate_1.runSecurityGate)(this.connection, mint, devWallet);
        if (!gate.passed) {
            return this.makeOutput('TAHAN', 0, 'SECURITY_GATE_FAIL', 'SAFE', 0);
        }
        // Pilih fee mode dengan capital-aware logic
        const fm = (0, feeMode_1.selectFeeMode)({
            tokenAgeSeconds: ageSec,
            action: 'BUY',
            buyTxnsLastBlock: buyTxns,
            volume1MinSol: vol1Min,
            capitalSol: this.dailyState.currentCapital,
        });
        // Hitung position size — sekarang pass feeMode untuk validasi
        const sz = (0, positionSizer_1.calculatePositionSize)(this.config, hasAlpha, this.dailyState.dailyPnlPercent, this.dailyState.positions.length, fm);
        if (sz.sizeSol <= 0) {
            return this.makeOutput('TAHAN', 0, sz.reason, 'SAFE', 0);
        }
        // Log fee ratio sebagai info
        const feeRatio = (0, feeMode_1.calcFeeRatio)(sz.sizeSol, fm);
        logger_1.logger.info(`[AGENT] BUY signal: ${mint.slice(0, 8)}... | size=${sz.sizeSol.toFixed(4)} SOL | fee=${feeRatio.toFixed(1)}% | mode=${fm}`);
        return this.makeOutput('BELI', sz.sizeSol / this.config.dailyCapital, hasAlpha ? 'ALPHA_SIGNAL' : 'SECURITY_GATE_PASS', fm, sz.sizeSol);
    }
    async evaluateSell(pos, price, deployer) {
        const emerg = await (0, emergency_1.runAllEmergencyChecks)(pos.tokenMint, deployer);
        if (emerg.triggered) {
            return this.makeOutput('JUAL', 1.0, emerg.reason, 'AGGRESSIVE', pos.amountSol);
        }
        const res = (0, sltpEngine_1.monitorPosition)(pos, price);
        if (res.action === 'SELL') {
            return this.makeOutput('JUAL', res.sellPercent, res.reason, 'AGGRESSIVE', pos.amountSol * res.sellPercent);
        }
        if (res.action === 'TP1') {
            return this.makeOutput('JUAL', res.sellPercent, 'TP1_SECURED', 'AGGRESSIVE', pos.amountSol * res.sellPercent);
        }
        return this.makeOutput('TAHAN', 0, 'NO_SIGNAL', pos.feeMode, pos.amountSol);
    }
    async handleAlphaSignal(event) {
        const r = await (0, alphaWallet_1.evaluateAlphaSignal)(this.connection, event, this.config);
        if (!r.shouldBuy) {
            return this.makeOutput('TAHAN', 0, 'NO_SIGNAL', 'SAFE', 0);
        }
        return this.evaluateBuy(event.tokenMint, null, (event.timestamp - event.pairCreatedAt) / 1000, 0, 0, true);
    }
    addPosition(pos) {
        this.dailyState.positions.push(pos);
        this.dailyState.totalTrades++;
        (0, positionRepo_1.savePosition)(pos);
        this.persistState();
        logger_1.logger.info('[AGENT] Opened: ' +
            pos.tokenMint.slice(0, 8) +
            '... | ' +
            pos.amountSol.toFixed(4) +
            ' SOL');
    }
    updatePosition(pos) {
        const idx = this.dailyState.positions.findIndex((p) => p.tokenMint === pos.tokenMint);
        if (idx >= 0) {
            this.dailyState.positions[idx] = pos;
            (0, positionRepo_1.savePosition)(pos);
        }
    }
    closePosition(mint, pnl, reason) {
        this.dailyState.positions = this.dailyState.positions.filter((p) => p.tokenMint !== mint);
        this.dailyState.currentCapital += pnl;
        this.dailyState.dailyPnlPercent =
            ((this.dailyState.currentCapital - this.dailyState.startingCapital) /
                this.dailyState.startingCapital) *
                100;
        if (pnl > 0) {
            this.dailyState.wins++;
            if (['TP1_SECURED', 'MOONBAG_EXIT'].includes(reason)) {
                this.dailyState.lastTpExit = Date.now();
            }
        }
        else {
            this.dailyState.losses++;
            if (reason === 'HARD_SL') {
                this.dailyState.lastSlHit = Date.now();
            }
        }
        if (this.dailyState.dailyPnlPercent <= -this.config.circuitBreakerPercent) {
            this.dailyState.circuitBreakerActive = true;
            this.dailyState.circuitBreakerUntil = Date.now() + 86400000;
            logger_1.logger.warn('[AGENT] CIRCUIT BREAKER: ' + this.dailyState.dailyPnlPercent.toFixed(2) + '%');
        }
        if (['RUG_DETECTED', 'LIQUIDITY_DRAINED', 'INSIDER_DUMP'].includes(reason)) {
            this.dailyState.lastRugEmergency = Date.now();
        }
        (0, positionRepo_1.deletePosition)(mint);
        this.persistState();
        logger_1.logger.info('[AGENT] Closed: ' +
            mint.slice(0, 8) +
            '... | PnL: ' +
            pnl.toFixed(4) +
            ' | ' +
            reason);
    }
    makeOutput(aksi, pct, alasan, fm, size) {
        return {
            aksi,
            persentase: pct,
            alasan,
            sl_current: 0,
            trailing_active: false,
            daily_pnl_pct: this.dailyState.dailyPnlPercent,
            fee_mode: fm,
            position_size_sol: size,
        };
    }
    getState() {
        return { ...this.dailyState };
    }
    getConfig() {
        return { ...this.config };
    }
    getPositions() {
        return [...this.dailyState.positions];
    }
}
exports.KabayanAgent = KabayanAgent;
//# sourceMappingURL=agent.js.map