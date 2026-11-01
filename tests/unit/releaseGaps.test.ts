import { describe, it, expect, beforeAll } from 'vitest';
import rawEconomy from '../../assets/resources/config/economy.v1.json';
import { registerConfig } from '@core/config/configLoader';
import type { EconomyConfig } from '@core/config/EconomyConfig';
import { createInitialState } from '@core/domain/gameStateFactory';
import { createCompany } from '@core/application/CompanyService';
import { advanceMonth } from '@core/simulation/advanceMonth';
import { getOffer } from '@core/application/OfferService';
import { hireEmployee } from '@core/application/RecruitmentService';
import { setTargetCount } from '@core/application/DepartmentService';
import { assessRisk, injectRescueCapital, refreshRisk } from '@core/application/RiskService';
import { settleOffline } from '@core/simulation/offline';
import { migrateEnvelope, registerMigrator } from '@core/persistence/SaveMigration';
import { encodeEnvelope } from '@core/persistence/SaveCodec';
import type { Employee, GameState } from '@core/domain/types';

/**
 * V1.1 首发测试补充用例（对应 80 案例中此前自动化缺口）：
 * TC-013 录用费用、TC-014 现金不足、TC-015 年中生效月份、TC-024 目标人数不自动裁员、
 * TC-034 离线报告数据、TC-050 救助后复工、TC-059 存档迁移框架。
 */

let cfg: EconomyConfig;
beforeAll(() => {
  cfg = registerConfig(rawEconomy as never);
});

const HOUR = 60 * 60 * 1000;

function runningCompany(cash = 500_000, salary = 5000, seed = 20261102): GameState {
  const state = createInitialState(1_000, seed);
  createCompany(
    state,
    { companyName: '补充用例公司', industry: 'TRADE', ceoName: '林启航', ceoTrait: 'BOLD' },
    { commandId: 'create', expectedRunId: state.runId },
  );
  const biz = state.departments[0]!;
  const mk = (id: string): Employee => ({
    employeeId: id,
    name: id,
    avatarId: 'avatar_01',
    departmentId: biz.deptId,
    skill: 60,
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
  });
  state.employees = [mk('b1'), mk('b2')];
  state.onboarding.initialHiresCompleted = 2;
  state.onboarding.completedSteps.push('TUT-03', 'TUT-04', 'TUT-05');
  state.phase = 'RUNNING';
  state.speed = 1;
  state.company!.cashYuan = cash;
  return state;
}

function lastLedger(state: GameState) {
  return state.monthlyLedgersRolling.filter((l) => l.runId === state.runId).slice(-1)[0]!;
}

describe('TC-013 员工录用及费用扣除', () => {
  it('只增加 1 人，招聘费按预览一次扣除，账本只计一次', () => {
    const state = runningCompany();
    const deptId = state.departments[0]!.deptId;
    const offer = getOffer(state, deptId);
    const c = offer.candidates[0]!;
    const cashBefore = state.company!.cashYuan;
    const peopleBefore = state.employees.length;

    const r = hireEmployee(
      state,
      cfg,
      { offerId: offer.offerId, candidateId: c.candidateId, departmentId: deptId },
      { commandId: 'hire-1', expectedRunId: state.runId },
    );

    expect(r.feePaidYuan).toBe(c.salaryMonthlyYuan);
    expect(state.employees.length).toBe(peopleBefore + 1);
    expect(state.company!.cashYuan).toBe(cashBefore - c.salaryMonthlyYuan);
    const fees = state.pendingEntries.filter((e) => e.category === 'RECRUITMENT');
    expect(fees).toHaveLength(1);
    expect(fees[0]!.amountYuan).toBe(-c.salaryMonthlyYuan);

    advanceMonth(state, cfg);
    const m1 = lastLedger(state);
    expect(m1.recruitmentCostYuan).toBe(-c.salaryMonthlyYuan);
  });
});

describe('TC-014 现金不足不能招聘', () => {
  it('现金 5999 / 薪资 6000：拒绝且人数与现金不变', () => {
    const state = runningCompany(5999);
    const deptId = state.departments[0]!.deptId;
    const offer = getOffer(state, deptId);
    const c = offer.candidates[0]!;
    c.salaryMonthlyYuan = 6000;
    const peopleBefore = state.employees.length;
    const cashBefore = state.company!.cashYuan;

    expect(() =>
      hireEmployee(
        state,
        cfg,
        { offerId: offer.offerId, candidateId: c.candidateId, departmentId: deptId },
        { commandId: 'poor', expectedRunId: state.runId },
      ),
    ).toThrow(/INSUFFICIENT_CASH/);
    expect(state.employees.length).toBe(peopleBefore);
    expect(state.company!.cashYuan).toBe(cashBefore);
  });
});

describe('TC-015 年中招聘生效月份', () => {
  it('第 5 月录用：费用当月扣除，新员工从第 6 月计薪，历史月不追溯', () => {
    const state = runningCompany();
    for (let i = 0; i < 4; i++) advanceMonth(state, cfg); // 结算 1-4 月，停在第 5 月
    expect(state.gameMonth).toBe(5);

    const history = state.monthlyLedgersRolling.filter((l) => l.runId === state.runId).map((l) => ({ ...l }));
    const deptId = state.departments[0]!.deptId;
    const offer = getOffer(state, deptId);
    const c = offer.candidates[0]!;
    c.salaryMonthlyYuan = 5000;

    hireEmployee(
      state,
      cfg,
      { offerId: offer.offerId, candidateId: c.candidateId, departmentId: deptId },
      { commandId: 'mid-year', expectedRunId: state.runId },
    );

    // 历史 4 个月账本不被改写
    const nowHistory = state.monthlyLedgersRolling
      .filter((l) => l.runId === state.runId)
      .slice(0, 4);
    expect(nowHistory).toEqual(history);

    const emp = state.employees.find((e) => e.candidateId === c.candidateId)!;
    expect(emp.effectiveFromMonthIndex).toBe(5); // 次月（第 6 月）生效

    advanceMonth(state, cfg); // 结算第 5 月
    const m5 = lastLedger(state);
    expect(m5.recruitmentCostYuan).toBe(-5000);
    expect(m5.payrollYuan).toBe(-10_000); // 新员工尚未计薪

    advanceMonth(state, cfg); // 结算第 6 月
    const m6 = lastLedger(state);
    expect(Math.abs(m6.recruitmentCostYuan)).toBe(0);
    expect(m6.payrollYuan).toBe(-15_000); // 新员工开始计薪
  });
});

describe('TC-024 部门目标人数不会自动裁员', () => {
  it('目标从 5 调到 1：只改建议人数，员工与现金不变、无补偿分录', () => {
    const state = runningCompany();
    const deptId = state.departments[0]!.deptId;
    state.departments[0]!.targetCount = 5;
    const peopleBefore = state.employees.length;
    const cashBefore = state.company!.cashYuan;
    const severanceBefore = state.pendingEntries.filter((e) => e.category === 'SEVERANCE').length;

    setTargetCount(state, deptId, 1, { commandId: 't1', expectedRunId: state.runId });

    expect(state.departments[0]!.targetCount).toBe(1);
    expect(state.employees.length).toBe(peopleBefore);
    expect(state.company!.cashYuan).toBe(cashBefore);
    expect(state.pendingEntries.filter((e) => e.category === 'SEVERANCE')).toHaveLength(
      severanceBefore,
    );
  });
});

describe('TC-034 离线报告数据准确', () => {
  it('8 小时 = 12 月：现金差额等于各月 cashDelta 之和，利润与年报一致', () => {
    const state = runningCompany(290_000);
    state.lastWallClockMs = 1_000_000;
    const cashBefore = state.company!.cashYuan;
    const r = settleOffline({ state, cfg, nowMs: 1_000_000 + 8 * HOUR });

    expect(r.monthsSettled).toBe(12);
    expect(r.clockRolledBack).toBe(false);
    const ledgers = state.monthlyLedgersRolling.filter((l) => l.runId === state.runId);
    const delta = ledgers.reduce((s, l) => s + l.cashDeltaYuan, 0);
    const profit = ledgers.reduce((s, l) => s + l.profitYuan, 0);
    expect(state.company!.cashYuan - cashBefore).toBe(delta);

    const rep = state.annualReports[0]!;
    expect(rep.profitYuan).toBe(profit);
    expect(rep.cashCloseYuan).toBe(state.company!.cashYuan);
  });
});

describe('TC-050 救助后满足条件正常复工', () => {
  it('DISTRESS → 救助 → 风险解除 → 月结恢复', () => {
    const state = runningCompany(1000, 8000);
    expect(assessRisk(state, cfg).level).toBe('DISTRESS');
    refreshRisk(state, cfg);
    expect(state.cashRisk).toBe('DISTRESS');
    state.phase = 'DISTRESS';

    injectRescueCapital(state, cfg, { commandId: 'rescue', expectedRunId: state.runId });
    expect(assessRisk(state, cfg).level).not.toBe('DISTRESS');

    // 与 GameFacade 一致：解除冻结后回到 RUNNING，继续月结
    state.phase = 'RUNNING';
    state.speed = 1;
    const before = state.monthlyLedgersRolling.filter((l) => l.runId === state.runId).length;
    advanceMonth(state, cfg);
    expect(state.monthlyLedgersRolling.filter((l) => l.runId === state.runId).length).toBe(
      before + 1,
    );
    expect(state.company!.cashYuan).toBeGreaterThan(0);
  });
});

describe('TC-059 存档迁移框架（真实 v2 尚未定义）', () => {
  it('未知高版本拒绝且不破坏原档；注册 v1→v2 迁移后关键字段保留', () => {
    const base = createInitialState(1_000, 7);
    const envelope = encodeEnvelope(base, {
      revision: 1,
      runId: base.runId,
      resetGeneration: 0,
    });
    expect(() => migrateEnvelope(envelope, 3)).toThrow(/no migrator/);

    registerMigrator(1, (src) => ({ ...src, schemaVersion: 2 as never }));
    const migrated = migrateEnvelope(envelope, 2);
    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.runId).toBe(base.runId);
    expect(migrated.payload.company).toEqual(base.company);
    expect(migrated.payload.executedCommandIds).toEqual(base.executedCommandIds);
  });
});
