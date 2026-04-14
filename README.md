# 🍎 Kabayan Agent v3.0

> AI Trading Bot On-Chain Solana | MEV Bot | AI Agent v2.0

---

## Fitur

| Kategori | Fitur |
|---|---|
| **Trading** | Buy/Sell Manual, Paper Trading |
| **AI Agent v2.0** | 8-layer security gate, SL/TP engine, trailing stop, position sizing |
| **AI Sniper** | Auto-scan Pump.fun, deep honeypot check, auto buy |
| **MEV Bot** | Sandwich attack, Arbitrage, Jito bundle |
| **Alpha Tracking** | Real-time alpha wallet monitoring |
| **Backtest** | 5 preset strategies, strategy comparison, custom config |
| **Risk Management** | Circuit breaker, cooldown rules, emergency overrides |
| **Infrastructure** | WebSocket price feed, per-endpoint rate limiting, retry logic |
| **Database** | SQLite (WAL mode), position recovery, daily state persistence |
| **Monitoring** | Health check, daily report, PnL card |
| **Setup** | Setup wizard (Linux/Mac/Windows), full .env validation |

---

## Quick Start

### 1. Clone

```bash
git clone https://github.com/andzis11/Kabayan-Agent.git
cd Kabayan-Agent
2. Setup

Linux/Mac:chmod +x setup.sh
bash setup.sh

Windows:
powershell -ExecutionPolicy Bypass -File setup.ps1
Setup wizard akan memandu kamu mengisi:

Telegram Bot Token (dari @BotFather)
Chat ID (dari @userinfobot)
Solana Private Key (Base58, wallet khusus trading!)
Helius API Key (
https://dev.helius.xyz
)
AI Provider keys (Groq, Anthropic, OpenAI — minimal satu)
Jito API Key (untuk MEV bot)
Trading settings (daily capital, risk %)

3. Jalankan

# Development
npm start

# Production
npm run build
npm install -g pm2
pm2 start ecosystem.config.js
pm2 logs kabayan-agent

4. Buka Telegram

Kirim /start ke bot kamu.



Commands

Command	Fungsi
/start	Menu utama
/help	Panduan lengkap
/my_wallet	Lihat alamat & saldo
/status	Status semua fitur
/report	Laporan harian
/health	Health check (RPC, DB, memory)
/backtest	Backtest engine
/withdraw <addr> <amount>	Withdraw SOL
/alpha_add <wallet>	Tambah alpha wallet
/alpha_remove <wallet>	Hapus alpha wallet
/alpha_list	Daftar alpha wallet
/rate_stats	API rate limit stats
/price_stats	Price feed stats
/bt_custom <capital> <risk%> <days> <strategy>	Custom backtest

Telegram Menu

🍎 KABAYAN AGENT v3.0

┌──────────────────────┐
│ 🟢 Buy Manual        │ → Minta CA → Security Gate → Eksekusi
│ 🔴 Sell Manual       │ → Pilih token → Eksekusi
│ 🤖 AI Agent Status   │ → Status agent (PnL, positions, circuit breaker)
│ 🚀 Activate AI Sniper│ → Toggle ON/OFF Pump.fun scanner
│ ⚡ MEV Bot           │ → Sandwich / Arbitrage / Status
│ 🔬 Backtest          │ → Single / Compare / Custom
│ 📊 Portfolio         │ → Semua posisi aktif
│ 📥 Deposit           │ → Tampilkan wallet address
│ 📤 Withdraw          │ → Petunjuk withdraw
│ 📈 PnL               │ → Laporan PnL harian
│ ⚙️ Settings          │ → Paper mode, sniper, MEV
└──────────────────────┘

AI Agent v2.0

Security Gate (8 Checks — ALL must pass)

#	Check	Requirement
1	Mint Authority	MUST be disabled
2	Freeze Authority	MUST be disabled
3	Honeypot	Buy+sell simulation must pass, tax < 50%
4	Top 10 Holders	Must hold < 25% of supply
5	Bundled Supply	≤5 wallets in block 0
6	Pool Liquidity	>75 SOL OR >$10,000
7	Volume/MCap	>0.8
8	Dev Wallet	Not in blacklist

SL/TP Engine

Parameter	Value
Hard Stop Loss	-20% from entry
Trailing Delta	21.8%
Trailing Activation	+20% from entry
TP1 Target	+77.5% → sell 90%
Moonbag	10% remaining, exit at -75% from ATH

Fee Modes

Mode	Condition	Jito Tip	Priority Fee	Slippage
AGGRESSIVE	Token < 120s / SELL / >10 buy txns	0.01 SOL	0.01 SOL	Buy 25% / Sell 30%
NORMAL	Volume > 50 SOL/min	0.005 SOL	0.005 SOL	Buy 15% / Sell 15%
SAFE	Default	0.0001 SOL	0.001 SOL	Buy 10% / Sell 10%

Emergency Overrides

Trigger	Action
Pool SOL < 5	SELL 100%
Deployer removes liquidity	SELL 100%
>3 top holders dump in 1 block	SELL 100%
Daily PnL ≤ -15%	HALT 24h (circuit breaker)

Cooldown Rules

Event	Wait Time
After TP exit	2 minutes
After SL hit	10 minutes
After rug/emergency	30 minutes

Backtest

Preset Strategies

Strategy	Risk	TP1	SL	Trailing	Circuit
Conservative	1%	+50%	-15%	15%	-10%
Balanced	2%	+77.5%	-20%	21.8%	-15%
Aggressive	3%	+100%	-25%	30%	-20%
Sniper	2.5%	+60%	-15%	25%	-12%
Diamond Hands	1.5%	+150%	-30%	35%	-20%

Cara Pakai

# Terminal
npm run backtest                    # Default (balanced)
npm run backtest:compare            # Bandingkan semua strategi
npm run backtest:aggressive         # Jalankan aggressive
npx ts-node src/backtest.ts compare conservative sniper  # Custom compare

# Telegram
/backtest                           → Pilih mode
/bt_custom 2 3 14 aggressive       → Custom: 2 SOL, 3% risk, 14 hari

## 📊 Hasil Backtest

### ⭐ Latest Results: 1 Day Test (Balanced Strategy)

> **Test Date**: April 14, 2026  
> **Configuration**: 1 SOL capital, 5% risk, 35% TP1, 15% SL, 20 tokens/day

```
╔══════════════════════════════════════════════════════╗
║                                                      ║
║           🍎 KABAYAN AGENT v3.0 BACKTEST             ║
║                                                      ║
╠══════════════════════════════════════════════════════╣
║  📅 Period         : 1 days × 5min scans             ║
║  💰 Starting       : 1.0000 SOL                      ║
║  💰 Ending         : 1.2197 SOL                      ║
║  📈 Net Return     : +0.2197 SOL (+21.97%)           ║
╠══════════════════════════════════════════════════════╣
║  🔄 Total Trades   : 20                              ║
║  ✅ Wins           : 15                              ║
║  ❌ Losses         : 5                               ║
║  📊 Win Rate       : 75.0%                           ║
╠══════════════════════════════════════════════════════╣
║  🏆 Avg Win        : +0.0164 SOL                     ║
║  💀 Avg Loss       : -0.0052 SOL                     ║
║  📐 EV/Trade       : +0.0110 SOL                     ║
║  📊 Profit Factor  : 9.53                            ║
║  📉 Max Drawdown   : 1.06%                           ║
║  📈 Sharpe Ratio   : 1.10                            ║
╠══════════════════════════════════════════════════════╣
║  💸 Total Fees     : 0.0100 SOL                      ║
╠══════════════════════════════════════════════════════╣
║  ✅ VERDICT: STRATEGY IS PROFITABLE                  ║
╚══════════════════════════════════════════════════════╝
```

### 📈 Strategy Comparison (1 Day)

```
╔══════════════════════════════════════════════════════════════════════════════════╗
║                        📊 STRATEGY COMPARISON TABLE                              ║
╠══════════════════════════════════════════════════════════════════════════════════╣
║  Metric          Conservative  Balanced      Aggressive    Sniper        Diamond ║
╠══════════════════════════════════════════════════════════════════════════════════╣
║  Return %        +3.1%         +16.5%        +38.7%        +91.8%        +16.8%  ║
║  Win Rate        54.3%         58.9%         50.0%         51.4%         39.3%   ║
║  Profit Factor   1.72          2.17          1.93          2.17          1.68    ║
║  Max Drawdown    1.6%          3.5%          11.2%         10.9%         6.0%    ║
║  Sharpe Ratio    0.27          0.35          0.27          0.31          0.25    ║
║  EV/Trade        +0.0009       +0.0029       +0.0046       +0.0087       +0.0030 ║
╠══════════════════════════════════════════════════════════════════════════════════╣
║  🏆 WINNER (by Return): SNIPER STRATEGY                                          ║
║  🛡️ SAFEST (by Drawdown): CONSERVATIVE                                           ║
╚══════════════════════════════════════════════════════════════════════════════════╝
```

### 🏆 Rekomendasi Strategy

| Profile | Strategy | Return/Day | Win Rate | Max DD | Risk Level |
|---------|----------|------------|----------|--------|------------|
| **🛡️ Safe** | Conservative | +3.1% | 54.3% | 1.6% | Low |
| **⚖️ Balanced** | Balanced | +16.5% | 58.9% | 3.5% | Medium |
| **⚡ Aggressive** | Sniper | +91.8% | 51.4% | 10.9% | High |

### 💰 Proyeksi Profit (Balanced Strategy)

| Modal | 1 Hari | 7 Hari | 30 Hari |
|-------|--------|--------|---------|
| **0.5 SOL** | +0.11 SOL | +0.77 SOL | +3.30 SOL |
| **1 SOL** | +0.22 SOL | +1.54 SOL | +6.59 SOL |
| **2 SOL** | +0.44 SOL | +3.08 SOL | +13.18 SOL |
| **5 SOL** | +1.10 SOL | +7.70 SOL | +32.95 SOL |

⚠️ **Disclaimer**: Hasil backtest adalah simulasi berbasis algoritma random walk. Performa nyata bisa berbeda secara signifikan. Selalu mulai dengan modal kecil dan gunakan paper trading terlebih dahulu.

Arsitektur Flow

User (Telegram)
    │
    ▼
┌─────────────┐
│  index.ts   │ ← Main Orchestrator
│  (Bot TG)   │
└──────┬──────┘
       │
       ├─→ Buy Manual ──→ Security Gate ──→ Execute Swap
       │                                      │
       ├─→ AI Sniper ──→ Pump.fun WS ──→ Honeypot Check ──→ Security Gate ──→ Execute
       │
       ├─→ Alpha Monitor ──→ Wallet TX Detect ──→ Alpha Signal ──→ Security Gate ──→ Execute
       │
       ├─→ Position Monitor (500ms loop)
       │       │
       │       ├─→ Price Feed (WS + API + Cache)
       │       ├─→ SL/TP Engine
       │       ├─→ Emergency Check
       │       └─→ Execute Sell (with retry)
       │
       ├─→ MEV Bot
       │       ├─→ Mempool Scanner (Helius WS)
       │       ├─→ Sandwich (Jito Bundle)
       │       └─→ Arbitrage (Jupiter Quote)
       │
       └─→ Backtest Engine
               ├─→ DexScreener API
               ├─→ Security Filter
               ├─→ Price Simulation
               └─→ Strategy Comparison

┌─────────────────────────────────────────────────────────┐
│                    INFRASTRUCTURE                        │
├─────────────────────────────────────────────────────────┤
│  Rate Limiter (per-endpoint) ← API Rate Limit           │
│  SQLite (WAL) ← trades, positions, daily_stats          │
│  Logger (Winston) ← error.log, combined.log             │
│  Memory (JSON) ← ai_memory.json                         │
└─────────────────────────────────────────────────────────┘

Dependencies

{
  "dependencies": {
    "@solana/spl-token": "^0.4.0",
    "@solana/web3.js": "^1.95.0",
    "axios": "^1.7.0",
    "better-sqlite3": "^11.0.0",
    "bs58": "^6.0.0",
    "dotenv": "^16.4.0",
    "node-telegram-bot-api": "^0.66.0",
    "sharp": "^0.33.0",
    "winston": "^3.13.0",
    "ws": "^8.18.0"
  }
}

Environment Variables

Variable	Required	Description
TELEGRAM_BOT_TOKEN	✅	Dari @BotFather
SOLANA_PRIVATE_KEY	✅	Base58 format, wallet khusus trading
HELIUS_API_KEY	✅	
https://dev.helius.xyz
CHAT_ID	✅	Dari @userinfobot
GROQ_API_KEY	⚡	Minimal satu AI provider
ANTHROPIC_API_KEY	⚡	Opsional
OPENAI_API_KEY	⚡	Opsional
JITO_API_KEY	❌	Untuk MEV bot
DAILY_CAPITAL	❌	Default: 1 SOL
BASE_RISK_PERCENT	❌	Default: 2%
ALPHA_MULTIPLIER	❌	Default: 1.5x
MEV_ENABLED	❌	Default: false

⚠️ Disclaimer

TRADING MEMECOIN ADALAH AKTIVITAS SPEKULATIF BERISIKO SANGAT TINGGI.


Kamu bisa kehilangan seluruh modal
Bot ini adalah alat bantu, bukan mesin uang otomatis
Tidak ada jaminan profit dalam bentuk apapun
Selalu gunakan uang yang siap kamu rugikan
DYOR (Do Your Own Research) sebelum trading
Mulai dengan modal kecil (0.1-0.5 SOL)
Paper trade dulu sebelum live


License

MIT



Kabayan Agent v3.0 — Built with ❤️ for Solana traders who stay disciplined

