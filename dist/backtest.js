"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STRATEGIES = void 0;
exports.runBacktest = runBacktest;
exports.compareStrategies = compareStrategies;
exports.exportResults = exportResults;
const logger_1 = require("./utils/logger");
const feeMode_1 = require("./ai/feeMode");
// Better price simulation with realistic meme coin behavior
function generateSimulatedTokens(config) {
    const tokens = [];
    const totalTokens = config.tokensPerDay * config.simulationDays;
    for (let i = 0; i < totalTokens; i++) {
        const prices = [];
        const timestamps = [];
        const basePrice = 0.000001 + Math.random() * 0.0001;
        // Meme coin distribution: 30% pump, 30% dump, 25% volatile, 15% slow rug
        const trendRoll = Math.random();
        const trend = trendRoll < 0.3
            ? "pump"
            : trendRoll < 0.6
                ? "dump"
                : trendRoll < 0.85
                    ? "volatile"
                    : "slowrug";
        const points = 480; // 8 hours * 60 minutes
        let price = basePrice;
        for (let j = 0; j < points; j++) {
            const noise = (Math.random() - 0.5) * 0.15;
            let drift = 0;
            if (trend === "pump") {
                // Early pump then stabilize
                if (j < 60)
                    drift = 0.008;
                else if (j < 120)
                    drift = 0.003;
                else
                    drift = -0.001 + Math.random() * 0.002;
            }
            else if (trend === "dump") {
                // Quick initial spike then dump
                if (j < 15)
                    drift = 0.01;
                else if (j < 30)
                    drift = -0.002;
                else
                    drift = -0.005;
            }
            else if (trend === "volatile") {
                // Big swings up and down
                drift = Math.sin(j / 30) * 0.006;
            }
            else {
                // Slow rug pull
                if (j < 30)
                    drift = 0.003;
                else
                    drift = -0.002;
            }
            price = price * (1 + drift + noise);
            price = Math.max(price, basePrice * 0.001);
            prices.push(price);
            timestamps.push(j * 60000);
        }
        tokens.push({
            mint: "SIM" + i.toString().padStart(6, "0"),
            prices: prices,
            timestamps: timestamps,
            trend: trend,
        });
    }
    return tokens;
}
function simulateTrade(token, config) {
    const feeSchedule = (0, feeMode_1.getFeeSchedule)("NORMAL");
    const entryIdx = Math.floor(Math.random() * Math.min(30, token.prices.length - 1));
    const entryPrice = token.prices[entryIdx];
    const amountSol = (config.startingCapital * config.baseRiskPercent) / 100;
    const fees = amountSol * (feeSchedule.buyFee + feeSchedule.sellFee);
    let trailingStop = entryPrice * (1 - config.hardSlPercent / 100);
    let highestPrice = entryPrice;
    let exitPrice = entryPrice;
    let exitIdx = entryIdx;
    let exitReason = "TIMEOUT";
    for (let i = entryIdx + 1; i < token.prices.length; i++) {
        const price = token.prices[i];
        if (price > highestPrice) {
            highestPrice = price;
            trailingStop = highestPrice * (1 - config.trailingDelta);
        }
        // TP2 check first (higher target)
        if (price >= entryPrice * (1 + config.tp2Percent / 100)) {
            exitPrice = price;
            exitIdx = i;
            exitReason = "TP2";
            break;
        }
        // TP1 check
        if (price >= entryPrice * (1 + config.tp1Percent / 100)) {
            exitPrice = price;
            exitIdx = i;
            exitReason = "TP1";
            break;
        }
        // Hard SL
        if (price <= entryPrice * (1 - config.hardSlPercent / 100)) {
            exitPrice = price;
            exitIdx = i;
            exitReason = "HARD_SL";
            break;
        }
        // Trailing SL (only after profit)
        if (config.trailingDelta > 0 &&
            highestPrice > entryPrice * 1.05 &&
            price <= trailingStop) {
            exitPrice = price;
            exitIdx = i;
            exitReason = "TRAILING_SL";
            break;
        }
    }
    const pnlPercent = ((exitPrice - entryPrice) / entryPrice) * 100;
    const tokens = amountSol / entryPrice;
    const finalPnlSol = tokens * (exitPrice - entryPrice) - fees;
    return {
        tokenMint: token.mint,
        entryPrice: entryPrice,
        exitPrice: exitPrice,
        entryTime: token.timestamps[entryIdx],
        exitTime: token.timestamps[exitIdx],
        amountSol: amountSol,
        pnlSol: finalPnlSol,
        pnlPercent: pnlPercent,
        exitReason: exitReason,
        fees: fees,
    };
}
async function runBacktest(config) {
    // Use balanced strategy as default
    const defaultConfig = config || exports.STRATEGIES["balanced"];
    const tokens = generateSimulatedTokens(defaultConfig);
    const trades = [];
    for (let ti = 0; ti < tokens.length; ti++) {
        const trade = simulateTrade(tokens[ti], defaultConfig);
        if (trade)
            trades.push(trade);
    }
    const wins = trades.filter(function (t) {
        return t.pnlSol > 0;
    });
    const losses = trades.filter(function (t) {
        return t.pnlSol <= 0;
    });
    const totalPnl = trades.reduce(function (s, t) {
        return s + t.pnlSol;
    }, 0);
    const totalFees = trades.reduce(function (s, t) {
        return s + t.fees;
    }, 0);
    const grossWins = wins.reduce(function (s, t) {
        return s + t.pnlSol;
    }, 0);
    const grossLosses = Math.abs(losses.reduce(function (s, t) {
        return s + t.pnlSol;
    }, 0));
    let peak = defaultConfig.startingCapital;
    let maxDd = 0;
    let balance = defaultConfig.startingCapital;
    for (let bi = 0; bi < trades.length; bi++) {
        balance += trades[bi].pnlSol;
        if (balance > peak)
            peak = balance;
        const dd = peak - balance;
        if (dd > maxDd)
            maxDd = dd;
    }
    const returns = trades.map(function (t) {
        return t.pnlPercent;
    });
    const avgReturn = returns.reduce(function (s, r) {
        return s + r;
    }, 0) / (returns.length || 1);
    const variance = returns.reduce(function (s, r) {
        return s + Math.pow(r - avgReturn, 2);
    }, 0) / (returns.length || 1);
    const stdDev = Math.sqrt(variance);
    const sharpe = stdDev > 0 ? avgReturn / stdDev : 0;
    const endingCapital = defaultConfig.startingCapital + totalPnl;
    const totalReturn = totalPnl;
    const totalReturnPercent = (totalReturn / defaultConfig.startingCapital) * 100;
    return {
        config: defaultConfig,
        startingCapital: defaultConfig.startingCapital,
        endingCapital: endingCapital,
        totalReturn: totalReturn,
        totalReturnPercent: totalReturnPercent,
        totalTrades: trades.length,
        wins: wins.length,
        losses: losses.length,
        winRate: trades.length > 0 ? (wins.length / trades.length) * 100 : 0,
        profitFactor: grossLosses > 0 ? grossWins / grossLosses : grossWins > 0 ? Infinity : 0,
        maxDrawdown: maxDd,
        maxDrawdownPercent: (maxDd / defaultConfig.startingCapital) * 100,
        sharpeRatio: sharpe,
        evPerTrade: trades.length > 0 ? totalPnl / trades.length : 0,
        totalFeesPaid: totalFees,
        trades: trades,
    };
}
exports.STRATEGIES = {
    conservative: {
        strategy: "Conservative",
        startingCapital: 1,
        baseRiskPercent: 3,
        tp1Percent: 25,
        tp2Percent: 50,
        hardSlPercent: 15,
        trailingDelta: 0.08,
        circuitBreakerPercent: 10,
        maxPositions: 3,
        simulationDays: 7,
        tokensPerDay: 5,
    },
    balanced: {
        strategy: "Balanced",
        startingCapital: 1,
        baseRiskPercent: 5,
        tp1Percent: 35,
        tp2Percent: 80,
        hardSlPercent: 20,
        trailingDelta: 0.1,
        circuitBreakerPercent: 15,
        maxPositions: 5,
        simulationDays: 7,
        tokensPerDay: 8,
    },
    aggressive: {
        strategy: "Aggressive",
        startingCapital: 1,
        baseRiskPercent: 8,
        tp1Percent: 50,
        tp2Percent: 120,
        hardSlPercent: 25,
        trailingDelta: 0.12,
        circuitBreakerPercent: 20,
        maxPositions: 7,
        simulationDays: 7,
        tokensPerDay: 12,
    },
    sniper: {
        strategy: "Sniper",
        startingCapital: 1,
        baseRiskPercent: 10,
        tp1Percent: 60,
        tp2Percent: 150,
        hardSlPercent: 30,
        trailingDelta: 0.15,
        circuitBreakerPercent: 25,
        maxPositions: 10,
        simulationDays: 7,
        tokensPerDay: 15,
    },
    diamond_hands: {
        strategy: "Diamond Hands",
        startingCapital: 1,
        baseRiskPercent: 4,
        tp1Percent: 50,
        tp2Percent: 150,
        hardSlPercent: 20,
        trailingDelta: 0.3,
        circuitBreakerPercent: 20,
        maxPositions: 5,
        simulationDays: 7,
        tokensPerDay: 8,
    },
};
async function compareStrategies(names, overrides) {
    const metrics = [];
    for (let ni = 0; ni < names.length; ni++) {
        const name = names[ni];
        const preset = exports.STRATEGIES[name];
        if (!preset)
            continue;
        const config = { ...preset, ...overrides };
        const result = await runBacktest(config);
        metrics.push({
            name: name,
            returnPercent: result.totalReturnPercent,
            winRate: result.winRate,
            profitFactor: result.profitFactor,
            maxDrawdown: result.maxDrawdownPercent,
            sharpeRatio: result.sharpeRatio,
            evPerTrade: result.evPerTrade,
        });
    }
    let winner = metrics[0];
    for (let mi = 1; mi < metrics.length; mi++) {
        if (metrics[mi].returnPercent > winner.returnPercent) {
            winner = metrics[mi];
        }
    }
    return { metrics: metrics, winner: winner.name };
}
function exportResults(result, filename) {
    const fs = require("fs");
    const path = require("path");
    const dir = path.join(process.cwd(), "backtest_results");
    if (!fs.existsSync(dir))
        fs.mkdirSync(dir, { recursive: true });
    const filepath = path.join(dir, filename);
    fs.writeFileSync(filepath, JSON.stringify(result, null, 2));
    logger_1.logger.info("[BACKTEST] Exported: " + filepath);
    return filepath;
}
//# sourceMappingURL=backtest.js.map