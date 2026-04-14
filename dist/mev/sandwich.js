"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeSandwich = executeSandwich;
const logger_1 = require("../utils/logger");
const swap_1 = require("../execution/swap");
async function executeSandwich(conn, target, wallet, config) {
    try {
        logger_1.logger.info(`[SANDWICH] Target: ${target.mint.slice(0, 8)}... | ${target.amountSol} SOL`);
        const frontrun = await (0, swap_1.executeSwap)(conn, 'SOL', target.mint, target.amountSol * 0.3, config.maxSlippage);
        if (!frontrun.success) {
            logger_1.logger.warn('[SANDWICH] Frontrun failed');
            return false;
        }
        const backrun = await (0, swap_1.executeSwap)(conn, target.mint, 'SOL', 100, config.maxSlippage);
        if (!backrun.success) {
            logger_1.logger.warn('[SANDWICH] Backrun failed');
            return false;
        }
        logger_1.logger.info('[SANDWICH] Executed');
        return true;
    }
    catch (e) {
        logger_1.logger.error(`[SANDWICH] Error: ${e.message}`);
        return false;
    }
}
//# sourceMappingURL=sandwich.js.map