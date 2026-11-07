import { describe, expect, it } from 'vitest';
import { GameStore } from '@core/application/GameStore';
import { createInitialState } from '@core/domain/gameStateFactory';
import { SAVE_KEYS } from '@core/persistence/SaveTypes';
import { MemoryStorage } from '../helpers/MemoryStorage';

class TombstoneCrashStorage extends MemoryStorage {
  failTargetWrite = false;
  flipOwnerAfterIntent = false;
  holdJournal = false;
  owner = 'profile-a';
  enteredJournalResolve: (() => void) | null = null;
  releaseJournalResolve: (() => void) | null = null;
  readonly enteredJournal = new Promise<void>((resolve) => { this.enteredJournalResolve = resolve; });
  readonly releaseJournal = new Promise<void>((resolve) => { this.releaseJournalResolve = resolve; });

  override async set<T>(key: string, value: T): Promise<void> {
    if (key === SAVE_KEYS.tombstone) {
      await super.set(key, value);
      this.owner = 'profile-b';
      return;
    }
    if (key === SAVE_KEYS.replaceIntent && this.flipOwnerAfterIntent) {
      this.flipOwnerAfterIntent = false;
      await super.set(key, value);
      this.owner = 'profile-b';
      return;
    }
    if (key === SAVE_KEYS.slotA && this.failTargetWrite) {
      this.failTargetWrite = false;
      throw new Error('injected crash after tombstone before target slot');
    }
    if (key === SAVE_KEYS.transaction && this.holdJournal && this.enteredJournalResolve) {
      const entered = this.enteredJournalResolve;
      this.enteredJournalResolve = null;
      await super.set(key, value);
      entered();
      await this.releaseJournal;
      return;
    }
    await super.set(key, value);
  }
}

describe('F26 owner lease and durable cloud replacement', () => {
  it('finishes a staged target after a crash beyond the tombstone and reloads the exact approved state', async () => {
    const storage = new TombstoneCrashStorage();
    const source = createInitialState(1_800_000_000_000, 2601);
    const store = new GameStore(storage, source);
    await store.mutate((draft) => { draft.rngCounter = 7; }, source.runId);
    const baseRevision = store.currentRevision;
    const target = createInitialState(1_800_000_000_100, 2602);
    target.rngCounter = 42;
    storage.failTargetWrite = true;

    await expect(store.replaceWithCloudState(target, source.runId, baseRevision, 1_800_000_000_200,
      () => storage.owner === 'profile-a', { operationId: 'restore-op-1', ownerScope: 'app-test/test/profile-a' })).rejects.toThrow('injected crash');
    expect(storage.peekRaw(SAVE_KEYS.tombstone)).toMatchObject({ oldRunId: source.runId, newResetGeneration: 1 });
    expect(storage.peekRaw(SAVE_KEYS.replaceIntent)).toMatchObject({ operationId: 'restore-op-1', ownerScope: 'app-test/test/profile-a', targetRunId: target.runId });
    expect(storage.peekRaw(SAVE_KEYS.replaceStaging)).toMatchObject({ runId: target.runId, payload: { rngCounter: 42 } });

    const restarted = await GameStore.load(storage);
    expect(restarted?.current.runId).toBe(target.runId);
    expect(restarted?.current.rngCounter).toBe(42);
    expect(restarted?.current.company).toBeNull();
    expect(restarted?.currentRevision).toBe(1);
    expect(restarted?.currentResetGeneration).toBe(1);
    expect(storage.peekRaw(SAVE_KEYS.active)).toMatchObject({ runId: target.runId, revision: 1, resetGeneration: 1 });
    expect(storage.peekRaw(SAVE_KEYS.replaceIntent)).toBeNull();
    expect(storage.peekRaw(SAVE_KEYS.replaceStaging)).toBeNull();
  });

  it('serializes identity transition behind an in-flight journal commit and allows a later new-owner write', async () => {
    const storage = new TombstoneCrashStorage();
    const initial = createInitialState(1_800_000_001_000, 2603);
    const store = new GameStore(storage, initial);
    storage.holdJournal = true;
    let transitionApplied = false;
    const ownerCurrent = () => storage.owner === 'profile-a';
    const commit = store.mutate((draft) => { draft.rngCounter = 13; }, initial.runId, ownerCurrent,
      { operationId: 'ordinary-save-13', ownerScope: 'app-test/test/profile-a' });
    await storage.enteredJournal;
    expect(storage.peekRaw(SAVE_KEYS.transaction)).toMatchObject({
      operationId: 'ordinary-save-13', ownerScope: 'app-test/test/profile-a', kind: 'commit',
    });
    const transition = store.transitionOwner(() => { storage.owner = 'profile-b'; transitionApplied = true; });
    await Promise.resolve();
    expect(transitionApplied).toBe(false);
    let newWriteStarted = false;
    await expect(store.mutate((draft) => { newWriteStarted = true; draft.rngCounter = 99; }, initial.runId))
      .rejects.toMatchObject({ details: { reason: 'owner-transition-pending' } });
    expect(newWriteStarted).toBe(false);
    storage.releaseJournalResolve?.();
    const committed = await commit;
    await transition;
    expect(committed.revision).toBe(1);
    expect(transitionApplied).toBe(true);
    expect((await GameStore.load(storage))?.current.rngCounter).toBe(13);

    const next = await store.mutate((draft) => { draft.rngCounter = 17; }, initial.runId);
    expect(next.revision).toBe(2);
    expect((await GameStore.load(storage))?.current.rngCounter).toBe(17);
  });

  it('does not cross the tombstone when owner changes during staging', async () => {
    const storage = new TombstoneCrashStorage();
    const source = createInitialState(1_800_000_002_000, 2604);
    const store = new GameStore(storage, source);
    await store.mutate((draft) => { draft.rngCounter = 1; }, source.runId);
    const revision = store.currentRevision;
    const target = createInitialState(1_800_000_002_100, 2605);
    storage.flipOwnerAfterIntent = true;
    const result = store.replaceWithCloudState(target, source.runId, revision, 1_800_000_002_200,
      () => storage.owner === 'profile-a', { operationId: 'restore-op-cancel', ownerScope: 'app-test/test/profile-a' });
    await expect(result).rejects.toMatchObject({ details: { reason: 'operation-owner-changed-before-tombstone' } });
    expect(storage.peekRaw(SAVE_KEYS.tombstone)).toBeNull();
    expect(storage.peekRaw(SAVE_KEYS.active)).toMatchObject({ runId: source.runId, revision });
    expect((await GameStore.load(storage))?.current.runId).toBe(source.runId);
  });
});
