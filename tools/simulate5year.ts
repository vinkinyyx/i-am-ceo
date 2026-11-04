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
function fnv1a64(text: string): string {
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(text)) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, '0');
}
const CONFIG_HASH = fnv1a64(JSON.stringify(rawEconomy));

export interface SimRow {
  seed: number;
  configHash: string;
  industry: IndustryId;
  policy: Policy;
  monthsSimulated: number;
  complete60Months: boolean;
  stopReason: string;
  years: number;
  finalProfitYear: number;
  cashEnd: number;
  assetsEnd: number;
  headcountEnd: number;
  deptCount: number;
  events: number;
  autoHires: number;
  autoHiresByYear: Record<string, number>;
  maxAutoHiresInMonth: number;
  annualCashBridgeIssue: { year: number; balanced: boolean; attributionComplete: boolean; unattributedCashFlowYuan: number } | null;
  rescueUsed: boolean;
  cashNeverNegative: boolean;
  conservationHeld: boolean;
  cashDeltaHeld: boolean;
  cashDeltaFailureCount: number;
  firstCashDeltaMismatch: { year: number; month: number; cashBefore: number; ledgerDelta: number; cashAfter: number } | null;
  annualCashBridgeHeld: boolean;
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
  let cashDeltaHeld = true;
  let cashDeltaFailureCount = 0;
  let firstCashDeltaMismatch: SimRow['firstCashDeltaMismatch'] = null;
  let annualCashBridgeHeld = true;
  let annualCashBridgeIssue: SimRow['annualCashBridgeIssue'] = null;
  let monthsSimulated = 0;
  const hiresByMonth = new Map<string, number>();

  for (let m = 0; m < 60; m++) {
    if (state.phase !== 'RUNNING') break;
    const cashBeforeMonth = state.company!.cashYuan;
    const hireTotalBefore = Object.values(state.autoHireCountByYear).reduce((s, v) => s + v, 0);
    const yearBefore = state.gameYear;
    const monthBefore = state.gameMonth;
    const currentMonthKey = `${state.runId}:${yearBefore}:${monthBefore}`;
    const prepaidBeforeMonthStart = state.pendingEntries
      .filter((entry) => entry.monthKey === currentMonthKey && entry.isCash && entry.alreadyPaid)
      .reduce((total, entry) => total + Math.abs(entry.amountYuan), 0);
    // 每月先做自动招聘决策（与 GameClock.beforeMonthSettle 一致）
    runMonthlyAutoHire(state, cfg);
    advanceMonth(state, cfg);
    monthsSimulated += 1;
    if (state.company!.cashYuan < 0) cashNeverNegative = false;
    const lastLedger = state.monthlyLedgersRolling[state.monthlyLedgersRolling.length - 1];
    if (!lastLedger || lastLedger.runId !== state.runId || lastLedger.year !== yearBefore || lastLedger.month !== monthBefore ||
        cashBeforeMonth + lastLedger.cashDeltaYuan + prepaidBeforeMonthStart !== state.company!.cashYuan) {
      cashDeltaHeld = false;
      cashDeltaFailureCount += 1;
      firstCashDeltaMismatch ??= {
        year: yearBefore, month: monthBefore, cashBefore: cashBeforeMonth,
        ledgerDelta: lastLedger?.cashDeltaYuan ?? NaN, cashAfter: state.company!.cashYuan,
      };
    }
    const hireTotalAfter = Object.values(state.autoHireCountByYear).reduce((s, v) => s + v, 0);
    hiresByMonth.set(`${yearBefore}:${monthBefore}`, hireTotalAfter - hireTotalBefore);

    // 每年冻结报表与12个月利润、现金桥逐项对账。
    if (state.gameYear > yearBefore) {
      const y = yearBefore;
      const ledgers = state.monthlyLedgersRolling.filter((l) => l.runId === state.runId && l.year === y);
      const sumProfit = ledgers.reduce((s, l) => s + l.profitYuan, 0);
      const report = state.annualReports.find((r) => r.year === y);
      if (ledgers.length !== 12 || !report || sumProfit !== report.profitYuan) conservationHeld = false;
      if (!report?.cashBridge?.balanced || !report.cashBridge.attributionComplete || report.cashBridge.unattributedCashFlowYuan !== 0) {
        annualCashBridgeHeld = false;
        annualCashBridgeIssue ??= {
          year: y,
          balanced: report?.cashBridge?.balanced ?? false,
          attributionComplete: report?.cashBridge?.attributionComplete ?? false,
          unattributedCashFlowYuan: report?.cashBridge?.unattributedCashFlowYuan ?? NaN,
        };
      }
    }
  }

  const lastReport = state.annualReports[state.annualReports.length - 1];
  const autoHires = Object.values(state.autoHireCountByYear).reduce((s, v) => s + v, 0);

  return {
    seed,
    configHash: CONFIG_HASH,
    industry,
    policy,
    monthsSimulated,
    complete60Months: monthsSimulated === 60,
    stopReason: monthsSimulated === 60 ? 'COMPLETED_60_MONTHS' : `PHASE_${state.phase}`,
    years: state.gameYear - 1,
    finalProfitYear: lastReport?.profitYuan ?? 0,
    cashEnd: state.company!.cashYuan,
    assetsEnd: state.company!.cashYuan + state.company!.businessAssetBookYuan,
    headcountEnd: state.employees.filter((e) => e.status === 'ACTIVE').length,
    deptCount: state.departments.length,
    events: state.annualEvents.filter((e) => e.happened).length,
    autoHires,
    autoHiresByYear: { ...state.autoHireCountByYear },
    maxAutoHiresInMonth: Math.max(0, ...hiresByMonth.values()),
    annualCashBridgeIssue,
    rescueUsed: state.rescueCapitalUsed,
    cashNeverNegative,
    conservationHeld,
    cashDeltaHeld,
    cashDeltaFailureCount,
    firstCashDeltaMismatch,
    annualCashBridgeHeld,
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
  const header = 'seed,configHash,industry,policy,monthsSimulated,complete60Months,stopReason,years,finalProfitYear,cashEnd,assetsEnd,headcountEnd,deptCount,events,autoHires,autoHiresByYear,maxAutoHiresInMonth,rescueUsed,cashNeverNegative,conservationHeld,cashDeltaHeld,annualCashBridgeHeld';
  const body = rows
    .map((r) =>
      [
        r.seed, r.configHash, r.industry, r.policy, r.monthsSimulated, r.complete60Months, r.stopReason,
        r.years, r.finalProfitYear, r.cashEnd, r.assetsEnd, r.headcountEnd, r.deptCount, r.events,
        r.autoHires, JSON.stringify(r.autoHiresByYear), r.maxAutoHiresInMonth, r.rescueUsed,
        r.cashNeverNegative, r.conservationHeld, r.cashDeltaHeld, r.annualCashBridgeHeld,
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
    cashDeltaFail: rows.filter((r) => !r.cashDeltaHeld).length,
    annualCashBridgeFail: rows.filter((r) => !r.annualCashBridgeHeld).length,
    rescueUsed: rows.filter((r) => r.rescueUsed).length,
    tooManyEvents: rows.filter((r) => r.events > 4).length,
    autoHireMax: Math.max(...rows.map((r) => r.autoHires)),
    incomplete: rows.filter((r) => !r.complete60Months).length,
    incompleteReasons: rows.filter((r) => !r.complete60Months).reduce<Record<string, number>>((acc, row) => {
      acc[row.stopReason] = (acc[row.stopReason] ?? 0) + 1;
      return acc;
    }, {}),
    maxAutoHiresInYear: Math.max(0, ...rows.flatMap((row) => Object.values(row.autoHiresByYear))),
    maxAutoHiresInMonth: Math.max(0, ...rows.map((row) => row.maxAutoHiresInMonth)),
  };
}
