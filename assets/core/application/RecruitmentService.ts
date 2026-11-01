import { recruitmentFee } from '../domain/CandidateGenerator';
import type { EconomyConfig } from '../config/EconomyConfig';
import { GameErrorCode } from '../domain/errors';
import { ensureRunId, hasCommand, recordCommand } from './MutationContext';
import { isOfferCurrent } from './OfferService';
import { activeStaffInDept, hrRecruitmentDiscountBps } from '../simulation/departments';
import { monthIndexOf, addPendingEntry } from './monthEntry';
import type {
  Candidate,
  Employee,
  GameState,
} from '../domain/types';

export interface HireInput {
  offerId: string;
  candidateId: string;
  departmentId: string;
}

export interface HireResult {
  employee: Employee;
  feePaidYuan: number;
  cashAfterYuan: number;
  firstHire: boolean;
}

/**
 * 录用员工（设计文档 05.4 / 12.4）。
 * - 费用确认瞬间扣现金并写 pendingEntries（RECRUITMENT，负数）。
 * - 首聘（HIRING_INITIAL）：第 1 月即生效，招满 2 人后转 TUTORIAL_DASHBOARD。
 * - 运营期：effectiveFrom = 下月。
 * - 幂等：同一 commandId 返回首次结果；旧 Offer / 已录用候选 → OFFER_EXPIRED。
 */
export function hireEmployee(
  state: GameState,
  cfg: EconomyConfig,
  input: HireInput,
  ctx: { commandId: string; expectedRunId: string },
): HireResult {
  ensureRunId(state, ctx.expectedRunId);

  if (!state.company) throw new Error(GameErrorCode.NOT_READY);

  // 幂等重放：同一 commandId 已录用过 → 返回原员工与原费用，不再扣现金
  if (hasCommand(state, ctx.commandId)) {
    const existing = state.employees.find((e) => e.hireCommandId === ctx.commandId);
    const feeEntry = state.pendingEntries.find(
      (e) => e.refId === ctx.commandId && e.category === 'RECRUITMENT',
    );
    if (existing) {
      return {
        employee: existing,
        feePaidYuan: feeEntry ? Math.abs(feeEntry.amountYuan) : 0,
        cashAfterYuan: state.company.cashYuan,
        firstHire: state.onboarding.initialHiresCompleted === 1,
      };
    }
  }

  const isInitialHiring = state.phase === 'HIRING_INITIAL';
  if (!isInitialHiring && state.phase !== 'RUNNING' && state.phase !== 'DISTRESS') {
    throw new Error(GameErrorCode.NOT_READY);
  }
  if (isInitialHiring && state.onboarding.initialHiresCompleted >= 2) {
    throw new Error(GameErrorCode.NOT_READY);
  }

  const dept = state.departments.find((d) => d.deptId === input.departmentId);
  if (!dept) throw new Error(GameErrorCode.DEPT_NOT_FOUND);

  // Offer 必须仍是该部门当前有效 Offer
  if (!isOfferCurrent(state, input.offerId)) {
    throw new Error(GameErrorCode.OFFER_EXPIRED);
  }
  const offer = state.offers.find((o) => o.offerId === input.offerId);
  if (!offer || offer.deptId !== input.departmentId) {
    throw new Error(GameErrorCode.OFFER_EXPIRED);
  }
  const candidate: Candidate | undefined = offer.candidates.find(
    (c) => c.candidateId === input.candidateId,
  );
  if (!candidate) throw new Error(GameErrorCode.OFFER_EXPIRED);

  // 该候选已被录用（不同 commandId 重试同一人）→ OFFER_EXPIRED
  if (state.employees.some((e) => e.candidateId === candidate.candidateId)) {
    throw new Error(GameErrorCode.OFFER_EXPIRED);
  }

  // 招聘费 = 1 个月月薪；HR 折扣只对「支付当时已生效」的 HR 部门员工生效（5.3）。
  const mIndex = monthIndexOf(state);
  const hrDiscount = hrRecruitmentDiscountBps(
    cfg,
    activeStaffInDept(state, 'HR', mIndex),
  );
  const fee = recruitmentFee(candidate.salaryMonthlyYuan, hrDiscount);
  if (state.company.cashYuan < fee) {
    throw new Error(GameErrorCode.INSUFFICIENT_CASH);
  }

  const employeeId = candidateToEmployeeId(state, candidate.candidateId);
  const employee: Employee = {
    employeeId,
    name: candidate.name,
    avatarId: candidate.avatarId,
    departmentId: input.departmentId,
    skill: candidate.skill,
    potential: candidate.potential,
    teamwork: candidate.teamwork,
    personality: candidate.personality,
    salaryMonthlyYuan: candidate.salaryMonthlyYuan,
    hiredAtMonthIndex: mIndex,
    // 首聘从第 1 月生效；运营期录用次月生效
    effectiveFromMonthIndex: isInitialHiring ? 0 : mIndex + 1,
    dismissedAtMonthIndex: null,
    status: 'ACTIVE',
    hireCommandId: ctx.commandId,
    candidateId: candidate.candidateId,
  };

  // 立即扣现金
  state.company.cashYuan -= fee;
  addPendingEntry(state, 'RECRUITMENT', -fee, ctx.commandId);
  state.employees.push(employee);
  recordCommand(state, ctx.commandId);

  let firstHire = false;
  if (isInitialHiring) {
    state.onboarding.initialHiresCompleted += 1;
    firstHire = state.onboarding.initialHiresCompleted === 1;
    if (state.onboarding.initialHiresCompleted >= 2) {
      state.phase = 'TUTORIAL_DASHBOARD';
      pushStep(state, 'TUT-03');
    }
  }

  return {
    employee,
    feePaidYuan: fee,
    cashAfterYuan: state.company.cashYuan,
    firstHire,
  };
}

function candidateToEmployeeId(state: GameState, candidateId: string): string {
  return `emp_${state.runId}_${candidateId}`;
}

/** 幂等记录已完成引导步骤，避免重复 push。 */
function pushStep(state: GameState, step: string): void {
  if (!state.onboarding.completedSteps.includes(step)) {
    state.onboarding.completedSteps.push(step);
  }
}

/** 首聘完成后由引导/玩家显式开始经营（时钟启动，speed=1）。 */
export function startOperating(
  state: GameState,
  ctx: { commandId: string; expectedRunId: string },
): void {
  ensureRunId(state, ctx.expectedRunId);
  if (state.phase === 'RUNNING') return; // 已开始，幂等
  if (state.phase !== 'TUTORIAL_DASHBOARD' && state.phase !== 'HIRING_INITIAL') {
    throw new Error(GameErrorCode.NOT_READY);
  }
  if (state.onboarding.initialHiresCompleted < 2) {
    throw new Error(GameErrorCode.ONBOARDING_INCOMPLETE);
  }
  if (hasCommand(state, ctx.commandId)) return;
  state.phase = 'RUNNING';
  state.speed = 1;
  // 玩家在看板确认「开始经营」：完成三指标认知 TUT-04，并启动时钟 TUT-05
  pushStep(state, 'TUT-04');
  pushStep(state, 'TUT-05');
  recordCommand(state, ctx.commandId);
}
