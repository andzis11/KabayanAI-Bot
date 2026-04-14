import TelegramBot from "node-telegram-bot-api";
import { ENV } from "./config/env";
import {
  connection,
  wallet,
  walletPubkey,
  getBalance,
  getWalletAddress,
} from "./config/wallet";
import { logger } from "./utils/logger";
import { runPrelaunchCheck } from "./utils/prelaunchCheck";
import { KabayanAgent } from "./ai/agent";
import { createPosition } from "./ai/sltpEngine";
import { getFeeSchedule } from "./ai/feeMode";
import {
  addAlphaWallet,
  removeAlphaWallet,
  getAlphaWallets,
} from "./ai/alphaWallet";
import { startAlphaMonitor } from "./scanners/alphaMonitor";
import {
  getMEVState,
  setMEVSandwich,
  setMEVArbitrage,
  startMempoolScanner,
} from "./mev/mevScanner";
import { executeSwap } from "./execution/swap";
import { paperBuy, paperSell } from "./execution/paper";
import { startPumpFunScanner } from "./scanners/pumpfun";
import { loadMemory } from "./state/memory";
import { checkRateLimit } from "./security/rateLimit";
import { getRateLimitStats } from "./security/apiRateLimit";
import { generateDailyReport, formatDailyReport } from "./utils/dailyReport";
import { checkHealth } from "./utils/healthCheck";
import { migrateOldData } from "./database/migrate";
import { loadPositions } from "./database/positionRepo";
import { saveDailyState } from "./database/dailyStatsRepo";
import { HybridPriceFeed } from "./data/priceFeed";
import { quickHoneypotCheck } from "./data/honeypot";
import {
  runBacktest,
  compareStrategies,
  STRATEGIES,
  exportResults,
} from "./backtest";
import { Position, AIOutput } from "./ai/types";
import {
  getSniperConfig,
  updateSniperConfig,
  resetSniperConfig,
} from "./config/sniperConfig";
import WebSocket from "ws";
import * as fs from "fs";
import * as path from "path";
import * as net from "net";

const LOCK_FILE = path.join(__dirname, "../data/.kabayan.lock");
const LOCK_PORT = 19876;

async function acquireLock(): Promise<boolean> {
  try {
    const server = net.createServer();
    return new Promise((resolve, reject) => {
      server.once("error", (err: any) => {
        if (err.code === "EADDRINUSE") {
          logger.error(
            "[LOCK] Another instance is already running (port " +
              LOCK_PORT +
              ")",
          );
          logger.error(
            "[LOCK] Stop the other instance first or remove: " + LOCK_FILE,
          );
          resolve(false);
        } else {
          reject(err);
        }
      });
      server.listen(LOCK_PORT, "127.0.0.1", () => {
        fs.writeFileSync(LOCK_FILE, process.pid.toString(), "utf8");
        logger.info("[LOCK] Acquired instance lock (PID: " + process.pid + ")");
        resolve(true);
      });
    });
  } catch (error: any) {
    logger.error("[LOCK] Failed to acquire lock: " + error.message);
    return false;
  }
}

function releaseLock() {
  try {
    if (fs.existsSync(LOCK_FILE)) {
      fs.unlinkSync(LOCK_FILE);
      logger.info("[LOCK] Released instance lock");
    }
  } catch (error: any) {
    logger.error("[LOCK] Error releasing lock: " + error.message);
  }
}

let bot: TelegramBot | null = null;
const agent = new KabayanAgent(connection, {
  dailyCapital: ENV.DAILY_CAPITAL,
  baseRiskPercent: ENV.BASE_RISK_PERCENT,
  alphaMultiplier: ENV.ALPHA_MULTIPLIER,
  feeCap: ENV.FEE_CAP,
});
const priceFeed = new HybridPriceFeed(
  "wss://mainnet.helius-rpc.com/?api-key=" + ENV.HELIUS_API_KEY,
);

let aiSniperActive = false;
let paperMode = false;
let pumpFunWs: WebSocket | null = null;
let alphaMonitorInterval: ReturnType<typeof setInterval> | null = null;
let monitorRunning = false;
const sellingPositions: Set<string> = new Set();

const mainMenu = {
  reply_markup: {
    inline_keyboard: [
      [{ text: "📥 Buy Manual", callback_data: "buy_manual" }],
      [{ text: "📤 Sell Manual", callback_data: "sell_manual" }],
      [{ text: "🤖 AI Agent Status", callback_data: "ai_status" }],
      [{ text: "🎯 Activate AI Sniper", callback_data: "toggle_sniper" }],
      [{ text: "🔍 MEV Bot", callback_data: "mev_menu" }],
      [{ text: "📊 Backtest", callback_data: "backtest" }],
      [{ text: "💼 Portfolio", callback_data: "portfolio" }],
      [{ text: "💰 Deposit", callback_data: "deposit" }],
      [{ text: "🏧 Withdraw", callback_data: "withdraw" }],
      [{ text: "📈 PnL", callback_data: "pnl" }],
      [{ text: "⚙️ Settings", callback_data: "settings" }],
    ],
  },
};
const mevMenu = {
  reply_markup: {
    inline_keyboard: [
      [{ text: "🥪 Sandwich Mode", callback_data: "mev_sandwich" }],
      [{ text: "⚡ Arbitrage Mode", callback_data: "mev_arbitrage" }],
      [{ text: "📊 MEV Status", callback_data: "mev_status" }],
      [{ text: "⬅️ Back", callback_data: "main_menu" }],
    ],
  },
};
const settingsMenu = {
  reply_markup: {
    inline_keyboard: [
      [{ text: "📝 Paper Mode", callback_data: "toggle_paper" }],
      [{ text: "🎯 AI Sniper", callback_data: "toggle_sniper" }],
      [{ text: "⚙️ Sniper Settings", callback_data: "sniper_settings" }],
      [{ text: "🔍 MEV Bot", callback_data: "mev_menu" }],
      [{ text: "⬅️ Back", callback_data: "main_menu" }],
    ],
  },
};
const backtestMenu = {
  reply_markup: {
    inline_keyboard: [
      [{ text: "🎯 Single Strategy", callback_data: "bt_single" }],
      [{ text: "⚖️ Compare All", callback_data: "bt_compare" }],
      [{ text: "🔧 Custom Config", callback_data: "bt_custom" }],
      [{ text: "👁️ View Presets", callback_data: "bt_presets" }],
      [{ text: "⬅️ Back", callback_data: "main_menu" }],
    ],
  },
};
const strategySelect = {
  reply_markup: {
    inline_keyboard: [
      [{ text: "Conservative", callback_data: "bt_run:conservative" }],
      [{ text: "Balanced", callback_data: "bt_run:balanced" }],
      [{ text: "Aggressive", callback_data: "bt_run:aggressive" }],
      [{ text: "Sniper", callback_data: "bt_run:sniper" }],
      [{ text: "Diamond Hands", callback_data: "bt_run:diamond_hands" }],
      [{ text: "⬅️ Back", callback_data: "backtest" }],
    ],
  },
};

function getSniperMenu(): any {
  const cfg = getSniperConfig();
  return {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "Amount: " + cfg.amountSol + " SOL",
            callback_data: "sniper_amount",
          },
        ],
        [{ text: "Fee: " + cfg.feeMode, callback_data: "sniper_fee" }],
        [
          {
            text: "Max Age: " + cfg.maxAgeSeconds + "s",
            callback_data: "sniper_age",
          },
        ],
        [
          {
            text: "Min Liq: $" + cfg.minLiquidity,
            callback_data: "sniper_liquidity",
          },
        ],
        [
          {
            text: "Max Holder: " + cfg.maxTopHolder + "%",
            callback_data: "sniper_holder",
          },
        ],
        [
          {
            text: "Honeypot: " + (cfg.honeypotCheck ? "ON" : "OFF"),
            callback_data: "sniper_honeypot",
          },
        ],
        [
          {
            text: "Security: " + (cfg.securityGate ? "ON" : "OFF"),
            callback_data: "sniper_security",
          },
        ],
        [{ text: "🔄 Reset Default", callback_data: "sniper_reset" }],
        [{ text: "⬅️ Back", callback_data: "settings" }],
      ],
    },
  };
}

function formatSniperStatus(): string {
  const cfg = getSniperConfig();
  return [
    "SNIPER SETTINGS",
    "",
    "Amount: " + cfg.amountSol + " SOL",
    "Fee Mode: " + cfg.feeMode,
    "Max Age: " + cfg.maxAgeSeconds + "s",
    "Min Liquidity: $" + cfg.minLiquidity,
    "Max Top Holder: " + cfg.maxTopHolder + "%",
    "Honeypot: " + (cfg.honeypotCheck ? "ON" : "OFF"),
    "Security: " + (cfg.securityGate ? "ON" : "OFF"),
  ].join("\n");
}

bot.onText(/\/start/, async (msg: any) => {
  const addr = await getWalletAddress();
  const bal = await getBalance();
  await bot.sendMessage(
    msg.chat.id,
    "🤖 KABAYAN AGENT v3.0\n\n📦 Wallet: " +
      addr +
      "\n💰 Balance: " +
      bal.toFixed(4) +
      " SOL\n\nPilih aksi:",
    mainMenu,
  );
});

bot.onText(/\/help/, async (msg: any) => {
  await bot.sendMessage(
    msg.chat.id,
    "Help\n\n/start - Menu\n/sniper - Sniper Settings\n/status\n/report\n/health\n/backtest\n/my_wallet\n/withdraw <addr> <amount>",
  );
});

bot.onText(/\/my_wallet/, async (msg: any) => {
  const addr = await getWalletAddress();
  const bal = await getBalance();
  await bot.sendMessage(
    msg.chat.id,
    "Wallet\n\nAddress: " + addr + "\nBalance: " + bal.toFixed(4) + " SOL",
  );
});

bot.onText(/\/status/, async (msg: any) => {
  const s = agent.getState();
  const m = getMEVState();
  const ps = priceFeed.getStats();
  await bot.sendMessage(
    msg.chat.id,
    "📊 Status\n\n🎯 Sniper: " +
      (aiSniperActive ? "✅ ON" : "❌ OFF") +
      "\n\U0001F4DD Paper: " +
      (paperMode ? "✅ ON" : "❌ OFF") +
      "\n\U0001F96A Sandwich: " +
      (m.sandwichEnabled ? "✅ ON" : "❌ OFF") +
      "\n\u26a1 Arbitrage: " +
      (m.arbitrageEnabled ? "✅ ON" : "❌ OFF") +
      "\n🔄 Price Feed: " +
      (ps.connected ? "✅ WS" : "❌ API") +
      "\n\n📈 PnL: " +
      s.dailyPnlPercent.toFixed(2) +
      "%\n📋 Positions: " +
      s.positions.length +
      "\n\u2705 Wins: " +
      s.wins +
      " | ❌ Losses: " +
      s.losses,
  );
});

bot.onText(/\/report/, async (msg: any) => {
  await bot.sendMessage(msg.chat.id, formatDailyReport(generateDailyReport()));
});
bot.onText(/\/health/, async (msg: any) => {
  const h = await checkHealth();
  await bot.sendMessage(
    msg.chat.id,
    "Health\n\nRPC: " +
      (h.solanaRpc ? "OK" : "FAIL") +
      "\nDB: " +
      (h.database ? "OK" : "FAIL") +
      "\nRAM: " +
      h.memoryMb +
      "MB\nUptime: " +
      h.uptime,
  );
});
bot.onText(/\/backtest/, async (msg: any) => {
  await bot.sendMessage(
    msg.chat.id,
    "Backtest Engine\n\nPilih mode:",
    backtestMenu,
  );
});
bot.onText(/\/sniper/, async (msg: any) => {
  await bot.sendMessage(msg.chat.id, formatSniperStatus(), getSniperMenu());
});

bot.onText(/\/withdraw (.+)/, async (msg: any, match: any) => {
  const args = match?.[1]?.split(" ");
  if (!args || args.length < 2) {
    await bot.sendMessage(msg.chat.id, "Format: /withdraw <addr> <amount>");
    return;
  }
  try {
    const {
      SystemProgram,
      PublicKey,
      Transaction,
      sendAndConfirmTransaction,
      LAMPORTS_PER_SOL,
    } = await import("@solana/web3.js");
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: walletPubkey,
        toPubkey: new PublicKey(args[0]),
        lamports: Math.round(parseFloat(args[1]) * LAMPORTS_PER_SOL),
      }),
    );
    const sig = await sendAndConfirmTransaction(connection, tx, [wallet]);
    await bot.sendMessage(
      msg.chat.id,
      "Withdraw: " + args[1] + " SOL\nTX: " + sig,
    );
  } catch (e: any) {
    await bot.sendMessage(msg.chat.id, "Error: " + e.message);
  }
});

bot.onText(/\/alpha_add (.+)/, async (msg: any, match: any) => {
  const w = match?.[1]?.trim();
  if (w) {
    addAlphaWallet(w);
    await bot.sendMessage(msg.chat.id, "Added: " + w.slice(0, 12) + "...");
  }
});
bot.onText(/\/alpha_remove (.+)/, async (msg: any, match: any) => {
  const w = match?.[1]?.trim();
  if (w) {
    removeAlphaWallet(w);
    await bot.sendMessage(msg.chat.id, "Removed: " + w.slice(0, 12) + "...");
  }
});
bot.onText(/\/alpha_list/, async (msg: any) => {
  const list = getAlphaWallets();
  if (list.length === 0) {
    await bot.sendMessage(msg.chat.id, "No alpha wallets");
    return;
  }
  await bot.sendMessage(
    msg.chat.id,
    "Alpha:\n" +
      list.map((w: string, i: number) => i + 1 + ". " + w).join("\n"),
  );
});

bot.onText(/\/bt_custom (.+)/, async (msg: any, match: any) => {
  const args = match?.[1]?.split(" ");
  if (!args || args.length < 4) {
    await bot.sendMessage(
      msg.chat.id,
      "Format: /bt_custom <capital> <risk%> <days> <strategy>",
    );
    return;
  }
  const capital = parseFloat(args[0]);
  const risk = parseFloat(args[1]);
  const days = parseInt(args[2]);
  const sn = args[3].toLowerCase();
  if (isNaN(capital) || isNaN(risk) || isNaN(days)) {
    await bot.sendMessage(msg.chat.id, "Invalid numbers");
    return;
  }
  const preset = STRATEGIES[sn];
  if (!preset) {
    await bot.sendMessage(msg.chat.id, "Unknown: " + sn);
    return;
  }
  await bot.sendMessage(msg.chat.id, "Running backtest...");
  try {
    const result = await runBacktest({
      ...preset,
      startingCapital: capital,
      baseRiskPercent: risk,
      simulationDays: days,
      strategy: "Custom-" + sn,
    });
    const filepath = exportResults(result, "bt_custom_" + sn + ".json");
    await bot.sendMessage(
      msg.chat.id,
      (result.totalReturn >= 0 ? "OK" : "FAIL") +
        " Return: " +
        (result.totalReturn >= 0 ? "+" : "") +
        result.totalReturnPercent.toFixed(2) +
        "% WR: " +
        result.winRate.toFixed(1) +
        "%",
      backtestMenu,
    );
    await bot.sendDocument(msg.chat.id, filepath);
  } catch (e: any) {
    await bot.sendMessage(msg.chat.id, "Error: " + e.message);
  }
});

bot.on("callback_query", async (q: any) => {
  const chatId = q.message?.chat.id;
  const data = q.data;
  if (!chatId) return;
  if (!checkRateLimit("cb:" + data)) {
    await bot.answerCallbackQuery(q.id, { text: "Rate limited" });
    return;
  }
  await bot.answerCallbackQuery(q.id);

  if (data === "main_menu") {
    const addr = await getWalletAddress();
    const bal = await getBalance();
    await bot.sendMessage(
      chatId,
      "🤖 KABAYAN AGENT v3.0\n\n📦 Wallet: " +
        addr +
        "\n💰 Balance: " +
        bal.toFixed(4) +
        " SOL",
      mainMenu,
    );
    return;
  }
  if (data === "buy_manual") {
    await handleBuyManual(chatId);
    return;
  }
  if (data === "sell_manual") {
    const pos = agent.getPositions();
    if (!pos.length) {
      await bot.sendMessage(chatId, "No positions");
      return;
    }
    const btns = pos.map((p) => [
      {
        text: "Sell " + p.tokenMint.slice(0, 8) + "...",
        callback_data: "sell:" + p.tokenMint,
      },
    ]);
    await bot.sendMessage(chatId, "Pilih token:", {
      reply_markup: {
        inline_keyboard: [
          ...btns,
          [{ text: "⬅️ Back", callback_data: "main_menu" }],
        ],
      },
    });
    return;
  }
  if (data === "toggle_sniper") {
    aiSniperActive = !aiSniperActive;
    if (aiSniperActive) startAISniper(chatId);
    else stopAISniper();
    await bot.sendMessage(
      chatId,
      "AI Sniper: " + (aiSniperActive ? "✅ ON" : "❌ OFF"),
    );
    return;
  }
  if (data === "ai_status") {
    const s = agent.getState();
    const c = agent.getConfig();
    await bot.sendMessage(
      chatId,
      "Agent\n\nCapital: " +
        c.dailyCapital +
        " SOL\nPnL: " +
        s.dailyPnlPercent.toFixed(2) +
        "%\nPositions: " +
        s.positions.length +
        "\nWins: " +
        s.wins +
        " | Losses: " +
        s.losses +
        "\nCircuit: " +
        (s.circuitBreakerActive ? "ON" : "OFF"),
      mainMenu,
    );
    return;
  }
  if (data === "mev_menu") {
    await bot.sendMessage(chatId, "MEV Menu", mevMenu);
    return;
  }
  if (data === "mev_sandwich") {
    setMEVSandwich(!getMEVState().sandwichEnabled);
    await bot.sendMessage(
      chatId,
      "Sandwich: " + (getMEVState().sandwichEnabled ? "✅ ON" : "❌ OFF"),
      mevMenu,
    );
    return;
  }
  if (data === "mev_arbitrage") {
    setMEVArbitrage(!getMEVState().arbitrageEnabled);
    await bot.sendMessage(
      chatId,
      "Arbitrage: " + (getMEVState().arbitrageEnabled ? "✅ ON" : "❌ OFF"),
      mevMenu,
    );
    return;
  }
  if (data === "mev_status") {
    const m = getMEVState();
    await bot.sendMessage(
      chatId,
      "MEV\n\nSandwich: " +
        (m.sandwichEnabled ? "ON" : "OFF") +
        "\nArbitrage: " +
        (m.arbitrageEnabled ? "ON" : "OFF"),
      mevMenu,
    );
    return;
  }
  if (data === "backtest") {
    await bot.sendMessage(
      chatId,
      "Backtest Engine\n\nPilih mode:",
      backtestMenu,
    );
    return;
  }
  if (data === "bt_single") {
    await bot.sendMessage(chatId, "Pilih Strategy:", strategySelect);
    return;
  }
  if (data === "bt_presets") {
    let txt = "Strategies:\n\n";
    for (const [name, cfg] of Object.entries(STRATEGIES)) {
      txt +=
        name.toUpperCase() +
        "\n  Risk: " +
        cfg.baseRiskPercent +
        "% | TP1: " +
        cfg.tp1Percent +
        "% | SL: " +
        cfg.hardSlPercent +
        "%\n\n";
    }
    await bot.sendMessage(chatId, txt, backtestMenu);
    return;
  }
  if (data === "bt_compare") {
    await bot.sendMessage(chatId, "Running comparison...");
    try {
      const comp = await compareStrategies(
        ["conservative", "balanced", "aggressive", "sniper", "diamond_hands"],
        { simulationDays: 3 },
      );
      let msg = "Comparison Results\n\n";
      for (const m of comp.metrics) {
        msg +=
          m.name.toUpperCase() +
          " Return: " +
          (m.returnPercent >= 0 ? "+" : "") +
          m.returnPercent.toFixed(1) +
          "% WR: " +
          m.winRate.toFixed(1) +
          "% PF: " +
          (m.profitFactor === Infinity ? "inf" : m.profitFactor.toFixed(2)) +
          "\n";
      }
      msg += "\nWinner: " + comp.winner.toUpperCase();
      const filepath = exportResults(comp, "comparison_results.json");
      await bot.sendMessage(chatId, msg, backtestMenu);
      await bot.sendDocument(chatId, filepath);
    } catch (e: any) {
      await bot.sendMessage(chatId, "Error: " + e.message);
    }
    return;
  }
  if (data === "bt_custom") {
    await bot.sendMessage(
      chatId,
      "Format: /bt_custom <capital> <risk%> <days> <strategy>",
    );
    return;
  }
  if (data === "portfolio") {
    const pos = agent.getPositions();
    const bal = await getBalance();
    let txt = "Portfolio\n\nSOL: " + bal.toFixed(4) + "\n\n";
    if (!pos.length) txt += "No positions";
    else
      for (const p of pos)
        txt +=
          p.tokenMint.slice(0, 12) + "... " + p.amountSol.toFixed(4) + " SOL\n";
    await bot.sendMessage(chatId, txt, mainMenu);
    return;
  }
  if (data === "deposit") {
    await bot.sendMessage(
      chatId,
      "Kirim SOL ke:\n" + (await getWalletAddress()),
      mainMenu,
    );
    return;
  }
  if (data === "withdraw") {
    await bot.sendMessage(chatId, "Format: /withdraw <addr> <amount>");
    return;
  }
  if (data === "pnl") {
    await bot.sendMessage(
      chatId,
      formatDailyReport(generateDailyReport()),
      mainMenu,
    );
    return;
  }
  if (data === "settings") {
    await bot.sendMessage(
      chatId,
      "Settings\n\nPaper: " +
        (paperMode ? "✅ ON" : "❌ OFF") +
        "\nSniper: " +
        (aiSniperActive ? "✅ ON" : "❌ OFF"),
      settingsMenu,
    );
    return;
  }
  if (data === "toggle_paper") {
    paperMode = !paperMode;
    await bot.sendMessage(
      chatId,
      "Paper: " + (paperMode ? "✅ ON" : "❌ OFF"),
      settingsMenu,
    );
    return;
  }

  // SNIPER SETTINGS
  if (data === "sniper_settings") {
    await bot.sendMessage(chatId, formatSniperStatus(), getSniperMenu());
    return;
  }
  if (data === "sniper_amount") {
    await bot.sendMessage(chatId, "Set Amount (SOL)", {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "0.01", callback_data: "set_amount:0.01" },
            { text: "0.02", callback_data: "set_amount:0.02" },
            { text: "0.05", callback_data: "set_amount:0.05" },
          ],
          [
            { text: "0.10", callback_data: "set_amount:0.10" },
            { text: "0.20", callback_data: "set_amount:0.20" },
            { text: "0.50", callback_data: "set_amount:0.50" },
          ],
          [{ text: "⬅️ Back", callback_data: "sniper_settings" }],
        ],
      },
    });
    return;
  }
  if (data === "sniper_fee") {
    await bot.sendMessage(chatId, "Set Fee Mode", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "SAFE", callback_data: "set_fee:SAFE" }],
          [{ text: "NORMAL", callback_data: "set_fee:NORMAL" }],
          [{ text: "AGGRESSIVE", callback_data: "set_fee:AGGRESSIVE" }],
          [{ text: "⬅️ Back", callback_data: "sniper_settings" }],
        ],
      },
    });
    return;
  }
  if (data === "sniper_age") {
    await bot.sendMessage(chatId, "Max Token Age", {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "60s", callback_data: "set_age:60" },
            { text: "120s", callback_data: "set_age:120" },
            { text: "300s", callback_data: "set_age:300" },
          ],
          [
            { text: "600s", callback_data: "set_age:600" },
            { text: "1800s", callback_data: "set_age:1800" },
            { text: "3600s", callback_data: "set_age:3600" },
          ],
          [{ text: "⬅️ Back", callback_data: "sniper_settings" }],
        ],
      },
    });
    return;
  }
  if (data === "sniper_liquidity") {
    await bot.sendMessage(chatId, "Min Liquidity (USD)", {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "$1K", callback_data: "set_liq:1000" },
            { text: "$5K", callback_data: "set_liq:5000" },
            { text: "$10K", callback_data: "set_liq:10000" },
          ],
          [
            { text: "$25K", callback_data: "set_liq:25000" },
            { text: "$50K", callback_data: "set_liq:50000" },
            { text: "$100K", callback_data: "set_liq:100000" },
          ],
          [{ text: "⬅️ Back", callback_data: "sniper_settings" }],
        ],
      },
    });
    return;
  }
  if (data === "sniper_holder") {
    await bot.sendMessage(chatId, "Max Top Holder %", {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "10%", callback_data: "set_holder:10" },
            { text: "15%", callback_data: "set_holder:15" },
            { text: "20%", callback_data: "set_holder:20" },
          ],
          [
            { text: "25%", callback_data: "set_holder:25" },
            { text: "35%", callback_data: "set_holder:35" },
            { text: "50%", callback_data: "set_holder:50" },
          ],
          [{ text: "⬅️ Back", callback_data: "sniper_settings" }],
        ],
      },
    });
    return;
  }
  if (data === "sniper_honeypot") {
    updateSniperConfig({ honeypotCheck: !getSniperConfig().honeypotCheck });
    await bot.sendMessage(
      chatId,
      "✅ Honeypot: " +
        (getSniperConfig().honeypotCheck ? "ON" : "OFF") +
        "\n\n" +
        formatSniperStatus(),
      getSniperMenu(),
    );
    return;
  }
  if (data === "sniper_security") {
    updateSniperConfig({ securityGate: !getSniperConfig().securityGate });
    await bot.sendMessage(
      chatId,
      "✅ Security: " +
        (getSniperConfig().securityGate ? "ON" : "OFF") +
        "\n\n" +
        formatSniperStatus(),
      getSniperMenu(),
    );
    return;
  }
  if (data === "sniper_reset") {
    resetSniperConfig();
    await bot.sendMessage(
      chatId,
      "Reset!\n\n" + formatSniperStatus(),
      getSniperMenu(),
    );
    return;
  }

  // SET HANDLERS
  if (data?.startsWith("set_amount:")) {
    updateSniperConfig({ amountSol: parseFloat(data.split(":")[1]) });
    await bot.sendMessage(
      chatId,
      "Set!\n\n" + formatSniperStatus(),
      getSniperMenu(),
    );
    return;
  }
  if (data?.startsWith("set_fee:")) {
    updateSniperConfig({ feeMode: data.split(":")[1] });
    await bot.sendMessage(
      chatId,
      "Set!\n\n" + formatSniperStatus(),
      getSniperMenu(),
    );
    return;
  }
  if (data?.startsWith("set_age:")) {
    updateSniperConfig({ maxAgeSeconds: parseInt(data.split(":")[1]) });
    await bot.sendMessage(
      chatId,
      "Set!\n\n" + formatSniperStatus(),
      getSniperMenu(),
    );
    return;
  }
  if (data?.startsWith("set_liq:")) {
    updateSniperConfig({ minLiquidity: parseInt(data.split(":")[1]) });
    await bot.sendMessage(
      chatId,
      "Set!\n\n" + formatSniperStatus(),
      getSniperMenu(),
    );
    return;
  }
  if (data?.startsWith("set_holder:")) {
    updateSniperConfig({ maxTopHolder: parseInt(data.split(":")[1]) });
    await bot.sendMessage(
      chatId,
      "Set!\n\n" + formatSniperStatus(),
      getSniperMenu(),
    );
    return;
  }

  // MANUAL BUY
  if (data?.startsWith("manual_buy:")) {
    const parts = data.split(":");
    const ca = parts[1];
    const amount = parseFloat(parts[2]);
    const fee = getFeeSchedule("AGGRESSIVE");
    await bot.sendMessage(
      chatId,
      "🟢 Membeli " + ca.slice(0, 12) + "... | " + amount + " SOL",
    );
    if (paperMode) {
      const pr = await priceFeed.getPrice(ca);
      if (pr) {
        paperBuy(ca, pr.price, amount);
        await bot.sendMessage(
          chatId,
          "\u2705 Paper Buy: " +
            amount.toFixed(4) +
            " SOL\nPrice: $" +
            pr.price.toFixed(10),
        );
      } else {
        await bot.sendMessage(chatId, "\u274c Price not found");
      }
    } else {
      const r = await executeSwap(
        connection,
        "SOL",
        ca,
        amount,
        fee.slippageBuy,
      );
      if (r.success) {
        await priceFeed.warmCache([ca]);
        const pr = await priceFeed.getPrice(ca);
        if (pr)
          agent.addPosition(
            createPosition(
              ca,
              pr.price,
              amount / pr.price,
              amount,
              "AGGRESSIVE" as any,
              false,
            ),
          );
        await bot.sendMessage(
          chatId,
          "\u2705 Buy: " + amount.toFixed(4) + " SOL\nTX: " + r.txHash,
        );
      } else {
        await bot.sendMessage(chatId, "\u274c Buy failed: " + r.error);
      }
    }
    return;
  }

  // SELL CHOOSE - pick percentage
  if (data?.startsWith("sell_choose:")) {
    const mint = data.split(":")[1];
    const pos = agent.getPositions().find((p) => p.tokenMint === mint);
    const amountInfo = pos ? " (" + pos.amountSol.toFixed(3) + " SOL)" : "";
    await bot.sendMessage(
      chatId,
      "📤 Sell " + mint.slice(0, 12) + "..." + amountInfo + "\n\nPilih jumlah:",
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "25%", callback_data: "sell_pct:" + mint + ":25" },
              { text: "50%", callback_data: "sell_pct:" + mint + ":50" },
              { text: "75%", callback_data: "sell_pct:" + mint + ":75" },
            ],
            [{ text: "100% 💰", callback_data: "sell_pct:" + mint + ":100" }],
            [{ text: "\u2b05\ufe0f Back", callback_data: "sell_manual" }],
          ],
        },
      },
    );
    return;
  }

  // SELL PERCENTAGE - execute sell
  if (data?.startsWith("sell_pct:")) {
    const parts = data.split(":");
    const mint = parts[1];
    const pct = parseInt(parts[2]);
    const fee = getFeeSchedule("AGGRESSIVE");
    await bot.sendMessage(
      chatId,
      "🟢 Selling " + pct + "% of " + mint.slice(0, 12) + "...",
    );
    if (paperMode) {
      const pr = await priceFeed.getPrice(mint);
      if (pr) {
        const pnl = paperSell(mint, pr.price, pct / 100);
        agent.closePosition(mint, pnl, "MANUAL_SELL_" + pct + "PCT");
        priceFeed.removeToken(mint);
        await bot.sendMessage(
          chatId,
          "\u2705 Sold " +
            pct +
            "% | PnL: " +
            (pnl > 0 ? "+" : "") +
            pnl.toFixed(4) +
            " SOL",
        );
      } else {
        await bot.sendMessage(chatId, "\u274c Price not found");
      }
    } else {
      const r = await executeSwap(
        connection,
        mint,
        "SOL",
        pct,
        fee.slippageSell,
        { maxRetries: 3, skipPreflight: true },
      );
      if (r.success) {
        agent.closePosition(mint, 0, "MANUAL_SELL_" + pct + "PCT");
        priceFeed.removeToken(mint);
        await bot.sendMessage(
          chatId,
          "\u2705 Sold " + pct + "%\nTX: " + r.txHash,
        );
      } else {
        await bot.sendMessage(chatId, "\u274c Sell failed: " + r.error);
      }
    }
    return;
  }

  // SELL ALL (old handler - direct sell)
  if (data?.startsWith("sell:")) {
    const mint = data.split(":")[1];
    const fee = getFeeSchedule("AGGRESSIVE");
    if (paperMode) {
      const pr = await priceFeed.getPrice(mint);
      if (pr) {
        const pnl = paperSell(mint, pr.price);
        agent.closePosition(mint, pnl, "MANUAL_SELL");
        priceFeed.removeToken(mint);
        await bot.sendMessage(
          chatId,
          "Sold | PnL: " + (pnl > 0 ? "+" : "") + pnl.toFixed(4) + " SOL",
        );
      }
    } else {
      const r = await executeSwap(
        connection,
        mint,
        "SOL",
        100,
        fee.slippageSell,
        { maxRetries: 3, skipPreflight: true },
      );
      if (r.success) {
        agent.closePosition(mint, 0, "MANUAL_SELL");
        priceFeed.removeToken(mint);
        await bot.sendMessage(chatId, "Sold\nTX: " + r.txHash);
      } else {
        await bot.sendMessage(chatId, "Sell failed: " + r.error);
      }
    }
    return;
  }

  // BACKTEST RUN
  if (data?.startsWith("bt_run:")) {
    const sn = data.split(":")[1];
    const preset = STRATEGIES[sn];
    if (!preset) {
      await bot.sendMessage(chatId, "Unknown: " + sn);
      return;
    }
    await bot.sendMessage(chatId, "Running " + sn.toUpperCase() + "...");
    try {
      const result = await runBacktest({ ...preset, simulationDays: 3 });
      const filepath = exportResults(result, "backtest_" + sn + ".json");
      await bot.sendMessage(
        chatId,
        (result.totalReturn >= 0 ? "OK" : "FAIL") +
          " " +
          sn.toUpperCase() +
          "\n\nReturn: " +
          (result.totalReturn >= 0 ? "+" : "") +
          result.totalReturnPercent.toFixed(2) +
          "%\nWR: " +
          result.winRate.toFixed(1) +
          "%\nPF: " +
          (result.profitFactor === Infinity
            ? "inf"
            : result.profitFactor.toFixed(2)),
        backtestMenu,
      );
      await bot.sendDocument(chatId, filepath);
    } catch (e: any) {
      await bot.sendMessage(chatId, "Error: " + e.message);
    }
    return;
  }
});

async function handleBuyManual(chatId: number) {
  await bot.sendMessage(
    chatId,
    "📥 Buy Manual\n\nKirim Contract Address (CA):",
  );
  const listener = async (msg: any) => {
    if (msg.chat.id !== chatId) return;
    const ca = msg.text?.trim();
    if (!ca || ca.length < 32 || ca.startsWith("/")) {
      bot.removeListener("message", listener);
      return;
    }
    bot.removeListener("message", listener);
    const loadingMsg = await bot.sendMessage(
      chatId,
      "\u23F3 Analyzing " + ca.slice(0, 12) + "...",
    );

    // Fetch token info
    let tokenName = "Unknown";
    let tokenSymbol = "???";
    let tokenPrice = 0;
    try {
      const res = await fetch(
        "https://api.dexscreener.com/latest/dex/tokens/" + ca,
      );
      const data = (await res.json()) as any;
      if (data.pairs && data.pairs.length > 0) {
        tokenName = data.pairs[0].baseToken?.name || "Unknown";
        tokenSymbol = data.pairs[0].baseToken?.symbol || "???";
        tokenPrice = parseFloat(data.pairs[0].priceUsd) || 0;
      }
    } catch (e: any) {
      // Try backup
      try {
        const pr = await priceFeed.getPrice(ca);
        if (pr) tokenPrice = pr.price;
      } catch (_) {}
    }

    // Run security check
    const output = await agent.evaluateBuy(ca, null, 999, 0, 0, false);
    const passed = output.aksi === "BELI";
    const reason = output.alasan || "UNKNOWN";

    // Fetch detailed security info
    let liquidity = 0;
    let topHolderPct = 0;
    let pairAge = "";
    let volume24h = 0;
    let mcap = 0;
    let isHoneypot = false;
    let hasSocials = false;
    try {
      const res2 = await fetch(
        "https://api.dexscreener.com/latest/dex/tokens/" + ca,
      );
      const data2 = (await res2.json()) as any;
      if (data2.pairs && data2.pairs.length > 0) {
        const pair = data2.pairs[0];
        liquidity = parseFloat(pair.liquidity?.usd) || 0;
        volume24h = parseFloat(pair.volume?.h24) || 0;
        mcap = parseFloat(pair.fdv) || parseFloat(pair.marketCap) || 0;
        if (pair.pairCreatedAt) {
          const age = Date.now() - pair.pairCreatedAt;
          const mins = Math.floor(age / 60000);
          const hrs = Math.floor(mins / 60);
          pairAge = hrs > 0 ? hrs + "h " + (mins % 60) + "m" : mins + "m";
        }
        hasSocials = !!(
          pair.info?.socials?.length || pair.info?.websites?.length
        );
      }
    } catch (_) {}

    // Get top holder info from agent security check
    try {
      const securityResult = await agent.evaluateBuy(
        ca,
        null,
        999,
        0,
        0,
        false,
      );
      isHoneypot = securityResult.alasan?.includes("HONEYPOT") || false;
    } catch (_) {}

    // Security score color
    const scoreEmoji = passed ? "\u2705" : "\u274c";
    const scoreText = passed ? "PASSED" : "FAILED";

    let infoText = "📥 BUY TOKEN\n";
    infoText += "\n🏷️ Name: " + tokenName + " (" + tokenSymbol + ")\n";
    infoText += "📍 CA: " + ca.slice(0, 16) + "..." + ca.slice(-6) + "\n";
    if (tokenPrice > 0)
      infoText += "💰 Price: $" + tokenPrice.toFixed(10) + "\n";
    infoText += "\n━━━ Security Report ━━━\n";
    infoText += scoreEmoji + " Score: " + scoreText + "\n";
    if (liquidity > 0)
      infoText +=
        "💧 Liquidity: $" +
        (liquidity >= 1000
          ? (liquidity / 1000).toFixed(1) + "K"
          : liquidity.toFixed(0)) +
        "\n";
    if (volume24h > 0)
      infoText +=
        "📊 Volume 24h: $" +
        (volume24h >= 1000
          ? (volume24h / 1000).toFixed(1) + "K"
          : volume24h.toFixed(0)) +
        "\n";
    if (mcap > 0)
      infoText +=
        "📈 MCap: $" +
        (mcap >= 1000000
          ? (mcap / 1000000).toFixed(1) + "M"
          : mcap >= 1000
            ? (mcap / 1000).toFixed(1) + "K"
            : mcap.toFixed(0)) +
        "\n";
    if (pairAge) infoText += "⏱️ Age: " + pairAge + "\n";
    infoText +=
      "🔍 Honeypot: " + (isHoneypot ? "\u274c YES" : "\u2705 NO") + "\n";
    infoText +=
      "🌐 Socials: " + (hasSocials ? "\u2705 Yes" : "\u274c None") + "\n";
    infoText += "\n📋 Reason: " + reason + "\n";
    infoText += "\n📥 Pilih jumlah:";

    await bot.sendMessage(chatId, infoText, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "0.01 SOL", callback_data: "manual_buy:" + ca + ":0.01" },
            { text: "0.02 SOL", callback_data: "manual_buy:" + ca + ":0.02" },
            { text: "0.05 SOL", callback_data: "manual_buy:" + ca + ":0.05" },
          ],
          [
            { text: "0.10 SOL", callback_data: "manual_buy:" + ca + ":0.10" },
            { text: "0.20 SOL", callback_data: "manual_buy:" + ca + ":0.20" },
            { text: "0.50 SOL", callback_data: "manual_buy:" + ca + ":0.50" },
          ],
          [{ text: "\u274c Cancel", callback_data: "main_menu" }],
        ],
      },
    });
  };
  bot.once("message", listener);
}

function startAISniper(chatId: number) {
  updateSniperConfig({ enabled: true });
  pumpFunWs = startPumpFunScanner(async (token: any) => {
    if (!aiSniperActive) return;
    const cfg = getSniperConfig();
    logger.info("[SNIPER] " + token.symbol + " (" + token.mint + ")");
    if (cfg.honeypotCheck) {
      const isClean = await quickHoneypotCheck(token.mint);
      if (!isClean) {
        logger.info("[SNIPER] Rejected honeypot: " + token.symbol);
        return;
      }
    }
    const output = await agent.evaluateBuy(
      token.mint,
      token.creator,
      0,
      0,
      0,
      false,
    );
    if (output.aksi === "BELI") {
      const fee = getFeeSchedule(cfg.feeMode);
      const amount = cfg.amountSol;
      let sniperName = token.symbol || token.name || "Unknown";
      let sniperLiq = 0;
      let sniperAge = "";
      try {
        const res = await fetch(
          "https://api.dexscreener.com/latest/dex/tokens/" + token.mint,
        );
        const data = (await res.json()) as any;
        if (data.pairs && data.pairs.length > 0) {
          sniperName = data.pairs[0].baseToken?.symbol || sniperName;
          const pair = data.pairs[0];
          sniperLiq = parseFloat(pair.liquidity?.usd) || 0;
          if (pair.pairCreatedAt) {
            const age = Date.now() - pair.pairCreatedAt;
            const mins = Math.floor(age / 60000);
            sniperAge =
              mins < 60
                ? mins + "m"
                : Math.floor(mins / 60) + "h " + (mins % 60) + "m";
          }
        }
      } catch (_) {
        sniperName = token.mint.slice(0, 8);
      }
      let sniperMsg = "🎯 SNIPER: " + sniperName + "\n\n";
      sniperMsg +=
        "📍 CA: " +
        token.mint.slice(0, 16) +
        "..." +
        token.mint.slice(-6) +
        "\n";
      sniperMsg += "\u2705 Security: PASSED\n";
      if (sniperLiq > 0)
        sniperMsg +=
          "💧 Liq: $" +
          (sniperLiq >= 1000
            ? (sniperLiq / 1000).toFixed(1) + "K"
            : sniperLiq.toFixed(0)) +
          "\n";
      if (sniperAge) sniperMsg += "⏱️ Age: " + sniperAge + "\n";
      sniperMsg += "📥 Buy: " + amount.toFixed(4) + " SOL\n";
      sniperMsg += "💰 Fee: " + cfg.feeMode + "\n";
      sniperMsg += "📋 Reason: " + output.alasan;
      await bot.sendMessage(chatId, sniperMsg);
      if (paperMode) {
        const pr = await priceFeed.getPrice(token.mint);
        if (pr) paperBuy(token.mint, pr.price, amount);
      } else {
        const r = await executeSwap(
          connection,
          "SOL",
          token.mint,
          amount,
          fee.slippageBuy,
          { maxRetries: 3, skipPreflight: true },
        );
        if (r.success) {
          await priceFeed.warmCache([token.mint]);
          const pr = await priceFeed.getPrice(token.mint);
          if (pr)
            agent.addPosition(
              createPosition(
                token.mint,
                pr.price,
                amount / pr.price,
                amount,
                cfg.feeMode as any,
                false,
              ),
            );
          await bot.sendMessage(
            chatId,
            "\u2705 Sniper Buy: " + sniperName + "\nTX: " + r.txHash,
          );
        } else {
          await bot.sendMessage(chatId, "Sniper failed: " + r.error);
        }
      }
    } else {
      logger.info("[SNIPER] Rejected: " + token.symbol + " " + output.alasan);
    }
  });
}

function stopAISniper() {
  updateSniperConfig({ enabled: false });
  if (pumpFunWs) {
    pumpFunWs.close();
    pumpFunWs = null;
  }
}

function startAlphaTracking() {
  alphaMonitorInterval = startAlphaMonitor(connection, async (event: any) => {
    const output = await agent.handleAlphaSignal(event);
    if (output.aksi === "BELI") {
      const fee = getFeeSchedule(output.fee_mode);
      if (ENV.CHAT_ID) {
        await bot.sendMessage(
          ENV.CHAT_ID,
          "Alpha Signal!\n\nWallet: " +
            event.wallet.slice(0, 8) +
            "...\nToken: " +
            event.tokenMint.slice(0, 8) +
            "...\nAmount: " +
            event.amountSol.toFixed(2) +
            " SOL",
        );
      }
      if (!paperMode) {
        const r = await executeSwap(
          connection,
          "SOL",
          event.tokenMint,
          output.position_size_sol,
          fee.slippageBuy,
        );
        if (r.success) {
          await priceFeed.warmCache([event.tokenMint]);
          const pr = await priceFeed.getPrice(event.tokenMint);
          if (pr)
            agent.addPosition(
              createPosition(
                event.tokenMint,
                pr.price,
                output.position_size_sol / pr.price,
                output.position_size_sol,
                output.fee_mode,
                true,
              ),
            );
        }
      }
    }
  });
}

async function monitorLoop() {
  if (monitorRunning) {
    setTimeout(monitorLoop, agent.getConfig().monitoringIntervalMs);
    return;
  }
  monitorRunning = true;
  try {
    const state = agent.getState();
    if (state.positions.length === 0) {
      monitorRunning = false;
      setTimeout(monitorLoop, agent.getConfig().monitoringIntervalMs);
      return;
    }
    await priceFeed.warmCache(state.positions.map((p) => p.tokenMint));
    for (let i = 0; i < state.positions.length; i += 3) {
      await Promise.allSettled(
        state.positions.slice(i, i + 3).map((pos) => processPosition(pos)),
      );
    }
  } catch (e: any) {
    logger.error("[MONITOR] Error: " + e.message);
  } finally {
    monitorRunning = false;
  }
  setTimeout(monitorLoop, agent.getConfig().monitoringIntervalMs);
}

async function processPosition(pos: Position) {
  if (sellingPositions.has(pos.tokenMint)) return;
  try {
    const pr = await priceFeed.getPrice(pos.tokenMint);
    if (!pr) return;
    const output = await agent.evaluateSell(pos, pr.price, "");
    if (output.aksi === "TAHAN") return;
    sellingPositions.add(pos.tokenMint);
    try {
      await executeSell(pos, output);
    } finally {
      sellingPositions.delete(pos.tokenMint);
    }
  } catch (e: any) {
    logger.error(
      "[MONITOR] Error: " + pos.tokenMint.slice(0, 8) + "... " + e.message,
    );
  }
}

async function executeSell(pos: Position, output: AIOutput) {
  const fee = getFeeSchedule(output.fee_mode);
  if (paperMode) {
    const pr = await priceFeed.getPrice(pos.tokenMint);
    if (pr) {
      const pnl = paperSell(pos.tokenMint, pr.price, output.persentase);
      agent.closePosition(pos.tokenMint, pnl, output.alasan);
      priceFeed.removeToken(pos.tokenMint);
      if (ENV.CHAT_ID) {
        await bot.sendMessage(
          ENV.CHAT_ID,
          "Paper Sell | PnL: " + (pnl > 0 ? "+" : "") + pnl.toFixed(4) + " SOL",
        );
      }
    }
    return;
  }
  const r = await executeSwap(
    connection,
    pos.tokenMint,
    "SOL",
    output.persentase * 100,
    fee.slippageSell,
    { maxRetries: 3, skipPreflight: true },
  );
  if (r.success) {
    agent.closePosition(pos.tokenMint, 0, output.alasan);
    priceFeed.removeToken(pos.tokenMint);
    if (ENV.CHAT_ID) {
      await bot.sendMessage(
        ENV.CHAT_ID,
        output.alasan +
          "\n\nToken: " +
          pos.tokenMint.slice(0, 8) +
          "...\nSold: " +
          (output.persentase * 100).toFixed(0) +
          "%\nTX: " +
          r.txHash,
      );
    }
  } else {
    logger.error(
      "[SELL] Failed: " + pos.tokenMint.slice(0, 8) + "... " + r.error,
    );
    if (ENV.CHAT_ID) {
      await bot.sendMessage(ENV.CHAT_ID, "Sell Failed: " + r.error);
    }
  }
}

function scheduleDailyReport() {
  const now = new Date();
  const target = new Date(now);
  target.setHours(23, 59, 0, 0);
  if (now > target) target.setDate(target.getDate() + 1);
  setTimeout(async () => {
    if (ENV.DAILY_REPORT_CHAT_ID) {
      await bot.sendMessage(
        ENV.DAILY_REPORT_CHAT_ID,
        formatDailyReport(generateDailyReport()),
      );
    }
    scheduleDailyReport();
  }, target.getTime() - now.getTime());
}

async function shutdown(signal: string) {
  logger.info("[SHUTDOWN] " + signal);
  if (bot) {
    try {
      bot.stopPolling();
    } catch (e: any) {
      logger.error("[SHUTDOWN] Error stopping bot: " + e.message);
    }
  }
  if (pumpFunWs) {
    pumpFunWs.close();
    pumpFunWs = null;
  }
  if (alphaMonitorInterval) {
    clearInterval(alphaMonitorInterval);
    alphaMonitorInterval = null;
  }
  priceFeed.stop();
  try {
    saveDailyState(agent.getState());
  } catch (e: any) {
    logger.error("[SHUTDOWN] State error: " + e.message);
  }
  try {
    const { getDb } = await import("./database/db");
    getDb().close();
  } catch (e: any) {
    logger.error("[SHUTDOWN] DB error: " + e.message);
  }
  releaseLock();
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("uncaughtException", (err: Error) => {
  logger.error("[FATAL] Uncaught: " + err.message);
  shutdown("uncaughtException");
});
process.on("unhandledRejection", (reason: any) => {
  logger.error("[FATAL] Rejection: " + (reason?.message || reason));
});

async function startup() {
  // Acquire instance lock to prevent duplicate instances
  const lockAcquired = await acquireLock();
  if (!lockAcquired) {
    logger.error(
      "[STARTUP] Failed to acquire lock - another instance is running",
    );
    process.exit(1);
  }

  logger.info("========================================");
  logger.info("  KABAYAN AGENT v3.0 Starting...");
  logger.info("========================================");
  await runPrelaunchCheck();

  // Initialize Telegram bot with polling
  try {
    bot = new TelegramBot(ENV.TELEGRAM_BOT_TOKEN, { polling: true });
    logger.info("[TELEGRAM] Bot initialized successfully");
  } catch (error: any) {
    logger.error("[TELEGRAM] Failed to initialize bot: " + error.message);
    process.exit(1);
  }

  migrateOldData();
  loadMemory();
  const savedPositions = loadPositions();
  if (savedPositions.length > 0) {
    logger.info("[STARTUP] Recovered " + savedPositions.length + " positions");
    for (const p of savedPositions) agent.addPosition(p);
  }
  priceFeed.start();
  if (savedPositions.length > 0)
    await priceFeed.warmCache(savedPositions.map((p) => p.tokenMint));
  const addr = await getWalletAddress();
  const bal = await getBalance();
  logger.info("Wallet: " + addr);
  logger.info("Balance: " + bal.toFixed(4) + " SOL");

  // Warning if balance is too low
  if (bal < 0.1) {
    logger.warn(
      "[CAPITAL] Balance sangat rendah! Deposit minimal 0.5 SOL untuk trading",
    );
  }

  const alphaWallets = getAlphaWallets();
  if (alphaWallets.length > 0) {
    startAlphaTracking();
    logger.info("[STARTUP] Alpha: " + alphaWallets.length + " wallets");
  }
  monitorLoop();
  scheduleDailyReport();
  if (ENV.MEV_ENABLED && ENV.JITO_API_KEY) {
    startMempoolScanner(
      "wss://mainnet.helius-rpc.com/?api-key=" + ENV.HELIUS_API_KEY,
    );
    logger.info("[STARTUP] MEV started");
  }
  logger.info("========================================");
  logger.info("  KABAYAN AGENT v3.0 Ready!");
  logger.info("========================================");
  if (ENV.CHAT_ID) {
    await bot.sendMessage(
      ENV.CHAT_ID,
      "KABAYAN AGENT v3.0 Started!\n\nWallet: " +
        addr +
        "\nBalance: " +
        bal.toFixed(4) +
        " SOL\nPositions: " +
        savedPositions.length,
    );
  }
}

startup().catch((err: Error) => {
  logger.error("Startup failed: " + err.message);
  process.exit(1);
});
