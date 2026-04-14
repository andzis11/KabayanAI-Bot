"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scanArbitrage = scanArbitrage;
exports.executeArbitrage = executeArbitrage;
const web3_js_1 = require("@solana/web3.js");
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("../utils/logger");
const swap_1 = require("../execution/swap");
const apiRateLimit_1 = require("../security/apiRateLimit");
async function getQuote(input, output, amount) {
    try {
        const r = await (0, apiRateLimit_1.withRateLimit)('jupiter', () => axios_1.default.get('https://quote-api.jup.ag/v6/quote', {
            params: { inputMint: input, outputMint: output, amount, slippageBps: 100 },
            timeout: 5000,
        }));
        const outAmount = Number(r.data?.outAmount || 0);
        if (outAmount <= 0)
            return null;
        return { outAmount };
    }
    catch {
        return null;
    }
}
async function scanArbitrage(mint) {
    const SOL = 'So11111111111111111111111111111111111111112';
    const testAmt = web3_js_1.LAMPORTS_PER_SOL; // 1 SOL dalam lamports
    const buyQuote = await getQuote(SOL, mint, testAmt);
    if (!buyQuote)
        return null;
    const sellQuote = await getQuote(mint, SOL, buyQuote.outAmount);
    if (!sellQuote)
        return null;
    const returnedLamports = sellQuote.outAmount;
    const spread = ((returnedLamports - testAmt) / testAmt) * 100;
    if (spread > 0) {
        logger_1.logger.info(`[MEV] Arbitrage: ${mint.slice(0, 8)}... | Spread: ${spread.toFixed(2)}% | Profit est: ${((returnedLamports - testAmt) / 1e9).toFixed(4)} SOL`);
        return {
            tokenMint: mint,
            spreadPercent: spread,
            estimatedProfitLamports: returnedLamports - testAmt,
        };
    }
    return null;
}
async function executeArbitrage(conn, opp, _wallet, config) {
    if (opp.spreadPercent < config.minSpreadPercent) {
        logger_1.logger.info(`[MEV] Spread ${opp.spreadPercent.toFixed(2)}% < min ${config.minSpreadPercent}% — skip`);
        return false;
    }
    logger_1.logger.info(`[MEV] Executing arb: ${opp.tokenMint.slice(0, 8)}... | ${opp.spreadPercent.toFixed(2)}%`);
    // Step 1: Buy token dengan SOL
    const buyResult = await (0, swap_1.executeSwap)(conn, 'SOL', opp.tokenMint, config.tradeAmountSol, 5);
    if (!buyResult.success) {
        logger_1.logger.warn('[MEV] Arb buy failed');
        return false;
    }
    // Step 2: Dapatkan actual token balance untuk dijual
    // outAmount dari swap dalam unit terkecil token
    const tokenAmountReceived = buyResult.outAmount;
    if (!tokenAmountReceived || tokenAmountReceived <= 0) {
        logger_1.logger.warn('[MEV] Arb buy succeeded but outAmount unknown — skip sell to avoid loss');
        return false;
    }
    // Konversi outAmount (lamports/smallest unit) ke UI amount
    // Jupiter return dalam smallest unit, executeSwap perlu amount dalam SOL equivalent
    // Gunakan 100% dari token yang diterima
    const tokenAmountForSell = tokenAmountReceived / 1e9; // adjust decimals sesuai token
    // Step 3: Sell semua token kembali ke SOL
    const sellResult = await (0, swap_1.executeSwap)(conn, opp.tokenMint, 'SOL', tokenAmountForSell, 5);
    if (!sellResult.success) {
        logger_1.logger.error('[MEV] Arb sell FAILED — posisi terbuka! Mint: ' + opp.tokenMint);
        return false;
    }
    logger_1.logger.info('[MEV] Arb completed successfully');
    return true;
}
//# sourceMappingURL=arbitrage.js.map