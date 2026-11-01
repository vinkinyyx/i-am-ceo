import type { EconomyConfig } from '../config/EconomyConfig';
import type { AnnualReport, Ceo, GameState } from '../domain/types';

/**
 * 年结（设计文档 03.8 / 03.10 / 05.2 / 05.5）。
 * - 汇总当年 12 个月 Ledger，利润=月利润之和；现金勾稽：cashOpen = cashClose - ΣcashDelta。
 * - 连续盈利年数：>0 累加，否则归零；满 3 设置目标（不中断后续经营）。
 * - CEO 年度成长按性格（M1 无年中调薪事件）。
 * - 年报入册（最多保留配置年数）。
 */

const CEO_GROWTH: Record<Ceo['trait'], { business: number; management: number; finance: number }> = {
  BOLD: { business: 2, management: 1, finance: 1 },
  STEADY: { business: 1, management: 1, finance: 2 },
  PEOPLE: { business: 1, management: 2, finance: 1 },
};

function sum(values: number[]): number {
  return values.reduce((s, v) => s + v, 0);
}

export function annualSettlement(
  state: GameState,
  cfg: EconomyConfig,
  cashOpen: number,
): AnnualReport {
  if (!state.company || !state.ceo) {
    throw new Error('NOT_READY');
  }
  const year = state.gameYear;
  const ledgers = state.monthlyLedgersRolling.filter(
    (l) => l.runId === state.runId && l.year === year,
  );

  const revenue = sum(ledgers.map((l) => l.revenueYuan));
  const directCost = sum(ledgers.map((l) => l.directCostYuan));
  const otherOperating = sum(ledgers.map((l) => l.otherOperatingCostYuan));
  const afterSales = sum(ledgers.map((l) => l.afterSalesCostYuan));
  const fixed = sum(ledgers.map((l) => l.fixedCostYuan));
  const payroll = sum(ledgers.map((l) => l.payrollYuan));
  const recruitment = sum(ledgers.map((l) => l.recruitmentCostYuan));
  const severance = sum(ledgers.map((l) => l.severanceCostYuan));
  const deptSetup = sum(ledgers.map((l) => l.deptSetupCostYuan));
  const event = sum(ledgers.map((l) => l.eventCostYuan));
  const depreciation = sum(ledgers.map((l) => l.depreciationYuan));
  const annualProfit = sum(ledgers.map((l) => l.profitYuan));

  const cashClose = state.company.cashYuan;
  // cashOpen 由 advanceMonth 传入（该年第1月结算前现金，M1 即 30 万注资口径）

  // 连续盈利
  if (annualProfit > 0) {
    state.consecutiveProfitableYears += 1;
  } else {
    state.consecutiveProfitableYears = 0;
  }
  if (state.consecutiveProfitableYears >= cfg.player.continuousProfitYearsForGoal) {
    state.target3YearsAchieved = true;
  }

  // CEO 年度成长（封顶 100）
  const g = CEO_GROWTH[state.ceo.trait];
  const ceo: Ceo = state.ceo;
  ceo.businessSkill = Math.min(100, ceo.businessSkill + g.business);
  ceo.managementSkill = Math.min(100, ceo.managementSkill + g.management);
  ceo.financeSkill = Math.min(100, ceo.financeSkill + g.finance);

  // 员工年度成长（设计 5.5）：delta=max(1,round(potential/30))，专业能力封顶 100；
  // 仅在年结执行一次；潜力不增长、薪资不自动上涨。
  const denom = cfg.recruitment.annualSkillGrowthDenominator;
  for (const emp of state.employees) {
    if (emp.status !== 'ACTIVE') continue;
    const delta = Math.max(1, Math.round(emp.potential / denom));
    emp.skill = Math.min(100, emp.skill + delta);
  }

  const headcountClose = state.employees.filter((e) => e.status === 'ACTIVE').length;

  const report: AnnualReport = {
    year,
    revenueYuan: revenue,
    directCostYuan: directCost,
    otherOperatingCostYuan: otherOperating,
    afterSalesCostYuan: afterSales,
    fixedCostYuan: fixed,
    payrollYuan: payroll,
    recruitmentCostYuan: recruitment,
    severanceCostYuan: severance,
    deptSetupCostYuan: deptSetup,
    eventCostYuan: event,
    depreciationYuan: depreciation,
    profitYuan: annualProfit,
    cashOpenYuan: cashOpen,
    cashCloseYuan: cashClose,
    assetCloseYuan: cashClose + state.company.businessAssetBookYuan,
    headcountClose,
    settled: true,
  };

  state.annualReports.push(report);
  if (state.annualReports.length > cfg.save.keepAnnualReports) {
    state.annualReports = state.annualReports.slice(-cfg.save.keepAnnualReports);
  }

  // 年结后对业务资产计提折旧（影响次年产能/账面，不追溯本年利润）。
  // 设计 03.6：扩产从次年起按 10% 折旧。
  depreciateAfterAnnual(state, cfg);

  return report;
}

/** 年度折旧（延迟引用，避免与 InvestmentService 循环依赖）。 */
function depreciateAfterAnnual(state: GameState, cfg: EconomyConfig): void {
  const company = state.company;
  if (!company) return;
  const rate = cfg.productivity.annualDepreciationBpsFromNextYear / 10_000;
  const amount = Math.round(company.businessAssetBookYuan * rate);
  if (amount <= 0) return;
  company.businessAssetBookYuan -= amount;
  company.businessCapacityInvestmentYuan = Math.max(
    0,
    company.businessCapacityInvestmentYuan - amount,
  );
}
