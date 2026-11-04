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

  it('allows a clean device to bootstrap from a checkpoint while not importing remote reward rights', async () => {
    const storage = new MemoryStorage();
    const local = createInitialState(1_800_000_000_000, 332);
    const remote = createInitialState(1_800_000_000_001, 333);
    remote.adRewards = { localDay: '2026-11-04', promptsShown: 0, grantsUsed: 1, couponIds: ['remote-coupon'], completedSessionIds: ['remote-session'] };
    const store = new GameStore(storage, local);
    const revision = await store.importCloudState(remote, local.runId, 0, 1_800_000_000_100);
    expect(revision).toBe(1);
    expect(store.current.runId).toBe(remote.runId);
    expect(store.current.adRewards?.couponIds).toEqual([]);
    expect(store.current.adRewards?.completedSessionIds).toEqual([]);
    expect(store.current.offlineRemainderMs).toBe(0);
  });
});
