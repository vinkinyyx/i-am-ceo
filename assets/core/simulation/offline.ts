import type { EconomyConfig } from '../config/EconomyConfig';
import { GameErrorCode } from '../domain/errors';
import type { GameState } from '../domain/types';
import { advanceMonth } from './advanceMonth';

/**
 * 离线结算（设计文档 3.9 / 12 / G009 / B08/B09/B10/A09/A10）。
 *
 * 规则：
 * - 仅 phase=RUNNING 且 speed≠0 才结算（暂停不结，B10）。
 * - 每完整 offlineRealMsPerGameMonth（40 分钟）= 1 个游戏月，与离线前加速倍率无关。
 * - 离线不足 1 月的余量计入 offlineRemainderMs，下次离线继续累积（B09）。
 * - 单次最多 maxOfflineMonthsPerSession（36）月；超出 24h 的当次时长丢弃，不留欠发。
 * - 达到 36 月封顶时余量清零，避免无限保留供重试套利。
 * - 设备时间回拨（now<lastWallClock）：结算 0、不产生负月份（B08），并向前更新水位。
 * - 若月结中途进入资金危机（advanceMonth 抛 NOT_READY/DISTRESS 冻结），停止后续跳月，
 *   已消耗月份不退回，剩余余量仍按规则保留（不凭空跳月）。
 */

export interface OfflineInput {
  state: GameState;
  cfg: EconomyConfig;
  /** 当前设备时间（ms） */
  nowMs: number;
}

export interface OfflineResult {
  /** 本次实际结算月数 */
  monthsSettled: number;
  /** 结算后跨年的年份列表 */
  yearsClosed: number[];
  /** 是否因时间回拨而 0 结算 */
  clockRolledBack: boolean;
  /** 是否因资金危机等原因提前中断 */
  interrupted: boolean;
  /** 本次可计时长（ms，已做 24h 封顶） */
  eligibleMs: number;
  /** 应用后的新余量（ms） */
  newRemainderMs: number;
  /** 结算前现金（用于摘要展示收益） */
  cashBefore: number;
}

export const NO_OFFLINE: Omit<OfflineResult, 'cashBefore'> = {
  monthsSettled: 0,
  yearsClosed: [],
  clockRolledBack: false,
  interrupted: false,
  eligibleMs: 0,
  newRemainderMs: 0,
};

/**
 * 纯计算：由离线时长与当前余量推导「应结月数」与「新余量」。
 * 不依赖状态，便于单测边界（G009/B09/封顶）。
 */
export function computeOfflineMonths(
  cfg: EconomyConfig,
  safeGapMs: number,
  currentRemainderMs: number,
): { months: number; newRemainderMs: number; eligibleMs: number } {
  const perMonth = cfg.time.offlineRealMsPerGameMonth;
  const maxMonths = cfg.time.maxOfflineMonthsPerSession;
  const eligibleCap = cfg.time.maxEligibleOfflineMsPerSession; // 24h

  const eligibleMs = Math.max(0, Math.min(safeGapMs, eligibleCap));
  const credit = eligibleMs + Math.max(0, currentRemainderMs);
  let months = Math.floor(credit / perMonth);
  let newRemainderMs = credit - months * perMonth;

  if (months >= maxMonths) {
    months = maxMonths;
    newRemainderMs = 0; // 封顶后余量清零，杜绝反复套利
  }
  return { months, newRemainderMs, eligibleMs };
}

/**
 * 执行离线结算并就地更新 state（推进月份、余量、水位）。
 * 由应用层在变更锁内调用并负责持久化。
 */
export function settleOffline({ state, cfg, nowMs }: OfflineInput): OfflineResult {
  const cashBefore = state.company?.cashYuan ?? 0;

  if (state.phase !== 'RUNNING' || state.speed === 0) {
    // 暂停/非经营态：不结算，但水位仍向前，避免下次离线把这段时间计入
    state.lastWallClockMs = Math.max(nowMs, state.lastWallClockMs);
    return { ...NO_OFFLINE, cashBefore, newRemainderMs: state.offlineRemainderMs };
  }

  const gapMs = nowMs - state.lastWallClockMs;
  if (gapMs <= 0) {
    // 时间回拨：0 结算、更新水位防回拨漏洞（B08）
    state.lastWallClockMs = Math.max(nowMs, state.lastWallClockMs);
    return { ...NO_OFFLINE, cashBefore, clockRolledBack: true };
  }

  const { months, newRemainderMs, eligibleMs } = computeOfflineMonths(
    cfg,
    gapMs,
    state.offlineRemainderMs,
  );

  const yearsClosed: number[] = [];
  let settled = 0;
  let interrupted = false;

  for (let i = 0; i < months; i++) {
    try {
      const closed = advanceMonth(state, cfg);
      settled += 1;
      if (closed.yearClosed) yearsClosed.push(state.gameYear - 1);
    } catch (err) {
      // 资金危机冻结：停止跳月，不生成伪 Ledger；已处理月份不退回
      if (
        err instanceof Error &&
        (err.message === GameErrorCode.NOT_READY || err.message === 'DISTRESS_FROZEN')
      ) {
        interrupted = true;
        break;
      }
      throw err;
    }
  }

  // 中断时，未消耗月份对应的余量应保留（按已消耗月数折算），避免凭空丢弃或套利
  if (interrupted) {
    const perMonth = cfg.time.offlineRealMsPerGameMonth;
    const consumedMs = settled * perMonth;
    const totalCredit = state.offlineRemainderMs + eligibleMs;
    state.offlineRemainderMs = Math.max(0, totalCredit - consumedMs);
  } else {
    state.offlineRemainderMs = newRemainderMs;
  }

  state.lastWallClockMs = Math.max(nowMs, state.lastWallClockMs);
  return {
    monthsSettled: settled,
    yearsClosed,
    clockRolledBack: false,
    interrupted,
    eligibleMs,
    newRemainderMs: state.offlineRemainderMs,
    cashBefore,
  };
}
