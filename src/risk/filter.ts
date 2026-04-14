import { logger } from '../utils/logger';
import { checkRugCheck } from '../data/rugcheck';
import { quickSecurityCheck } from '../ai/securityGate';
import { checkGoPlus } from '../data/security';
import { getMarketData } from '../data/market';

interface FilterResult {
  passed: boolean;
  score: number;
  checks: Record<string, boolean>;
  failedReason: string | null;
}

export async function run9LayerFilter(tokenMint: string): Promise<FilterResult> {
  const checks: Record<string, boolean> = {};
  let score = 0;

  try {
    const [rug, gp, mkt] = await Promise.all([
      checkRugCheck(tokenMint),
      checkGoPlus(tokenMint),
      getMarketData(tokenMint),
    ]);

    checks.liquidity_min = (mkt?.liquidityUsd || 0) > 5000; if (checks.liquidity_min) score += 10;
    checks.volume_24h = (mkt?.volume24h || 0) > 10000; if (checks.volume_24h) score += 10;
    checks.no_wash = (mkt?.volume24h || 0) < (mkt?.liquidityUsd || 0) * 50; if (checks.no_wash) score += 10;
    checks.mint_disabled = !rug.mintAuthority; if (checks.mint_disabled) score += 15;
    checks.no_bundle = rug.bundledWallets <= 5; if (checks.no_bundle) score += 15;
    checks.holder_ok = rug.topHolderPercent < 25; if (checks.holder_ok) score += 10;
    checks.not_honeypot = !gp.isHoneypot; if (checks.not_honeypot) score += 15;
    checks.freeze_disabled = !rug.freezeAuthority; if (checks.freeze_disabled) score += 10;
    const mcLiq = (mkt?.marketCap || 0) / (mkt?.liquidityUsd || 1);
    checks.mc_liq_ok = mcLiq > 0 && mcLiq < 50; if (checks.mc_liq_ok) score += 5;

    const passed = score >= 70;
    return { passed, score, checks, failedReason: passed ? null : `SCORE_${score}` };
  } catch (error: any) {
    return { passed: false, score: 0, checks, failedReason: `ERROR: ${error.message}` };
  }
}

