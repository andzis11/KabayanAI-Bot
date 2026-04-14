"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkRugCheck = checkRugCheck;
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("../utils/logger");
const apiRateLimit_1 = require("../security/apiRateLimit");
async function checkRugCheck(tokenMint) {
    try {
        const response = await (0, apiRateLimit_1.withRateLimit)("rugcheck", () => axios_1.default.get(`https://api.rugcheck.xyz/v1/tokens/${tokenMint}/report`, {
            timeout: 10000,
        }));
        const data = response.data;
        const topHolders = data.topHolders || [];
        const totalSupply = data.token?.supply || 1;
        const decimals = data.token?.decimals || 9;
        const supplyNum = Number(totalSupply) / Math.pow(10, decimals);
        let topHolderPercent = 0;
        if (topHolders.length > 0 && supplyNum > 0) {
            const top10 = topHolders
                .slice(0, 10)
                .reduce((s, h) => s + Number(h.amount || 0), 0);
            topHolderPercent = (top10 / supplyNum) * 100;
        }
        return {
            mintAuthority: data.mintAuthority !== null && data.mintAuthority !== undefined,
            freezeAuthority: data.freezeAuthority !== null && data.freezeAuthority !== undefined,
            topHolderPercent,
            bundledWallets: data.risks?.filter((r) => r.name?.toLowerCase().includes("bundled") ||
                r.name?.toLowerCase().includes("cluster"))?.length || 0,
            score: data.score || 0,
            riskLevel: data.riskLevel || "unknown",
        };
    }
    catch (error) {
        const is400 = error.response?.status === 400;
        const is404 = error.response?.status === 404;
        // For 400/404 errors, token likely doesn't exist yet or is too new
        if (is400 || is404) {
            logger_1.logger.warn(`[RUGCHECK] Token ${tokenMint.slice(0, 8)}... not found (${error.response?.status}) - likely too new`);
            return {
                mintAuthority: false, // Pump.fun tokens typically have mint disabled
                freezeAuthority: false,
                topHolderPercent: 0,
                bundledWallets: 0,
                score: 50, // Mid-range score for unknown tokens
                riskLevel: "unknown_new_token",
            };
        }
        logger_1.logger.error(`[RUGCHECK] Error: ${error.message}`);
        return {
            mintAuthority: false, // More lenient - assume Pump.fun standard
            freezeAuthority: false,
            topHolderPercent: 0,
            bundledWallets: 0,
            score: 50, // Better than worst case
            riskLevel: "unknown",
        };
    }
}
//# sourceMappingURL=rugcheck.js.map