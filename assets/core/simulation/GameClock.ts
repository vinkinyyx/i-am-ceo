import type { EconomyConfig } from '../config/EconomyConfig';
import { GameErrorCode } from '../domain/errors';
import type { GameSpeed, GameState } from '../domain/types';
import { advanceMonth } from './advanceMonth';

/**
 * 在线经营时钟（设计文档 03.1 / DEC-014 / G008）。
 * 1× 全年 300000ms（月 25000），2× 全年 150000，5× 全年 60000；暂停不累积。
 * 累积到一个月即原子月结；一次 tick 可跨多月（离线/大帧步进也复用同一核心）。
 *
 * progressMsInMonth 持久化：切后台/杀进程恢复不重结、不漏结。
 */
export const SPEED_TO_MS_PER_YEAR: Record<GameSpeed, number> = {
  0: 0,
  1: 300_000,
  2: 150_000,
  5: 60_000,
};

export function msPerMonth(cfg: EconomyConfig, speed: GameSpeed): number {
  const perYear = SPEED_TO_MS_PER_YEAR[speed] ?? 0;
  return perYear / cfg.time.monthsPerYear;
}

export interface ClockTickResult {
  monthsAdvanced: number;
  yearsClosed: number[];
}

export class GameClock {
  /**
   * 月结前钩子（应用层注入自动招聘等自动化决策）。
   * 在每个月 advanceMonth 之前、同一变更锁内调用；不参与黄金确定性时可留空。
   */
  beforeMonthSettle: ((state: GameState, cfg: EconomyConfig) => void) | null = null;

  /**
   * 推进真实毫秒数。阈值按当前倍速对应的"真实毫秒/月"（G008）：
   * 1× 25000ms/月、2× 12500ms/月、5× 5000ms/月。
   */
  tick(
    state: GameState,
    cfg: EconomyConfig,
    elapsedRealMs: number,
    speedOverride?: GameSpeed,
  ): ClockTickResult {
    const speed = speedOverride ?? state.speed;
    const result: ClockTickResult = { monthsAdvanced: 0, yearsClosed: [] };
    if (speed === 0 || state.phase !== 'RUNNING') {
      return result;
    }
    const monthMs = msPerMonth(cfg, speed); // 当前倍速下的真实毫秒/月
    if (monthMs <= 0) return result;

    state.progressMsInMonth = (state.progressMsInMonth ?? 0) + elapsedRealMs;

    while (state.progressMsInMonth >= monthMs && state.phase === 'RUNNING') {
      state.progressMsInMonth -= monthMs;
      // 自动化决策（自动招聘）在月结前同一锁内执行，员工次月生效故不污染本月
      this.beforeMonthSettle?.(state, cfg);
      const closed = advanceMonth(state, cfg);
      result.monthsAdvanced += 1;
      if (closed.yearClosed) {
        result.yearsClosed.push(state.gameYear - 1);
      }
    }
    if (state.progressMsInMonth < 0) state.progressMsInMonth = 0;
    return result;
  }

  setSpeed(state: GameState, speed: GameSpeed): void {
    if (speed !== 0 && speed !== 1 && speed !== 2 && speed !== 5) {
      throw new Error(GameErrorCode.INVALID_SPEED);
    }
    // 改速度不清零月内进度（DEC-014：进度按当前速度累积）；进入经营需 phase=RUNNING
    state.speed = speed;
  }
}
