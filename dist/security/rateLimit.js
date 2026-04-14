"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkRateLimit = checkRateLimit;
const rateLimits = new Map();
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
setInterval(() => {
    const now = Date.now();
    for (const [k, e] of rateLimits)
        if (now > e.resetAt)
            rateLimits.delete(k);
}, 60000);
//# sourceMappingURL=rateLimit.js.map