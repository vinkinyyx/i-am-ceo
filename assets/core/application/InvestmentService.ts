import type { EconomyConfig } from '../config/EconomyConfig';
import { GameErrorCode } from '../domain/errors';
import type { GameState } from '../domain/types';
import { businessAssetCoeffBps } from '../simulation/capacity';

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
  /** 预计新增月产能（元，按当前团队结构估算） */
  valid: boolean;
  reason?: string;
}

export function previewInvest(
  state: GameState,
  cfg: EconomyConfig,
  amount: number,
): InvestPreview {
  const company = state.company;
  const before = businessAssetCoeffBps(cfg, company?.businessCapacityInvestmentYuan ?? 0);
  const after = businessAssetCoeffBps(
    cfg,
    (company?.businessCapacityInvestmentYuan ?? 0) + amount,
  );
  return {
    amount,
    cashAfter: (company?.cashYuan ?? 0) - amount,
    assetBookAfter: (company?.businessAssetBookYuan ?? 0) + amount,
    capacityCoeffBeforeBps: before,
    capacityCoeffAfterBps: after,
    valid: true,
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

/** 执行扩产（命令层负责幂等/持久化）。 */
export function investInBusiness(state: GameState, cfg: EconomyConfig, amount: number): InvestPreview {
  validateInvestAmount(state, cfg, amount);
  const company = state.company!;
  const coeffBefore = businessAssetCoeffBps(cfg, company.businessCapacityInvestmentYuan);
  company.cashYuan -= amount;
  company.businessAssetBookYuan += amount;
  company.businessCapacityInvestmentYuan += amount;
  const coeffAfter = businessAssetCoeffBps(cfg, company.businessCapacityInvestmentYuan);
  return {
    amount,
    cashAfter: company.cashYuan,
    assetBookAfter: company.businessAssetBookYuan,
    capacityCoeffBeforeBps: coeffBefore,
    capacityCoeffAfterBps: coeffAfter,
    valid: true,
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
