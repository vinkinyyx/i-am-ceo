/**
 * R13：读档失败时启动闸门——不新建、不写入、可重试恢复同 run。
 */
import { describe, it, expect } from 'vitest';
import { GameFacade } from '@core/application/GameFacade';
import { registerConfig } from '@core/config/configLoader';
import type { EconomyConfig } from '@core/config/EconomyConfig';
import economyJson from '../../assets/resources/config/economy.v1.json';
import { ScriptedStorage, buildCommittedSave } from '../helpers/faults';
import { createInitialState } from '@core/domain/gameStateFactory';
import { SAVE_KEYS } from '@core/persistence/SaveTypes';

const cfg = registerConfig(economyJson as unknown as EconomyConfig);

describe('R13-T01 读超时：无新公司入口、无写入；恢复后原 run/现金/员工回来', () => {
  it('已有公司→被选择槽超时→unavailable→恢复回调→loaded 同 runId', async () => {
    // 准备一份 rev3 的已提交档
    const state = createInitialState(1_700_000_000_000, 4242);
    const built = await buildCommittedSave(state, { revision: 3, resetGeneration: 0 });
    const storage = built.storage;
    const pointerKey = SAVE_KEYS.active;
    const pointedSlot = storage.peek<{ slot: 'a' | 'b' }>(pointerKey)?.slot ?? 'a';
    const slotKey = pointedSlot === 'a' ? SAVE_KEYS.slotA : SAVE_KEYS.slotB;

    // 第一次启动：被选择槽读取超时（墓碑/指针/jorunal 可正常读取，仅目标槽不可读）
    const writesBefore = storage.setCalls.length;
    // 排两次故障：首次装载被阻断，第二次（恢复重试）仍先经历一次失败后脚本耗尽，
    // 第三次实际恢复路径读到正常值——这里直接让第二次即恢复，故只排一次
    storage.onGet(slotKey, { kind: 'reject', reason: 'timeout' });
    const blocked = await GameFacade.bootstrapWithStatus(storage, cfg);
    expect(blocked.kind).toBe('unavailable');
    if (blocked.kind === 'unavailable') expect(blocked.reason).toBeDefined();
    // 失败期间没有任何写入（不切指针、不写槽、不写 journal）
    expect(storage.setCalls.length - writesBefore).toBe(0);

    // 恢复后第二次启动：故障脚本耗尽，装载原档，runId/revision 一致
    const recovered = await GameFacade.bootstrapWithStatus(storage, cfg);
    expect(recovered.kind).toBe('loaded');
    if (recovered.kind === 'loaded') {
      expect(recovered.facade.getState().runId).toBe(state.runId);
      expect(recovered.facade.getRevision()).toBe(3);
    }
  });

  it('双槽损坏→corrupt，且不返回可写 facade', async () => {
    const storage = new ScriptedStorage();
    storage.seed(SAVE_KEYS.slotA, { schemaVersion: 1, checksum: 'dead' });
    storage.seed(SAVE_KEYS.slotB, { schemaVersion: 1, checksum: 'beef' });
    const result = await GameFacade.bootstrapWithStatus(storage, cfg);
    expect(result.kind).toBe('corrupt');
    expect(storage.setCalls).toHaveLength(0);
  });

  it('空存储→new-game，可创建公司', async () => {
    const result = await GameFacade.bootstrapWithStatus(new ScriptedStorage(), cfg);
    expect(result.kind).toBe('new-game');
  });
});

describe('R13-T02 连续 bootstrap 不叠加（单一 attempt 语义由调用方保证；这里验证无副作用累积）', () => {
  it('两次 unavailable 后存储仍零写入', async () => {
    const state = createInitialState(1_700_000_000_000, 555);
    const built = await buildCommittedSave(state, { revision: 1 });
    const storage = built.storage;
    // 每次装载都对相关读取安排超时（脚本按调用消耗，故各排两次）
    for (const key of [SAVE_KEYS.transaction, SAVE_KEYS.tombstone, SAVE_KEYS.slotA]) {
      storage.onGet(key, { kind: 'reject', reason: 'io' }, { kind: 'reject', reason: 'io' });
    }
    const writesBefore = storage.setCalls.length;
    const r1 = await GameFacade.bootstrapWithStatus(storage, cfg);
    const r2 = await GameFacade.bootstrapWithStatus(storage, cfg);
    expect(r1.kind).toBe('unavailable');
    expect(r2.kind).toBe('unavailable');
    expect(storage.setCalls.length - writesBefore).toBe(0);
  });
});

describe('R13-T03 损坏档不自动清空', () => {
  it('corrupt 后原始槽位数据仍在存储中', async () => {
    const storage = new ScriptedStorage();
    storage.seed(SAVE_KEYS.slotA, { schemaVersion: 1, checksum: 'dead' });
    storage.seed(SAVE_KEYS.slotB, { schemaVersion: 1, checksum: 'beef' });
    await GameFacade.bootstrapWithStatus(storage, cfg).catch(() => undefined);
    expect(storage.peek(SAVE_KEYS.slotA)).not.toBeNull();
    expect(storage.peek(SAVE_KEYS.slotB)).not.toBeNull();
  });
});
