"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logBuy = logBuy;
exports.logSell = logSell;
const tradeRepo_1 = require("../database/tradeRepo");
function logBuy(mint, name, sol, tokens, price, tx, fee, reason) {
    (0, tradeRepo_1.insertTrade)({ token_mint: mint, token_name: name, action: 'BUY', amount_sol: sol, amount_token: tokens, price, tx_hash: tx, fee_mode: fee, reason, pnl_sol: 0, created_at: Date.now() });
}
function logSell(mint, name, sol, tokens, price, tx, fee, reason, pnl) {
    (0, tradeRepo_1.insertTrade)({ token_mint: mint, token_name: name, action: 'SELL', amount_sol: sol, amount_token: tokens, price, tx_hash: tx, fee_mode: fee, reason, pnl_sol: pnl, created_at: Date.now() });
}
//# sourceMappingURL=journal.js.map