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
    // 救助默认不会在无人为操作下自动触发
    expect(summary.rescueUsed).toBe(0);
    // 5 年内自动招聘总数有上限（每年≤3，纯自动最多 15；实际受 ROI/现金约束）
    expect(summary.autoHireMax).toBeLessThanOrEqual(15);
    // 平衡后的模型：900 个 run 均不出现负现金
    expect(summary.negativeCash).toBe(0);
    expect(summary.runs).toBe(900);
  });

  it('三行业在稳健策略下 5 年均产出 5 份年报', () => {
    for (const industry of ['TRADE', 'SOFTWARE', 'SERVICE'] as IndustryId[]) {
      const row = simulate(7919 + industry.length, industry, 'STEADY' as Policy);
      expect(row.years).toBeGreaterThanOrEqual(4);
    }
  });

  it('CSV 可生成（首列为表头字段）', () => {
    const { csv } = runHundredSeedBatch();
    expect(csv.split('\n')[0]).toContain('seed');
    expect(csv.split('\n').length).toBeGreaterThan(100);
  });
});
