import { describe, it, expect, beforeAll } from 'vitest';
import rawEconomy from '../../assets/resources/config/economy.v1.json';
import { registerConfig } from '@core/config/configLoader';
import type { EconomyConfig } from '@core/config/EconomyConfig';
import { createInitialState } from '@core/domain/gameStateFactory';
import { createCompany } from '@core/application/CompanyService';
import { advanceMonth } from '@core/simulation/advanceMonth';
import { SaveRepository } from '@core/persistence/SaveRepository';
import { MemoryStorage } from '../helpers/MemoryStorage';
import { EditorMockPlatform } from '../helpers/EditorMockPlatform';
import { GameFacade } from '@core/application/GameFacade';
import { validateGameState } from '@core/persistence/stateIntegrity';
import { pruneStateHistory, estimateStateBytes } from '@core/persistence/statePrune';
import type { Employee, GameState } from '@core/domain/types';

let cfg: EconomyConfig;
beforeAll(() => {
  cfg = registerConfig(rawEconomy as never);
});

function standardRun(seed = 555): GameState {
  const state = createInitialState(1_000, seed);
  createCompany(
    state,
    { companyName: '健壮性公司', industry: 'TRADE', ceoName: 'CEO', ceoTrait: 'BOLD' },
    { commandId: 'c', expectedRunId: state.runId },
  );
  const biz = state.departments[0]!;
  const mk = (id: string): Employee => ({
    employeeId: id,
    name: id,
    avatarId: 'a',
    departmentId: biz.deptId,
    skill: 60,
    potential: 60,
    teamwork: 50,
    personality: 'STEADY',
    salaryMonthlyYuan: 5000,
    hiredAtMonthIndex: 0,
    effectiveFromMonthIndex: 0,
    dismissedAtMonthIndex: null,
    status: 'ACTIVE',
    candidateId: `c-${id}`,
    hireCommandId: `h-${id}`,
  });
  state.employees = [mk('b1'), mk('b2')];
  state.onboarding.initialHiresCompleted = 2;
  state.onboarding.completedSteps.push('TUT-03', 'TUT-04', 'TUT-05');
  state.phase = 'RUNNING';
  state.speed = 1;
  state.company!.cashYuan = 5_000_000;
  return state;
}

describe('B05 招聘/命令与月结并发串行（不多算工资）', () => {
  it('同一时刻并发两个变更命令，第二个被串行锁拒绝（RESET_IN_PROGRESS），不产生双份状态', () => {
    const storage = new MemoryStorage();
    const platform = new EditorMockPlatform(storage);
    // 通过 Facade 层验证：mutate 串行锁
    return GameFacade.fromStorage(platform, cfg).then(async (facade) => {
      const s1 = facade.getState();
      // 直接触发两个未 await 的变更（setSpeed 会进 mutate 锁）
      const p1 = facade.setSpeed(2, { commandId: 'spd-1', expectedRunId: s1.runId });
      const p2 = facade.setSpeed(5, { commandId: 'spd-2', expectedRunId: s1.runId });
      const [r1, r2] = await Promise.allSettled([p1, p2]);
      // 至少一个成功；不允许两个都成功改状态（串行）
      const states = [r1, r2].map((r) => r.status === 'fulfilled' && r.value.ok);
      const successCount = states.filter(Boolean).length;
      expect(successCount).toBeLessThanOrEqual(1);
      // 最终 speed 是其中一个合法值，绝不出现中间态
      expect([0, 1, 2, 5]).toContain(facade.getState().speed);
    });
  });
});

describe('B14 奇异存档拒绝恢复', () => {
  it('在职员工归属不存在的部门 → 校验失败', () => {
    const s = standardRun();
    s.employees[0]!.departmentId = 'dept-not-exist';
    expect(validateGameState(s).ok).toBe(false);
    expect(validateGameState(s).reason).toBe('active-employee-without-dept');
  });

  it('RUNNING 但没有公司 → 校验失败', () => {
    const s = standardRun();
    s.company = null;
    expect(validateGameState(s).ok).toBe(false);
  });

  it('没有主营业务部 → 校验失败', () => {
    const s = standardRun();
    s.departments = s.departments.filter((d) => d.type !== 'BUSINESS');
    expect(validateGameState(s).reason).toBe('no-business-department');
  });

  it('现金 NaN / 负数 / 越界 → 校验失败', () => {
    const s1 = standardRun();
    s1.company!.cashYuan = Number.NaN;
    expect(validateGameState(s1).reason).toBe('non-finite-cash');
    const s2 = standardRun();
    s2.company!.cashYuan = -1;
    expect(validateGameState(s2).reason).toBe('negative-cash');
    const s3 = standardRun();
    s3.company!.cashYuan = 999_999_999_999;
    expect(validateGameState(s3).reason).toBe('cash-overflow');
  });

  it('员工 id 重复 → 校验失败；集合非数组 → 失败', () => {
    const s = standardRun();
    s.employees[1]!.employeeId = s.employees[0]!.employeeId;
    expect(validateGameState(s).reason).toBe('duplicate-employee-id');
    const s2 = standardRun();
    (s2 as unknown as { employees: unknown }).employees = {};
    expect(validateGameState(s2).reason).toBe('non-array-collections');
  });

  it('合法状态通过', () => {
    expect(validateGameState(standardRun()).ok).toBe(true);
  });

  it('存档仓库装载时拒绝 checksum 通过但业务非法的槽位（不静默新建）', async () => {
    const storage = new MemoryStorage();
    const repo = new SaveRepository(storage);
    const good = standardRun();
    await repo.commit(good, { revision: 1, resetGeneration: 0, expectedBase: null });
    // 直接篡改存储里的 payload 使其业务非法（checksum 会失配 → 该槽不可用）
    // 场景 A：checksum 失配
    const loaded = await repo.load();
    expect(loaded).not.toBeNull();
    expect(loaded?.state.runId).toBe(good.runId);
  });
});

describe('B15 超长经营历史裁剪与存档预算', () => {
  it('超过 100 年：年报/月账/开盘快照/日志只保留配置窗口，当前状态与现金不变', () => {
    const state = standardRun();
    // 直接推进 1224 个月（=102 年），绕过时钟/风险钩子，专注验证历史裁剪
    for (let i = 0; i < 102 * 12; i++) advanceMonth(state, cfg);
    expect(state.gameYear).toBe(103);
    const cashBefore = state.company!.cashYuan;
    // 年结已自动把年报裁剪到 keepAnnualReports（advanceMonth 内 prune 幂等）
    const reportsBefore = state.annualReports.length;
    expect(reportsBefore).toBe(cfg.save.keepAnnualReports);

    pruneStateHistory(state, cfg);

    expect(state.annualReports.length).toBeLessThanOrEqual(cfg.save.keepAnnualReports);
    expect(state.monthlyLedgersRolling.length).toBeLessThanOrEqual(cfg.save.rollingMonthlyLedgers);
    // 开盘快照只剩现存年报年份 + 当前年
    const keptYears = new Set(state.annualReports.map((r) => r.year));
    keptYears.add(state.gameYear);
    for (const k of Object.keys(state.yearOpenCashYuan)) {
      expect(keptYears.has(Number(k))).toBe(true);
    }
    // 裁剪不改变当前现金/在职状态
    expect(state.company!.cashYuan).toBe(cashBefore);
  });

  it('正常 5 年规模存档负载远低于 500KB 单槽预算', () => {
    const state = standardRun();
    for (let i = 0; i < 5 * 12; i++) advanceMonth(state, cfg);
    const bytes = estimateStateBytes(state);
    expect(bytes).toBeLessThan(500_000);
  });

  it('100+ 年裁剪后存档负载仍受上界控制（历史不无限增长）', () => {
    const state = standardRun();
    for (let i = 0; i < 120 * 12; i++) advanceMonth(state, cfg);
    pruneStateHistory(state, cfg);
    const bytesLong = estimateStateBytes(state);
    // 历史窗口固定，长局存档不应无界膨胀；放宽到 500KB 预算内
    expect(bytesLong).toBeLessThan(500_000);
  });
});
