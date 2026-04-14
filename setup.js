const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execSync } = require('child_process');

// Colors for terminal
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

const log = {
  success: (msg) => console.log(`  ${colors.green}✓${colors.reset} ${msg}`),
  warn: (msg) => console.log(`  ${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg) => console.log(`  ${colors.red}✗${colors.reset} ${msg}`),
  info: (msg) => console.log(`  ${colors.cyan}ℹ${colors.reset} ${msg}`),
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

async function runCommand(cmd) {
  try {
    execSync(cmd, { stdio: 'inherit', cwd: process.cwd() });
    return true;
  } catch (error) {
    return false;
  }
}

async function main() {
  console.log('');
  console.log(`${colors.bold}${colors.cyan}╔══════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}║         🍎 KABAYAN AGENT v3.0 SETUP          ║${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}╚══════════════════════════════════════════════╝${colors.reset}`);
  console.log('');

  // Step 1: Check Node.js
  console.log(`${colors.bold}Step 1/6: Checking Node.js...${colors.reset}`);
  console.log('');

  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);

  if (majorVersion < 18) {
    log.error(`Node.js ${nodeVersion} is too old. Please upgrade to v20+`);
    console.log('  Download from: https://nodejs.org/');
    rl.close();
    process.exit(1);
  }
  log.success(`Node.js ${nodeVersion}`);
  log.success(`npm ${require('child_process').execSync('npm --version').toString().trim()}`);
  console.log('');

  // Step 2: Install dependencies
  console.log(`${colors.bold}Step 2/6: Installing dependencies...${colors.reset}`);
  console.log('');

  if (fs.existsSync('node_modules')) {
    log.warn('node_modules exists — reinstalling');
    fs.rmSync('node_modules', { recursive: true, force: true });
    if (fs.existsSync('package-lock.json')) fs.unlinkSync('package-lock.json');
  }

  console.log('  Running npm install... (this may take a minute)');
  const installSuccess = await runCommand('npm install');
  if (!installSuccess) {
    log.error('npm install failed');
    rl.close();
    process.exit(1);
  }
  log.success('Dependencies installed');
  console.log('');

  // Step 3: Create directories
  console.log(`${colors.bold}Step 3/6: Creating directories...${colors.reset}`);
  console.log('');

  const dirs = ['data', 'logs', 'src/assets', 'backtest_results'];
  dirs.forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    log.success(`${dir}/`);
  });
  console.log('');

  // Step 4: Configuration
  console.log(`${colors.bold}Step 4/6: Configuration${colors.reset}`);
  console.log('');

  const envPath = path.join(process.cwd(), '.env');
  let overwrite = true;

  if (fs.existsSync(envPath)) {
    const answer = await ask('  .env already exists. Overwrite? (y/N): ');
    overwrite = answer.toLowerCase() === 'y';
    if (!overwrite) {
      log.success('Keeping existing .env');
    }
  }

  if (!fs.existsSync(envPath) || overwrite) {
    console.log('  Please enter your configuration values.');
    console.log('  (Press Enter to skip optional fields)');
    console.log('');

    // Required fields
    let botToken = '';
    while (!botToken) {
      botToken = await ask('  TELEGRAM_BOT_TOKEN (from @BotFather): ');
      if (!botToken) log.error('Token is required!');
    }

    let chatId = '';
    while (!chatId) {
      chatId = await ask('  TELEGRAM_CHAT_ID (from @userinfobot): ');
      if (!chatId) log.error('Chat ID is required!');
    }

    let privateKey = '';
    while (!privateKey) {
      privateKey = await ask('  SOLANA_PRIVATE_KEY (Base58): ');
      if (!privateKey) log.error('Private key is required!');
    }

    let heliusKey = '';
    while (!heliusKey) {
      heliusKey = await ask('  HELIUS_API_KEY (from dev.helius.xyz): ');
      if (!heliusKey) log.error('Helius key is required!');
    }

    // AI Provider (at least one)
    let groqKey = await ask('  GROQ_API_KEY (recommended, or press Enter): ');
    let anthropicKey = '';
    let openaiKey = '';

    if (!groqKey) {
      anthropicKey = await ask('  ANTHROPIC_API_KEY: ');
      if (!anthropicKey) {
        while (!openaiKey) {
          openaiKey = await ask('  OPENAI_API_KEY: ');
          if (!openaiKey) log.error('At least one AI provider is required!');
        }
      }
    }

    // Optional
    const jitoKey = await ask('  JITO_API_KEY (optional, for MEV bot): ');
    const dailyCap = await ask('  Daily Capital (SOL) [default: 1]: ');
    const baseRisk = await ask('  Base Risk % [default: 2]: ');

    const envContent = `# TELEGRAM
TELEGRAM_BOT_TOKEN=${botToken}
TELEGRAM_CHAT_ID=${chatId}

# SOLANA
SOLANA_PRIVATE_KEY=${privateKey}
HELIUS_API_KEY=${heliusKey}

# AI PROVIDERS (Fill at least one)
GROQ_API_KEY=${groqKey}
ANTHROPIC_API_KEY=${anthropicKey}
OPENAI_API_KEY=${openaiKey}

# AGENT CONFIG
DAILY_CAPITAL=${dailyCap || '1'}
BASE_RISK_PERCENT=${baseRisk || '2'}
ALPHA_MULTIPLIER=1.5
FEE_CAP=0.5

# MEV BOT (Optional)
JITO_API_KEY=${jitoKey}
JITO_TIP_LAMPORTS=50000
MEV_ENABLED=false
MEV_MIN_SPREAD_PERCENT=2
MEV_TRADE_SIZE_SOL=0.1

# GENERAL
WHITELIST_MODE=open
`;

    fs.writeFileSync(envPath, envContent);
    console.log('');
    log.success('.env created');
  }
  console.log('');

  // Step 5: Build
  console.log(`${colors.bold}Step 5/6: Building project...${colors.reset}`);
  console.log('');

  const buildSuccess = await runCommand('npm run build');
  if (!buildSuccess) {
    log.error('Build failed');
    rl.close();
    process.exit(1);
  }
  log.success('Build successful');
  console.log('');

  // Step 6: Done
  console.log(`${colors.bold}Step 6/6: Setup Complete!${colors.reset}`);
  console.log('');
  console.log(`${colors.green}`);
  console.log('  ╔══════════════════════════════════════════════╗');
  console.log('  ║                                              ║');
  console.log('  ║      ✅ Setup Complete!                      ║');
  console.log('  ║                                              ║');
  console.log('  ╚══════════════════════════════════════════════╝');
  console.log(`${colors.reset}`);

  console.log(`  ${colors.bold}Quick Start:${colors.reset}`);
  console.log('');
  console.log(`  ${colors.cyan}Development:${colors.reset}`);
  console.log('    npm start');
  console.log('');
  console.log(`  ${colors.cyan}Production (Linux/Mac):${colors.reset}`);
  console.log('    pm2 start ecosystem.config.js');
  console.log('    pm2 logs kabayan-agent');
  console.log('');
  console.log(`  ${colors.cyan}Production (Windows):${colors.reset}`);
  console.log('    npm run build');
  console.log('    node dist/index.js');
  console.log('');
  console.log(`  ${colors.bold}First Steps:${colors.reset}`);
  console.log('');
  console.log('  1. Open Telegram, send /start to your bot');
  console.log('  2. Type /health to check connection');
  console.log('  3. Type /my_wallet to see wallet');
  console.log('  4. Deposit SOL to the wallet address shown');
  console.log('');

  const startNow = await ask('  Start bot now? (y/N): ');
  if (startNow.toLowerCase() === 'y') {
    console.log('');
    console.log('  Starting bot...');
    console.log('');
    rl.close();
    await runCommand('npm start');
  } else {
    rl.close();
  }
}

main().catch((error) => {
  log.error(`Setup failed: ${error.message}`);
  rl.close();
  process.exit(1);
});
