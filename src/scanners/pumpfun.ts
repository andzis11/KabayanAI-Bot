import WebSocket from "ws";
import { logger } from "../utils/logger";

export interface PumpFunToken {
  mint: string;
  name: string;
  symbol: string;
  creator: string;
  timestamp: number;
}

type OnNewToken = (token: PumpFunToken) => void;

let activeWs: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

export function startPumpFunScanner(cb: OnNewToken): WebSocket {
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

  const ws = new WebSocket("wss://pumpportal.fun/api/data");
  activeWs = ws;

  ws.on("open", () => {
    logger.info("[PUMPFUN] Connected");
    ws.send(JSON.stringify({ method: "subscribeNewToken" }));
  });

  ws.on("message", (data: string) => {
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
    } catch {
      /* skip */
    }
  });

  ws.on("error", (err) => logger.error(`[PUMPFUN] Error: ${err.message}`));
  ws.on("close", () => {
    logger.warn("[PUMPFUN] Reconnecting in 5s");
    // Clear the old ws reference before creating a new one
    activeWs = null;
    ws.removeAllListeners();
    reconnectTimer = setTimeout(() => {
      startPumpFunScanner(cb);
    }, 5000);
  });

  return ws;
}
