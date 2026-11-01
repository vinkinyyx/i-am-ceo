import { describe, it, expect, beforeAll } from 'vitest';
import rawEconomy from '../../assets/resources/config/economy.v1.json';
import { registerConfig } from '@core/config/configLoader';
import type { EconomyConfig } from '@core/config/EconomyConfig';
import { createInitialState } from '@core/domain/gameStateFactory';
import { createCompany } from '@core/application/CompanyService';
import {
  investInBusiness,
  previewInvest,
} from '@core/application/InvestmentService';
import { businessAssetCoeffBps } from '@core/simulation/capacity';
import { GameClock } from '@core/simulation/GameClock';
import type { Employee, GameState } from '@core/domain/types';
import { GameErrorCode } from '@core/domain/errors';

let cfg: EconomyConfig;
beforeAll(() => {
  cfg = registerConfig(rawEconomy as never);
});

function runningCompany(seed = 700, cash = 300_000): GameState {
  const state = createInitialState(1000, seed);
  createCompany(
    state,
    { companyName: '扩产公司', industry: 'TRADE', ceoName: 'CEO', ceoTrait: 'BOLD' },
    { commandId: 'c', expectedRunId: state.runId },
  );
  const deptId = state.departments[0]!.deptId;
  const mk = (id: string, salary = 5000): Employee => ({
    employeeId: id, name: id, avatarId: 'a', departmentId: deptId,
    skill: 60, potential: 60, teamwork: 50, personality: 'STEADY', salaryMonthlyYuan: salary,
    hiredAtMonthIndex: 0, effectiveFromMonthIndex: 0, dismissedAtMonthIndex: null, status: 'ACTIVE',
  });
  state.employees = [mk('e1'), mk('e2')];
  state.phase = 'RUNNING';
  state.speed = 5;
  state.company!.cashYuan = cash;
  return state;
}

describe('M1-07 主营业务扩产', () => {
  it('G007: 投资 10000 现金→资产，即时总资产不变，产能 +1.5%', () => {
    const state = runningCompany();
    const cashBefore = state.company!.cashYuan;
    const assetsBefore = state.company!.businessAssetBookYuan;
    const r = investInBusiness(state, cfg, 10_000);
    expect(state.company!.cashYuan).toBe(cashBefore - 10_000);
    expect(state.company!.businessAssetBookYuan).toBe(assetsBefore + 10_000);
    // 总资产（现金+业务资产）不变
    expect(r.cashAfter + r.assetBookAfter).toBe(cashBefore + assetsBefore);
    expect(r.capacityCoeffAfterBps - r.capacityCoeffBeforeBps).toBe(150);
    expect(businessAssetCoeffBps(cfg, 10_000)).toBe(10_150);
  });

  it('只接受 10000 的正整数倍', () => {
    expect(() => investInBusiness(runningCompany(701), cfg, 5000)).toThrow(GameErrorCode.INVALID_AMOUNT);
    expect(() => investInBusiness(runningCompany(702), cfg, 15_000)).toThrow(GameErrorCode.INVALID_AMOUNT);
    expect(() => investInBusiness(runningCompany(703), cfg, 0)).toThrow(GameErrorCode.INVALID_AMOUNT);
    expect(() => investInBusiness(runningCompany(704), cfg, -10_000)).toThrow(GameErrorCode.INVALID_AMOUNT);
  });

  it('现金不足拒绝（不产生半笔投资）', () => {
    const state = runningCompany(705, 5000);
    expect(() => investInBusiness(state, cfg, 10_000)).toThrow(GameErrorCode.INSUFFICIENT_CASH);
    expect(state.company!.cashYuan).toBe(5000);
    expect(state.company!.businessAssetBookYuan).toBe(0);
  });

  it('产能加成封顶 +30%（20 万元即封顶，之后不再增加）', () => {
    expect(businessAssetCoeffBps(cfg, 200_000)).toBe(13_000);
    expect(businessAssetCoeffBps(cfg, 500_000)).toBe(13_000);
  });

  it('预览不改变状态', () => {
    const state = runningCompany(706);
    const cash = state.company!.cashYuan;
    const p = previewInvest(state, cfg, 30_000);
    expect(p.valid).toBe(true);
    expect(p.cashAfter).toBe(cash - 30_000);
    expect(state.company!.cashYuan).toBe(cash);
  });

  it('扩产 CAPEX 不计当期利润：投资当年利润仍为黄金 38000', () => {
    const state = runningCompany(707);
    // 追加招聘费 pending 以对齐黄金首年损益口径
    state.pendingEntries.push(
      { entryId: 'f1', monthKey: `${state.runId}:1:1`, category: 'RECRUITMENT', amountYuan: -10000, isCash: true, alreadyPaid: true, refId: 'x' },
    );
    investInBusiness(state, cfg, 10_000);
    new GameClock().tick(state, cfg, 60_000);
    const report = state.annualReports[0]!;
    expect(report.profitYuan).toBe(38_000);
    // 资产存在；现金因投资减少 1 万
    expect(state.company!.businessAssetBookYuan).toBeGreaterThan(0);
  });

  it('年结后业务资产按 10% 折旧（影响次年，不追溯本年）', () => {
    const state = runningCompany(708);
    investInBusiness(state, cfg, 100_000); // 100000 资产
    new GameClock().tick(state, cfg, 60_000); // 走完第1年触发年结折旧
    // 年结后账面 = 100000 * 0.9 = 90000
    expect(state.company!.businessAssetBookYuan).toBe(90_000);
  });
});
