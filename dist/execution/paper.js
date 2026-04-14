"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paperBuy = paperBuy;
exports.paperSell = paperSell;
exports.getPaperBalance = getPaperBalance;
exports.getPaperTrades = getPaperTrades;
exports.resetPaper = resetPaper;
const logger_1 = require("../utils/logger");
let trades = [];
let balance = 10;
function paperBuy(mint, price, sol) {
    if (sol > balance) {
        logger_1.logger.warn('[PAPER] Insufficient: ' + balance + ' SOL');
        return false;
    }
    trades.push({
        tokenMint: mint,
        entryPrice: price,
        amount: sol / price,
        amountSol: sol,
        timestamp: Date.now(),
    });
    balance -= sol;
    logger_1.logger.info('[PAPER] BUY: ' + mint.slice(0, 8) + '... | ' + sol.toFixed(4) + ' SOL');
    return true;
}
function paperSell(mint, price, pct = 1.0) {
    const idx = trades.findIndex((t) => t.tokenMint === mint);
    if (idx === -1)
        return 0;
    const t = trades[idx];
    const sellAmt = t.amount * pct;
    const received = sellAmt * price;
    const pnl = received - t.amountSol * pct;
    balance += received;
    if (pct >= 1.0) {
        trades.splice(idx, 1);
    }
    else {
        t.amount -= sellAmt;
        t.amountSol -= t.amountSol * pct;
    }
    logger_1.logger.info('[PAPER] SELL: ' + mint.slice(0, 8) + '... | PnL: ' + (pnl > 0 ? '+' : '') + pnl.toFixed(4));
    return pnl;
}
function getPaperBalance() {
    return balance;
}
function getPaperTrades() {
    return [...trades];
}
function resetPaper() {
    trades = [];
    balance = 10;
}
//# sourceMappingURL=paper.js.map