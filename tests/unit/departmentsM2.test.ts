import { describe, it, expect, beforeAll } from 'vitest';
import rawEconomy from '../../assets/resources/config/economy.v1.json';
import { registerConfig } from '@core/config/configLoader';
import type { EconomyConfig } from '@core/config/EconomyConfig';
import { createInitialState } from '@core/domain/gameStateFactory';
import { createCompany } from '@core/application/CompanyService';
import { advanceMonth } from '@core/simulation/advanceMonth';
import {
  createDepartment,
  previewCreateDepartment,
} from '@core/application/DepartmentService';
import { procurementEffect } from '@core/simulation/departments';
import type { Employee, GameState, IndustryId } from '@core/domain/types';

let cfg: EconomyConfig;
beforeAll(() => {
  cfg = registerConfig(rawEconomy as never);
});

/** 标准档：公司+2 名业务员工（skill60/team50），phase=RUNNING，可注入业务部外的支持员工。 */
function runWithBusiness(
  industry: IndustryId,
  businessSalary: number,
  cash = 1_000_000,
): GameState {
  const state = createInitialState(1_000, 20261101);
  createCompany(
    state,
    { companyName: 'M2标准公司', industry, ceoName: '林启航', ceoTrait: 'BOLD' },
    { commandId: 'create', expectedRunId: state.runId },
  );
  const biz = state.departments[0]!;
  const mk = (id: string, salary: number, deptId = biz.deptId, skill = 60): Employee => ({
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
  });
  state.employees = [mk('b1', businessSalary), mk('b2', businessSalary)];
  state.onboarding.initialHiresCompleted = 2;
  state.onboarding.completedSteps.push('TUT-03', 'TUT-04', 'TUT-05');
  state.phase = 'RUNNING';
  state.speed = 1;
  state.company!.cashYuan = cash;
  return state;
}

function makeSupportEmployee(
  state: GameState,
  deptId: string,
  id: string,
  skill = 60,
  salary = 5000,
): Employee {
  const emp: Employee = {
    employeeId: id,
    name: id,
    avatarId: 'avatar_02',
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
  };
  state.employees.push(emp);
  return emp;
}

describe('M2-04 部门创建 / 去重 / 0员工无效益', () => {
  it('G013/B06: 采购部不存在或存在但0人，节省均为0；重复建部门拒绝且只扣一次（连点）', () => {
    const state = runWithBusiness('TRADE', 5000, 1_000_000);
    // 无采购部：直接结一年，直成与黄金一致（60% 收入）
    for (let i = 0; i < 12; i++) advanceMonth(state, cfg);
    const repNone = state.annualReports[0]!;
    expect(repNone.directCostYuan).toBe(-432_000);

    // 建采购部但 0 员工：再来一年，节省仍为 0（直成率不变，需求年增 10%）
    const pv = previewCreateDepartment(state, cfg, 'PROCUREMENT');
    expect(pv.feeYuan).toBe(10_000);
    const cashBefore = state.company!.cashYuan;
    createDepartment(state, cfg, 'PROCUREMENT', { commandId: 'mk-proc', expectedRunId: state.runId });
    expect(state.company!.cashYuan).toBe(cashBefore - 10_000);
    // 重复创建拒绝
    expect(() =>
      createDepartment(state, cfg, 'PROCUREMENT', { commandId: 'mk-proc-2', expectedRunId: state.runId }),
    ).toThrow(/DEPT_ALREADY_EXISTS/);
    for (let i = 0; i < 12; i++) advanceMonth(state, cfg);
    // 第2年需求 792000，产能受限于 2 名业务员工（800000），收入=792000；直成 60%
    const rep2 = state.annualReports.find((r) => r.year === 2)!;
    expect(rep2.directCostYuan).toBe(-475_200);
  });

  it('新建部门默认 LOCKED/targetCount=0 且不送员工', () => {
    const state = runWithBusiness('TRADE', 5000);
    createDepartment(state, cfg, 'HR', { commandId: 'mk-hr', expectedRunId: state.runId });
    const hr = state.departments.find((d) => d.type === 'HR')!;
    expect(hr.staffingMode).toBe('LOCKED');
    expect(hr.targetCount).toBe(0);
    expect(state.employees).toHaveLength(2);
  });
});

describe('M2-05 部门量化效益（G004 / G014 / G015）', () => {
  it('G004: 收入160万、直成率60%、采购适用95%、1名skill60采购 → 年节省 91200，只减一次', () => {
    // 直接按黄金公式验证：可适用直成 = 1,600,000 × 60% × 95% = 912,000；采购 1 人系数 10%
    const state = runWithBusiness('TRADE', 5000, 5_000_000);
    const proc = createDepartment(state, cfg, 'PROCUREMENT', {
      commandId: 'mk-p', expectedRunId: state.runId,
    }).department;
    makeSupportEmployee(state, proc.deptId, 'p1', 60, 5000);

    const revenue = 1_600_000;
    const directGross = Math.round((revenue * cfg.industry.TRADE.directCostBps) / 10_000);
    const eligible = Math.round(
      (directGross * cfg.industry.TRADE.procurementEligibleDirectCostBps) / 10_000,
    );
    const staff = state.employees.filter((e) => e.departmentId === proc.deptId);
    const eff = procurementEffect(cfg, staff);
    const save = Math.round((eligible * eff.effectBps) / 10_000);

    expect(directGross).toBe(960_000);
    expect(eligible).toBe(912_000);
    expect(eff.effectBps).toBe(1_000);
    expect(save).toBe(91_200);
  });

  it('G004(端到端): 首年收入72万下1名采购，直成净 390960，采购工资另计、设立费另计', () => {
    const state = runWithBusiness('TRADE', 5000, 5_000_000);
    const proc = createDepartment(state, cfg, 'PROCUREMENT', {
      commandId: 'mk-pe2e', expectedRunId: state.runId,
    }).department;
    makeSupportEmployee(state, proc.deptId, 'p1', 60, 5000);
    for (let i = 0; i < 12; i++) advanceMonth(state, cfg);
    const rep = state.annualReports[0]!;
    // 可适用直成 = 432000 × 95% = 410400；省 10% = 41040 → 净 390960
    expect(rep.directCostYuan).toBe(-390_960);
    // 采购员工资另计（业务 2×5000 + 采购 5000）×12=180000
    expect(rep.payrollYuan).toBe(-180_000);
    expect(rep.deptSetupCostYuan).toBe(-10_000);
  });

  it('G014: 客服 1 人 skill60 节省售后 35%，不从直成再减', () => {
    const state = runWithBusiness('TRADE', 5000, 5_000_000);
    const cs = createDepartment(state, cfg, 'CUSTOMER_SERVICE', {
      commandId: 'mk-cs', expectedRunId: state.runId,
    }).department;
    makeSupportEmployee(state, cs.deptId, 'cs1', 60, 5000);
    for (let i = 0; i < 12; i++) advanceMonth(state, cfg);
    const rep = state.annualReports[0]!;
    // 毛售后 = 720000 × 2% = 14400；省 35% = 5040；净 9360
    expect(rep.afterSalesCostYuan).toBe(-9360);
    // 直成不变（客服只作用于售后）
    expect(rep.directCostYuan).toBe(-432_000);
  });

  it('G015/G016: 财务 1 人 skill60 按 20% 合并节省「固定管理费+其他可控运营费」，先抵固定再抵其他', () => {
    const state = runWithBusiness('TRADE', 5000, 5_000_000);
    const fin = createDepartment(state, cfg, 'FINANCE', {
      commandId: 'mk-fin', expectedRunId: state.runId,
    }).department;
    makeSupportEmployee(state, fin.deptId, 'fin1', 60, 5000);
    for (let i = 0; i < 12; i++) advanceMonth(state, cfg);
    const rep = state.annualReports[0]!;
    // 毛额：固定管理费 48000；其他可控运营费 = 720000 × 8% = 57600
    // 财务省 20%（基数 105600）= 21120，未超固定费 → 全部抵固定，其他运营费不减
    expect(rep.fixedCostYuan).toBe(-(48_000 - 21_120)); // -26880
    expect(rep.otherOperatingCostYuan).toBe(-57_600);
    // 财务员工年工资另减（业务 2×5000 + 财务 5000）×12
    expect(rep.payrollYuan).toBe(-(10_000 * 12 + 60_000));
  });

  it('G016(黄金口径): 固定48000+其他152000、财务1人20% → 省40000，抵固定40000、其他0，费率只应用一次', () => {
    const fixedGross = 48_000;
    const otherGross = 152_000;
    const effectBps = 2_000; // 1 名 skill60 财务
    const save = Math.round(((fixedGross + otherGross) * effectBps) / 10_000);
    const saveFixed = Math.min(fixedGross, save);
    const saveOther = Math.max(0, save - saveFixed);
    expect(save).toBe(40_000);
    expect(saveFixed).toBe(40_000);
    expect(saveOther).toBe(0);
    expect(fixedGross - saveFixed).toBe(8_000);
    expect(otherGross - saveOther).toBe(152_000);
    // 合计净费用 = 毛合计 − 单次节省（不重复扣）
    expect(fixedGross + otherGross - save).toBe(160_000);
  });

  it('G016(溢出): 节省超过固定管理费时余额才抵其他可控费，且不产生负费用', () => {
    const fixedGross = 10_000;
    const otherGross = 90_000;
    const effectBps = 4_000; // 构造 40% 命中封顶口径
    const save = Math.round(((fixedGross + otherGross) * effectBps) / 10_000);
    const saveFixed = Math.min(fixedGross, save);
    const saveOther = Math.min(otherGross, Math.max(0, save - saveFixed));
    expect(save).toBe(40_000);
    expect(saveFixed).toBe(10_000);
    expect(saveOther).toBe(30_000);
    expect(fixedGross - saveFixed).toBe(0); // 不出现负固定费
    expect(otherGross - saveOther).toBe(60_000);
  });
});
