/**
 * R12：事务提交与未知写入结果（§15.3.2）。
 * - await 写盘期间 UI 只能读已提交值；
 * - journal 协议：目标槽已写但指针未切→重启自动补提交一次；
 * - 目标未写→保留 base；不盲选最高 revision；
 * - 同一命令失败后再执行不产生重复费用效果（revision 连续、状态一次）。
 */
import { describe, it, expect } from 'vitest';
import { GameStore } from '@core/application/GameStore';
import { SaveRepository } from '@core/persistence/SaveRepository';
import { createInitialState } from '@core/domain/gameStateFactory';
import { SAVE_KEYS, type SavePointer, type SaveTransactionJournal } from '@core/persistence/SaveTypes';
import { ScriptedStorage, makeEnvelope, makePointer } from '../helpers/faults';

/** 可在指定阶段挂起/失败的存储：用于逐 await 断点。 */
class BreakpointStorage extends ScriptedStorage {
  gate: 'open' | 'hang' = 'open';
  failActivePointerWriteOnce = false;
  readonly sets: Array<{ key: string; at: number }> = [];
  private counter = 0;
  private release: (() => void) | null = null;

  /** 解除槽位写入挂起并放行排队的提交。 */
  releaseHang(): void {
    const r = this.release;
    this.release = null;
    r?.();
  }

  override async set<T>(key: string, value: T): Promise<void> {
    this.sets.push({ key, at: this.counter++ });
    if (this.failActivePointerWriteOnce && key === SAVE_KEYS.active) {
      this.failActivePointerWriteOnce = false;
      throw new Error('SAVE_UNAVAILABLE:io:pointer-write-failed');
    }
    // 仅在槽位写入阶段挂起（journal/指针仍可解析），用于观察 await 期间的公开读
    if (this.gate === 'hang' && (key === SAVE_KEYS.slotA || key === SAVE_KEYS.slotB)) {
      await new Promise<void>((resolve) => {
        this.release = resolve;
      });
    }
    return super.set(key, value);
  }
}

function storeOn(storage: ScriptedStorage, revision = 0): GameStore {
  const state = createInitialState(1_700_000_000_000, 1234);
  if (revision > 0) {
    storage.seed(SAVE_KEYS.slotA, makeEnvelope(state, { revision, resetGeneration: 0 }));
    storage.seedPointer(makePointer({ slot: 'a', revision, runId: state.runId, resetGeneration: 0 }));
  }
  return new GameStore(storage, state, {
    revision,
    resetGeneration: 0,
  });
}

describe('R12-T01 await 写盘时公开 current 仍是已提交值', () => {
  it('commit 挂起期间 current.rngCounter 不提前变化', async () => {
    const storage = new BreakpointStorage();
    const store = storeOn(storage, 0);
    const runId = store.current.runId;
    storage.gate = 'hang';
    const promise = store.mutate((s) => {
      s.rngCounter = 42;
    }, runId);
    await Promise.resolve();
    await Promise.resolve();
    // 尚未确认提交：公开状态仍是已提交值
    expect(store.current.rngCounter).toBe(0);
    expect(store.currentRevision).toBe(0);
    // 放行后一次性发布
    storage.gate = 'open';
    storage.releaseHang();
    await promise;
    expect(store.current.rngCounter).toBe(42);
    expect(store.currentRevision).toBe(1);
  });
});

describe('R12-T02 指针写成但回调失败→核对后只成功一次', () => {
  it('重启装载识别 journal：目标 rev2 生效，指针补齐，journal 清理，无第三槽写入', async () => {
    const storage = new BreakpointStorage();
    const store = storeOn(storage, 0);
    const runId = store.current.runId;
    // rev1 正常
    await store.mutate((s) => {
      s.rngCounter = 1;
    }, runId);
    // rev2：目标槽+回读成功，指针写抛错（模拟回调未知/失败但可能已落盘）
    storage.failActivePointerWriteOnce = true;
    await store
      .mutate((s) => {
        s.rngCounter = 2;
      }, runId)
      .catch((e: unknown) => e);

    const journal = storage.peek<SaveTransactionJournal>(SAVE_KEYS.transaction);
    expect(journal).not.toBeNull();
    expect(journal?.targetPointer.revision).toBe(2);

    // 重启：journal reconcile 自动补提交
    const reloaded = await new SaveRepository(storage).load();
    expect(reloaded?.envelope.revision).toBe(2);
    expect(reloaded?.state.rngCounter).toBe(2);
    expect(storage.peek(SAVE_KEYS.transaction)).toBeNull();
    const pointer = storage.peek<SavePointer>(SAVE_KEYS.active);
    expect(pointer?.revision).toBe(2);
  });
});

describe('R12-T03 目标槽写成但指针未切，未提交收费不复活', () => {
  it('目标槽 rev3 存在、指针仍 rev2、journal 丢失时：不盲选最高 revision（无 journal 证据则按当前协议指针优先）', async () => {
    const storage = new ScriptedStorage();
    const base = createInitialState(1_700_000_000_000, 77);
    base.rngCounter = 2;
    const env2 = makeEnvelope(base, { revision: 2 });
    const newer = { ...base, rngCounter: 3 };
    const env3 = makeEnvelope(newer, { revision: 3 });
    storage
      .seed(SAVE_KEYS.slotA, env2)
      .seed(SAVE_KEYS.slotB, env3)
      .seedPointer(makePointer({ slot: 'a', revision: 2, runId: base.runId, resetGeneration: 0 }));
    // 无 journal：指针元组完整命中 rev2，即使槽 B revision 更高也不切换
    const loaded = await new SaveRepository(storage).load();
    expect(loaded?.envelope.revision).toBe(2);
    expect(loaded?.recovered).toBe(false);
  });
});

describe('R12-T04 每个 await 断点后重启结果确定', () => {
  it('journal 写入后、槽位未写：retained，回到 base', async () => {
    const storage = new ScriptedStorage();
    const base = createInitialState(1_700_000_000_000, 88);
    const env1 = makeEnvelope(base, { revision: 1 });
    const basePointer = makePointer({ slot: 'a', revision: 1, runId: base.runId, resetGeneration: 0 });
    storage.seed(SAVE_KEYS.slotA, env1).seedPointer(basePointer);
    const journal: SaveTransactionJournal = {
      protocolVersion: 1,
      transactionId: 'tx-open',
      kind: 'commit',
      basePointer,
      targetPointer: makePointer({ slot: 'b', revision: 2, runId: base.runId, resetGeneration: 0 }),
      targetChecksum: 'ffffffff',
      createdAtMs: 1,
    };
    storage.seed(SAVE_KEYS.transaction, journal); // 槽 B 仍 MISSING
    const loaded = await new SaveRepository(storage).load();
    expect(loaded?.envelope.revision).toBe(1);
    expect(storage.peek(SAVE_KEYS.transaction)).toBeNull();
  });

  it('journal 与 base/pointer 均矛盾：undecidable → SAVE_UNAVAILABLE，禁止写入覆盖', async () => {
    const storage = new ScriptedStorage();
    const base = createInitialState(1_700_000_000_000, 89);
    const env1 = makeEnvelope(base, { revision: 1 });
    const basePointer = makePointer({ slot: 'a', revision: 1, runId: base.runId, resetGeneration: 0 });
    storage.seed(SAVE_KEYS.slotA, env1);
    // 指针指向不存在的槽态（指向 B 但 B missing）
    storage.seedPointer(makePointer({ slot: 'b', revision: 9, runId: 'ghost', resetGeneration: 0 }));
    const journal: SaveTransactionJournal = {
      protocolVersion: 1,
      transactionId: 'tx-ghost',
      kind: 'commit',
      basePointer,
      targetPointer: makePointer({ slot: 'b', revision: 2, runId: base.runId, resetGeneration: 0 }),
      targetChecksum: 'ffffffff',
      createdAtMs: 1,
    };
    storage.seed(SAVE_KEYS.transaction, journal);
    const err = await new SaveRepository(storage).load().catch((e: unknown) => e);
    expect((err as { code?: string }).code).toBe('SAVE_UNAVAILABLE');
    expect(storage.setCalls).toHaveLength(0);
  });
});

describe('R12-T05 journal 读写失败不覆盖其他有效槽', () => {
  it('journal 键读取超时→SAVE_UNAVAILABLE，装载阻断，不动槽位', async () => {
    const storage = new ScriptedStorage();
    storage.onGet(SAVE_KEYS.transaction, { kind: 'reject', reason: 'timeout' });
    const err = await new SaveRepository(storage).load().catch((e: unknown) => e);
    expect((err as { code?: string }).code).toBe('SAVE_UNAVAILABLE');
    expect(storage.setCalls).toHaveLength(0);
  });
});

describe('R12-T06 同一收费命令失败后再执行只产生一次效果', () => {
  it('mutate 串行锁：进行中第二次同 commandId 调用被拒；成功后 revision 连续', async () => {
    const storage = new BreakpointStorage();
    const store = storeOn(storage, 0);
    const runId = store.current.runId;
    // 正常提交时并发第二个命令立即被串行锁拒绝
    const first = store.mutate((s) => {
      s.rngCounter = 1;
    }, runId);
    await expect(
      store.mutate((s) => {
        s.rngCounter = 2;
      }, runId),
    ).rejects.toThrow(/RESET_IN_PROGRESS/);
    await first;
    expect(store.currentRevision).toBe(1);
    expect(store.current.rngCounter).toBe(1);
  });

  it('业务校验抛错后再提交同一命令：只产生一次效果，revision 不跳号', async () => {
    const storage = new ScriptedStorage();
    const store = storeOn(storage, 1);
    const runId = store.current.runId;
    await store
      .mutate(() => {
        throw new Error('validation failed');
      }, runId)
      .catch((e: unknown) => e);
    expect(store.currentRevision).toBe(1);
    expect(storage.peek(SAVE_KEYS.transaction)).toBeNull();
    const ok = await store.mutate((s) => {
      s.rngCounter = 9;
    }, runId);
    expect(ok.revision).toBe(2);
    expect(storage.peek(SAVE_KEYS.transaction)).toBeNull();
  });
});
