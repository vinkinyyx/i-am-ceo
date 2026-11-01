import type { EconomyConfig } from '../config/EconomyConfig';
import { newId } from '../domain/ids';
import type {
  Candidate,
  Department,
  GameState,
  SupportDeptType,
} from '../domain/types';
import { recruitmentFee } from '../domain/CandidateGenerator';
import { generateCandidates } from '../domain/CandidateGenerator';
import { monthIndexOf } from './monthEntry';

/**
 * 自动招聘决策（设计文档 06.5 / 06.6 / 5.7）。
 *
 * 硬性安全约束（任何策略都不可突破）：
 * - phase 必须 RUNNING、cashRisk=NORMAL；
 * - 每月全公司最多自动录用 1 人；每年最多 maxAutoHiresPerYear(3) 人；
 * - 只对 staffingMode=AUTO 的部门招；LOCKED 不补员；
 * - 录用后现金仍须覆盖 N 个月刚性费用（N 由方针：稳健/扩张 6、利润 9）；
 * - 只在 ROI 达标（12 个月预计新增贡献 ≥ 阈值 × (12个月工资+招聘费)）时录用；
 * - 自动永不裁员、永不建部门、永不扩张资产。
 *
 * 决策可复现：候选由 hash(runSeed, deptId, autoSequence) 派生，不污染市场事件流，
 * 也不消费玩家手动 offer（autoOffer 独立计算、不写入 state.offers）。
 */

export interface AutoHireDecision {
  hired: boolean;
  deptId?: string;
  deptType?: SupportDeptType;
  candidate?: Candidate;
  feeYuan?: number;
  projectedBenefitYuan?: number;
  projectedCostYuan?: number;
  reason: string;
}

/** 候选评分（仅用于候选之间排序，06.6）。 */
export function candidateScore(c: Candidate): number {
  const salaryNormalized = ((c.salaryMonthlyYuan - 4000) / 4000) * 100;
  return (
    0.45 * c.skill +
    0.25 * c.potential +
    0.15 * c.teamwork +
    0.15 * (100 - salaryNormalized)
  );
}

/** 未来 months 个月刚性费用（全员月工资 + 月固定管理费），用于现金安全底线。 */
export function committedCostMonths(state: GameState, cfg: EconomyConfig, months: number): number {
  const monthlyPayroll = state.employees
    .filter((e) => e.status === 'ACTIVE')
    .reduce((s, e) => s + e.salaryMonthlyYuan, 0);
  const monthlyFixed = cfg.industry[state.company!.industry].fixedManagementAnnualYuan / 12;
  return Math.round((monthlyPayroll + monthlyFixed) * months);
}

/**
 * 估算录用候选后未来 12 个月新增贡献（元）。
 * 业务部：按其技能系数折算的年交付产能（受订单上限，但只做保守的产能侧估计）。
 * 支持部门：按部门一档效益对相应基数的节省估算（保守取当前年营收/成本年化）。
 * 这是「预计」，用于门槛判断，不入账；真实效益仍由月结统一计算。
 */
function estimateAnnualBenefit(
  state: GameState,
  cfg: EconomyConfig,
  dept: Department,
  candidate: Candidate,
): number {
  const industry = state.company!.industry;
  const ind = cfg.industry[industry];

  if (dept.type === 'BUSINESS') {
    const skillBps = cfg.productivity.skillBaseBps + candidate.skill * cfg.productivity.skillPerPointBps;
    // 新人年交付产能（不含团队乘数，保守）
    const newCapacity = Math.round(
      (ind.baseAnnualCapacityPerSkill60EmployeeYuan * skillBps) / 10_000,
    );

    // 只在「现有业务产能不足以交付当年需求」时才认可新员工贡献（06.6：订单不约束时不扩招）。
    const year = state.gameYear;
    const annualDemand = Math.round(ind.firstYearDemandYuan * (1 + cfg.demand.naturalAnnualGrowthBps / 10_000) ** (year - 1));
    const mIndex = monthIndexOf(state);
    const businessDept = state.departments.find((d) => d.type === 'BUSINESS');
    const currentCapacity = state.employees
      .filter(
        (e) =>
          e.status === 'ACTIVE' &&
          businessDept &&
          e.departmentId === businessDept.deptId &&
          e.effectiveFromMonthIndex <= mIndex,
      )
      .reduce((sum, e) => {
        const bps = cfg.productivity.skillBaseBps + e.skill * cfg.productivity.skillPerPointBps;
        return sum + (ind.baseAnnualCapacityPerSkill60EmployeeYuan * bps) / 10_000;
      }, 0);

    const gap = Math.max(0, annualDemand - currentCapacity);
    // 新增可交付收入取「新产能」与「缺口」较小者，再乘毛利率（保守按边际贡献）
    const addedRevenue = Math.min(newCapacity, gap);
    const grossMarginBps = 10_000 - ind.directCostBps;
    return Math.round((addedRevenue * grossMarginBps) / 10_000);
  }

  // 支持部门：以「当前年营收」为基数，按一人一档效益比例估算节省/增益
  const effects = cfg.departments.effects;
  const annualRevenueBasis = ind.firstYearDemandYuan; // 保守用首年需求作基数
  switch (dept.type as SupportDeptType) {
    case 'PROCUREMENT': {
      const bps = effects.PROCUREMENT.oneQualifiedStaffBps;
      const eligible = ind.procurementEligibleDirectCostBps;
      const directBase = (annualRevenueBasis * ind.directCostBps * eligible) / 10_000 ** 2;
      return Math.round((directBase * bps) / 10_000);
    }
    case 'CUSTOMER_SERVICE': {
      const bps = effects.CUSTOMER_SERVICE.oneQualifiedStaffBps;
      const afterBase = (annualRevenueBasis * ind.afterSalesCostBps) / 10_000;
      return Math.round((afterBase * bps) / 10_000);
    }
    case 'FINANCE': {
      const bps = effects.FINANCE.oneQualifiedStaffBps;
      const base = ind.fixedManagementAnnualYuan;
      return Math.round((base * bps) / 10_000);
    }
    case 'MARKETING': {
      // 市场提升需求，但仅在产能受订单约束时才有价值；这里用增量营收×行业毛利率保守折算
      const bps = effects.MARKETING.oneQualifiedStaffBps;
      const extraRevenue = (annualRevenueBasis * bps) / 10_000;
      const grossMarginBps = 10_000 - ind.directCostBps;
      return Math.round((extraRevenue * grossMarginBps) / 10_000);
    }
    case 'HR': {
      // HR 产能提升对业务产能的增益（保守按当前 2 名业务员工的年产能）
      const bps = effects.HR.businessCapacityOneStaffBps;
      const currentCapacity = ind.baseAnnualCapacityPerSkill60EmployeeYuan * 2;
      return Math.round((currentCapacity * bps) / 10_000);
    }
    default:
      return 0;
  }
}

interface ScoredOption {
  dept: Department;
  candidate: Candidate;
  feeYuan: number;
  benefit12: number;
  cost12: number;
  score: number;
}

/**
 * 执行一次月度自动招聘评估；若录用则直接在 state 上落变更（员工/现金/分录），
 * 由调用方在月结前的同一变更锁内调用，并自行持久化。
 * 返回决策（含原因），用于写自动化日志。
 */
export function runMonthlyAutoHire(
  state: GameState,
  cfg: EconomyConfig,
): AutoHireDecision {
  const skip = (reason: string): AutoHireDecision => ({ hired: false, reason });

  if (!state.company) return skip('公司不存在');
  if (state.phase !== 'RUNNING') return skip('非经营中，跳过自动招聘');
  if (state.cashRisk !== 'NORMAL') return skip('现金风险，冻结自动招聘');

  const year = state.gameYear;
  const yearCount = state.autoHireCountByYear[year] ?? 0;
  if (yearCount >= cfg.recruitment.maxAutoHiresPerYear) {
    return skip(`本年自动招聘已达上限 ${cfg.recruitment.maxAutoHiresPerYear} 人`);
  }

  const policy = cfg.policies[state.policy];
  const reserveMonths = policy.cashReserveMonths;
  const thresholdBps = policy.autoHireMarginThresholdBps;
  const mIndex = monthIndexOf(state);

  // 仅 AUTO 部门参与（BUSINESS 始终可自动扩员，支持部门需玩家建并切 AUTO）
  const autoDepts = state.departments.filter(
    (d) => d.enabled && d.staffingMode === 'AUTO',
  );
  if (autoDepts.length === 0) return skip('无 AUTO 编制部门');

  const options: ScoredOption[] = [];
  for (const dept of autoDepts) {
    // 独立自动 offer：序列按「年份+部门已有自动尝试」派生，不污染手动 offer
    const autoSeq =
      10_000 + mIndex * 100 + state.departments.indexOf(dept);
    const cands = generateCandidates({
      runSeed: state.seed,
      deptId: `auto:${dept.deptId}`,
      offerSequence: autoSeq,
    });
    const best = [...cands].sort((a, b) => candidateScore(b) - candidateScore(a))[0]!;
    const fee = recruitmentFee(best.salaryMonthlyYuan);
    const cost12 = best.salaryMonthlyYuan * 12 + fee;
    const benefit12 = estimateAnnualBenefit(state, cfg, dept, best);
    options.push({ dept, candidate: best, feeYuan: fee, benefit12, cost12, score: candidateScore(best) });
  }

  // 按预计净收益排序，取最高
  options.sort((a, b) => b.benefit12 - b.cost12 - (a.benefit12 - a.cost12));

  for (const opt of options) {
    // ROI 门槛：benefit ≥ (threshold/10000) × cost
    if (opt.benefit12 * 10_000 < opt.cost12 * thresholdBps) {
      continue; // 该候选不达标，尝试下一个部门
    }
    // 现金安全线：支付招聘费后，现金仍须覆盖 reserveMonths 刚性费用
    const reserve = committedCostMonths(state, cfg, reserveMonths);
    if (state.company.cashYuan - opt.feeYuan < reserve) {
      return skip(`现金安全线：需保留约 ${reserve} 元覆盖 ${reserveMonths} 个月刚性费用`);
    }
    // 该候选已在本 run 被录用（独立 id 不会撞，但保守保护）
    if (state.employees.some((e) => e.candidateId === opt.candidate.candidateId)) {
      continue;
    }

    // 落自动录用（次月生效；与手动一致但命令 id 确定性）
    const employeeId = `emp_${state.runId}_auto_${year}_${state.gameMonth}_${opt.dept.type}`;
    state.company.cashYuan -= opt.feeYuan;
    state.employees.push({
      employeeId,
      name: opt.candidate.name,
      avatarId: opt.candidate.avatarId,
      departmentId: opt.dept.deptId,
      skill: opt.candidate.skill,
      potential: opt.candidate.potential,
      teamwork: opt.candidate.teamwork,
      personality: opt.candidate.personality,
      salaryMonthlyYuan: opt.candidate.salaryMonthlyYuan,
      hiredAtMonthIndex: mIndex,
      effectiveFromMonthIndex: mIndex + 1,
      dismissedAtMonthIndex: null,
      status: 'ACTIVE',
      hireCommandId: newId('autohire', `${state.runId}:${year}:${state.gameMonth}`, 1),
      candidateId: opt.candidate.candidateId,
    });
    // 招聘费立即扣现金并计本月损益
    state.pendingEntries.push({
      entryId: newId('je', `${state.runId}:AUTO_RECRUIT:${employeeId}`, state.pendingEntries.length + 1),
      monthKey: `${state.runId}:${state.gameYear}:${state.gameMonth}`,
      category: 'RECRUITMENT',
      amountYuan: -opt.feeYuan,
      isCash: true,
      alreadyPaid: true,
      refId: employeeId,
    });
    state.autoHireCountByYear[year] = yearCount + 1;

    return {
      hired: true,
      deptId: opt.dept.deptId,
      deptType: opt.dept.type as SupportDeptType,
      candidate: opt.candidate,
      feeYuan: opt.feeYuan,
      projectedBenefitYuan: opt.benefit12,
      projectedCostYuan: opt.cost12,
      reason: `ROI 达标（预计年贡献 ${opt.benefit12} ≥ 成本 ${opt.cost12} × ${thresholdBps / 10000}）`,
    };
  }

  return skip('无满足 ROI 门槛的自动招聘候选');
}

/** 写一条自动化决策日志（保留最近 50 条）。 */
export function appendAutomationLog(state: GameState, decision: AutoHireDecision): void {
  state.automationLogs.push({
    logId: newId('alog', state.runId, state.automationLogs.length + 1),
    year: state.gameYear,
    month: state.gameMonth,
    kind: decision.hired ? 'AUTO_HIRE' : 'AUTO_SKIP',
    deptType: decision.deptType ?? null,
    candidateId: decision.candidate?.candidateId,
    projectedBenefitYuan: decision.projectedBenefitYuan,
    projectedCostYuan: decision.projectedCostYuan,
    reason: decision.reason,
  });
  if (state.automationLogs.length > 50) {
    state.automationLogs = state.automationLogs.slice(-50);
  }
}
