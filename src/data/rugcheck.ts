import axios from "axios";
import { logger } from "../utils/logger";
import { withRateLimit } from "../security/apiRateLimit";

export interface RugCheckData {
  mintAuthority: boolean;
  freezeAuthority: boolean;
  topHolderPercent: number;
  bundledWallets: number;
  score: number;
  riskLevel: string;
}

export async function checkRugCheck(tokenMint: string): Promise<RugCheckData> {
  try {
    const response = await withRateLimit("rugcheck", () =>
      axios.get(`https://api.rugcheck.xyz/v1/tokens/${tokenMint}/report`, {
        timeout: 10000,
      }),
    );

    const data = response.data;
    const topHolders = data.topHolders || [];
    const totalSupply = data.token?.supply || 1;
    const decimals = data.token?.decimals || 9;
    const supplyNum = Number(totalSupply) / Math.pow(10, decimals);

    let topHolderPercent = 0;
    if (topHolders.length > 0 && supplyNum > 0) {
      const top10 = topHolders
        .slice(0, 10)
        .reduce((s: number, h: any) => s + Number(h.amount || 0), 0);
      topHolderPercent = (top10 / supplyNum) * 100;
    }

    return {
      mintAuthority:
        data.mintAuthority !== null && data.mintAuthority !== undefined,
      freezeAuthority:
        data.freezeAuthority !== null && data.freezeAuthority !== undefined,
      topHolderPercent,
      bundledWallets:
        data.risks?.filter(
          (r: any) =>
            r.name?.toLowerCase().includes("bundled") ||
            r.name?.toLowerCase().includes("cluster"),
        )?.length || 0,
      score: data.score || 0,
      riskLevel: data.riskLevel || "unknown",
    };
  } catch (error: any) {
    const is400 = error.response?.status === 400;
    const is404 = error.response?.status === 404;

    // For 400/404 errors, token likely doesn't exist yet or is too new
    if (is400 || is404) {
      logger.warn(
        `[RUGCHECK] Token ${tokenMint.slice(0, 8)}... not found (${error.response?.status}) - likely too new`,
      );
      return {
        mintAuthority: false, // Pump.fun tokens typically have mint disabled
        freezeAuthority: false,
        topHolderPercent: 0,
        bundledWallets: 0,
        score: 50, // Mid-range score for unknown tokens
        riskLevel: "unknown_new_token",
      };
    }

    logger.error(`[RUGCHECK] Error: ${error.message}`);
    return {
      mintAuthority: false, // More lenient - assume Pump.fun standard
      freezeAuthority: false,
      topHolderPercent: 0,
      bundledWallets: 0,
      score: 50, // Better than worst case
      riskLevel: "unknown",
    };
  }
}
