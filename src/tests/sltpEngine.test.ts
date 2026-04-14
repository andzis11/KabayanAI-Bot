import { createPosition, monitorPosition } from "../ai/sltpEngine";

describe("SLTP Engine (monitorPosition)", () => {
  test("createPosition sets expected defaults", () => {
    const pos = createPosition(
      "TESTMINT123",
      0.001,
      1000,
      1.0,
      "NORMAL",
      false,
    );

    expect(pos.tokenMint).toBe("TESTMINT123");
    expect(pos.entryPrice).toBe(0.001);
    expect(pos.amount).toBe(1000);
    expect(pos.amountSol).toBe(1.0);
    expect(pos.feeMode).toBe("NORMAL");
    expect(pos.isMoonbag).toBe(false);
    expect(pos.trailingActive).toBe(false);
    expect(pos.tp1Target).toBeCloseTo(0.001775, 10);
    expect(pos.initialSL).toBeCloseTo(0.0008, 10);
  });

  test("trailing activates when price reaches activation threshold", () => {
    const pos = createPosition("TRAILMINT", 0.001, 1000, 1.0, "NORMAL", false);
    const activationPrice = pos.trailingActivation;

    const result = monitorPosition(pos, activationPrice);

    expect(result.action).toBe("HOLD");
    expect(result.updatedPosition.trailingActive).toBe(true);
    expect(result.updatedPosition.peak).toBe(activationPrice);
    expect(result.updatedPosition.initialSL).toBeGreaterThan(pos.initialSL);
  });

  test("hard SL exits full position when price drops below initialSL", () => {
    const pos = createPosition("SLMINT", 0.001, 1000, 1.0, "NORMAL", false);
    const priceBelowSL = pos.initialSL * 0.99;

    const result = monitorPosition(pos, priceBelowSL);

    expect(result.action).toBe("SELL");
    expect(result.sellPercent).toBe(1.0);
    expect(result.reason).toBe("HARD_SL");
  });

  test("TP1 triggers moonbag mode and sells 90%", () => {
    const pos = createPosition("TPMINT", 0.001, 1000, 1.0, "NORMAL", false);
    const tp1Price = pos.tp1Target;

    const result = monitorPosition(pos, tp1Price);

    expect(result.action).toBe("TP1");
    expect(result.sellPercent).toBe(0.9);
    expect(result.reason).toBe("TP1_SECURED");
    expect(result.updatedPosition.isMoonbag).toBe(true);
    expect(result.updatedPosition.moonbagSL).toBeGreaterThan(0);
  });

  test("moonbag exits when price falls below moonbagSL", () => {
    const pos = createPosition("MOONMINT", 0.001, 1000, 1.0, "NORMAL", false);

    const tp1Result = monitorPosition(pos, pos.tp1Target);
    expect(tp1Result.updatedPosition.isMoonbag).toBe(true);

    const moonbagPos = tp1Result.updatedPosition;
    const exitPrice = moonbagPos.moonbagSL * 0.99;

    const exitResult = monitorPosition(moonbagPos, exitPrice);

    expect(exitResult.action).toBe("SELL");
    expect(exitResult.sellPercent).toBe(1.0);
    expect(exitResult.reason).toBe("MOONBAG_EXIT");
  });

  test("returns HOLD while still monitoring and no rule is triggered", () => {
    const pos = createPosition("HOLDMINT", 0.001, 1000, 1.0, "NORMAL", false);
    const neutralPrice = 0.00105;

    const result = monitorPosition(pos, neutralPrice);

    expect(result.action).toBe("HOLD");
    expect(result.sellPercent).toBe(0);
    expect(result.reason).toBe("MONITORING");
    expect(result.updatedPosition.isMoonbag).toBe(false);
  });

  test("alpha flag is stored in created position", () => {
    const alphaPos = createPosition(
      "ALPHAMINT",
      0.002,
      500,
      0.5,
      "AGGRESSIVE",
      true,
    );

    expect(alphaPos.alphaSignal).toBe(true);
    expect(alphaPos.feeMode).toBe("AGGRESSIVE");
  });
});
