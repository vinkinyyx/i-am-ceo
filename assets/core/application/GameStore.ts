import type { GameState } from '../domain/types';
import { GameErrorCode } from '../domain/errors';
import { SaveRepository } from '../persistence/SaveRepository';
import type { IStorageBackend } from '../platform/ITapPlatform';
import { createInitialState } from '../domain/gameStateFactory';

/**
 * 单一真实状态源（设计文档 01.2 / 01.6）。
 * - 内存中只保留一个活动 run；所有变更经 mutate 串行执行并持久化。
 * - revision 由持久化信封维护，每次成功 commit +1。
 * - resetGeneration 随关闭公司递增，用于屏蔽旧 run 迟到回调。
 */
export class GameStore {
  private state: GameState;
  private revision = 0;
  private resetGeneration = 0;
  private readonly repo: SaveRepository;
  private mutationInProgress = false;

  constructor(storage: IStorageBackend, state?: GameState, meta?: { revision: number; resetGeneration: number }) {
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

  repository(): SaveRepository {
    return this.repo;
  }

  /**
   * 串行变更锁内执行一个纯变更函数，成功后持久化。
   * 变更函数抛错则状态不变（采用先提交后持久化、失败回滚快照的策略）。
   */
  async mutate<T>(fn: (draft: GameState) => T, expectedRunId: string): Promise<{ result: T; revision: number }> {
    if (this.mutationInProgress) throw new Error(GameErrorCode.RESET_IN_PROGRESS);
    if (this.state.runId !== expectedRunId) throw new Error(GameErrorCode.RUN_CHANGED);

    this.mutationInProgress = true;
    const snapshot = structuredClone(this.state);
    try {
      const result = fn(this.state);
      // 变更后校验 runId 未被替换
      if (this.state.runId !== expectedRunId) {
        this.state = snapshot;
        throw new Error(GameErrorCode.RUN_CHANGED);
      }
      await this.persist();
      return { result, revision: this.revision };
    } catch (err) {
      this.state = snapshot;
      throw err;
    } finally {
      this.mutationInProgress = false;
    }
  }

  /** 不产生持久化的只读快照（预览类接口使用）。 */
  read<T>(fn: (state: GameState) => T): T {
    return fn(this.state);
  }

  async persist(): Promise<void> {
    this.revision += 1;
    try {
      await this.repo.commit(this.state, {
        revision: this.revision,
        resetGeneration: this.resetGeneration,
      });
    } catch (err) {
      this.revision -= 1;
      throw err;
    }
  }

  /** 替换为新 run（关闭公司事务使用）。 */
  async replaceWithNewRun(newState: GameState, oldRunId: string, nowMs: number): Promise<void> {
    if (this.mutationInProgress) throw new Error(GameErrorCode.RESET_IN_PROGRESS);
    this.mutationInProgress = true;
    try {
      this.resetGeneration += 1;
      await this.repo.writeTombstone({
        oldRunId,
        newResetGeneration: this.resetGeneration,
        resetAtMs: nowMs,
      });
      this.state = newState;
      this.revision = 0;
      // 提交新 run 到某槽位并切换活动指针
      await this.repo.commit(newState, {
        revision: 1,
        resetGeneration: this.resetGeneration,
      });
      this.revision = 1;
      // 安全清理旧 run 槽位（墓碑保留，旧 run 不复活）
      await this.repo.clearRunSlots(oldRunId);
    } finally {
      this.mutationInProgress = false;
    }
  }

  /** 启动时从存档装载。 */
  static async load(storage: IStorageBackend): Promise<GameStore | null> {
    const repo = new SaveRepository(storage);
    const loaded = await repo.load();
    if (!loaded) return null;
    return new GameStore(storage, loaded.state, {
      revision: loaded.envelope.revision,
      resetGeneration: loaded.envelope.resetGeneration ?? 0,
    });
  }
}
