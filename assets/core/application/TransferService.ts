import { GameErrorCode } from '../domain/errors';
import type { Employee, GameState } from '../domain/types';
import { ensureRunId, hasCommand, recordCommand } from './MutationContext';
import { monthIndexOf } from './monthEntry';

/**
 * 员工调岗（设计文档 6.4，M2 列为 P1 但提供最小闭环）。
 * - 员工属于且仅属于一个部门；主营 BUSINESS ↔ 已建支持部门之间调动。
 * - 下月生效（transferFromMonthIndex），无招聘费、无裁员赔偿。
 * - 生效前员工仍在原部门计工资/产能，生效后只在新部门计一次——杜绝双重工资/双重产能。
 * - 调岗不改变薪资与能力。
 */

export interface TransferPreview {
  employeeId: string;
  name: string;
  fromDeptId: string;
  toDeptId: string;
  effectiveFromMonthIndex: number;
}

function findEmployee(state: GameState, employeeId: string): Employee {
  const emp = state.employees.find((e) => e.employeeId === employeeId);
  if (!emp) throw new Error(GameErrorCode.EMPLOYEE_NOT_FOUND);
  if (emp.status !== 'ACTIVE') throw new Error(GameErrorCode.EMPLOYEE_NOT_DISMISSIBLE);
  return emp;
}

export function previewTransfer(
  state: GameState,
  employeeId: string,
  toDeptId: string,
): TransferPreview {
  const emp = findEmployee(state, employeeId);
  const toDept = state.departments.find((d) => d.deptId === toDeptId);
  if (!toDept || !toDept.enabled) throw new Error(GameErrorCode.DEPT_NOT_FOUND);
  if (emp.departmentId === toDeptId) throw new Error(GameErrorCode.INVALID_TARGET);
  return {
    employeeId,
    name: emp.name,
    fromDeptId: emp.departmentId,
    toDeptId,
    effectiveFromMonthIndex: monthIndexOf(state) + 1,
  };
}

/**
 * 确认调岗（幂等：同 commandId 返回，不重复移动）。
 * 用 pendingDepartmentId + transferFromMonthIndex 表示下月生效；
 * 月结时 activeEmployeesAt / 部门效益按生效月读取当前归属。
 */
export function transferEmployee(
  state: GameState,
  employeeId: string,
  toDeptId: string,
  ctx: { commandId: string; expectedRunId: string },
): Employee {
  ensureRunId(state, ctx.expectedRunId);
  if (!state.company) throw new Error(GameErrorCode.NOT_READY);
  if (state.phase !== 'RUNNING' && state.phase !== 'DISTRESS') {
    throw new Error(GameErrorCode.NOT_READY);
  }

  if (hasCommand(state, ctx.commandId)) {
    return findEmployee(state, employeeId);
  }

  const emp = findEmployee(state, employeeId);
  const toDept = state.departments.find((d) => d.deptId === toDeptId);
  if (!toDept || !toDept.enabled) throw new Error(GameErrorCode.DEPT_NOT_FOUND);
  if (emp.departmentId === toDeptId) throw new Error(GameErrorCode.INVALID_TARGET);

  emp.pendingDepartmentId = toDeptId;
  emp.transferFromMonthIndex = monthIndexOf(state) + 1;
  recordCommand(state, ctx.commandId);
  return emp;
}
