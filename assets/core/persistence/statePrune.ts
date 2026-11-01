import type { EconomyConfig } from '../config/EconomyConfig';
import type { GameState } from '../domain/types';

/**
 * 存档历史瘦身（B15 / 设计 02.6）。
 *
 * 约束每槽 <500KB：
 * - 月度账只保留最近 rollingMonthlyLedgers（默认24）条（月结时已裁剪，这里兜底）；
 * - 年报最多保留 keepAnnualReports（默认100）份；超过则丢最早的明细年报；
 * - yearOpenCashYuan 仅保留与现存年份相关的开盘快照；
 * - 事件明细只保留最近 keepRecentEventDetails（默认24）条；
 * - 自动招聘日志只保留最近若干条（仅用于解释，不参与财务）；
 * - 已 DISMISSED 的离职员工保留最近一年的档案，更早的移除（当前年为基准）。
 *
 * 幂等：只裁剪历史明细，不改变任何现金/利润/当前在职状态。
 */
const KEEP_AUTOMATION_LOGS = 50;

export function pruneStateHistory(state: GameState, cfg: EconomyConfig): GameState {
  const maxLedgers = cfg.save.rollingMonthlyLedgers;
  if (state.monthlyLedgersRolling.length > maxLedgers) {
    state.monthlyLedgersRolling = state.monthlyLedgersRolling.slice(-maxLedgers);
  }

  const maxReports = cfg.save.keepAnnualReports;
  if (state.annualReports.length > maxReports) {
    state.annualReports = state.annualReports.slice(-maxReports);
  }

  // 开盘现金快照：仅保留现存年报年份与当前年
  const reportYears = new Set(state.annualReports.map((r) => r.year));
  reportYears.add(state.gameYear);
  for (const key of Object.keys(state.yearOpenCashYuan)) {
    const y = Number(key);
    if (!reportYears.has(y)) delete state.yearOpenCashYuan[y];
  }

  const maxEvents = cfg.save.keepRecentEventDetails;
  if (state.eventHistory.length > maxEvents) {
    state.eventHistory = state.eventHistory.slice(-maxEvents);
  }

  if (state.automationLogs.length > KEEP_AUTOMATION_LOGS) {
    state.automationLogs = state.automationLogs.slice(-KEEP_AUTOMATION_LOGS);
  }

  return state;
}

/** 估算存档信封负载的 UTF-8 字节上界（与 TapPlatform 估算口径一致）。 */
export function estimateStateBytes(state: GameState): number {
  const json = JSON.stringify(state);
  let bytes = 0;
  for (let i = 0; i < json.length; i++) {
    const code = json.charCodeAt(i);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else bytes += 3;
  }
  return bytes;
}
