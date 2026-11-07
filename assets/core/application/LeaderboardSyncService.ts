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
  /** A24-09：同一 checkpoint 的部分失败只补未成功的一榜，不重复成功项。 */
  private lastOutcome: { target: string; assets: boolean; years: boolean } | null = null;

  constructor(private readonly provider: ILeaderboardProvider, private readonly config: LeaderboardRuntimeConfig) {}

  changeAccount(): void { this.accountEpoch += 1; this.latestTargetKey = ''; this.lastOutcome = null; }

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
    const retry = this.lastOutcome?.target === target ? this.lastOutcome : null;
    const task = (async (): Promise<LeaderboardSyncResult> => {
      const results: Array<'synced' | 'failed'> = [];
      const boards = [
        [this.config.assetsBoardId, score.assets, retry?.assets === true],
        [this.config.yearsBoardId, score.completedYears, retry?.years === true],
      ] as const;
      for (const [id, value, alreadySynced] of boards) {
        if (alreadySynced) { results.push('synced'); continue; }
        if (!stillCurrent() || epoch !== this.accountEpoch || this.latestTargetKey !== target) {
          return { checkpointId, runId, assets: 'skipped', years: 'skipped', reason: 'stale-or-consent-revoked' };
        }
        const submitted = await this.provider.submit(id, value);
        if (!stillCurrent() || epoch !== this.accountEpoch || this.latestTargetKey !== target) {
          return { checkpointId, runId, assets: 'skipped', years: 'skipped', reason: 'stale-or-consent-revoked' };
        }
        results.push(submitted.kind === 'ok' ? 'synced' : 'failed');
      }
      this.lastSubmittedAtMs = nowMs;
      this.lastOutcome = { target, assets: results[0] === 'synced', years: results[1] === 'synced' };
      return { checkpointId, runId, assets: results[0]!, years: results[1]!, ...(results.includes('failed') ? { reason: 'partial-or-failed-submit' } : {}) };
    })();
    this.inFlight = task;
    try { return await task; } finally { if (this.inFlight === task) this.inFlight = null; }
  }
}
