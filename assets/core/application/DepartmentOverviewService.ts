import type { EconomyConfig } from '../config/EconomyConfig';
import { roundHalfUp } from '../domain/money';
import {
  SUPPORT_DEPARTMENTS,
  type DeptType,
  type GameState,
  type Policy,
  type StaffingMode,
  type SupportDeptType,
} from '../domain/types';
import { monthlyCapacity } from '../simulation/capacity';
import { computeSupportEffects, deptIdAtMonth } from '../simulation/departments';
import { monthlyPotentialOrder } from '../simulation/market';
import { activeEmployeesAt } from '../simulation/monthly';
import { committedCostMonths } from './AutoHireService';
import { monthIndexOf } from './monthEntry';

/**
 * R29：部门页只读视图模型（纯计算，不改状态）。
 *
 * 归因口径（重要）：
 * - 月结账本（MonthlyLedger）只保存净费用，不按部门留存「本部门节省了多少」；
 *   因此**历史实际贡献无法逐部门回算**，页面不得把估算写成「已实现收益」（T05）。
 * - 这里给出的是「按当前团队 + 当月预计收入」的当月估算，公式与月结同一套
 *   （采购/客服/财务/市场/HR 的系数与基数），仅用于解释与决策参考，不入账。
 * - 建部费与工资是真实支出，直接来自状态；净贡献 = 估算效益 − 部门月薪。
 */

export type DeptValueKind =
  | 'BUSINESS_DELIVERY'
  | 'COST_SAVING'
  | 'DEMAND_UPLIFT'
  | 'CAPACITY_UPLIFT'
  | 'NO_EFFECT';

export interface DepartmentVM {
  deptId: string;
  type: DeptType;
  /** 当月在岗且该月归属本部门的人数（含下月生效调岗的当月口径） */
  headcount: number;
  monthlyPayrollYuan: number;
  /** 部门作用系数 bps（0 人严格为 0） */
  effectBps: number;
  valueKind: DeptValueKind;
  /** 当月估算效益（元）：节省额 / 增量收入 × 行业毛利率（非历史实际） */
  estimatedMonthlyValueYuan: number;
  /** 估算净贡献 = 估算效益 − 部门月薪（负数表示当月估算是净成本） */
  estimatedNetContributionYuan: number;
  staffingMode: StaffingMode;
  targetCount: number;
  createdMonthIndex: number;
  setupPaid: boolean;
}

export interface UncreatedDeptVM {
  type: SupportDeptType;
  feeYuan: number;
  cashAfterYuan: number;
  affordable: boolean;
}

export interface AutoBudgetVM {
  cashYuan: number;
  policy: Policy;
  /** 自动招聘 ROI 门槛 bps（预计 12 个月贡献 / 12 个月成本） */
  roiThresholdBps: number;
  /** 现金安全线：需保留几个月的刚性费用 */
  cashReserveMonths: number;
  /** 需保留的刚性费用（全员月薪 + 固定管理费 × 月数） */
  reserveRequiredYuan: number;
  /** 现金扣除安全线后可支配额（负数表示已低于安全线，自动招聘会被冻结） */
  spendableYuan: number;
  autoDeptCount: number;
  autoHiresThisYear: number;
  maxAutoHiresPerYear: number;
  maxAutoHiresPerMonth: number;
}

export interface DepartmentOverview {
  monthIndex: number;
  cashYuan: number;
  setupFeeYuan: number;
  /** 当月预计收入 = min(潜在订单, 交付产能) */
  projectedRevenueYuan: number;
  monthlyPotentialOrderYuan: number;
  monthlyCapacityYuan: number;
  grossMarginBps: number;
  departments: DepartmentVM[];
  uncreated: UncreatedDeptVM[];
  autoBudget: AutoBudgetVM;
  /** 账本未按部门留存归因，历史“实际收益”不可核 → 始终 UNAVAILABLE */
  historicalAttribution: 'UNAVAILABLE';
  /** 页面展示的效益一律是当月估算 */
  valueBasis: 'CURRENT_MONTH_ESTIMATE';
}

function capacityAt(state: GameState, cfg: EconomyConfig, monthIndex: number, hrCapacityBps: number): number {
  const company = state.company;
  if (!company) return 0;
  const businessDept = state.departments.find((d) => d.type === 'BUSINESS');
  const active = activeEmployeesAt(state, monthIndex);
  const businessEmployees = businessDept
    ? active.filter((e) => deptIdAtMonth(e, monthIndex) === businessDept.deptId)
    : [];
  return monthlyCapacity(
    cfg,
    company.industry,
    {
      businessEmployees,
      ceo: state.ceo,
      departments: state.departments,
      businessCapacityInvestmentYuan: company.businessCapacityInvestmentYuan,
      hrCapacityBps,
    },
    monthIndex,
  ).monthlyCapacityYuan;
}

/** 与月结同口径的当月效益估算（仅支持部门；0 人严格为 0）。 */
function estimateDeptValue(
  cfg: EconomyConfig,
  state: GameState,
  type: DeptType,
  effectBps: number,
  projectedRevenueYuan: number,
  orderBaseYuan: number,
  orderWithMarketingYuan: number,
  capacityWithHrYuan: number,
  capacityWithoutHrYuan: number,
  grossMarginBps: number,
): { value: number; kind: DeptValueKind } {
  const industry = state.company!.industry;
  const ind = cfg.industry[industry];
  if (effectBps <= 0) {
    return { value: 0, kind: type === 'BUSINESS' ? 'BUSINESS_DELIVERY' : 'NO_EFFECT' };
  }
  switch (type) {
    case 'BUSINESS': {
      // 主营：当月预计收入的行业毛利贡献（工资作为成本单列）
      return {
        value: roundHalfUp((projectedRevenueYuan * grossMarginBps) / 10_000),
        kind: 'BUSINESS_DELIVERY',
      };
    }
    case 'PROCUREMENT': {
      // 与 settleMonth 同一表达式：可适用直成 × 部门系数
      const grossDirect = roundHalfUp((projectedRevenueYuan * ind.directCostBps) / 10_000);
      return {
        value: roundHalfUp(
          (grossDirect * ind.procurementEligibleDirectCostBps * effectBps) / 10_000 ** 2,
        ),
        kind: 'COST_SAVING',
      };
    }
    case 'CUSTOMER_SERVICE': {
      // 与 settleMonth 一致：节省 = 毛售后 − 净售后（净额 rounding 后再作差）
      const grossAfter = roundHalfUp((projectedRevenueYuan * ind.afterSalesCostBps) / 10_000);
      const afterNet = roundHalfUp((grossAfter * (10_000 - effectBps)) / 10_000);
      return { value: Math.max(0, grossAfter - afterNet), kind: 'COST_SAVING' };
    }
    case 'FINANCE': {
      // 财务节省覆盖「固定管理费 + 其他可控运营费」；月度估算按 1/12 固定费 + 当月其他费
      const fixedShare = roundHalfUp(ind.fixedManagementAnnualYuan / 12);
      const otherGross = roundHalfUp((projectedRevenueYuan * ind.otherOperatingCostBps) / 10_000);
      return {
        value: roundHalfUp(((fixedShare + otherGross) * effectBps) / 10_000),
        kind: 'COST_SAVING',
      };
    }
    case 'MARKETING': {
      // 市场提升潜在订单；只有产能可交付的部分才形成增量收入，按行业毛利率折算贡献
      const extraRevenue = Math.max(0, Math.min(orderWithMarketingYuan, capacityWithHrYuan) - Math.min(orderBaseYuan, capacityWithHrYuan));
      return {
        value: roundHalfUp((extraRevenue * grossMarginBps) / 10_000),
        kind: 'DEMAND_UPLIFT',
      };
    }
    case 'HR': {
      // HR 提升业务产能；同样只计能交付的增量收入（招聘费折扣不在此列）
      const extraRevenue = Math.max(0, Math.min(orderWithMarketingYuan, capacityWithHrYuan) - Math.min(orderWithMarketingYuan, capacityWithoutHrYuan));
      return {
        value: roundHalfUp((extraRevenue * grossMarginBps) / 10_000),
        kind: 'CAPACITY_UPLIFT',
      };
    }
    default:
      return { value: 0, kind: 'NO_EFFECT' };
  }
}

export function buildDepartmentOverview(state: GameState, cfg: EconomyConfig): DepartmentOverview | null {
  const company = state.company;
  if (!company) return null;
  const monthIndex = monthIndexOf(state);
  const ind = cfg.industry[company.industry];
  const support = computeSupportEffects(cfg, state, monthIndex);

  const orderBase = monthlyPotentialOrder(cfg, company.industry, state.gameYear, state.gameMonth, 10_000, 0);
  const orderWithMarketing = monthlyPotentialOrder(
    cfg,
    company.industry,
    state.gameYear,
    state.gameMonth,
    10_000,
    support.marketing.effectBps,
  );
  const capacityWithHr = capacityAt(state, cfg, monthIndex, support.hrCapacity.effectBps);
  const capacityWithoutHr = capacityAt(state, cfg, monthIndex, 0);
  const projectedRevenue = roundHalfUp(Math.min(orderWithMarketing, capacityWithHr));

  const active = activeEmployeesAt(state, monthIndex);
  const staffIn = (deptId: string) => active.filter((e) => deptIdAtMonth(e, monthIndex) === deptId);

  const effectOf = (type: DeptType): number => {
    switch (type) {
      case 'PROCUREMENT':
        return support.procurement.effectBps;
      case 'CUSTOMER_SERVICE':
        return support.customerService.effectBps;
      case 'FINANCE':
        return support.finance.effectBps;
      case 'MARKETING':
        return support.marketing.effectBps;
      case 'HR':
        return support.hrCapacity.effectBps;
      case 'BUSINESS':
        // 主营没有「系数」概念：用其交付产能相对潜在订单的覆盖度解释（满覆盖 = 100%）
        return capacityWithHr > 0 ? Math.min(10_000, roundHalfUp((projectedRevenue / capacityWithHr) * 10_000)) : 0;
      default:
        return 0;
    }
  };

  const departments: DepartmentVM[] = state.departments.map((dept) => {
    const headcount = staffIn(dept.deptId).length;
    const monthlyPayrollYuan = staffIn(dept.deptId).reduce((sum, e) => sum + e.salaryMonthlyYuan, 0);
    const effectBps = headcount === 0 ? 0 : effectOf(dept.type);
    const { value, kind } = estimateDeptValue(
      cfg,
      state,
      dept.type,
      effectBps,
      projectedRevenue,
      orderBase,
      orderWithMarketing,
      capacityWithHr,
      capacityWithoutHr,
      10_000 - ind.directCostBps,
    );
    return {
      deptId: dept.deptId,
      type: dept.type,
      headcount,
      monthlyPayrollYuan,
      effectBps,
      valueKind: headcount === 0 && dept.type !== 'BUSINESS' ? 'NO_EFFECT' : kind,
      estimatedMonthlyValueYuan: headcount === 0 && dept.type !== 'BUSINESS' ? 0 : value,
      estimatedNetContributionYuan: (headcount === 0 && dept.type !== 'BUSINESS' ? 0 : value) - monthlyPayrollYuan,
      staffingMode: dept.staffingMode,
      targetCount: dept.targetCount,
      createdMonthIndex: dept.createdMonthIndex,
      setupPaid: dept.setupPaid,
    };
  });

  const createdTypes = new Set(state.departments.map((d) => d.type));
  const uncreated: UncreatedDeptVM[] = SUPPORT_DEPARTMENTS.filter((t) => !createdTypes.has(t)).map((type) => {
    const feeYuan = cfg.departments.setupFeeYuan;
    return {
      type,
      feeYuan,
      cashAfterYuan: company.cashYuan - feeYuan,
      affordable: company.cashYuan >= feeYuan,
    };
  });

  const policy = cfg.policies[state.policy];
  const reserveRequiredYuan = committedCostMonths(state, cfg, policy.cashReserveMonths);

  return {
    monthIndex,
    cashYuan: company.cashYuan,
    setupFeeYuan: cfg.departments.setupFeeYuan,
    projectedRevenueYuan: projectedRevenue,
    monthlyPotentialOrderYuan: orderWithMarketing,
    monthlyCapacityYuan: capacityWithHr,
    grossMarginBps: 10_000 - ind.directCostBps,
    departments,
    uncreated,
    autoBudget: {
      cashYuan: company.cashYuan,
      policy: state.policy,
      roiThresholdBps: policy.autoHireMarginThresholdBps,
      cashReserveMonths: policy.cashReserveMonths,
      reserveRequiredYuan,
      spendableYuan: company.cashYuan - reserveRequiredYuan,
      autoDeptCount: state.departments.filter((d) => d.enabled && d.staffingMode === 'AUTO').length,
      autoHiresThisYear: state.autoHireCountByYear[state.gameYear] ?? 0,
      maxAutoHiresPerYear: cfg.recruitment.maxAutoHiresPerYear,
      maxAutoHiresPerMonth: cfg.recruitment.maxAutoHiresPerMonth,
    },
    historicalAttribution: 'UNAVAILABLE',
    valueBasis: 'CURRENT_MONTH_ESTIMATE',
  };
}
