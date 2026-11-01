/**
 * 百种子 5 年批量模拟（设计 9.6 / M3-06）。
 * 纯 Node/TS 运行（不经 Cocos），对确定种子、三行业、三策略各跑 60 个月，
 * 检查财务守恒与安全不变量，并产出 CSV 行（seed/industry/policy/profit/cash/assets/...）。
 *
 * 用法：npx tsx tools/simulate5year.ts（或经 vitest 断言，见 tests/simulation/simulate5year.test.ts）
 */
import rawEconomy from '../assets/resources/config/economy.v1.json';
import { registerConfig } from '../assets/core/config/configLoader';
import type { EconomyConfig } from '../assets/core/config/EconomyConfig';
import { createInitialState } from '../assets/core/domain/gameStateFactory';
import { createCompany } from '../assets/core/application/CompanyService';
import { hireEmployee, startOperating } from '../assets/core/application/RecruitmentService';
import { getOffer } from '../assets/core/application/OfferService';
import { advanceMonth } from '../assets/core/simulation/advanceMonth';
import { runMonthlyAutoHire } from '../assets/core/application/AutoHireService';
import type { GameState, IndustryId, Policy } from '../assets/core/domain/types';

const cfg = registerConfig(rawEconomy as never) as EconomyConfig;

export interface SimRow {
  seed: number;
  industry: IndustryId;
  policy: Policy;
  years: number;
  finalProfitYear: number;
  cashEnd: number;
  assetsEnd: number;
  headcountEnd: number;
  deptCount: number;
  events: number;
  autoHires: number;
  rescueUsed: boolean;
  cashNeverNegative: boolean;
  conservationHeld: boolean;
}

function freshRun(seed: number, industry: IndustryId, policy: Policy): GameState {
  const state = createInitialState(1_000, seed);
  createCompany(
    state,
    { companyName: `模拟${seed}`, industry, ceoName: '林启航', ceoTrait: 'BOLD' },
    { commandId: 'create', expectedRunId: state.runId },
  );
  state.policy = policy;
  const deptId = state.departments[0]!.deptId;
  const offer = getOffer(state, deptId);
  // 录用两名候选（固定首聘流程）
    hireEmployee(state, cfg, { offerId: offer.offerId, candidateId: offer.candidates[0]!.candidateId, departmentId: deptId }, { commandId: 'h1', expectedRunId: state.runId });
    const o2 = getOffer(state, deptId);
    hireEmployee(state, cfg, { offerId: o2.offerId, candidateId: o2.candidates[1]!.candidateId, departmentId: deptId }, { commandId: 'h2', expectedRunId: state.runId });
  startOperating(state, { commandId: 'start', expectedRunId: state.runId });
  return state;
}

/** 跑 60 个月（含自动招聘钩子，模拟真实时钟）。 */
export function simulate(seed: number, industry: IndustryId, policy: Policy): SimRow {
  const state = freshRun(seed, industry, policy);
  let cashNeverNegative = true;
  let conservationHeld = true;

  for (let m = 0; m < 60; m++) {
    // 每月先做自动招聘决策（与 GameClock.beforeMonthSettle 一致）
    runMonthlyAutoHire(state, cfg);
    const cashBefore = state.company!.cashYuan;
    const yearBefore = state.gameYear;
    advanceMonth(state, cfg);
    if (state.company!.cashYuan < 0) cashNeverNegative = false;

    // 财务守恒抽查：年末 年利润 = 12 个月利润之和（rolling 仅留24月，只校验最近可取年）
    if (state.gameYear > yearBefore) {
      const y = yearBefore;
      const ledgers = state.monthlyLedgersRolling.filter((l) => l.runId === state.runId && l.year === y);
      if (ledgers.length === 12) {
        const sumProfit = ledgers.reduce((s, l) => s + l.profitYuan, 0);
        const report = state.annualReports.find((r) => r.year === y);
        if (report && sumProfit !== report.profitYuan) conservationHeld = false;
      }
    }
    void cashBefore;
  }

  const lastReport = state.annualReports[state.annualReports.length - 1];
  const autoHires = Object.values(state.autoHireCountByYear).reduce((s, v) => s + v, 0);

  return {
    seed,
    industry,
    policy,
    years: state.gameYear - 1,
    finalProfitYear: lastReport?.profitYuan ?? 0,
    cashEnd: state.company!.cashYuan,
    assetsEnd: state.company!.cashYuan + state.company!.businessAssetBookYuan,
    headcountEnd: state.employees.filter((e) => e.status === 'ACTIVE').length,
    deptCount: state.departments.length,
    events: state.annualEvents.filter((e) => e.happened).length,
    autoHires,
    rescueUsed: state.rescueCapitalUsed,
    cashNeverNegative,
    conservationHeld,
  };
}

/** 运行 N 个种子 × 三行业 × 三策略，返回所有行。 */
export function simulateBatch(seedCount: number): SimRow[] {
  const industries: IndustryId[] = ['TRADE', 'SOFTWARE', 'SERVICE'];
  const policies: Policy[] = ['STEADY', 'GROWTH', 'PROFIT'];
  const rows: SimRow[] = [];
  for (let i = 1; i <= seedCount; i++) {
    for (const industry of industries) {
      for (const policy of policies) {
        rows.push(simulate(i * 7919 + industry.length, industry, policy));
      }
    }
  }
  return rows;
}

export function toCsv(rows: SimRow[]): string {
  const header = 'seed,industry,policy,years,finalProfitYear,cashEnd,assetsEnd,headcountEnd,deptCount,events,autoHires,rescueUsed,cashNeverNegative,conservationHeld';
  const body = rows
    .map((r) =>
      [
        r.seed, r.industry, r.policy, r.years, r.finalProfitYear, r.cashEnd, r.assetsEnd,
        r.headcountEnd, r.deptCount, r.events, r.autoHires, r.rescueUsed,
        r.cashNeverNegative, r.conservationHeld,
      ].join(','),
    )
    .join('\n');
  return `${header}\n${body}`;
}

/** 运行 100 种子 × 三行业 × 三策略并返回汇总（供测试/脚本调用）。 */
export function runHundredSeedBatch(): { rows: SimRow[]; csv: string } {
  const rows = simulateBatch(100);
  return { rows, csv: toCsv(rows) };
}

export function summarize(rows: SimRow[]) {
  return {
    runs: rows.length,
    negativeCash: rows.filter((r) => !r.cashNeverNegative).length,
    conservationFail: rows.filter((r) => !r.conservationHeld).length,
    rescueUsed: rows.filter((r) => r.rescueUsed).length,
    tooManyEvents: rows.filter((r) => r.events > 4).length,
    autoHireMax: Math.max(...rows.map((r) => r.autoHires)),
  };
}
