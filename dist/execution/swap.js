"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildSwapTransaction = buildSwapTransaction;
exports.executeSwap = executeSwap;
const web3_js_1 = require("@solana/web3.js");
const wallet_1 = require("../config/wallet");
const logger_1 = require("../utils/logger");
const apiRateLimit_1 = require("../security/apiRateLimit");
const raydium_1 = require("./raydium");
const axios_1 = __importDefault(require("axios"));
const SOL_MINT = "So11111111111111111111111111111111111111112";
const DEFAULT_OPTIONS = {
    maxRetries: 3,
    retryDelayMs: 1500,
    skipPreflight: false,
};
async function buildSwapTransaction(conn, input, output, amount, walletPk, slippage) {
    const inp = input === "SOL" ? SOL_MINT : input;
    const out = output === "SOL" ? SOL_MINT : output;
    const lamports = Math.round(amount * 1e9);
    try {
        const quote = await (0, apiRateLimit_1.withRateLimit)("jupiter", () => axios_1.default.get("https://quote-api.jup.ag/v6/quote", {
            params: {
                inputMint: inp,
                outputMint: out,
                amount: lamports,
                slippageBps: Math.round(slippage * 100),
            },
            timeout: 10000,
        }));
        if (!quote.data?.inputMint) {
            logger_1.logger.error("[SWAP] Invalid quote");
            return null;
        }
        const swap = await (0, apiRateLimit_1.withRateLimit)("jupiter", () => axios_1.default.post("https://quote-api.jup.ag/v6/swap", {
            quoteResponse: quote.data,
            userPublicKey: walletPk.toBase58(),
            wrapAndUnwrapSol: true,
            dynamicComputeUnitLimit: true,
            prioritizationFeeLamports: "auto",
        }, { timeout: 15000 }));
        const txBuf = Buffer.from(swap.data.swapTransaction, "base64");
        const tx = web3_js_1.VersionedTransaction.deserialize(txBuf);
        tx.sign([wallet_1.wallet]);
        return tx;
    }
    catch (error) {
        logger_1.logger.error(`[SWAP] Build error: ${error.message}`);
        return null;
    }
}
async function executeSwap(conn, input, output, amount, slippage, options = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    let lastError = "";
    for (let attempt = 1; attempt <= opts.maxRetries; attempt++) {
        try {
            logger_1.logger.info(`[SWAP] Attempt ${attempt}/${opts.maxRetries}: ${input.slice(0, 6)}... → ${output.slice(0, 6)}... | ${amount.toFixed(4)} SOL`);
            const maxSlippage = slippage * 1.5;
            const adjustedSlippage = Math.min(slippage * (1 + (attempt - 1) * 0.15), maxSlippage);
            if (adjustedSlippage > slippage) {
                logger_1.logger.warn(`[SWAP] Slippage escalated to ${adjustedSlippage}% (cap: ${maxSlippage}%)`);
            }
            const tx = await buildSwapTransaction(conn, input, output, amount, wallet_1.wallet.publicKey, adjustedSlippage);
            if (!tx) {
                lastError = "BUILD_FAILED";
                if (attempt === opts.maxRetries)
                    break;
                await sleep(opts.retryDelayMs * attempt);
                continue;
            }
            const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash("confirmed");
            const raw = tx.serialize();
            const sig = await conn.sendRawTransaction(raw, {
                skipPreflight: attempt > 1 ? true : opts.skipPreflight,
                maxRetries: 2,
                preflightCommitment: "confirmed",
            });
            logger_1.logger.info(`[SWAP] TX sent: ${sig}`);
            const confirmation = await Promise.race([
                conn.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed"),
                new Promise((_, reject) => setTimeout(() => reject(new Error("TIMEOUT")), 30000)),
            ]);
            if (confirmation.value?.err) {
                lastError = JSON.stringify(confirmation.value.err);
                logger_1.logger.warn(`[SWAP] TX error: ${lastError}`);
                if (isRetryable(lastError)) {
                    await sleep(opts.retryDelayMs * attempt);
                    continue;
                }
                return {
                    success: false,
                    txHash: sig,
                    method: "jupiter",
                    attempts: attempt,
                    error: lastError,
                };
            }
            logger_1.logger.info(`[SWAP] ✅ Success: ${sig}`);
            return {
                success: true,
                txHash: sig,
                method: "jupiter",
                attempts: attempt,
                error: null,
            };
        }
        catch (error) {
            lastError = error.message || "UNKNOWN";
            logger_1.logger.warn(`[SWAP] Attempt ${attempt} failed: ${lastError}`);
            if (isRetryable(lastError)) {
                await sleep(opts.retryDelayMs * Math.pow(1.5, attempt - 1));
                continue;
            }
        }
    }
    // Raydium fallback
    logger_1.logger.info("[SWAP] Trying Raydium fallback...");
    try {
        const ray = await (0, apiRateLimit_1.withRateLimit)("raydium", () => (0, raydium_1.raydiumSwap)(conn, input, output, amount, slippage));
        if (ray.success) {
            logger_1.logger.info(`[SWAP] ✅ Raydium: ${ray.txHash}`);
            return {
                success: true,
                txHash: ray.txHash,
                method: "raydium",
                attempts: opts.maxRetries + 1,
                error: null,
            };
        }
    }
    catch (e) {
        lastError += ` | Raydium: ${e.message}`;
    }
    logger_1.logger.error(`[SWAP] ❌ All failed: ${lastError}`);
    return {
        success: false,
        txHash: null,
        method: "none",
        attempts: opts.maxRetries + 1,
        error: lastError,
    };
}
function isRetryable(error) {
    const patterns = [
        "BlockhashNotFound",
        "BlockhashExpired",
        "TransactionExpired",
        "timeout",
        "ECONNRESET",
        "ETIMEDOUT",
        "429",
        "rate limit",
        "503",
        "502",
        "500",
        "CONFIRMATION_TIMEOUT",
        "blockhash",
        "expired",
    ];
    const el = error.toLowerCase();
    return patterns.some((p) => el.includes(p.toLowerCase()));
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
//# sourceMappingURL=swap.js.map