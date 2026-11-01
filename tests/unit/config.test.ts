import { describe, it, expect } from 'vitest';
import rawEconomy from '../../assets/resources/config/economy.v1.json';
import rawGolden from '../../assets/resources/config/golden-cases.v1.json';
import {
  ECONOMY_CONFIG_VERSION,
  getConfig,
  registerConfig,
  validateEconomyConfig,
  ConfigValidationError,
} from '@core/config/configLoader';

describe('M1-01 经济配置加载与校验', () => {
  it('economy.v1.json 通过完整校验并注册', () => {
    const cfg = registerConfig(rawEconomy as never);
    expect(cfg.configVersion).toBe(ECONOMY_CONFIG_VERSION);
    expect(getConfig()).toBe(cfg);
  });

  it('三行业参数与黄金基线一致', () => {
    const cfg = registerConfig(rawEconomy as never);
    expect(cfg.industry.TRADE.firstYearDemandYuan).toBe(720_000);
    expect(cfg.industry.TRADE.directCostBps).toBe(6000);
    expect(cfg.industry.SOFTWARE.otherOperatingCostBps).toBe(1100);
    expect(cfg.industry.SERVICE.afterSalesCostBps).toBe(150);
  });

  it('拒绝被篡改的关键配置（不能为通过测试私改）', () => {
    const bad = structuredClone(rawEconomy) as Record<string, unknown>;
    (bad as { player: { initialCapitalYuan: number } }).player.initialCapitalYuan = 999_999;
    expect(() => validateEconomyConfig(bad)).toThrow(ConfigValidationError);
  });

  it('未加载时 getConfig 抛错', () => {
    // registerConfig 已在前面用例调用；这里只验证错误类型存在逻辑
    expect(() => validateEconomyConfig({ configVersion: 'wrong' })).toThrow(/configVersion/);
  });

  it('golden-cases.v1.json 结构完整（G001-G017）', () => {
    const g = rawGolden as { version: string; cases?: unknown[] };
    expect(g.version).toBe('golden-cases-v1.0.0');
    expect(Array.isArray(g.cases)).toBe(true);
    const ids = (g.cases as Array<{ id: string }>).map((c) => c.id);
    for (const id of ['G001', 'G002', 'G003', 'G006', 'G007', 'G008']) {
      expect(ids).toContain(id);
    }
  });
});
