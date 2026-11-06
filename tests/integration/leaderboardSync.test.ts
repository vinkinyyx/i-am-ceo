import { describe, expect, it } from 'vitest';
import { LeaderboardSyncService } from '@core/application/LeaderboardSyncService';
import { createInitialState } from '@core/domain/gameStateFactory';
import type { ILeaderboardProvider } from '@core/platform/ILeaderboardProvider';
import type { LeaderboardRuntimeConfig } from '@core/platform/externalServiceConfig';

class FakeBoard implements ILeaderboardProvider {
  submitted: Array<{ id: string; score: number }> = [];
  failIds = new Set<string>();
  isAvailable() { return true; }
  async open() { return { kind: 'ok' as const }; }
  async loadCurrent() { return { kind: 'ok' as const, value: { rank: 1, score: 1 } }; }
  async submit(id: string, score: number) {
    this.submitted.push({ id, score });
    return this.failIds.has(id) ? { kind: 'unavailable' as const, reason: 'network' } : { kind: 'ok' as const };
  }
}
const config: LeaderboardRuntimeConfig = { schemaVersion: 1, enabled: true, environment: 'test', appId: 'app', policyVersion: 3, assetsBoardId: 'assets', yearsBoardId: 'years', calculation: 'latest' };

describe('leaderboard sync fencing', () => {
  it('only submits after a confirmed checkpoint and rate limits subsequent snapshots', async () => {
    const provider = new FakeBoard();
    const service = new LeaderboardSyncService(provider, config);
    const state = createInitialState(1_800_000_000_000, 45);
    let current = true;
    expect((await service.submitCloudConfirmed(state, '', 100_000, () => current)).reason).toBe('stale-or-unconfirmed-checkpoint');
    const result = await service.submitCloudConfirmed(state, 'cp-1', 100_000, () => current);
    expect(result).toMatchObject({ assets: 'synced', years: 'synced' });
    expect(provider.submitted.map((x) => x.id)).toEqual(['assets', 'years']);
    current = false;
    service.changeAccount();
    expect((await service.submitCloudConfirmed(state, 'cp-2', 200_000, () => current)).reason).toBe('stale-or-unconfirmed-checkpoint');
    expect(provider.submitted).toHaveLength(2);
  });

  it('retries only the failed board for the same frozen checkpoint', async () => {
    const provider = new FakeBoard();
    provider.failIds.add('years');
    const service = new LeaderboardSyncService(provider, config);
    const state = createInitialState(1_800_000_000_000, 46);
    const first = await service.submitCloudConfirmed(state, 'cp-9', 100_000, () => true);
    expect(first).toMatchObject({ assets: 'synced', years: 'failed' });
    expect(provider.submitted.map((x) => x.id)).toEqual(['assets', 'years']);

    provider.failIds.clear();
    const retry = await service.submitCloudConfirmed(state, 'cp-9', 200_000, () => true);
    expect(retry).toMatchObject({ assets: 'synced', years: 'synced' });
    // 资产榜不重复提交，只补年限榜
    expect(provider.submitted.map((x) => x.id)).toEqual(['assets', 'years', 'years']);
  });
});
