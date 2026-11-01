import { randomSeed } from '../simulation/rng';
import { newRunId } from './ids';
import type { GameState } from './types';

/**
 * 初始 run 状态工厂（设计文档 02.2 / 12.3）。
 * 新 run：CREATING、未注资、时钟暂停（speed=0）、无公司/CEO/员工/部门。
 * 启动资金只能由 createCompany 凭唯一 runId+INITIAL_CAPITAL 注入一次。
 */
export function createInitialState(nowEpochMs: number, seed?: number): GameState {
  const runSeed = seed ?? randomSeed();
  const runId = newRunId(runSeed, nowEpochMs);
  return {
    phase: 'CREATING',
    runId,
    seed: runSeed,
    rngCounter: 0,
    initializedCapital: false,
    gameYear: 1,
    gameMonth: 1,
    progressMsInMonth: 0,
    speed: 0,
    lastWallClockMs: nowEpochMs,
    lastSettledMonthKey: null,
    offlineRemainderMs: 0,
    onboarding: {
      stepId: 'TUT-01',
      completedSteps: [],
      skipped: false,
      lastKnownStep: 'TUT-01',
      tutorialVersion: 1,
      initialHiresCompleted: 0,
    },
    company: null,
    ceo: null,
    employees: [],
    departments: [],
    offers: [],
    policy: 'STEADY',
    monthlyLedgersRolling: [],
    annualReports: [],
    pendingEntries: [],
    eventHistory: [],
    botCompanies: [],
    consecutiveProfitableYears: 0,
    target3YearsAchieved: false,
    rescueCapitalUsed: false,
    cashRisk: 'NORMAL',
    autoHireCountByYear: {},
    automationLogs: [],
    yearOpenCashYuan: {},
    executedCommandIds: [],
  };
}

/** 创建重开后的全新 run（resetGeneration 由存档层维护）。 */
export function createFreshRunState(nowEpochMs: number): GameState {
  return createInitialState(nowEpochMs);
}
