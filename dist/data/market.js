"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMarketData = getMarketData;
exports.getTokenPrice = getTokenPrice;
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("../utils/logger");
const apiRateLimit_1 = require("../security/apiRateLimit");
const env_1 = require("../config/env");
async function getMarketData(tokenMint) {
    try {
        const response = await (0, apiRateLimit_1.withRateLimit)("dexscreener", () => axios_1.default.get(`${env_1.ENV.DEXSCREENER_API}${tokenMint}`, {
            timeout: 10000,
        }));
        const pairs = response.data?.pairs;
        if (!pairs || pairs.length === 0)
            return null;
        const pair = pairs.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
        return {
            tokenMint,
            priceUsd: parseFloat(pair.priceUsd || "0"),
            priceSol: parseFloat(pair.priceNative || "0"),
            liquiditySol: parseFloat(pair.liquidity?.base || "0"),
            liquidityUsd: parseFloat(pair.liquidity?.usd || "0"),
            volume24h: parseFloat(pair.volume?.h24 || "0"),
            volume1MinSol: parseFloat(pair.volume?.m1 || "0"),
            volumeToMcap24h: parseFloat(pair.volume?.h24 || "0") / parseFloat(pair.fdv || "1"),
            marketCap: parseFloat(pair.fdv || "0"),
            pairAddress: pair.pairAddress,
            pairCreatedAt: pair.pairCreatedAt || 0,
            dexId: pair.dexId || "unknown",
        };
    }
    catch (error) {
        logger_1.logger.error(`[MARKET] Error: ${error.message}`);
        return null;
    }
}
async function getTokenPrice(tokenMint) {
    const data = await getMarketData(tokenMint);
    return data?.priceSol || null;
}
//# sourceMappingURL=market.js.map