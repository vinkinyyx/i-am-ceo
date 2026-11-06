import { describe, expect, it } from 'vitest';
import { createInitialState } from '@core/domain/gameStateFactory';
import { GameStore } from '@core/application/GameStore';
import { MemoryStorage } from '../helpers/MemoryStorage';
import { cloneGameState } from '@core/persistence/cloneGameState';

describe('cloud checkpoint import transaction', () => {
  it('commits once, preserves local ad ledger and clears offline settlement on restore', async () => {
    const storage = new MemoryStorage();
    const state = createInitialState(1_800_000_000_000, 330);
    state.adRewards = { localDay: '2026-11-04', promptsShown: 1, grantsUsed: 0, couponIds: ['local-coupon'], completedSessionIds: [] };
    const store = new GameStore(storage, state);
    await store.mutate((draft) => { draft.lastWallClockMs += 1; }, state.runId);
    const imported = cloneGameState(store.current);
    imported.adRewards = { localDay: '2026-11-04', promptsShown: 0, grantsUsed: 1, couponIds: ['cloud-coupon'], completedSessionIds: ['cloud-session'] };
    imported.lastWallClockMs = 1;
    imported.offlineRemainderMs = 60_000;
    const revision = await store.importCloudState(imported, state.runId, store.currentRevision, 1_800_000_000_100);
    expect(revision).toBe(2);
    expect(store.current.adRewards?.couponIds).toEqual(['local-coupon']);
    expect(store.current.adRewards?.completedSessionIds).toEqual([]);
    expect(store.current.lastWallClockMs).toBe(1_800_000_000_100);
    expect(store.current.offlineRemainderMs).toBe(0);
    expect((await GameStore.load(storage))?.current).toEqual(store.current);
  });

  it('rejects a stale base or a different run before changing local state', async () => {
    const storage = new MemoryStorage();
    const state = createInitialState(1_800_000_000_000, 331);
    const store = new GameStore(storage, state);
    await store.mutate((draft) => { draft.lastWallClockMs += 1; }, state.runId);
    const imported = cloneGameState(store.current);
    imported.runId = 'run-stale';
    const before = JSON.stringify(store.current);
    await expect(store.importCloudState(imported, state.runId, 1, 1_800_000_000_100)).rejects.toThrow();
    expect(JSON.stringify(store.current)).toBe(before);
  });

  it('replaces an active different run through the explicit reset transaction and keeps the local ad ledger', async () => {
    const storage = new MemoryStorage();
    const local = createInitialState(1_800_000_000_000, 334);
    local.adRewards = { localDay: '2026-11-04', promptsShown: 1, grantsUsed: 0, couponIds: ['local-coupon'], completedSessionIds: [] };
    const store = new GameStore(storage, local);
    await store.mutate((draft) => { draft.lastWallClockMs += 1; }, local.runId);
    const remote = createInitialState(1_800_000_000_001, 335);
    remote.adRewards = { localDay: '2026-11-04', promptsShown: 0, grantsUsed: 1, couponIds: ['remote-coupon'], completedSessionIds: ['remote-session'] };
    remote.offlineRemainderMs = 90_000;
    const revision = await store.replaceWithCloudState(remote, local.runId, store.currentRevision, 1_800_000_000_500);
    expect(revision).toBe(1);
    expect(store.current.runId).toBe(remote.runId);
    expect(store.current.adRewards?.couponIds).toEqual(['local-coupon']);
    expect(store.current.adRewards?.completedSessionIds).toEqual([]);
    expect(store.current.offlineRemainderMs).toBe(0);
    expect(store.current.lastWallClockMs).toBe(1_800_000_000_500);
    expect(await store.repository().readTombstone()).toMatchObject({ oldRunId: local.runId });
    expect((await GameStore.load(storage))?.current.runId).toBe(remote.runId);
  });

  it('refuses to resurrect a run closed by the local reset tombstone', async () => {
    const storage = new MemoryStorage();
    const local = createInitialState(1_800_000_000_000, 336);
    const store = new GameStore(storage, local);
    const closedRunId = local.runId;
    await store.mutate((draft) => { draft.lastWallClockMs += 1; }, closedRunId);
    const next = createInitialState(1_800_000_000_100, 337);
    await store.replaceWithNewRun(next, closedRunId, 1_800_000_000_200);
    const stale = createInitialState(1_800_000_000_300, 338);
    stale.runId = closedRunId;
    await expect(
      store.replaceWithCloudState(stale, next.runId, store.currentRevision, 1_800_000_000_400),
    ).rejects.toMatchObject({ code: 'RUN_CHANGED' });
    expect(store.current.runId).toBe(next.runId);
  });
});
