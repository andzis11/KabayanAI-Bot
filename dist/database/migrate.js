"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.migrateOldData = migrateOldData;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const tradeRepo_1 = require("./tradeRepo");
const logger_1 = require("../utils/logger");
const OLD_DATA_PATH = path_1.default.join(process.cwd(), 'trades.json');
function migrateOldData() {
    if (!fs_1.default.existsSync(OLD_DATA_PATH)) {
        logger_1.logger.info('[MIGRATE] No trades.json — skipping');
        return;
    }
    try {
        const raw = fs_1.default.readFileSync(OLD_DATA_PATH, 'utf-8');
        const trades = JSON.parse(raw);
        if (!Array.isArray(trades) || trades.length === 0)
            return;
        let migrated = 0;
        for (const t of trades) {
            try {
                (0, tradeRepo_1.insertTrade)({
                    token_mint: t.tokenMint || t.token_mint || 'unknown',
                    token_name: t.tokenName || t.token_name,
                    action: t.action || 'BUY',
                    amount_sol: t.amountSol || t.amount_sol || 0,
                    amount_token: t.amountToken || t.amount_token,
                    price: t.price,
                    tx_hash: t.txHash || t.tx_hash,
                    fee_mode: t.feeMode || t.fee_mode,
                    reason: t.reason,
                    pnl_sol: t.pnlSol || t.pnl_sol || 0,
                    created_at: t.timestamp || t.created_at || Date.now(),
                });
                migrated++;
            }
            catch { /* skip */ }
        }
        fs_1.default.renameSync(OLD_DATA_PATH, `${OLD_DATA_PATH}.bak`);
        logger_1.logger.info(`[MIGRATE] Migrated ${migrated} trades`);
    }
    catch (error) {
        logger_1.logger.error(`[MIGRATE] Error: ${error.message}`);
    }
}
//# sourceMappingURL=migrate.js.map