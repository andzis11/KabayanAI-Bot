// Standalone backtest runner — tidak butuh .env atau Solana
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// ===== INLINE BACKTEST ENGINE (dari src/backtest.ts) =====

const FEE_SCHEDULES = {
  SAFE:       { buyFee: 0.003, sellFee: 0.003 },
  NORMAL:     { buyFee: 0.005, sellFee: 0.005 },
  AGGRESSIVE: { buyFee: 0.008, sellFee: 0.008 },
};

function getFeeSchedule(mode) {
  return FEE_SCHEDULES[mode] || FEE_SCHEDULES.NORMAL;
}

function generateSimulatedTokens(config) {
  const tokens = [];
  const totalTokens = config.tokensPerDay * config.simulationDays;
  for (let i = 0; i < totalTokens; i++) {
    const prices = [], timestamps = [];
    const basePrice = 0.000001 + Math.random() * 0.0001;
    const roll = Math.random();
    // Distribusi realistik memecoin
    const trend = roll < 0.30 ? 'pump' : roll < 0.60 ? 'dump' : roll < 0.85 ? 'volatile' : 'slowrug';
    const points = 480;
    let price = basePrice;
    for (let j = 0; j < points; j++) {
      const noise = (Math.random() - 0.5) * 0.15;
      let drift = 0;
      if (trend === 'pump') {
        if (j < 60) drift = 0.008;
        else if (j < 120) drift = 0.003;
        else drift = -0.001 + Math.random() * 0.002;
      } else if (trend === 'dump') {
        if (j < 15) drift = 0.01;
        else if (j < 30) drift = -0.002;
        else drift = -0.005;
      } else if (trend === 'volatile') {
        drift = Math.sin(j / 30) * 0.006;
      } else {
        if (j < 30) drift = 0.003;
        else drift = -0.002;
      }
      price = price * (1 + drift + noise);
      price = Math.max(price, basePrice * 0.001);
      prices.push(price);
      timestamps.push(j * 60000);
    }
    tokens.push({ mint: 'SIM' + String(i).padStart(6,'0'), prices, timestamps, trend });
  }
  return tokens;
}

function simulateTrade(token, config) {
  const feeSchedule = getFeeSchedule('NORMAL');
  const entryIdx = Math.floor(Math.random() * Math.min(30, token.prices.length - 1));
  const entryPrice = token.prices[entryIdx];
  const amountSol = (config.startingCapital * config.baseRiskPercent) / 100;
  const fees = amountSol * (feeSchedule.buyFee + feeSchedule.sellFee);
  let trailingStop = entryPrice * (1 - config.hardSlPercent / 100);
  let highestPrice = entryPrice;
  let exitPrice = entryPrice, exitIdx = entryIdx, exitReason = 'TIMEOUT';
  for (let i = entryIdx + 1; i < token.prices.length; i++) {
    const price = token.prices[i];
    if (price > highestPrice) {
      highestPrice = price;
      trailingStop = highestPrice * (1 - config.trailingDelta);
    }
    if (price >= entryPrice * (1 + config.tp2Percent / 100)) { exitPrice = price; exitIdx = i; exitReason = 'TP2'; break; }
    if (price >= entryPrice * (1 + config.tp1Percent / 100)) { exitPrice = price; exitIdx = i; exitReason = 'TP1'; break; }
    if (price <= entryPrice * (1 - config.hardSlPercent / 100)) { exitPrice = price; exitIdx = i; exitReason = 'HARD_SL'; break; }
    if (config.trailingDelta > 0 && highestPrice > entryPrice * 1.05 && price <= trailingStop) { exitPrice = price; exitIdx = i; exitReason = 'TRAILING_SL'; break; }
  }
  const pnlPercent = ((exitPrice - entryPrice) / entryPrice) * 100;
  const tokens_held = amountSol / entryPrice;
  const finalPnlSol = tokens_held * (exitPrice - entryPrice) - fees;
  return { tokenMint: token.mint, entryPrice, exitPrice, entryTime: token.timestamps[entryIdx],
    exitTime: token.timestamps[exitIdx], amountSol, pnlSol: finalPnlSol, pnlPercent, exitReason, fees, trend: token.trend };
}

async function runBacktest(config) {
  const tokens = generateSimulatedTokens(config);
  const trades = tokens.map(t => simulateTrade(t, config)).filter(Boolean);
  const wins = trades.filter(t => t.pnlSol > 0);
  const losses = trades.filter(t => t.pnlSol <= 0);
  const totalPnl = trades.reduce((s, t) => s + t.pnlSol, 0);
  const totalFees = trades.reduce((s, t) => s + t.fees, 0);
  const grossWins = wins.reduce((s, t) => s + t.pnlSol, 0);
  const grossLosses = Math.abs(losses.reduce((s, t) => s + t.pnlSol, 0));
  let peak = config.startingCapital, maxDd = 0, balance = config.startingCapital;
  const dailyPnl = Array(config.simulationDays).fill(0);
  trades.forEach((t, i) => {
    balance += t.pnlSol;
    if (balance > peak) peak = balance;
    const dd = peak - balance;
    if (dd > maxDd) maxDd = dd;
    const day = Math.floor(i / config.tokensPerDay);
    if (day < config.simulationDays) dailyPnl[day] += t.pnlSol;
  });
  const returns = trades.map(t => t.pnlPercent);
  const avgReturn = returns.reduce((s, r) => s + r, 0) / (returns.length || 1);
  const variance = returns.reduce((s, r) => s + Math.pow(r - avgReturn, 2), 0) / (returns.length || 1);
  const stdDev = Math.sqrt(variance);
  const sharpe = stdDev > 0 ? avgReturn / stdDev : 0;
  const endingCapital = config.startingCapital + totalPnl;
  // Exit reason stats
  const exitReasons = {};
  trades.forEach(t => { exitReasons[t.exitReason] = (exitReasons[t.exitReason] || 0) + 1; });
  return {
    config, startingCapital: config.startingCapital, endingCapital,
    totalReturn: totalPnl, totalReturnPercent: (totalPnl / config.startingCapital) * 100,
    totalTrades: trades.length, wins: wins.length, losses: losses.length,
    winRate: trades.length > 0 ? (wins.length / trades.length) * 100 : 0,
    profitFactor: grossLosses > 0 ? grossWins / grossLosses : grossWins > 0 ? 99 : 0,
    maxDrawdown: maxDd, maxDrawdownPercent: (maxDd / config.startingCapital) * 100,
    sharpeRatio: sharpe, evPerTrade: trades.length > 0 ? totalPnl / trades.length : 0,
    totalFeesPaid: totalFees, trades, dailyPnl, exitReasons,
    bestTrade: trades.reduce((b, t) => t.pnlSol > b.pnlSol ? t : b, trades[0]),
    worstTrade: trades.reduce((w, t) => t.pnlSol < w.pnlSol ? t : w, trades[0]),
  };
}

const STRATEGIES = {
  conservative: { strategy:'Conservative', startingCapital:1, baseRiskPercent:3, tp1Percent:25, tp2Percent:50,
    hardSlPercent:15, trailingDelta:0.08, circuitBreakerPercent:10, maxPositions:3, simulationDays:7, tokensPerDay:5 },
  balanced: { strategy:'Balanced', startingCapital:1, baseRiskPercent:5, tp1Percent:35, tp2Percent:80,
    hardSlPercent:20, trailingDelta:0.10, circuitBreakerPercent:15, maxPositions:5, simulationDays:7, tokensPerDay:8 },
  aggressive: { strategy:'Aggressive', startingCapital:1, baseRiskPercent:8, tp1Percent:50, tp2Percent:120,
    hardSlPercent:25, trailingDelta:0.12, circuitBreakerPercent:20, maxPositions:7, simulationDays:7, tokensPerDay:12 },
  sniper: { strategy:'Sniper', startingCapital:1, baseRiskPercent:10, tp1Percent:60, tp2Percent:150,
    hardSlPercent:30, trailingDelta:0.15, circuitBreakerPercent:25, maxPositions:10, simulationDays:7, tokensPerDay:15 },
  diamond_hands: { strategy:'Diamond Hands', startingCapital:1, baseRiskPercent:4, tp1Percent:50, tp2Percent:150,
    hardSlPercent:20, trailingDelta:0.30, circuitBreakerPercent:20, maxPositions:5, simulationDays:7, tokensPerDay:8 },
};

// Run semua strategi
const results = [];
for (const [name, cfg] of Object.entries(STRATEGIES)) {
  const r = await runBacktest(cfg);
  results.push({ name, ...r });
}

// Output JSON untuk diproses
console.log(JSON.stringify(results, null, 0));
