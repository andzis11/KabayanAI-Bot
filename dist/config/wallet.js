"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.walletPubkey = exports.wallet = exports.connection = void 0;
exports.getBalance = getBalance;
exports.getWalletAddress = getWalletAddress;
const web3_js_1 = require("@solana/web3.js");
const bs58_1 = __importDefault(require("bs58"));
const env_1 = require("./env");
const logger_1 = require("../utils/logger");
const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${env_1.ENV.HELIUS_API_KEY}`;
exports.connection = new web3_js_1.Connection(HELIUS_RPC, {
    commitment: 'confirmed',
    confirmTransactionInitialTimeout: 30000,
});
exports.wallet = web3_js_1.Keypair.fromSecretKey(bs58_1.default.decode(env_1.ENV.SOLANA_PRIVATE_KEY));
exports.walletPubkey = exports.wallet.publicKey;
async function getBalance() {
    try {
        const balance = await exports.connection.getBalance(exports.walletPubkey);
        return balance / web3_js_1.LAMPORTS_PER_SOL;
    }
    catch (error) {
        logger_1.logger.error(`[WALLET] Balance error: ${error.message}`);
        return 0;
    }
}
async function getWalletAddress() {
    return exports.walletPubkey.toBase58();
}
//# sourceMappingURL=wallet.js.map