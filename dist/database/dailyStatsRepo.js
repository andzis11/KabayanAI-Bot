"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveDailyState = saveDailyState;
exports.loadDailyState = loadDailyState;
const db_1 = require("./db");
function saveDailyState(state) {
    const db = (0, db_1.getDb)();
    db.prepare(`
    INSERT OR REPLACE INTO daily_stats
    (date, starting_capital, current_capital, total_trades, wins, losses,
     daily_pnl_pct, circuit_breaker_active, circuit_breaker_until,
     last_tp_exit, last_sl_hit, last_rug_emergency)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(state.date, state.startingCapital, state.currentCapital, state.totalTrades, state.wins, state.losses, state.dailyPnlPercent, state.circuitBreakerActive ? 1 : 0, state.circuitBreakerUntil, state.lastTpExit, state.lastSlHit, state.lastRugEmergency);
}
function loadDailyState(date) {
    const db = (0, db_1.getDb)();
    const row = db.prepare('SELECT * FROM daily_stats WHERE date = ?').get(date);
    if (!row)
        return null;
    return {
        date: row.date,
        startingCapital: row.starting_capital,
        currentCapital: row.current_capital,
        totalTrades: row.total_trades,
        wins: row.wins,
        losses: row.losses,
        dailyPnlPercent: row.daily_pnl_pct,
        circuitBreakerActive: row.circuit_breaker_active === 1,
        circuitBreakerUntil: row.circuit_breaker_until,
        lastTpExit: row.last_tp_exit,
        lastSlHit: row.last_sl_hit,
        lastRugEmergency: row.last_rug_emergency,
        positions: [],
    };
}
//# sourceMappingURL=dailyStatsRepo.js.map