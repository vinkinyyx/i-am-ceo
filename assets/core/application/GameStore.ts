import type { GameState } from '../domain/types';
import { GameError, GameErrorCode } from '../domain/errors';
import { SaveRepository } from '../persistence/SaveRepository';
import type { IStorageBackend } from '../platform/ITapPlatform';
import { createInitialState } from '../domain/gameStateFactory';
import { cloneGameState } from '../persistence/cloneGameState';

/**
 * 单一真实状态源（设计文档 §2.2 / §2.5）。
 * - 内存中只保留一个活动 run；所有变更经 mutate 串行执行并持久化。
 * - revision 由持久化信封维护，每次成功 commit +1。
 * - resetGeneration 随关闭公司递增，用于屏蔽旧 run 迟到回调。
 */
export class GameStore {
  private state: GameState;
  private revision = 0;
  private resetGeneration = 0;
  private readonly storage: IStorageBackend;
  private readonly repo: SaveRepository;
  private mutationInProgress = false;
  /** A failed commit may have reached storage; reload before applying any later draft. */
  private commitOutcomeUnknown = false;
  /** A confirmed/unknown reset tombstone must never fall back to the old run. */
  private resetPending = false;

  constructor(storage: IStorageBackend, state?: GameState, meta?: { revision: number; resetGeneration: number }) {
    this.storage = storage;
    this.repo = new SaveRepository(storage);
    this.state = state ?? createInitialState(Date.now());
    if (meta) {
      this.revision = meta.revision;
      this.resetGeneration = meta.resetGeneration;
    }
  }

  get current(): GameState {
    return this.state;
  }

  get currentRevision(): number {
    return this.revision;
  }

  get currentResetGeneration(): number {
    return this.resetGeneration;
  }

  getPersistenceStatus(): 'ready' | 'recovery-required' | 'reset-pending' | 'native-write-pending' {
    if (this.storage.hasUnsettledNativeWrites?.()) return 'native-write-pending';
    if (this.resetPending) return 'reset-pending';
    return this.commitOutcomeUnknown ? 'recovery-required' : 'ready';
  }

  /** Explicit read/reconcile entry for UI retry. It never replays a business command. */
  async retryPersistenceRecovery(expectedRunId: string): Promise<boolean> {
    if (this.mutationInProgress) throw new GameError(GameErrorCode.SAVE_RECOVERY_REQUIRED, { reason: 'mutation-in-progress' });
    this.mutationInProgress = true;
    try {
      await this.recoverBeforeWrite(expectedRunId);
      return true;
    } finally {
      this.mutationInProgress = false;
    }
  }

  repository(): SaveRepository {
    return this.repo;
  }

  /**
   * 串行变更锁内对隔离 draft 执行变更，持久化确认成功后一次性发布（R12 §15.3.2）。
   * - 变更只作用于 draft；await repo.commit 期间 current 仍是上一个已提交状态，
   *   公开读取不会看见未提交现金/员工；
   * - commit 走 journal 协议：目标槽+指针双回读确认后才算成功；
   * - 业务校验失败：current 不变、无写入；
   * - 持久化失败/未知：不发布 draft、不推进 revision，由 journal 保证不重复收费，
   *   下条命令前 commit 会先 reconcile 未完成事务。
   */
  async mutate<T>(fn: (draft: GameState) => T, expectedRunId: string): Promise<{ result: T; revision: number }> {
    if (this.mutationInProgress) throw new Error(GameErrorCode.RESET_IN_PROGRESS);

    this.mutationInProgress = true;
    try {
      await this.recoverBeforeWrite(expectedRunId);
      const draft = cloneGameState(this.state);
      const result = fn(draft);
      if (draft.runId !== expectedRunId) {
        throw new Error(GameErrorCode.RUN_CHANGED);
      }
      const targetRevision = this.revision + 1;
      let envelope: Awaited<ReturnType<SaveRepository['commit']>>;
      try {
        envelope = await this.repo.commit(draft, {
          revision: targetRevision,
          resetGeneration: this.resetGeneration,
          expectedBase: this.currentBase(),
        });
      } catch (err) {
        if (err instanceof GameError && err.code === GameErrorCode.REVISION_CONFLICT) {
          // Another writer advanced the verified base. Refresh state, but do
          // not replay this command or its old preview against the new base.
          try {
            const loaded = await this.repo.load();
            if (!loaded) throw new GameError(GameErrorCode.SAVE_UNAVAILABLE, { reason: 'conflict-base-missing' });
            this.publishLoaded(loaded);
            this.commitOutcomeUnknown = false;
          } catch (recoveryError) {
            this.commitOutcomeUnknown = true;
            throw recoveryError;
          }
        } else {
          // A rejected storage callback does not prove that the write was absent.
          this.commitOutcomeUnknown = true;
        }
        throw err;
      }
      // 仅在持久化确认成功后发布
      this.state = draft;
      this.revision = envelope.revision;
      return { result, revision: this.revision };
    } finally {
      this.mutationInProgress = false;
    }
  }

  /** Import a validated same-run checkpoint as one ordinary local journal commit. */
  async importCloudState(importedState: GameState, expectedRunId: string, expectedRevision: number, nowMs: number): Promise<number> {
    if (this.mutationInProgress) throw new Error(GameErrorCode.RESET_IN_PROGRESS);
    this.mutationInProgress = true;
    try {
      await this.recoverBeforeWrite(expectedRunId);
      if (this.revision !== expectedRevision || this.state.runId !== expectedRunId
        || (this.revision > 0 && importedState.runId !== expectedRunId) || !Number.isSafeInteger(nowMs) || nowMs < 0) {
        throw new GameError(GameErrorCode.REVISION_CONFLICT, { reason: 'cloud-import-base-changed' });
      }
      if (this.revision === 0 && await this.repo.readTombstone()) throw new GameError(GameErrorCode.RUN_CHANGED);
      if (this.storage.hasUnsettledNativeWrites?.()) throw new GameError(GameErrorCode.SAVE_RECOVERY_REQUIRED, { reason: 'native-write-fence' });
      if (this.state.adRewards?.activeSessionId) throw new GameError(GameErrorCode.SAVE_RECOVERY_REQUIRED, { reason: 'active-ad-session' });
      const draft = cloneGameState(importedState);
      // Local reward rights and consumption ledger are authoritative. Import never
      // replays native ad completion or grants coupons from another device.
      if (this.state.adRewards) draft.adRewards = cloneGameState(this.state).adRewards;
      else delete draft.adRewards;
      // A restore is not an offline reward event. Start a fresh foreground watermark.
      draft.lastWallClockMs = nowMs;
      draft.offlineRemainderMs = 0;
      const targetRevision = this.revision + 1;
      let envelope: Awaited<ReturnType<SaveRepository['commit']>>;
      try {
        envelope = await this.repo.commit(draft, { revision: targetRevision, resetGeneration: this.resetGeneration, expectedBase: this.currentBase() });
      } catch (err) {
        this.commitOutcomeUnknown = true;
        throw err;
      }
      this.state = draft;
      this.revision = envelope.revision;
      return this.revision;
    } finally { this.mutationInProgress = false; }
  }

  /** 不产生持久化的只读快照（预览类接口使用）。 */
  read<T>(fn: (state: GameState) => T): T {
    return fn(this.state);
  }

  /**
   * 替换为新 run（关闭公司事务，R14 §3.5）。
   * 顺序与故障语义：
   * 1) 墓碑先提交并回读确认（墓碑前失败=旧局不变；墓碑后任何中断，旧 run 都不允许再写）；
   * 2) 新 run 经 commit 的 journal 协议落槽+切指针（kind='replace-run'）；
   * 3) 清理旧 run 槽位（best-effort，墓碑保证旧 run 即使残留也不加载/不写回）。
   * 墓碑提交失败时绝不把内存切到新 run，避免“墓碑无、新局半成”的混合状态。
   */
  async replaceWithNewRun(
    newStateOrFactory: GameState | ((confirmedState: GameState) => GameState),
    oldRunId: string,
    nowMs: number,
  ): Promise<void> {
    if (this.mutationInProgress) throw new Error(GameErrorCode.RESET_IN_PROGRESS);
    this.mutationInProgress = true;
    try {
      await this.recoverBeforeWrite(oldRunId, true);
      if (this.state.runId !== oldRunId) throw new Error(GameErrorCode.RUN_CHANGED);
      const newState = typeof newStateOrFactory === 'function'
        ? newStateOrFactory(this.state)
        : newStateOrFactory;
      if (newState.runId === oldRunId) throw new Error(GameErrorCode.RUN_CHANGED);
      const nextGeneration = this.resetGeneration + 1;
      // 1) 墓碑（先于一切新 run 写入）
      const tombstone = {
        oldRunId,
        newResetGeneration: nextGeneration,
        resetAtMs: nowMs,
      };
      this.resetPending = true;
      try {
        await this.repo.writeTombstone(tombstone);
        const readBackTomb = await this.repo.readTombstone();
        if (!readBackTomb || readBackTomb.oldRunId !== oldRunId) {
          throw new GameError(GameErrorCode.SAVE_FAILED, { stage: 'tombstone-readback' });
        }

        // 2) 提交新 run（journal kind=replace-run；未确认前不发布内存/代际）
        await this.repo.commitReplaceRun(newState, {
          revision: 1,
          resetGeneration: nextGeneration,
          baseRunId: oldRunId,
          expectedBase: this.currentBase()!,
          nowMs,
        });
      } catch (err) {
        this.resetPending = true;
        throw err;
      }
      this.resetGeneration = nextGeneration;
      this.state = newState;
      this.revision = 1;
      this.commitOutcomeUnknown = false;
      this.resetPending = false;

      // 3) 清理旧 run 槽位（墓碑保留；失败不影响新 run 已提交事实）
      await this.repo.clearRunSlots(oldRunId).catch(() => undefined);
    } finally {
      this.mutationInProgress = false;
    }
  }

  /** Resolve an unknown commit before cloning a draft or crossing the reset tombstone. */
  private async recoverBeforeWrite(expectedRunId: string, allowResetRetry = false): Promise<void> {
    if (this.storage.hasUnsettledNativeWrites?.()) {
      throw new GameError(GameErrorCode.SAVE_RECOVERY_REQUIRED, { reason: 'native-write-fence' });
    }
    if (this.resetPending && !allowResetRetry) {
      throw new GameError(GameErrorCode.SAVE_RECOVERY_REQUIRED, { reason: 'reset-pending' });
    }
    if (!this.commitOutcomeUnknown && !this.resetPending) {
      if (this.state.runId !== expectedRunId) throw new Error(GameErrorCode.RUN_CHANGED);
      return;
    }

    // Read/reconcile while holding the mutation mutex. A null load is only
    // acceptable after a matching reset tombstone; it can never recover an
    // ordinary unknown commit.
    const loaded = await this.repo.load();
    if (loaded) {
      this.publishLoaded(loaded);
      this.commitOutcomeUnknown = false;
      this.resetPending = false;
    } else if (this.resetPending && allowResetRetry) {
      const tombstone = await this.repo.readTombstone();
      if (!tombstone || tombstone.oldRunId !== this.state.runId
        || tombstone.newResetGeneration !== this.resetGeneration + 1) {
        throw new GameError(GameErrorCode.SAVE_UNAVAILABLE, { reason: 'reset-pending-undecidable' });
      }
      this.commitOutcomeUnknown = false;
    } else {
      throw new GameError(GameErrorCode.SAVE_UNAVAILABLE, { reason: 'uncertain-commit-without-base' });
    }
    if (this.state.runId !== expectedRunId) throw new Error(GameErrorCode.RUN_CHANGED);
  }

  private publishLoaded(loaded: NonNullable<Awaited<ReturnType<SaveRepository['load']>>>): void {
    this.state = loaded.state;
    this.revision = loaded.envelope.revision;
    this.resetGeneration = loaded.envelope.resetGeneration ?? 0;
  }

  private currentBase(): { runId: string; revision: number; resetGeneration: number } | null {
    if (this.revision === 0) return null;
    return { runId: this.state.runId, revision: this.revision, resetGeneration: this.resetGeneration };
  }

  /** 启动时从存档装载（null=已确认无档，可新建；读取失败直接抛错，不静默新建）。 */
  static async load(storage: IStorageBackend): Promise<GameStore | null> {
    const repo = new SaveRepository(storage);
    const loaded = await repo.load();
    if (!loaded) return null;
    return new GameStore(storage, loaded.state, {
      revision: loaded.envelope.revision,
      resetGeneration: loaded.envelope.resetGeneration ?? 0,
    });
  }

  /**
   * R13：显式装载结果（§15.3.1）。
   * - new-game：全部键明确缺失，允许新建/写入；
   * - loaded/recovered：已提交档，可写；
   * - unavailable/corrupt：禁止创建可写 facade 与开启时钟，由 UI 提供重试/退出。
   */
  static async inspectForBootstrap(storage: IStorageBackend): Promise<BootstrapLoadResult> {
    const repo = new SaveRepository(storage);
    try {
      const loaded = await repo.load();
      if (!loaded) {
        return { kind: 'new-game' };
      }
      const store = new GameStore(storage, loaded.state, {
        revision: loaded.envelope.revision,
        resetGeneration: loaded.envelope.resetGeneration ?? 0,
      });
      return loaded.recovered
        ? { kind: 'recovered', store, note: loaded.recoveryNote }
        : { kind: 'loaded', store };
    } catch (err) {
      if (err instanceof GameError && err.code === GameErrorCode.SAVE_UNAVAILABLE) {
        return {
          kind: 'unavailable',
          reason: (err.details?.reason as string | undefined) ?? 'io',
          message: err.message,
        };
      }
      if (err instanceof GameError && err.code === GameErrorCode.SAVE_CORRUPT) {
        return { kind: 'corrupt', message: err.message };
      }
      throw err;
    }
  }
}

export type BootstrapLoadResult =
  | { kind: 'new-game' }
  | { kind: 'loaded'; store: GameStore }
  | { kind: 'recovered'; store: GameStore; note?: string }
  | { kind: 'unavailable'; reason: string; message: string }
  | { kind: 'corrupt'; message: string };
