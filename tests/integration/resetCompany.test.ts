import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { EditorMockPlatform } from '@core/platform/EditorMockPlatform';
import { MemoryStorage } from '@core/platform/MemoryStorage';
import { GameFacade } from '@core/application/GameFacade';
import { createInitialState } from '@core/domain/gameStateFactory';
import { createCompany } from '@core/application/CompanyService';
import { GameStore } from '@core/application/GameStore';
import { SAVE_KEYS, type SaveEnvelope } from '@core/persistence/SaveTypes';
import rawEconomy from '../../assets/resources/config/economy.v1.json';
import { registerConfig } from '@core/config/configLoader';
import type { EconomyConfig } from '@core/config/EconomyConfig';

let cfg: EconomyConfig;
beforeAll(() => {
  cfg = registerConfig(rawEconomy as never);
});

async function freshFacade(): Promise<{ facade: GameFacade; platform: EditorMockPlatform }> {
  const platform = new EditorMockPlatform(new MemoryStorage());
  const facade = await GameFacade.bootstrap(platform, cfg);
  return { facade, platform };
}

async function completeOnboarding(facade: GameFacade) {
  const s0 = facade.getState();
  await facade.createCompany(
    { companyName: '测试贸易有限公司', industry: 'TRADE', ceoName: '林启航', ceoTrait: 'BOLD' },
    { commandId: 'c', expectedRunId: s0.runId },
  );
  const s1 = facade.getState();
  const deptId = s1.departments[0]!.deptId;
  const offer1 = facade.getOffer(deptId);
  const cand1 = offer1.candidates[0]!;
  await facade.hireEmployee(
    { offerId: offer1.offerId, candidateId: cand1.candidateId, departmentId: deptId },
    { commandId: 'h1', expectedRunId: s1.runId },
  );
  const s2 = facade.getState();
  const offer2 = facade.getOffer(deptId);
  const cand2 = offer2.candidates[1]!;
  await facade.hireEmployee(
    { offerId: offer2.offerId, candidateId: cand2.candidateId, departmentId: deptId },
    { commandId: 'h2', expectedRunId: s2.runId },
  );
  const s3 = facade.getState();
  await facade.startOperating({ commandId: 'start', expectedRunId: s3.runId });
  return deptId;
}

describe('关闭公司重开事务（A16/A17/A18/B03/A25）', () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
  });

  it('A16: 只预览不确认时一切不变', async () => {
    const platform = new EditorMockPlatform(storage);
    const facade = await GameFacade.bootstrap(platform, cfg);
    await completeOnboarding(facade);
    const before = structuredClone(facade.getState());

    const preview = facade.beginCloseCompany(5000);
    expect(preview.summary.employeeCount).toBe(2);

    const after = facade.getState();
    expect(after.runId).toBe(before.runId);
    expect(after.company?.name).toBe(before.company?.name);
    expect(after.employees).toHaveLength(2);
  });

  it('A17: 确认重开后人事/财务/年限/引导全部清零，新 runId 且未注资', async () => {
    const platform = new EditorMockPlatform(storage);
    const facade = await GameFacade.bootstrap(platform, cfg);
    await completeOnboarding(facade);
    const oldRunId = facade.getState().runId;

    const token = facade.beginCloseCompany(6000);
    const result = await facade.confirmCloseCompany(token, 6000);
    expect(result.ok).toBe(true);

    const fresh = facade.getState();
    expect(fresh.runId).not.toBe(oldRunId);
    expect(fresh.phase).toBe('CREATING');
    expect(fresh.company).toBeNull();
    expect(fresh.ceo).toBeNull();
    expect(fresh.employees).toHaveLength(0);
    expect(fresh.departments).toHaveLength(0);
    expect(fresh.annualReports).toHaveLength(0);
    expect(fresh.initializedCapital).toBe(false);
    expect(fresh.consecutiveProfitableYears).toBe(0);
    expect(fresh.onboarding.initialHiresCompleted).toBe(0);
    expect(fresh.speed).toBe(0);
  });

  it('重开后可再次创建公司并独立获得 30 万（每轮一次注资）', async () => {
    const platform = new EditorMockPlatform(storage);
    const facade = await GameFacade.bootstrap(platform, cfg);
    await completeOnboarding(facade);
    const token = facade.beginCloseCompany(7000);
    await facade.confirmCloseCompany(token, 7000);

    const s = facade.getState();
    const r2 = await facade.createCompany(
      { companyName: '第二家公司', industry: 'SOFTWARE', ceoName: '陈稳', ceoTrait: 'STEADY' },
      { commandId: 'c2', expectedRunId: s.runId },
    );
    expect(r2.ok).toBe(true);
    if (r2.ok) expect(r2.payload.cashYuan).toBe(300_000);
    expect(facade.getState().company?.name).toBe('第二家公司');
  });

  it('A25: 旧 runId 的迟到录用/创建命令被 RUN_CHANGED 拒绝，不污染新 run', async () => {
    const platform = new EditorMockPlatform(storage);
    const facade = await GameFacade.bootstrap(platform, cfg);
    await completeOnboarding(facade);
    const oldRunId = facade.getState().runId;

    const token = facade.beginCloseCompany(8000);
    await facade.confirmCloseCompany(token, 8000);

    // 旧 run 的迟到命令
    const staleCreate = await facade.createCompany(
      { companyName: '旧公司复活', industry: 'TRADE', ceoName: '旧', ceoTrait: 'BOLD' },
      { commandId: 'stale-1', expectedRunId: oldRunId },
    );
    expect(staleCreate.ok).toBe(false);
    if (!staleCreate.ok) expect(staleCreate.code).toBe('RUN_CHANGED');
    expect(facade.getState().company).toBeNull();
  });

  it('A18: 重开并重新 bootstrap（模拟重启），不复活旧 run、不领取旧收益', async () => {
    const platform = new EditorMockPlatform(storage);
    let facade = await GameFacade.bootstrap(platform, cfg);
    await completeOnboarding(facade);
    const oldRunId = facade.getState().runId;
    const token = facade.beginCloseCompany(9000);
    await facade.confirmCloseCompany(token, 9000);

    // 杀进程后重新启动
    facade = await GameFacade.bootstrap(new EditorMockPlatform(storage), cfg);
    const loaded = facade.getState();
    expect(loaded.runId).not.toBe(oldRunId);
    expect(loaded.phase).toBe('CREATING');
    expect(loaded.company).toBeNull();

    // 旧槽位不应再含旧 run 信封
    const a = storage.peekRaw(SAVE_KEYS.slotA) as SaveEnvelope | null;
    const b = storage.peekRaw(SAVE_KEYS.slotB) as SaveEnvelope | null;
    expect([a?.runId, b?.runId].includes(oldRunId)).toBe(false);
  });

  it('B03: 墓碑写成功但清理旧槽失败时，重启仍不恢复旧 run（墓碑阻断）', async () => {
    // 用自定义存储：墓碑正常写，删除槽位失败
    const partialFailStorage = new MemoryStorage();
    const origRemove = partialFailStorage.remove.bind(partialFailStorage);
    partialFailStorage.remove = async (key: string) => {
      if (key === SAVE_KEYS.slotA || key === SAVE_KEYS.slotB) {
        throw new Error('cleanup failed');
      }
      return origRemove(key);
    };
    const platform2 = new EditorMockPlatform(partialFailStorage);
    const facade = await GameFacade.bootstrap(platform2, cfg);
    await completeOnboarding(facade);
    const oldRunId = facade.getState().runId;
    const token = facade.beginCloseCompany(10000);
    // replaceWithNewRun 清理旧槽时可能抛错；墓碑已先写成功
    await expect(facade.confirmCloseCompany(token, 10000)).resolves.toBeDefined();

    // 即便旧槽物理残留，带墓碑重新加载也必须被屏蔽
    const reopened = await GameFacade.bootstrap(new EditorMockPlatform(partialFailStorage), cfg);
    expect(reopened.getState().runId).not.toBe(oldRunId);
    expect(reopened.getState().company).toBeNull();
  });

  it('确认 token 过期（>60s）返回 CONFIRMATION_EXPIRED', async () => {
    const { facade } = await freshFacade();
    await completeOnboarding(facade);
    const token = facade.beginCloseCompany(1000);
    const result = await facade.confirmCloseCompany(token, 1000 + 61_000);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('CONFIRMATION_EXPIRED');
    expect(facade.getState().company).not.toBeNull();
  });
});

describe('持久化往返（B11 中断恢复）', () => {
  it('首聘 1/2 杀进程重启后精确恢复到 1/2，不重注资', async () => {
    const storage = new MemoryStorage();
    const platform = new EditorMockPlatform(storage);
    let facade = await GameFacade.bootstrap(platform, cfg);
    const s0 = facade.getState();
    await facade.createCompany(
      { companyName: '中断公司', industry: 'TRADE', ceoName: '王五', ceoTrait: 'PEOPLE' },
      { commandId: 'c', expectedRunId: s0.runId },
    );
    const s1 = facade.getState();
    const deptId = s1.departments[0]!.deptId;
    const offer = facade.getOffer(deptId);
    await facade.hireEmployee(
      { offerId: offer.offerId, candidateId: offer.candidates[0]!.candidateId, departmentId: deptId },
      { commandId: 'h1', expectedRunId: s1.runId },
    );

    // 重启
    facade = await GameFacade.bootstrap(new EditorMockPlatform(storage), cfg);
    const restored = facade.getState();
    expect(restored.phase).toBe('HIRING_INITIAL');
    expect(restored.onboarding.initialHiresCompleted).toBe(1);
    expect(restored.employees).toHaveLength(1);
    expect(restored.company?.paidInCapitalYuan).toBe(300_000);
    expect(restored.company?.cashYuan).toBe(300_000 - offer.candidates[0]!.salaryMonthlyYuan);
  });

  it('GameStore 直接集成：完整流程后加载 revision 单调递增', async () => {
    const storage = new MemoryStorage();
    const state = createInitialState(1000, 5);
    const store = new GameStore(storage, state, { revision: 0, resetGeneration: 0 });
    await store.mutate(
      (d) =>
        createCompany(
          d,
          { companyName: '甲方服务公司', industry: 'SERVICE', ceoName: '赵', ceoTrait: 'STEADY' },
          { commandId: 'c', expectedRunId: d.runId },
        ),
      state.runId,
    );
    expect(store.currentRevision).toBe(1);
    const reloaded = await GameStore.load(storage);
    expect(reloaded?.currentRevision).toBe(1);
    expect(reloaded?.current.company?.industry).toBe('SERVICE');
  });

  it('startOperating 幂等：重复命令不报错', async () => {
    const { facade } = await freshFacade();
    await completeOnboarding(facade);
    const runId = facade.getState().runId;
    const r1 = await facade.startOperating({ commandId: 'go', expectedRunId: runId });
    const r2 = await facade.startOperating({ commandId: 'go', expectedRunId: runId });
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    expect(facade.getState().speed).toBe(1);
  });
});
