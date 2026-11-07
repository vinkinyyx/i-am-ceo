/** A/R12：关闭公司必须和普通命令共用未决提交恢复闸门。 */
import { describe, expect, it } from 'vitest';
import { GameStore } from '@core/application/GameStore';
import { createFreshRunState, createInitialState } from '@core/domain/gameStateFactory';
import { GameError } from '@core/domain/errors';
import { SAVE_KEYS } from '@core/persistence/SaveTypes';
import { ScriptedStorage, ScriptedTapRuntime } from '../helpers/faults';
import { TapPlatform } from '@core/platform/TapPlatform';

class RecoveryGateStorage extends ScriptedStorage {
  readonly operations: string[] = [];
  failPointerAfterApply = false;
  failPointerBeforeApplyOnce = false;
  failJournalWriteBeforeApplyOnce = false;
  failJournalRemovalOnce = false;
  failJournalReadOnce = false;
  failSlotReadOnce = false;
  failSlotBeforeApplyOnce = false;

  override async get<T>(key: string): Promise<T | null> {
    this.operations.push(`get:${key}`);
    if (key === SAVE_KEYS.transaction && this.failJournalReadOnce) {
      this.failJournalReadOnce = false;
      throw new Error('SAVE_UNAVAILABLE:injected-journal-read');
    }
    if ((key === SAVE_KEYS.slotA || key === SAVE_KEYS.slotB) && this.failSlotReadOnce) {
      this.failSlotReadOnce = false;
      throw new Error('SAVE_UNAVAILABLE:injected-target-slot-read');
    }
    if (key === SAVE_KEYS.transaction && this.failJournalWriteBeforeApplyOnce) {
      this.failJournalWriteBeforeApplyOnce = false;
      throw new Error('SAVE_FAILED:injected-journal-write-before-apply');
    }
    return super.get<T>(key);
  }

  override async set<T>(key: string, value: T): Promise<void> {
    this.operations.push(`set:${key}`);
    if ((key === SAVE_KEYS.slotA || key === SAVE_KEYS.slotB) && this.failSlotBeforeApplyOnce) {
      this.failSlotBeforeApplyOnce = false;
      throw new Error('SAVE_FAILED:injected-slot-write-before-apply');
    }
    if (key === SAVE_KEYS.active && this.failPointerAfterApply) {
      this.failPointerAfterApply = false;
      await super.set(key, value);
      throw new Error('SAVE_UNAVAILABLE:pointer-callback-unknown');
    }
    if (key === SAVE_KEYS.active && this.failPointerBeforeApplyOnce) {
      this.failPointerBeforeApplyOnce = false;
      throw new Error('SAVE_FAILED:injected-pointer-write-before-apply');
    }
    await super.set(key, value);
  }

  override async remove(key: string): Promise<void> {
    this.operations.push(`remove:${key}`);
    if (key === SAVE_KEYS.transaction && this.failJournalRemovalOnce) {
      this.failJournalRemovalOnce = false;
      throw new Error('SAVE_FAILED:injected-journal-remove');
    }
    await super.remove(key);
  }
}

async function leaveUnknownCommittedWrite(storage: RecoveryGateStorage): Promise<GameStore> {
  const state = createInitialState(1_700_000_000_000, 934);
  const store = new GameStore(storage, state);
  await store.mutate((draft) => { draft.rngCounter = 1; }, state.runId);
  storage.failPointerAfterApply = true;
  await expect(store.mutate((draft) => { draft.rngCounter = 2; }, state.runId)).rejects.toThrow();
  expect(store.current.rngCounter).toBe(1);
  expect(store.currentRevision).toBe(1);
  return store;
}

describe('R12 A-07 close company is gated by unknown commit recovery', () => {
  it('exposes retryable persistence status and clears it only after repository recovery', async () => {
    const storage = new RecoveryGateStorage();
    const store = new GameStore(storage, createInitialState(1_700_000_000_000, 938));
    const runId = store.current.runId;
    await store.mutate((draft) => { draft.rngCounter = 1; }, runId);
    storage.failPointerAfterApply = true;
    await expect(store.mutate((draft) => { draft.rngCounter = 2; }, runId)).rejects.toThrow();
    expect(store.getPersistenceStatus()).toBe('recovery-required');
    storage.failJournalReadOnce = true;
    await expect(store.retryPersistenceRecovery(runId)).rejects.toThrow();
    expect(store.getPersistenceStatus()).toBe('recovery-required');
    expect(await store.retryPersistenceRecovery(runId)).toBe(true);
    expect(store.getPersistenceStatus()).toBe('ready');
    expect(store.current.rngCounter).toBe(2);
  });

  it('journal read failure prevents tombstone/new-run writes and preserves the last confirmed in-memory run', async () => {
    const storage = new RecoveryGateStorage();
    const store = await leaveUnknownCommittedWrite(storage);
    const oldRunId = store.current.runId;
    const beforeWrites = storage.operations.filter((x) => x.startsWith('set:')).length;
    storage.failJournalReadOnce = true;

    await expect(store.replaceWithNewRun(createFreshRunState(1_700_000_100_000), oldRunId, 1_700_000_100_000))
      .rejects.toThrow();

    expect(storage.operations.filter((x) => x === `set:${SAVE_KEYS.tombstone}`)).toHaveLength(0);
    expect(storage.operations.filter((x) => x.startsWith('set:')).length).toBe(beforeWrites);
    expect(store.current.runId).toBe(oldRunId);
    expect(store.currentResetGeneration).toBe(0);
    expect(storage.peek(SAVE_KEYS.tombstone)).toBeNull();
  });

  it('reconciles the committed pointer before writing a tombstone on retry', async () => {
    const storage = new RecoveryGateStorage();
    const store = await leaveUnknownCommittedWrite(storage);
    const oldRunId = store.current.runId;
    const start = storage.operations.length;

    await store.replaceWithNewRun(createFreshRunState(1_700_000_100_000), oldRunId, 1_700_000_100_000);

    const retryOps = storage.operations.slice(start);
    const tombstoneIndex = retryOps.indexOf(`set:${SAVE_KEYS.tombstone}`);
    expect(tombstoneIndex).toBeGreaterThan(0);
    expect(retryOps.slice(0, tombstoneIndex)).toContain(`get:${SAVE_KEYS.transaction}`);
    expect(retryOps.slice(0, tombstoneIndex)).toContain(`get:${SAVE_KEYS.active}`);
    expect(store.currentResetGeneration).toBe(1);
    expect(store.current.runId).not.toBe(oldRunId);
  });

  it('expected-base conflict refreshes the store but does not replay the rejected mutation', async () => {
    const storage = new RecoveryGateStorage();
    const first = new GameStore(storage, createInitialState(1_700_000_000_000, 935));
    const runId = first.current.runId;
    await first.mutate((draft) => { draft.rngCounter = 1; }, runId);
    const stale = (await GameStore.load(storage))!;
    await first.mutate((draft) => { draft.rngCounter = 2; }, runId);
    const beforeConflictWrites = storage.operations.filter((x) => x.startsWith('set:')).length;

    const conflict = await stale.mutate((draft) => { draft.rngCounter = 99; }, runId).catch((err: unknown) => err);
    expect(conflict).toBeInstanceOf(GameError);
    expect((conflict as GameError).code).toBe('REVISION_CONFLICT');

    expect(stale.current.rngCounter).toBe(2);
    expect(stale.currentRevision).toBe(2);
    expect(storage.operations.filter((x) => x.startsWith('set:')).length).toBe(beforeConflictWrites);
    const next = await stale.mutate((draft) => { draft.rngCounter = 3; }, runId);
    expect(next.revision).toBe(3);
    expect(stale.current.rngCounter).toBe(3);
  });

  it('native pointer write fence blocks a new mutation until the actual delayed write settles', async () => {
    const tap = new ScriptedTapRuntime();
    const platform = new TapPlatform(tap, { opTimeoutMs: 15 });
    const initial = createInitialState(1_700_000_000_000, 936);
    const store = new GameStore(platform, initial);
    tap.script('setStorage', { type: 'success' }, { type: 'success' }, { type: 'deferred' });

    await expect(store.mutate((draft) => { draft.rngCounter = 1; }, initial.runId)).rejects.toThrow();
    expect(platform.hasUnsettledNativeWrites()).toBe(true);
    let mutationRan = false;
    const fenced = await store.mutate((draft) => { mutationRan = true; draft.rngCounter = 2; }, initial.runId)
      .catch((err: unknown) => err);
    expect((fenced as GameError).code).toBe('SAVE_RECOVERY_REQUIRED');
    expect(mutationRan).toBe(false);

    tap.completeDeferredSet();
    expect(platform.hasUnsettledNativeWrites()).toBe(false);
    const recovered = await store.mutate((draft) => { mutationRan = true; draft.rngCounter = 2; }, initial.runId);
    expect(recovered.revision).toBe(2);
    expect(mutationRan).toBe(true);
    expect(store.current.rngCounter).toBe(2);
  });

  it('close factory is evaluated from the recovered committed state under the store lock', async () => {
    const storage = new RecoveryGateStorage();
    const store = new GameStore(storage, createInitialState(1_700_000_000_000, 937));
    const oldRunId = store.current.runId;
    await store.mutate((draft) => { draft.rngCounter = 1; }, oldRunId);
    storage.failPointerAfterApply = true;
    await expect(store.mutate((draft) => { draft.rngCounter = 2; }, oldRunId)).rejects.toThrow();
    let recoveredValue = -1;
    const newRun = createFreshRunState(1_700_000_100_000);

    await store.replaceWithNewRun((confirmed) => {
      recoveredValue = confirmed.rngCounter;
      return newRun;
    }, oldRunId, 1_700_000_100_000);

    expect(recoveredValue).toBe(2);
    expect(store.current.runId).toBe(newRun.runId);
    expect(store.currentRevision).toBe(1);
    expect(store.currentResetGeneration).toBe(1);
  });

  it('A-07 retries a failed new-run slot after tombstone without resurrecting the old company', async () => {
    const storage = new RecoveryGateStorage();
    const state = createInitialState(1_700_000_000_000, 939);
    const store = new GameStore(storage, state);
    await store.mutate((draft) => { draft.rngCounter = 4; }, state.runId);
    const oldRunId = store.current.runId;
    const fresh = createFreshRunState(1_700_000_100_000);
    storage.failSlotBeforeApplyOnce = true;
    await expect(store.replaceWithNewRun(fresh, oldRunId, 1_700_000_100_000)).rejects.toThrow();
    expect(store.getPersistenceStatus()).toBe('reset-pending');
    const recoveredAfterTombstone = await store.repository().load();
    expect(recoveredAfterTombstone?.state.runId).toBe(fresh.runId);
    expect(recoveredAfterTombstone?.state.rngCounter).toBe(fresh.rngCounter);

    await store.replaceWithNewRun(fresh, oldRunId, 1_700_000_100_001);
    expect(store.current.runId).toBe(fresh.runId);
    expect(store.currentResetGeneration).toBe(1);
    const reloaded = await GameStore.load(storage);
    expect(reloaded?.current.runId).toBe(fresh.runId);
    expect(reloaded?.current.runId).not.toBe(oldRunId);
  });

  it.each(['journal-before-apply', 'slot-before-apply', 'pointer-before-apply'] as const)(
    'A-03 %s fault keeps one verified base and permits a later command', async (stage) => {
      const storage = new RecoveryGateStorage();
      const state = createInitialState(1_700_000_000_000, 940);
      const store = new GameStore(storage, state);
      await store.mutate((draft) => { draft.rngCounter = 1; }, state.runId);
      if (stage === 'journal-before-apply') storage.failJournalWriteBeforeApplyOnce = true;
      if (stage === 'slot-before-apply') storage.failSlotBeforeApplyOnce = true;
      if (stage === 'pointer-before-apply') storage.failPointerBeforeApplyOnce = true;
      await expect(store.mutate((draft) => { draft.rngCounter = 10; }, state.runId)).rejects.toThrow();
      expect(store.getPersistenceStatus()).toBe('recovery-required');
      const next = await store.mutate((draft) => { draft.policy = 'GROWTH'; }, state.runId);
      expect(next.revision).toBeGreaterThanOrEqual(2);
      expect(store.current.policy).toBe('GROWTH');
      expect(await GameStore.load(storage)).not.toBeNull();
    },
  );

  it('A-04 failed journal read blocks the next paid command without executing its draft', async () => {
    const storage = new RecoveryGateStorage();
    const store = await leaveUnknownCommittedWrite(storage);
    const beforeWrites = storage.operations.filter((x) => x.startsWith('set:')).length;
    storage.failJournalReadOnce = true;
    let ran = false;
    await expect(store.mutate((draft) => { ran = true; draft.rngCounter = 20; }, store.current.runId)).rejects.toThrow();
    expect(ran).toBe(false);
    expect(storage.operations.filter((x) => x.startsWith('set:')).length).toBe(beforeWrites);
    const retry = await store.mutate((draft) => { draft.rngCounter = 3; }, store.current.runId);
    expect(retry.revision).toBe(3);
    expect(store.current.rngCounter).toBe(3);
  });

  it('A-04 target-slot timeout blocks close and paid mutations until a verified read succeeds', async () => {
    const storage = new RecoveryGateStorage();
    const store = await leaveUnknownCommittedWrite(storage);
    const runId = store.current.runId;
    storage.failSlotReadOnce = true;
    let ran = false;
    await expect(store.mutate((draft) => { ran = true; draft.rngCounter = 30; }, runId)).rejects.toThrow();
    expect(ran).toBe(false);
    expect(storage.peek(SAVE_KEYS.tombstone)).toBeNull();
    const next = await store.mutate((draft) => { draft.rngCounter = 3; }, runId);
    expect(next.revision).toBe(3);
    expect(store.current.rngCounter).toBe(3);
  });

  it('A-05 repeated load clears an unresolved cleanup journal idempotently without duplicate business changes', async () => {
    const storage = new RecoveryGateStorage();
    const state = createInitialState(1_700_000_000_000, 941);
    const store = new GameStore(storage, state);
    await store.mutate((draft) => { draft.rngCounter = 1; }, state.runId);
    storage.failJournalRemovalOnce = true;
    await store.mutate((draft) => { draft.rngCounter = 2; }, state.runId);
    expect(storage.peek(SAVE_KEYS.transaction)).not.toBeNull();
    const loaded = await GameStore.load(storage);
    expect(loaded?.current.rngCounter).toBe(2);
    expect(storage.peek(SAVE_KEYS.transaction)).toBeNull();
    await loaded!.mutate((draft) => { draft.policy = 'GROWTH'; }, loaded!.current.runId);
    const reloaded = await GameStore.load(storage);
    expect(reloaded?.current.rngCounter).toBe(2);
    expect(reloaded?.current.policy).toBe('GROWTH');
  });
});
