/**
 * R02 夹具验收：证明共享故障夹具自身正确、可复用、相互隔离。
 * 对应 R02-T01（故障关闭时原流程通过）、T03（每 test 独立存储/seed）、T04（无固定 sleep）。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createInitialState } from '@core/domain/gameStateFactory';
import { SaveRepository } from '@core/persistence/SaveRepository';
import { verifyEnvelope } from '@core/persistence/SaveCodec';
import { SAVE_KEYS } from '@core/persistence/SaveTypes';
import {
  ScriptedTapRuntime,
  buildCommittedSave,
  makeEnvelope,
  tamperChecksum,
  makePointer,
  makeTombstone,
} from '../helpers/faults';

describe('R02-T01 故障关闭：真实 SaveRepository 正常提交/装载', () => {
  it('commit→load 往返成功且恢复标记为 false', async () => {
    const state = createInitialState(1_700_000_000_000);
    state.rngCounter = 42;
    const built = await buildCommittedSave(state, { revision: 1 });
    expect(built.slot).toBe('a');
    const repo = new SaveRepository(built.storage);
    const loaded = await repo.load();
    expect(loaded).not.toBeNull();
    expect(loaded!.state.runId).toBe(state.runId);
    expect(loaded!.state.rngCounter).toBe(42);
    expect(loaded!.recovered).toBe(false);
  });
});

describe('R02 旧档/损坏/墓碑夹具', () => {
  it('tamperChecksum 产生的槽位 verifyEnvelope 失败（损坏可判定）', () => {
    const state = createInitialState(1_700_000_000_000);
    const envelope = makeEnvelope(state, { revision: 3 });
    expect(verifyEnvelope(envelope).ok).toBe(true);
    expect(verifyEnvelope(tamperChecksum(envelope)).ok).toBe(false);
  });

  it('坏槽+好槽可由 load 恢复到好槽（为 R11 恢复决策夹具）', async () => {
    const good = createInitialState(1_700_000_000_000, 111);
    good.rngCounter = 111;
    const built = await buildCommittedSave(good, { revision: 5 });
    // 在另一槽放坏信封（不同 run），并把指针指坏
    const bad = createInitialState(1_700_000_000_001, 222);
    bad.rngCounter = 222;
    const badEnvelope = tamperChecksum(makeEnvelope(bad, { revision: 6 }));
    const storage = built.storage.seed(SAVE_KEYS.slotB, badEnvelope);
    storage.seedPointer(makePointer({ slot: 'b', revision: 6, runId: bad.runId, resetGeneration: 0 }));
    const loaded = await new SaveRepository(storage).load();
    expect(loaded).not.toBeNull();
    expect(loaded!.state.runId).toBe(good.runId);
    expect(loaded!.recovered).toBe(true);
  });

  it('可构造跨 run 墓碑夹具', () => {
    const t = makeTombstone('old-run', 1, 1_700_000_000_000);
    expect(t.oldRunId).toBe('old-run');
    expect(t.newResetGeneration).toBe(1);
  });
});

describe('R02-T03 每个测试独立存储/seed', () => {
  let tap: ScriptedTapRuntime;
  beforeEach(() => {
    tap = new ScriptedTapRuntime();
  });

  it('实例一：写入不串到下一个测试', async () => {
    tap.seedStorage('k', 'v1');
    await new Promise<void>((resolve) => {
      tap.getStorage({ key: 'k', success: (r) => { expect(r.data).toBe('v1'); resolve(); } });
    });
  });

  it('实例二：存储为空，缺失 key 走 data not found', async () => {
    await new Promise<void>((resolve) => {
      tap.getStorage({
        key: 'k',
        success: () => {
          throw new Error('不应成功');
        },
        fail: (res) => {
          expect(res.errMsg).toContain('not found');
          resolve();
        },
      });
    });
  });

  it('silent 脚本只影响一次调用，之后恢复正常', async () => {
    tap.script('getStorage', { type: 'silent' });
    let calls = 0;
    tap.getStorage({ key: 'k', success: () => (calls += 1), fail: () => (calls += 1) });
    expect(calls).toBe(0);
    await new Promise<void>((resolve) => {
      tap.getStorage({ key: 'k', success: () => resolve(), fail: () => resolve() });
    });
  });
});
