"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkCooldown = checkCooldown;
function checkCooldown(state) {
    const now = Date.now();
    if (state.circuitBreakerActive) {
        const rem = state.circuitBreakerUntil - now;
        if (rem > 0)
            return { active: true, remainingMs: rem, reason: 'CIRCUIT_BREAKER_24H' };
    }
    if (state.lastTpExit > 0 && (now - state.lastTpExit) < 2 * 60 * 1000) {
        return { active: true, remainingMs: 2 * 60 * 1000 - (now - state.lastTpExit), reason: 'COOLDOWN_TP_2MIN' };
    }
    if (state.lastSlHit > 0 && (now - state.lastSlHit) < 10 * 60 * 1000) {
        return { active: true, remainingMs: 10 * 60 * 1000 - (now - state.lastSlHit), reason: 'COOLDOWN_SL_10MIN' };
    }
    if (state.lastRugEmergency > 0 && (now - state.lastRugEmergency) < 30 * 60 * 1000) {
        return { active: true, remainingMs: 30 * 60 * 1000 - (now - state.lastRugEmergency), reason: 'COOLDOWN_RUG_30MIN' };
    }
    return { active: false, remainingMs: 0, reason: '' };
}
//# sourceMappingURL=cooldown.js.map