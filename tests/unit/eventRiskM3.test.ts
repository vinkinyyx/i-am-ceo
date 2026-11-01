import { describe, it, expect, beforeAll } from 'vitest';
import rawEconomy from '../../assets/resources/config/economy.v1.json';
import { registerConfig } from '@core/config/configLoader';
import type { EconomyConfig } from '@core/config/EconomyConfig';
import { createInitialState } from '@core/domain/gameStateFactory';
import { createCompany } from '@core/application/CompanyService';
import { advanceMonth } from '@core/simulation/advanceMonth';
import { ensureAnnualEvent, makeEventForTest } from '@core/simulation/annualEvent';
import { assessRisk, injectRescueCapital } from '@core/application/RiskService';
import {
  generateBots,
  assetsLeaderboard,
  yearsLeaderboard,
  playerAssets,
} from '@core/simulation/leaderboard';
import type { AnnualEventType, GameState } from '@core/domain/types';

let cfg: EconomyConfig;
beforeAll(() => {
  cfg = registerConfig(rawEconomy as never);
});

function runningCompany(seed = 23, cash = 290_000): GameState {
  const state = createInitialState(1_000, seed);
  createCompany(
    state,
    { companyName: '事件公司', industry: 'TRADE', ceoName: '林启航', ceoTrait: 'BOLD' },
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
  state.company!.cashYuan = cash;
  return state;
}

describe('M3-02 年度事件（B13 固定 seed / 年≤1 / 五种类型）', () => {
  it('首年恒不发生事件（新手保护 + 黄金无事件口径）', () => {
    const state = runningCompany();
    const ev = ensureAnnualEvent(state, cfg, 1);
    expect(ev.happened).toBe(false);
  });

  it('同年反复读取得到同一事件（不因刷新/读档改变，B13）', () => {
    const state = runningCompany();
    const a = ensureAnnualEvent(state, cfg, 3);
    const b = ensureAnnualEvent(state, cfg, 3);
    expect(a).toBe(b);
    expect(state.annualEvents.filter((e) => e.year === 3)).toHaveLength(1);
  });

  it.each(['ORDER_SURGE', 'ORDER_DROP', 'COST_RISE', 'ASSET_LOSS'] as AnnualEventType[])(
    '%s 在触发月计入需求或一次性损失，且只作用一次',
    (type) => {
      const state = runningCompany();
      // 结完第1年（12月）进入第2年第1月；再结到第2年6月（推进17次后停在第2年6月初）
      for (let i = 0; i < 17; i++) advanceMonth(state, cfg);
      expect(state.gameYear).toBe(2);
      expect(state.gameMonth).toBe(6);
      const emp = state.employees[0]!;
      makeEventForTest(state, 2, type, 6, 1000, emp);
      advanceMonth(state, cfg); // 结第2年6月
      const m6 = state.monthlyLedgersRolling.filter((l) => l.runId === state.runId).slice(-1)[0]!;
      if (type === 'COST_RISE' || type === 'ASSET_LOSS') {
        expect(Math.abs(m6.eventCostYuan)).toBeGreaterThan(0);
      } else {
        const ev = state.annualEvents.find((e) => e.year === 2)!;
        expect(ev.applied).toBe(true);
      }
    },
  );

  it('EMPLOYEE_LEAVE 次月移除员工且无补偿、无 SEVERANCE 费用', () => {
    const state = runningCompany();
    for (let i = 0; i < 12; i++) advanceMonth(state, cfg); // 进入第2年第1月
    const emp = state.employees[0]!;
    // 在第2年第2月触发离职
    makeEventForTest(state, 2, 'EMPLOYEE_LEAVE', 2, 800, emp);
    advanceMonth(state, cfg); // 第2年1月：无事件，员工仍在
    expect(emp.status).toBe('ACTIVE');
    advanceMonth(state, cfg); // 第2年2月：应用离职 → 当次月结后转 DISMISSED（dismissedAt=次月轴）
    expect(emp.status).toBe('DISMISSED');
    expect(emp.leftVoluntarily).toBe(true);
    const m2 = state.monthlyLedgersRolling.filter((l) => l.runId === state.runId).slice(-1)[0]!;
    expect(Math.abs(m2.severanceCostYuan)).toBe(0);
  });
});

describe('M3-03 现金风控与救助（G010/G012/B12）', () => {
  it('G012: 救助首次+10万、计入实收资本、不计收入；重复拒绝', () => {
    const state = runningCompany();
    const cashBefore = state.company!.cashYuan;
    const reports = state.annualReports.length;
    const r = injectRescueCapital(state, cfg, { commandId: 'rescue', expectedRunId: state.runId });
    expect(r.granted).toBe(true);
    expect(r.amountYuan).toBe(100_000);
    expect(state.company!.cashYuan).toBe(cashBefore + 100_000);
    expect(state.company!.paidInCapitalYuan).toBe(300_000 + 100_000);
    // 第二次拒绝
    expect(() =>
      injectRescueCapital(state, cfg, { commandId: 'rescue2', expectedRunId: state.runId }),
    ).toThrow(/ALREADY_USED/);
    // 没有产生年报/收入（救助不结算月份）
    expect(state.annualReports.length).toBe(reports);
  });

  it('B12: 现金极低时评估为 DISTRESS/WARNING；救助后风险下降', () => {
    const state = runningCompany();
    state.company!.cashYuan = 1000;
    const level = assessRisk(state, cfg).level;
    expect(level === 'DISTRESS' || level === 'WARNING').toBe(true);
    injectRescueCapital(state, cfg, { commandId: 'r', expectedRunId: state.runId });
    expect(assessRisk(state, cfg).level).toBe('NORMAL');
  });

  it('G010: 亏损不删公司/员工/存档，下年可继续经营', () => {
    const state = runningCompany();
    state.company!.cashYuan = 50_000;
    // 高工资导致亏损但仍为正现金
    state.employees.forEach((e) => (e.salaryMonthlyYuan = 8000));
    const empCountBefore = state.employees.length;
    for (let i = 0; i < 12; i++) advanceMonth(state, cfg);
    const rep = state.annualReports[0]!;
    expect(rep.profitYuan).toBeLessThan(0);
    expect(state.company).not.toBeNull();
    expect(state.employees.length).toBe(empCountBefore);
    expect(state.gameYear).toBe(2);
  });
});

describe('M3-04 本地模拟榜（A14）', () => {
  it('同配置生成12个 bot 且确定性一致', () => {
    const a = generateBots(cfg);
    const b = generateBots(cfg);
    expect(a).toHaveLength(12);
    expect(a.map((x) => x.botId)).toEqual(b.map((x) => x.botId));
    expect(a.map((x) => x.assetsYuan)).toEqual(b.map((x) => x.assetsYuan));
  });

  it('资产榜与年限榜排序正确并含玩家', () => {
    const state = runningCompany();
    state.botCompanies = generateBots(cfg);
    const assets = assetsLeaderboard(state, cfg);
    const years = yearsLeaderboard(state, cfg);
    expect(assets).toHaveLength(13);
    expect(assets.some((r) => r.isPlayer)).toBe(true);
    const assetsSorted = assets.every((r, i) => i === 0 || assets[i - 1]!.assetsYuan >= r.assetsYuan);
    expect(assetsSorted).toBe(true);
    const yearsSorted = years.every((r, i) => i === 0 || years[i - 1]!.yearsOperated >= r.yearsOperated);
    expect(yearsSorted).toBe(true);
  });

  it('玩家资产=现金+业务资产账面；初始年限0', () => {
    const state = runningCompany();
    state.company!.businessAssetBookYuan = 12_000;
    state.company!.cashYuan = 100_000;
    expect(playerAssets(state)).toBe(112_000);
  });
});
