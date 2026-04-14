"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.run9LayerFilter = run9LayerFilter;
const rugcheck_1 = require("../data/rugcheck");
const security_1 = require("../data/security");
const market_1 = require("../data/market");
async function run9LayerFilter(tokenMint) {
    const checks = {};
    let score = 0;
    try {
        const [rug, gp, mkt] = await Promise.all([
            (0, rugcheck_1.checkRugCheck)(tokenMint),
            (0, security_1.checkGoPlus)(tokenMint),
            (0, market_1.getMarketData)(tokenMint),
        ]);
        checks.liquidity_min = (mkt?.liquidityUsd || 0) > 5000;
        if (checks.liquidity_min)
            score += 10;
        checks.volume_24h = (mkt?.volume24h || 0) > 10000;
        if (checks.volume_24h)
            score += 10;
        checks.no_wash = (mkt?.volume24h || 0) < (mkt?.liquidityUsd || 0) * 50;
        if (checks.no_wash)
            score += 10;
        checks.mint_disabled = !rug.mintAuthority;
        if (checks.mint_disabled)
            score += 15;
        checks.no_bundle = rug.bundledWallets <= 5;
        if (checks.no_bundle)
            score += 15;
        checks.holder_ok = rug.topHolderPercent < 25;
        if (checks.holder_ok)
            score += 10;
        checks.not_honeypot = !gp.isHoneypot;
        if (checks.not_honeypot)
            score += 15;
        checks.freeze_disabled = !rug.freezeAuthority;
        if (checks.freeze_disabled)
            score += 10;
        const mcLiq = (mkt?.marketCap || 0) / (mkt?.liquidityUsd || 1);
        checks.mc_liq_ok = mcLiq > 0 && mcLiq < 50;
        if (checks.mc_liq_ok)
            score += 5;
        const passed = score >= 70;
        return { passed, score, checks, failedReason: passed ? null : `SCORE_${score}` };
    }
    catch (error) {
        return { passed: false, score: 0, checks, failedReason: `ERROR: ${error.message}` };
    }
}
//# sourceMappingURL=filter.js.map