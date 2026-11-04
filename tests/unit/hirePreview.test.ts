/**
 * R26：招聘预览与收费确认（领域层：真实费用、取消零变更、offer 失效）。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { GameFacade } from '@core/application/GameFacade';
import { registerConfig } from '@core/config/configLoader';
import type { EconomyConfig } from '@core/config/EconomyConfig';
import economyJson from '../../assets/resources/config/economy.v1.json';
import { EditorMockPlatform } from '../helpers/EditorMockPlatform';
import { SaveRepository } from '@core/persistence/SaveRepository';
import { getOffer } from '@core/application/OfferService';
import { createInitialState } from '@core/domain/gameStateFactory';
import { createCompany } from '@core/application/CompanyService';
import type { GameState } from '@core/domain/types';
import { beginAdSession, grantAdCoupon } from '@core/application/AdRewardService';

const cfg = registerConfig(economyJson as unknown as EconomyConfig);
let facade: GameFacade;
let runId: string;

async function facadeFor(state: GameState, revision = 1): Promise<GameFacade> {
  const platform = new EditorMockPlatform();
  await new SaveRepository(platform).commit(state, { revision, resetGeneration: 0, expectedBase: null });
  return GameFacade.bootstrap(platform, cfg);
}

function runningCompany(seed: number, cash = 300_000): GameState {
  const s = createInitialState(1000, seed);
  createCompany(
    s,
    { companyName: '预览测试有限公司', industry: 'SOFTWARE', ceoName: '张 CEO', ceoTrait: 'BOLD' },
    { commandId: `cc-${seed}`, expectedRunId: s.runId },
  );
  s.phase = 'RUNNING';
  s.speed = 1;
  s.onboarding.initialHiresCompleted = 2;
  if (cash !== 300_000 && s.company) s.company.cashYuan = cash;
  return s;
}

beforeEach(async () => {
  facade = await facadeFor(runningCompany(9001));
  runId = facade.getState().runId;
});

describe('R26 previewHire', () => {
  it('T02 预览显示真实招聘费=1 月工资、现金前后余额，且不改状态', () => {
    const offer = facade.getOffer(facade.getState().departments[0]!.deptId);
    const cand = offer.candidates[0]!;
    const cashBefore = facade.getState().company!.cashYuan;
    const employeesBefore = facade.getState().employees.length;

    const r = facade.previewHire({
      offerId: offer.offerId,
      candidateId: cand.candidateId,
      departmentId: facade.getState().departments[0]!.deptId,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.payload.feeYuan).toBe(cand.salaryMonthlyYuan);
    expect(r.payload.cashBeforeYuan).toBe(cashBefore);
    expect(r.payload.cashAfterYuan).toBe(cashBefore - cand.salaryMonthlyYuan);
    expect(r.payload.affordable).toBe(true);
    expect(r.payload.effectiveFromMonthIndex).toBe(1); // 运营期次月生效
    // 预览无写入
    expect(facade.getState().company!.cashYuan).toBe(cashBefore);
    expect(facade.getState().employees.length).toBe(employeesBefore);
    expect(facade.getRevision()).toBe(1);
  });

  it('余额不足：affordable=false（实际录用 INSUFFICIENT_CASH 由既有招聘测试覆盖）', async () => {
    facade = await facadeFor(runningCompany(9002, 10));
    const offer = facade.getOffer(facade.getState().departments[0]!.deptId);
    const cand = offer.candidates[0]!;
    const pv = facade.previewHire({
      offerId: offer.offerId,
      candidateId: cand.candidateId,
      departmentId: facade.getState().departments[0]!.deptId,
    });
    expect(pv.ok && pv.payload.affordable).toBe(false);
  });

  it('T01 取消预览不产生业务写入（只调用 preview，revision 不变）', () => {
    const offer = facade.getOffer(facade.getState().departments[0]!.deptId);
    facade.previewHire({
      offerId: offer.offerId,
      candidateId: offer.candidates[0]!.candidateId,
      departmentId: facade.getState().departments[0]!.deptId,
    });
    facade.previewHire({
      offerId: offer.offerId,
      candidateId: offer.candidates[1]!.candidateId,
      departmentId: facade.getState().departments[0]!.deptId,
    });
    expect(facade.getRevision()).toBe(1);
  });

  it('T04 offer 过期（刷新后旧 offerId）返回 OFFER_EXPIRED', async () => {
    const old = getOffer(facade.getState(), facade.getState().departments[0]!.deptId);
    const oldId = old.offerId;
    const cand = old.candidates[0]!;
    await facade.refreshOffer(facade.getState().departments[0]!.deptId, { commandId: 'refresh-1', expectedRunId: runId });
    const r = facade.previewHire({
      offerId: oldId,
      candidateId: cand.candidateId,
      departmentId: facade.getState().departments[0]!.deptId,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('OFFER_EXPIRED');
  });

  it('T06 同一 commandId 录用重试只扣一次费用（幂等）', async () => {
    const offer = facade.getOffer(facade.getState().departments[0]!.deptId);
    const cand = offer.candidates[0]!;
    const input = { offerId: offer.offerId, candidateId: cand.candidateId, departmentId: facade.getState().departments[0]!.deptId };
    const cashBefore = facade.getState().company!.cashYuan;
    const first = await facade.hireEmployee(input, { commandId: 'hire-same', expectedRunId: runId });
    expect(first.ok).toBe(true);
    const cashAfterFirst = facade.getState().company!.cashYuan;
    expect(cashAfterFirst).toBe(cashBefore - cand.salaryMonthlyYuan);
    const second = await facade.hireEmployee(input, { commandId: 'hire-same', expectedRunId: runId });
    expect(second.ok).toBe(true);
    expect(facade.getState().company!.cashYuan).toBe(cashAfterFirst);
    expect(facade.getState().employees.filter((e) => e.hireCommandId === 'hire-same')).toHaveLength(1);
  });

  it('广告券仅免一次招聘费、保留月薪并同事务消费，且运营期下月生效', async () => {
    const now = new Date(2026, 10, 3, 12).getTime();
    const state = runningCompany(9003);
    expect(beginAdSession(state, 'reward-session', now)).toBe(true);
    expect(grantAdCoupon(state, 'reward-session', now)).toBe(true);
    facade = await facadeFor(state);
    runId = facade.getState().runId;
    const deptId = facade.getState().departments[0]!.deptId;
    const offer = facade.getOffer(deptId);
    const candidate = offer.candidates[0]!;
    const preview = facade.previewHire({ offerId: offer.offerId, candidateId: candidate.candidateId, departmentId: deptId, couponId: 'reward-session' });
    expect(preview.ok && preview.payload.feeYuan).toBe(0);
    const cashBefore = facade.getState().company!.cashYuan;
    const hired = await facade.hireEmployee({ offerId: offer.offerId, candidateId: candidate.candidateId, departmentId: deptId, couponId: 'reward-session' }, { commandId: 'coupon-hire', expectedRunId: runId });
    expect(hired.ok).toBe(true);
    expect(facade.getState().company!.cashYuan).toBe(cashBefore);
    const couponHire = facade.getState().employees[facade.getState().employees.length - 1]!;
    expect(couponHire.salaryMonthlyYuan).toBe(candidate.salaryMonthlyYuan);
    expect(couponHire.effectiveFromMonthIndex).toBe(1);
    expect(facade.getState().adRewards?.couponIds).not.toContain('reward-session');
    const retry = await facade.hireEmployee({ offerId: offer.offerId, candidateId: candidate.candidateId, departmentId: deptId, couponId: 'reward-session' }, { commandId: 'coupon-hire', expectedRunId: runId });
    expect(retry.ok).toBe(true);
    expect(facade.getState().company!.cashYuan).toBe(cashBefore);
    expect(facade.getState().employees.filter((e) => e.hireCommandId === 'coupon-hire')).toHaveLength(1);
  });
});

