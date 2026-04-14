import fs from 'fs';
import path from 'path';
import { logger } from './logger';

interface CheckResult {
  name: string;
  passed: boolean;
  message: string;
}

export async function runPrelaunchCheck(): Promise<boolean> {
  const results: CheckResult[] = [];

  results.push({
    name: '.env file',
    passed: fs.existsSync(path.join(process.cwd(), '.env')),
    message: fs.existsSync(path.join(process.cwd(), '.env')) ? 'Found' : 'Missing — run setup.sh',
  });

  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  results.push({ name: 'data/ directory', passed: true, message: 'Ready' });

  const logsDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
  results.push({ name: 'logs/ directory', passed: true, message: 'Ready' });

  const assetsDir = path.join(process.cwd(), 'src', 'assets');
  if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });
  results.push({ name: 'src/assets/ directory', passed: true, message: 'Ready' });

  logger.info('=== Pre-launch Check ===');
  let allPassed = true;

  for (const r of results) {
    const icon = r.passed ? '✅' : '❌';
    logger.info(`${icon} ${r.name}: ${r.message}`);
    if (!r.passed) allPassed = false;
  }

  logger.info('========================');
  return allPassed;
}

