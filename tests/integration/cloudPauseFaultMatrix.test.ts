/**
 * A3：云预览“暂停经营”的固定持久化故障点矩阵。
 *
 * 入口约定（AppView.pauseForCloudPreview）：只有 setSpeed(0) 返回 ok，
 * 且 state.speed===0、getPersistenceStatus()==='ready' 时才允许捕获基线并预览。
 * 本矩阵固定住 store 层的故障语义，防止“暂停写入未确认却继续预览”。
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { EditorMockPlatform } from '../helpers/EditorMockPlatform';
import { ScriptedStorage } from '../helpers/faults';
import { GameFacade } from '@core/application/GameFacade';
import { SAVE_KEYS } from '@core/persistence/SaveTypes';
import rawEconomy from '../../assets/resources/config/economy.v1.json';
import { registerConfig } from '@core/config/configLoader';
import type { EconomyConfig } from '@core/config/EconomyConfig';

let cfg: EconomyConfig;
beforeAll(() => { cfg = registerConfig(rawEconomy as never); });

class PauseFaultStorage extends ScriptedStorage {
  failSlotBeforeApply = false;
  failPointerAfterApply = false;
  failJournalRemove = false;

  override async set<T>(key: string, value: T): Promise<void> {
    if (this.failSlotBeforeApply && (key === SAVE_KEYS.slotA || key === SAVE_KEYS.slotB)) {
      this.failSlotBeforeApply = false;
      throw new Error('SAVE_FAILED:injected-slot-before-apply');
    }
    if (this.failPointerAfterApply && key === SAVE_KEYS.active) {
      this.failPointerAfterApply = false;
      await super.set(key, value);
      throw new Error('SAVE_UNAVAILABLE:pointer-callback-unknown');
    }
    await super.set(key, value);
  }

  override async remove(key: string): Promise<void> {
    if (this.failJournalRemove && key === SAVE_KEYS.transaction) {
      this.failJournalRemove = false;
      throw new Error('SAVE_UNAVAILABLE:journal-remove-unknown');
    }
    await super.remove(key);
  }
}

async function runningFacade(): Promise<{ facade: GameFacade; storage: PauseFaultStorage }> {
  const storage = new PauseFaultStorage();
  const facade = await GameFacade.bootstrap(new EditorMockPlatform(storage), cfg);
  const runId = facade.getState().runId;
  const started = await facade.setSpeed(1, { commandId: 'matrix-start', expectedRunId: runId });
  expect(started.ok).toBe(true);
  return { facade, storage };
}

async function tryPause(facade: GameFacade): Promise<{ ok: boolean; speed: number; status: string }> {
  const before = facade.getState();
  const result = await facade.setSpeed(0, { commandId: 'matrix-pause', expectedRunId: before.runId });
  const after = facade.getState();
  return { ok: result.ok, speed: after.speed, status: facade.getPersistenceStatus() };
}

/** 与 AppView.pauseForCloudPreview 相同的放行条件。 */
function isPreviewEligible(result: { ok: boolean; speed: number; status: string }): boolean {
  return result.ok && result.speed === 0 && result.status === 'ready';
}

describe('A3 cloud preview pause persistence fault matrix', () => {
  it('slot write rejected before apply: pause fails and stays non-eligible', async () => {
    const { facade, storage } = await runningFacade();
    storage.failSlotBeforeApply = true;
    const result = await tryPause(facade);
    expect(result.ok).toBe(false);
    expect(result.speed).toBe(1);
    // 故障后 store 会保守进入 recovery-required；预览入口必须拒绝。
    expect(result.status).toBe('recovery-required');
    expect(isPreviewEligible(result)).toBe(false);
  });

  it('pointer write applies then callback lost: pause is unconfirmed, recovery required', async () => {
    const { facade, storage } = await runningFacade();
    storage.failPointerAfterApply = true;
    const result = await tryPause(facade);
    expect(result.ok).toBe(false);
    expect(result.status).toBe('recovery-required');
    expect(result.speed).not.toBe(0);
    expect(isPreviewEligible(result)).toBe(false);
  });

  it('journal removal failure either fails or recovers to a durable ready state (never ok-but-dirty)', async () => {
    const { facade, storage } = await runningFacade();
    storage.failJournalRemove = true;
    const result = await tryPause(facade);
    if (result.ok) expect(result).toEqual({ ok: true, speed: 0, status: 'ready' });
    else expect(isPreviewEligible(result)).toBe(false);
  });

  it('healthy pause commits speed=0 and reports ready (preview baseline allowed)', async () => {
    const { facade } = await runningFacade();
    const result = await tryPause(facade);
    expect(result).toEqual({ ok: true, speed: 0, status: 'ready' });
    expect(isPreviewEligible(result)).toBe(true);
  });

  it('failure is never preview-eligible; a later retry may recover and then become eligible', async () => {
    const { facade, storage } = await runningFacade();
    storage.failSlotBeforeApply = true;
    const failed = await tryPause(facade);
    expect(isPreviewEligible(failed)).toBe(false);
    const retried = await tryPause(facade);
    // 允许两种合法收敛：仍未成功（不可预览），或成功且 ready（可预览）。
    if (retried.ok) expect(retried).toEqual({ ok: true, speed: 0, status: 'ready' });
    expect(isPreviewEligible(retried)).toBe(retried.ok);
  });
});
