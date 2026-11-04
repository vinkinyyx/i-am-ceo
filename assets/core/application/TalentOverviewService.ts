import type { EconomyConfig } from '../config/EconomyConfig';
import type { DeptType, Employee, EmployeeStatus, GameState } from '../domain/types';
import { monthlyCapacity } from '../simulation/capacity';
import { computeSupportEffects, deptIdAtMonth } from '../simulation/departments';
import { activeEmployeesAt } from '../simulation/monthly';
import { monthIndexOf } from './monthEntry';

/**
 * R30：人才页只读视图模型（纯计算，不改状态）。
 *
 * 口径：
 * - 只列在职（ACTIVE）与「已提交裁员、次月生效」（PENDING_DISMISSAL）员工；
 *   DISMISSED 不再出现。月薪合计与人数按同一筛选口径聚合，页面不自行加总。
 * - 调岗以「下月生效」表示：当月仍按原部门计工资/产能，次月只在新部门计一次。
 * - 裁员预估的产能变化只对主营（业务交付）员工有意义；0 人严格 0，不虚构贡献。
 */

export interface TalentRowVM {
  employeeId: string;
  name: string;
  deptId: string;
  deptType: DeptType;
  skill: number;
  potential: number;
  teamwork: number;
  personality: Employee['personality'];
  salaryMonthlyYuan: number;
  /** 入职月数（入职当月记为 1） */
  tenureMonths: number;
  status: EmployeeStatus;
  /** 已提交、次月生效的调岗目标 */
  pendingDeptId: string | null;
  effectiveMonthIndex: number | null;
}

export interface TalentFilterVM {
  /** 'ALL' 或 deptId */
  key: string;
  deptType: DeptType | null;
  headcount: number;
  monthlyPayrollYuan: number;
}

export interface TalentOverview {
  filterKey: string;
  /** 当前筛选下人数与月薪合计 */
  headcount: number;
  monthlyPayrollYuan: number;
  /** 全公司（不受筛选）人数与月薪合计 */
  allHeadcount: number;
  allMonthlyPayrollYuan: number;
  filters: TalentFilterVM[];
  rows: TalentRowVM[];
}

const DEPT_ORDER: Record<DeptType, number> = {
  BUSINESS: 0,
  HR: 1,
  PROCUREMENT: 2,
  MARKETING: 3,
  CUSTOMER_SERVICE: 4,
  FINANCE: 5,
};

export function buildTalentOverview(state: GameState, filterKey = 'ALL'): TalentOverview {
  const monthIndex = monthIndexOf(state);
  const listed = state.employees.filter((e) => e.status !== 'DISMISSED');
  const deptById = new Map(state.departments.map((d) => [d.deptId, d]));

  const rows: TalentRowVM[] = listed.map((e) => {
    const dept = deptById.get(e.departmentId);
    return {
      employeeId: e.employeeId,
      name: e.name,
      deptId: e.departmentId,
      deptType: dept?.type ?? 'BUSINESS',
      skill: e.skill,
      potential: e.potential,
      teamwork: e.teamwork,
      personality: e.personality,
      salaryMonthlyYuan: e.salaryMonthlyYuan,
      tenureMonths: Math.max(1, monthIndex - e.hiredAtMonthIndex + 1),
      status: e.status,
      pendingDeptId: e.pendingDepartmentId ?? null,
      effectiveMonthIndex:
        typeof e.transferFromMonthIndex === 'number' ? e.transferFromMonthIndex : null,
    };
  });

  rows.sort((a, b) => {
    const order = DEPT_ORDER[a.deptType] - DEPT_ORDER[b.deptType];
    if (order !== 0) return order;
    if (a.salaryMonthlyYuan !== b.salaryMonthlyYuan) return b.salaryMonthlyYuan - a.salaryMonthlyYuan;
    return a.employeeId.localeCompare(b.employeeId);
  });

  const sum = (items: TalentRowVM[]) => ({
    headcount: items.length,
    payrollYuan: items.reduce((n, r) => n + r.salaryMonthlyYuan, 0),
  });

  const business = state.departments.find((d) => d.type === 'BUSINESS' && d.enabled);
  const supportDepts = state.departments
    .filter((d) => d.enabled && d.type !== 'BUSINESS')
    .sort((a, b) => DEPT_ORDER[a.type] - DEPT_ORDER[b.type]);

  const filters: TalentFilterVM[] = [
    { key: 'ALL', deptType: null, ...(({ headcount, payrollYuan }) => ({ headcount, monthlyPayrollYuan: payrollYuan }))(sum(rows)) },
  ];
  for (const dept of [business, ...supportDepts]) {
    if (!dept) continue;
    const inDept = rows.filter((r) => r.deptId === dept.deptId);
    const s = sum(inDept);
    filters.push({
      key: dept.deptId,
      deptType: dept.type,
      headcount: s.headcount,
      monthlyPayrollYuan: s.payrollYuan,
    });
  }

  const filtered = filterKey === 'ALL' ? rows : rows.filter((r) => r.deptId === filterKey);
  const scoped = sum(filtered);
  const all = sum(rows);
  return {
    filterKey,
    headcount: scoped.headcount,
    monthlyPayrollYuan: scoped.payrollYuan,
    allHeadcount: all.headcount,
    allMonthlyPayrollYuan: all.payrollYuan,
    filters,
    rows: filtered,
  };
}

export interface TransferImpactVM {
  employeeId: string;
  name: string;
  salaryMonthlyYuan: number;
  fromDeptId: string;
  fromDeptType: DeptType;
  toDeptId: string;
  toDeptType: DeptType;
  fromHeadcountBefore: number;
  fromHeadcountAfter: number;
  toHeadcountBefore: number;
  toHeadcountAfter: number;
  /** 生效月份（下月） */
  effectiveGameYear: number;
  effectiveGameMonth: number;
  /** 生效月全员工资总额（同一员工只计一次 → 前后相等） */
  payrollBeforeYuan: number;
  payrollAfterYuan: number;
  /** 主营员工调出时，次月起业务产能减少的估算（元/月；非主营为 null） */
  businessCapacityLossYuan: number | null;
}

/** 调岗预览：展示原/目标部门人数前后变化与「同一员工只计一次」。 */
export function buildTransferImpact(
  state: GameState,
  cfg: EconomyConfig,
  employeeId: string,
  toDeptId: string,
): TransferImpactVM | null {
  const monthIndex = monthIndexOf(state);
  const emp = state.employees.find((e) => e.employeeId === employeeId);
  if (!emp || emp.status !== 'ACTIVE') return null;
  const fromDept = state.departments.find((d) => d.deptId === emp.departmentId);
  const toDept = state.departments.find((d) => d.deptId === toDeptId && d.enabled);
  if (!fromDept || !toDept || fromDept.deptId === toDept.deptId) return null;

  const active = activeEmployeesAt(state, monthIndex);
  const fromBefore = active.filter((e) => deptIdAtMonth(e, monthIndex) === fromDept.deptId).length;
  const toBefore = active.filter((e) => deptIdAtMonth(e, monthIndex) === toDept.deptId).length;
  const nextIndex = monthIndex + 1;
  const payroll = active.reduce((n, e) => n + e.salaryMonthlyYuan, 0);

  let businessCapacityLossYuan: number | null = null;
  if (fromDept.type === 'BUSINESS') {
    const before = businessCapacity(state, cfg, nextIndex, fromDept.deptId);
    const after = businessCapacity(state, cfg, nextIndex, fromDept.deptId, employeeId);
    businessCapacityLossYuan = Math.max(0, before - after);
  }

  return {
    employeeId,
    name: emp.name,
    salaryMonthlyYuan: emp.salaryMonthlyYuan,
    fromDeptId: fromDept.deptId,
    fromDeptType: fromDept.type,
    toDeptId: toDept.deptId,
    toDeptType: toDept.type,
    fromHeadcountBefore: fromBefore,
    fromHeadcountAfter: fromBefore - 1,
    toHeadcountBefore: toBefore,
    toHeadcountAfter: toBefore + 1,
    effectiveGameYear: Math.floor(nextIndex / 12) + 1,
    effectiveGameMonth: (nextIndex % 12) + 1,
    payrollBeforeYuan: payroll,
    payrollAfterYuan: payroll,
    businessCapacityLossYuan,
  };
}

/** 可调岗目标：所有其他已建且启用的部门（不含当前部门）。 */
export function transferTargets(
  state: GameState,
  employeeId: string,
): Array<{ deptId: string; type: DeptType }> {
  const emp = state.employees.find((e) => e.employeeId === employeeId);
  if (!emp) return [];
  return state.departments
    .filter((d) => d.enabled && d.deptId !== emp.departmentId)
    .map((d) => ({ deptId: d.deptId, type: d.type }));
}

/** 当月主营交付产能（可按员工排除，用于“调岗/裁员前后”对比）。 */
function businessCapacity(
  state: GameState,
  cfg: EconomyConfig,
  monthIndex: number,
  deptId: string,
  excludeEmployeeId?: string,
): number {
  if (!state.company) return 0;
  const support = computeSupportEffects(cfg, state, monthIndex);
  const staff = activeEmployeesAt(state, monthIndex).filter(
    (e) => deptIdAtMonth(e, monthIndex) === deptId && e.employeeId !== excludeEmployeeId,
  );
  return monthlyCapacity(
    cfg,
    state.company.industry,
    {
      businessEmployees: staff,
      ceo: state.ceo ?? null,
      departments: state.departments,
      businessCapacityInvestmentYuan: state.company.businessCapacityInvestmentYuan,
      hrCapacityBps: support.hrCapacity.effectBps,
    },
    monthIndex,
  ).monthlyCapacityYuan;
}

/** 裁员时主营员工的当月产能损失（非主营/非 ACTIVE 为 0）。 */
export function estimateLayoffCapacityLoss(
  state: GameState,
  cfg: EconomyConfig,
  employeeId: string,
): number {
  const monthIndex = monthIndexOf(state);
  const emp = state.employees.find((e) => e.employeeId === employeeId);
  if (!emp || emp.status !== 'ACTIVE' || !state.company) return 0;
  const dept = state.departments.find((d) => d.deptId === emp.departmentId);
  if (dept?.type !== 'BUSINESS') return 0;
  return Math.max(
    0,
    businessCapacity(state, cfg, monthIndex, dept.deptId) -
      businessCapacity(state, cfg, monthIndex, dept.deptId, employeeId),
  );
}

