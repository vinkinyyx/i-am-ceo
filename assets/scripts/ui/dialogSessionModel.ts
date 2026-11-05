/**
 * R31：DialogManager 的最小会话模型（纯逻辑，无引擎依赖）。
 * 只负责“谁在栈里、归属哪一代上下文、是否阻塞、何时移出”；UI 资源释放仍在 dialogs.ts。
 */

export type DialogKind = 'detail' | 'form' | 'confirm' | 'blocking-recovery' | 'notice';

export type DialogCloseReason =
  | 'user-close'
  | 'user-back'
  | 'user-navigation'
  | 'submit-success'
  | 'context-invalidated'
  | 'application-dispose';

export interface DialogOwner {
  runId: string | null;
  accountEpoch: number;
  contextEpoch: number;
  entityId?: string;
}

export interface DialogSession {
  id: string;
  kind: DialogKind;
  semanticKey: string;
  owner: DialogOwner;
  sourceRevision: number | null;
  policy: 'manual' | 'submit-result' | 'recovery';
  closed: boolean;
  closeReason?: DialogCloseReason;
}

export interface RegisterDialogInput {
  id: string;
  kind: DialogKind;
  semanticKey: string;
  owner: DialogOwner;
  sourceRevision?: number | null;
  policy?: 'manual' | 'submit-result' | 'recovery';
}

export function sameOwner(a: DialogOwner, b: DialogOwner): boolean {
  return a.runId === b.runId && a.accountEpoch === b.accountEpoch && a.contextEpoch === b.contextEpoch;
}

/**
 * 打开中的弹窗登记表。语义：
 * - register 只登记一次；同 semanticKey 已存在时返回 null，调用方应聚焦已有窗口，不叠层。
 * - unregisterOnce 幂等；重复关闭返回 null。
 * - invalidateOwner 用于真正上下文失效（换 run/账号/应用销毁），与普通月结 revision 无关。
 */
export class DialogSessionModel {
  private sessions: DialogSession[] = [];

  register(input: RegisterDialogInput): DialogSession | null {
    if (this.hasSemanticKey(input.semanticKey)) return null;
    const session: DialogSession = {
      id: input.id,
      kind: input.kind,
      semanticKey: input.semanticKey,
      owner: input.owner,
      sourceRevision: input.sourceRevision ?? null,
      policy: input.policy ?? 'manual',
      closed: false,
    };
    this.sessions.push(session);
    return session;
  }

  unregisterOnce(id: string, reason: DialogCloseReason): DialogSession | null {
    const index = this.sessions.findIndex((session) => session.id === id && !session.closed);
    if (index < 0) return null;
    const session = this.sessions[index]!;
    session.closed = true;
    session.closeReason = reason;
    this.sessions.splice(index, 1);
    return session;
  }

  find(id: string): DialogSession | null {
    return this.sessions.find((session) => session.id === id) ?? null;
  }

  findBySemanticKey(key: string): DialogSession | null {
    return this.sessions.find((session) => session.semanticKey === key) ?? null;
  }

  hasSemanticKey(key: string): boolean {
    return this.sessions.some((session) => session.semanticKey === key);
  }

  top(): DialogSession | null {
    return this.sessions.length ? (this.sessions[this.sessions.length - 1] ?? null) : null;
  }

  openCount(): number {
    return this.sessions.length;
  }

  /** 广告/离线摘要/危机等“是否已有窗口占用最上层”的判断入口。 */
  hasBlockingModal(): boolean {
    return this.sessions.some((session) => session.kind !== 'notice');
  }

  /** 详情层是否打开（用于危机提示先让位、关闭后补弹）。 */
  hasDetail(): boolean {
    return this.sessions.some((session) => session.kind === 'detail');
  }

  invalidateOwner(predicate: (owner: DialogOwner) => boolean, reason: DialogCloseReason): DialogSession[] {
    const removed: DialogSession[] = [];
    this.sessions = this.sessions.filter((session) => {
      if (!predicate(session.owner)) return true;
      session.closed = true;
      session.closeReason = reason;
      removed.push(session);
      return false;
    });
    return removed;
  }

  /** 清理被外部销毁/节点失效的会话（不模拟用户取消）。 */
  pruneInvalid(isInvalid: (session: DialogSession) => boolean, reason: DialogCloseReason): DialogSession[] {
    const removed: DialogSession[] = [];
    this.sessions = this.sessions.filter((session) => {
      if (!isInvalid(session)) return true;
      session.closed = true;
      session.closeReason = reason;
      removed.push(session);
      return false;
    });
    return removed;
  }

  clear(reason: DialogCloseReason): DialogSession[] {
    const removed = this.sessions.map((session) => {
      session.closed = true;
      session.closeReason = reason;
      return session;
    });
    this.sessions = [];
    return removed;
  }
}
