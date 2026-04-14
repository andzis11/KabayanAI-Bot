"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.raydiumSwap = raydiumSwap;
const web3_js_1 = require("@solana/web3.js");
const wallet_1 = require("../config/wallet");
const logger_1 = require("../utils/logger");
const axios_1 = __importDefault(require("axios"));
async function raydiumSwap(conn, inputMint, outputMint, amount, slippage) {
    try {
        const resp = await axios_1.default.post('https://transaction-v1.raydium.io/swap', {
            inputMint,
            outputMint,
            amount: Math.round(amount * 1e9),
            slippageBps: Math.round(slippage * 100),
            txVersion: 'V0',
            wallet: wallet_1.wallet.publicKey.toBase58(),
        }, { timeout: 15000 });
        const txData = resp.data?.data?.[0]?.transaction;
        if (!txData)
            return { success: false, txHash: null };
        const tx = web3_js_1.VersionedTransaction.deserialize(Buffer.from(txData, 'base64'));
        tx.sign([wallet_1.wallet]);
        const sig = await conn.sendRawTransaction(tx.serialize(), { skipPreflight: false, maxRetries: 3 });
        await conn.confirmTransaction(sig, 'confirmed');
        return { success: true, txHash: sig };
    }
    catch (error) {
        logger_1.logger.error(`[RAYDIUM] Error: ${error.message}`);
        return { success: false, txHash: null };
    }
}
//# sourceMappingURL=raydium.js.map