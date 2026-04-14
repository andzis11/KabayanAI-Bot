import { logger } from "../utils/logger";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}
const rateLimits: Map<string, RateLimitEntry> = new Map();

let cleanupInterval: ReturnType<typeof setInterval> | null = null;

export function checkRateLimit(
  action: string,
  max: number = 10,
  windowMs: number = 60000,
): boolean {
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

cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [k, e] of rateLimits) if (now > e.resetAt) rateLimits.delete(k);
}, 60000);

export function cleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}
