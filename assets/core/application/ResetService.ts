import { GameErrorCode } from '../domain/errors';
import { createFreshRunState } from '../domain/gameStateFactory';
import { uniqueToken } from '../domain/ids';
import type { GameState } from '../domain/types';
import { playerYears } from '../simulation/leaderboard';

/**
 * 主动关闭公司（设计文档 02.5 / 12.6）。
 * 事务：二次确认(60s token) → 墓碑 → 全新 run（新 runId、新 seed、0 水位、未注资）。
 * 旧 run 的 save/settleOffline/hire 迟到回调由 expectedRunId + resetGeneration 屏蔽。
 * 不注销 TapTap 账号，不触碰依法留存的认证记录。
 */
export interface ClosePreview {
  confirmationToken: string;
  issuedAtMs: number;
  expiresAtMs: number;
  oldRunId: string;
  summary: {
    companyName: string;
    yearsOperated: number;
    cashYuan: number;
    employeeCount: number;
  };
}

const TOKEN_TTL_MS = 60_000;

export function closeCompanyPreview(state: GameState, nowMs: number): ClosePreview {
  if (!state.company) throw new Error(GameErrorCode.NOT_READY);
  return {
    confirmationToken: uniqueToken('close'),
    issuedAtMs: nowMs,
    expiresAtMs: nowMs + TOKEN_TTL_MS,
    oldRunId: state.runId,
    summary: {
      companyName: state.company.name,
      // Annual reports are pruned for bounded saves; the game-year axis is monotonic.
      yearsOperated: playerYears(state),
      cashYuan: state.company.cashYuan,
      employeeCount: state.employees.filter((e) => e.status !== 'DISMISSED').length,
    },
  };
}

/**
 * 执行关闭：返回全新 run 的内存状态。
 * 调用方（应用层）必须在同一事务里：写墓碑 → 提交新 run → 清理旧槽。
 */
export function confirmCloseCompany(
  state: GameState,
  token: { confirmationToken: string; expiresAtMs: number; oldRunId: string },
  nowMs: number,
): { oldRunId: string; newState: GameState } {
  if (!state.company) throw new Error(GameErrorCode.NOT_READY);
  if (nowMs > token.expiresAtMs) throw new Error(GameErrorCode.CONFIRMATION_EXPIRED);
  if (token.oldRunId !== state.runId) throw new Error(GameErrorCode.RUN_CHANGED);
  if (!token.confirmationToken) throw new Error(GameErrorCode.CONFIRMATION_EXPIRED);

  const oldRunId = state.runId;
  const newState = createFreshRunState(nowMs);
  newState.lastWallClockMs = nowMs;
  newState.offlineRemainderMs = 0;
  return { oldRunId, newState };
}
