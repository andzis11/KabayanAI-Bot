import {
  runBacktest,
  compareStrategies,
  STRATEGIES,
  exportResults,
} from "./src/backtest";
import { logger } from "./src/utils/logger";

async function main() {
  logger.info("========================================");
  logger.info("  🍎 KABAYAN AGENT v3.0 BACKTEST");
  logger.info("========================================\n");

  // Run single backtest with Balanced strategy (1 day)
  logger.info("📊 Running Balanced Strategy (1 Day)...\n");
  const result = await runBacktest({
    strategy: "Balanced",
    startingCapital: 1,
    baseRiskPercent: 5,
    tp1Percent: 35,
    tp2Percent: 80,
    hardSlPercent: 15,
    trailingDelta: 0.15,
    circuitBreakerPercent: 15,
    maxPositions: 5,
    simulationDays: 1,
    tokensPerDay: 20,
  });

  console.log("");
  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║                                                      ║");
  console.log("║           🍎 KABAYAN AGENT v3.0 BACKTEST             ║");
  console.log("║                                                      ║");
  console.log("╠══════════════════════════════════════════════════════╣");
  console.log(
    "║  📅 Period         : " +
      result.config.simulationDays +
      " days × 5min scans             ║",
  );
  console.log(
    "║  💰 Starting       : " +
      result.startingCapital.toFixed(4) +
      " SOL                      ║",
  );
  console.log(
    "║  💰 Ending         : " +
      result.endingCapital.toFixed(4) +
      " SOL                      ║",
  );
  console.log(
    "║  📈 Net Return     : " +
      (result.totalReturn >= 0 ? "+" : "") +
      result.totalReturn.toFixed(4) +
      " SOL (" +
      (result.totalReturnPercent >= 0 ? "+" : "") +
      result.totalReturnPercent.toFixed(2) +
      "%)           ║",
  );
  console.log("╠══════════════════════════════════════════════════════╣");
  console.log(
    "║  🔄 Total Trades   : " + result.totalTrades.toString().padEnd(38) + "║",
  );
  console.log(
    "║  ✅ Wins           : " + result.wins.toString().padEnd(38) + "║",
  );
  console.log(
    "║  ❌ Losses         : " + result.losses.toString().padEnd(38) + "║",
  );
  console.log(
    "║  📊 Win Rate       : " +
      result.winRate.toFixed(1) +
      "%                          ║",
  );
  console.log("╠══════════════════════════════════════════════════════╣");
  console.log(
    "║  🏆 Avg Win        : +" +
      (result.wins > 0
        ? (
            result.trades
              .filter((t) => t.pnlSol > 0)
              .reduce((s, t) => s + t.pnlSol, 0) / result.wins
          ).toFixed(4)
        : "0.0000") +
      " SOL                         ║",
  );
  console.log(
    "║  💀 Avg Loss       : -" +
      (result.losses > 0
        ? (
            result.trades
              .filter((t) => t.pnlSol < 0)
              .reduce((s, t) => s + Math.abs(t.pnlSol), 0) / result.losses
          ).toFixed(4)
        : "0.0000") +
      " SOL                         ║",
  );
  console.log(
    "║  📐 EV/Trade       : " +
      (result.evPerTrade >= 0 ? "+" : "") +
      result.evPerTrade.toFixed(4) +
      " SOL                     ║",
  );
  console.log(
    "║  📊 Profit Factor  : " + result.profitFactor.toFixed(2).padEnd(33) + "║",
  );
  console.log(
    "║  📉 Max Drawdown   : " +
      result.maxDrawdownPercent.toFixed(2) +
      "%                          ║",
  );
  console.log(
    "║  📈 Sharpe Ratio   : " + result.sharpeRatio.toFixed(2).padEnd(33) + "║",
  );
  console.log("╠══════════════════════════════════════════════════════╣");
  console.log(
    "║  💸 Total Fees     : " +
      result.totalFeesPaid.toFixed(4) +
      " SOL                      ║",
  );
  console.log("╠══════════════════════════════════════════════════════╣");

  const verdict =
    result.evPerTrade > 0
      ? "✅ VERDICT: STRATEGY IS PROFITABLE"
      : "❌ VERDICT: STRATEGY NEEDS OPTIMIZATION";
  console.log("║  " + verdict.padEnd(52) + "║");
  console.log("╚══════════════════════════════════════════════════════╝");

  console.log("\n");

  // Compare all strategies
  logger.info("📊 Comparing All Strategies...\n");
  const names = Object.keys(STRATEGIES);
  const comparison = await compareStrategies(names);

  console.log("");
  console.log(
    "╔══════════════════════════════════════════════════════════════════════════════════╗",
  );
  console.log(
    "║                        📊 STRATEGY COMPARISON TABLE                              ║",
  );
  console.log(
    "╠══════════════════════════════════════════════════════════════════════════════════╣",
  );

  // Header
  let header = "║  Metric          ";
  for (const m of comparison.metrics) {
    const name = m.name.padEnd(14);
    header += name;
  }
  console.log(header + "║");
  console.log(
    "╠══════════════════════════════════════════════════════════════════════════════════╣",
  );

  // Rows
  const rows = [
    {
      label: "Return %",
      values: comparison.metrics.map((m) => m.returnPercent.toFixed(1) + "%"),
    },
    {
      label: "Win Rate",
      values: comparison.metrics.map((m) => m.winRate.toFixed(1) + "%"),
    },
    {
      label: "Profit Factor",
      values: comparison.metrics.map((m) => m.profitFactor.toFixed(2)),
    },
    {
      label: "Max Drawdown",
      values: comparison.metrics.map((m) => m.maxDrawdown.toFixed(1) + "%"),
    },
    {
      label: "Sharpe Ratio",
      values: comparison.metrics.map((m) => m.sharpeRatio.toFixed(2)),
    },
    {
      label: "EV/Trade",
      values: comparison.metrics.map((m) => m.evPerTrade.toFixed(4)),
    },
  ];

  for (const row of rows) {
    let line = "║  " + row.label.padEnd(16);
    for (const val of row.values) {
      line += val.padEnd(15);
    }
    console.log(line + "║");
  }

  console.log(
    "╠══════════════════════════════════════════════════════════════════════════════════╣",
  );
  console.log("║  🏆 WINNER: " + comparison.winner.padEnd(65) + "║");
  console.log(
    "╚══════════════════════════════════════════════════════════════════════════════════╝",
  );

  // Export results
  exportResults(comparison, "comparison_results.json");

  logger.info("\n✅ Backtest complete!");
}

main().catch((err) => {
  logger.error("Backtest failed: " + err.message);
  console.error(err);
  process.exit(1);
});
