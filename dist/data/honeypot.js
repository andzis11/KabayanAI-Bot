"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deepHoneypotCheck = deepHoneypotCheck;
exports.quickHoneypotCheck = quickHoneypotCheck;
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("../utils/logger");
const SOL_MINT = 'So11111111111111111111111111111111111111112';
const TEST_AMOUNT = Math.round(0.01 * 1e9);
async function getQuote(inputMint, outputMint, amount, slippageBps) {
    const res = await axios_1.default.get('https://quote-api.jup.ag/v6/quote', {
        params: { inputMint, outputMint, amount, slippageBps },
        timeout: 10000,
    });
    return res.data;
}
async function deepHoneypotCheck(tokenMint) {
    const result = {
        isHoneypot: false,
        canBuy: true,
        canSell: true,
        buyTax: 0,
        sellTax: 0,
        totalTax: 0,
        maxSellPercent: 100,
        reason: 'OK',
        details: {
            buyQuoteOk: false,
            sellQuoteOk: false,
            sellRouteFound: false,
            highTax: false,
            maxSellLimited: false,
        },
    };
    try {
        let tokensReceived = 0;
        // TEST 1: BUY
        try {
            const buyQuote = await getQuote(SOL_MINT, tokenMint, TEST_AMOUNT, 500);
            tokensReceived = parseInt(buyQuote.outAmount || '0');
            if (tokensReceived <= 0) {
                result.canBuy = false;
                result.isHoneypot = true;
                result.reason = 'CANNOT_BUY';
                return result;
            }
            result.details.buyQuoteOk = true;
        }
        catch (err) {
            if (err.message && err.message.includes('Could not find any route')) {
                result.canBuy = false;
                result.isHoneypot = true;
                result.reason = 'NO_BUY_ROUTE';
                return result;
            }
        }
        if (tokensReceived <= 0) {
            result.reason = 'ZERO_TOKENS_RECEIVED';
            return result;
        }
        // TEST 2: SELL
        try {
            const sellQuote = await getQuote(tokenMint, SOL_MINT, tokensReceived, 5000);
            const solBack = parseInt(sellQuote.outAmount || '0');
            if (solBack <= 0) {
                result.canSell = false;
                result.isHoneypot = true;
                result.reason = 'CANNOT_SELL';
                return result;
            }
            result.details.sellQuoteOk = true;
            result.details.sellRouteFound = true;
            const totalLoss = TEST_AMOUNT - solBack;
            const totalTaxPct = (totalLoss / TEST_AMOUNT) * 100;
            result.totalTax = Math.max(0, totalTaxPct);
            result.buyTax = result.totalTax * 0.4;
            result.sellTax = result.totalTax * 0.6;
            if (totalTaxPct > 50) {
                result.isHoneypot = true;
                result.details.highTax = true;
                result.reason = 'HIGH_TAX_' + totalTaxPct.toFixed(0) + '%';
                return result;
            }
        }
        catch (err) {
            if (err.message && err.message.includes('Could not find any route')) {
                result.canSell = false;
                result.isHoneypot = true;
                result.details.sellRouteFound = false;
                result.reason = 'NO_SELL_ROUTE';
                return result;
            }
            result.details.sellQuoteOk = false;
        }
        // TEST 3: MAX SELL
        try {
            const testAmt = Math.round((tokensReceived * 75) / 100);
            const smallSell = await getQuote(tokenMint, SOL_MINT, testAmt, 5000);
            if (smallSell.outAmount && parseInt(smallSell.outAmount) > 0) {
                result.maxSellPercent = 100;
            }
        }
        catch {
            result.maxSellPercent = 25;
            result.details.maxSellLimited = true;
            result.reason = 'MAX_SELL_LIMITED';
        }
        logger_1.logger.info('[HONEYPOT] OK ' + tokenMint.slice(0, 8) + '... Tax: ' + result.totalTax.toFixed(1) + '%');
        return result;
    }
    catch (error) {
        result.reason = 'CHECK_ERROR: ' + error.message;
        return result;
    }
}
async function quickHoneypotCheck(tokenMint) {
    try {
        const res = await deepHoneypotCheck(tokenMint);
        return !res.isHoneypot;
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=honeypot.js.map