import type { EconomyConfig } from '../config/EconomyConfig';
import type { IndustryId } from '../domain/types';
import { clampMoney, roundHalfUp } from '../domain/money';
import { RandomStreams } from './RandomStreams';

/**
 * 市场需求（设计文档 03.7 / 04）。
 * 第 1 年需求 = 配置 firstYearDemandYuan（黄金基线，无随机）。
 * 第 y>1 年：在上一年需求基础上按自然增长率增长（M1 固定 10%，事件从 M3 起叠加）。
 * 需求指数只用于展示与潜在订单；实际营收受交付产能 min(订单,产能) 限制。
 */
export interface MarketYear {
  year: number;
  annualDemandYuan: number;
  /** 该年需求相对首年的指数（bps，首年=10000）。 */
  demandIndexBps: number;
}

export function annualDemand(
  cfg: EconomyConfig,
  industry: IndustryId,
  year: number,
): MarketYear {
  const base = cfg.industry[industry].firstYearDemandYuan;
  const growth = cfg.demand.naturalAnnualGrowthBps / 10_000;
  const demand =
    year <= 1 ? base : clampMoney(Math.round(base * Math.pow(1 + growth, year - 1)));
  return {
    year,
    annualDemandYuan: demand,
    demandIndexBps: Math.round((demand / base) * 10_000),
  };
}

/** 月均分配年度潜在订单（12 等分，最后一月用残差保证全年合计精确）。 */
export function distributeMonthly(annual: number): number[] {
  const base = Math.trunc(annual / 12);
  const months = new Array<number>(12).fill(base);
  const distributed = base * 12;
  months[11] = annual - distributed + base;
  return months;
}

export interface DemandContext {
  streams: RandomStreams;
}

/**
 * 当月潜在订单（设计 03.3）。
 * 年度获客订单按 12 等分，前 11 月截断、第 12 月补差，保证全年恰为年度额
 * （400000/12 这类非整除情形，避免逐月舍入累计误差）。
 */
export function monthlyPotentialOrder(
  cfg: EconomyConfig,
  industry: IndustryId,
  year: number,
  month: number,
  acqMultiplierBps: number,
  marketingUpliftBps = 0,
): number {
  const { annualDemandYuan } = annualDemand(cfg, industry, year);
  // 获客系数 × (1 + 市场部需求提升)；无市场部时 uplift=0，M1 基线不变。
  const annualAfterAcq = roundHalfUp(
    (annualDemandYuan * acqMultiplierBps * (10_000 + marketingUpliftBps)) / 10_000 ** 2,
  );
  const base = Math.trunc(annualAfterAcq / 12);
  if (month === 12) return annualAfterAcq - base * 11;
  return base;
}
