import { quickSecurityCheck } from "../ai/securityGate";

describe("quickSecurityCheck", () => {
  test("returns true when all checks are safe", () => {
    const result = quickSecurityCheck(false, false, true);
    expect(result).toBe(true);
  });

  test("returns false when freeze authority is enabled", () => {
    const result = quickSecurityCheck(true, false, true);
    expect(result).toBe(false);
  });

  test("returns false when mint authority is enabled", () => {
    const result = quickSecurityCheck(false, true, true);
    expect(result).toBe(false);
  });

  test("returns false when liquidity is not locked", () => {
    const result = quickSecurityCheck(false, false, false);
    expect(result).toBe(false);
  });

  test("returns false when freeze and mint are both enabled", () => {
    const result = quickSecurityCheck(true, true, true);
    expect(result).toBe(false);
  });

  test("returns false when all risk flags are bad", () => {
    const result = quickSecurityCheck(true, true, false);
    expect(result).toBe(false);
  });

  test("fails if any single condition fails", () => {
    const combinations: Array<[boolean, boolean, boolean]> = [
      [true, false, true],
      [false, true, true],
      [false, false, false],
    ];

    for (const [hasFreeze, hasMint, liquidityLocked] of combinations) {
      expect(quickSecurityCheck(hasFreeze, hasMint, liquidityLocked)).toBe(
        false,
      );
    }
  });

  test("is deterministic for same input", () => {
    expect(quickSecurityCheck(false, false, true)).toBe(true);
    expect(quickSecurityCheck(false, false, true)).toBe(true);
  });
});
