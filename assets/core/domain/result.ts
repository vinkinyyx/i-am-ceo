import type { GameErrorCode } from './errors';

/**
 * 统一命令返回结构（设计文档 12.1）。
 * 失败时不得改变任何状态，不允许执行“半笔钱、半次裁员”。
 */
export interface CommandSuccess<T> {
  readonly ok: true;
  readonly revision: number;
  readonly runId: string;
  readonly payload: T;
}

export interface CommandFailure {
  readonly ok: false;
  readonly code: GameErrorCode;
  readonly displayMessage: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export type CommandResult<T> = CommandSuccess<T> | CommandFailure;

export function ok<T>(runId: string, revision: number, payload: T): CommandSuccess<T> {
  return { ok: true, runId, revision, payload };
}

export function fail(
  code: GameErrorCode,
  displayMessage: string,
  details?: Record<string, unknown>,
): CommandFailure {
  return details === undefined
    ? { ok: false, code, displayMessage }
    : { ok: false, code, displayMessage, details: { ...details } };
}

export function isSuccess<T>(r: CommandResult<T>): r is CommandSuccess<T> {
  return r.ok;
}
