import { selectFeeMode } from '../ai/feeMode';
import { calculatePositionSize } from '../ai/positionSizer';

describe('Fee Mode Selection', () => {
  test('AGGRESSIVE when token age < 120s', () => {
    expect(selectFeeMode({ tokenAgeSeconds: 60, action: 'BUY', buyTxnsLastBlock: 0, volume1MinSol: 0 })).toBe('AGGRESSIVE');
  });

  test('AGGRESSIVE on SELL', () => {
    expect(selectFeeMode({ tokenAgeSeconds: 999, action: 'SELL', buyTxnsLastBlock: 0, volume1MinSol: 0 })).toBe('AGGRESSIVE');
  });

  test('AGGRESSIVE when buy txns > 10', () => {
    expect(selectFeeMode({ tokenAgeSeconds: 999, action: 'BUY', buyTxnsLastBlock: 15, volume1MinSol: 0 })).toBe('AGGRESSIVE');
  });

  test('NORMAL when volume > 50 SOL/min', () => {
    expect(selectFeeMode({ tokenAgeSeconds: 999, action: 'BUY', buyTxnsLastBlock: 0, volume1MinSol: 60 })).toBe('NORMAL');
  });

  test('SAFE default', () => {
    expect(selectFeeMode({ tokenAgeSeconds: 999, action: 'BUY', buyTxnsLastBlock: 0, volume1MinSol: 10 })).toBe('SAFE');
  });
});

describe('Position Sizing', () => {
  const config = { dailyCapital: 1, baseRiskPercent: 2, alphaMultiplier: 1.5, feeCap: 0.5, circuitBreakerPercent: 15 } as any;

  test('base risk 2%', () => {
    const r = calculatePositionSize(config, false, 0, 0);
    expect(r.sizeSol).toBe(0.02);
    expect(r.riskPercent).toBe(2);
  });

  test('alpha signal 1.5x', () => {
    const r = calculatePositionSize(config, true, 0, 0);
    expect(r.riskPercent).toBe(3);
    expect(r.sizeSol).toBe(0.03);
  });

  test('circuit breaker blocks', () => {
    const r = calculatePositionSize(config, false, -16, 0);
    expect(r.sizeSol).toBe(0);
  });

  test('fee cap applies', () => {
    const bigConfig = { ...config, dailyCapital: 100, baseRiskPercent: 2 };
    const r = calculatePositionSize(bigConfig, false, 0, 0);
    expect(r.sizeSol).toBeLessThanOrEqual(0.5);
  });
});

