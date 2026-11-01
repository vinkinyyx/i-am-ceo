import type { EconomyConfig } from '../config/EconomyConfig';
import { GameErrorCode } from '../domain/errors';
import type { GameState, MonthlyLedger } from '../domain/types';
import { settleMonth } from './monthly';
import { annualSettlement } from './annual';
import { applyDueTransfers } from './departments';

export interface AdvanceResult {
  ledger: MonthlyLedger;
  yearClosed: boolean;
  cashBefore: number;
}

/** 月份轴索引（创业第1年第1月 = 0）。 */
export function monthIndexOfYear(state: GameState): number {
  return (state.gameYear - 1) * 12 + (state.gameMonth - 1);
}

export function monthKeyOf(runId: string, year: number, month: number): string {
  return `${runId}:${year}:${month}`;
}

/**
 * 推进一个月（设计 03.2 月结顺序 / 12 命令幂等）。
 * - 同一 (runId,year,month) 只能结算一次（MONTH_ALREADY_SETTLED）。
 * - 应用 unpaidCashDelta 到现金；ledger.cashDelta 为含已付款的全量勾稽值。
 * - 第 12 月结算后触发年结。
 */
export function advanceMonth(state: GameState, cfg: EconomyConfig): AdvanceResult {
  if (!state.company) throw new Error(GameErrorCode.NOT_READY);
  if (state.phase !== 'RUNNING' && state.phase !== 'DISTRESS') {
    throw new Error(GameErrorCode.NOT_READY);
  }

  const year = state.gameYear;
  const month = state.gameMonth;
  const monthIndex = monthIndexOfYear(state);
  const key = monthKeyOf(state.runId, year, month);

  if (state.lastSettledMonthKey === key) {
    throw new Error(GameErrorCode.MONTH_ALREADY_SETTLED);
  }
  if (state.monthlyLedgersRolling.some((l) => l.runId === state.runId && l.year === year && l.month === month)) {
    throw new Error(GameErrorCode.MONTH_ALREADY_SETTLED);
  }

  const cashBefore = state.company.cashYuan;
  // 年度开盘现金快照在注资(createCompany)时确立；后续年在首月结时补记。
  if (month === 1 && state.yearOpenCashYuan[year] === undefined) {
    state.yearOpenCashYuan[year] = cashBefore;
  }
  const amounts = settleMonth({
    state,
    cfg,
    industry: state.company.industry,
    year,
    month,
    monthIndex,
    acqMultiplierBps: 10_000, // M1 首年基线；获客系数随市场部/CEO商业在后续接入
    businessCapacityInvestmentYuan: state.company.businessCapacityInvestmentYuan,
  });

  const ledger: MonthlyLedger = {
    runId: state.runId,
    year,
    month,
    revenueYuan: amounts.revenue,
    directCostYuan: -amounts.directCost,
    otherOperatingCostYuan: -amounts.otherOperating,
    afterSalesCostYuan: -amounts.afterSales,
    fixedCostYuan: -amounts.fixed,
    payrollYuan: -amounts.payroll,
    recruitmentCostYuan: -amounts.recruitment,
    severanceCostYuan: -amounts.severance,
    deptSetupCostYuan: -amounts.deptSetup,
    eventCostYuan: -amounts.event,
    depreciationYuan: -amounts.depreciation,
    profitYuan: amounts.profit,
    cashDeltaYuan: amounts.cashDelta,
  };

  // 现金应用：经常性收支 + 月结时才支付的一次性费用（unpaid）。
  // 录用/建部等在命令确认时已扣现金（pendingEntries.alreadyPaid），月结不得重复扣。
  // 因此运行时年末现金 = 实际开盘现金 + Σunpaid；年报 cashOpen 另按注资快照口径展示（12.9）。
  state.company.cashYuan = cashBefore + amounts.unpaidCashDelta;
  state.lastSettledMonthKey = key;
  state.monthlyLedgersRolling.push(ledger);
  if (state.monthlyLedgersRolling.length > cfg.save.rollingMonthlyLedgers) {
    state.monthlyLedgersRolling = state.monthlyLedgersRolling.slice(-cfg.save.rollingMonthlyLedgers);
  }

  // 结清并移除已归属本月的 pendingEntries
  state.pendingEntries = state.pendingEntries.filter((e) => e.monthKey !== key);

  // 裁员次月生效：本月结完后，到生效月的待裁员工转为 DISMISSED（后续不再计工资/产能）。
  const nextMonthIndex = monthIndex + 1;
  for (const emp of state.employees) {
    if (
      emp.status === 'PENDING_DISMISSAL' &&
      emp.dismissedAtMonthIndex !== null &&
      emp.dismissedAtMonthIndex <= nextMonthIndex
    ) {
      emp.status = 'DISMISSED';
    }
  }
  // 调岗下月生效：落地到期的部门归属（避免双重工资/双重产能）。
  applyDueTransfers(state, monthIndex);

  let yearClosed = false;
  if (month === 12) {
    // 年初现金快照（第1月结算前，M1 即 30 万注资），由 annual 直接取用
    annualSettlement(state, cfg, state.yearOpenCashYuan[year] ?? cashBefore);
    yearClosed = true;
    state.gameYear += 1;
    state.gameMonth = 1;
  } else {
    state.gameMonth += 1;
  }

  return { ledger, yearClosed, cashBefore };
}
