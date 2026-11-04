/**
 * R15：前后台真实时间水位（§14.5）。
 * - enterBackground：记录离场时间；
 * - enterForeground：用注入时钟计算真实 elapsed，重复/乱序事件去重；
 * - settle 成功后推进水位，快速连续 onShow（10 次切后台）只结算一次。
 * 纯 TS、引擎无关。
 */
export interface ForegroundClockState {
  /** 最近一次回到前台的时间（0=尚未记录）。 */
  lastForegroundMs: number;
  /** 最近一次进入后台的时间（0=当前在前台）。 */
  lastBackgroundMs: number;
  /** 已结算到的离线水位；相同区间不重复结算。 */
  settledUpToMs: number;
}

export function createForegroundClock(now: () => number): {
  state(): ForegroundClockState;
  enterBackground(atMs?: number): number;
  /**
   * 回到前台：返回自上次已结算水位以来的真实毫秒数；
   * 重复/乱序/时钟回拨返回 0。
   */
  enterForeground(atMs?: number): number;
  /** Read a pending foreground interval without consuming it before save succeeds. */
  peekForegroundElapsed(atMs?: number): number;
  /** 标记离线区间已结算到指定时间（成功提交后调用）。 */
  markSettled(upToMs: number): void;
  /** 在线推进时同步水位，避免下一次离线重复计入。 */
  noteOnlineProgress(upToMs: number): void;
} {
  const s: ForegroundClockState = {
    lastForegroundMs: 0,
    lastBackgroundMs: 0,
    settledUpToMs: 0,
  };

  return {
    state: () => ({ ...s }),
    peekForegroundElapsed(atMs) {
      const t = atMs ?? now();
      const leftAt = s.lastBackgroundMs || s.lastForegroundMs;
      if (!leftAt || t <= leftAt) return 0;
      const from = Math.max(s.settledUpToMs, leftAt);
      return t > from ? t - from : 0;
    },
    enterBackground(atMs) {
      const t = atMs ?? now();
      s.lastBackgroundMs = t;
      if (s.lastForegroundMs === 0) s.lastForegroundMs = t;
      return t;
    },
    enterForeground(atMs) {
      const t = atMs ?? now();
      const leftAt = s.lastBackgroundMs || s.lastForegroundMs;
      s.lastForegroundMs = t;
      s.lastBackgroundMs = 0;
      if (!leftAt || t <= leftAt) return 0; // 乱序/回拨/重复 onShow
      const from = Math.max(s.settledUpToMs, leftAt);
      if (t <= from) return 0; // 该区间已结算
      return t - from;
    },
    markSettled(upToMs) {
      if (upToMs > s.settledUpToMs) s.settledUpToMs = upToMs;
      if (upToMs > s.lastForegroundMs) s.lastForegroundMs = upToMs;
      if (s.lastBackgroundMs > 0 && s.lastBackgroundMs <= upToMs) s.lastBackgroundMs = 0;
    },
    noteOnlineProgress(upToMs) {
      if (upToMs > s.settledUpToMs) s.settledUpToMs = upToMs;
      s.lastForegroundMs = upToMs;
      if (s.lastBackgroundMs > 0 && s.lastBackgroundMs <= upToMs) s.lastBackgroundMs = 0;
    },
  };
}
