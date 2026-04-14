"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateDailyReport = generateDailyReport;
exports.formatDailyReport = formatDailyReport;
const tradeRepo_1 = require("../database/tradeRepo");
function generateDailyReport() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const end = start + 86400000;
    const trades = (0, tradeRepo_1.getDailyTrades)(start, end);
    const sells = trades.filter(t => t.action === 'SELL');
    const pnls = sells.map(t => t.pnl_sol || 0);
    const wins = sells.filter(t => (t.pnl_sol || 0) > 0);
    return {
        date: now.toISOString().split('T')[0],
        totalTrades: trades.length,
        wins: wins.length,
        losses: sells.length - wins.length,
        winRate: sells.length > 0 ? (wins.length / sells.length) * 100 : 0,
        totalPnl: pnls.reduce((a, b) => a + b, 0),
        bestTrade: pnls.length > 0 ? Math.max(...pnls) : 0,
        worstTrade: pnls.length > 0 ? Math.min(...pnls) : 0,
    };
}
function formatDailyReport(r) {
    return (`📊 *Daily Report — ${r.date}*\n\n` +
        `🔄 Trades: ${r.totalTrades}\n` +
        `✅ Wins: ${r.wins}\n` +
        `❌ Losses: ${r.losses}\n` +
        `📈 Win Rate: ${r.winRate.toFixed(1)}%\n\n` +
        `💰 PnL: ${r.totalPnl > 0 ? '+' : ''}${r.totalPnl.toFixed(4)} SOL\n` +
        `🏆 Best: +${r.bestTrade.toFixed(4)} SOL\n` +
        `💀 Worst: ${r.worstTrade.toFixed(4)} SOL`);
}
//# sourceMappingURL=dailyReport.js.map