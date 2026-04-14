import { logger } from '../utils/logger';
import { getMarketData } from '../data/market';

interface EmergencyCheck {
  triggered: boolean;
  reason: string | null;
  description: string;
}

// Cache untuk cegah spam check pada mint yang sama
const recentlyChecked: Map<string, number> = new Map();
const CHECK_COOLDOWN_MS = 10_000;

export async function checkLiquidityDrained(mint: string): Promise<EmergencyCheck> {
  try {
    const mkt = await getMarketData(mint);
    const sol = mkt?.liquiditySol || 0;
    if (sol < 5) {
      logger.warn(`[EMERGENCY] LIQUIDITY_DRAINED: ${sol.toFixed(2)} SOL`);
      return { triggered: true, reason: 'LIQUIDITY_DRAINED', description: `Pool ${sol.toFixed(2)} SOL — di bawah minimum 5 SOL` };
    }
    return { triggered: false, reason: null, description: '' };
  } catch {
    return { triggered: false, reason: null, description: '' };
  }
}

export async function checkRugDetected(mint: string, deployer: string): Promise<EmergencyCheck> {
  if (!deployer || deployer.length < 32) {
    return { triggered: false, reason: null, description: '' };
  }

  // Rate limit: jangan check terlalu sering
  const lastCheck = recentlyChecked.get('rug_' + mint);
  if (lastCheck && Date.now() - lastCheck < CHECK_COOLDOWN_MS) {
    return { triggered: false, reason: null, description: '' };
  }
  recentlyChecked.set('rug_' + mint, Date.now());

  try {
    const market = await getMarketData(mint);
    if (!market) return { triggered: false, reason: null, description: '' };

    // Deteksi 1: Likuiditas turun drastis (> 70% drop dari 24h high)
    // DexScreener tidak expose liquidity history, tapi kita bisa cek
    // apakah liquidity sangat rendah relatif terhadap volume 24h
    const liqSol = market.liquiditySol;
    const vol24h = market.volume24h;

    // Jika liquidity < 10 SOL DAN ada volume signifikan = possible rug
    if (liqSol < 10 && vol24h > 1000) {
      logger.warn(`[EMERGENCY] RUG_SUSPECTED: liq=${liqSol.toFixed(2)} SOL, vol=$${vol24h.toFixed(0)}`);
      return {
        triggered: true,
        reason: 'RUG_DETECTED',
        description: `Liquidity ${liqSol.toFixed(2)} SOL dengan volume $${vol24h.toFixed(0)} — indikasi rug`,
      };
    }

    // Deteksi 2: Liquidity mendekati nol
    if (liqSol < 2) {
      logger.warn(`[EMERGENCY] NEAR_ZERO_LIQUIDITY: ${liqSol.toFixed(4)} SOL`);
      return {
        triggered: true,
        reason: 'RUG_DETECTED',
        description: `Liquidity hampir nol: ${liqSol.toFixed(4)} SOL`,
      };
    }

    return { triggered: false, reason: null, description: '' };
  } catch (e: any) {
    logger.warn('[EMERGENCY] checkRugDetected error: ' + e.message);
    return { triggered: false, reason: null, description: '' };
  }
}

export async function checkInsiderDump(mint: string): Promise<EmergencyCheck> {
  // Rate limit
  const lastCheck = recentlyChecked.get('dump_' + mint);
  if (lastCheck && Date.now() - lastCheck < CHECK_COOLDOWN_MS) {
    return { triggered: false, reason: null, description: '' };
  }
  recentlyChecked.set('dump_' + mint, Date.now());

  try {
    const market = await getMarketData(mint);
    if (!market) return { triggered: false, reason: null, description: '' };

    // Deteksi dump via price action:
    // Jika volume 1 menit sangat tinggi tapi harga turun tajam = sell dump
    // Kita bandingkan price sol vs market cap sebagai proxy
    const priceSOL = market.priceSol;
    const mcap = market.marketCap;
    const vol1m = market.volume1MinSol;

    // Volume 1 menit > 10% dari market cap = distribusi besar
    if (mcap > 0 && vol1m > 0) {
      const vol1mUsd = vol1m * 150; // estimasi SOL price ~$150
      const volToMcap1m = vol1mUsd / mcap;

      if (volToMcap1m > 0.1 && priceSOL > 0) {
        logger.warn(
          `[EMERGENCY] HIGH_SELL_PRESSURE: vol1m=${vol1m.toFixed(3)} SOL (${(volToMcap1m * 100).toFixed(1)}% of mcap)`
        );
        return {
          triggered: true,
          reason: 'INSIDER_DUMP',
          description: `Volume 1 menit ${(volToMcap1m * 100).toFixed(1)}% dari market cap — kemungkinan distribusi besar`,
        };
      }
    }

    return { triggered: false, reason: null, description: '' };
  } catch (e: any) {
    logger.warn('[EMERGENCY] checkInsiderDump error: ' + e.message);
    return { triggered: false, reason: null, description: '' };
  }
}

export async function runAllEmergencyChecks(mint: string, deployer: string): Promise<EmergencyCheck> {
  const checks = await Promise.all([
    checkLiquidityDrained(mint),
    checkRugDetected(mint, deployer),
    checkInsiderDump(mint),
  ]);
  for (const c of checks) {
    if (c.triggered) return c;
  }
  return { triggered: false, reason: null, description: '' };
}
