import { describe, it, expect, beforeAll } from 'vitest';
import { EditorMockPlatform } from '../helpers/EditorMockPlatform';
import { MemoryStorage } from '../helpers/MemoryStorage';
import { GameFacade } from '@core/application/GameFacade';
import rawEconomy from '../../assets/resources/config/economy.v1.json';
import { registerConfig } from '@core/config/configLoader';
import type { EconomyConfig } from '@core/config/EconomyConfig';

let cfg: EconomyConfig;
beforeAll(() => {
  cfg = registerConfig(rawEconomy as never);
});

async function fresh(): Promise<{ facade: GameFacade; storage: MemoryStorage }> {
  const storage = new MemoryStorage();
  const facade = await GameFacade.bootstrap(new EditorMockPlatform(storage), cfg);
  return { facade, storage };
}

/** 创建公司 → 首聘 2 人 → 开始经营（进入 RUNNING 且 speed=1）。 */
async function operating(facade: GameFacade): Promise<void> {
  const s0 = facade.getState();
  const created = await facade.createCompany(
    { companyName: '首页测试公司', industry: 'TRADE', ceoName: '林启航', ceoTrait: 'BOLD' },
    { commandId: 'create-1', expectedRunId: s0.runId },
  );
  expect(created.ok).toBe(true);
  let s = facade.getState();
  const deptId = s.departments[0]!.deptId;
  for (let i = 0; i < 2; i += 1) {
    const offer = facade.getOffer(deptId);
    const candidate = offer.candidates.find(
      (c) => !s.employees.some((e) => e.candidateId === c.candidateId),
    )!;
    const hired = await facade.hireEmployee(
      { offerId: offer.offerId, candidateId: candidate.candidateId, departmentId: deptId },
      { commandId: `hire-${i}`, expectedRunId: s.runId },
    );
    expect(hired.ok).toBe(true);
    s = facade.getState();
  }
  const started = await facade.startOperating({ commandId: 'start-1', expectedRunId: s.runId });
  expect(started.ok).toBe(true);
}

describe('R28 T02 时间控制持久化', () => {
  it('1×/2×/5×/暂停都写入并随存档恢复', async () => {
    const { facade, storage } = await fresh();
    await operating(facade);
    for (const speed of [5, 2, 1, 0] as const) {
      const s = facade.getState();
      const r = await facade.setSpeed(speed, { commandId: `speed-${speed}`, expectedRunId: s.runId });
      expect(r.ok).toBe(true);
      expect(facade.getState().speed).toBe(speed);
    }
    // 最后一次是暂停(0)，强杀重载后仍保持 0
    const reloaded = await GameFacade.bootstrap(new EditorMockPlatform(storage), cfg);
    expect(reloaded.getState().speed).toBe(0);
    expect(reloaded.getState().phase).toBe('RUNNING');
  });
});

describe('R28 T02 月结后命令仍可继续（回归：可选字段不得写入 undefined）', () => {
  it('5× 首次月结后 setSpeed/advanceRealTime 仍成功并可暂停', async () => {
    const { facade } = await fresh();
    await operating(facade);
    const s = facade.getState();
    const to5 = await facade.setSpeed(5, { commandId: 'sp-5', expectedRunId: s.runId });
    expect(to5.ok).toBe(true);
    expect(facade.getState().speed).toBe(5);

    // 5× 下 5000ms = 1 个月；月结会写自动化日志（曾写入 undefined 导致后续命令全部 NOT_READY）
    const tick = await facade.advanceRealTime(5000, facade.getState().runId);
    expect(tick.ok).toBe(true);
    expect(tick.ok && tick.payload.monthsAdvanced).toBe(1);
    expect(facade.getState().monthlyLedgersRolling).toHaveLength(1);

    const after = facade.getState();
    const pause = await facade.setSpeed(0, { commandId: 'sp-0', expectedRunId: after.runId });
    expect(pause.ok).toBe(true);
    expect(facade.getState().speed).toBe(0);

    // 暂停后推进不跳月，且命令仍可继续
    const frozen = await facade.advanceRealTime(60000, facade.getState().runId);
    expect(frozen.ok).toBe(true);
    expect(frozen.ok && frozen.payload.monthsAdvanced).toBe(0);
    expect(facade.getState().monthlyLedgersRolling).toHaveLength(1);
  });
});

describe('R28 T03 扩产事务与首页 VM', () => {
  it('首页 VM 来自领域：现金、累计收支、产能与需求一致', async () => {
    const { facade } = await fresh();
    await operating(facade);
    const vm = facade.getCompanyOverview();
    expect(vm).not.toBeNull();
    expect(vm!.cashYuan).toBe(facade.getState().company!.cashYuan);
    expect(vm!.ytdRevenueYuan).toBe(0);
    expect(vm!.monthlyCapacityYuan).toBeGreaterThan(0);
    expect(vm!.monthlyPotentialOrderYuan).toBe(60_000);
  });

  it('取消（仅预览）不扣款；确认后现金−投资、资产+投资、总资产不变', async () => {
    const { facade } = await fresh();
    await operating(facade);
    const s = facade.getState();
    const cashBefore = s.company!.cashYuan;
    const assetBefore = s.company!.businessAssetBookYuan;
    // 预览等价于“打开确认框但取消”：状态零变更
    const pv = facade.previewInvest(10_000);
    expect(pv.ok).toBe(true);
    expect(facade.getState().company!.cashYuan).toBe(cashBefore);
    expect(facade.getState().company!.businessAssetBookYuan).toBe(assetBefore);

    const r = await facade.invest(10_000, { commandId: 'invest-1', expectedRunId: s.runId });
    expect(r.ok).toBe(true);
    const after = facade.getState();
    expect(after.company!.cashYuan).toBe(cashBefore - 10_000);
    expect(after.company!.businessAssetBookYuan).toBe(assetBefore + 10_000);
    expect(after.company!.cashYuan + after.company!.businessAssetBookYuan).toBe(
      cashBefore + assetBefore,
    );
    // 同一 commandId 连点只扣一次
    const again = await facade.invest(10_000, { commandId: 'invest-1', expectedRunId: s.runId });
    expect(again.ok).toBe(true);
    expect(facade.getState().company!.cashYuan).toBe(cashBefore - 10_000);
  });

  it('扩产预览含闲置风险与余额（需求低于产能时提示）', async () => {
    const { facade } = await fresh();
    await operating(facade);
    const pv = facade.previewInvest(10_000);
    expect(pv.ok).toBe(true);
    if (!pv.ok) return;
    const p = pv.payload;
    expect(p.cashAfter).toBe(facade.getState().company!.cashYuan - 10_000);
    expect(p.monthlyPotentialOrderYuan).toBe(60_000);
    expect(p.idleRiskAfter).toBe(p.monthlyCapacityAfterYuan > p.monthlyPotentialOrderYuan);
    expect(p.valid).toBe(true);
  });
});

describe('R32 年报现金桥', () => {
  it('资本投资单独记入现金桥并与期初/期末现金精确相等', async () => {
    const { facade, storage } = await fresh();
    await operating(facade);
    const runId = facade.getState().runId;
    const speed = await facade.setSpeed(5, { commandId: 'r32-speed', expectedRunId: runId });
    expect(speed.ok).toBe(true);
    const investment = await facade.invest(10_000, { commandId: 'r32-invest', expectedRunId: runId });
    expect(investment.ok).toBe(true);
    for (let month = 0; month < 12; month += 1) {
      const tick = await facade.advanceRealTime(5_000, runId);
      expect(tick.ok).toBe(true);
    }
    const report = facade.getAnnualReport(1)!;
    const bridge = report.cashBridge!;
    expect(report.settled).toBe(true);
    expect(bridge.investmentCashFlowYuan).toBe(-10_000);
    expect(bridge.rescueCapitalYuan).toBe(0);
    expect(bridge.attributionComplete).toBe(true);
    expect(bridge.balanced).toBe(true);
    expect(
      report.cashOpenYuan + bridge.monthlyLedgerNetCashDeltaYuan + bridge.investmentCashFlowYuan +
        bridge.rescueCapitalYuan + bridge.unattributedCashFlowYuan,
    ).toBe(report.cashCloseYuan);

    const pointer = storage.peekRaw('ceo/save/active') as { slot: 'a' | 'b'; revision: number };
    const envelope = storage.peekRaw(`ceo/save/${pointer.slot}`) as {
      revision: number;
      payload: { monthlyLedgersRolling: unknown[]; annualReports: Array<{ year: number }> };
    };
    expect(envelope.revision).toBe(pointer.revision);
    expect(envelope.payload.monthlyLedgersRolling.length).toBeGreaterThanOrEqual(12);
    expect(envelope.payload.annualReports.find((item: { year: number }) => item.year === 1)).toEqual(report);
    expect(storage.peekRaw('ceo/save/transaction')).toBeNull();

    const reloaded = await GameFacade.bootstrap(new EditorMockPlatform(storage), cfg);
    expect(reloaded.getAnnualReport(1)).toEqual(report);
    expect(reloaded.getState().company!.cashYuan).toBe(report.cashCloseYuan);
  });
});
