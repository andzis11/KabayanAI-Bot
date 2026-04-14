"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startTPSLMonitor = startTPSLMonitor;
const logger_1 = require("../utils/logger");
const market_1 = require("../data/market");
function startTPSLMonitor(_conn, config, cb, intervalMs = 3000) {
    const tp = config.entryPrice * (1 + config.takeProfitPercent / 100);
    const sl = config.entryPrice * (1 - config.stopLossPercent / 100);
    logger_1.logger.info(`[MONITOR] ${config.tokenMint.slice(0, 8)}... | TP: ${tp} | SL: ${sl}`);
    return setInterval(async () => {
        const price = await (0, market_1.getTokenPrice)(config.tokenMint);
        if (!price)
            return;
        if (price >= tp)
            cb.onTP(config.tokenMint, price);
        else if (price <= sl)
            cb.onSL(config.tokenMint, price);
    }, intervalMs);
}
//# sourceMappingURL=monitor.js.map