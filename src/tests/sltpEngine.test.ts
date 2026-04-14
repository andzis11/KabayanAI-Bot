import { createPosition, updateTrailingStop, checkTakeProfit } from '../ai/sltpEngine';
import { Position } from '../ai/types';

describe('SLTPEngine', () => {
  test('createPosition sets correct fields', () => {
    const pos = createPosition('TESTMINT123', 0.001, 1000, 1.0, 'NORMAL', false);
    expect(pos.tokenMint).toBe('TESTMINT123');
    expect(pos.entryPrice).toBe(0.001);
    expect(pos.amount).toBe(1000);
    expect(pos.amountSol).toBe(1.0);
    expect(pos.feeMode).toBe('NORMAL');
    expect(pos.isMoonbag).toBe(false);
    expect(pos.trailingActive).toBe(false);
  });

  test('createPosition moonbag sets moonbag flag', () => {
    const pos = createPosition('MOONMINT', 0.002, 500, 0.5, 'AGGRESSIVE', true);
    expect(pos.isMoonbag).toBe(true);
    expect(pos.feeMode).toBe('AGGRESSIVE');
  });

  test('updateTrailingStop activates when price rises', () => {
    const pos = createPosition('TRAILMINT', 0.001, 1000, 1.0, 'NORMAL', false);
    const currentPrice = 0.0015;
    const updated = updateTrailingStop(pos, currentPrice, 0.08);
    expect(updated.trailingActive).toBe(true);
    expect(updated.trailingStop).toBeGreaterThan(0);
  });

  test('updateTrailingStop does not activate when price drops', () => {
    const pos = createPosition('DROPMINT', 0.001, 1000, 1.0, 'NORMAL', false);
    const currentPrice = 0.0008;
    const updated = updateTrailingStop(pos, currentPrice, 0.08);
    expect(updated.trailingActive).toBe(false);
  });

  test('checkTakeProfit detects TP1', () => {
    const pos = createPosition('TPMINT', 0.001, 1000, 1.0, 'NORMAL', false);
    pos.tp1Target = 0.00135;
    const currentPrice = 0.0014;
    const result = checkTakeProfit(pos, currentPrice);
    expect(result.tp1Hit).toBe(true);
  });

  test('checkTakeProfit detects TP2', () => {
    const pos = createPosition('TP2MINT', 0.001, 1000, 1.0, 'NORMAL', false);
    pos.tp2Target = 0.0018;
    const currentPrice = 0.0019;
    const result = checkTakeProfit(pos, currentPrice);
    expect(result.tp2Hit).toBe(true);
  });

  test('checkTakeProfit no TP when price below targets', () => {
    const pos = createPosition('NOTPMINT', 0.001, 1000, 1.0, 'NORMAL', false);
    pos.tp1Target = 0.00135;
    pos.tp2Target = 0.0018;
    const currentPrice = 0.0011;
    const result = checkTakeProfit(pos, currentPrice);
    expect(result.tp1Hit).toBe(false);
    expect(result.tp2Hit).toBe(false);
  });
});
