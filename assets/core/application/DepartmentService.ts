import type { EconomyConfig } from '../config/EconomyConfig';
import { GameErrorCode } from '../domain/errors';
import { newId } from '../domain/ids';
import type {
  Department,
  DeptType,
  GameState,
  StaffingMode,
  SupportDeptType,
} from '../domain/types';
import { SUPPORT_DEPARTMENTS } from '../domain/types';
import { ensureRunId, hasCommand, recordCommand } from './MutationContext';
import { monthIndexOf, addPendingEntry } from './monthEntry';

/**
 * 部门创建与编制模式（设计文档 06.1 / 06.2 / 06.4）。
 * - 全公司仅一个 BUSINESS；5 个支持部门同类只能创建一次（去重）。
 * - 设立费 1 万，确认即扣现金并计本年 DEPT_SETUP 损益；创建不送员工。
 * - 新建部门默认 LOCKED/targetCount=0，不会自动扩员；玩家可显式切 AUTO。
 * - 部门不可删除（堵退款刷钱），只能保留空部门或关自动招聘。
 */

export interface CreateDeptResult {
  department: Department;
  feePaidYuan: number;
  cashAfterYuan: number;
}

export function isSupportDeptType(type: string): type is SupportDeptType {
  return (SUPPORT_DEPARTMENTS as readonly string[]).includes(type);
}

/** 预览设立费与扣后现金（只读）。 */
export function previewCreateDepartment(
  state: GameState,
  cfg: EconomyConfig,
  type: SupportDeptType,
): { feeYuan: number; cashAfterYuan: number; alreadyExists: boolean } {
  const fee = cfg.departments.setupFeeYuan;
  const alreadyExists = state.departments.some((d) => d.type === type);
  return {
    feeYuan: fee,
    cashAfterYuan: (state.company?.cashYuan ?? 0) - fee,
    alreadyExists,
  };
}

export function createDepartment(
  state: GameState,
  cfg: EconomyConfig,
  type: SupportDeptType,
  ctx: { commandId: string; expectedRunId: string },
): CreateDeptResult {
  ensureRunId(state, ctx.expectedRunId);
  if (!state.company) throw new Error(GameErrorCode.NOT_READY);
  if (!isSupportDeptType(type)) throw new Error(GameErrorCode.INVALID_TARGET);
  if (state.phase !== 'RUNNING' && state.phase !== 'DISTRESS') {
    throw new Error(GameErrorCode.NOT_READY);
  }

  // 幂等重放：同 commandId 已建过该部门 → 返回既有部门，不再扣费
  if (hasCommand(state, ctx.commandId)) {
    const existing = state.departments.find((d) => d.type === type);
    if (existing) {
      return {
        department: existing,
        feePaidYuan: 0,
        cashAfterYuan: state.company.cashYuan,
      };
    }
  }

  // 去重：同类部门只能一个（B06：连点只扣一次、只建一个）
  if (state.departments.some((d) => d.type === type)) {
    throw new Error(GameErrorCode.DEPT_ALREADY_EXISTS);
  }

  const fee = cfg.departments.setupFeeYuan;
  if (state.company.cashYuan < fee) {
    throw new Error(GameErrorCode.INSUFFICIENT_CASH);
  }

  const mIndex = monthIndexOf(state);
  const department: Department = {
    deptId: newId('dp', `${state.runId}:${type}`, state.departments.length),
    type: type as DeptType,
    enabled: true,
    staffingMode: 'LOCKED',
    targetCount: 0,
    createdMonthIndex: mIndex,
    setupPaid: true,
  };

  state.company.cashYuan -= fee;
  addPendingEntry(state, 'DEPT_SETUP', -fee, ctx.commandId);
  state.departments.push(department);
  recordCommand(state, ctx.commandId);

  return { department, feePaidYuan: fee, cashAfterYuan: state.company.cashYuan };
}

/** 切换 AUTO/LOCKED（不触发任何即时费用，不裁员）。 */
export function setStaffingMode(
  state: GameState,
  deptId: string,
  mode: StaffingMode,
  ctx: { commandId: string; expectedRunId: string },
): Department {
  ensureRunId(state, ctx.expectedRunId);
  const dept = state.departments.find((d) => d.deptId === deptId);
  if (!dept) throw new Error(GameErrorCode.DEPT_NOT_FOUND);
  if (mode !== 'AUTO' && mode !== 'LOCKED') throw new Error(GameErrorCode.INVALID_TARGET);
  dept.staffingMode = mode;
  recordCommand(state, ctx.commandId);
  return dept;
}

/** 手动设定目标人数（仅记录建议人数；减少目标不自动裁员、不退费）。 */
export function setTargetCount(
  state: GameState,
  deptId: string,
  target: number,
  ctx: { commandId: string; expectedRunId: string },
): Department {
  ensureRunId(state, ctx.expectedRunId);
  const dept = state.departments.find((d) => d.deptId === deptId);
  if (!dept) throw new Error(GameErrorCode.DEPT_NOT_FOUND);
  if (!Number.isSafeInteger(target) || target < 0 || target > 50) {
    throw new Error(GameErrorCode.INVALID_TARGET);
  }
  dept.targetCount = target;
  recordCommand(state, ctx.commandId);
  return dept;
}
