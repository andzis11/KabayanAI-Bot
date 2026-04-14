"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPosition = createPosition;
exports.monitorPosition = monitorPosition;
const logger_1 = require("../utils/logger");
function createPosition(mint, entryPrice, amount, amountSol, feeMode, alpha) {
    return {
        tokenMint: mint,
        entryPrice,
        amount,
        amountSol,
        initialSL: entryPrice * 0.80,
        trailingDelta: 0.218,
        trailingActivation: entryPrice * 1.20,
        tp1Target: entryPrice * 1.775,
        peak: entryPrice,
        trailingActive: false,
        isMoonbag: false,
        moonbagSL: 0,
        ath: entryPrice,
        timestamp: Date.now(),
        feeMode,
        alphaSignal: alpha,
    };
}
function monitorPosition(pos, price) {
    const u = { ...pos };
    // Update ATH
    if (price > u.ath) {
        u.ath = price;
    }
    // Update peak for trailing
    if (price > u.peak) {
        u.peak = price;
    }
    // Activate trailing when price hits activation level
    if (!u.trailingActive && price >= u.trailingActivation) {
        u.trailingActive = true;
        logger_1.logger.info(`[SLTP] Trailing activated at ${price.toFixed(10)}`);
    }
    // Trailing SL logic
    if (u.trailingActive) {
        const trailingSL = u.peak * (1 - u.trailingDelta);
        if (trailingSL > u.initialSL) {
            u.initialSL = trailingSL;
        }
    }
    // HARD SL — exit everything
    if (price <= u.initialSL) {
        if (u.isMoonbag) {
            logger_1.logger.info(`[SLTP] Moonbag SL: ${price} <= ${u.moonbagSL}`);
            return { action: 'SELL', sellPercent: 1.0, reason: 'MOONBAG_EXIT', updatedPosition: u };
        }
        logger_1.logger.info(`[SLTP] HARD_SL: ${price} <= ${u.initialSL}`);
        return { action: 'SELL', sellPercent: 1.0, reason: 'HARD_SL', updatedPosition: u };
    }
    // TP1 — sell 90%, keep 10% moonbag
    if (!u.isMoonbag && price >= u.tp1Target) {
        u.isMoonbag = true;
        u.moonbagSL = u.ath * 0.25;
        logger_1.logger.info(`[SLTP] TP1 at ${price.toFixed(10)} — moonbag SL: ${u.moonbagSL.toFixed(10)}`);
        return { action: 'TP1', sellPercent: 0.9, reason: 'TP1_SECURED', updatedPosition: u };
    }
    // Moonbag exit — price drops 75% from ATH
    if (u.isMoonbag && price <= u.moonbagSL) {
        logger_1.logger.info(`[SLTP] Moonbag exit: ${price} <= ${u.moonbagSL}`);
        return { action: 'SELL', sellPercent: 1.0, reason: 'MOONBAG_EXIT', updatedPosition: u };
    }
    return { action: 'HOLD', sellPercent: 0, reason: 'MONITORING', updatedPosition: u };
}
//# sourceMappingURL=sltpEngine.js.map