import { describe, it, expect } from 'vitest';
import { createInitialState } from '@core/domain/gameStateFactory';
import { createCompany } from '@core/application/CompanyService';
import { getOffer, refreshOffer } from '@core/application/OfferService';
import { hireEmployee, startOperating } from '@core/application/RecruitmentService';
import { generateCandidates } from '@core/domain/CandidateGenerator';
import type { GameState } from '@core/domain/types';
import rawEconomy from '../../assets/resources/config/economy.v1.json';
import { registerConfig } from '@core/config/configLoader';
import type { EconomyConfig } from '@core/config/EconomyConfig';

const cfg = registerConfig(rawEconomy as never) as EconomyConfig;

function seededCompany(seed = 7): GameState {
  const state = createInitialState(1000, seed);
  createCompany(
    state,
    { companyName: '测试贸易公司', industry: 'TRADE', ceoName: '林启航', ceoTrait: 'BOLD' },
    { commandId: 'create-1', expectedRunId: state.runId },
  );
  return state;
}

describe('候选人生成', () => {
  it('固定输入生成稳定3候选且覆盖A/B/C三倾向', () => {
    const c1 = generateCandidates({ runSeed: 7, deptId: 'd1', offerSequence: 0 });
    const c2 = generateCandidates({ runSeed: 7, deptId: 'd1', offerSequence: 0 });
    expect(c1.map((c) => c.candidateId)).toEqual(c2.map((c) => c.candidateId));
    expect(c1.map((c) => c.archetype).sort()).toEqual(['A', 'B', 'C']);
    for (const c of c1) {
      expect(c.salaryMonthlyYuan).toBeGreaterThanOrEqual(4000);
      expect(c.salaryMonthlyYuan).toBeLessThanOrEqual(8000);
      expect(c.skill).toBeGreaterThanOrEqual(45);
      expect(c.skill).toBeLessThanOrEqual(90);
    }
  });

  it('刷新 offerSequence 产生不同候选（旧 Offer 失效）', () => {
    const state = seededCompany();
    const deptId = state.departments[0]!.deptId;
    const o1 = getOffer(state, deptId);
    const o2 = refreshOffer(state, deptId);
    expect(o2.offerId).not.toBe(o1.offerId);
    expect(o2.offerSequence).toBeGreaterThan(o1.offerSequence);
  });
});

describe('首聘两人（G006 / 12.4 / 12.9）', () => {
  it('首聘两人招聘费即时扣款，现金 300000→290000，进入 TUTORIAL_DASHBOARD', () => {
    const state = seededCompany();
    const deptId = state.departments[0]!.deptId;
    const offer = getOffer(state, deptId);

    const c1 = offer.candidates[0]!;
    const r1 = hireEmployee(
      state,
      cfg,
      { offerId: offer.offerId, candidateId: c1.candidateId, departmentId: deptId },
      { commandId: 'hire-1', expectedRunId: state.runId },
    );
    expect(r1.feePaidYuan).toBe(c1.salaryMonthlyYuan);
    expect(state.company!.cashYuan).toBe(300_000 - c1.salaryMonthlyYuan);
    expect(state.onboarding.initialHiresCompleted).toBe(1);
    expect(state.phase).toBe('HIRING_INITIAL');

    const offer2 = getOffer(state, deptId);
    const c2 = offer2.candidates[1]!;
    const r2 = hireEmployee(
      state,
      cfg,
      { offerId: offer2.offerId, candidateId: c2.candidateId, departmentId: deptId },
      { commandId: 'hire-2', expectedRunId: state.runId },
    );
    expect(state.company!.cashYuan).toBe(300_000 - c1.salaryMonthlyYuan - c2.salaryMonthlyYuan);
    expect(r2.firstHire).toBe(false);
    expect(state.phase).toBe('TUTORIAL_DASHBOARD');
    expect(state.employees).toHaveLength(2);
    // 首聘员工首月（index 0）即生效
    expect(state.employees.every((e) => e.effectiveFromMonthIndex === 0)).toBe(true);
    // 招聘费记入第 1 月 pendingEntries
    const fees = state.pendingEntries.filter((e) => e.category === 'RECRUITMENT');
    expect(fees).toHaveLength(2);
    expect(fees.reduce((s, e) => s + e.amountYuan, 0)).toBe(
      -(c1.salaryMonthlyYuan + c2.salaryMonthlyYuan),
    );

    // 开始经营后 speed=1, phase=RUNNING
    startOperating(state, { commandId: 'start-1', expectedRunId: state.runId });
    expect(state.phase).toBe('RUNNING');
    expect(state.speed).toBe(1);
  });

  it('G006: 两名各 5000 月薪 → 首聘完现金 290000，年度招聘费合计 10000', () => {
    const state = seededCompany(123);
    const deptId = state.departments[0]!.deptId;
    // 测试夹具：注入两名确定的 5000 薪资候选（黄金用例要求固定输入）
    const offer = getOffer(state, deptId);
    const mk = (id: string, name: string) => ({
      candidateId: id,
      name,
      avatarId: 'avatar_01',
      skill: 60,
      potential: 60,
      teamwork: 50,
      personality: 'STEADY' as const,
      salaryMonthlyYuan: 5000,
      archetype: 'C' as const,
    });
    offer.candidates = [mk('fixed-c1', '张甲'), mk('fixed-c2', '李乙'), mk('fixed-c3', '王丙')];

    hireEmployee(
      state,
      cfg,
      { offerId: offer.offerId, candidateId: 'fixed-c1', departmentId: deptId },
      { commandId: 'g6-1', expectedRunId: state.runId },
    );
    hireEmployee(
      state,
      cfg,
      { offerId: offer.offerId, candidateId: 'fixed-c2', departmentId: deptId },
      { commandId: 'g6-2', expectedRunId: state.runId },
    );
    expect(state.company!.cashYuan).toBe(290_000);
    const totalFee = state.pendingEntries
      .filter((e) => e.category === 'RECRUITMENT')
      .reduce((s, e) => s + Math.abs(e.amountYuan), 0);
    expect(totalFee).toBe(10_000);
    // 两笔招聘费都已支付（月结不可再扣现金）
    expect(state.pendingEntries.every((e) => e.alreadyPaid)).toBe(true);
  });

  it('B04: 同一 commandId 连点多次只扣一次招聘费', () => {
    const state = seededCompany(999);
    const deptId = state.departments[0]!.deptId;
    const offer = getOffer(state, deptId);
    const c = offer.candidates[0]!;
    const input = { offerId: offer.offerId, candidateId: c.candidateId, departmentId: deptId };
    hireEmployee(state, cfg, input, { commandId: 'dup', expectedRunId: state.runId });
    const cashAfterFirst = state.company!.cashYuan;
    for (let i = 0; i < 9; i++) {
      hireEmployee(state, cfg, input, { commandId: 'dup', expectedRunId: state.runId });
    }
    expect(state.company!.cashYuan).toBe(cashAfterFirst);
    expect(state.employees).toHaveLength(1);
  });

  it('刷新后用旧 offer 提交返回 OFFER_EXPIRED', () => {
    const state = seededCompany(888);
    const deptId = state.departments[0]!.deptId;
    const old = getOffer(state, deptId);
    refreshOffer(state, deptId);
    const c = old.candidates[0]!;
    expect(() =>
      hireEmployee(
        state,
        cfg,
        { offerId: old.offerId, candidateId: c.candidateId, departmentId: deptId },
        { commandId: 'x', expectedRunId: state.runId },
      ),
    ).toThrow(/OFFER_EXPIRED/);
    expect(state.employees).toHaveLength(0);
  });

  it('B11: 首聘 1/2 中断后恢复，不重注资、不重刷已录用候选', () => {
    const state = seededCompany(555);
    const deptId = state.departments[0]!.deptId;
    const offer = getOffer(state, deptId);
    const c1 = offer.candidates[0]!;
    hireEmployee(
      state,
      cfg,
      { offerId: offer.offerId, candidateId: c1.candidateId, departmentId: deptId },
      { commandId: 'h1', expectedRunId: state.runId },
    );
    // 模拟杀进程后从存档恢复：phase 仍 HIRING_INITIAL，已录用 1 人，资金未重发
    expect(state.phase).toBe('HIRING_INITIAL');
    expect(state.onboarding.initialHiresCompleted).toBe(1);
    expect(state.initializedCapital).toBe(true);
    expect(state.company!.paidInCapitalYuan).toBe(300_000);
    // 不能开始经营（未满 2 人）
    expect(() =>
      startOperating(state, { commandId: 's', expectedRunId: state.runId }),
    ).toThrow(/ONBOARDING_INCOMPLETE/);
    // 已录用候选不能再被录用
    expect(() =>
      hireEmployee(
        state,
        cfg,
        { offerId: offer.offerId, candidateId: c1.candidateId, departmentId: deptId },
        { commandId: 'h2-new', expectedRunId: state.runId },
      ),
    ).toThrow(/OFFER_EXPIRED/);
  });

  it('现金不足支付招聘费时拒绝（极端薪资下保护）', () => {
    const state = seededCompany(321);
    state.company!.cashYuan = 100;
    const deptId = state.departments[0]!.deptId;
    const offer = getOffer(state, deptId);
    const c = offer.candidates[0]!;
    expect(() =>
      hireEmployee(
        state,
        cfg,
        { offerId: offer.offerId, candidateId: c.candidateId, departmentId: deptId },
        { commandId: 'poor', expectedRunId: state.runId },
      ),
    ).toThrow(/INSUFFICIENT_CASH/);
    expect(state.employees).toHaveLength(0);
  });
});
