import type { EconomyConfig } from '../config/EconomyConfig';
import { GameErrorCode } from '../domain/errors';
import type { GameState } from '../domain/types';
import { businessAssetCoeffBps } from '../simulation/capacity';
import { monthlyCapacityAt, monthlyPotentialOrderAt } from './CompanyOverviewService';
import { ensureRunId, hasCommand, recordCommand } from './MutationContext';

/**
 * 主营业务扩产（设计 03.6 / G007 / 12.5）。
 * - 步长 1 万元整数倍；现金 −amount、businessAssetBook += amount、capacityInvestment += amount。
 * - 资本性支出不计当月利润；立即按每万元 +1.5% 产能（封顶 +30%）。
 * - 从购买次年起，上年末账面资产按 10% 年折旧（在年结处理）。
 */
export interface InvestPreview {
  amount: number;
  cashAfter: number;
  assetBookAfter: number;
  capacityCoeffBeforeBps: number;
  capacityCoeffAfterBps: number;
  /** 当前团队结构下的当月产能（投资前/投资后） */
  monthlyCapacityBeforeYuan: number;
  monthlyCapacityAfterYuan: number;
  /** 当月潜在订单（需求上限）；产能超过它即可能闲置 */
  monthlyPotentialOrderYuan: number;
  /** 投资后产能已超过当月需求 */
  idleRiskAfter: boolean;
  valid: boolean;
  reason?: string;
}

export function previewInvest(
  state: GameState,
  cfg: EconomyConfig,
  amount: number,
): InvestPreview {
  const company = state.company;
  const investmentBefore = company?.businessCapacityInvestmentYuan ?? 0;
  const before = businessAssetCoeffBps(cfg, investmentBefore);
  const after = businessAssetCoeffBps(cfg, investmentBefore + amount);
  const capacityBefore = monthlyCapacityAt(state, cfg, investmentBefore);
  const capacityAfter = monthlyCapacityAt(state, cfg, investmentBefore + amount);
  const monthlyPotentialOrderYuan = monthlyPotentialOrderAt(state, cfg);
  const monthlyCapacityAfterYuan = capacityAfter?.monthlyCapacityYuan ?? 0;

  let valid = true;
  let reason: string | undefined;
  try {
    validateInvestAmount(state, cfg, amount);
  } catch (err) {
    valid = false;
    reason = err instanceof Error ? err.message : GameErrorCode.INVALID_AMOUNT;
  }

  return {
    amount,
    cashAfter: (company?.cashYuan ?? 0) - amount,
    assetBookAfter: (company?.businessAssetBookYuan ?? 0) + amount,
    capacityCoeffBeforeBps: before,
    capacityCoeffAfterBps: after,
    monthlyCapacityBeforeYuan: capacityBefore?.monthlyCapacityYuan ?? 0,
    monthlyCapacityAfterYuan,
    monthlyPotentialOrderYuan,
    idleRiskAfter: monthlyCapacityAfterYuan > monthlyPotentialOrderYuan,
    valid,
    reason,
  };
}

export function validateInvestAmount(state: GameState, cfg: EconomyConfig, amount: number): void {
  const company = state.company;
  if (!company) throw new Error(GameErrorCode.NOT_READY);
  if (state.phase !== 'RUNNING' && state.phase !== 'DISTRESS') {
    throw new Error(GameErrorCode.NOT_READY);
  }
  const step = cfg.productivity.businessAssetInvestStepYuan;
  if (!Number.isInteger(amount) || amount <= 0 || amount % step !== 0) {
    throw new Error(GameErrorCode.INVALID_AMOUNT);
  }
  if (amount > company.cashYuan) {
    throw new Error(GameErrorCode.INSUFFICIENT_CASH);
  }
}

/**
 * 执行扩产（命令层负责幂等/持久化）。
 * 传入 ctx 时：先校验 runId，同一 commandId 重放不再扣款/加资产，返回当前账面快照。
 */
export function investInBusiness(
  state: GameState,
  cfg: EconomyConfig,
  amount: number,
  ctx?: { commandId: string; expectedRunId: string },
): InvestPreview {
  if (ctx) {
    ensureRunId(state, ctx.expectedRunId);
    if (hasCommand(state, ctx.commandId)) {
      const company = state.company!;
      const coeff = businessAssetCoeffBps(cfg, company.businessCapacityInvestmentYuan);
      const monthlyCapacityYuan =
        monthlyCapacityAt(state, cfg, company.businessCapacityInvestmentYuan)?.monthlyCapacityYuan ?? 0;
      return {
        amount,
        cashAfter: company.cashYuan,
        assetBookAfter: company.businessAssetBookYuan,
        capacityCoeffBeforeBps: coeff,
        capacityCoeffAfterBps: coeff,
        monthlyCapacityBeforeYuan: monthlyCapacityYuan,
        monthlyCapacityAfterYuan: monthlyCapacityYuan,
        monthlyPotentialOrderYuan: monthlyPotentialOrderAt(state, cfg),
        idleRiskAfter: false,
        valid: true,
      };
    }
  }
  // 先按投资前状态取预览（含产能/需求/闲置风险），再落账，避免重复计算口径不一致
  const preview = previewInvest(state, cfg, amount);
  validateInvestAmount(state, cfg, amount);
  const company = state.company!;
  company.cashYuan -= amount;
  company.businessAssetBookYuan += amount;
  company.businessCapacityInvestmentYuan += amount;
  if (ctx) {
    if (state.cashFlowTrackingStartYear === undefined) state.cashFlowTrackingStartYear = state.gameYear + 1;
    state.cashFlowsByYear ??= {};
    const yearFlow = (state.cashFlowsByYear[state.gameYear] ??= { investmentOutYuan: 0, rescueInYuan: 0 });
    yearFlow.investmentOutYuan += amount;
  }
  if (ctx) recordCommand(state, ctx.commandId);
  return {
    ...preview,
    cashAfter: company.cashYuan,
    assetBookAfter: company.businessAssetBookYuan,
    capacityCoeffAfterBps: businessAssetCoeffBps(cfg, company.businessCapacityInvestmentYuan),
  };
}

/**
 * 年结折旧（设计 03.6）：从投资次年起，对上年末业务资产账面按 10% 折旧。
 * M1 简化：每年年结按账面 10% 折旧（book 与 capacityInvestment 同步缩减）。
 * 返回折旧额（元，>=0）。
 */
export function depreciateBusinessAssets(state: GameState, cfg: EconomyConfig): number {
  const company = state.company;
  if (!company) return 0;
  const rate = cfg.productivity.annualDepreciationBpsFromNextYear / 10_000;
  const depreciation = Math.round(company.businessAssetBookYuan * rate);
  if (depreciation <= 0) return 0;
  company.businessAssetBookYuan -= depreciation;
  company.businessCapacityInvestmentYuan = Math.max(
    0,
    company.businessCapacityInvestmentYuan - depreciation,
  );
  return depreciation;
}
