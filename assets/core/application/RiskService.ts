import type { EconomyConfig } from '../config/EconomyConfig';
import { GameErrorCode } from '../domain/errors';
import type { GameState } from '../domain/types';
import { ensureRunId, hasCommand, recordCommand } from './MutationContext';
import { monthIndexOf, addPendingEntry } from './monthEntry';

/**
 * 现金风控与一次性救助（设计文档 3.10 / G010/G012/B12）。
 *
 * 风险分层：
 * - NORMAL：现金可覆盖未来 warningMonths（6）个月刚性支出（工资+固定费）。
 * - WARNING：覆盖不足 6 个月（黄色提示），但当前月仍可结算。
 * - DISTRESS：当前月必要刚性费用（工资+固定费）已无法由「现金 + 本月预计经营净流入」覆盖，
 *   冻结月结、禁止新增投资/招聘，等待玩家动作（裁员/切换稳健/一次性救助）。
 *
 * 救助：全 run 仅一次 10 万元 CEO 追加资本，计入实收资本、**不算收入/利润**；
 * 重复点击/重复 commandId 不重复发放（G012）。
 */

/** 未来 months 个月刚性费用（在岗工资 + 月固定管理费）。 */
export function committedCost(cfg: EconomyConfig, state: GameState, months: number): number {
  const mIndex = monthIndexOf(state);
  const payroll = state.employees
    .filter((e) => e.status === 'ACTIVE' && e.effectiveFromMonthIndex <= mIndex)
    .reduce((s, e) => s + e.salaryMonthlyYuan, 0);
  const fixedMonthly = cfg.industry[state.company!.industry].fixedManagementAnnualYuan / 12;
  return Math.round((payroll + fixedMonthly) * months);
}

export type RiskLevel = 'NORMAL' | 'WARNING' | 'DISTRESS';

export interface RiskAssessment {
  level: RiskLevel;
  cash: number;
  /** 未来 6 个月刚性费用 */
  sixMonthNeed: number;
  /** 下月刚性费用 */
  nextMonthNeed: number;
  /** 下月预计经营净流入（保守用最近月 recurring 净额；无历史按 0） */
  projectedNextInflow: number;
}

/** 评估当前风险等级（纯计算，不改状态）。 */
export function assessRisk(state: GameState, cfg: EconomyConfig): RiskAssessment {
  const cash = state.company?.cashYuan ?? 0;
  const sixMonthNeed = committedCost(cfg, state, cfg.risk.cashWarningRequiredMonths);
  const nextMonthNeed = committedCost(cfg, state, 1);

  // 保守预计下月净流入：取最近一个已结月 ledger 的经常性净额（不含一次性）
  const ledgers = state.monthlyLedgersRolling.filter((l) => l.runId === state.runId);
  const last = ledgers[ledgers.length - 1];
  let projectedNextInflow = 0;
  if (last) {
    projectedNextInflow =
      last.revenueYuan +
      last.directCostYuan +
      last.otherOperatingCostYuan +
      last.afterSalesCostYuan +
      last.fixedCostYuan +
      last.payrollYuan;
  }

  let level: RiskLevel = 'NORMAL';
  if (cash + Math.max(0, projectedNextInflow) < nextMonthNeed) {
    level = 'DISTRESS';
  } else if (cash < sixMonthNeed) {
    level = 'WARNING';
  }
  return { level, cash, sixMonthNeed, nextMonthNeed, projectedNextInflow };
}

/** 刷新 state.cashRisk（月结后调用）。返回新等级。 */
export function refreshRisk(state: GameState, cfg: EconomyConfig): RiskLevel {
  const { level } = assessRisk(state, cfg);
  state.cashRisk = level;
  return level;
}

export interface RescueResult {
  granted: boolean;
  amountYuan: number;
  cashAfterYuan: number;
  paidInCapitalAfterYuan: number;
}

/**
 * 领取一次性救助资本 10 万元。
 * - 全 run 仅一次（rescueCapitalUsed）；重复领取 → ALREADY_USED。
 * - 计入实收资本 paidInCapitalYuan，写 CAPITAL_INJECTION 分录（不计利润/收入）。
 */
export function injectRescueCapital(
  state: GameState,
  cfg: EconomyConfig,
  ctx: { commandId: string; expectedRunId: string },
): RescueResult {
  ensureRunId(state, ctx.expectedRunId);
  if (!state.company) throw new Error(GameErrorCode.NOT_READY);

  if (hasCommand(state, ctx.commandId) && state.rescueCapitalUsed) {
    // 幂等重放：不再发放，返回当前值
    return {
      granted: false,
      amountYuan: 0,
      cashAfterYuan: state.company.cashYuan,
      paidInCapitalAfterYuan: state.company.paidInCapitalYuan,
    };
  }
  if (state.rescueCapitalUsed) {
    throw new Error(GameErrorCode.ALREADY_USED);
  }

  const amount = cfg.risk.oneTimeRescueCapitalYuan;
  state.company.cashYuan += amount;
  state.company.paidInCapitalYuan += amount;
  // 资本注入：现金增加但不计入任何费用/利润；登记分录供追溯（isCash 但不进利润表）
  addPendingEntry(state, 'CAPITAL_INJECTION', amount, ctx.commandId);
  state.rescueCapitalUsed = true;
  recordCommand(state, ctx.commandId);

  // 注资后立即重评：若可覆盖下月刚性费用则解除 DISTRESS
  refreshRisk(state, cfg);

  return {
    granted: true,
    amountYuan: amount,
    cashAfterYuan: state.company.cashYuan,
    paidInCapitalAfterYuan: state.company.paidInCapitalYuan,
  };
}
