import { selectFeeMode } from "../ai/feeMode";
import {
  calculatePositionSize,
  checkCapitalViability,
} from "../ai/positionSizer";

describe("Fee Mode Selection", () => {
  test("SAFE when trade size is below 0.05 SOL", () => {
    expect(
      selectFeeMode({
        tokenAgeSeconds: 10,
        action: "BUY",
        buyTxnsLastBlock: 100,
        volume1MinSol: 100,
        tradeSizeSol: 0.03,
        capitalSol: 1,
      }),
    ).toBe("SAFE");
  });

  test("SAFE when capital is below 0.3 SOL", () => {
    expect(
      selectFeeMode({
        tokenAgeSeconds: 10,
        action: "BUY",
        buyTxnsLastBlock: 100,
        volume1MinSol: 100,
        tradeSizeSol: 0.2,
        capitalSol: 0.2,
      }),
    ).toBe("SAFE");
  });

  test("NORMAL when aggressive conditions met but trade size < 0.20 SOL", () => {
    expect(
      selectFeeMode({
        tokenAgeSeconds: 20,
        action: "BUY",
        buyTxnsLastBlock: 60,
        volume1MinSol: 20,
        tradeSizeSol: 0.1,
        capitalSol: 1,
      }),
    ).toBe("NORMAL");
  });

  test("AGGRESSIVE for hot token with adequate trade size and capital", () => {
    expect(
      selectFeeMode({
        tokenAgeSeconds: 20,
        action: "BUY",
        buyTxnsLastBlock: 60,
        volume1MinSol: 20,
        tradeSizeSol: 0.3,
        capitalSol: 1,
      }),
    ).toBe("AGGRESSIVE");
  });

  test("AGGRESSIVE when age < 30 even if volume is low", () => {
    expect(
      selectFeeMode({
        tokenAgeSeconds: 25,
        action: "BUY",
        buyTxnsLastBlock: 0,
        volume1MinSol: 0,
        tradeSizeSol: 0.25,
        capitalSol: 1,
      }),
    ).toBe("AGGRESSIVE");
  });

  test("NORMAL for medium activity token", () => {
    expect(
      selectFeeMode({
        tokenAgeSeconds: 120,
        action: "BUY",
        buyTxnsLastBlock: 10,
        volume1MinSol: 6,
        tradeSizeSol: 0.4,
        capitalSol: 1,
      }),
    ).toBe("NORMAL");
  });

  test("NORMAL when age < 300", () => {
    expect(
      selectFeeMode({
        tokenAgeSeconds: 250,
        action: "BUY",
        buyTxnsLastBlock: 0,
        volume1MinSol: 0,
        tradeSizeSol: 0.25,
        capitalSol: 1,
      }),
    ).toBe("NORMAL");
  });

  test("SAFE default for low activity token", () => {
    expect(
      selectFeeMode({
        tokenAgeSeconds: 1000,
        action: "BUY",
        buyTxnsLastBlock: 0,
        volume1MinSol: 1,
        tradeSizeSol: 0.4,
        capitalSol: 1,
      }),
    ).toBe("SAFE");
  });
});

describe("Position Sizing", () => {
  const baseConfig = {
    dailyCapital: 1,
    baseRiskPercent: 2,
    alphaMultiplier: 1.5,
    feeCap: 0.5,
    circuitBreakerPercent: 15,
  } as any;

  test("circuit breaker blocks when daily pnl below threshold", () => {
    const r = calculatePositionSize(baseConfig, false, -16, 0, "NORMAL");
    expect(r.sizeSol).toBe(0);
    expect(r.riskPercent).toBe(0);
    expect(r.reason).toBe("CIRCUIT_BREAKER");
  });

  test("alpha multiplier increases risk percent", () => {
    const r = calculatePositionSize(baseConfig, true, 0, 0, "SAFE");
    expect(r.riskPercent).toBe(3);
    expect(r.reason).toContain("ALPHA_1.5X");
  });

  test("returns FEE_RATIO_TOO_HIGH when position too small vs fixed cost", () => {
    const smallConfig = {
      ...baseConfig,
      dailyCapital: 0.5,
      baseRiskPercent: 2,
    } as any;

    const r = calculatePositionSize(smallConfig, false, 0, 0, "NORMAL");
    expect(r.sizeSol).toBe(0);
    expect(r.reason).toBe("FEE_RATIO_TOO_HIGH");
    expect(r.riskPercent).toBe(0);
    expect(r.feeRatioPct).toBeGreaterThanOrEqual(100);
  });

  test("applies fee cap on very large capital", () => {
    const bigConfig = {
      ...baseConfig,
      dailyCapital: 100,
      baseRiskPercent: 2,
      feeCap: 0.5,
    } as any;

    const r = calculatePositionSize(bigConfig, false, 0, 0, "SAFE");
    expect(r.sizeSol).toBe(0.5);
    expect(r.reason).toContain("FEE_CAPPED");
    expect(r.riskPercent).toBe(2);
  });

  test("returns viable position on healthy config", () => {
    const healthy = {
      ...baseConfig,
      dailyCapital: 10,
      baseRiskPercent: 2,
      feeCap: 2,
    } as any;

    const r = calculatePositionSize(healthy, false, 0, 0, "SAFE");
    expect(r.sizeSol).toBeGreaterThan(0);
    expect(r.riskPercent).toBe(2);
    expect(r.reason).toContain("BASE_RISK");
  });
});

describe("Capital Viability", () => {
  test("marks non-viable when fee ratio too high", () => {
    const v = checkCapitalViability(0.2, 2, "NORMAL");
    expect(v.viable).toBe(false);
    expect(v.currentFeeRatio).toBeGreaterThan(20);
    expect(v.recommendation.length).toBeGreaterThan(0);
  });

  test("marks viable when capital is sufficient", () => {
    const v = checkCapitalViability(20, 2, "SAFE");
    expect(v.viable).toBe(true);
    expect(v.currentFeeRatio).toBeLessThanOrEqual(20);
    expect(v.minCapital).toBeGreaterThan(0);
  });

  test("returns very high ratio for zero/near-zero trade scenario", () => {
    const v = checkCapitalViability(0, 2, "SAFE");
    expect(v.currentFeeRatio).toBeGreaterThan(100);
    expect(v.viable).toBe(false);
  });
});
