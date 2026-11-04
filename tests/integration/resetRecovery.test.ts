/**
 * R14：关闭公司事务各故障点恢复与旧 run 隔离。
 */
import { describe, it, expect } from 'vitest';
import { GameStore } from '@core/application/GameStore';
import { SaveRepository } from '@core/persistence/SaveRepository';
import { createInitialState, createFreshRunState } from '@core/domain/gameStateFactory';
import { ScriptedStorage } from '../helpers/faults';
import { SAVE_KEYS } from '@core/persistence/SaveTypes';

async function runningStore(storage: ScriptedStorage): Promise<{ store: GameStore; oldRunId: string }> {
  const state = createInitialState(1_700_000_000_000, 321);
  // 模拟已创建公司：注入最小 company 结构
  state.company = {
    companyId: 'co-1',
    name: '旧公司',
    industry: 'TRADE',
    cashYuan: 123_456,
    createdAtMs: 1_700_000_000_000,
  } as never;
  await new SaveRepository(storage).commit(state, { revision: 4, resetGeneration: 0, expectedBase: null });
  const store = new GameStore(storage, state, { revision: 4, resetGeneration: 0 });
  return { store, oldRunId: state.runId };
}

describe('R14-T01 取消/墓碑前失败：无任何业务写入', () => {
  it('墓碑写入失败：旧局不变、代际不增、无新 run', async () => {
    const storage = new ScriptedStorage();
    const { store, oldRunId } = await runningStore(storage);
    const writesBefore = storage.setCalls.length;
    storage.onSet(SAVE_KEYS.tombstone, { kind: 'reject', reason: 'io' });
    const fresh = createFreshRunState(1_700_000_100_000);
    await expect(store.replaceWithNewRun(fresh, oldRunId, 1_700_000_100_000)).rejects.toThrow();
    // 内存仍是旧 run、旧代际
    expect(store.current.runId).toBe(oldRunId);
    expect(store.currentResetGeneration).toBe(0);
    expect(storage.setCalls.length - writesBefore).toBe(1); // 只有失败的墓碑写尝试
  });
});

describe('R14-T02 墓碑后、新 run 提交失败：重载进入“重开中”安全态，旧 run 不复活', () => {
  it('新 run 槽位写失败：墓碑已落，重启 load 为 null（可继续新 run 创建），旧 run 不被加载', async () => {
    const storage = new ScriptedStorage();
    const { store, oldRunId } = await runningStore(storage);
    storage.onSet(SAVE_KEYS.slotA, { kind: 'reject', reason: 'io' });
    const fresh = createFreshRunState(1_700_000_100_000);
    await store.replaceWithNewRun(fresh, oldRunId, 1_700_000_100_000).catch(() => undefined);

    const tombstone = storage.peek<{ oldRunId: string; newResetGeneration: number }>(SAVE_KEYS.tombstone);
    expect(tombstone?.oldRunId).toBe(oldRunId);
    expect(tombstone?.newResetGeneration).toBe(1);

    // 重启：墓碑后的旧 run 槽位不得复活（load→null 可安全走新公司创建）
    const reloaded = await new SaveRepository(storage).load();
    expect(reloaded).toBeNull();
  });
});

describe('R14-T03 正常关闭：新 run 可装载，旧槽被清、墓碑保留', () => {
  it('成功路径 revision=1、generation=1、新 runId，旧 run 槽无残留', async () => {
    const storage = new ScriptedStorage();
    const { store, oldRunId } = await runningStore(storage);
    const fresh = createFreshRunState(1_700_000_100_000);
    await store.replaceWithNewRun(fresh, oldRunId, 1_700_000_100_000);
    expect(store.current.runId).toBe(fresh.runId);
    expect(store.currentRevision).toBe(1);
    expect(store.currentResetGeneration).toBe(1);

    const reloaded = await new SaveRepository(storage).load();
    expect(reloaded).not.toBeNull();
    expect(reloaded!.state.runId).toBe(fresh.runId);
    expect(reloaded!.envelope.resetGeneration).toBe(1);
    // 墓碑仍在
    expect(storage.peek(SAVE_KEYS.tombstone)).not.toBeNull();
    // journal 已清理
    expect(storage.peek(SAVE_KEYS.transaction)).toBeNull();
  });
});

describe('R14-T04 旧 run 并发写与迟到回调隔离', () => {
  it('墓碑后旧 runId 的 commit 被 RUN_CHANGED 拒绝', async () => {
    const storage = new ScriptedStorage();
    const { store, oldRunId } = await runningStore(storage);
    const fresh = createFreshRunState(1_700_000_100_000);
    await store.replaceWithNewRun(fresh, oldRunId, 1_700_000_100_000);
    // 迟到月结回调尝试用旧 runId 写
    const lateStore = new GameStore(storage);
    await expect(
      lateStore.mutate((s) => {
        s.gameMonth = 2;
      }, oldRunId),
    ).rejects.toThrow(/RUN_CHANGED/);
  });

  it('错误 oldRunId（不属于当前 run）直接 RUN_CHANGED，不写墓碑', async () => {
    const storage = new ScriptedStorage();
    const state = createInitialState(1, 1);
    const store = new GameStore(storage, state, { revision: 0, resetGeneration: 0 });
    const fresh = createFreshRunState(2);
    await expect(store.replaceWithNewRun(fresh, 'not-current-run', 2)).rejects.toThrow(/RUN_CHANGED/);
    expect(storage.peek(SAVE_KEYS.tombstone)).toBeNull();
  });
});
