import type { GameState } from '../domain/types';

/**
 * 串行变更上下文（设计文档 12：所有命令在 GameMutationLock + runId 校验 + 成功持久化 包装下执行）。
 * 纯领域层不直接触碰存储：由应用层在 apply 后负责 commit；
 * 这里负责命令幂等记录与 revision 推进。
 */
export interface MutationResult<T> {
  state: GameState;
  revision: number;
  payload: T;
  /** 幂等命中：同一 commandId 重试，返回首次结果，不再扣费/改状态。 */
  idempotentReplay: boolean;
}

export const INITIAL_CAPITAL_YUAN = 300_000;

export function ensureRunId(state: GameState, expectedRunId: string): void {
  if (state.runId !== expectedRunId) {
    throw new Error('RUN_CHANGED');
  }
}

export function ensureRevision(state: GameState, expectedRevision?: number): void {
  // revision 在外层信封维护；内存态通过 rngCounter/executedCommandIds 间接保护。
  // 若调用方传入期望版本，由应用层在提交前比对，这里只做占位契约。
  void state;
  void expectedRevision;
}

export function hasCommand(state: GameState, commandId: string): boolean {
  return state.executedCommandIds.includes(commandId);
}

export function recordCommand(state: GameState, commandId: string): void {
  state.executedCommandIds.push(commandId);
  if (state.executedCommandIds.length > 200) {
    state.executedCommandIds = state.executedCommandIds.slice(-200);
  }
}
