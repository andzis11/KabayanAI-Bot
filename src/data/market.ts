import axios from "axios";
import { logger } from "../utils/logger";
import { withRateLimit } from "../security/apiRateLimit";
import { ENV } from "../config/env";

export interface MarketData {
  tokenMint: string;
  priceUsd: number;
  priceSol: number;
  liquiditySol: number;
  liquidityUsd: number;
  volume24h: number;
  volume1MinSol: number;
  volumeToMcap24h: number;
  marketCap: number;
  pairAddress: string;
  pairCreatedAt: number;
  dexId: string;
}

export async function getMarketData(
  tokenMint: string,
): Promise<MarketData | null> {
  try {
    const response = await withRateLimit("dexscreener", () =>
      axios.get(`${ENV.DEXSCREENER_API}${tokenMint}`, {
        timeout: 10000,
      }),
    );

    const pairs = response.data?.pairs;
    if (!pairs || pairs.length === 0) return null;

    const pair = pairs.sort(
      (a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0),
    )[0];

    return {
      tokenMint,
      priceUsd: parseFloat(pair.priceUsd || "0"),
      priceSol: parseFloat(pair.priceNative || "0"),
      liquiditySol: parseFloat(pair.liquidity?.base || "0"),
      liquidityUsd: parseFloat(pair.liquidity?.usd || "0"),
      volume24h: parseFloat(pair.volume?.h24 || "0"),
      volume1MinSol: parseFloat(pair.volume?.m1 || "0"),
      volumeToMcap24h:
        parseFloat(pair.volume?.h24 || "0") / parseFloat(pair.fdv || "1"),
      marketCap: parseFloat(pair.fdv || "0"),
      pairAddress: pair.pairAddress,
      pairCreatedAt: pair.pairCreatedAt || 0,
      dexId: pair.dexId || "unknown",
    };
  } catch (error: any) {
    logger.error(`[MARKET] Error: ${error.message}`);
    return null;
  }
}

export async function getTokenPrice(tokenMint: string): Promise<number | null> {
  const data = await getMarketData(tokenMint);
  return data?.priceSol || null;
}
