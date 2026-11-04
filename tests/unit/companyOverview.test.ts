import { describe, it, expect, beforeAll } from 'vitest';
import rawEconomy from '../../assets/resources/config/economy.v1.json';
import { registerConfig } from '@core/config/configLoader';
import type { EconomyConfig } from '@core/config/EconomyConfig';
import { createInitialState } from '@core/domain/gameStateFactory';
import { createCompany } from '@core/application/CompanyService';
import { buildCompanyOverview } from '@core/application/CompanyOverviewService';
import { previewInvest } from '@core/application/InvestmentService';
import type { Employee, GameState } from '@core/domain/types';

let cfg: EconomyConfig;
beforeAll(() => {
  cfg = registerConfig(rawEconomy as never);
});

function runningCompany(seed = 900, cash = 300_000): GameState {
  const state = createInitialState(1000, seed);
  createCompany(
    state,
    { companyName: '首页公司', industry: 'TRADE', ceoName: 'CEO', ceoTrait: 'BOLD' },
    { commandId: 'c', expectedRunId: state.runId },
  );
  const deptId = state.departments[0]!.deptId;
  const mk = (id: string, salary = 5000): Employee => ({
    employeeId: id,
    name: id,
    avatarId: 'a',
    departmentId: deptId,
    skill: 60,
    potential: 60,
    teamwork: 50,
    personality: 'STEADY',
    salaryMonthlyYuan: salary,
    hiredAtMonthIndex: 0,
    effectiveFromMonthIndex: 0,
    dismissedAtMonthIndex: null,
    status: 'ACTIVE',
  });
  state.employees = [mk('e1'), mk('e2')];
  state.phase = 'RUNNING';
  state.company!.cashYuan = cash;
  return state;
}

describe('R28 公司首页只读视图', () => {
  it('现金/累计收支/产能/需求都来自领域，且读取不改状态', () => {
    const state = runningCompany();
    const before = JSON.stringify(state);
    const vm = buildCompanyOverview(state, cfg)!;
    expect(vm.cashYuan).toBe(state.company!.cashYuan);
    expect(vm.ytdRevenueYuan).toBe(0);
    expect(vm.ytdProfitYuan).toBe(0);
    expect(vm.monthlyCapacityYuan).toBeGreaterThan(0);
    expect(vm.monthlyPotentialOrderYuan).toBe(60_000); // TRADE 首年 72 万/12
    expect(vm.capacityCoeffBps).toBe(10_000);
    expect(JSON.stringify(state)).toBe(before);
  });

  it('产能高于当月需求时给出闲置风险；需求与月结同口径', () => {
    const state = runningCompany(901);
    const vm = buildCompanyOverview(state, cfg)!;
    expect(vm.monthlyCapacityYuan).toBeGreaterThan(vm.monthlyPotentialOrderYuan);
    expect(vm.idleRisk).toBe(true);
  });

  it('风险等级来自 assessRisk：现金不足 6 个月刚性费用为 WARNING', () => {
    const state = runningCompany(902, 20_000);
    const vm = buildCompanyOverview(state, cfg)!;
    expect(vm.risk.level).toBe('WARNING');
    expect(vm.risk.cash).toBe(20_000);
    expect(vm.risk.sixMonthNeed).toBeGreaterThan(20_000);
  });
});

describe('R28 扩产预览（真实查询）', () => {
  it('预览返回现金/资产/产能前后与闲置风险，不写入状态', () => {
    const state = runningCompany(903);
    const cash = state.company!.cashYuan;
    const asset = state.company!.businessAssetBookYuan;
    const p = previewInvest(state, cfg, 10_000);
    expect(p.valid).toBe(true);
    expect(p.cashAfter).toBe(cash - 10_000);
    expect(p.assetBookAfter).toBe(asset + 10_000);
    expect(p.capacityCoeffBeforeBps).toBe(10_000);
    expect(p.capacityCoeffAfterBps).toBe(10_150);
    expect(p.monthlyCapacityAfterYuan).toBeGreaterThan(p.monthlyCapacityBeforeYuan);
    expect(p.idleRiskAfter).toBe(p.monthlyCapacityAfterYuan > p.monthlyPotentialOrderYuan);
    expect(state.company!.cashYuan).toBe(cash);
    expect(state.company!.businessAssetBookYuan).toBe(asset);
  });

  it('现金不足时预览 valid=false，不抛错也不扣款', () => {
    const state = runningCompany(904, 5_000);
    const p = previewInvest(state, cfg, 10_000);
    expect(p.valid).toBe(false);
    expect(p.reason).toBe('INSUFFICIENT_CASH');
    expect(state.company!.cashYuan).toBe(5_000);
  });

  it('非 1 万元整数倍预览无效', () => {
    const p = previewInvest(runningCompany(905), cfg, 15_000);
    expect(p.valid).toBe(false);
    expect(p.reason).toBe('INVALID_AMOUNT');
  });
});
