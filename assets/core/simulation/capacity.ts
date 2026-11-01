import type { EconomyConfig } from '../config/EconomyConfig';
import type { Ceo, Department, Employee, IndustryId } from '../domain/types';
import { roundHalfUp } from '../domain/money';

/**
 * 交付产能（设计文档 03.3）。
 *
 * C_m = Σ_year(单人年产能/12 × (7000 + skill*50)/10000 × collabCoeff × ceoMgmtCoeff ×
 *       hrCapacityCoeff × businessAssetCoeff)
 *
 * 基础：能力 60 → 系数 1.0；团队协作 50 → 系数 1.0；CEO 管理 50 → 系数 1.0。
 * 首年 2 名 skill60/teamwork50 员工：单人 40 万，协作与 CEO 系数均 1 → 年产能 80 万。
 */

export interface TeamComposition {
  /** 当月生效的业务交付员工 */
  businessEmployees: Employee[];
  ceo: Ceo | null;
  departments: Department[];
  /** 已投入业务扩张资产（元） */
  businessCapacityInvestmentYuan: number;
}

function clampBps(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** 单名员工的技能系数 bps（skill 60 → 10000）。 */
export function skillCoeffBps(cfg: EconomyConfig, skill: number): number {
  return cfg.productivity.skillBaseBps + skill * cfg.productivity.skillPerPointBps;
}

/** 团队协作系数 bps（平均 teamwork 50 → 10000）。 */
export function collaborationCoeffBps(
  cfg: EconomyConfig,
  businessEmployees: Employee[],
): number {
  if (businessEmployees.length === 0) return 10_000;
  const avgTeamwork =
    businessEmployees.reduce((s, e) => s + e.teamwork, 0) / businessEmployees.length;
  const delta = (avgTeamwork - 50) * cfg.productivity.teamworkPerPointFrom50Bps;
  return clampBps(
    10_000 + delta,
    cfg.productivity.minGroupModifierBps,
    cfg.productivity.maxGroupModifierBps,
  );
}

/** CEO 管理系数 bps（管理 50 → 10000，每点 +ceoManagementPerPointFrom50Bps）。 */
export function ceoManagementCoeffBps(cfg: EconomyConfig, ceo: Ceo | null): number {
  if (!ceo) return 10_000;
  const delta = (ceo.managementSkill - 50) * cfg.productivity.ceoManagementPerPointFrom50Bps;
  return 10_000 + delta;
}

/** 业务资产扩张系数 bps：每 1 万元 +businessAssetPer10000Bps，封顶 businessAssetCapBps。 */
export function businessAssetCoeffBps(cfg: EconomyConfig, investmentYuan: number): number {
  const per = Math.floor(investmentYuan / 10_000) * cfg.productivity.businessAssetPer10000YuanBps;
  return 10_000 + Math.min(per, cfg.productivity.businessAssetCapBps);
}

/** HR 部门产能加成 bps（M2 接入；M1 返回 10000）。预留签名。 */
export function hrCapacityCoeffBps(departments: Department[]): number {
  void departments;
  return 10_000;
}

export interface CapacityBreakdown {
  /** 当月交付产能（元） */
  monthlyCapacityYuan: number;
  /** 等效年产能（元，= 月产能 *12，便于解释） */
  annualizedCapacityYuan: number;
  collaborationBps: number;
  ceoManagementBps: number;
  assetBps: number;
  headcount: number;
  /** 每名员工当月产能（元），用于解释 */
  perEmployee: Array<{ employeeId: string; skill: number; monthlyYuan: number }>;
}

/**
 * 计算当月团队交付产能。
 * 只统计在当月已生效（effectiveFromMonthIndex <= monthIndex）且在职的业务部员工。
 *
 * 舍入（设计 03.5）：个人年度基础产能先按技能系数取整到年值，
 * 再按"前11月截断、第12月补差"分配，保证全年合计精确等于年产能。
 * 团队级乘数（协作/CEO/HR/资产）每月相同，月值取整后全年仍守恒（乘数恒定）。
 */
export function monthlyCapacity(
  cfg: EconomyConfig,
  industry: IndustryId,
  comp: TeamComposition,
  monthIndex: number,
): CapacityBreakdown {
  const annualPerEmployee60 =
    cfg.industry[industry].baseAnnualCapacityPerSkill60EmployeeYuan;
  const active = comp.businessEmployees.filter(
    (e) => e.status === 'ACTIVE' && e.effectiveFromMonthIndex <= monthIndex,
  );

  const collaborationBps = collaborationCoeffBps(cfg, active);
  const ceoBps = ceoManagementCoeffBps(cfg, comp.ceo);
  const hrBps = hrCapacityCoeffBps(comp.departments);
  const assetBps = businessAssetCoeffBps(cfg, comp.businessCapacityInvestmentYuan);
  const teamMultiplierBps = (collaborationBps * ceoBps * hrBps * assetBps) / 10_000 ** 3;

  const perEmployee = active.map((e) => {
    const skillBps = skillCoeffBps(cfg, e.skill);
    // 个人年产能（基准 skill60 为满额），先取整年值
    const personalAnnual = roundHalfUp((annualPerEmployee60 * skillBps) / 10_000);
    const monthInYear = monthIndex % 12;
    const baseMonthly = Math.trunc(personalAnnual / 12);
    // 第 12 月用残差，保证全年合计精确
    const personalMonthly =
      monthInYear === 11 ? personalAnnual - baseMonthly * 11 : baseMonthly;
    const monthlyYuan = roundHalfUp((personalMonthly * teamMultiplierBps) / 10_000);
    return { employeeId: e.employeeId, skill: e.skill, monthlyYuan };
  });

  const monthlyCapacityYuan = perEmployee.reduce((s, p) => s + p.monthlyYuan, 0);

  return {
    monthlyCapacityYuan,
    annualizedCapacityYuan: monthlyCapacityYuan * 12,
    collaborationBps,
    ceoManagementBps: ceoBps,
    assetBps,
    headcount: active.length,
    perEmployee,
  };
}
