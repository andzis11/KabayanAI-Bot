import axios from 'axios';
import { logger } from '../utils/logger';

export interface HoneypotResult {
  isHoneypot: boolean;
  canBuy: boolean;
  canSell: boolean;
  buyTax: number;
  sellTax: number;
  totalTax: number;
  maxSellPercent: number;
  reason: string;
  details: {
    buyQuoteOk: boolean;
    sellQuoteOk: boolean;
    sellRouteFound: boolean;
    highTax: boolean;
    maxSellLimited: boolean;
  };
}

const SOL_MINT = 'So11111111111111111111111111111111111111112';
const TEST_AMOUNT = Math.round(0.01 * 1e9);

async function getQuote(inputMint: string, outputMint: string, amount: number, slippageBps: number): Promise<any> {
  const res = await axios.get('https://quote-api.jup.ag/v6/quote', {
    params: { inputMint, outputMint, amount, slippageBps },
    timeout: 10000,
  });
  return res.data;
}

export async function deepHoneypotCheck(tokenMint: string): Promise<HoneypotResult> {
  const result: HoneypotResult = {
    isHoneypot: false,
    canBuy: true,
    canSell: true,
    buyTax: 0,
    sellTax: 0,
    totalTax: 0,
    maxSellPercent: 100,
    reason: 'OK',
    details: {
      buyQuoteOk: false,
      sellQuoteOk: false,
      sellRouteFound: false,
      highTax: false,
      maxSellLimited: false,
    },
  };

  try {
    let tokensReceived = 0;

    // TEST 1: BUY
    try {
      const buyQuote = await getQuote(SOL_MINT, tokenMint, TEST_AMOUNT, 500);
      tokensReceived = parseInt(buyQuote.outAmount || '0');
      if (tokensReceived <= 0) {
        result.canBuy = false;
        result.isHoneypot = true;
        result.reason = 'CANNOT_BUY';
        return result;
      }
      result.details.buyQuoteOk = true;
    } catch (err: any) {
      if (err.message && err.message.includes('Could not find any route')) {
        result.canBuy = false;
        result.isHoneypot = true;
        result.reason = 'NO_BUY_ROUTE';
        return result;
      }
    }

    if (tokensReceived <= 0) {
      result.reason = 'ZERO_TOKENS_RECEIVED';
      return result;
    }

    // TEST 2: SELL
    try {
      const sellQuote = await getQuote(tokenMint, SOL_MINT, tokensReceived, 5000);
      const solBack = parseInt(sellQuote.outAmount || '0');
      if (solBack <= 0) {
        result.canSell = false;
        result.isHoneypot = true;
        result.reason = 'CANNOT_SELL';
        return result;
      }
      result.details.sellQuoteOk = true;
      result.details.sellRouteFound = true;

      const totalLoss = TEST_AMOUNT - solBack;
      const totalTaxPct = (totalLoss / TEST_AMOUNT) * 100;
      result.totalTax = Math.max(0, totalTaxPct);
      result.buyTax = result.totalTax * 0.4;
      result.sellTax = result.totalTax * 0.6;

      if (totalTaxPct > 50) {
        result.isHoneypot = true;
        result.details.highTax = true;
        result.reason = 'HIGH_TAX_' + totalTaxPct.toFixed(0) + '%';
        return result;
      }
    } catch (err: any) {
      if (err.message && err.message.includes('Could not find any route')) {
        result.canSell = false;
        result.isHoneypot = true;
        result.details.sellRouteFound = false;
        result.reason = 'NO_SELL_ROUTE';
        return result;
      }
      result.details.sellQuoteOk = false;
    }

    // TEST 3: MAX SELL
    try {
      const testAmt = Math.round((tokensReceived * 75) / 100);
      const smallSell = await getQuote(tokenMint, SOL_MINT, testAmt, 5000);
      if (smallSell.outAmount && parseInt(smallSell.outAmount) > 0) {
        result.maxSellPercent = 100;
      }
    } catch {
      result.maxSellPercent = 25;
      result.details.maxSellLimited = true;
      result.reason = 'MAX_SELL_LIMITED';
    }

    logger.info('[HONEYPOT] OK ' + tokenMint.slice(0, 8) + '... Tax: ' + result.totalTax.toFixed(1) + '%');
    return result;
  } catch (error: any) {
    result.reason = 'CHECK_ERROR: ' + error.message;
    return result;
  }
}

export async function quickHoneypotCheck(tokenMint: string): Promise<boolean> {
  try {
    const res = await deepHoneypotCheck(tokenMint);
    return !res.isHoneypot;
  } catch {
    return false;
  }
}
