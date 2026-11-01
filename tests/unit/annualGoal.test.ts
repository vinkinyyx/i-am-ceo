import { describe, it, expect, beforeAll } from 'vitest';
import rawEconomy from '../../assets/resources/config/economy.v1.json';
import { registerConfig } from '@core/config/configLoader';
import type { EconomyConfig } from '@core/config/EconomyConfig';
import { createInitialState } from '@core/domain/gameStateFactory';
import { createCompany } from '@core/application/CompanyService';
import { GameClock } from '@core/simulation/GameClock';
import type { Employee, GameState } from '@core/domain/types';

let cfg: EconomyConfig;
beforeAll(() => {
  cfg = registerConfig(rawEconomy as never);
});

function runningCompany(industry: 'TRADE' | 'SOFTWARE' | 'SERVICE', salary: number, trait: 'BOLD' | 'STEADY' | 'PEOPLE', seed: number): GameState {
  const state = createInitialState(1000, seed);
  createCompany(
    state,
    { companyName: '连盈测试', industry, ceoName: 'CEO', ceoTrait: trait },
    { commandId: 'c', expectedRunId: state.runId },
  );
  const deptId = state.departments[0]!.deptId;
  const mk = (id: string): Employee => ({
    employeeId: id, name: id, avatarId: 'a', departmentId: deptId,
    skill: 60, potential: 60, teamwork: 50, personality: 'STEADY', salaryMonthlyYuan: salary,
    hiredAtMonthIndex: 0, effectiveFromMonthIndex: 0, dismissedAtMonthIndex: null, status: 'ACTIVE',
  });
  state.employees = [mk('e1'), mk('e2')];
  // 招聘费在录用时已扣现金并记为第1月 pendingEntry（真实流程口径），计入首年损益
  state.company!.cashYuan = 300_000 - salary * 2;
  state.pendingEntries.push(
    { entryId: 'f1', monthKey: `${state.runId}:1:1`, category: 'RECRUITMENT', amountYuan: -salary, isCash: true, alreadyPaid: true, refId: 'e1' },
    { entryId: 'f2', monthKey: `${state.runId}:1:1`, category: 'RECRUITMENT', amountYuan: -salary, isCash: true, alreadyPaid: true, refId: 'e2' },
  );
  state.phase = 'RUNNING';
  state.speed = 5;
  return state;
}

function runYears(state: GameState, years: number): void {
  const clock = new GameClock();
  for (let y = 0; y < years; y++) {
    // 5× 全年 60000ms
    clock.tick(state, cfg, 60_000);
  }
}

describe('M1-06 年结/连盈/CEO成长', () => {
  it('G011/A12: 连续 3 年利润>0 后目标达成（target3YearsAchieved），仍可继续自由经营', () => {
    const state = runningCompany('TRADE', 5000, 'BOLD', 101);
    runYears(state, 3);
    expect(state.annualReports).toHaveLength(3);
    expect(state.consecutiveProfitableYears).toBe(3);
    expect(state.target3YearsAchieved).toBe(true);
    // 仍可继续推进（不强制结局）
    expect(state.phase).toBe('RUNNING');
    runYears(state, 1);
    expect(state.annualReports).toHaveLength(4);
  });

  it('G010: 某一年亏损会把连续盈利计数清零，存档保留、次年可继续', () => {
    // 用高工资制造年度亏损：2 名 8000 月薪 → 年工资 192000，贸易首年毛利不足
    const state = runningCompany('TRADE', 8000, 'BOLD', 777);
    runYears(state, 1);
    expect(state.annualReports[0]!.profitYuan).toBeLessThan(0);
    expect(state.consecutiveProfitableYears).toBe(0);
    expect(state.target3YearsAchieved).toBe(false);
    // 不删档、不破产
    expect(state.phase).not.toBe('RESETTING');
    expect(state.company).not.toBeNull();
  });

  it('软件行业首年黄金利润 35000', () => {
    const state = runningCompany('SOFTWARE', 6500, 'BOLD', 102);
    runYears(state, 1);
    expect(state.annualReports[0]!.profitYuan).toBe(35_000);
  });

  it('进取 CEO 三年后商业成长 50+6=56（每年商业+2）', () => {
    const state = runningCompany('TRADE', 5000, 'BOLD', 103);
    runYears(state, 3);
    expect(state.ceo!.businessSkill).toBe(56);
    expect(state.ceo!.managementSkill).toBe(53);
    expect(state.ceo!.financeSkill).toBe(53);
  });

  it('稳健 CEO 每年财务+2', () => {
    const state = runningCompany('TRADE', 5000, 'STEADY', 104);
    runYears(state, 1);
    expect(state.ceo!.financeSkill).toBe(52);
    expect(state.ceo!.businessSkill).toBe(51);
  });

  it('亲和 CEO 每年管理+2', () => {
    const state = runningCompany('TRADE', 5000, 'PEOPLE', 105);
    runYears(state, 1);
    expect(state.ceo!.managementSkill).toBe(52);
  });

  it('年报包含完整分类字段与资产=现金+业务资产', () => {
    const state = runningCompany('SERVICE', 6000, 'STEADY', 106);
    runYears(state, 1);
    const r = state.annualReports[0]!;
    expect(r.revenueYuan).toBe(450_000);
    expect(r.profitYuan).toBe(43_500);
    expect(r.assetCloseYuan).toBe(r.cashCloseYuan + 0);
    expect(r.headcountClose).toBe(2);
  });
});
