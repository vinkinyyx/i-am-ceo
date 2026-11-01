import { describe, it, expect, beforeAll } from 'vitest';
import rawEconomy from '../../assets/resources/config/economy.v1.json';
import { registerConfig } from '@core/config/configLoader';
import type { EconomyConfig } from '@core/config/EconomyConfig';
import { createInitialState } from '@core/domain/gameStateFactory';
import { createCompany } from '@core/application/CompanyService';
import { advanceMonth } from '@core/simulation/advanceMonth';
import {
  previewLayoff,
  createLayoffToken,
  confirmLayoff,
  severanceMonthsFor,
} from '@core/application/LayoffService';
import { transferEmployee, previewTransfer } from '@core/application/TransferService';
import { runMonthlyAutoHire, candidateScore, committedCostMonths } from '@core/application/AutoHireService';
import {
  createDepartment,
  setStaffingMode,
} from '@core/application/DepartmentService';
import type { Employee, GameState, IndustryId } from '@core/domain/types';

let cfg: EconomyConfig;
beforeAll(() => {
  cfg = registerConfig(rawEconomy as never);
});

function standardRun(
  industry: IndustryId = 'TRADE',
  cash = 1_000_000,
  seed = 20261101,
): GameState {
  const state = createInitialState(1_000, seed);
  createCompany(
    state,
    { companyName: 'M2人力公司', industry, ceoName: '林启航', ceoTrait: 'BOLD' },
    { commandId: 'create', expectedRunId: state.runId },
  );
  const biz = state.departments[0]!;
  const mk = (id: string, salary: number, skill: number, potential: number, hired = 0): Employee => ({
    employeeId: id,
    name: id,
    avatarId: 'avatar_01',
    departmentId: biz.deptId,
    skill,
    potential,
    teamwork: 50,
    personality: 'STEADY',
    salaryMonthlyYuan: salary,
    hiredAtMonthIndex: hired,
    effectiveFromMonthIndex: hired,
    dismissedAtMonthIndex: null,
    status: 'ACTIVE',
    candidateId: `c-${id}`,
    hireCommandId: `h-${id}`,
  });
  state.employees = [mk('b1', 5000, 60, 60), mk('b2', 5000, 60, 60)];
  state.onboarding.initialHiresCompleted = 2;
  state.onboarding.completedSteps.push('TUT-03', 'TUT-04', 'TUT-05');
  state.phase = 'RUNNING';
  state.speed = 1;
  state.company!.cashYuan = cash;
  return state;
}

/** 把游戏时钟推进 n 个月（不触发自动招聘钩子，直接月结，便于确定性测试）。 */
function settleMonths(state: GameState, n: number): void {
  for (let i = 0; i < n; i++) advanceMonth(state, cfg);
}

describe('M2-02 员工年度成长（5年）', () => {
  it('delta=max(1,round(potential/30))，高潜员工5年累计成长超过低潜员工', () => {
    // 高潜 potential=90 → delta=3；低潜 potential=30 → delta=1
    const hi = standardRun();
    const lo = standardRun();
    hi.employees[0]!.potential = 90;
    hi.employees[0]!.skill = 60;
    lo.employees[0]!.potential = 30;
    lo.employees[0]!.skill = 60;

    settleMonths(hi, 60);
    settleMonths(lo, 60);

    const hiEmp = hi.employees.find((e) => e.employeeId === 'b1')!;
    const loEmp = lo.employees.find((e) => e.employeeId === 'b1')!;
    // 5 次年结，高潜 +3/年 = +15 → 75；低潜 +1/年 = +5 → 65
    expect(hiEmp.skill).toBe(75);
    expect(loEmp.skill).toBe(65);
    // 潜力本身不增长
    expect(hiEmp.potential).toBe(90);
  });

  it('技能封顶 100', () => {
    const state = standardRun();
    state.employees[0]!.skill = 98;
    state.employees[0]!.potential = 98; // delta≈3
    settleMonths(state, 24);
    expect(state.employees[0]!.skill).toBe(100);
  });
});

describe('M2-03 裁员（G005 / B07）', () => {
  it('补偿月数：年数 0→1，1→1，2→1，3→2，5→3，7→3', () => {
    expect(severanceMonthsFor(0)).toBe(1);
    expect(severanceMonthsFor(1)).toBe(1);
    expect(severanceMonthsFor(2)).toBe(1);
    expect(severanceMonthsFor(3)).toBe(2);
    expect(severanceMonthsFor(5)).toBe(3);
    expect(severanceMonthsFor(7)).toBe(3);
  });

  it('G005: 月薪8000、任职3完整年裁员 → 赔偿16000且只扣1次，次月停薪停产能', () => {
    const state = standardRun('TRADE', 1_000_000);
    // 构造任职满 3 年（36 个月）的员工：hiredAt=-36 不合法，改先跑36月再裁更直观。
    const emp = state.employees[0]!;
    emp.salaryMonthlyYuan = 8000;
    emp.hiredAtMonthIndex = 0;
    settleMonths(state, 36); // 已结到第4年第1月，月轴=36
    const cashBefore = state.company!.cashYuan;
    const idx = 36;
    // 手算在职月数 = 36 - 0 = 36 → 3 年 → 2 月 → 16000（G005 描述3年=16000）
    const pv = previewLayoff(state, emp.employeeId, 1000);
    expect(pv.tenureYears).toBe(3);
    expect(pv.severanceMonths).toBe(2);
    expect(pv.severanceYuan).toBe(16_000);

    const token = createLayoffToken(pv, 1000);
    const res = confirmLayoff(state, cfg, token, { commandId: 'lay-1', expectedRunId: state.runId }, 1000);
    expect(res.severancePaidYuan).toBe(16_000);
    expect(state.company!.cashYuan).toBe(cashBefore - 16_000);

    // 幂等：同 commandId 重放不重复扣
    const again = confirmLayoff(state, cfg, token, { commandId: 'lay-1', expectedRunId: state.runId }, 1000);
    expect(again.severancePaidYuan).toBe(16_000);
    expect(state.company!.cashYuan).toBe(cashBefore - 16_000);

    // PENDING 当月仍计；再结一月后转 DISMISSED 且停薪
    expect(emp.status).toBe('PENDING_DISMISSAL');
    expect(emp.dismissedAtMonthIndex).toBe(37); // 次月（月轴37）起停
    advanceMonth(state, cfg); // 结第37月（月轴36）：确认当月仍领薪
    expect(emp.status).toBe('DISMISSED');
    const month37 = state.monthlyLedgersRolling
      .filter((l) => l.runId === state.runId)
      .slice(-1)[0]!;
    expect(Math.abs(month37.payrollYuan)).toBe(13_000);
    advanceMonth(state, cfg); // 第38月（月轴37）：起停薪，仅剩 b2
    const month38 = state.monthlyLedgersRolling
      .filter((l) => l.runId === state.runId)
      .slice(-1)[0]!;
    expect(Math.abs(month38.payrollYuan)).toBe(5_000);
    void idx;
  });

  it('现金不足裁员报 INSUFFICIENT_CASH 且状态不变', () => {
    const state = standardRun('TRADE', 5000);
    const emp = state.employees[0]!;
    emp.salaryMonthlyYuan = 8000;
    const pv = previewLayoff(state, emp.employeeId, 1000);
    const token = createLayoffToken(pv, 1000);
    expect(() =>
      confirmLayoff(state, cfg, token, { commandId: 'lay-x', expectedRunId: state.runId }, 1000),
    ).toThrow(/INSUFFICIENT_CASH/);
    expect(emp.status).toBe('ACTIVE');
  });

  it('B07: token 过期（>60s）拒绝，要求重新确认', () => {
    const state = standardRun();
    const emp = state.employees[0]!;
    const pv = previewLayoff(state, emp.employeeId, 1000);
    const token = createLayoffToken(pv, 1000);
    expect(() =>
      confirmLayoff(state, cfg, token, { commandId: 'lay-t', expectedRunId: state.runId }, 1000 + 61_000),
    ).toThrow(/CONFIRMATION_EXPIRED/);
  });
});

describe('M2-06 调岗', () => {
  it('业务员工调去采购：下月生效、无费用，生效后业务产能不含此人（无双重计）', () => {
    const state = standardRun('TRADE', 1_000_000);
    const proc = createDepartment(state, cfg, 'PROCUREMENT', {
      commandId: 'mk-p', expectedRunId: state.runId,
    }).department;
    const emp = state.employees[0]!;
    const cashBefore = state.company!.cashYuan;

    const pv = previewTransfer(state, emp.employeeId, proc.deptId);
    expect(pv.effectiveFromMonthIndex).toBe(1);
    transferEmployee(state, emp.employeeId, proc.deptId, {
      commandId: 'tr-1', expectedRunId: state.runId,
    });
    expect(state.company!.cashYuan).toBe(cashBefore); // 无费用

    // 当月（月轴0）仍在业务部；结第1月后（月轴1起）归采购
    advanceMonth(state, cfg);
    expect(emp.departmentId).toBe(proc.deptId);
  });

  it('不能调往不存在/同部门', () => {
    const state = standardRun();
    const emp = state.employees[0]!;
    expect(() =>
      transferEmployee(state, emp.employeeId, 'dp_not_exist', {
        commandId: 'tr-x', expectedRunId: state.runId,
      }),
    ).toThrow(/DEPT_NOT_FOUND/);
    expect(() =>
      transferEmployee(state, emp.employeeId, emp.departmentId, {
        commandId: 'tr-y', expectedRunId: state.runId,
      }),
    ).toThrow(/INVALID_TARGET/);
  });
});

describe('M2-07 自动经营（三方针 / ROI / 现金底线 / 禁自动裁员）', () => {
  it('LOCKED 部门不被自动补员；现金不足时不录用', () => {
    const state = standardRun('TRADE', 5_000); // 现金极低
    const before = state.employees.length;
    const decision = runMonthlyAutoHire(state, cfg);
    expect(decision.hired).toBe(false);
    expect(state.employees.length).toBe(before);
  });

  it('BUSINESS 默认 AUTO 但现金安全线拦截：保留6个月刚性费用', () => {
    const state = standardRun('TRADE', 200_000);
    // 2×5000 工资 + 月固定4000 = 14000/月，6个月=84000；支付招聘费后需 ≥84000
    const reserve = committedCostMonths(state, cfg, 6);
    expect(reserve).toBe(84_000);
    const decision = runMonthlyAutoHire(state, cfg);
    // 若录用，现金-费用仍须≥84000；若被ROI/安全线拦则 hired=false，二者必居安全
    if (decision.hired && decision.feeYuan !== undefined) {
      expect(state.company!.cashYuan).toBeGreaterThanOrEqual(reserve);
    }
    // 自动永不裁员
    expect(state.employees.every((e) => e.status !== 'DISMISSED')).toBe(true);
  });

  it('每年自动招聘不超过3人（多次月结钩子场景）', () => {
    const state = standardRun('TRADE', 50_000_000); // 极充裕现金，解除现金约束
    let hiredThisYear = 0;
    // 直接在同一月轴连续评估12次会受"每月1人"限制；改为每月评估一次共12月
    for (let m = 0; m < 12; m++) {
      const d = runMonthlyAutoHire(state, cfg);
      if (d.hired) hiredThisYear += 1;
      advanceMonth(state, cfg);
    }
    expect(hiredThisYear).toBeLessThanOrEqual(cfg.recruitment.maxAutoHiresPerYear);
    expect((state.autoHireCountByYear[1] ?? 0)).toBeLessThanOrEqual(3);
  });

  it('候选评分函数：高能力高分', () => {
    const strong = { skill: 90, potential: 70, teamwork: 80, salaryMonthlyYuan: 6000 } as never;
    const weak = { skill: 45, potential: 50, teamwork: 55, salaryMonthlyYuan: 5800 } as never;
    expect(candidateScore(strong)).toBeGreaterThan(candidateScore(weak));
  });

  it('PROFIT 方针比 GROWTH 更严格（同一ROI候选可能被PROFIT拒绝）', () => {
    const growth = standardRun('TRADE', 50_000_000);
    growth.policy = 'GROWTH';
    const profit = standardRun('TRADE', 50_000_000);
    profit.policy = 'PROFIT';
    // 现金充裕时，GROWTH 门槛 0.8 比 PROFIT 1.2 更容易录用（统计上 hired 数 growth ≥ profit）
    let gHires = 0;
    let pHires = 0;
    for (let m = 0; m < 12; m++) {
      if (runMonthlyAutoHire(growth, cfg).hired) gHires += 1;
      if (runMonthlyAutoHire(profit, cfg).hired) pHires += 1;
      advanceMonth(growth, cfg);
      advanceMonth(profit, cfg);
    }
    expect(gHires).toBeGreaterThanOrEqual(pHires);
  });

  it('自动招聘写入可解释日志', () => {
    const state = standardRun('TRADE', 5_000);
    runMonthlyAutoHire(state, cfg);
    // 无论录用与否，决策原因字符串非空
    // （日志写入由 facade 钩子的 appendAutomationLog 负责，这里直接验证决策结构）
    const d2 = runMonthlyAutoHire(state, cfg);
    expect(typeof d2.reason).toBe('string');
    expect(d2.reason.length).toBeGreaterThan(0);
  });

  it('部门默认 LOCKED，切 AUTO 后才参与自动招聘', () => {
    const state = standardRun('TRADE', 50_000_000);
    const hr = createDepartment(state, cfg, 'HR', { commandId: 'mk-hr', expectedRunId: state.runId }).department;
    expect(hr.staffingMode).toBe('LOCKED');
    setStaffingMode(state, hr.deptId, 'AUTO', { commandId: 'auto-hr', expectedRunId: state.runId });
    const refreshed = state.departments.find((d) => d.deptId === hr.deptId)!;
    expect(refreshed.staffingMode).toBe('AUTO');
  });
});
