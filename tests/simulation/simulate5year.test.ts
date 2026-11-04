import { describe, it, expect } from 'vitest';
import { runHundredSeedBatch, summarize, simulate } from '../../tools/simulate5year';
import type { IndustryId, Policy } from '../../assets/core/domain/types';

/**
 * M3-06 百种子 5 年批量模拟（设计 9.6）。
 * 关注：不出现负现金、财务守恒、无重复救助、无同年多事件、不全员被自动招聘。
 */
describe('百种子 × 三行业 × 三策略 5 年模拟', () => {
  it('全部 900 个 run 财务守恒、现金不为负、无重复救助、每年≤3自动招聘', () => {
    const { rows } = runHundredSeedBatch();
    const summary = summarize(rows);

    expect(rows).toHaveLength(100 * 3 * 3);
    // 财务守恒（年利润=月利润和）必须全部成立
    expect(summary.conservationFail).toBe(0);
    expect(summary.cashDeltaFail).toBe(0);
    expect(summary.annualCashBridgeFail).toBe(0);
    // 救助默认不会在无人为操作下自动触发
    expect(summary.rescueUsed).toBe(0);
    // 按真实年/月逐项检查，不使用总数≤15代替年度规则。
    expect(summary.maxAutoHiresInYear).toBeLessThanOrEqual(3);
    expect(summary.maxAutoHiresInMonth).toBeLessThanOrEqual(1);
    expect(rows.every((row) => row.complete60Months && row.monthsSimulated === 60 && row.stopReason === 'COMPLETED_60_MONTHS')).toBe(true);
    expect(rows.every((row) => /^[a-f0-9]{16}$/.test(row.configHash))).toBe(true);
    expect(rows.every((row) => Object.values(row.autoHiresByYear).every((count) => count <= 3))).toBe(true);
    // 平衡后的模型：900 个 run 均不出现负现金
    expect(summary.negativeCash).toBe(0);
    expect(summary.runs).toBe(900);
  });

  it('三行业稳健策略按实际结算月份产出完整冻结年报', () => {
    for (const industry of ['TRADE', 'SOFTWARE', 'SERVICE'] as IndustryId[]) {
      const row = simulate(7919 + industry.length, industry, 'STEADY' as Policy);
      expect(row.monthsSimulated).toBe(60);
      expect(row.complete60Months).toBe(true);
      expect(row.years).toBe(5);
      expect(row.stopReason).toBe('COMPLETED_60_MONTHS');
      expect(row.conservationHeld).toBe(true);
      expect(row.cashDeltaHeld).toBe(true);
      expect(row.annualCashBridgeHeld).toBe(true);
    }
  });

  it('CSV 可生成（首列为表头字段）', () => {
    const { csv } = runHundredSeedBatch();
    expect(csv.split('\n')[0]).toContain('seed');
    expect(csv.split('\n').length).toBeGreaterThan(100);
  });
});
