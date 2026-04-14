"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.insertTrade = insertTrade;
exports.getRecentTrades = getRecentTrades;
exports.getDailyTrades = getDailyTrades;
exports.getTotalPnl = getTotalPnl;
const db_1 = require("./db");
function insertTrade(trade) {
    const db = (0, db_1.getDb)();
    const stmt = db.prepare(`
    INSERT INTO trades (token_mint, token_name, action, amount_sol, amount_token, price, tx_hash, fee_mode, reason, pnl_sol, created_at)
    VALUES (@token_mint, @token_name, @action, @amount_sol, @amount_token, @price, @tx_hash, @fee_mode, @reason, @pnl_sol, @created_at)
  `);
    const result = stmt.run(trade);
    return Number(result.lastInsertRowid);
}
function getRecentTrades(limit = 50) {
    return (0, db_1.getDb)().prepare('SELECT * FROM trades ORDER BY created_at DESC LIMIT ?').all(limit);
}
function getDailyTrades(start, end) {
    return (0, db_1.getDb)().prepare('SELECT * FROM trades WHERE created_at >= ? AND created_at < ? ORDER BY created_at DESC').all(start, end);
}
function getTotalPnl() {
    const result = (0, db_1.getDb)().prepare('SELECT COALESCE(SUM(pnl_sol), 0) as total FROM trades WHERE action = ?').get('SELL');
    return result?.total || 0;
}
//# sourceMappingURL=tradeRepo.js.map