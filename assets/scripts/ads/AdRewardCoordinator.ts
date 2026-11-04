import type { GameFacade } from '../../core/application/GameFacade';
import type { IRewardedAdProvider, RewardedAdResult } from '../../core/platform/IRewardedAdProvider';

/** Serializes user requested sessions and grants only after the provider's completed callback. */
export class AdRewardCoordinator {
  private nextId = 0;
  private activeSessionId: string | null = null;
  private pendingCompletedSessionId: string | null = null;
  private pendingRunId: string | null = null;

  constructor(private readonly provider: IRewardedAdProvider, private readonly facade: GameFacade) {}

  hasActiveSession(): boolean { return this.activeSessionId !== null; }
  hasPendingGrant(): boolean { return this.pendingCompletedSessionId !== null; }

  async request(nowMs = Date.now()): Promise<RewardedAdResult> {
    if (this.pendingCompletedSessionId && this.pendingRunId) return this.retryPendingGrant();
    if (!this.provider.isAvailable()) return { kind: 'unavailable', reason: 'provider-unavailable' };
    const runId = this.facade.getState().runId;
    const sessionId = `${runId}:${nowMs}:${++this.nextId}`;
    const begun = await this.facade.beginRewardedAdSession(sessionId, nowMs, runId);
    if (!begun.ok || !begun.payload) return { kind: 'unavailable', reason: begun.ok ? 'daily-limit' : begun.code };
    this.activeSessionId = sessionId;
    let result: RewardedAdResult;
    try { result = await this.provider.show(sessionId); }
    catch { result = { kind: 'failed', reason: 'provider-rejected' }; }
    if (result.kind === 'completed' && result.sessionId === sessionId) {
      this.pendingCompletedSessionId = sessionId;
      this.pendingRunId = runId;
      const granted = await this.facade.completeRewardedAdSession(sessionId, Date.now(), runId);
      if (!granted.ok) return { kind: 'failed', reason: `grant-unresolved:${granted.code}` };
      this.pendingCompletedSessionId = null;
      this.pendingRunId = null;
      this.activeSessionId = null;
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
    const granted = await this.facade.completeRewardedAdSession(sessionId, Date.now(), runId);
    if (!granted.ok) return { kind: 'failed', reason: `grant-unresolved:${granted.code}` };
    this.pendingCompletedSessionId = null;
    this.pendingRunId = null;
    this.activeSessionId = null;
    return granted.payload ? { kind: 'completed', sessionId } : { kind: 'failed', reason: 'grant-rejected' };
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
