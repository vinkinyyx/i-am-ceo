import type { EconomyConfig } from '../config/EconomyConfig';
import { roundHalfUp } from '../domain/money';
import type { Employee, GameState, IndustryId, JournalCategory } from '../domain/types';
import { monthlyCapacity } from './capacity';
import { monthlyPotentialOrder } from './market';

/**
 * 单月结算（设计文档 03.2 / 03.4 / 12.9）。
 * 输入一个不可变的月份结算上下文，产出 Ledger 金额明细（纯函数，不直接改状态）。
 *
 * 关键口径：
 * - 收入 = min(潜在订单, 交付产能)，四舍五入。
 * - 直接/其他运营/售后/固定费按收入对应 bps；固定费年额/12。
 * - 工资 = Σ 当月生效员工月薪。
 * - 招聘费/建部费等一次性费用：命令确认时已扣现金（pendingEntries.alreadyPaid），
 *   计入当月损益以算利润，但 cashDelta 不再扣现金；未支付项才影响现金。
 * - cashDelta 含全部归属现金变化（含已支付），用于年报勾稽；
 *   月结应用到现金时只用 unpaidCashDelta，避免对已付款项重复扣款。
 */

export interface MonthlyInput {
  state: GameState;
  cfg: EconomyConfig;
  industry: IndustryId;
  year: number;
  month: number; // 1..12
  monthIndex: number; // 创业第1年第1月 = 0
  /** 当月获客系数 bps（M1 首年=10000） */
  acqMultiplierBps: number;
  /** 当月业务资产投资额（M1 由扩张命令累计，无事件） */
  businessCapacityInvestmentYuan: number;
}

export interface MonthlyAmounts {
  revenue: number;
  directCost: number;
  otherOperating: number;
  afterSales: number;
  fixed: number;
  payroll: number;
  recruitment: number;
  severance: number;
  deptSetup: number;
  event: number;
  depreciation: number;
  profit: number;
  /** 归属该月的全部现金变化（含命令时已支付项），用于年报勾稽 */
  cashDelta: number;
  /** 月结时尚需实际从现金扣减/增加的净额（不含 alreadyPaid） */
  unpaidCashDelta: number;
  /** 月结时实际支付的招聘费（本版招聘均在命令时支付，恒 0，预留） */
  paidRecruitmentNow: number;
  headcount: number;
}

export interface PendingFee {
  category: JournalCategory;
  amountAbs: number;
  alreadyPaid: boolean;
  isCash: boolean;
}

/** 收集归属某月的一次性费用（招聘/裁员/建部/事件/投资/注资）。 */
export function collectPendingFees(state: GameState, monthKey: string): PendingFee[] {
  return state.pendingEntries
    .filter((e) => e.monthKey === monthKey)
    .map((e) => ({
      category: e.category,
      amountAbs: Math.abs(e.amountYuan),
      alreadyPaid: e.alreadyPaid,
      isCash: e.isCash,
    }));
}

/** 当月在职且生效的员工。 */
export function activeEmployeesAt(state: GameState, monthIndex: number): Employee[] {
  return state.employees.filter(
    (e) => e.status === 'ACTIVE' && e.effectiveFromMonthIndex <= monthIndex,
  );
}

export function settleMonth(input: MonthlyInput): MonthlyAmounts {
  const { cfg, industry, year, month, monthIndex, state } = input;
  const ind = cfg.industry[industry];

  // 1-3. 需求 → 获客订单 → 交付产能 → 实际收入
  const potentialOrder = monthlyPotentialOrder(
    cfg,
    industry,
    year,
    month,
    input.acqMultiplierBps,
  );
  const cap = monthlyCapacity(
    cfg,
    industry,
    {
      businessEmployees: state.employees,
      ceo: state.ceo,
      departments: state.departments,
      businessCapacityInvestmentYuan: input.businessCapacityInvestmentYuan,
    },
    monthIndex,
  );
  const revenue = roundHalfUp(Math.min(potentialOrder, cap.monthlyCapacityYuan));

  // 6. 费用（设计 03.4）。比例费率对黄金首年月收入整除；
  // 为保证非整除年份全年精确，仍用 YTD 累计残差法（03.5）。
  const prior = state.monthlyLedgersRolling.filter(
    (l) => l.runId === state.runId && l.year === year,
  );
  const ytdRevenueBefore = prior.reduce((s, l) => s + l.revenueYuan, 0);
  const ytdDirectBefore = prior.reduce((s, l) => s + Math.abs(l.directCostYuan), 0);
  const ytdOtherBefore = prior.reduce((s, l) => s + Math.abs(l.otherOperatingCostYuan), 0);
  const ytdAfterBefore = prior.reduce((s, l) => s + Math.abs(l.afterSalesCostYuan), 0);
  const ytdFixedBefore = prior.reduce((s, l) => s + Math.abs(l.fixedCostYuan), 0);

  const ytdRevenue = ytdRevenueBefore + revenue;
  const directCost =
    roundHalfUp((ytdRevenue * ind.directCostBps) / 10_000) - ytdDirectBefore;
  const otherOperating =
    roundHalfUp((ytdRevenue * ind.otherOperatingCostBps) / 10_000) - ytdOtherBefore;
  const afterSales =
    roundHalfUp((ytdRevenue * ind.afterSalesCostBps) / 10_000) - ytdAfterBefore;
  const fixedAnnual = ind.fixedManagementAnnualYuan;
  const fixed = month === 12 ? fixedAnnual - ytdFixedBefore : Math.round(fixedAnnual / 12);

  // 7. 工资
  const active = activeEmployeesAt(state, monthIndex);
  const payroll = active.reduce((s, e) => s + e.salaryMonthlyYuan, 0);

  // 一次性费用（来自 pendingEntries）
  const monthKey = `${state.runId}:${year}:${month}`;
  const fees = collectPendingFees(state, monthKey);
  const sumFee = (cat: JournalCategory) =>
    fees.filter((f) => f.category === cat).reduce((s, f) => s + f.amountAbs, 0);
  const recruitment = sumFee('RECRUITMENT');
  const severance = sumFee('SEVERANCE');
  const deptSetup = sumFee('DEPT_SETUP');
  const event = sumFee('EVENT');
  // 折旧 M1 无（扩产从次年起，M1-07 接入；默认 0）
  const depreciation = 0;

  // 8. 损益利润（投资/注资不计利润）
  const profit =
    revenue -
    directCost -
    otherOperating -
    afterSales -
    fixed -
    payroll -
    recruitment -
    severance -
    deptSetup -
    event -
    depreciation;

  // 现金口径：
  // 经常性项目（工资/各项成本）月结时实际发生现金流出；
  // 一次性费用若 alreadyPaid 则只在 cashDelta 体现、不再实际扣款。
  const recurringCashDelta =
    revenue - directCost - otherOperating - afterSales - fixed - payroll;
  const oneTimeCashDelta = -(recruitment + severance + deptSetup + event + depreciation);
  const cashDelta = recurringCashDelta + oneTimeCashDelta;

  const unpaidOneTime = -fees
    .filter((f) => f.isCash && !f.alreadyPaid)
    .reduce((s, f) => s + f.amountAbs, 0);
  const unpaidCashDelta = recurringCashDelta + unpaidOneTime;

  return {
    revenue,
    directCost,
    otherOperating,
    afterSales,
    fixed,
    payroll,
    recruitment,
    severance,
    deptSetup,
    event,
    depreciation,
    profit,
    cashDelta,
    unpaidCashDelta,
    paidRecruitmentNow: 0,
    headcount: active.length,
  };
}
