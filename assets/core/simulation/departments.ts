import type { EconomyConfig } from '../config/EconomyConfig';
import { roundHalfUp } from '../domain/money';
import type { Department, Employee, GameState, SupportDeptType } from '../domain/types';

/**
 * 支持部门量化效益（设计文档 06.3 / 04 / 黄金 G004/G013/G014/G015）。
 *
 * 共同口径：
 * - 只统计当月在该支持部门「已生效且在职」的员工（业务部员工不产生支持效益）。
 * - 部门效益系数 = 人数边际乘数(staffMultiplierBps) × 员工平均技能系数，再受该部门 cap 限制。
 * - staffMultiplierBps 为「n 人在岗总系数」（边际递减）：索引 0 = 0；超出表长按末档。
 * - 技能系数 skill60→10000，按部门 min/max 钳制。
 * - 0 员工严格为 0；部门不存在或 0 人不产生任何节省/增益，也不凭空创收。
 *
 * 本模块只产出系数与节省金额（纯函数），不直接改状态、不重复记账。
 */

/** 员工在指定月份轴的实际归属部门（处理下月生效的调岗）。 */
export function deptIdAtMonth(
  emp: Pick<Employee, 'departmentId' | 'pendingDepartmentId' | 'transferFromMonthIndex'>,
  monthIndex: number,
): string {
  if (
    emp.pendingDepartmentId &&
    typeof emp.transferFromMonthIndex === 'number' &&
    monthIndex >= emp.transferFromMonthIndex
  ) {
    return emp.pendingDepartmentId;
  }
  return emp.departmentId;
}

/** 某部门当月在岗且生效员工。 */
export function activeStaffInDept(
  state: { employees: Employee[]; departments: Department[] },
  type: SupportDeptType,
  monthIndex: number,
): Employee[] {
  const dept = state.departments.find((d) => d.type === type && d.enabled);
  if (!dept) return [];
  return state.employees.filter(
    (e) =>
      e.status === 'ACTIVE' &&
      deptIdAtMonth(e, monthIndex) === dept.deptId &&
      e.effectiveFromMonthIndex <= monthIndex,
  );
}

/** 员工技能系数 bps（skill 60 → 10000），按部门上下限钳制。 */
export function deptSkillFactorBps(cfg: EconomyConfig, avgSkill: number): number {
  const raw = cfg.productivity.skillBaseBps + avgSkill * cfg.productivity.skillPerPointBps;
  return Math.min(
    cfg.departments.maxSkillFactorBps,
    Math.max(cfg.departments.minSkillFactorBps, raw),
  );
}

/** n 人在岗的边际乘数总系数 bps（超出表长按末档）。 */
export function staffCountMultiplierBps(cfg: EconomyConfig, headcount: number): number {
  const table = cfg.departments.staffMultiplierBps;
  if (headcount <= 0 || table.length === 0) return 0;
  const idx = Math.min(headcount, table.length - 1);
  return table[idx] ?? 0;
}

export interface DeptEffect {
  /** 部门类型 */
  type: SupportDeptType;
  /** 当月在岗人数 */
  headcount: number;
  /** 平均技能 */
  avgSkill: number;
  /** 人数边际乘数 bps */
  staffBps: number;
  /** 技能系数 bps */
  skillBps: number;
  /** 最终作用系数 bps（已按部门 cap 钳制） */
  effectBps: number;
}

function buildEffect(
  cfg: EconomyConfig,
  type: SupportDeptType,
  staff: Employee[],
  oneStaffBps: number,
  capBps: number,
): DeptEffect {
  const headcount = staff.length;
  const avgSkill =
    headcount === 0 ? 0 : staff.reduce((s, e) => s + e.skill, 0) / headcount;
  const staffBps = staffCountMultiplierBps(cfg, headcount);
  const skillBps = headcount === 0 ? 0 : deptSkillFactorBps(cfg, avgSkill);
  // oneStaffBps 为「1 名合格(系数1.0)员工」的 bps；乘人数乘数与技能系数，封顶 cap。
  const raw = headcount === 0 ? 0 : (oneStaffBps * staffBps * skillBps) / 10_000 ** 2;
  const effectBps = Math.min(capBps, roundHalfUp(raw));
  return { type, headcount, avgSkill, staffBps, skillBps, effectBps };
}

/** 采购：对「可适用直接成本」（行业直成 × procurementEligibleDirectCostBps）的节省比例。 */
export function procurementEffect(cfg: EconomyConfig, staff: Employee[]): DeptEffect {
  return buildEffect(
    cfg,
    'PROCUREMENT',
    staff,
    cfg.departments.effects.PROCUREMENT.oneQualifiedStaffBps,
    cfg.departments.effects.PROCUREMENT.capBps,
  );
}

/** 客服：对售后费用的节省比例。 */
export function customerServiceEffect(cfg: EconomyConfig, staff: Employee[]): DeptEffect {
  return buildEffect(
    cfg,
    'CUSTOMER_SERVICE',
    staff,
    cfg.departments.effects.CUSTOMER_SERVICE.oneQualifiedStaffBps,
    cfg.departments.effects.CUSTOMER_SERVICE.capBps,
  );
}

/** 财务：对「固定管理费 + 其他可控运营费」的节省比例。 */
export function financeEffect(cfg: EconomyConfig, staff: Employee[]): DeptEffect {
  return buildEffect(
    cfg,
    'FINANCE',
    staff,
    cfg.departments.effects.FINANCE.oneQualifiedStaffBps,
    cfg.departments.effects.FINANCE.capBps,
  );
}

/** 市场：对潜在需求（潜在订单）的提升比例（受交付产能 min 限制，在收入端体现）。 */
export function marketingEffect(cfg: EconomyConfig, staff: Employee[]): DeptEffect {
  return buildEffect(
    cfg,
    'MARKETING',
    staff,
    cfg.departments.effects.MARKETING.oneQualifiedStaffBps,
    cfg.departments.effects.MARKETING.capBps,
  );
}

/** HR：对主营业务员工产能的提升比例（不突破订单上限——收入仍取 min）。 */
export function hrCapacityEffect(cfg: EconomyConfig, staff: Employee[]): DeptEffect {
  return buildEffect(
    cfg,
    'HR',
    staff,
    cfg.departments.effects.HR.businessCapacityOneStaffBps,
    cfg.departments.effects.HR.businessCapacityCapBps,
  );
}

/**
 * HR 招聘费折扣 bps（仅对「支付当时已生效」的 HR 员工生效，见 05.3）。
 * 每名已生效 HR 员工 oneStaff，封顶 recruitmentDiscountCapBps。
 * 与产能效益相互独立，不使用人数边际表（折扣线性、封顶）。
 */
export function hrRecruitmentDiscountBps(
  cfg: EconomyConfig,
  activeHrStaff: Employee[],
): number {
  const per = cfg.departments.effects.HR.recruitmentDiscountOneStaffBps;
  const cap = cfg.departments.effects.HR.recruitmentDiscountCapBps;
  return Math.min(cap, activeHrStaff.length * per);
}

/** 一次性汇总当月所有支持部门效益，供月结统一取用，保证每条费用只减一次。 */
export interface SupportEffectsSnapshot {
  procurement: DeptEffect;
  customerService: DeptEffect;
  finance: DeptEffect;
  marketing: DeptEffect;
  hrCapacity: DeptEffect;
  /** HR 招聘折扣 bps（招聘命令时单独按当时在岗计算，月结不用） */
  hrRecruitmentDiscountBps: number;
}

export function computeSupportEffects(
  cfg: EconomyConfig,
  state: { employees: Employee[]; departments: Department[] },
  monthIndex: number,
): SupportEffectsSnapshot {
  const procurementStaff = activeStaffInDept(state, 'PROCUREMENT', monthIndex);
  const csStaff = activeStaffInDept(state, 'CUSTOMER_SERVICE', monthIndex);
  const financeStaff = activeStaffInDept(state, 'FINANCE', monthIndex);
  const marketingStaff = activeStaffInDept(state, 'MARKETING', monthIndex);
  const hrStaff = activeStaffInDept(state, 'HR', monthIndex);
  return {
    procurement: procurementEffect(cfg, procurementStaff),
    customerService: customerServiceEffect(cfg, csStaff),
    finance: financeEffect(cfg, financeStaff),
    marketing: marketingEffect(cfg, marketingStaff),
    hrCapacity: hrCapacityEffect(cfg, hrStaff),
    hrRecruitmentDiscountBps: hrRecruitmentDiscountBps(cfg, hrStaff),
  };
}

/**
 * 月结推进时落地到期的调岗：把 pendingDepartment 正式写入 departmentId。
 * @param settledMonthIndex 刚结算完的月份轴索引（调岗在其下月生效，故比较 settled+1）。
 */
export function applyDueTransfers(state: Pick<GameState, 'employees'>, settledMonthIndex: number): void {
  for (const emp of state.employees) {
    if (
      emp.pendingDepartmentId &&
      typeof emp.transferFromMonthIndex === 'number' &&
      settledMonthIndex + 1 >= emp.transferFromMonthIndex
    ) {
      emp.departmentId = emp.pendingDepartmentId;
      emp.pendingDepartmentId = undefined;
      emp.transferFromMonthIndex = null;
    }
  }
}
