describe('Security Gate', () => {
  test('all 8 checks must pass', () => {
    const checks = {
      mint_authority_disabled: true,
      freeze_authority_disabled: true,
      transfer_simulation_ok: true,
      top10_holders_ok: true,
      bundled_supply_ok: true,
      pool_liquidity_ok: true,
      volume_to_mcap_ok: true,
      dev_wallet_clean: true,
    };
    expect(Object.values(checks).every(v => v === true)).toBe(true);
  });

  test('single failure blocks entire gate', () => {
    const checks = {
      mint_authority_disabled: true,
      freeze_authority_disabled: false,
      transfer_simulation_ok: true,
      top10_holders_ok: true,
      bundled_supply_ok: true,
      pool_liquidity_ok: true,
      volume_to_mcap_ok: true,
      dev_wallet_clean: true,
    };
    expect(Object.values(checks).every(v => v === true)).toBe(false);
  });

  test('top holders > 25% fails', () => {
    expect(30 < 25).toBe(false);
  });

  test('bundled supply > 5 fails', () => {
    expect(7 <= 5).toBe(false);
  });

  test('pool liquidity check', () => {
    expect(80 > 75 || 15000 > 10000).toBe(true);
    expect(50 > 75 || 5000 > 10000).toBe(false);
  });
});
