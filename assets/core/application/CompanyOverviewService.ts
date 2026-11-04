import type { EconomyConfig } from '../config/EconomyConfig';
import type { GameState } from '../domain/types';
import { businessAssetCoeffBps, monthlyCapacity, type CapacityBreakdown } from '../simulation/capacity';
import { computeSupportEffects, deptIdAtMonth } from '../simulation/departments';
import { monthlyPotentialOrder } from '../simulation/market';
import { activeEmployeesAt } from '../simulation/monthly';
import { monthIndexOf } from './monthEntry';
import { assessRisk, type RiskAssessment } from './RiskService';

/**
 * R28：公司首页只读视图模型（纯计算，不改状态）。
 * 现金/累计收支/产能/需求/风险全部来自领域层，UI 只做展示与排版。
 */
export interface CompanyOverview {
  cashYuan: number;
  /** 本年已结算月份累计收入（不含未结算的本月） */
  ytdRevenueYuan: number;
  /** 本年已结算月份累计利润（不含未结算的本月） */
  ytdProfitYuan: number;
  businessAssetBookYuan: number;
  businessCapacityInvestmentYuan: number;
  capacityCoeffBps: number;
  /** 当前团队结构下的当月交付产能 */
  monthlyCapacityYuan: number;
  /** 当月潜在订单（需求上限，收入取 min(订单, 产能)） */
  monthlyPotentialOrderYuan: number;
  /** 产能已超过当月需求（新增投资可能闲置） */
  idleRisk: boolean;
  risk: RiskAssessment;
  target3YearsAchieved: boolean;
  consecutiveProfitableYears: number;
}

/** 指定投资额下的当月产能（投资额仅用于预览，不写回状态）。 */
export function monthlyCapacityAt(
  state: GameState,
  cfg: EconomyConfig,
  investmentYuan: number,
): CapacityBreakdown | null {
  const company = state.company;
  if (!company) return null;
  const monthIndex = monthIndexOf(state);
  const support = computeSupportEffects(cfg, state, monthIndex);
  const businessDept = state.departments.find((d) => d.type === 'BUSINESS');
  const businessEmployees = businessDept
    ? activeEmployeesAt(state, monthIndex).filter(
        (e) => deptIdAtMonth(e, monthIndex) === businessDept.deptId,
      )
    : [];
  return monthlyCapacity(
    cfg,
    company.industry,
    {
      businessEmployees,
      ceo: state.ceo,
      departments: state.departments,
      businessCapacityInvestmentYuan: investmentYuan,
      hrCapacityBps: support.hrCapacity.effectBps,
    },
    monthIndex,
  );
}

/** 当月潜在订单（与月结同口径：获客基线 10000 + 市场部提升）。 */
export function monthlyPotentialOrderAt(state: GameState, cfg: EconomyConfig): number {
  const company = state.company;
  if (!company) return 0;
  const monthIndex = monthIndexOf(state);
  const support = computeSupportEffects(cfg, state, monthIndex);
  return monthlyPotentialOrder(
    cfg,
    company.industry,
    state.gameYear,
    state.gameMonth,
    10_000,
    support.marketing.effectBps,
  );
}

export function buildCompanyOverview(state: GameState, cfg: EconomyConfig): CompanyOverview | null {
  const company = state.company;
  if (!company) return null;
  const ledgers = state.monthlyLedgersRolling.filter(
    (l) => l.runId === state.runId && l.year === state.gameYear,
  );
  const ytdRevenueYuan = ledgers.reduce((sum, l) => sum + l.revenueYuan, 0);
  const ytdProfitYuan = ledgers.reduce((sum, l) => sum + l.profitYuan, 0);
  const capacity = monthlyCapacityAt(state, cfg, company.businessCapacityInvestmentYuan);
  const monthlyCapacityYuan = capacity?.monthlyCapacityYuan ?? 0;
  const monthlyPotentialOrderYuan = monthlyPotentialOrderAt(state, cfg);
  return {
    cashYuan: company.cashYuan,
    ytdRevenueYuan,
    ytdProfitYuan,
    businessAssetBookYuan: company.businessAssetBookYuan,
    businessCapacityInvestmentYuan: company.businessCapacityInvestmentYuan,
    capacityCoeffBps: businessAssetCoeffBps(cfg, company.businessCapacityInvestmentYuan),
    monthlyCapacityYuan,
    monthlyPotentialOrderYuan,
    idleRisk: monthlyCapacityYuan > monthlyPotentialOrderYuan,
    risk: assessRisk(state, cfg),
    target3YearsAchieved: state.target3YearsAchieved,
    consecutiveProfitableYears: state.consecutiveProfitableYears,
  };
}
