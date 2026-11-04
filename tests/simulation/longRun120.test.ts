import { describe, expect, it } from 'vitest';
import { registerConfig } from '@core/config/configLoader';
import type { EconomyConfig } from '@core/config/EconomyConfig';
import rawEconomy from '../../assets/resources/config/economy.v1.json';
import { createInitialState } from '@core/domain/gameStateFactory';
import { createCompany } from '@core/application/CompanyService';
import { getOffer } from '@core/application/OfferService';
import { hireEmployee, startOperating } from '@core/application/RecruitmentService';
import { runMonthlyAutoHire } from '@core/application/AutoHireService';
import { advanceMonth } from '@core/simulation/advanceMonth';
import { playerYears } from '@core/simulation/leaderboard';
import { SaveRepository } from '@core/persistence/SaveRepository';
import { MemoryStorage } from '../helpers/MemoryStorage';

const cfg = registerConfig(rawEconomy as unknown as EconomyConfig);

describe('R40 120-year persistence boundary', () => {
  it('retains the last 100 annual reports while preserving 120 operated years through save/reload', async () => {
    const state = createInitialState(1_000, 7919);
    createCompany(state, { companyName: '长期边界公司', industry: 'SOFTWARE', ceoName: '林启航', ceoTrait: 'BOLD' },
      { commandId: 'create', expectedRunId: state.runId });
    const deptId = state.departments[0]!.deptId;
    const firstOffer = getOffer(state, deptId);
    hireEmployee(state, cfg, { offerId: firstOffer.offerId, candidateId: firstOffer.candidates[0]!.candidateId, departmentId: deptId },
      { commandId: 'hire-1', expectedRunId: state.runId });
    const secondOffer = getOffer(state, deptId);
    hireEmployee(state, cfg, { offerId: secondOffer.offerId, candidateId: secondOffer.candidates[1]!.candidateId, departmentId: deptId },
      { commandId: 'hire-2', expectedRunId: state.runId });
    startOperating(state, { commandId: 'start', expectedRunId: state.runId });

    let months = 0;
    const autoHiresByYear = new Map<number, number>();
    const seenMonthKeys = new Set<string>();
    for (; months < 120 * 12 && state.phase === 'RUNNING'; months++) {
      const monthKey = `${state.runId}:${state.gameYear}:${state.gameMonth}`;
      expect(seenMonthKeys.has(monthKey)).toBe(false);
      seenMonthKeys.add(monthKey);
      const decision = runMonthlyAutoHire(state, cfg);
      if (decision.hired) {
        const count = (autoHiresByYear.get(state.gameYear) ?? 0) + 1;
        autoHiresByYear.set(state.gameYear, count);
        expect(count).toBeLessThanOrEqual(3);
      }
      advanceMonth(state, cfg);
      const company = state.company!;
      const ledger = state.monthlyLedgersRolling[state.monthlyLedgersRolling.length - 1]!;
      for (const value of [company.cashYuan, company.businessAssetBookYuan, company.businessCapacityInvestmentYuan,
        ...state.employees.map((employee) => employee.salaryMonthlyYuan), ledger.cashDeltaYuan, ledger.profitYuan]) {
        expect(Number.isSafeInteger(value)).toBe(true);
      }
      expect(ledger.runId).toBe(state.runId);
      const ledgerProfit = ledger.revenueYuan + ledger.directCostYuan + ledger.otherOperatingCostYuan
        + ledger.afterSalesCostYuan + ledger.fixedCostYuan + ledger.payrollYuan
        + ledger.recruitmentCostYuan + ledger.severanceCostYuan + ledger.deptSetupCostYuan
        + ledger.eventCostYuan + ledger.depreciationYuan;
      expect(ledger.profitYuan).toBe(ledgerProfit);
      expect(state.monthlyLedgersRolling.length).toBeLessThanOrEqual(120);
      const eventKeys = state.annualEvents.map((event) => `${state.runId}:${event.year}`);
      expect(new Set(eventKeys).size).toBe(eventKeys.length);
    }
    expect(months).toBe(120 * 12);
    expect(state.gameYear).toBe(121);
    expect(playerYears(state)).toBe(120);
    expect(state.annualReports).toHaveLength(100);
    expect(state.annualReports[0]?.year).toBe(21);
    expect(state.annualReports[99]?.year).toBe(120);
    expect(state.annualReports.every((report) => report.cashBridge?.balanced === true)).toBe(true);
    expect(seenMonthKeys.size).toBe(120 * 12);

    const storage = new MemoryStorage();
    const repo = new SaveRepository(storage);
    await repo.commit(state, { revision: 1, resetGeneration: 0, expectedBase: null });
    const loaded = await repo.load();
    expect(loaded?.state.gameYear).toBe(121);
    expect(playerYears(loaded!.state)).toBe(120);
    expect(loaded?.state.annualReports).toHaveLength(100);
  });
});
