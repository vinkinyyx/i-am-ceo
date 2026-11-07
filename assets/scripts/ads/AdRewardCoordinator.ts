import type { GameFacade } from '../../core/application/GameFacade';
import type { IRewardedAdProvider, RewardedAdResult } from '../../core/platform/IRewardedAdProvider';

/** Serializes user requested sessions and grants only after the provider's completed callback. */
export class AdRewardCoordinator {
  private nextId = 0;
  private activeSessionId: string | null = null;
  private pendingCompletedSessionId: string | null = null;
  private pendingRunId: string | null = null;
  private pendingOwnerCurrent: (() => boolean) | null = null;
  private pendingOwnerScope: string | null = null;

  constructor(
    private readonly provider: IRewardedAdProvider,
    private readonly facade: GameFacade,
    private readonly captureOwner: () => () => boolean = () => () => true,
    private readonly getOwnerScope: () => string = () => 'local',
    /**
     * DEV-02：owner 确认状态。'unknown'（身份核对中/网络未知/代际竞态）时 pending 保留待核对，
     * 绝不按“已确认换号”走 quarantine；只有 'confirmed' 且 ownerCurrent=false 才是真实换号。
     */
    private readonly getOwnerStatus: () => 'confirmed' | 'unknown' = () => 'confirmed',
  ) {}

  hasActiveSession(): boolean { return this.activeSessionId !== null; }
  hasPendingGrant(): boolean { return this.pendingCompletedSessionId !== null; }
  canStart(): boolean { return this.provider.isAvailable(); }

  async request(nowMs = Date.now()): Promise<RewardedAdResult> {
    if (this.pendingCompletedSessionId && this.pendingRunId) {
      // DEV-02：owner 未知（身份核对中/网络未知）→ 保留原 pending 稍后核对；不 quarantine、不新发。
      if (this.getOwnerStatus() === 'unknown') {
        return { kind: 'unavailable', reason: 'owner-unconfirmed' };
      }
      if (this.pendingOwnerCurrent?.()) return this.retryPendingGrant();
      const quarantined = await this.facade.quarantineRewardedAdSession(this.pendingCompletedSessionId, this.pendingRunId);
      if (!quarantined.ok) {
        return { kind: 'failed', reason: `old-session-reconciliation:${quarantined.code}` };
      }
      this.clearPendingGrant();
      // The old callback is terminal for this owner; this request may now begin a new owner's session.
    }
    if (!this.provider.isAvailable()) return { kind: 'unavailable', reason: 'provider-unavailable' };
    const ownerCurrent = this.captureOwner();
    const ownerScope = this.getOwnerScope();
    const runId = this.facade.getState().runId;
    const sessionId = `${runId}:${nowMs}:${++this.nextId}`;
    const begun = await this.facade.beginRewardedAdSession(sessionId, nowMs, runId, ownerCurrent, ownerScope);
    if (!begun.ok || !begun.payload) return { kind: 'unavailable', reason: begun.ok ? 'daily-limit' : begun.code };
    this.activeSessionId = sessionId;
    let result: RewardedAdResult;
    try { result = await this.provider.show(sessionId); }
    catch { result = { kind: 'failed', reason: 'provider-rejected' }; }
    if (result.kind === 'completed' && result.sessionId === sessionId) {
      this.pendingCompletedSessionId = sessionId;
      this.pendingRunId = runId;
      this.pendingOwnerCurrent = ownerCurrent;
      this.pendingOwnerScope = ownerScope;
      // The native surface is gone; grant reconciliation must not block game time.
      this.activeSessionId = null;
      // DEV-02：发券前 owner 未确认（核对中/网络未知）→ 保留 pending 待后续核对；不发券、不丢弃、不按换号处理。
      if (this.getOwnerStatus() === 'unknown') {
        return { kind: 'unavailable', reason: 'owner-unconfirmed' };
      }
      const granted = await this.facade.completeRewardedAdSession(sessionId, Date.now(), runId, ownerCurrent, ownerScope);
      if (!granted.ok) return { kind: 'failed', reason: `grant-unresolved:${granted.code}` };
      this.clearPendingGrant();
      if (!granted.payload) return { kind: 'failed', reason: 'grant-rejected' };
      return result;
    }
    await this.facade.cancelRewardedAdSession(sessionId, runId);
    this.activeSessionId = null;
    return result;
  }

  private async retryPendingGrant(): Promise<RewardedAdResult> {
    const sessionId = this.pendingCompletedSessionId;
    const runId = this.pendingRunId;
    if (!sessionId || !runId) return { kind: 'unavailable', reason: 'no-pending-grant' };
    const ownerCurrent = this.pendingOwnerCurrent ?? (() => false);
    const ownerScope = this.pendingOwnerScope ?? 'local';
    const granted = await this.facade.completeRewardedAdSession(sessionId, Date.now(), runId, ownerCurrent, ownerScope);
    if (!granted.ok) return { kind: 'failed', reason: `grant-unresolved:${granted.code}` };
    this.clearPendingGrant();
    return granted.payload ? { kind: 'completed', sessionId } : { kind: 'failed', reason: 'grant-rejected' };
  }

  private clearPendingGrant(): void {
    this.pendingCompletedSessionId = null;
    this.pendingRunId = null;
    this.pendingOwnerCurrent = null;
    this.pendingOwnerScope = null;
  }

  /** On process restart no native completion receipt survives, so reserved sessions are canceled without reward. */
  async recoverInterruptedSession(): Promise<void> {
    const reward = this.facade.getState().adRewards;
    if (!reward?.activeSessionId || this.activeSessionId) return;
    await this.facade.cancelRewardedAdSession(reward.activeSessionId, reward.activeRunId ?? this.facade.getState().runId);
  }

  cancelActive(): void {
    if (this.activeSessionId) this.provider.cancelActive?.();
  }

  cancelLoading(): void { this.provider.cancelLoading?.(); }
}
