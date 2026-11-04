import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryStorage } from '../helpers/MemoryStorage';
import { SaveRepository } from '@core/persistence/SaveRepository';
import { encodeEnvelope } from '@core/persistence/SaveCodec';
import { crc32String } from '@core/persistence/crc32';
import { canonicalStringify } from '@core/persistence/canonical';
import { createInitialState } from '@core/domain/gameStateFactory';
import { SAVE_KEYS, type SaveEnvelope, type SavePointer } from '@core/persistence/SaveTypes';

describe('CRC32 与规范序列化', () => {
  it('key 顺序不同产生相同 checksum', () => {
    const a = { b: 1, a: 2, nested: { z: 1, y: 2 } };
    const b = { a: 2, nested: { y: 2, z: 1 }, b: 1 };
    expect(crc32String(canonicalStringify(a))).toBe(crc32String(canonicalStringify(b)));
  });

  it('数组顺序敏感', () => {
    expect(crc32String(canonicalStringify([1, 2, 3]))).not.toBe(
      crc32String(canonicalStringify([3, 2, 1])),
    );
  });
});

describe('SaveRepository 双槽', () => {
  let storage: MemoryStorage;
  let repo: SaveRepository;

  beforeEach(() => {
    storage = new MemoryStorage();
    repo = new SaveRepository(storage);
  });

  it('提交后可加载，双槽交替写入', async () => {
    const s1 = createInitialState(1000, 111);
    await repo.commit(s1, { revision: 1, resetGeneration: 0, expectedBase: null });
    const s2 = { ...s1, gameMonth: 2 };
    await repo.commit(s2, { revision: 2, resetGeneration: 0, expectedBase: { runId: s1.runId, revision: 1, resetGeneration: 0 } });

    const loaded = await repo.load();
    expect(loaded?.state.gameMonth).toBe(2);
    expect(loaded?.envelope.revision).toBe(2);
    // 两个槽位都被使用
    expect(storage.peekRaw(SAVE_KEYS.slotA)).not.toBeNull();
    expect(storage.peekRaw(SAVE_KEYS.slotB)).not.toBeNull();
  });

  it('B01/R12: 指针写失败但目标槽已确认时，重启经 journal 自动补提交，不丢已确认写入', async () => {
    const s1 = createInitialState(1000, 222);
    await repo.commit(s1, { revision: 1, resetGeneration: 0, expectedBase: null });
    const pointerAfterFirst = storage.peekRaw(SAVE_KEYS.active) as SavePointer;
    expect(pointerAfterFirst.revision).toBe(1);

    // 第二次提交：目标槽与回读成功，但活动指针写入失败（回调失败/断电）
    storage.failWriteKeys = new Set([SAVE_KEYS.active]);
    const s2 = { ...s1, gameMonth: 3 };
    await expect(repo.commit(s2, { revision: 2, resetGeneration: 0, expectedBase: { runId: s1.runId, revision: 1, resetGeneration: 0 } })).rejects.toBeTruthy();
    storage.failWriteKeys = new Set();

    const loaded = await repo.load();
    // R12：journal 记录目标 rev2 已落槽并回读确认 → 补切指针，事务只发生一次；
    // reconcile 完成后二次装载为正常指针命中（recovered=false）
    expect(loaded?.envelope.revision).toBe(2);
    expect(loaded?.state.gameMonth).toBe(3);
    // journal 已清理
    expect(storage.peekRaw(SAVE_KEYS.transaction)).toBeNull();
  });

  it('B01b/R12: 目标槽写入失败时事务未提交，保留 rev1，且不盲选最高 revision', async () => {
    const s1 = createInitialState(1000, 223);
    await repo.commit(s1, { revision: 1, resetGeneration: 0, expectedBase: null });

    // 第二次提交：目标槽写入直接失败（journal 已写）
    storage.failWriteKeys = new Set([SAVE_KEYS.slotB]);
    const s2 = { ...s1, gameMonth: 4 };
    await expect(repo.commit(s2, { revision: 2, resetGeneration: 0, expectedBase: { runId: s1.runId, revision: 1, resetGeneration: 0 } })).rejects.toBeTruthy();
    storage.failWriteKeys = new Set();

    // journal 打开、base 完好：reconcile=retained，装载回到 rev1
    const loaded = await repo.load();
    expect(loaded?.envelope.revision).toBe(1);
    expect(loaded?.state.gameMonth).toBe(1);
    expect(storage.peekRaw(SAVE_KEYS.transaction)).toBeNull();
  });

  it('B02: 槽位回读 checksum 损坏时提交失败，保留旧档', async () => {
    const s1 = createInitialState(1000, 333);
    await repo.commit(s1, { revision: 1, resetGeneration: 0, expectedBase: null });

    // 让第二次写槽（rev2）的回读内容损坏（写入后被篡改）
    const origSet = storage.set.bind(storage);
    storage.set = async <T>(key: string, data: T): Promise<void> => {
      await origSet(key, data);
      if (key !== SAVE_KEYS.active) {
        const env = data as unknown as SaveEnvelope;
        if (env.revision === 2) {
          const corrupted = structuredClone(data) as SaveEnvelope;
          corrupted.payload.cashRisk = 'DISTRESS';
          storage.overwriteRaw(key, corrupted);
        }
      }
    };

    const s2 = { ...s1, gameMonth: 4 };
    await expect(repo.commit(s2, { revision: 2, resetGeneration: 0, expectedBase: { runId: s1.runId, revision: 1, resetGeneration: 0 } })).rejects.toBeTruthy();

    const loaded = await repo.load();
    expect(loaded?.envelope.revision).toBe(1);
  });

  it('指针损坏时枚举双槽恢复最高 revision，并修复指针', async () => {
    const s1 = createInitialState(1000, 444);
    await repo.commit(s1, { revision: 1, resetGeneration: 0, expectedBase: null });
    const s2 = { ...s1, gameMonth: 5 };
    await repo.commit(s2, { revision: 2, resetGeneration: 0, expectedBase: { runId: s1.runId, revision: 1, resetGeneration: 0 } });

    // 破坏活动指针
    await storage.set(SAVE_KEYS.active, { slot: 'a', revision: 999, runId: 'ghost' });
    const loaded = await repo.load();
    expect(loaded?.recovered).toBe(true);
    expect(loaded?.envelope.revision).toBe(2);
    const fixedPointer = storage.peekRaw(SAVE_KEYS.active) as SavePointer;
    expect(fixedPointer.revision).toBe(2);
  });

  it('所有槽位都损坏时抛 SAVE_CORRUPT，不静默新建公司', async () => {
    const s1 = createInitialState(1000, 555);
    await repo.commit(s1, { revision: 1, resetGeneration: 0, expectedBase: null });
    // 直接把槽位改成坏信封（有指针）
    const pointer = storage.peekRaw(SAVE_KEYS.active) as SavePointer;
    const key = pointer.slot === 'a' ? SAVE_KEYS.slotA : SAVE_KEYS.slotB;
    storage.overwriteRaw(key, { schemaVersion: 1, checksum: 'deadbeef' });
    // 另一个槽也放坏数据
    const otherKey = key === SAVE_KEYS.slotA ? SAVE_KEYS.slotB : SAVE_KEYS.slotA;
    storage.overwriteRaw(otherKey, { schemaVersion: 1, checksum: 'bad' });
    // R11：错误码在 GameError.code，玩家文案不含错误码
    const err = await repo.load().catch((e: unknown) => e);
    expect((err as { code?: string }).code).toBe('SAVE_CORRUPT');
  });

  it('墓碑存在时旧 run 无法再写回，也不会被加载', async () => {
    const s1 = createInitialState(1000, 666);
    await repo.commit(s1, { revision: 1, resetGeneration: 0, expectedBase: null });
    await repo.writeTombstone({
      oldRunId: s1.runId,
      newResetGeneration: 1,
      resetAtMs: 2000,
    });

    await expect(repo.commit(s1, { revision: 2, resetGeneration: 0, expectedBase: { runId: s1.runId, revision: 1, resetGeneration: 0 } })).rejects.toThrow(
      /RUN_CHANGED/,
    );
    await expect(repo.load()).resolves.toBeNull();
  });

  it('encode/verify 往返一致', () => {
    const s1 = createInitialState(1000, 777);
    const env = encodeEnvelope(s1, { revision: 1, runId: s1.runId, resetGeneration: 0 });
    expect(env.checksum).toMatch(/^[0-9a-f]{8}$/);
  });
});
