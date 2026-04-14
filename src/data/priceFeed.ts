import WebSocket from 'ws';
import { logger } from '../utils/logger';
import { withRateLimit } from '../security/apiRateLimit';

interface PriceUpdate {
  mint: string;
  price: number;
  timestamp: number;
}

interface CachedPrice {
  price: number;
  timestamp: number;
  source: 'websocket' | 'api' | 'cache';
}

type OnPriceUpdate = (update: PriceUpdate) => void;

export class WebSocketPriceFeed {
  private ws: WebSocket | null = null;
  private subscriptions: Map<string, OnPriceUpdate> = new Map();
  private priceCache: Map<string, CachedPrice> = new Map();
  private subscriptionIdToMint: Map<number, string> = new Map();
  private mintToSubscriptionId: Map<string, number> = new Map();
  private nextSubId = 1;
  private reconnectAttempts = 0;
  private maxReconnect = 10;
  private connected = false;

  constructor(private wsUrl: string) {}

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    this.ws = new WebSocket(this.wsUrl);

    this.ws.on('open', () => {
      logger.info('[PRICE-WS] Connected');
      this.connected = true;
      this.reconnectAttempts = 0;

      const mints = Array.from(this.subscriptions.keys());
      for (const mint of mints) {
        this.subscribeAccount(mint);
      }
    });

    this.ws.on('message', (raw: string) => {
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
        if (!params?.subscription || !params?.result?.value) return;

        const subId = params.subscription;
        const mint = this.getMintBySubId(subId);
        if (!mint) return;

        const price = this.parsePrice(mint, params.result.value.data);

        if (price !== null && price > 0) {
          const now = Date.now();
          this.priceCache.set(mint, { price, timestamp: now, source: 'websocket' });

          const callback = this.subscriptions.get(mint);
          if (callback) {
            callback({ mint, price, timestamp: now });
          }
        }
      } catch { /* skip */ }
    });

    this.ws.on('error', (err) => {
      logger.error(`[PRICE-WS] Error: ${err.message}`);
    });

    this.ws.on('close', () => {
      this.connected = false;
      logger.warn('[PRICE-WS] Disconnected');

      if (this.reconnectAttempts < this.maxReconnect) {
        this.reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
        logger.info(`[PRICE-WS] Reconnecting in ${delay}ms (${this.reconnectAttempts}/${this.maxReconnect})`);
        setTimeout(() => this.connect(), delay);
      } else {
        logger.error('[PRICE-WS] Max reconnect — API fallback only');
      }
    });
  }

  subscribe(mint: string, callback?: OnPriceUpdate): void {
    if (callback) {
      this.subscriptions.set(mint, callback);
    } else {
      if (!this.subscriptions.has(mint)) {
        this.subscriptions.set(mint, () => {});
      }
    }

    if (this.connected) {
      this.subscribeAccount(mint);
    }
  }

  unsubscribe(mint: string): void {
    this.subscriptions.delete(mint);
    this.priceCache.delete(mint);

    const subId = this.mintToSubscriptionId.get(mint);
    if (subId !== undefined && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        jsonrpc: '2.0',
        id: this.nextSubId++,
        method: 'accountUnsubscribe',
        params: [subId],
      }));
      this.mintToSubscriptionId.delete(mint);
    }
  }

  getCachedPrice(mint: string): CachedPrice | null {
    const cached = this.priceCache.get(mint);
    if (!cached) return null;
    if (cached.source === 'websocket' && Date.now() - cached.timestamp < 5000) return cached;
    if (cached.source === 'api' && Date.now() - cached.timestamp < 15000) return cached;
    if (Date.now() - cached.timestamp < 30000) return cached;
    return null;
  }

  setApiPrice(mint: string, price: number): void {
    this.priceCache.set(mint, { price, timestamp: Date.now(), source: 'api' });
  }

  isConnected(): boolean { return this.connected; }

  getStats(): { subscribed: number; cached: number; connected: boolean } {
    return {
      subscribed: this.subscriptions.size,
      cached: this.priceCache.size,
      connected: this.connected,
    };
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
  }

  private subscribeAccount(mint: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const reqId = this.nextSubId++;
    this.subscriptionIdToMint.set(reqId, mint);

    this.ws.send(JSON.stringify({
      jsonrpc: '2.0',
      id: reqId,
      method: 'accountSubscribe',
      params: [mint, { encoding: 'base64', commitment: 'processed' }],
    }));
  }

  private getMintBySubId(subId: number): string | null {
    for (const [mint, id] of this.mintToSubscriptionId) {
      if (id === subId) return mint;
    }
    for (const [reqId, mint] of this.subscriptionIdToMint) {
      if (reqId === subId) return mint;
    }
    return null;
  }

  private parsePrice(_mint: string, _data: any): number | null {
    return null;
  }
}

export class HybridPriceFeed {
  private wsFeed: WebSocketPriceFeed;
  private apiCache: Map<string, CachedPrice> = new Map();
  private activeTokens: Set<string> = new Set();

  constructor(heliusWsUrl: string) {
    this.wsFeed = new WebSocketPriceFeed(heliusWsUrl);
  }

  start(): void {
    this.wsFeed.connect();
    logger.info('[PRICE] Hybrid feed started');
  }

  async getPrice(mint: string): Promise<{ price: number; source: string } | null> {
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
      const { getTokenPrice } = await import('./market');
      const price = await withRateLimit('dexscreener', () => getTokenPrice(mint));

      if (price !== null && price > 0) {
        this.apiCache.set(mint, { price, timestamp: Date.now(), source: 'api' });
        this.wsFeed.setApiPrice(mint, price);
        return { price, source: 'api-fresh' };
      }
    } catch (error: any) {
      logger.debug(`[PRICE] API fetch failed: ${error.message}`);
    }

    return null;
  }

  async warmCache(mints: string[]): Promise<void> {
    for (const mint of mints) {
      if (this.activeTokens.has(mint)) continue;
      this.activeTokens.add(mint);
      this.wsFeed.subscribe(mint);
    }

    const { getMarketData } = await import('./market');
    const batch = mints.slice(0, 10);

    await Promise.allSettled(
      batch.map(async (mint) => {
        try {
          const data = await withRateLimit('dexscreener', () => getMarketData(mint));
          if (data && data.priceSol > 0) {
            this.apiCache.set(mint, { price: data.priceSol, timestamp: Date.now(), source: 'api' });
            this.wsFeed.setApiPrice(mint, data.priceSol);
          }
        } catch { /* skip */ }
      })
    );
  }

  removeToken(mint: string): void {
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

  stop(): void {
    this.wsFeed.disconnect();
  }
}

