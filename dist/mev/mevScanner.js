"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.configureMEV = configureMEV;
exports.startMempoolScanner = startMempoolScanner;
exports.getMEVState = getMEVState;
exports.setMEVSandwich = setMEVSandwich;
exports.setMEVArbitrage = setMEVArbitrage;
const ws_1 = __importDefault(require("ws"));
const logger_1 = require("../utils/logger");
const arbitrage_1 = require("./arbitrage");
const sandwich_1 = require("./sandwich");
const wallet_1 = require("../config/wallet");
let state = {
    sandwichEnabled: false,
    arbitrageEnabled: false,
    totalSandwiches: 0,
    totalArbitrages: 0,
    totalProfit: 0,
    lastActivity: 0,
};
let mevConfig = {
    minTargetSizeSol: 0.5,
    maxSlippage: 10,
    tipLamports: 10000,
    jitoApiKey: "",
    minSpreadPercent: 2,
    tradeAmountSol: 0.1,
};
let connection = null;
let activeWs = null;
let reconnectTimer = null;
function configureMEV(conn, config) {
    connection = conn;
    mevConfig = { ...mevConfig, ...config };
}
// Throttle untuk cegah spam eksekusi pada target yang sama
const recentTargets = new Map();
const TARGET_COOLDOWN_MS = 30_000;
function parseSwapFromTx(tx) {
    try {
        const instructions = tx?.transaction?.message?.instructions || [];
        const pre = tx?.meta?.preBalances || [];
        const post = tx?.meta?.postBalances || [];
        const sig = tx?.transaction?.signatures?.[0] || "";
        // Cari program Jupiter atau Raydium
        const JUP = "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4";
        const RAY = "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8";
        let isSwap = false;
        let poolAddress = "";
        for (const ix of instructions) {
            if (ix?.programId === JUP || ix?.programId === RAY) {
                isSwap = true;
                poolAddress = ix.accounts?.[0] || "";
                break;
            }
        }
        if (!isSwap)
            return null;
        // Hitung SOL amount dari balance changes
        let maxChange = 0;
        for (let i = 0; i < pre.length; i++) {
            const change = Math.abs((pre[i] - post[i]) / 1e9);
            if (change > maxChange)
                maxChange = change;
        }
        if (maxChange < mevConfig.minTargetSizeSol)
            return null;
        // Ambil mint dari token balances
        const postTB = tx?.meta?.postTokenBalances || [];
        const mint = postTB[0]?.mint || "";
        if (!mint)
            return null;
        return { mint, amountSol: maxChange, poolAddress, signature: sig };
    }
    catch {
        return null;
    }
}
function startMempoolScanner(url) {
    // Clear any pending reconnect timer
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }
    // Close and clean up existing WebSocket
    if (activeWs) {
        activeWs.removeAllListeners();
        activeWs.close();
        activeWs = null;
    }
    const ws = new ws_1.default(url);
    activeWs = ws;
    ws.on("open", () => {
        logger_1.logger.info("[MEV] Scanner connected");
        ws.send(JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "transactionSubscribe",
            params: [
                { vote: false, failed: false },
                { commitment: "processed", encoding: "jsonParsed" },
            ],
        }));
    });
    ws.on("message", async (data) => {
        try {
            const p = JSON.parse(data);
            const tx = p?.params?.result?.transaction;
            if (!tx || !connection)
                return;
            const swap = parseSwapFromTx(tx);
            if (!swap)
                return;
            logger_1.logger.info(`[MEV] Large swap detected: ${swap.amountSol.toFixed(2)} SOL | ${swap.mint.slice(0, 8)}...`);
            state.lastActivity = Date.now();
            // Throttle: skip jika baru saja proses target ini
            const lastSeen = recentTargets.get(swap.mint);
            if (lastSeen && Date.now() - lastSeen < TARGET_COOLDOWN_MS)
                return;
            recentTargets.set(swap.mint, Date.now());
            // Sandwich Attack
            if (state.sandwichEnabled && mevConfig.jitoApiKey) {
                const sandwichSuccess = await (0, sandwich_1.executeSandwich)(connection, {
                    signature: swap.signature,
                    mint: swap.mint,
                    amountSol: swap.amountSol,
                    poolAddress: swap.poolAddress,
                }, wallet_1.wallet.publicKey, {
                    minTargetSizeSol: mevConfig.minTargetSizeSol,
                    maxSlippage: mevConfig.maxSlippage,
                    tipLamports: mevConfig.tipLamports,
                    jitoApiKey: mevConfig.jitoApiKey,
                });
                if (sandwichSuccess) {
                    state.totalSandwiches++;
                    logger_1.logger.info("[MEV] Sandwich #" + state.totalSandwiches + " completed");
                }
                return; // Tidak run arb setelah sandwich attempt
            }
            // Arbitrage Scan
            if (state.arbitrageEnabled) {
                const opp = await (0, arbitrage_1.scanArbitrage)(swap.mint);
                if (opp) {
                    const arbSuccess = await (0, arbitrage_1.executeArbitrage)(connection, opp, wallet_1.wallet.publicKey, {
                        minSpreadPercent: mevConfig.minSpreadPercent,
                        tradeAmountSol: mevConfig.tradeAmountSol,
                        tipLamports: mevConfig.tipLamports,
                        jitoApiKey: mevConfig.jitoApiKey,
                    });
                    if (arbSuccess) {
                        state.totalArbitrages++;
                        logger_1.logger.info("[MEV] Arbitrage #" + state.totalArbitrages + " completed");
                    }
                }
            }
        }
        catch (e) {
            logger_1.logger.warn("[MEV] Message parse error: " + e.message);
        }
    });
    ws.on("error", (err) => {
        logger_1.logger.error("[MEV] Error: " + err.message);
    });
    ws.on("close", () => {
        logger_1.logger.warn("[MEV] Reconnecting in 5s");
        // Clear the old ws reference before creating a new one
        activeWs = null;
        ws.removeAllListeners();
        reconnectTimer = setTimeout(() => {
            startMempoolScanner(url);
        }, 5000);
    });
    return ws;
}
function getMEVState() {
    return { ...state };
}
function setMEVSandwich(on) {
    state.sandwichEnabled = on;
    logger_1.logger.info("[MEV] Sandwich: " + (on ? "ON" : "OFF"));
}
function setMEVArbitrage(on) {
    state.arbitrageEnabled = on;
    logger_1.logger.info("[MEV] Arbitrage: " + (on ? "ON" : "OFF"));
}
//# sourceMappingURL=mevScanner.js.map