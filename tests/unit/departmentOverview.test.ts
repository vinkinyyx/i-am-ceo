import { describe, it, expect, beforeAll } from 'vitest';
import rawEconomy from '../../assets/resources/config/economy.v1.json';
import { registerConfig } from '@core/config/configLoader';
import type { EconomyConfig } from '@core/config/EconomyConfig';
import { createInitialState } from '@core/domain/gameStateFactory';
import { createCompany } from '@core/application/CompanyService';
import { buildDepartmentOverview } from '@core/application/DepartmentOverviewService';
import {
  createDepartment,
  previewCreateDepartment,
  setStaffingMode,
} from '@core/application/DepartmentService';
import { computeSupportEffects } from '@core/simulation/departments';
import * as marketModule from '@core/simulation/market';
import { settleMonth } from '@core/simulation/monthly';
import { advanceMonth } from '@core/simulation/advanceMonth';
import { roundHalfUp } from '@core/domain/money';
import { EditorMockPlatform } from '../helpers/EditorMockPlatform';
import { MemoryStorage } from '../helpers/MemoryStorage';
import { GameFacade } from '@core/application/GameFacade';
import type { Employee, GameState, SupportDeptType } from '@core/domain/types';

let cfg: EconomyConfig;
beforeAll(() => {
  cfg = registerConfig(rawEconomy as never);
});

function mkEmployee(
  id: string,
  deptId: string,
  skill = 60,
  salary = 5000,
): Employee {
  return {
    employeeId: id,
    name: id,
    avatarId: 'avatar_01',
    departmentId: deptId,
    skill,
    potential: 60,
    teamwork: 50,
    personality: 'STEADY',
    salaryMonthlyYuan: salary,
    hiredAtMonthIndex: 0,
    effectiveFromMonthIndex: 0,
    dismissedAtMonthIndex: null,
    status: 'ACTIVE',
    candidateId: `c-${id}`,
    hireCommandId: `h-${id}`,
  };
}

/** 运行中公司（2 名业务员工），可选把支持部门员工放进指定部门。 */
function running(businessSkill = 60, cash = 1_000_000, seed = 20261102): GameState {
  const state = createInitialState(1000, seed);
  createCompany(
    state,
    { companyName: '部门页测试公司', industry: 'TRADE', ceoName: '林启航', ceoTrait: 'BOLD' },
    { commandId: 'create', expectedRunId: state.runId },
  );
  const biz = state.departments[0]!;
  state.employees = [
    mkEmployee('b1', biz.deptId, businessSkill),
    mkEmployee('b2', biz.deptId, businessSkill),
  ];
  state.onboarding.initialHiresCompleted = 2;
  state.onboarding.completedSteps.push('TUT-03', 'TUT-04', 'TUT-05');
  state.phase = 'RUNNING';
  state.speed = 0;
  state.company!.cashYuan = cash;
  return state;
}

function addDept(state: GameState, type: SupportDeptType, staff: number, commandId = `dept-${type}`): void {
  createDepartment(state, cfg, type, { commandId, expectedRunId: state.runId });
  const dept = state.departments.find((d) => d.type === type)!;
  for (let i = 0; i < staff; i += 1) {
    state.employees.push(mkEmployee(`${type}-${i}`, dept.deptId));
  }
}

function month1(state: GameState) {
  return settleMonth({
    state,
    cfg,
    industry: state.company!.industry,
    year: 1,
    month: 1,
    monthIndex: 0,
    acqMultiplierBps: 10_000,
    eventDemandBps: 0,
    businessCapacityInvestmentYuan: state.company!.businessCapacityInvestmentYuan,
    eventLossYuan: 0,
  });
}

describe('R29 部门视图：只读与 0 人无效益', () => {
  it('五个支持部门建了但 0 人：系数与贡献严格为 0，且读取不改状态', () => {
    const state = running();
    for (const type of ['HR', 'PROCUREMENT', 'MARKETING', 'CUSTOMER_SERVICE', 'FINANCE'] as const) {
      createDepartment(state, cfg, type, { commandId: `c-${type}`, expectedRunId: state.runId });
    }
    const before = JSON.stringify(state);
    const vm = buildDepartmentOverview(state, cfg)!;
    const support = vm.departments.filter((d) => d.type !== 'BUSINESS');
    expect(support).toHaveLength(5);
    for (const d of support) {
      expect(d.headcount).toBe(0);
      expect(d.effectBps).toBe(0);
      expect(d.estimatedMonthlyValueYuan).toBe(0);
      expect(d.estimatedNetContributionYuan).toBe(0);
      expect(d.valueKind).toBe('NO_EFFECT');
    }
    expect(vm.historicalAttribution).toBe('UNAVAILABLE');
    expect(vm.valueBasis).toBe('CURRENT_MONTH_ESTIMATE');
    expect(JSON.stringify(state)).toBe(before);
  });

  it('已建部门不再出现在未建列表，未建部门带设立费与扣后余额', () => {
    const state = running();
    createDepartment(state, cfg, 'PROCUREMENT', { commandId: 'c1', expectedRunId: state.runId });
    const vm = buildDepartmentOverview(state, cfg)!;
    expect(vm.uncreated.map((u) => u.type)).not.toContain('PROCUREMENT');
    expect(vm.uncreated).toHaveLength(4);
    for (const u of vm.uncreated) {
      expect(u.feeYuan).toBe(cfg.departments.setupFeeYuan);
      expect(u.cashAfterYuan).toBe(state.company!.cashYuan - u.feeYuan);
      expect(u.affordable).toBe(true);
    }
  });
});

describe('R29 归因：当月估算与月结同口径（G004/G014—G017）', () => {
  it('采购：估算节省 = 月结毛直成 − 净直成', () => {
    const state = running();
    addDept(state, 'PROCUREMENT', 2);
    const vm = buildDepartmentOverview(state, cfg)!;
    const amounts = month1(state);
    const ind = cfg.industry.TRADE;
    const grossDirect = roundHalfUp((amounts.revenue * ind.directCostBps) / 10_000);
    const actualSaving = grossDirect - amounts.directCost;
    const dept = vm.departments.find((d) => d.type === 'PROCUREMENT')!;
    expect(vm.projectedRevenueYuan).toBe(amounts.revenue);
    expect(actualSaving).toBeGreaterThan(0);
    expect(dept.estimatedMonthlyValueYuan).toBe(actualSaving);
    expect(dept.effectBps).toBe(computeSupportEffects(cfg, state, 0).procurement.effectBps);
    expect(dept.estimatedNetContributionYuan).toBe(actualSaving - dept.monthlyPayrollYuan);
  });

  it('客服：估算节省 = 月结毛售后 − 净售后', () => {
    const state = running();
    addDept(state, 'CUSTOMER_SERVICE', 2);
    const vm = buildDepartmentOverview(state, cfg)!;
    const amounts = month1(state);
    const ind = cfg.industry.TRADE;
    const grossAfter = roundHalfUp((amounts.revenue * ind.afterSalesCostBps) / 10_000);
    const actualSaving = grossAfter - amounts.afterSales;
    const dept = vm.departments.find((d) => d.type === 'CUSTOMER_SERVICE')!;
    expect(actualSaving).toBeGreaterThan(0);
    expect(dept.estimatedMonthlyValueYuan).toBe(actualSaving);
  });

  it('财务：月度估算按运行速率，年化后与月结公式（固定费+全年其他费）一致', () => {
    const state = running();
    addDept(state, 'FINANCE', 2);
    const vm = buildDepartmentOverview(state, cfg)!;
    const amounts = month1(state);
    const ind = cfg.industry.TRADE;
    const eff = computeSupportEffects(cfg, state, 0).finance.effectBps;
    const fixedShare = roundHalfUp(ind.fixedManagementAnnualYuan / 12);
    const otherGross = roundHalfUp((amounts.revenue * ind.otherOperatingCostBps) / 10_000);
    const dept = vm.departments.find((d) => d.type === 'FINANCE')!;
    const runRate = roundHalfUp(((fixedShare + otherGross) * eff) / 10_000);
    expect(dept.estimatedMonthlyValueYuan).toBe(runRate);
    // 12 个月恒定收入下，年化节省应与月结年公式 (固定管理费 + 全年其他费) × 系数 一致
    const annualByVm = dept.estimatedMonthlyValueYuan * 12;
    const annualBySettle = roundHalfUp(
      ((ind.fixedManagementAnnualYuan + otherGross * 12) * eff) / 10_000,
    );
    expect(Math.abs(annualByVm - annualBySettle)).toBeLessThanOrEqual(15);
    // 月结确实产生了正的财务节省（固定费净额低于毛额）
    expect(amounts.fixed).toBeGreaterThan(0);
    expect(amounts.fixed).toBeLessThan(roundHalfUp(ind.fixedManagementAnnualYuan / 12));
  });

  it('市场：增量贡献 = (min(提升后订单,产能) − min(基准订单,产能)) × 毛利率', () => {
    const { monthlyPotentialOrder } = marketModule;
    for (const skill of [60, 10]) {
      const state = running(skill);
      addDept(state, 'MARKETING', 2);
      const vm = buildDepartmentOverview(state, cfg)!;
      const orderBase = monthlyPotentialOrder(cfg, 'TRADE', 1, 1, 10_000, 0);
      const extra =
        Math.min(vm.monthlyPotentialOrderYuan, vm.monthlyCapacityYuan) -
        Math.min(orderBase, vm.monthlyCapacityYuan);
      const expected = roundHalfUp((Math.max(0, extra) * vm.grossMarginBps) / 10_000);
      expect(vm.departments.find((d) => d.type === 'MARKETING')!.estimatedMonthlyValueYuan).toBe(expected);
    }
  });

  it('HR：低产能（制约收入）时产能提升带来增量贡献；产能过剩时为 0', () => {
    const tight = running(10);
    addDept(tight, 'HR', 2);
    const vm = buildDepartmentOverview(tight, cfg)!;
    const hr = vm.departments.find((d) => d.type === 'HR')!;
    expect(vm.monthlyCapacityYuan).toBeLessThan(vm.monthlyPotentialOrderYuan);
    expect(hr.effectBps).toBeGreaterThan(0);
    expect(hr.estimatedMonthlyValueYuan).toBeGreaterThan(0);

    const loose = running(90);
    addDept(loose, 'HR', 2);
    const looseVm = buildDepartmentOverview(loose, cfg)!;
    expect(looseVm.departments.find((d) => d.type === 'HR')!.estimatedMonthlyValueYuan).toBe(0);
  });

  it('主营：效益按当月预计收入×行业毛利率，成本为业务部工资', () => {
    const state = running();
    const vm = buildDepartmentOverview(state, cfg)!;
    const biz = vm.departments.find((d) => d.type === 'BUSINESS')!;
    const expected = roundHalfUp((vm.projectedRevenueYuan * vm.grossMarginBps) / 10_000);
    expect(biz.headcount).toBe(2);
    expect(biz.monthlyPayrollYuan).toBe(10_000);
    expect(biz.estimatedMonthlyValueYuan).toBe(expected);
    expect(biz.estimatedNetContributionYuan).toBe(expected - 10_000);
  });
});

describe('R29 自动预算与方针', () => {
  it('安全线来自方针与真实工资，可支配额=现金−保留刚性费用', () => {
    const state = running();
    addDept(state, 'HR', 1);
    const vm = buildDepartmentOverview(state, cfg)!;
    const p = cfg.policies[state.policy];
    const b = vm.autoBudget;
    expect(b.roiThresholdBps).toBe(p.autoHireMarginThresholdBps);
    expect(b.cashReserveMonths).toBe(p.cashReserveMonths);
    const payroll = state.employees.reduce((s, e) => s + e.salaryMonthlyYuan, 0);
    const fixedMonthly = cfg.industry.TRADE.fixedManagementAnnualYuan / 12;
    expect(b.reserveRequiredYuan).toBe(Math.round((payroll + fixedMonthly) * p.cashReserveMonths));
    expect(b.spendableYuan).toBe(state.company!.cashYuan - b.reserveRequiredYuan);
    expect(b.autoDeptCount).toBe(1); // 新建部门默认 LOCKED → 切换后才是 AUTO
    expect(b.maxAutoHiresPerYear).toBe(cfg.recruitment.maxAutoHiresPerYear);
  });

  it('把部门切到 AUTO 后 autoDeptCount 增加；切换不扣费不裁员', () => {
    const state = running();
    const before = buildDepartmentOverview(state, cfg)!.autoBudget.autoDeptCount;
    addDept(state, 'PROCUREMENT', 1);
    const dept = state.departments.find((d) => d.type === 'PROCUREMENT')!;
    const cash = state.company!.cashYuan;
    setStaffingMode(state, dept.deptId, 'AUTO', { commandId: 'mode-1', expectedRunId: state.runId });
    const vm = buildDepartmentOverview(state, cfg)!;
    expect(vm.autoBudget.autoDeptCount).toBe(before + 1);
    expect(state.company!.cashYuan).toBe(cash);
    expect(state.employees).toHaveLength(3);
  });
});

describe('R29 建部：预览与幂等只扣一次', () => {
  it('预览返回设立费、扣后余额与是否已建；不扣款', () => {
    const state = running();
    const cash = state.company!.cashYuan;
    const pv = previewCreateDepartment(state, cfg, 'MARKETING');
    expect(pv.feeYuan).toBe(cfg.departments.setupFeeYuan);
    expect(pv.cashAfterYuan).toBe(cash - pv.feeYuan);
    expect(pv.alreadyExists).toBe(false);
    expect(state.company!.cashYuan).toBe(cash);
  });

  it('同 commandId 重放返回 0 费用；不同 commandId 再建同类直接拒绝，现金只扣一次', () => {
    const state = running();
    const cash = state.company!.cashYuan;
    const r1 = createDepartment(state, cfg, 'HR', { commandId: 'same', expectedRunId: state.runId });
    expect(r1.feePaidYuan).toBe(cfg.departments.setupFeeYuan);
    expect(state.company!.cashYuan).toBe(cash - cfg.departments.setupFeeYuan);

    const r2 = createDepartment(state, cfg, 'HR', { commandId: 'same', expectedRunId: state.runId });
    expect(r2.feePaidYuan).toBe(0);
    expect(r2.department.deptId).toBe(r1.department.deptId);
    expect(state.company!.cashYuan).toBe(cash - cfg.departments.setupFeeYuan);

    expect(() =>
      createDepartment(state, cfg, 'HR', { commandId: 'other', expectedRunId: state.runId }),
    ).toThrow('DEPT_ALREADY_EXISTS');
    expect(state.company!.cashYuan).toBe(cash - cfg.departments.setupFeeYuan);
  });

  it('余额不足时拒绝建部且不扣款', () => {
    const state = running(60, 5_000);
    expect(() =>
      createDepartment(state, cfg, 'FINANCE', { commandId: 'poor', expectedRunId: state.runId }),
    ).toThrow('INSUFFICIENT_CASH');
    expect(state.company!.cashYuan).toBe(5_000);
    const vm = buildDepartmentOverview(state, cfg)!;
    expect(vm.uncreated.find((u) => u.type === 'FINANCE')!.affordable).toBe(false);
  });
});

describe('R29 T06 方针/编制改变不改写旧账', () => {
  it('已结算月账与年报不因后续切方针而改变', async () => {
    const storage = new MemoryStorage();
    const facade = await GameFacade.bootstrap(new EditorMockPlatform(storage), cfg);
    const s0 = facade.getState();
    await facade.createCompany(
      { companyName: '方针测试公司', industry: 'TRADE', ceoName: '林启航', ceoTrait: 'BOLD' },
      { commandId: 'create-1', expectedRunId: s0.runId },
    );
    let s = facade.getState();
    const deptId = s.departments[0]!.deptId;
    for (let i = 0; i < 2; i += 1) {
      const offer = facade.getOffer(deptId);
      const candidate = offer.candidates.find(
        (c) => !facade.getState().employees.some((e) => e.candidateId === c.candidateId),
      )!;
      await facade.hireEmployee(
        { offerId: offer.offerId, candidateId: candidate.candidateId, departmentId: deptId },
        { commandId: `hire-${i}`, expectedRunId: facade.getState().runId },
      );
    }
    s = facade.getState();
    await facade.startOperating({ commandId: 'start-1', expectedRunId: s.runId });
    s = facade.getState();
    await facade.setSpeed(5, { commandId: 'sp-5', expectedRunId: s.runId });
    await facade.advanceRealTime(5000, facade.getState().runId);

    const ledgerBefore = JSON.stringify(facade.getState().monthlyLedgersRolling);
    const reportsBefore = JSON.stringify(facade.getState().annualReports);
    s = facade.getState();
    const policy = await facade.setPolicy('PROFIT', { commandId: 'policy-1', expectedRunId: s.runId });
    expect(policy.ok).toBe(true);
    expect(JSON.stringify(facade.getState().monthlyLedgersRolling)).toBe(ledgerBefore);
    expect(JSON.stringify(facade.getState().annualReports)).toBe(reportsBefore);
    // 只影响后续自动决策的门槛与安全线
    const vm = facade.getDepartmentOverview()!;
    expect(vm.autoBudget.policy).toBe('PROFIT');
    expect(vm.autoBudget.roiThresholdBps).toBe(cfg.policies.PROFIT.autoHireMarginThresholdBps);
  });

  it('推进月结后月账只增不改（部门页读取不触发结算）', async () => {
    // 用直接领域函数验证：结算前后读取 department overview 不会写入任何月账或年报。
    const state = running();
    addDept(state, 'PROCUREMENT', 1);
    const ledgerCount = state.monthlyLedgersRolling.length;
    buildDepartmentOverview(state, cfg);
    expect(state.monthlyLedgersRolling).toHaveLength(ledgerCount);
    advanceMonth(state, cfg);
    expect(state.monthlyLedgersRolling).toHaveLength(ledgerCount + 1);
    const first = state.monthlyLedgersRolling[0]!;
    buildDepartmentOverview(state, cfg);
    expect(state.monthlyLedgersRolling[0]).toBe(first);
  });
});
