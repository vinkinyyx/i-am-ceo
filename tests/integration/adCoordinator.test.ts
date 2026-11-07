import { describe, expect, it } from 'vitest';
import { GameFacade } from '@core/application/GameFacade';
import { registerConfig } from '@core/config/configLoader';
import economyJson from '../../assets/resources/config/economy.v1.json';
import { AdRewardCoordinator } from '../../assets/scripts/ads/AdRewardCoordinator';
import { isAdCouponAvailable } from '@core/application/AdRewardService';
import { FakeRewardedAdProvider } from '../helpers/FakeRewardedAdProvider';
import { EditorMockPlatform } from '../helpers/EditorMockPlatform';
import type { EconomyConfig } from '@core/config/EconomyConfig';

const cfg = registerConfig(economyJson as unknown as EconomyConfig);

async function make() {
  const platform = new EditorMockPlatform();
  const facade = await GameFacade.fromStorage(platform, cfg);
  let s = facade.getState();
  const created = await facade.createCompany({ companyName: '广告事务测试公司', industry: 'TRADE', ceoName: '测试CEO', ceoTrait: 'BOLD' },
    { commandId: 'ad-create', expectedRunId: s.runId });
  expect(created.ok).toBe(true);
  s = facade.getState();
  const deptId = s.departments[0]!.deptId;
  for (let i = 0; i < 2; i++) {
    const offer = facade.getOffer(deptId);
    const candidate = offer.candidates.find((c) => !s.employees.some((e) => e.candidateId === c.candidateId))!;
    const hired = await facade.hireEmployee({ offerId: offer.offerId, candidateId: candidate.candidateId, departmentId: deptId },
      { commandId: `ad-hire-${i}`, expectedRunId: s.runId });
    expect(hired.ok).toBe(true);
    s = facade.getState();
  }
  const started = await facade.startOperating({ commandId: 'ad-start', expectedRunId: s.runId });
  expect(started.ok).toBe(true);
  return { facade, platform };
}

describe('rewarded ad coordinator transaction', () => {
  it('grants only after completed result and persists through reload', async () => {
    const { facade, platform } = await make();
    const fake = new FakeRewardedAdProvider();
    const coordinator = new AdRewardCoordinator(fake, facade);
    const result = await coordinator.request(1_800_000_000_000);
    expect(result.kind).toBe('completed');
    expect(facade.getState().adRewards?.grantsUsed).toBe(1);
    expect(facade.getState().adRewards?.couponIds).toHaveLength(1);
    const recovered = await GameFacade.fromStorage(platform, cfg);
    expect(recovered.getState().adRewards?.grantsUsed).toBe(1);
    expect(recovered.getState().adRewards?.couponIds).toHaveLength(1);
  });

  it('skip and failed playback never issue a coupon', async () => {
    const { facade } = await make();
    const fake = new FakeRewardedAdProvider();
    fake.result = { kind: 'skipped' };
    const result = await new AdRewardCoordinator(fake, facade).request(1_800_000_000_000);
    expect(result.kind).toBe('skipped');
    expect(facade.getState().adRewards?.couponIds).toHaveLength(0);
    expect(facade.getState().adRewards?.activeSessionId).toBeNull();
  });

  it('reconciles an unresolved grant without treating it as native ad coverage or showing again', async () => {
    const { facade } = await make();
    const fake = new FakeRewardedAdProvider();
    const coordinator = new AdRewardCoordinator(fake, facade);
    const complete = facade.completeRewardedAdSession.bind(facade);
    let failOnce = true;
    facade.completeRewardedAdSession = async (...args) => {
      if (failOnce) { failOnce = false; return { ok: false, code: 'SAVE_FAILED', displayMessage: 'injected pending grant' }; }
      return complete(...args);
    };
    const first = await coordinator.request(1_800_000_000_000);
    expect(first.kind).toBe('failed');
    expect(coordinator.hasPendingGrant()).toBe(true);
    expect(coordinator.hasActiveSession()).toBe(false);
    const recovered = await coordinator.request(1_800_000_000_100);
    expect(recovered.kind).toBe('completed');
    expect(fake.calls).toBe(1);
    expect(facade.getState().adRewards?.couponIds).toHaveLength(1);
  });

  it('does not grant a completed callback after its captured owner changes', async () => {
    const { facade } = await make();
    let current = true;
    const fake = new FakeRewardedAdProvider();
    const originalShow = fake.show.bind(fake);
    fake.show = async (sessionId) => { const result = await originalShow(sessionId); current = false; return result; };
    const coordinator = new AdRewardCoordinator(fake, facade, () => () => current);
    const result = await coordinator.request(1_800_000_000_000);
    expect(result.kind).toBe('failed');
    expect(facade.getState().adRewards?.couponIds).toHaveLength(0);
    expect(coordinator.hasPendingGrant()).toBe(true);
  });

  it('quarantines one old-owner pending session, preserves request quota, and starts a new-owner session', async () => {
    const { facade, platform } = await make();
    const baseMs = Date.now();
    let owner = 'profile-a';
    const fake = new FakeRewardedAdProvider();
    const coordinator = new AdRewardCoordinator(fake, facade, () => {
      const captured = owner;
      return () => owner === captured;
    }, () => `app-test/test/${owner}`);
    const originalShow = fake.show.bind(fake);
    fake.show = async (sessionId) => {
      const result = await originalShow(sessionId);
      if (owner === 'profile-a') owner = 'profile-b';
      return result;
    };

    const first = await coordinator.request(baseMs);
    expect(first.kind).toBe('failed');
    expect(coordinator.hasPendingGrant()).toBe(true);
    expect(facade.getState().adRewards?.activeSessionId).toBeTruthy();
    const oldSessionId = facade.getState().adRewards!.activeSessionId!;

    const second = await coordinator.request(baseMs + 120_000);
    expect(second.kind).toBe('completed');
    expect(fake.calls).toBe(2);
    expect(coordinator.hasPendingGrant()).toBe(false);
    expect(facade.getState().adRewards?.quarantinedSessionIds).toContain(oldSessionId);
    expect(facade.getState().adRewards?.completedSessionIds).toHaveLength(1);
    expect(facade.getState().adRewards?.completedSessionIds).not.toContain(oldSessionId);
    expect(facade.getState().adRewards?.couponIds).toHaveLength(1);
    const issuedCouponId = facade.getState().adRewards!.couponIds[0]!;
    expect(facade.getState().adRewards?.couponOwnerScopeById?.[issuedCouponId]).toBe('app-test/test/profile-b');
    expect(isAdCouponAvailable(facade.getState(), issuedCouponId, baseMs + 120_000,
      'app-test/test/profile-b')).toBe(true);
    expect(isAdCouponAvailable(facade.getState(), issuedCouponId, baseMs + 120_000,
      'app-test/test/profile-a')).toBe(false);
    expect(facade.getState().adRewards?.requestsUsed).toBe(2);
    const persisted = await GameFacade.fromStorage(platform, cfg);
    expect(persisted.getState().adRewards?.quarantinedSessionIds).toContain(oldSessionId);
    expect(persisted.getState().adRewards?.requestsUsed).toBe(2);
    expect(persisted.getState().adRewards?.couponIds).toHaveLength(1);
    owner = 'profile-a';
    const switchedBack = await coordinator.request(baseMs + 240_000);
    expect(switchedBack).toMatchObject({ kind: 'unavailable', reason: 'daily-limit' });
    expect(fake.calls).toBe(2);
    expect(facade.getState().adRewards?.couponIds).toHaveLength(1);
    expect(facade.getState().adRewards?.completedSessionIds).toHaveLength(1);
    expect(isAdCouponAvailable(facade.getState(), issuedCouponId, baseMs + 240_000,
      'app-test/test/profile-a')).toBe(false);
  });
});

describe('DEV-02 owner 未知与已确认换号分离', () => {
  it('发券前 owner 未确认：不发券、不丢弃，pending 保留；确认后按原券补发不重看', async () => {
    const { facade } = await make();
    let ownerStatus: 'confirmed' | 'unknown' = 'unknown';
    const fake = new FakeRewardedAdProvider();
    const coordinator = new AdRewardCoordinator(fake, facade, () => () => true, () => 'local',
      () => ownerStatus);
    // 观看完成时身份核对中：返回 owner-unconfirmed，券不发、会话 pending 保留
    const first = await coordinator.request(1_800_000_000_000);
    expect(first).toMatchObject({ kind: 'unavailable', reason: 'owner-unconfirmed' });
    expect(facade.getState().adRewards?.couponIds).toHaveLength(0);
    expect(coordinator.hasPendingGrant()).toBe(true);
    expect(fake.calls).toBe(1);
    expect(facade.getState().adRewards?.quarantinedSessionIds ?? []).toHaveLength(0);
    // 核对中再次请求：仍保留 pending，不新发会话、不 quarantine
    const second = await coordinator.request(1_800_000_000_100);
    expect(second).toMatchObject({ kind: 'unavailable', reason: 'owner-unconfirmed' });
    expect(fake.calls).toBe(1);
    expect(facade.getState().adRewards?.quarantinedSessionIds ?? []).toHaveLength(0);
    // owner 确认后：按原 pending 补发，不要求重新观看
    ownerStatus = 'confirmed';
    const third = await coordinator.request(1_800_000_000_200);
    expect(third.kind).toBe('completed');
    expect(fake.calls).toBe(1);
    expect(coordinator.hasPendingGrant()).toBe(false);
    expect(facade.getState().adRewards?.couponIds).toHaveLength(1);
  });

  it('确认换号才精确 quarantine：网络未知不得清 pending', async () => {
    const { facade } = await make();
    const baseMs = Date.now();
    let owner = 'profile-a';
    let ownerStatus: 'confirmed' | 'unknown' = 'unknown';
    const fake = new FakeRewardedAdProvider();
    const coordinator = new AdRewardCoordinator(fake, facade, () => {
      const captured = owner;
      return () => owner === captured;
    }, () => `app-test/test/${owner}`, () => ownerStatus);
    const originalShow = fake.show.bind(fake);
    fake.show = async (sessionId) => {
      const result = await originalShow(sessionId);
      if (owner === 'profile-a') owner = 'profile-b';
      return result;
    };
    const first = await coordinator.request(baseMs);
    // 观看后 owner 未知：pending 保留，不发券、不 quarantine
    expect(first).toMatchObject({ kind: 'unavailable', reason: 'owner-unconfirmed' });
    expect(coordinator.hasPendingGrant()).toBe(true);
    expect(facade.getState().adRewards?.quarantinedSessionIds ?? []).toHaveLength(0);
    expect(facade.getState().adRewards?.couponIds).toHaveLength(0);
    // owner 确认且确实换号：走精确 quarantine（仅旧会话），随后新会话正常发券
    ownerStatus = 'confirmed';
    const second = await coordinator.request(baseMs + 120_000);
    expect(second.kind).toBe('completed');
    expect(facade.getState().adRewards?.quarantinedSessionIds).toHaveLength(1);
    expect(facade.getState().adRewards?.couponIds).toHaveLength(1);
    const couponId = facade.getState().adRewards!.couponIds[0]!;
    expect(facade.getState().adRewards?.couponOwnerScopeById?.[couponId]).toBe('app-test/test/profile-b');
  });
});
