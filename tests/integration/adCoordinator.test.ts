import { describe, expect, it } from 'vitest';
import { GameFacade } from '@core/application/GameFacade';
import { registerConfig } from '@core/config/configLoader';
import economyJson from '../../assets/resources/config/economy.v1.json';
import { AdRewardCoordinator } from '../../assets/scripts/ads/AdRewardCoordinator';
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
});
