/**
 * 所有业务命令的公共包装（设计文档 12.1）。
 * - commandId：一次点击唯一；重试同一动作必须复用，用于收费命令幂等。
 * - expectedRunId：命令期望作用的 run；旧 run 的迟到命令必须被拒绝（RUN_CHANGED）。
 * - expectedRevision：可选乐观并发保护。
 */
export interface CommandBase {
  readonly commandId: string;
  readonly expectedRunId: string;
  readonly expectedRevision?: number;
}

/** 幂等命令记录的滚动保留条数（设计文档 02：滚动最近 N 条）。 */
export const EXECUTED_COMMAND_ID_KEEP = 200;

export function assertCommandBase(cmd: CommandBase): void {
  if (typeof cmd.commandId !== 'string' || cmd.commandId.length === 0) {
    throw new Error('commandId is required');
  }
  if (typeof cmd.expectedRunId !== 'string' || cmd.expectedRunId.length === 0) {
    throw new Error('expectedRunId is required');
  }
}
