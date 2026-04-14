#!/bin/bash

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

clear

echo -e "${CYAN}"
echo "  ╔══════════════════════════════════════════════╗"
echo "  ║                                              ║"
echo "  ║      🍎 KABAYAN AGENT v3.0                  ║"
echo "  ║      Setup Wizard                            ║"
echo "  ║                                              ║"
echo "  ║      AI Trading Bot On-Chain Solana          ║"
echo "  ║      MEV Bot | AI Agent v2.0                 ║"
echo "  ║                                              ║"
echo "  ╚══════════════════════════════════════════════╝"
echo -e "${NC}"

echo -e "${BOLD}Step 1/7: Checking dependencies...${NC}"
echo ""

MISSING=()

if ! command -v node &> /dev/null; then
    MISSING+=("Node.js v18+")
else
    NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        MISSING+=("Node.js v18+ (found v$(node -v))")
    else
        echo -e "  ${GREEN}✓${NC} Node.js $(node -v)"
    fi
fi

if ! command -v npm &> /dev/null; then
    MISSING+=("npm")
else
    echo -e "  ${GREEN}✓${NC} npm $(npm -v)"
fi

if ! command -v git &> /dev/null; then
    MISSING+=("git")
else
    echo -e "  ${GREEN}✓${NC} git $(git --version | awk '{print $3}')"
fi

if [ ${#MISSING[@]} -gt 0 ]; then
    echo ""
    echo -e "  ${RED}✗ Missing dependencies:${NC}"
    for dep in "${MISSING[@]}"; do
        echo -e "    ${RED}• $dep${NC}"
    done
    echo ""
    echo -e "  ${YELLOW}Install them first, then run this script again.${NC}"
    exit 1
fi

echo ""
echo -e "${BOLD}Step 2/7: Checking system libraries...${NC}"
echo ""

if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    if ! dpkg -l | grep -q libcairo2-dev; then
        echo -e "  ${YELLOW}⚠ Canvas libraries not found — installing...${NC}"
        sudo apt-get update -qq
        sudo apt-get install -y -qq libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev
        echo -e "  ${GREEN}✓${NC} Canvas libraries installed"
    else
        echo -e "  ${GREEN}✓${NC} Canvas libraries present"
    fi
elif [[ "$OSTYPE" == "darwin"* ]]; then
    echo -e "  ${GREEN}✓${NC} macOS detected"
else
    echo -e "  ${YELLOW}⚠ Windows detected — install windows-build-tools if needed${NC}"
fi

echo ""
echo -e "${BOLD}Step 3/7: Installing npm packages...${NC}"
echo ""

if [ -d "node_modules" ]; then
    echo -e "  ${YELLOW}⚠ node_modules exists — reinstalling${NC}"
    rm -rf node_modules
fi

npm install

echo -e "  ${GREEN}✓${NC} Dependencies installed"
echo ""
echo -e "${BOLD}Step 4/7: Creating directories...${NC}"
echo ""

mkdir -p data logs src/assets

echo -e "  ${GREEN}✓${NC} data/"
echo -e "  ${GREEN}✓${NC} logs/"
echo -e "  ${GREEN}✓${NC} src/assets/"
echo ""

echo -e "${BOLD}Step 5/7: Configuration${NC}"
echo ""

SKIP_ENV=false

if [ -f ".env" ]; then
    echo -e "  ${YELLOW}⚠ .env already exists${NC}"
    read -p "  Overwrite? (y/N): " OVERWRITE
    if [[ "$OVERWRITE" != "y" && "$OVERWRITE" != "Y" ]]; then
        echo -e "  ${GREEN}✓${NC} Keeping existing .env"
        SKIP_ENV=true
    fi
fi

if [ "$SKIP_ENV" != "true" ]; then
    cp .env.example .env

    echo ""
    echo -e "  ${CYAN}── Telegram Bot ──${NC}"
    echo -e "  1. Open ${BOLD}@BotFather${NC} in Telegram"
    echo -e "  2. Type ${BOLD}/newbot${NC}, follow instructions"
    echo -e "  3. Copy the bot token"
    echo ""
    read -p "  Telegram Bot Token: " TG_TOKEN

    echo ""
    echo -e "  ${CYAN}── Chat ID ──${NC}"
    echo -e "  1. Open ${BOLD}@userinfobot${NC} in Telegram"
    echo -e "  2. Type ${BOLD}/start${NC}"
    echo -e "  3. Copy your ID"
    echo ""
    read -p "  Telegram Chat ID: " TG_CHAT

    echo ""
    echo -e "  ${CYAN}── Solana Wallet ──${NC}"
    echo -e "  ${YELLOW}⚠ Use a DEDICATED trading wallet!${NC}"
    echo -e "  Format: Base58 private key (not number array)"
    echo ""
    read -p "  Solana Private Key (Base58): " SOL_KEY

    echo ""
    echo -e "  ${CYAN}── Helius API ──${NC}"
    echo -e "  Sign up: ${CYAN}https://dev.helius.xyz${NC}"
    echo ""
    read -p "  Helius API Key: " HELIUS_KEY

    echo ""
    echo -e "  ${CYAN}── AI Providers (at least one required) ──${NC}"
    echo ""
    echo -e "  ${BOLD}Groq${NC} (FREE, ~300ms) — ${CYAN}https://console.groq.com${NC}"
    read -p "  Groq API Key (Enter to skip): " GROQ_KEY

    echo ""
    echo -e "  ${BOLD}Anthropic Claude${NC} — ${CYAN}https://console.anthropic.com${NC}"
    read -p "  Anthropic API Key (Enter to skip): " ANTHROPIC_KEY

    echo ""
    echo -e "  ${BOLD}OpenAI GPT-4o${NC} — ${CYAN}https://platform.openai.com${NC}"
    read -p "  OpenAI API Key (Enter to skip): " OPENAI_KEY

    echo ""
    echo -e "  ${CYAN}── Jito (for MEV Bot) ──${NC}"
    echo -e "  ${CYAN}https://jito.network${NC}"
    read -p "  Jito API Key (Enter to skip): " JITO_KEY

    echo ""
    echo -e "  ${CYAN}── Trading Settings ──${NC}"
    read -p "  Daily Capital (SOL) [default: 1]: " DAILY_CAP
    DAILY_CAP=${DAILY_CAP:-1}

    read -p "  Base Risk % per trade [default: 2]: " BASE_RISK
    BASE_RISK=${BASE_RISK:-2}

    cat > .env << EOF
# ============================================
#  KABAYAN AGENT v3.0 — Environment Config
#  Generated by Setup Wizard
# ============================================

# === WAJIB ===
TELEGRAM_BOT_TOKEN=${TG_TOKEN}
SOLANA_PRIVATE_KEY=${SOL_KEY}
HELIUS_API_KEY=${HELIUS_KEY}

# === TELEGRAM ===
CHAT_ID=${TG_CHAT}
BOT_USERNAME=KabayanBot
DAILY_REPORT_CHAT_ID=${TG_CHAT}

# === AI PROVIDERS ===
GROQ_API_KEY=${GROQ_KEY}
ANTHROPIC_API_KEY=${ANTHROPIC_KEY}
OPENAI_API_KEY=${OPENAI_KEY}

# === AI AGENT ===
DAILY_CAPITAL=${DAILY_CAP}
BASE_RISK_PERCENT=${BASE_RISK}
ALPHA_MULTIPLIER=1.5
FEE_CAP=0.5

# === MEV BOT ===
JITO_API_KEY=${JITO_KEY}
JITO_TIP_LAMPORTS echo -e "  ${YELLOW}⚠ Found trades.json — migrating...${NC}"
    npm run migrate 2>/dev/null || echo -e "  ${YELLOW}⚠ Migration skipped (will run on first start)${NC}"
else
    echo -e "  ${GREEN}✓${NC} No old data to migrate"
fi

echo ""
echo -e "${BOLD}Step 7/7: Pre-launch verification...${NC}"
echo ""

npx tsc --noEmit 2>/dev/null && echo -e "  ${GREEN}✓${NC} TypeScript OK" || echo -e "  ${YELLOW}⚠ TypeScript warnings (non-critical)"

echo ""
echo -e "${GREEN}"
echo "  ╔══════════════════════════════════════════════╗"
echo "  ║                                              ║"
echo "  ║      ✅ Setup Complete!                      ║"
echo "  ║                                              ║"
echo "  ╚════════════════════════════NC} .env created"
fi

echo ""
echo -=50000
MEV_MIN_SOL_SIZE=0.5
MEV_MAX_SLIPPAGE=10
MEV_ENABLED=false
MEV_MIN_SPREAD_PERCENT=2
MEV_TRADE_SIZE_SOL=0.1

# === CONFIG ===
WHITELIST_MODE=open
EOF

    echo ""
    echo -e "  ${GREEN}✓${e "${BOLD}Step 6/7: Database setup...${NC}"
echo ""

if [ -f "trades.json" ]; then
   ══════════════════╝"
echo -e "${NC}"

echo -e "  ${BOLD}Quick Start:${NC}"
echo ""
echo -e "  ${CYAN}Development:${NC}"
echo -e "    npm start"
echo ""
echo -e "  ${CYAN}Production:${NC}"
echo -e "    npm run build"
echo -e "    pm2 start ecosystem.config.js"
echo -e "    pm2 logs kabayan-agent"
echo ""
echo -e "  ${BOLD}First Steps:${NC}"
echo ""
echo -e "  1. Open Telegram, send ${BOLD}/start${NC} to your bot"
echo -e "  2. Type ${BOLD}/health${NC} to check connection"
echo -e "  3. Type ${BOLD}/my_wallet${NC} to see wallet"
echo -e "  4. Deposit SOL to the wallet address shown"
echo ""

read -p "  Start bot now? (y/N): " START_NOW
if [[ "$START_NOW" == "y" || "$START_NOW" == "Y" ]]; then
    echo ""
    npm start
fi

