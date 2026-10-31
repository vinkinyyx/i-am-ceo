import { describe, it, expect } from 'vitest';
import { Rng, deriveSeed } from '@core/simulation/rng';
import { applyBps, roundHalfUp, formatWan } from '@core/domain/money';
import { GameError, GameErrorCode } from '@core/domain/errors';

describe('rng determinism', () => {
  it('相同 seed 产生相同序列，命名空间流相互独立', () => {
    const a = new Rng(12345);
    const b = new Rng(12345);
    expect([a.nextInt(0, 99), a.nextInt(0, 99), a.nextInt(0, 99)]).toEqual([
      b.nextInt(0, 99),
      b.nextInt(0, 99),
      b.nextInt(0, 99),
    ]);
    const market1 = new Rng(1).derive('market');
    const market2 = new Rng(1).derive('market');
    const name1 = new Rng(1).derive('companyName');
    expect(market1.nextInt(0, 1e9)).toBe(market2.nextInt(0, 1e9));
    // 不同命名空间序列不同（概率上稳定，因派生 hash 确定）
    expect(name1.nextInt(0, 1e9)).not.toBe(market1.nextInt(0, 1e9));
  });

  it('deriveSeed 稳定', () => {
    expect(deriveSeed('run', 1, 'event')).toBe(deriveSeed('run', 1, 'event'));
  });
});

describe('money rounding', () => {
  it('bps 基点乘法 half-up 且跨平台一致', () => {
    expect(applyBps(720_000, 6000)).toBe(432_000);
    expect(applyBps(1235, 5000)).toBe(618); // 617.5 -> 618
    expect(applyBps(-1000, 800)).toBe(-80);
    expect(roundHalfUp(-2.5)).toBe(-3);
    expect(formatWan(338000)).toBe('33.80');
  });
});

describe('GameError', () => {
  it('错误码文案支持占位符', () => {
    const e = new GameError(GameErrorCode.INSUFFICIENT_CASH);
    expect(e.toDisplayMessage({ gap: 1200 })).toBe('当前现金不足，还需要 ¥1200。');
  });
});
