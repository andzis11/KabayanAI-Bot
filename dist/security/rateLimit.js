"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkRateLimit = checkRateLimit;
exports.cleanup = cleanup;
const rateLimits = new Map();
let cleanupInterval = null;
function checkRateLimit(action, max = 10, windowMs = 60000) {
    const now = Date.now();
    const entry = rateLimits.get(action);
    if (!entry || now > entry.resetAt) {
        rateLimits.set(action, { count: 1, resetAt: now + windowMs });
        return true;
    }
    if (entry.count >= max)
        return false;
    entry.count++;
    return true;
}
cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [k, e] of rateLimits)
        if (now > e.resetAt)
            rateLimits.delete(k);
}, 60000);
function cleanup() {
    if (cleanupInterval) {
        clearInterval(cleanupInterval);
        cleanupInterval = null;
    }
}
//# sourceMappingURL=rateLimit.js.map