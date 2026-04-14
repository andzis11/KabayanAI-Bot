"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runSecurityGate = runSecurityGate;
exports.quickSecurityCheck = quickSecurityCheck;
exports.addToBlacklist = addToBlacklist;
const logger_1 = require("../utils/logger");
const rugcheck_1 = require("../data/rugcheck");
const security_1 = require("../data/security");
const honeypot_1 = require("../data/honeypot");
const market_1 = require("../data/market");
// Blacklist dev wallets of known rug pullers and scammers.
// To add more wallets, use the addToBlacklist() function at runtime or
// add wallet addresses directly to the Set below.
// Sources: RugCheck reports, GoPlus security alerts, community reports.
const DEV_BLACKLIST = new Set([
// Example known rug puller wallets (replace with real addresses from RugCheck/GoPlus):
// "RugPullerWalletAddress1...",
// "ScammerWalletAddress2...",
// To add dynamically: import { addToBlacklist } from './securityGate'; addToBlacklist('wallet_address');
]);
async function runSecurityGate(connection, mint, devWallet) {
    let score = 100;
    const issues = [];
    const checks = {
        mint_authority_disabled: false,
        freeze_authority_disabled: false,
        honeypot_ok: false,
        top10_holders_ok: false,
        bundled_supply_ok: false,
        pool_liquidity_ok: false,
        volume_to_mcap_ok: false,
        dev_wallet_clean: false,
    };
    logger_1.logger.info("[SECURITY] Checking " + mint.slice(0, 8) + "...");
    // Jalankan semua checks secara paralel untuk kecepatan
    const [rugData, goPlusData, honeypotData, marketData] = await Promise.allSettled([
        (0, rugcheck_1.checkRugCheck)(mint),
        (0, security_1.checkGoPlus)(mint),
        (0, honeypot_1.deepHoneypotCheck)(mint),
        (0, market_1.getMarketData)(mint),
    ]);
    const rug = rugData.status === "fulfilled" ? rugData.value : null;
    const goplus = goPlusData.status === "fulfilled" ? goPlusData.value : null;
    const honeypot = honeypotData.status === "fulfilled" ? honeypotData.value : null;
    const market = marketData.status === "fulfilled" ? marketData.value : null;
    // Check 1: Mint Authority harus disabled
    if (rug) {
        checks.mint_authority_disabled = !rug.mintAuthority;
        if (rug.mintAuthority) {
            score -= 30;
            issues.push("MINT_AUTHORITY_ENABLED");
        }
    }
    else {
        // RugCheck API gagal = berikan peringatan tapi tidak langsung fail
        // Untuk token baru Pump.fun, ini normal
        score -= 5;
        logger_1.logger.warn("[SECURITY] RugCheck unavailable for " +
            mint.slice(0, 8) +
            " - reducing score slightly");
        issues.push("RUGCHECK_UNAVAILABLE");
    }
    // Check 2: Freeze Authority harus disabled
    if (rug) {
        checks.freeze_authority_disabled = !rug.freezeAuthority;
        if (rug.freezeAuthority) {
            score -= 30;
            issues.push("FREEZE_AUTHORITY_ENABLED");
        }
    }
    else {
        // RugCheck unavailable, skip freeze check (token baru Pump.fun biasanya freeze disabled)
        checks.freeze_authority_disabled = true; // Anggap ok jika RugCheck gagal
    }
    // Check 3: Honeypot — simulasi buy+sell harus berhasil, tax < 50%
    if (honeypot) {
        const honeypotOk = !honeypot.isHoneypot &&
            honeypot.canBuy &&
            honeypot.canSell &&
            honeypot.totalTax < 50;
        checks.honeypot_ok = honeypotOk;
        if (!honeypotOk) {
            score -= 40;
            issues.push("HONEYPOT_DETECTED" +
                (honeypot.totalTax >= 50
                    ? "_HIGH_TAX_" + honeypot.totalTax.toFixed(0) + "%"
                    : ""));
        }
    }
    else if (goplus) {
        // Fallback ke GoPlus jika Jupiter honeypot check gagal
        const ok = !goplus.isHoneypot && goplus.canSell && goplus.canBuy;
        checks.honeypot_ok = ok;
        if (!ok) {
            score -= 40;
            issues.push("GOPLUS_HONEYPOT");
        }
    }
    else {
        // Both honeypot APIs failed — treat as potential risk
        score -= 20;
        issues.push("HONEYPOT_CHECK_FAILED");
    }
    // Check 4: Top 10 holders harus < 25% supply
    if (rug) {
        checks.top10_holders_ok = rug.topHolderPercent < 25;
        if (rug.topHolderPercent >= 25) {
            score -= 15;
            issues.push("TOP10_HOLD_" + rug.topHolderPercent.toFixed(0) + "%");
        }
    }
    else {
        // RugCheck unavailable — deduct score for missing data
        score -= 10;
        issues.push("HOLDER_CHECK_UNAVAILABLE");
    }
    // Check 5: Bundled supply — max 5 wallets di block 0
    if (rug) {
        checks.bundled_supply_ok = rug.bundledWallets <= 5;
        if (rug.bundledWallets > 5) {
            score -= 10;
            issues.push("BUNDLED_WALLETS_" + rug.bundledWallets);
        }
    }
    else {
        // RugCheck unavailable — deduct score for missing data
        score -= 5;
        issues.push("BUNDLED_CHECK_UNAVAILABLE");
    }
    // Check 6: Pool liquidity > 30 SOL ATAU > $1,000
    if (market) {
        const liqOk = market.liquiditySol > 30 || market.liquidityUsd > 1000;
        checks.pool_liquidity_ok = liqOk;
        if (!liqOk) {
            score -= 15;
            issues.push("LOW_LIQUIDITY_" +
                market.liquiditySol.toFixed(0) +
                "SOL_$" +
                market.liquidityUsd.toFixed(0));
        }
    }
    else {
        score -= 15;
        issues.push("MARKET_DATA_UNAVAILABLE");
    }
    // Check 7: Volume / MCap > 0.5
    if (market) {
        const vmRatio = market.volumeToMcap24h;
        checks.volume_to_mcap_ok = vmRatio >= 0.5;
        if (vmRatio < 0.5) {
            score -= 5;
            issues.push("LOW_VOL_MCAP_" + vmRatio.toFixed(2));
        }
    }
    else {
        score -= 5;
        issues.push("VOLUME_CHECK_UNAVAILABLE");
    }
    // Check 8: Dev wallet tidak di blacklist
    if (devWallet) {
        const devClean = !DEV_BLACKLIST.has(devWallet);
        checks.dev_wallet_clean = devClean;
        if (!devClean) {
            score -= 30;
            issues.push("DEV_BLACKLISTED_" + devWallet.slice(0, 8));
        }
    }
    else {
        checks.dev_wallet_clean = true; // tidak ada dev wallet = anggap ok
    }
    // PASSED jika score >= 50 dan tidak ada honeypot/mint authority
    const passed = score >= 50 &&
        !issues.includes("HONEYPOT_DETECTED") &&
        !issues.includes("MINT_AUTHORITY_ENABLED");
    const reason = passed ? "PASSED" : issues.join(", ");
    const failedReason = passed ? "" : reason;
    logger_1.logger.info("[SECURITY] " + mint.slice(0, 8) + "... Score: " + score + " | " + reason);
    return { passed, reason, score, failedReason, checks };
}
function quickSecurityCheck(hasFreeze, hasMint, liquidityLocked) {
    if (hasFreeze)
        return false;
    if (hasMint)
        return false;
    if (!liquidityLocked)
        return false;
    return true;
}
function addToBlacklist(wallet) {
    DEV_BLACKLIST.add(wallet);
    logger_1.logger.info("[SECURITY] Blacklisted: " + wallet.slice(0, 8) + "...");
}
//# sourceMappingURL=securityGate.js.map