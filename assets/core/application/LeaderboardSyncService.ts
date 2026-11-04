import type { GameState } from '../domain/types';
import type { ILeaderboardProvider } from '../platform/ILeaderboardProvider';
import type { LeaderboardRuntimeConfig } from '../platform/externalServiceConfig';
import { currentCompanyLeaderboardScores } from './LeaderboardScores';

export interface LeaderboardSyncResult {
  checkpointId: string;
  runId: string;
  assets: 'synced' | 'failed' | 'skipped';
  years: 'synced' | 'failed' | 'skipped';
  reason?: string;
}

/** Submission is explicit and only accepts a caller-confirmed cloud checkpoint. */
export class LeaderboardSyncService {
  private lastSubmittedAtMs = -Infinity;
  private latestTargetKey = '';
  private accountEpoch = 0;
  private inFlight: Promise<LeaderboardSyncResult> | null = null;

  constructor(private readonly provider: ILeaderboardProvider, private readonly config: LeaderboardRuntimeConfig) {}

  changeAccount(): void { this.accountEpoch += 1; this.latestTargetKey = ''; }

  async submitCloudConfirmed(
    state: GameState,
    checkpointId: string,
    nowMs: number,
    stillCurrent: () => boolean,
  ): Promise<LeaderboardSyncResult> {
    const runId = state.runId;
    const target = `${checkpointId}:${runId}`;
    if (!this.config.enabled || !this.provider.isAvailable()) return { checkpointId, runId, assets: 'skipped', years: 'skipped', reason: 'leaderboard-disabled' };
    if (!checkpointId || !Number.isSafeInteger(nowMs) || !stillCurrent()) return { checkpointId, runId, assets: 'skipped', years: 'skipped', reason: 'stale-or-unconfirmed-checkpoint' };
    if (target === this.latestTargetKey && this.inFlight) return this.inFlight;
    if (this.inFlight) return { checkpointId, runId, assets: 'skipped', years: 'skipped', reason: 'previous-submit-in-flight' };
    if (nowMs - this.lastSubmittedAtMs < 60_000) return { checkpointId, runId, assets: 'skipped', years: 'skipped', reason: 'engineering-rate-limit' };
    this.latestTargetKey = target;
    const epoch = this.accountEpoch;
    const score = currentCompanyLeaderboardScores(state);
    const task = (async (): Promise<LeaderboardSyncResult> => {
      const results: Array<'synced' | 'failed'> = [];
      for (const [id, value] of [[this.config.assetsBoardId, score.assets], [this.config.yearsBoardId, score.completedYears]] as const) {
        if (!stillCurrent() || epoch !== this.accountEpoch || this.latestTargetKey !== target) {
          results.push('failed');
          continue;
        }
        const submitted = await this.provider.submit(id, value);
        results.push(submitted.kind === 'ok' ? 'synced' : 'failed');
      }
      this.lastSubmittedAtMs = nowMs;
      return { checkpointId, runId, assets: results[0]!, years: results[1]!, ...(results.includes('failed') ? { reason: 'partial-or-failed-submit' } : {}) };
    })();
    this.inFlight = task;
    try { return await task; } finally { if (this.inFlight === task) this.inFlight = null; }
  }
}
