const dotenv = require("dotenv");
dotenv.config();

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value || value.trim() === "") {
    throw new Error(`❌ Missing required env var: ${key}`);
  }
  return value.trim();
}

function optionalEnv(key: string, fallback: string = ""): string {
  return (process.env[key] || fallback).trim();
}

function validateEnv(): void {
  const errors: string[] = [];

  if (!process.env.TELEGRAM_BOT_TOKEN?.trim())
    errors.push("TELEGRAM_BOT_TOKEN");
  if (!process.env.SOLANA_PRIVATE_KEY?.trim())
    errors.push("SOLANA_PRIVATE_KEY");
  if (!process.env.HELIUS_API_KEY?.trim()) errors.push("HELIUS_API_KEY");

  const hasAI =
    process.env.GROQ_API_KEY?.trim() ||
    process.env.ANTHROPIC_API_KEY?.trim() ||
    process.env.OPENAI_API_KEY?.trim();

  if (!hasAI) {
    errors.push(
      "At least one AI provider (GROQ_API_KEY, ANTHROPIC_API_KEY, or OPENAI_API_KEY)",
    );
  }

  if (errors.length > 0) {
    console.error("\n❌ Configuration errors:\n");
    errors.forEach((e) => console.error(`   • ${e}`));
    console.error("\nRun: npm run setup\n");
    process.exit(1);
  }

  const chatId =
    process.env.CHAT_ID?.trim() || process.env.TELEGRAM_CHAT_ID?.trim();
  if (!chatId) {
    console.warn(
      "⚠️  CHAT_ID / TELEGRAM_CHAT_ID not set — Telegram notifications disabled",
    );
  }
  if (!process.env.JITO_API_KEY?.trim()) {
    console.warn("⚠️  JITO_API_KEY not set — MEV Bot disabled");
  }
}

validateEnv();

export const ENV = {
  TELEGRAM_BOT_TOKEN: requireEnv("TELEGRAM_BOT_TOKEN"),
  CHAT_ID: optionalEnv("CHAT_ID", optionalEnv("TELEGRAM_CHAT_ID")),
  BOT_USERNAME: optionalEnv("BOT_USERNAME", "KabayanBot"),

  SOLANA_PRIVATE_KEY: requireEnv("SOLANA_PRIVATE_KEY"),
  HELIUS_API_KEY: requireEnv("HELIUS_API_KEY"),

  GROQ_API_KEY: optionalEnv("GROQ_API_KEY"),
  ANTHROPIC_API_KEY: optionalEnv("ANTHROPIC_API_KEY"),
  OPENAI_API_KEY: optionalEnv("OPENAI_API_KEY"),

  DAILY_CAPITAL: parseFloat(optionalEnv("DAILY_CAPITAL", "1")),
  BASE_RISK_PERCENT: parseFloat(optionalEnv("BASE_RISK_PERCENT", "2")),
  ALPHA_MULTIPLIER: parseFloat(optionalEnv("ALPHA_MULTIPLIER", "1.5")),
  FEE_CAP: parseFloat(optionalEnv("FEE_CAP", "0.5")),

  JITO_API_KEY: optionalEnv("JITO_API_KEY"),
  JITO_TIP_LAMPORTS: parseInt(optionalEnv("JITO_TIP_LAMPORTS", "50000")),
  MEV_MIN_SOL_SIZE: parseFloat(optionalEnv("MEV_MIN_SOL_SIZE", "0.5")),
  MEV_MAX_SLIPPAGE: parseInt(optionalEnv("MEV_MAX_SLIPPAGE", "10")),
  // WARNING: MEV sandwich attacks carry significant legal and ethical risks.
  // In many jurisdictions, MEV extraction may be classified as market manipulation
  // or front-running. Use only on testnets or with explicit permission.
  // Consult legal counsel before enabling in production.
  MEV_ENABLED: optionalEnv("MEV_ENABLED", "false") === "true",
  MEV_MIN_SPREAD_PERCENT: parseFloat(
    optionalEnv("MEV_MIN_SPREAD_PERCENT", "2"),
  ),
  MEV_TRADE_SIZE_SOL: parseFloat(optionalEnv("MEV_TRADE_SIZE_SOL", "0.1")),

  WHITELIST_MODE: optionalEnv("WHITELIST_MODE", "open") as
    | "open"
    | "whitelist"
    | "invite",
  DAILY_REPORT_CHAT_ID: optionalEnv("DAILY_REPORT_CHAT_ID"),

  DEXSCREENER_API:
    process.env.DEXSCREENER_API ||
    "https://api.dexscreener.com/latest/dex/tokens/",
} as const;
