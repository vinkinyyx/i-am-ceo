import { describe, it, expect, beforeAll } from 'vitest';
import rawEconomy from '../../assets/resources/config/economy.v1.json';
import { registerConfig } from '@core/config/configLoader';
import type { EconomyConfig } from '@core/config/EconomyConfig';
import { createInitialState } from '@core/domain/gameStateFactory';
import { createCompany } from '@core/application/CompanyService';
import { computeOfflineMonths, settleOffline } from '@core/simulation/offline';
import type { GameState } from '@core/domain/types';

let cfg: EconomyConfig;
beforeAll(() => {
  cfg = registerConfig(rawEconomy as never);
});

const MIN = 60_000;
const HOUR = 60 * MIN;

function runningCompany(seed = 11): GameState {
  const state = createInitialState(1_000, seed);
  createCompany(
    state,
    { companyName: '离线公司', industry: 'TRADE', ceoName: '林启航', ceoTrait: 'BOLD' },
    { commandId: 'c', expectedRunId: state.runId },
  );
  const deptId = state.departments[0]!.deptId;
  state.employees = [1, 2].map((i) => ({
    employeeId: `e${i}`, name: `员${i}`, avatarId: 'avatar_01', departmentId: deptId,
    skill: 60, potential: 60, teamwork: 50, personality: 'STEADY' as const,
    salaryMonthlyYuan: 5000, hiredAtMonthIndex: 0, effectiveFromMonthIndex: 0,
    dismissedAtMonthIndex: null, status: 'ACTIVE' as const, candidateId: `c${i}`, hireCommandId: `h${i}`,
  }));
  state.onboarding.initialHiresCompleted = 2;
  state.onboarding.completedSteps.push('TUT-03', 'TUT-04', 'TUT-05');
  state.phase = 'RUNNING';
  state.speed = 1;
  state.company!.cashYuan = 290_000;
  return state;
}

describe('M3-01 离线结算（G009 / A09 / A10 / B08 / B09 / B10）', () => {
  it('纯计算：8小时=12月；40小时封顶36月', () => {
    expect(computeOfflineMonths(cfg, 8 * HOUR, 0).months).toBe(12);
    const cap = computeOfflineMonths(cfg, 40 * HOUR, 0);
    expect(cap.months).toBe(36);
    expect(cap.newRemainderMs).toBe(0); // 封顶余量清零
  });

  it('G009: 离线8小时结算12个月，生成1份年报；不重复领取', () => {
    const state = runningCompany();
    state.lastWallClockMs = 1_000_000;
    const r = settleOffline({ state, cfg, nowMs: 1_000_000 + 8 * HOUR });
    expect(r.monthsSettled).toBe(12);
    expect(state.gameYear).toBe(2);
    expect(state.annualReports).toHaveLength(1);
    // 立即再次 onShow（无新增离线）：0 月
    const r2 = settleOffline({ state, cfg, nowMs: 1_000_000 + 8 * HOUR + 1000 });
    expect(r2.monthsSettled).toBe(0);
  });

  it('B08: 设备时间回拨 → 0 月、不产生负月份', () => {
    const state = runningCompany();
    state.lastWallClockMs = 5_000_000;
    const r = settleOffline({ state, cfg, nowMs: 5_000_000 - 24 * HOUR });
    expect(r.monthsSettled).toBe(0);
    expect(r.clockRolledBack).toBe(true);
    expect(state.gameYear).toBe(1);
  });

  it('B09: 不足40分钟余量跨次累积成完整月；重复 onShow 不加速', () => {
    const state = runningCompany();
    state.lastWallClockMs = 0;
    // 第一次 30 分钟：不足1月
    const r1 = settleOffline({ state, cfg, nowMs: 30 * MIN });
    expect(r1.monthsSettled).toBe(0);
    expect(state.offlineRemainderMs).toBe(30 * MIN);
    // 水位已更新；再来 20 分钟（相对新水位）：累计50分钟→1月
    const r2 = settleOffline({ state, cfg, nowMs: 30 * MIN + 20 * MIN });
    expect(r2.monthsSettled).toBe(1);
    // 紧接着再 onShow 无新时长：0
    const r3 = settleOffline({ state, cfg, nowMs: 30 * MIN + 20 * MIN });
    expect(r3.monthsSettled).toBe(0);
  });

  it('B10: 暂停(speed=0)时离线不结算', () => {
    const state = runningCompany();
    state.speed = 0;
    state.lastWallClockMs = 0;
    const r = settleOffline({ state, cfg, nowMs: 8 * HOUR });
    expect(r.monthsSettled).toBe(0);
  });

  it('24h 以上的当次时长被丢弃（maxEligibleOfflineMs）', () => {
    const state = runningCompany();
    state.lastWallClockMs = 0;
    // 40 小时 > 24h 可计时长，但 credit 按 24h 封顶 + 余量
    const r = settleOffline({ state, cfg, nowMs: 40 * HOUR });
    // 24h = 1440min → 36 月（恰好 36，封顶）
    expect(r.monthsSettled).toBe(36);
  });
});
