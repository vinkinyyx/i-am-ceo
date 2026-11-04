// R27：公司名刷新不污染市场 RNG、创建命令只注资一次、首聘 1→2 重载保持。
import { describe, it, expect, beforeAll } from 'vitest';
import { EditorMockPlatform } from '../helpers/EditorMockPlatform';
import { MemoryStorage } from '../helpers/MemoryStorage';
import { GameFacade } from '@core/application/GameFacade';
import rawEconomy from '../../assets/resources/config/economy.v1.json';
import { registerConfig } from '@core/config/configLoader';
import type { EconomyConfig } from '@core/config/EconomyConfig';
import type { IndustryId } from '@core/domain/types';

let cfg: EconomyConfig;
beforeAll(() => {
  cfg = registerConfig(rawEconomy as never);
});

async function fresh(): Promise<{ facade: GameFacade; storage: MemoryStorage }> {
  const storage = new MemoryStorage();
  const platform = new EditorMockPlatform(storage);
  const facade = await GameFacade.bootstrap(platform, cfg);
  return { facade, storage };
}

async function create(facade: GameFacade, industry: IndustryId = 'TRADE'): Promise<void> {
  const s = facade.getState();
  const r = await facade.createCompany(
    { companyName: '向上生长科技', industry, ceoName: '林启航', ceoTrait: 'BOLD' },
    { commandId: 'create-1', expectedRunId: s.runId },
  );
  expect(r.ok).toBe(true);
}

describe('R27 T01 公司名刷新与市场随机流隔离', () => {
  it('换行业/换批只读派生，不推进 rngCounter/revision', async () => {
    const { facade } = await fresh();
    const before = facade.getState();
    const a = facade.rollCompanyNames('TRADE', 3, 0);
    const b = facade.rollCompanyNames('SOFTWARE', 3, 0);
    const c = facade.rollCompanyNames('TRADE', 3, 1);
    const after = facade.getState();
    expect(a).toEqual(facade.rollCompanyNames('TRADE', 3, 0));
    expect(new Set(a).size).toBe(3);
    expect(b).not.toEqual(a);
    expect(c).not.toEqual(a);
    expect(after.rngCounter).toBe(before.rngCounter);
    expect(after.seed).toBe(before.seed);
    expect(facade.getRevision()).toBe(0);
  });
});

describe('R27 T05/T06 三行业创建与一次注资', () => {
  it('三个行业都能完成创建，现金只注资 30 万一次', async () => {
    for (const industry of ['TRADE', 'SOFTWARE', 'SERVICE'] as IndustryId[]) {
      const { facade } = await fresh();
      await create(facade, industry);
      const s = facade.getState();
      expect(s.phase).toBe('HIRING_INITIAL');
      expect(s.company?.cashYuan).toBe(300_000);
      expect(s.initializedCapital).toBe(true);
      expect(s.company?.industry).toBe(industry);
      expect(s.employees).toHaveLength(0);
    }
  });

  it('同一创建意图连点复用 commandId：只建一家公司、只注资一次', async () => {
    const { facade } = await fresh();
    const s = facade.getState();
    const input = { companyName: '连点测试公司', industry: 'TRADE' as IndustryId, ceoName: '陈稳', ceoTrait: 'STEADY' as const };
    const ctx = { commandId: 'same-intent', expectedRunId: s.runId };
    const first = await facade.createCompany(input, ctx);
    const second = await facade.createCompany(input, ctx);
    expect(first.ok && second.ok).toBe(true);
    expect(facade.getState().company?.cashYuan).toBe(300_000);
    expect(facade.getState().employees).toHaveLength(0);
  });
});

describe('R27 T04 首聘 1/2 强杀重载 → 2/2 继续', () => {
  it('第一名录用后重载仍保持 1/2；第二名费用按预览扣，现金=30万−两人招聘费', async () => {
    const { facade, storage } = await fresh();
    await create(facade);
    const s1 = facade.getState();
    const deptId = s1.departments[0]!.deptId;
    const offer = facade.getOffer(deptId);
    const first = offer.candidates[0]!;
    const pv1 = facade.previewHire({ offerId: offer.offerId, candidateId: first.candidateId, departmentId: deptId });
    expect(pv1.ok).toBe(true);
    if (!pv1.ok) return;
    const hire1 = await facade.hireEmployee(
      { offerId: offer.offerId, candidateId: first.candidateId, departmentId: deptId },
      { commandId: 'h1', expectedRunId: s1.runId },
    );
    expect(hire1.ok && hire1.payload.feePaidYuan === pv1.payload.feeYuan).toBe(true);

    // 强杀重载：同一存储重新 bootstrap
    const reloaded = await GameFacade.bootstrap(new EditorMockPlatform(storage), cfg);
    const r1 = reloaded.getState();
    expect(r1.onboarding.initialHiresCompleted).toBe(1);
    expect(r1.employees).toHaveLength(1);
    expect(r1.company?.cashYuan).toBe(300_000 - pv1.payload.feeYuan);

    const offer2 = reloaded.getOffer(deptId);
    const second = offer2.candidates.find((c) => c.candidateId !== first.candidateId) ?? offer2.candidates[0]!;
    const pv2 = reloaded.previewHire({ offerId: offer2.offerId, candidateId: second.candidateId, departmentId: deptId });
    expect(pv2.ok).toBe(true);
    if (!pv2.ok) return;
    const hire2 = await reloaded.hireEmployee(
      { offerId: offer2.offerId, candidateId: second.candidateId, departmentId: deptId },
      { commandId: 'h2', expectedRunId: r1.runId },
    );
    expect(hire2.ok && hire2.payload.feePaidYuan === pv2.payload.feeYuan).toBe(true);

    const s2 = reloaded.getState();
    expect(s2.onboarding.initialHiresCompleted).toBe(2);
    expect(s2.employees).toHaveLength(2);
    expect(s2.company?.cashYuan).toBe(300_000 - pv1.payload.feeYuan - pv2.payload.feeYuan);
    expect(s2.company?.paidInCapitalYuan).toBe(300_000);

    const start = await reloaded.startOperating({ commandId: 'start-1', expectedRunId: s2.runId });
    expect(start.ok).toBe(true);
    expect(reloaded.getState().phase).toBe('RUNNING');
    expect(reloaded.getState().speed).toBe(1);
  });
});
