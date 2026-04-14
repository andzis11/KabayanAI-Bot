# 🍎 Kabayan Agent v3.0

> AI Trading Bot On-Chain Solana | MEV Bot | Telegram Agent

---

## ✨ Fitur Utama

| Kategori | Fitur |
|----------|-------|
| **Trading** | Buy/Sell Manual, Paper Trading |
| **AI Agent** | Security gate, SL/TP engine, trailing stop, position sizing |
| **AI Sniper** | Auto-scan token source, honeypot check, auto buy |
| **MEV Bot** | Sandwich + Arbitrage module (opsional) |
| **Alpha Tracking** | Monitoring alpha wallet real-time |
| **Backtest** | Preset strategy, compare strategy, custom run |
| **Risk Management** | Circuit breaker, cooldown rule, emergency exit |
| **Infrastructure** | Rate limiter, retry logic, health check |
| **Database** | SQLite (WAL), position recovery, daily state |
| **Monitoring** | Daily report, PnL summary, health endpoint |
| **Setup** | Setup wizard Node.js + validasi `.env` |

---

## ✅ Requirements

- **Node.js >= 20**
- npm (ikut terpasang bersama Node.js)
- OS: Linux / macOS / Windows

---

## 🚀 Quick Start

### 1) Clone repository

```bash
git clone https://github.com/andzis11/Kabayan-Agent.git
cd Kabayan-Agent
```

### 2) Install dependency

```bash
npm install
```

### 3) Setup environment

Paling mudah:

```bash
npm run setup
```

Atau manual:

1. Copy `env.template` menjadi `.env`
2. Isi variable wajib

### 4) Jalankan bot

**Development**

```bash
npm run dev
```

**Run biasa (ts-node)**

```bash
npm start
```

**Production**

```bash
npm run build
npm run start:prod
```

**PM2 (opsional)**

```bash
pm2 start ecosystem.config.js
pm2 logs kabayan-agent
```

---

## 🔧 Environment Variables

### Wajib

| Variable | Keterangan |
|----------|------------|
| `TELEGRAM_BOT_TOKEN` | Token bot dari `@BotFather` |
| `SOLANA_PRIVATE_KEY` | Private key wallet (Base58) |
| `HELIUS_API_KEY` | API key dari Helius |
| Salah satu AI key | `GROQ_API_KEY` atau `ANTHROPIC_API_KEY` atau `OPENAI_API_KEY` |

### Direkomendasikan

| Variable | Keterangan |
|----------|------------|
| `CHAT_ID` | Chat ID untuk notifikasi Telegram |

> Kompatibilitas lama: `TELEGRAM_CHAT_ID` masih didukung sebagai fallback untuk `CHAT_ID`.

### Opsional

- `JITO_API_KEY`
- `DAILY_CAPITAL` (default `1`)
- `BASE_RISK_PERCENT` (default `2`)
- `ALPHA_MULTIPLIER` (default `1.5`)
- `FEE_CAP` (default `0.5`)
- `MEV_ENABLED` (default `false`)
- `MEV_MIN_SPREAD_PERCENT` (default `2`)
- `MEV_TRADE_SIZE_SOL` (default `0.1`)
- `MEV_MIN_SOL_SIZE` (default `0.5`)
- `MEV_MAX_SLIPPAGE` (default `10`)
- `WHITELIST_MODE` (`open` / `whitelist` / `invite`)
- `DAILY_REPORT_CHAT_ID`
- `DEXSCREENER_API` (override endpoint)

---

## 📦 Scripts

| Script | Fungsi |
|--------|--------|
| `npm run setup` | Wizard setup `.env` + build check |
| `npm run dev` | Jalankan mode development (nodemon + ts-node) |
| `npm start` | Jalankan bot via ts-node |
| `npm run build` | Compile TypeScript ke `dist/` |
| `npm run start:prod` | Jalankan hasil build (`dist/index.js`) |
| `npm test` | Jalankan unit test (Jest) |
| `npm run test:cov` | Coverage test |
| `npm run backtest` | Run backtest default (balanced) |
| `npm run backtest:compare` | Compare semua strategi |
| `npm run backtest:aggressive` | Backtest strategy aggressive |
| `npm run backtest:conservative` | Backtest strategy conservative |
| `npm run migrate` | DB migration |
| `npm run typecheck` | Type-check main code |
| `npm run typecheck:test` | Type-check test files |

---

## 🤖 Telegram Commands

| Command | Fungsi |
|---------|--------|
| `/start` | Menu utama |
| `/help` | Bantuan command |
| `/my_wallet` | Cek wallet address & balance |
| `/status` | Status fitur |
| `/report` | Laporan harian |
| `/health` | Health check (RPC/DB/memory) |
| `/backtest` | Jalankan backtest |
| `/withdraw <addr> <amount>` | Withdraw SOL |
| `/alpha_add <wallet>` | Tambah alpha wallet |
| `/alpha_remove <wallet>` | Hapus alpha wallet |
| `/alpha_list` | List alpha wallet |
| `/rate_stats` | Statistik rate limiter |
| `/price_stats` | Statistik feed harga |
| `/bt_custom <capital> <risk%> <days> <strategy>` | Backtest custom |

---

## 📊 Backtest (Current Code Presets)

Preset strategy pada kode saat ini:

| Strategy | Risk | TP1 | TP2 | SL | Trailing |
|----------|------|-----|-----|----|----------|
| Conservative | 3% | 25% | 50% | 15% | 8% |
| Balanced | 5% | 35% | 80% | 20% | 10% |
| Aggressive | 8% | 50% | 120% | 25% | 12% |
| Sniper | 10% | 60% | 150% | 30% | 15% |
| Diamond Hands | 4% | 50% | 150% | 20% | 30% |

Contoh:

```bash
npm run backtest
npm run backtest:compare
npm run backtest:aggressive
```

---

## 🧠 Risk & Security Notes

- Trading memecoin berisiko sangat tinggi.
- Tidak ada jaminan profit.
- Mulai dari modal kecil.
- Gunakan paper trading dulu sebelum live.
- `MEV_ENABLED=true` hanya untuk user yang benar-benar paham risikonya (termasuk aspek hukum/etika di wilayah masing-masing).

---

## 🏗️ Struktur Proyek (ringkas)

- `src/index.ts` → orchestrator utama bot
- `src/ai/` → logic agent, SLTP, fee mode, security
- `src/data/` → market/security/honeypot data fetcher
- `src/execution/` → swap executor + paper trading
- `src/mev/` → scanner/arbitrage/sandwich modules
- `src/database/` → sqlite repo + migration
- `src/security/` → rate limiter & API limit
- `src/state/` → memory state
- `src/utils/` → logger, health, report, prelaunch check
- `src/tests/` → unit tests

---

## 🩺 Troubleshooting Cepat

### 1) `Configuration errors` saat start
Jalankan:

```bash
npm run setup
```

Pastikan `.env` berisi semua variable wajib.

### 2) Error merah di editor tapi build lulus
Coba:
- pilih TypeScript workspace version
- restart TS server/editor

### 3) Cek kualitas code cepat

```bash
npm run typecheck
npm run typecheck:test
npm test
```

---

## 📜 License

MIT

---

**Kabayan Agent v3.0** — Built with ❤️ for disciplined Solana traders