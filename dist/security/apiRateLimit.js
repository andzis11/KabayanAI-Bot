"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.withRateLimit = withRateLimit;
exports.getRateLimitStats = getRateLimitStats;
const logger_1 = require("../utils/logger");
const buckets = new Map();
const totalRequests = new Map();
const limits = new Map();
limits.set('jupiter', { max: 60, windowMs: 60000 });
limits.set('groq', { max: 30, windowMs: 60000 });
limits.set('anthropic', { max: 20, windowMs: 60000 });
limits.set('openai', { max: 30, windowMs: 60000 });
limits.set('helius', { max: 100, windowMs: 60000 });
limits.set('birdeye', { max: 60, windowMs: 60000 });
limits.set('rugcheck', { max: 30, windowMs: 60000 });
limits.set('dexscreener', { max: 30, windowMs: 60000 });
limits.set('default', { max: 60, windowMs: 60000 });
async function withRateLimit(endpoint, fn) {
    const now = Date.now();
    const limit = limits.get(endpoint) || limits.get('default');
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
        logger_1.logger.warn('[RATE_LIMIT] ' + endpoint + ' blocked, waiting ' + waitMs + 'ms');
        await new Promise((r) => setTimeout(r, waitMs));
        entry.count = 0;
        entry.resetAt = Date.now() + limit.windowMs;
        entry.blocked = false;
    }
    entry.count++;
    return fn();
}
function getRateLimitStats() {
    const result = {};
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
//# sourceMappingURL=apiRateLimit.js.map