import { describe, it, expect, beforeAll } from 'vitest';
import rawEconomy from '../../assets/resources/config/economy.v1.json';
import { registerConfig } from '@core/config/configLoader';
import type { EconomyConfig } from '@core/config/EconomyConfig';
import { createInitialState } from '@core/domain/gameStateFactory';
import { createCompany } from '@core/application/CompanyService';
import { createDepartment } from '@core/application/DepartmentService';
import {
  buildTalentOverview,
  buildTransferImpact,
  estimateLayoffCapacityLoss,
  transferTargets,
} from '@core/application/TalentOverviewService';
import { createLayoffToken, confirmLayoff, previewLayoff } from '@core/application/LayoffService';
import { transferEmployee } from '@core/application/TransferService';
import { advanceMonth } from '@core/simulation/advanceMonth';
import { cloneGameState } from '@core/persistence/cloneGameState';
import type { Employee, GameState, SupportDeptType } from '@core/domain/types';

let cfg: EconomyConfig;
beforeAll(() => {
  cfg = registerConfig(rawEconomy as never);
});

function mkEmployee(id: string, deptId: string, skill = 60, salary = 5000): Employee {
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

function running(businessSkill = 60, cash = 1_000_000, seed = 20261102): GameState {
  const state = createInitialState(1000, seed);
  createCompany(
    state,
    { companyName: '人才页测试公司', industry: 'TRADE', ceoName: '林启航', ceoTrait: 'BOLD' },
    { commandId: 'create', expectedRunId: state.runId },
  );
  const biz = state.departments[0]!;
  state.employees = [mkEmployee('b1', biz.deptId, businessSkill), mkEmployee('b2', biz.deptId, businessSkill)];
  state.onboarding.initialHiresCompleted = 2;
  state.onboarding.completedSteps.push('TUT-03', 'TUT-04', 'TUT-05');
  state.phase = 'RUNNING';
  state.speed = 0;
  state.company!.cashYuan = cash;
  return state;
}

function addDept(state: GameState, type: SupportDeptType, staff: number): string {
  createDepartment(state, cfg, type, { commandId: `dept-${type}`, expectedRunId: state.runId });
  const dept = state.departments.find((d) => d.type === type)!;
  for (let i = 0; i < staff; i += 1) {
    state.employees.push(mkEmployee(`${type}-${i}`, dept.deptId));
  }
  return dept.deptId;
}

describe('R30 人才页只读视图', () => {
  it('空公司：人数/月薪为 0，筛选项含全部与主营，列表为空', () => {
    const state = running();
    state.employees = [];
    const ov = buildTalentOverview(state);
    expect(ov.allHeadcount).toBe(0);
    expect(ov.allMonthlyPayrollYuan).toBe(0);
    expect(ov.rows).toEqual([]);
    expect(ov.filters.map((f) => f.key)).toEqual(['ALL', state.departments[0]!.deptId]);
    expect(ov.filters.every((f) => f.headcount === 0)).toBe(true);
  });

  it('筛选口径：按部门聚合人数与月薪，全部=各部门之和', () => {
    const state = running();
    const procId = addDept(state, 'PROCUREMENT', 1);
    state.departments.find((d) => d.deptId === procId)!.staffingMode = 'LOCKED';
    const all = buildTalentOverview(state);
    expect(all.allHeadcount).toBe(3);
    expect(all.allMonthlyPayrollYuan).toBe(15_000);
    expect(all.filters.find((f) => f.key === procId)).toMatchObject({ headcount: 1, monthlyPayrollYuan: 5_000 });

    const scoped = buildTalentOverview(state, procId);
    expect(scoped.headcount).toBe(1);
    expect(scoped.monthlyPayrollYuan).toBe(5_000);
    expect(scoped.allHeadcount).toBe(3);
    expect(scoped.rows).toHaveLength(1);
    expect(scoped.rows[0]!.deptId).toBe(procId);

    const emptyScope = buildTalentOverview(state, 'not-exist');
    expect(emptyScope.headcount).toBe(0);
    expect(emptyScope.rows).toEqual([]);
    expect(emptyScope.allHeadcount).toBe(3);
  });

  it('入职月数：入职当月记 1，之后逐月递增', () => {
    const state = running();
    state.gameYear = 1;
    state.gameMonth = 4;
    const ov = buildTalentOverview(state);
    expect(ov.rows[0]!.tenureMonths).toBe(4);
    state.gameMonth = 12;
    expect(buildTalentOverview(state).rows[0]!.tenureMonths).toBe(12);
  });

  it('排序：主营优先，同部门按工资降序且稳定', () => {
    const state = running();
    state.employees[0]!.salaryMonthlyYuan = 6000;
    const procId = addDept(state, 'PROCUREMENT', 1);
    const ov = buildTalentOverview(state);
    expect(ov.rows.map((r) => r.employeeId)).toEqual(['b1', 'b2', 'PROCUREMENT-0']);
    expect(ov.rows[0]!.salaryMonthlyYuan).toBe(6000);
    expect(ov.rows[1]!.deptId).toBe(state.departments[0]!.deptId);
    expect(ov.rows[2]!.deptId).toBe(procId);
  });

  it('调岗预览：原/目标人数前后变化正确，工资总额不变，下月生效', () => {
    const state = running();
    const procId = addDept(state, 'PROCUREMENT', 0);
    const impact = buildTransferImpact(state, cfg, 'b1', procId)!;
    expect(impact.fromHeadcountBefore).toBe(2);
    expect(impact.fromHeadcountAfter).toBe(1);
    expect(impact.toHeadcountBefore).toBe(0);
    expect(impact.toHeadcountAfter).toBe(1);
    expect(impact.payrollBeforeYuan).toBe(impact.payrollAfterYuan);
    expect(impact.effectiveGameYear).toBe(1);
    expect(impact.effectiveGameMonth).toBe(2);
    expect(impact.businessCapacityLossYuan).toBeGreaterThan(0);
  });

  it('调岗确认：命令生效后员工只出现一次，且次月归属新部门', () => {
    const state = running();
    const procId = addDept(state, 'PROCUREMENT', 0);
    transferEmployee(state, 'b1', procId, {
      commandId: 'move-1',
      expectedRunId: state.runId,
    });
    const ov = buildTalentOverview(state);
    expect(ov.rows.filter((row) => row.employeeId === 'b1')).toHaveLength(1);
    expect(ov.rows.find((row) => row.employeeId === 'b1')!.pendingDeptId).toBe(procId);
    expect(ov.allMonthlyPayrollYuan).toBe(10_000);
    // 当月未到生效月：仍按原部门计薪/产能
    expect(ov.rows.find((row) => row.employeeId === 'b1')!.deptId).toBe(state.departments[0]!.deptId);

    // 生效月结：归属切到新部门，且移除 pending 字段后存档仍可深拷贝、
    // 下一月结仍能正常推进（回归：赋 undefined 会让整局不可提交，时钟静默卡死）
    advanceMonth(state, cfg);
    const moved = state.employees.find((e) => e.employeeId === 'b1')!;
    expect(moved.departmentId).toBe(procId);
    expect(moved.transferFromMonthIndex).toBeNull();
    expect(Object.prototype.hasOwnProperty.call(moved, 'pendingDepartmentId')).toBe(false);
    expect(() => cloneGameState(state)).not.toThrow();
    advanceMonth(state, cfg);
  });

  it('调岗目标排除当前部门，且未建部门不在候选中', () => {
    const state = running();
    const procId = addDept(state, 'PROCUREMENT', 0);
    const targets = transferTargets(state, 'b1');
    expect(targets.map((t) => t.deptId)).toEqual([procId]);
    expect(targets.every((t) => state.departments.some((d) => d.deptId === t.deptId && d.enabled))).toBe(true);
  });

  it('裁员：补偿只扣一次，裁后状态为次月离岗，次月不再计薪且不再出列表', () => {
    const state = running();
    const procId = addDept(state, 'PROCUREMENT', 1);
    const before = buildTalentOverview(state);
    const cashBefore = state.company!.cashYuan;
    const pv = previewLayoff(state, 'PROCUREMENT-0', Date.now());
    const token = createLayoffToken(pv, Date.now());
    const now = Date.now();
    confirmLayoff(state, cfg, token, { commandId: 'lay-1', expectedRunId: state.runId }, now);
    const cashAfterFirst = state.company!.cashYuan;
    expect(cashAfterFirst).toBe(cashBefore - pv.severanceYuan);

    // 同 commandId 重放不重复扣款
    confirmLayoff(state, cfg, token, { commandId: 'lay-1', expectedRunId: state.runId }, now);
    expect(state.company!.cashYuan).toBe(cashAfterFirst);

    const pending = buildTalentOverview(state);
    const target = pending.rows.find((row) => row.employeeId === 'PROCUREMENT-0')!;
    expect(target.status).toBe('PENDING_DISMISSAL');
    expect(target.deptId).toBe(procId);

    advanceMonth(state, cfg);
    const after = buildTalentOverview(state);
    expect(after.rows.some((row) => row.employeeId === 'PROCUREMENT-0')).toBe(false);
    expect(after.allMonthlyPayrollYuan).toBe(before.allMonthlyPayrollYuan - 5_000);
  });

  it('产能损失：裁主营员工 >0；裁支持部门员工为 0', () => {
    const state = running(80);
    expect(estimateLayoffCapacityLoss(state, cfg, 'b1')).toBeGreaterThan(0);
    addDept(state, 'PROCUREMENT', 1);
    expect(estimateLayoffCapacityLoss(state, cfg, 'PROCUREMENT-0')).toBe(0);
  });
});
