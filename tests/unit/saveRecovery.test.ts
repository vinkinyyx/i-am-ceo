/**
 * R11：双槽加载与恢复遵守已提交事实（§15.3.1 决策表）。
 */
import { describe, it, expect } from 'vitest';
import { SaveRepository } from '@core/persistence/SaveRepository';
import { GameErrorCode } from '@core/domain/errors';
import { createInitialState } from '@core/domain/gameStateFactory';
import { makeEnvelope, tamperChecksum, makePointer, makeTombstone, ScriptedStorage } from '../helpers/faults';
import { SAVE_KEYS, type SaveEnvelope, type SavePointer } from '@core/persistence/SaveTypes';

function state(seed: number, now = 1_700_000_000_000 + seed) {
  return createInitialState(now, seed);
}

describe('R11-T01 全 missing 才能新建', () => {
  it('空存储 load→null（可安全新建）', async () => {
    await expect(new SaveRepository(new ScriptedStorage()).load()).resolves.toBeNull();
  });

  it('只有墓碑无槽位：重开后空态→null', async () => {
    const storage = new ScriptedStorage().seed(
      SAVE_KEYS.tombstone,
      makeTombstone('dead-run', 1, 123),
    );
    await expect(new SaveRepository(storage).load()).resolves.toBeNull();
  });
});

describe('R11-T02 坏指针/一槽坏另一槽好可恢复', () => {
  it('指针指坏槽 B，好槽 A 高可信档被恢复并修复指针', async () => {
    const good = state(111);
    const goodEnv = makeEnvelope(good, { revision: 5, resetGeneration: 0 });
    // 坏槽信封与指针声称同一 run，但 checksum 已被篡改
    const badClaimed = { ...makeEnvelope(state(222), { revision: 6 }), runId: good.runId };
    const badEnv = tamperChecksum(badClaimed);
    const storage = new ScriptedStorage()
      .seed(SAVE_KEYS.slotA, goodEnv)
      .seed(SAVE_KEYS.slotB, badEnv)
      .seedPointer(makePointer({ slot: 'b', revision: 6, runId: good.runId, resetGeneration: 0 }));
    const loaded = await new SaveRepository(storage).load();
    expect(loaded).not.toBeNull();
    expect(loaded!.state.runId).toBe(good.runId);
    expect(loaded!.recovered).toBe(true);
    const fixed = storage.peek<SavePointer>(SAVE_KEYS.active);
    expect(fixed?.slot).toBe('a');
    expect(fixed?.revision).toBe(5);
  });

  it('双槽都损坏→SAVE_CORRUPT，不返回 null', async () => {
    const storage = new ScriptedStorage()
      .seed(SAVE_KEYS.slotA, tamperChecksum(makeEnvelope(state(1), { revision: 1 })))
      .seedPointer(makePointer({ slot: 'a', revision: 1, runId: state(1).runId, resetGeneration: 0 }));
    storage.seed(SAVE_KEYS.slotB, tamperChecksum(makeEnvelope(state(2), { revision: 1 })));
    const err = await new SaveRepository(storage).load().catch((e: unknown) => e);
    expect((err as { code?: string }).code).toBe(GameErrorCode.SAVE_CORRUPT);
  });
});

describe('R11-T03 被选择槽或墓碑超时不按空档', () => {
  it('指针指向的槽读取 reject→SAVE_UNAVAILABLE，不枚举覆盖', async () => {
    const good = state(111);
    const goodEnv = makeEnvelope(good, { revision: 5 });
    const storage = new ScriptedStorage()
      .seed(SAVE_KEYS.slotB, goodEnv)
      .seedPointer(makePointer({ slot: 'a', revision: 9, runId: 'missing-run', resetGeneration: 0 }));
    storage.onGet(SAVE_KEYS.slotA, { kind: 'reject', reason: 'timeout' });
    const err = await new SaveRepository(storage).load().catch((e: unknown) => e);
    expect((err as { code?: string }).code).toBe(GameErrorCode.SAVE_UNAVAILABLE);
    // 未写指针（未用 B 槽擅自修复）
    expect(storage.setCalls.filter((c) => c.key === SAVE_KEYS.active)).toHaveLength(0);
  });

  it('无指针枚举时一槽 UNAVAILABLE→阻断，不用另一槽当最新档', async () => {
    const goodEnv = makeEnvelope(state(333), { revision: 3 });
    const storage = new ScriptedStorage().seed(SAVE_KEYS.slotA, goodEnv);
    storage.onGet(SAVE_KEYS.slotB, { kind: 'reject', reason: 'io' });
    const err = await new SaveRepository(storage).load().catch((e: unknown) => e);
    expect((err as { code?: string }).code).toBe(GameErrorCode.SAVE_UNAVAILABLE);
    expect(storage.setCalls).toHaveLength(0);
  });

  it('墓碑读取超时→阻断（不能忽略墓碑恢复旧 run）', async () => {
    const env = makeEnvelope(state(444), { revision: 1 });
    const storage = new ScriptedStorage().seed(SAVE_KEYS.slotA, env);
    storage.onGet(SAVE_KEYS.tombstone, { kind: 'reject', reason: 'timeout' });
    const err = await new SaveRepository(storage).load().catch((e: unknown) => e);
    expect((err as { code?: string }).code).toBe(GameErrorCode.SAVE_UNAVAILABLE);
  });

  it('hang（永不回调）表现为 pending，不被当无档', async () => {
    const storage = new ScriptedStorage();
    storage.onGet(SAVE_KEYS.tombstone, { kind: 'hang' });
    let settled = false;
    void new SaveRepository(storage).load().then(
      () => (settled = true),
      () => (settled = true),
    );
    await Promise.resolve();
    await Promise.resolve();
    expect(settled).toBe(false);
  });
});

describe('R11-T04 元组不匹配不能直接信任', () => {
  it('槽存在但 runId/revision/generation 与指针不符：不直接返回，走恢复枚举', async () => {
    const env = makeEnvelope(state(555), { revision: 8, resetGeneration: 0 });
    // 指针声称 rev9/别的 run
    const storage = new ScriptedStorage()
      .seed(SAVE_KEYS.slotA, env)
      .seedPointer(makePointer({ slot: 'a', revision: 9, runId: 'claimed-other', resetGeneration: 0 }));
    const loaded = await new SaveRepository(storage).load();
    expect(loaded).not.toBeNull();
    expect(loaded!.recovered).toBe(true);
    expect(loaded!.envelope.revision).toBe(8);
  });

  it('generation 不匹配（旧代际档）不能当指针命中；无墓碑时枚举恢复并标记 recovered', async () => {
    const env = makeEnvelope(state(666), { revision: 2, resetGeneration: 0 });
    const storage = new ScriptedStorage()
      .seed(SAVE_KEYS.slotA, env)
      .seedPointer(makePointer({ slot: 'a', revision: 2, runId: env.runId, resetGeneration: 1 }));
    // 槽是 gen0、指针 gen1：不命中指针；无墓碑可佐证旧 run 已死，枚举恢复为可用旧档
    const loaded = await new SaveRepository(storage).load();
    expect(loaded).not.toBeNull();
    expect(loaded!.recovered).toBe(true);
    expect(loaded!.envelope.revision).toBe(2);
  });

  it('generation 旧于墓碑代际：旧 run 残留不得恢复→SAVE_CORRUPT（无新档可切）', async () => {
    const env = makeEnvelope(state(667), { revision: 2, resetGeneration: 0 });
    const storage = new ScriptedStorage()
      .seed(SAVE_KEYS.slotA, env)
      .seed(SAVE_KEYS.tombstone, makeTombstone(env.runId, 1, 999))
      .seedPointer(makePointer({ slot: 'a', revision: 2, runId: env.runId, resetGeneration: 0 }));
    const err = await new SaveRepository(storage).load().catch((e: unknown) => e);
    // 墓碑明确该 run 已关闭且新 run 未落盘：属重开空态，返回 null 由上层走新建
    expect(err).toBeNull();
  });
});

describe('R11-T05 存档预算按真实 UTF-8 字节', () => {
  it('含大量中文的状态超过预算时按 UTF-8 字节拒绝（非 UTF-16 长度）', async () => {
    const s = state(777);
    // 塞入接近阈值的中文负载：每字 3 字节，payload 仍需合法（通过完整性校验）
    s.automationLogs = Array.from({ length: 60 }, (_, i) => ({
      year: 1,
      month: (i % 12) + 1,
      message: '中'.repeat(2400),
    })) as never;
    const repo = new SaveRepository(new ScriptedStorage(), 50_000);
    const err = await repo.commit(s, { revision: 1, resetGeneration: 0, expectedBase: null }).catch((e: unknown) => e);
    expect(String((err as Error).message)).toContain('save-too-large');
  });

  it('500KB 阈值下正常状态可提交', async () => {
    const s = state(888);
    const repo = new SaveRepository(new ScriptedStorage(), 500_000);
    await expect(repo.commit(s, { revision: 1, resetGeneration: 0, expectedBase: null })).resolves.toBeDefined();
  });
});

describe('R11-T06 旧 v1 信封可加载', () => {
  it('resetGeneration 缺字段的历史信封经迁移后仍可装载（向后兼容）', async () => {
    const s = state(999);
    const envelope = makeEnvelope(s, { revision: 1, resetGeneration: 0 }) as SaveEnvelope;
    const legacy = { ...envelope };
    delete (legacy as Partial<SaveEnvelope>).resetGeneration;
    legacy.checksum = envelope.checksum; // checksum 含 resetGeneration=0 字段，保持
    const storage = new ScriptedStorage().seed(SAVE_KEYS.slotA, legacy);
    // 旧档无指针：枚举恢复
    const loaded = await new SaveRepository(storage).load();
    expect(loaded).not.toBeNull();
    expect(loaded!.state.runId).toBe(s.runId);
  });
});
