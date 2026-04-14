import { getDb } from './db';
import { DailyState } from '../ai/types';

export function saveDailyState(state: DailyState): void {
  const db = getDb();
  db.prepare(`
    INSERT OR REPLACE INTO daily_stats
    (date, starting_capital, current_capital, total_trades, wins, losses,
     daily_pnl_pct, circuit_breaker_active, circuit_breaker_until,
     last_tp_exit, last_sl_hit, last_rug_emergency)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    state.date,
    state.startingCapital,
    state.currentCapital,
    state.totalTrades,
    state.wins,
    state.losses,
    state.dailyPnlPercent,
    state.circuitBreakerActive ? 1 : 0,
    state.circuitBreakerUntil,
    state.lastTpExit,
    state.lastSlHit,
    state.lastRugEmergency
  );
}

export function loadDailyState(date: string): DailyState | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM daily_stats WHERE date = ?').get(date) as any;
  if (!row) return null;

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
