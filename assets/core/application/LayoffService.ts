import type { EconomyConfig } from '../config/EconomyConfig';
import { GameErrorCode } from '../domain/errors';
import type { Employee, GameState } from '../domain/types';
import { ensureRunId, hasCommand, recordCommand } from './MutationContext';
import { monthIndexOf, addPendingEntry } from './monthEntry';

/**
 * 裁员（设计文档 5.6）。
 * - 只允许玩家主动触发；永不后台自动裁员。
 * - 在职年数 = floor(在职月数/12)；补偿月数 = min(3, max(1, ceil(年数/2)))；补偿 = 月薪×月数。
 * - 状态机 ACTIVE → PENDING_DISMISSAL → DISMISSED；确认即支付补偿并计本期 SEVERANCE 损益，
 *   次月（下一月结）起移除工资与产能（见 effectiveDismissalAt）。
 * - 二次确认 token 60 秒，确认时重新计算补偿，预览与提交不一致则 CONFIRMATION_EXPIRED。
 */

export interface LayoffPreview {
  employeeId: string;
  name: string;
  deptType: string;
  salaryMonthlyYuan: number;
  tenureMonths: number;
  tenureYears: number;
  severanceMonths: number;
  severanceYuan: number;
  /** 未来 12 个月预计节约工资（PENDING 次月起停薪） */
  nextYearSalarySavingYuan: number;
  cashAfterYuan: number;
  /** 预览时间戳（token 校验用） */
  previewedAtMs: number;
}

export interface LayoffToken {
  employeeId: string;
  severanceYuan: number;
  expiresAtMs: number;
  previewedAtMs: number;
}

const TOKEN_TTL_MS = 60_000;

/** 员工被正式移除工资/产能的月份轴索引（PENDING 的次月）。 */
export function effectiveDismissalMonthIndex(emp: Employee, currentMonthIndex: number): number {
  return emp.status === 'PENDING_DISMISSAL' ? currentMonthIndex + 1 : currentMonthIndex + 1;
}

function findActiveEmployee(state: GameState, employeeId: string): Employee {
  const emp = state.employees.find((e) => e.employeeId === employeeId);
  if (!emp) throw new Error(GameErrorCode.EMPLOYEE_NOT_FOUND);
  if (emp.status !== 'ACTIVE') throw new Error(GameErrorCode.EMPLOYEE_NOT_DISMISSIBLE);
  return emp;
}

/** 计算补偿月数（纯函数，便于测试）。 */
export function severanceMonthsFor(tenureYears: number): number {
  return Math.min(3, Math.max(1, Math.ceil(tenureYears / 2)));
}

/**
 * 生成裁员预览（GET，不改状态）。
 * @param nowMs 当前时间
 * @param currentMonthIndex 当前月结轴索引（用于在职月数）
 */
export function previewLayoff(
  state: GameState,
  employeeId: string,
  nowMs: number,
): LayoffPreview {
  const emp = findActiveEmployee(state, employeeId);
  const currentMonthIndex = monthIndexOf(state);
  const tenureMonths = Math.max(0, currentMonthIndex - emp.hiredAtMonthIndex);
  const tenureYears = Math.floor(tenureMonths / 12);
  const severanceMonths = severanceMonthsFor(tenureYears);
  const severanceYuan = emp.salaryMonthlyYuan * severanceMonths;
  const dept = state.departments.find((d) => d.deptId === emp.departmentId);

  return {
    employeeId: emp.employeeId,
    name: emp.name,
    deptType: dept?.type ?? '',
    salaryMonthlyYuan: emp.salaryMonthlyYuan,
    tenureMonths,
    tenureYears,
    severanceMonths,
    severanceYuan,
    // 次月停薪，未来 12 个月最多省 12 个月工资
    nextYearSalarySavingYuan: emp.salaryMonthlyYuan * 12,
    cashAfterYuan: (state.company?.cashYuan ?? 0) - severanceYuan,
    previewedAtMs: nowMs,
  };
}

/** 由预览生成 60 秒有效确认 token。 */
export function createLayoffToken(preview: LayoffPreview, nowMs: number): LayoffToken {
  return {
    employeeId: preview.employeeId,
    severanceYuan: preview.severanceYuan,
    expiresAtMs: nowMs + TOKEN_TTL_MS,
    previewedAtMs: preview.previewedAtMs,
  };
}

export interface LayoffResult {
  employee: Employee;
  severancePaidYuan: number;
  cashAfterYuan: number;
}

/**
 * 确认裁员（二次确认）。
 * - token 过期 → CONFIRMATION_EXPIRED；
 * - 确认时重算补偿，与预览不一致（如跨了年结/调薪）→ CONFIRMATION_EXPIRED 要求重新确认；
 * - 现金不足 → INSUFFICIENT_CASH，状态不变；
 * - 幂等：同 commandId 返回首次结果，不重复扣费。
 */
export function confirmLayoff(
  state: GameState,
  cfg: EconomyConfig,
  token: LayoffToken,
  ctx: { commandId: string; expectedRunId: string },
  nowMs: number,
): LayoffResult {
  void cfg;
  ensureRunId(state, ctx.expectedRunId);
  if (!state.company) throw new Error(GameErrorCode.NOT_READY);

  if (nowMs > token.expiresAtMs) {
    throw new Error(GameErrorCode.CONFIRMATION_EXPIRED);
  }

  // 幂等重放
  if (hasCommand(state, ctx.commandId)) {
    const existing = state.employees.find((e) => e.employeeId === token.employeeId);
    if (existing && existing.status !== 'ACTIVE') {
      const feeEntry = state.pendingEntries.find(
        (e) => e.refId === ctx.commandId && e.category === 'SEVERANCE',
      );
      return {
        employee: existing,
        severancePaidYuan: feeEntry ? Math.abs(feeEntry.amountYuan) : 0,
        cashAfterYuan: state.company.cashYuan,
      };
    }
  }

  const emp = findActiveEmployee(state, token.employeeId);

  // 确认时重新计算补偿（B07：途中现金/状态变化须重新核算）
  const currentMonthIndex = monthIndexOf(state);
  const tenureMonths = Math.max(0, currentMonthIndex - emp.hiredAtMonthIndex);
  const tenureYears = Math.floor(tenureMonths / 12);
  const recomputed = emp.salaryMonthlyYuan * severanceMonthsFor(tenureYears);
  if (recomputed !== token.severanceYuan) {
    throw new Error(GameErrorCode.CONFIRMATION_EXPIRED);
  }
  if (state.company.cashYuan < recomputed) {
    throw new Error(GameErrorCode.INSUFFICIENT_CASH);
  }

  // ACTIVE → PENDING_DISMISSAL：立即支付补偿，次月起停薪停产能
  state.company.cashYuan -= recomputed;
  addPendingEntry(state, 'SEVERANCE', -recomputed, ctx.commandId);
  emp.status = 'PENDING_DISMISSAL';
  emp.dismissedAtMonthIndex = currentMonthIndex + 1;
  recordCommand(state, ctx.commandId);

  return { employee: emp, severancePaidYuan: recomputed, cashAfterYuan: state.company.cashYuan };
}
