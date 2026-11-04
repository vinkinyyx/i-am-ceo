import type { EconomyConfig } from '../config/EconomyConfig';
import { Rng, deriveSeed } from './rng';
import type { AnnualEvent, AnnualEventType, Employee, GameState } from '../domain/types';
import { monthIndexOf } from '../application/monthEntry';

/**
 * 年度事件（设计文档 3.7 / B13）。
 * - 事件池仅 5 种；每游戏年至多 1 次、概率配置 eventAnnualChanceBps（25%）。
 * - 是否发生/类别/月份/幅度/离职对象全部由 hash(runSeed, runId, year, 'event') 确定性决定，
 *   与公司名刷新、候选刷新、UI 操作无关；反复读档/重开年报结果不变（B13）。
 * - 事件惰性生成并缓存到 state.annualEvents（按年唯一），触发月后不追溯已结月份。
 */

const EVENT_TYPES: readonly AnnualEventType[] = [
  'ORDER_SURGE',
  'ORDER_DROP',
  'COST_RISE',
  'EMPLOYEE_LEAVE',
  'ASSET_LOSS',
];

export function annualEventKey(state: GameState, year: number): string {
  return `${state.runId}:${year}`;
}

function eventRng(state: GameState, year: number): Rng {
  return new Rng(deriveSeed(state.seed, state.runId, year, 'event'));
}

/**
 * 取某年事件计划；不存在则确定性生成（不修改状态，纯函数）。
 * 调用方负责在需要时缓存结果。
 */
export function planAnnualEvent(state: GameState, cfg: EconomyConfig, year: number): AnnualEvent {
  const cached = state.annualEvents.find((e) => e.key === annualEventKey(state, year));
  if (cached) return cached;

  const rng = eventRng(state, year);
  const chanceRoll = rng.nextInt(1, 10_000);
  const key = annualEventKey(state, year);

  // 首年为新手保护期，恒不发生事件（也与黄金「无事件」口径一致）
  if (year <= 1 || chanceRoll > cfg.risk.eventAnnualChanceBps) {
    return { key, year, happened: false, type: null, month: 0, effectBps: 0, amountYuan: 0, applied: true };
  }

  const type = rng.pick(EVENT_TYPES);
  const month = rng.nextInt(1, 12);
  const effectBps = rng.nextInt(cfg.risk.eventEffectMinBps, cfg.risk.eventEffectMaxBps);

  // 离职事件需在生成时就确定性选定员工（按当时在册顺序的稳定索引）
  let employeeId: string | undefined;
  if (type === 'EMPLOYEE_LEAVE') {
    const active = state.employees.filter((e) => e.status === 'ACTIVE');
    if (active.length === 0) {
      // 没有员工则不发生（不凭空产生），记为未发生
      return { key, year, happened: false, type: null, month: 0, effectBps: 0, amountYuan: 0, applied: true };
    }
    const idx = rng.nextInt(0, active.length - 1);
    employeeId = active[idx]?.employeeId;
  }

  const event: AnnualEvent = {
    key,
    year,
    happened: true,
    type,
    month,
    effectBps,
    amountYuan: 0,
    applied: false,
  };
  // 可选字段只在有值时写入：显式 undefined 会让 cloneGameState 抛错、存档却静默丢字段
  if (employeeId !== undefined) event.employeeId = employeeId;
  return event;
}

/** 确保某年事件已生成并缓存到 state（月结首月调用）。 */
export function ensureAnnualEvent(state: GameState, cfg: EconomyConfig, year: number): AnnualEvent {
  const existing = state.annualEvents.find((e) => e.key === annualEventKey(state, year));
  if (existing) return existing;
  const planned = planAnnualEvent(state, cfg, year);
  state.annualEvents.push(planned);
  if (state.annualEvents.length > cfg.save.keepRecentEventDetails + 40) {
    state.annualEvents = state.annualEvents.slice(-(cfg.save.keepRecentEventDetails + 40));
  }
  return planned;
}

/** 当月需求侧事件影响 bps（ORDER_SURGE 正、ORDER_DROP 负），其余 0。 */
export function monthlyDemandEventBps(event: AnnualEvent | null, month: number): number {
  if (!event || !event.happened || event.applied) return 0;
  if (event.type !== 'ORDER_SURGE' && event.type !== 'ORDER_DROP') return 0;
  if (event.month !== month) return 0;
  return event.type === 'ORDER_SURGE' ? event.effectBps : -event.effectBps;
}

/**
 * 应用「触发月」的事件副作用，返回需要计入当月一次性损益的损失（元，正数）。
 * - COST_RISE / ASSET_LOSS：按月度收入基数 × effectBps 计算损失（在触发月一次入账）。
 * - EMPLOYEE_LEAVE：把选中员工标记为次月离岗（无补偿、不产生费用）。
 * - ORDER_*：仅影响当月需求，不在这里产生金额。
 */
export function applyEventForMonth(
  state: GameState,
  cfg: EconomyConfig,
  event: AnnualEvent,
  month: number,
  yearRevenueBasisYuan: number,
): number {
  if (!event.happened || event.applied || event.month !== month) return 0;

  let loss = 0;
  if (event.type === 'COST_RISE' || event.type === 'ASSET_LOSS') {
    // 影响幅度限定在相关基数的 5%~12%（配置），损失通过正经 EVENT 成本项入账
    loss = Math.round((yearRevenueBasisYuan / 12) * (event.effectBps / 10_000));
    event.amountYuan = loss;
  } else if (event.type === 'EMPLOYEE_LEAVE' && event.employeeId) {
    const emp = state.employees.find((e) => e.employeeId === event.employeeId);
    if (emp && emp.status === 'ACTIVE') {
      // 次月移除岗位、无补偿（设计 3.7）
      emp.leftVoluntarily = true;
      emp.status = 'PENDING_DISMISSAL';
      emp.dismissedAtMonthIndex = monthIndexOf(state) + 1;
    }
  }
  event.applied = true;
  void cfg;
  return loss;
}

/** 测试辅助：直接生成某年事件（不经过 RNG），便于覆盖五种类型。 */
export function makeEventForTest(
  state: GameState,
  year: number,
  type: AnnualEventType,
  month: number,
  effectBps: number,
  employee?: Employee,
): AnnualEvent {
  const ev: AnnualEvent = {
    key: annualEventKey(state, year),
    year,
    happened: true,
    type,
    month,
    effectBps,
    amountYuan: 0,
    applied: false,
  };
  if (employee) ev.employeeId = employee.employeeId;
  state.annualEvents = state.annualEvents.filter((e) => e.key !== ev.key);
  state.annualEvents.push(ev);
  return ev;
}
