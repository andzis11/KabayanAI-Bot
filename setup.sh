#!/bin/bash
# Kabayan Agent v3.0 Setup Wizard
# Works on Linux, Mac, and Windows (Git Bash/WSL)

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

echo ""
echo -e "${BOLD}${CYAN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${CYAN}║         🍎 KABAYAN AGENT v3.0 SETUP          ║${NC}"
echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════════╝${NC}"
echo ""

# Step 1: Check Dependencies
echo -e "${BOLD}Step 1/7: Checking dependencies...${NC}"
echo ""

if ! command -v node &> /dev/null; then
    echo -e "  ${RED}✗ Node.js not found${NC}"
    echo "  Please install Node.js v20+ first"
    exit 1
else
    NODE_VER=$(node --version)
    echo -e "  ${GREEN}✓${NC} Node.js $NODE_VER"
fi

if ! command -v npm &> /dev/null; then
    echo -e "  ${RED}✗ npm not found${NC}"
    exit 1
else
    NPM_VER=$(npm --version)
    echo -e "  ${GREEN}✓${NC} npm $NPM_VER"
fi

if ! command -v git &> /dev/null; then
    echo -e "  ${RED}✗ git not found${NC}"
    exit 1
else
    GIT_VER=$(git --version)
    echo -e "  ${GREEN}✓${NC} $GIT_VER"
fi

echo ""

# Step 2: Check Canvas Libraries
echo -e "${BOLD}Step 2/7: Checking system libraries...${NC}"
echo ""

if [ -f "/usr/bin/ldconfig" ] || [ -f "/sbin/ldconfig" ]; then
    echo -e "  ${GREEN}✓${NC} System libraries present"
else
    echo -e "  ${YELLOW}⚠${NC} System check skipped (Mac/WSL)"
fi

echo ""

# Step 3: Install Dependencies
echo -e "${BOLD}Step 3/7: Installing npm packages...${NC}"
echo ""

if [ -d "node_modules" ]; then
    echo -e "  ${YELLOW}⚠ node_modules exists — reinstalling${NC}"
    rm -rf node_modules package-lock.json
fi

npm install
echo -e "  ${GREEN}✓${NC} Dependencies installed"
echo ""

# Step 4: Create Directories
echo -e "${BOLD}Step 4/7: Creating directories...${NC}"
echo ""

mkdir -p data logs src/assets
echo -e "  ${GREEN}✓${NC} data/"
echo -e "  ${GREEN}✓${NC} logs/"
echo -e "  ${GREEN}✓${NC} src/assets/"
echo ""

# Step 5: Configuration
echo -e "${BOLD}Step 5/7: Configuration${NC}"
echo ""

if [ -f ".env" ]; then
    read -p "  .env already exists. Overwrite? (y/N): " OVERWRITE
    if [[ "$OVERWRITE" != "y" && "$OVERWRITE" != "Y" ]]; then
        echo -e "  ${GREEN}✓${NC} Keeping existing .env"
    else
        echo -e "  ${YELLOW}⚠${NC} Overwriting .env"
    fi
fi

if [[ ! -f ".env" || "$OVERWRITE" == "y" || "$OVERWRITE" == "Y" ]]; then
    echo "  Please enter your configuration values."
    echo "  (Press Enter to skip optional fields)"
    echo ""

    read -p "  TELEGRAM_BOT_TOKEN (from @BotFather): " BOT_TOKEN
    while [[ -z "$BOT_TOKEN" ]]; do
        echo -e "  ${RED}✗${NC} Token is required!"
        read -p "  TELEGRAM_BOT_TOKEN: " BOT_TOKEN
    done

    read -p "  TELEGRAM_CHAT_ID (from @userinfobot): " CHAT_ID
    while [[ -z "$CHAT_ID" ]]; do
        echo -e "  ${RED}✗${NC} Chat ID is required!"
        read -p "  TELEGRAM_CHAT_ID: " CHAT_ID
    done

    read -p "  SOLANA_PRIVATE_KEY (Base58): " PRIV_KEY
    while [[ -z "$PRIV_KEY" ]]; do
        echo -e "  ${RED}✗${NC} Private key is required!"
        read -p "  SOLANA_PRIVATE_KEY: " PRIV_KEY
    done

    read -p "  HELIUS_API_KEY (from dev.helius.xyz): " HELIUS_KEY
    while [[ -z "$HELIUS_KEY" ]]; do
        echo -e "  ${RED}✗${NC} Helius key is required!"
        read -p "  HELIUS_API_KEY: " HELIUS_KEY
    done

    read -p "  GROQ_API_KEY (or press Enter for OpenAI/Anthropic): " GROQ_KEY
    if [[ -z "$GROQ_KEY" ]]; then
        read -p "  ANTHROPIC_API_KEY: " ANTHROPIC_KEY
        if [[ -z "$ANTHROPIC_KEY" ]]; then
            read -p "  OPENAI_API_KEY: " OPENAI_KEY
            while [[ -z "$OPENAI_KEY" ]]; do
                echo -e "  ${RED}✗${NC} At least one AI provider is required!"
                read -p "  OPENAI_API_KEY: " OPENAI_KEY
            done
        fi
    fi

    read -p "  JITO_API_KEY (optional, for MEV): " JITO_KEY

    read -p "  Daily Capital (SOL) [default: 1]: " DAILY_CAP
    DAILY_CAP=${DAILY_CAP:-1}

    read -p "  Base Risk % [default: 2]: " BASE_RISK
    BASE_RISK=${BASE_RISK:-2}

    cat > .env << EOF
# TELEGRAM
TELEGRAM_BOT_TOKEN=${BOT_TOKEN}
TELEGRAM_CHAT_ID=${CHAT_ID}

# SOLANA
SOLANA_PRIVATE_KEY=${PRIV_KEY}
HELIUS_API_KEY=${HELIUS_KEY}

# AI PROVIDERS (Fill at least one)
GROQ_API_KEY=${GROQ_KEY}
ANTHROPIC_API_KEY=${ANTHROPIC_KEY}
OPENAI_API_KEY=${OPENAI_KEY}

# AGENT CONFIG
DAILY_CAPITAL=${DAILY_CAP}
BASE_RISK_PERCENT=${BASE_RISK}
ALPHA_MULTIPLIER=1.5
FEE_CAP=0.5

# MEV BOT (Optional)
JITO_API_KEY=${JITO_KEY}
JITO_TIP_LAMPORTS=50000
MEV_ENABLED=false
MEV_MIN_SPREAD_PERCENT=2
MEV_TRADE_SIZE_SOL=0.1

# GENERAL
WHITELIST_MODE=open
EOF

    echo ""
    echo -e "  ${GREEN}✓${NC} .env created"
fi

echo ""

# Step 6: Database Migration
echo -e "${BOLD}Step 6/7: Database setup...${NC}"
echo ""

if [ -f "trades.json" ]; then
    echo -e "  ${YELLOW}⚠ Found trades.json — migrating...${NC}"
    npm run migrate 2>/dev/null || echo -e "  ${YELLOW}⚠ Migration skipped (will run on first start)${NC}"
else
    echo -e "  ${GREEN}✓${NC} No old data to migrate"
fi

echo ""

# Step 7: Build & Verify
echo -e "${BOLD}Step 7/7: Building project...${NC}"
echo ""

npm run build
echo -e "  ${GREEN}✓${NC} Build successful"

echo ""
echo -e "${GREEN}"
echo "  ╔══════════════════════════════════════════════╗"
echo "  ║                                              ║"
echo "  ║      ✅ Setup Complete!                      ║"
echo "  ║                                              ║"
echo "  ╚══════════════════════════════════════════════╝"
echo -e "${NC}"

echo -e "  ${BOLD}Quick Start:${NC}"
echo ""
echo -e "  ${CYAN}Development:${NC}"
echo -e "    npm start"
echo ""
echo -e "  ${CYAN}Production:${NC}"
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
