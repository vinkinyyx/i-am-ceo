// R12 / REVIEW-20261103-01：未知提交后禁止旧 draft 覆盖已落盘状态。
import { beforeAll, describe, expect, it } from 'vitest';
import { EditorMockPlatform } from '../helpers/EditorMockPlatform';
import { GameFacade } from '@core/application/GameFacade';
import { MemoryStorage } from '../helpers/MemoryStorage';
import { SAVE_KEYS } from '@core/persistence/SaveTypes';
import rawEconomy from '../../assets/resources/config/economy.v1.json';
import { registerConfig } from '@core/config/configLoader';
import type { EconomyConfig } from '@core/config/EconomyConfig';

let cfg: EconomyConfig;
beforeAll(() => {
  cfg = registerConfig(rawEconomy as never);
});

class PointerFaultStorage extends MemoryStorage {
  mode: 'after-pointer-write' | 'before-slot-write' | null = null;

  override async set<T>(key: string, value: T): Promise<void> {
    if (this.mode === 'before-slot-write' && (key === SAVE_KEYS.slotA || key === SAVE_KEYS.slotB)) {
      this.mode = null;
      throw new Error('simulated slot write failure before storage');
    }
    if (key === SAVE_KEYS.active && this.mode === 'after-pointer-write') {
      const mode = this.mode;
      this.mode = null;
      if (mode === 'after-pointer-write') await super.set(key, value);
      throw new Error('simulated unknown pointer write result');
    }
    await super.set(key, value);
  }
}

async function operating(facade: GameFacade): Promise<void> {
  let s = facade.getState();
  expect((await facade.createCompany(
    { companyName: '事务恢复公司', industry: 'TRADE', ceoName: '林启航', ceoTrait: 'BOLD' },
    { commandId: 'create', expectedRunId: s.runId },
  )).ok).toBe(true);
  s = facade.getState();
  const deptId = s.departments[0]!.deptId;
  for (let i = 0; i < 2; i += 1) {
    const offer = facade.getOffer(deptId);
    const candidate = offer.candidates.find((c) => !s.employees.some((e) => e.candidateId === c.candidateId))!;
    expect((await facade.hireEmployee(
      { offerId: offer.offerId, candidateId: candidate.candidateId, departmentId: deptId },
      { commandId: `hire-${i}`, expectedRunId: s.runId },
    )).ok).toBe(true);
    s = facade.getState();
  }
  expect((await facade.startOperating({ commandId: 'start', expectedRunId: s.runId })).ok).toBe(true);
}

async function makeFacade(storage: PointerFaultStorage): Promise<GameFacade> {
  return GameFacade.bootstrap(new EditorMockPlatform(storage), cfg);
}

describe('R12 unknown commit recovery regression', () => {
  it('A-01 applies a post-recovery policy command without losing or replaying a committed investment', async () => {
    const storage = new PointerFaultStorage();
    const facade = await makeFacade(storage);
    await operating(facade);
    const runId = facade.getState().runId;
    const before = facade.getState().company!;
    const beforeRevision = facade.getRevision();

    storage.mode = 'after-pointer-write';
    const investment = await facade.invest(10_000, { commandId: 'a01-invest', expectedRunId: runId });
    expect(investment.ok).toBe(false);

    const policy = await facade.setPolicy('GROWTH', { commandId: 'a01-policy', expectedRunId: runId });
    expect(policy.ok).toBe(true);
    expect(facade.getState().company!.cashYuan).toBe(before.cashYuan - 10_000);
    expect(facade.getState().company!.businessAssetBookYuan).toBe(before.businessAssetBookYuan + 10_000);
    expect(facade.getState().policy).toBe('GROWTH');
    expect(facade.getRevision()).toBe(beforeRevision + 2);
    expect(facade.getState().executedCommandIds).toContain('a01-invest');

    const reloaded = await makeFacade(storage);
    expect(reloaded.getRevision()).toBe(beforeRevision + 2);
    expect(reloaded.getState().company!.cashYuan).toBe(before.cashYuan - 10_000);
    expect(reloaded.getState().company!.businessAssetBookYuan).toBe(before.businessAssetBookYuan + 10_000);
    expect(reloaded.getState().policy).toBe('GROWTH');
  });

  it('recovers a completed ad grant idempotently after an unknown pointer write', async () => {
    const storage = new PointerFaultStorage();
    const facade = await makeFacade(storage);
    await operating(facade);
    const sessionId = 'ad-grant-unknown-pointer';
    const begun = await facade.beginRewardedAdSession(sessionId, 1_800_000_000_000);
    expect(begun.ok && begun.payload).toBe(true);
    storage.mode = 'after-pointer-write';
    expect((await facade.completeRewardedAdSession(sessionId, 1_800_000_000_000)).ok).toBe(false);
    const retry = await facade.completeRewardedAdSession(sessionId, 1_800_000_000_000);
    expect(retry.ok).toBe(true);
    expect(retry.ok && retry.payload).toBe(true);
    expect(facade.getState().adRewards?.grantsUsed).toBe(1);
    expect(facade.getState().adRewards?.couponIds).toEqual([sessionId]);
    const reloaded = await makeFacade(storage);
    expect(reloaded.getState().adRewards?.grantsUsed).toBe(1);
    expect(reloaded.getState().adRewards?.couponIds).toEqual([sessionId]);
  });

  it('A-09 rejects a stale coupon hire preview after recovery without consuming the coupon or hiring', async () => {
    const storage = new PointerFaultStorage();
    const facade = await makeFacade(storage);
    await operating(facade);
    const runId = facade.getState().runId;
    const sessionId = 'stale-hire-preview';
    expect((await facade.beginRewardedAdSession(sessionId, 1_800_000_000_000)).ok).toBe(true);
    expect((await facade.completeRewardedAdSession(sessionId, 1_800_000_000_000)).ok).toBe(true);
    const deptId = facade.getState().departments[0]!.deptId;
    const offer = facade.getOffer(deptId);
    const candidate = offer.candidates.find((c) => !facade.getState().employees.some((e) => e.candidateId === c.candidateId))!;
    const preview = facade.previewHire({ offerId: offer.offerId, candidateId: candidate.candidateId, departmentId: deptId, couponId: sessionId });
    if (!preview.ok) throw new Error(`preview-failed:${preview.code}`);
    const revision = preview.revision;
    const cashBefore = facade.getState().company!.cashYuan;
    const employeeCount = facade.getState().employees.length;

    storage.mode = 'after-pointer-write';
    const unknown = await facade.invest(10_000, { commandId: 'invest-before-stale-hire', expectedRunId: runId });
    expect(unknown.ok).toBe(false);
    const rejected = await facade.hireEmployee(
      { offerId: offer.offerId, candidateId: candidate.candidateId, departmentId: deptId, couponId: sessionId, expectedRevision: revision },
      { commandId: 'stale-coupon-hire', expectedRunId: runId },
    );
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) expect(rejected.code).toBe('CONFIRMATION_EXPIRED');
    expect(facade.getState().employees).toHaveLength(employeeCount);
    expect(facade.getState().adRewards?.couponIds).toContain(sessionId);
    expect(facade.getState().company!.cashYuan).toBe(cashBefore - 10_000);
  });

  it('A-10 continues months and hiring after recovery, then survives facade reload', async () => {
    const storage = new PointerFaultStorage();
    const facade = await makeFacade(storage);
    await operating(facade);
    const runId = facade.getState().runId;
    // Deterministic year-boundary fixture with enough liquidity to avoid DISTRESS.
    const fixture = facade.getState();
    fixture.gameYear = 1;
    fixture.gameMonth = 11;
    fixture.progressMsInMonth = 0;
    fixture.company!.cashYuan = 50_000_000;
    fixture.yearOpenCashYuan[1] = 50_000_000;
    expect((await facade.setPolicy('STEADY', { commandId: 'seed-year-boundary', expectedRunId: runId })).ok).toBe(true);
    storage.mode = 'after-pointer-write';
    const tickAt = 1_800_000_000_050;
    const uncertainTick = await facade.advanceRealTime(50_000, runId, tickAt);
    expect(uncertainTick.ok).toBe(false);
    const recoveredCommand = await facade.setPolicy('GROWTH', { commandId: 'policy-after-month-recovery', expectedRunId: runId });
    expect(recoveredCommand.ok).toBe(true);
    expect(facade.getState().gameYear).toBe(2);
    expect(facade.getState().gameMonth).toBe(1);
    expect(facade.getState().lastWallClockMs).toBe(tickAt);
    const nextTick = await facade.advanceRealTime(50_000, runId, tickAt + 50_000);
    expect(nextTick.ok).toBe(true);
    expect(facade.getState().gameMonth).toBe(3);
    expect(facade.getState().gameYear).toBe(2);
    const offlineCheck = await facade.settleOffline(tickAt + 50_001);
    expect(offlineCheck.ok && offlineCheck.payload.monthsSettled).toBe(0);

    const deptId = facade.getState().departments[0]!.deptId;
    const offer = facade.getOffer(deptId);
    const candidate = offer.candidates.find((c) => !facade.getState().employees.some((e) => e.candidateId === c.candidateId))!;
    const preview = facade.previewHire({ offerId: offer.offerId, candidateId: candidate.candidateId, departmentId: deptId });
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    const hire = await facade.hireEmployee(
      { offerId: offer.offerId, candidateId: candidate.candidateId, departmentId: deptId, expectedRevision: preview.revision },
      { commandId: 'hire-after-month-recovery', expectedRunId: runId },
    );
    expect(hire.ok).toBe(true);
    const reloaded = await makeFacade(storage);
    expect(reloaded.getState().gameMonth).toBe(3);
    expect(reloaded.getState().gameYear).toBe(2);
    expect(reloaded.getState().employees.some((e) => e.hireCommandId === 'hire-after-month-recovery')).toBe(true);
    expect(reloaded.getState().policy).toBe('GROWTH');
  });

  it('A-02 reconciles a same-command investment retry exactly once, then runs another command without restart', async () => {
    const storage = new PointerFaultStorage();
    const facade = await makeFacade(storage);
    await operating(facade);
    const runId = facade.getState().runId;
    const before = facade.getState().company!;
    const beforeRevision = facade.getRevision();

    storage.mode = 'after-pointer-write';
    const unknown = await facade.invest(10_000, { commandId: 'invest-unknown', expectedRunId: runId });
    expect(unknown.ok).toBe(false);
    expect(facade.getState().company!.businessAssetBookYuan).toBe(before.businessAssetBookYuan);

    const retry = await facade.invest(10_000, { commandId: 'invest-unknown', expectedRunId: runId });
    expect(retry.ok).toBe(true);
    expect(facade.getState().company!.businessAssetBookYuan).toBe(before.businessAssetBookYuan + 10_000);
    expect(facade.getState().company!.cashYuan).toBe(before.cashYuan - 10_000);

    const policy = await facade.setPolicy('GROWTH', { commandId: 'policy-after-recovery', expectedRunId: runId });
    expect(policy.ok).toBe(true);
    expect(facade.getRevision()).toBe(beforeRevision + 3);
    expect(facade.getState().company!.businessAssetBookYuan).toBe(before.businessAssetBookYuan + 10_000);

    const reloaded = await makeFacade(storage);
    expect(reloaded.getRevision()).toBe(beforeRevision + 3);
    expect(reloaded.getState().company!.businessAssetBookYuan).toBe(before.businessAssetBookYuan + 10_000);
    expect(reloaded.getState().company!.cashYuan).toBe(before.cashYuan - 10_000);
    expect(reloaded.getState().policy).toBe('GROWTH');
  });

  it('keeps the old committed state when the pointer write failed before storage and allows a fresh command', async () => {
    const storage = new PointerFaultStorage();
    const facade = await makeFacade(storage);
    await operating(facade);
    const runId = facade.getState().runId;
    const before = facade.getState().company!;
    const beforeRevision = facade.getRevision();

    storage.mode = 'before-slot-write';
    const unknown = await facade.invest(10_000, { commandId: 'invest-not-written', expectedRunId: runId });
    expect(unknown.ok).toBe(false);
    expect(facade.getState().company!.businessAssetBookYuan).toBe(before.businessAssetBookYuan);

    const policy = await facade.setPolicy('GROWTH', { commandId: 'policy-after-retain', expectedRunId: runId });
    expect(policy.ok).toBe(true);
    expect(facade.getRevision()).toBe(beforeRevision + 1);
    expect(facade.getState().company!.businessAssetBookYuan).toBe(before.businessAssetBookYuan);
    const active = await storage.get<{ slot: 'a' | 'b' }>(SAVE_KEYS.active);
    const envelope = await storage.get<{ revision: number; payload: { company: { businessAssetBookYuan: number } } }>(
      active?.slot === 'b' ? SAVE_KEYS.slotB : SAVE_KEYS.slotA,
    );
    expect(envelope?.revision).toBe(beforeRevision + 1);
    expect(envelope?.payload.company.businessAssetBookYuan).toBe(before.businessAssetBookYuan);
  });
});
