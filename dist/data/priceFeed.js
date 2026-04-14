"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HybridPriceFeed = exports.WebSocketPriceFeed = void 0;
const ws_1 = __importDefault(require("ws"));
const logger_1 = require("../utils/logger");
const apiRateLimit_1 = require("../security/apiRateLimit");
class WebSocketPriceFeed {
    wsUrl;
    ws = null;
    subscriptions = new Map();
    priceCache = new Map();
    subscriptionIdToMint = new Map();
    mintToSubscriptionId = new Map();
    nextSubId = 1;
    reconnectAttempts = 0;
    maxReconnect = 10;
    connected = false;
    constructor(wsUrl) {
        this.wsUrl = wsUrl;
    }
    connect() {
        if (this.ws?.readyState === ws_1.default.OPEN)
            return;
        this.ws = new ws_1.default(this.wsUrl);
        this.ws.on('open', () => {
            logger_1.logger.info('[PRICE-WS] Connected');
            this.connected = true;
            this.reconnectAttempts = 0;
            const mints = Array.from(this.subscriptions.keys());
            for (const mint of mints) {
                this.subscribeAccount(mint);
            }
        });
        this.ws.on('message', (raw) => {
            try {
                const msg = JSON.parse(raw);
                if (msg.id && msg.result && typeof msg.result === 'number') {
                    const mint = this.subscriptionIdToMint.get(msg.id);
                    if (mint) {
                        this.mintToSubscriptionId.set(mint, msg.result);
                    }
                    return;
                }
                const params = msg?.params;
                if (!params?.subscription || !params?.result?.value)
                    return;
                const subId = params.subscription;
                const mint = this.getMintBySubId(subId);
                if (!mint)
                    return;
                const price = this.parsePrice(mint, params.result.value.data);
                if (price !== null && price > 0) {
                    const now = Date.now();
                    this.priceCache.set(mint, { price, timestamp: now, source: 'websocket' });
                    const callback = this.subscriptions.get(mint);
                    if (callback) {
                        callback({ mint, price, timestamp: now });
                    }
                }
            }
            catch { /* skip */ }
        });
        this.ws.on('error', (err) => {
            logger_1.logger.error(`[PRICE-WS] Error: ${err.message}`);
        });
        this.ws.on('close', () => {
            this.connected = false;
            logger_1.logger.warn('[PRICE-WS] Disconnected');
            if (this.reconnectAttempts < this.maxReconnect) {
                this.reconnectAttempts++;
                const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
                logger_1.logger.info(`[PRICE-WS] Reconnecting in ${delay}ms (${this.reconnectAttempts}/${this.maxReconnect})`);
                setTimeout(() => this.connect(), delay);
            }
            else {
                logger_1.logger.error('[PRICE-WS] Max reconnect — API fallback only');
            }
        });
    }
    subscribe(mint, callback) {
        if (callback) {
            this.subscriptions.set(mint, callback);
        }
        else {
            if (!this.subscriptions.has(mint)) {
                this.subscriptions.set(mint, () => { });
            }
        }
        if (this.connected) {
            this.subscribeAccount(mint);
        }
    }
    unsubscribe(mint) {
        this.subscriptions.delete(mint);
        this.priceCache.delete(mint);
        const subId = this.mintToSubscriptionId.get(mint);
        if (subId !== undefined && this.ws?.readyState === ws_1.default.OPEN) {
            this.ws.send(JSON.stringify({
                jsonrpc: '2.0',
                id: this.nextSubId++,
                method: 'accountUnsubscribe',
                params: [subId],
            }));
            this.mintToSubscriptionId.delete(mint);
        }
    }
    getCachedPrice(mint) {
        const cached = this.priceCache.get(mint);
        if (!cached)
            return null;
        if (cached.source === 'websocket' && Date.now() - cached.timestamp < 5000)
            return cached;
        if (cached.source === 'api' && Date.now() - cached.timestamp < 15000)
            return cached;
        if (Date.now() - cached.timestamp < 30000)
            return cached;
        return null;
    }
    setApiPrice(mint, price) {
        this.priceCache.set(mint, { price, timestamp: Date.now(), source: 'api' });
    }
    isConnected() { return this.connected; }
    getStats() {
        return {
            subscribed: this.subscriptions.size,
            cached: this.priceCache.size,
            connected: this.connected,
        };
    }
    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.connected = false;
    }
    subscribeAccount(mint) {
        if (!this.ws || this.ws.readyState !== ws_1.default.OPEN)
            return;
        const reqId = this.nextSubId++;
        this.subscriptionIdToMint.set(reqId, mint);
        this.ws.send(JSON.stringify({
            jsonrpc: '2.0',
            id: reqId,
            method: 'accountSubscribe',
            params: [mint, { encoding: 'base64', commitment: 'processed' }],
        }));
    }
    getMintBySubId(subId) {
        for (const [mint, id] of this.mintToSubscriptionId) {
            if (id === subId)
                return mint;
        }
        for (const [reqId, mint] of this.subscriptionIdToMint) {
            if (reqId === subId)
                return mint;
        }
        return null;
    }
    parsePrice(_mint, _data) {
        return null;
    }
}
exports.WebSocketPriceFeed = WebSocketPriceFeed;
class HybridPriceFeed {
    wsFeed;
    apiCache = new Map();
    activeTokens = new Set();
    constructor(heliusWsUrl) {
        this.wsFeed = new WebSocketPriceFeed(heliusWsUrl);
    }
    start() {
        this.wsFeed.connect();
        logger_1.logger.info('[PRICE] Hybrid feed started');
    }
    async getPrice(mint) {
        const wsCached = this.wsFeed.getCachedPrice(mint);
        if (wsCached && wsCached.source === 'websocket') {
            return { price: wsCached.price, source: 'websocket' };
        }
        const apiCached = this.apiCache.get(mint);
        if (apiCached && Date.now() - apiCached.timestamp < 10000) {
            return { price: apiCached.price, source: 'api-cache' };
        }
        if (wsCached) {
            return { price: wsCached.price, source: `stale-${wsCached.source}` };
        }
        if (apiCached && Date.now() - apiCached.timestamp < 30000) {
            return { price: apiCached.price, source: 'stale-api' };
        }
        try {
            const { getTokenPrice } = await Promise.resolve().then(() => __importStar(require('./market')));
            const price = await (0, apiRateLimit_1.withRateLimit)('dexscreener', () => getTokenPrice(mint));
            if (price !== null && price > 0) {
                this.apiCache.set(mint, { price, timestamp: Date.now(), source: 'api' });
                this.wsFeed.setApiPrice(mint, price);
                return { price, source: 'api-fresh' };
            }
        }
        catch (error) {
            logger_1.logger.debug(`[PRICE] API fetch failed: ${error.message}`);
        }
        return null;
    }
    async warmCache(mints) {
        for (const mint of mints) {
            if (this.activeTokens.has(mint))
                continue;
            this.activeTokens.add(mint);
            this.wsFeed.subscribe(mint);
        }
        const { getMarketData } = await Promise.resolve().then(() => __importStar(require('./market')));
        const batch = mints.slice(0, 10);
        await Promise.allSettled(batch.map(async (mint) => {
            try {
                const data = await (0, apiRateLimit_1.withRateLimit)('dexscreener', () => getMarketData(mint));
                if (data && data.priceSol > 0) {
                    this.apiCache.set(mint, { price: data.priceSol, timestamp: Date.now(), source: 'api' });
                    this.wsFeed.setApiPrice(mint, data.priceSol);
                }
            }
            catch { /* skip */ }
        }));
    }
    removeToken(mint) {
        this.activeTokens.delete(mint);
        this.apiCache.delete(mint);
        this.wsFeed.unsubscribe(mint);
    }
    getStats() {
        return {
            ...this.wsFeed.getStats(),
            apiCached: this.apiCache.size,
            activeTokens: this.activeTokens.size,
        };
    }
    stop() {
        this.wsFeed.disconnect();
    }
}
exports.HybridPriceFeed = HybridPriceFeed;
//# sourceMappingURL=priceFeed.js.map