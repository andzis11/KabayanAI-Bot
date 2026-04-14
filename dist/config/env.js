"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ENV = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
function requireEnv(key) {
    const value = process.env[key];
    if (!value || value.trim() === '') {
        throw new Error(`❌ Missing required env var: ${key}`);
    }
    return value.trim();
}
function optionalEnv(key, fallback = '') {
    return (process.env[key] || fallback).trim();
}
function validateEnv() {
    const errors = [];
    if (!process.env.TELEGRAM_BOT_TOKEN?.trim())
        errors.push('TELEGRAM_BOT_TOKEN');
    if (!process.env.SOLANA_PRIVATE_KEY?.trim())
        errors.push('SOLANA_PRIVATE_KEY');
    if (!process.env.HELIUS_API_KEY?.trim())
        errors.push('HELIUS_API_KEY');
    const hasAI = process.env.GROQ_API_KEY?.trim() ||
        process.env.ANTHROPIC_API_KEY?.trim() ||
        process.env.OPENAI_API_KEY?.trim();
    if (!hasAI) {
        errors.push('At least one AI provider (GROQ_API_KEY, ANTHROPIC_API_KEY, or OPENAI_API_KEY)');
    }
    if (errors.length > 0) {
        console.error('\n❌ Configuration errors:\n');
        errors.forEach((e) => console.error(`   • ${e}`));
        console.error('\nRun: bash setup.sh (or setup.ps1 on Windows)\n');
        process.exit(1);
    }
    if (!process.env.CHAT_ID?.trim()) {
        console.warn('⚠️  CHAT_ID not set — Telegram notifications disabled');
    }
    if (!process.env.JITO_API_KEY?.trim()) {
        console.warn('⚠️  JITO_API_KEY not set — MEV Bot disabled');
    }
}
validateEnv();
exports.ENV = {
    TELEGRAM_BOT_TOKEN: requireEnv('TELEGRAM_BOT_TOKEN'),
    CHAT_ID: optionalEnv('CHAT_ID'),
    BOT_USERNAME: optionalEnv('BOT_USERNAME', 'KabayanBot'),
    SOLANA_PRIVATE_KEY: requireEnv('SOLANA_PRIVATE_KEY'),
    HELIUS_API_KEY: requireEnv('HELIUS_API_KEY'),
    GROQ_API_KEY: optionalEnv('GROQ_API_KEY'),
    ANTHROPIC_API_KEY: optionalEnv('ANTHROPIC_API_KEY'),
    OPENAI_API_KEY: optionalEnv('OPENAI_API_KEY'),
    DAILY_CAPITAL: parseFloat(optionalEnv('DAILY_CAPITAL', '1')),
    BASE_RISK_PERCENT: parseFloat(optionalEnv('BASE_RISK_PERCENT', '2')),
    ALPHA_MULTIPLIER: parseFloat(optionalEnv('ALPHA_MULTIPLIER', '1.5')),
    FEE_CAP: parseFloat(optionalEnv('FEE_CAP', '0.5')),
    JITO_API_KEY: optionalEnv('JITO_API_KEY'),
    JITO_TIP_LAMPORTS: parseInt(optionalEnv('JITO_TIP_LAMPORTS', '50000')),
    MEV_MIN_SOL_SIZE: parseFloat(optionalEnv('MEV_MIN_SOL_SIZE', '0.5')),
    MEV_MAX_SLIPPAGE: parseInt(optionalEnv('MEV_MAX_SLIPPAGE', '10')),
    MEV_ENABLED: optionalEnv('MEV_ENABLED', 'false') === 'true',
    MEV_MIN_SPREAD_PERCENT: parseFloat(optionalEnv('MEV_MIN_SPREAD_PERCENT', '2')),
    MEV_TRADE_SIZE_SOL: parseFloat(optionalEnv('MEV_TRADE_SIZE_SOL', '0.1')),
    WHITELIST_MODE: optionalEnv('WHITELIST_MODE', 'open'),
    DAILY_REPORT_CHAT_ID: optionalEnv('DAILY_REPORT_CHAT_ID'),
};
//# sourceMappingURL=env.js.map