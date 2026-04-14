import WebSocket from "ws";
export interface PumpFunToken {
    mint: string;
    name: string;
    symbol: string;
    creator: string;
    timestamp: number;
}
type OnNewToken = (token: PumpFunToken) => void;
export declare function startPumpFunScanner(cb: OnNewToken): WebSocket;
export {};
