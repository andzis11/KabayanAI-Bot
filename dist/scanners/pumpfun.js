"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startPumpFunScanner = startPumpFunScanner;
const ws_1 = __importDefault(require("ws"));
const logger_1 = require("../utils/logger");
let activeWs = null;
let reconnectTimer = null;
function startPumpFunScanner(cb) {
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
    const ws = new ws_1.default("wss://pumpportal.fun/api/data");
    activeWs = ws;
    ws.on("open", () => {
        logger_1.logger.info("[PUMPFUN] Connected");
        ws.send(JSON.stringify({ method: "subscribeNewToken" }));
    });
    ws.on("message", (data) => {
        try {
            const p = JSON.parse(data);
            if (p.mint) {
                cb({
                    mint: p.mint,
                    name: p.name || "Unknown",
                    symbol: p.symbol || "???",
                    creator: p.traderPublicKey || "",
                    timestamp: Date.now(),
                });
            }
        }
        catch {
            /* skip */
        }
    });
    ws.on("error", (err) => logger_1.logger.error(`[PUMPFUN] Error: ${err.message}`));
    ws.on("close", () => {
        logger_1.logger.warn("[PUMPFUN] Reconnecting in 5s");
        // Clear the old ws reference before creating a new one
        activeWs = null;
        ws.removeAllListeners();
        reconnectTimer = setTimeout(() => {
            startPumpFunScanner(cb);
        }, 5000);
    });
    return ws;
}
//# sourceMappingURL=pumpfun.js.map