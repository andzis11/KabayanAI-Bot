import { logger } from '../utils/logger';

interface RateLimitEntry { count: number; resetAt: number; }
const rateLimits: Map<string, RateLimitEntry> = new Map();

export function checkRateLimit(action: string, max: number = 10, windowMs: number = 60000): boolean {
  const now = Date.now();
  const entry = rateLimits.get(action);

  if (!entry || now > entry.resetAt) {
    rateLimits.set(action, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= max) return false;
  entry.count++;
  return true;
}

setInterval(() => {
  const now = Date.now();
  for (const [k, e] of rateLimits) if (now > e.resetAt) rateLimits.delete(k);
}, 60000);
