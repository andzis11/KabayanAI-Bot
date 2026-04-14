process.env.TELEGRAM_BOT_TOKEN =
  process.env.TELEGRAM_BOT_TOKEN || "test-bot-token";
process.env.SOLANA_PRIVATE_KEY =
  process.env.SOLANA_PRIVATE_KEY || "11111111111111111111111111111111";
process.env.HELIUS_API_KEY = process.env.HELIUS_API_KEY || "test-helius-key";

// At least one AI provider key is required by env validation
process.env.GROQ_API_KEY = process.env.GROQ_API_KEY || "test-groq-key";

// Optional but commonly referenced in runtime
process.env.CHAT_ID = process.env.CHAT_ID || "123456789";
process.env.JITO_API_KEY = process.env.JITO_API_KEY || "";

// Keep test runtime deterministic and clearly marked
process.env.NODE_ENV = "test";
