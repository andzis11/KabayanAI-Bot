"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendJitoBundle = sendJitoBundle;
exports.getRandomTipAccount = getRandomTipAccount;
exports.buildTipInstruction = buildTipInstruction;
const axios_1 = __importDefault(require("axios"));
const web3_js_1 = require("@solana/web3.js");
const logger_1 = require("../utils/logger");
const apiRateLimit_1 = require("../security/apiRateLimit");
const JITO_URL = 'https://mainnet.block-engine.jito.wtf';
const TIP_ACCOUNTS = [
    '96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5',
    'HFqU5x63VTqvQss8hp11i4bPuAjicwGcMmMipKxzNzG',
    'Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY',
    'ADaUMid9yfUytqMBgopwjb2DTLSuITxZk6GFCjPhZDx',
    'DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh',
    'ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt',
    'DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL',
    '3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT',
];
async function sendJitoBundle(txs, apiKey) {
    try {
        const serialized = txs.map(tx => Buffer.from(tx instanceof web3_js_1.VersionedTransaction
            ? tx.serialize()
            : tx.serialize({ requireAllSignatures: false })).toString('base64'));
        const resp = await (0, apiRateLimit_1.withRateLimit)('jito', () => axios_1.default.post(`${JITO_URL}/api/v1/bundles`, {
            jsonrpc: '2.0',
            id: 1,
            method: 'sendBundle',
            params: [serialized],
        }, {
            headers: { 'Content-Type': 'application/json', 'x-jito-auth': apiKey },
            timeout: 10000,
        }));
        const id = resp.data?.result;
        logger_1.logger.info(`[JITO] Bundle sent: ${id}`);
        return id;
    }
    catch (e) {
        logger_1.logger.error(`[JITO] Failed: ${e.message}`);
        return null;
    }
}
function getRandomTipAccount() {
    return TIP_ACCOUNTS[Math.floor(Math.random() * TIP_ACCOUNTS.length)];
}
function buildTipInstruction(fromPubkey, tipLamports) {
    return web3_js_1.SystemProgram.transfer({
        fromPubkey,
        toPubkey: new web3_js_1.PublicKey(getRandomTipAccount()),
        lamports: tipLamports,
    });
}
//# sourceMappingURL=jito.js.map