import { logger } from '../utils/logger';

interface RateLimitEntry {
  count: number;
  resetAt: number;
  blocked: boolean;
}

const buckets: Map<string, RateLimitEntry> = new Map();
const totalRequests: Map<string, number> = new Map();
const limits: Map<string, { max: number; windowMs: number }> = new Map();

limits.set('jupiter', { max: 60, windowMs: 60000 });
limits.set('groq', { max: 30, windowMs: 60000 });
limits.set('anthropic', { max: 20, windowMs: 60000 });
limits.set('openai', { max: 30, windowMs: 60000 });
limits.set('helius', { max: 100, windowMs: 60000 });
limits.set('birdeye', { max: 60, windowMs: 60000 });
limits.set('rugcheck', { max: 30, windowMs: 60000 });
limits.set('dexscreener', { max: 30, windowMs: 60000 });
limits.set('default', { max: 60, windowMs: 60000 });

export async function withRateLimit<T>(endpoint: string, fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const limit = limits.get(endpoint) || limits.get('default')!;
  const key = endpoint;
  let entry = buckets.get(key);
  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + limit.windowMs, blocked: false };
    buckets.set(key, entry);
  }
  const total = totalRequests.get(key) || 0;
  totalRequests.set(key, total + 1);
  if (entry.count >= limit.max) {
    entry.blocked = true;
    const waitMs = entry.resetAt - now;
    logger.warn('[RATE_LIMIT] ' + endpoint + ' blocked, waiting ' + waitMs + 'ms');
    await new Promise((r) => setTimeout(r, waitMs));
    entry.count = 0;
    entry.resetAt = Date.now() + limit.windowMs;
    entry.blocked = false;
  }
  entry.count++;
  return fn();
}

interface RateLimitStats {
  currentCount: number;
  maxRequests: number;
  blocked: boolean;
  totalRequests: number;
}

export function getRateLimitStats(): Record<string, RateLimitStats> {
  const result: Record<string, RateLimitStats> = {};
  for (const [endpoint, limit] of limits.entries()) {
    const entry = buckets.get(endpoint);
    result[endpoint] = {
      currentCount: entry ? entry.count : 0,
      maxRequests: limit.max,
      blocked: entry ? entry.blocked : false,
      totalRequests: totalRequests.get(endpoint) || 0,
    };
  }
  return result;
}
