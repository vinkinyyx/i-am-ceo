import type { EconomyConfig } from './EconomyConfig';
import { INDUSTRIES, type IndustryId } from '../domain/types';

/**
 * 经济配置加载与校验（设计文档 01.3 / 04 / 10.3）。
 * 纯 TS：由调用方注入 JSON 对象（测试 import JSON、Cocos 用 resources.load 后传入）。
 * 校验失败立即抛错，禁止带错误参数跑经营模拟（AGENT.md：不能为通过测试私改配置）。
 */
export const ECONOMY_CONFIG_VERSION = 'economy-v1.0.0';

export class ConfigValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigValidationError';
  }
}

function assert(cond: boolean, message: string): void {
  if (!cond) throw new ConfigValidationError(message);
}

export function validateEconomyConfig(cfg: unknown): EconomyConfig {
  assert(typeof cfg === 'object' && cfg !== null, 'config must be object');
  const c = cfg as EconomyConfig;
  assert(c.configVersion === ECONOMY_CONFIG_VERSION, `bad configVersion: ${String(c.configVersion)}`);
  assert(c.currency === 'CNY', 'currency must be CNY');
  assert(c.ratioUnit === 'bps', 'ratioUnit must be bps');

  assert(c.player?.initialCapitalYuan === 300_000, 'initialCapital must be 300000');
  assert(c.player?.initialEmployeeCount === 2, 'initialEmployeeCount must be 2');
  assert(c.player?.continuousProfitYearsForGoal === 3, 'goal years must be 3');

  assert(c.time?.monthsPerYear === 12, 'monthsPerYear must be 12');
  assert(c.time?.onlineYearDurationMsAt1x === 300_000, '1x year must be 300000ms');
  assert(
    JSON.stringify(c.time?.onlineSpeedMultipliers) === JSON.stringify([1, 2, 5]),
    'speed multipliers must be [1,2,5]',
  );
  assert(c.time?.offlineRealMsPerGameMonth === 2_400_000, 'offline month must be 40min');
  assert(c.time?.maxOfflineMonthsPerSession === 36, 'offline cap must be 36');

  assert(c.recruitment?.candidateCount === 3, 'candidate count must be 3');
  assert(c.recruitment?.salaryMonthlyYuanMin === 4000, 'salary min 4000');
  assert(c.recruitment?.salaryMonthlyYuanMax === 8000, 'salary max 8000');
  assert(c.departments?.setupFeeYuan === 10_000, 'dept setup fee 10000');

  for (const id of INDUSTRIES) {
    const ind = c.industry?.[id];
    assert(!!ind, `missing industry ${id}`);
    assert(ind.firstYearDemandYuan > 0, `${id} demand > 0`);
    assert(
      ind.baseAnnualCapacityPerSkill60EmployeeYuan > 0,
      `${id} capacity > 0`,
    );
    assert(ind.directCostBps > 0 && ind.directCostBps < 10_000, `${id} direct bps range`);
    assert(ind.fixedManagementAnnualYuan === 48_000, `${id} fixed cost 48000`);
  }

  // 黄金首年值硬校验（防止配置被误改）
  assert(c.industry.TRADE.firstYearDemandYuan === 720_000, 'TRADE demand 720000');
  assert(
    c.industry.TRADE.baseAnnualCapacityPerSkill60EmployeeYuan === 400_000,
    'TRADE per-capacity 400000',
  );
  assert(c.industry.SOFTWARE.firstYearDemandYuan === 400_000, 'SOFTWARE demand 400000');
  assert(c.industry.SERVICE.firstYearDemandYuan === 450_000, 'SERVICE demand 450000');

  assert(c.risk?.oneTimeRescueCapitalYuan === 100_000, 'rescue 100000');
  assert(c.risk?.eventAnnualChanceBps === 2500, 'event chance 25%');
  assert(c.save?.schemaVersion === 1, 'schema v1');
  assert(c.save?.targetMaxBytesPerSlot === 500_000, 'save slot 500KB');
  assert(c.localBots?.count === 12, '12 bots');
  assert(c.ui?.designWidthLogicalPx === 375 && c.ui?.designHeightLogicalPx === 812, 'ui 375x812');

  return c;
}

let cached: EconomyConfig | null = null;

export function registerConfig(cfg: EconomyConfig): EconomyConfig {
  cached = validateEconomyConfig(cfg);
  return cached;
}

export function getConfig(): EconomyConfig {
  if (!cached) throw new ConfigValidationError('economy config not loaded');
  return cached;
}

export function industryConfig(cfg: EconomyConfig, id: IndustryId) {
  const ind = cfg.industry[id];
  if (!ind) throw new ConfigValidationError(`no config for industry ${id}`);
  return ind;
}
