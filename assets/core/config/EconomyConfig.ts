/**
 * 经济配置类型（事实源：assets/resources/config/economy.v1.json，
 * 镜像自 docs/配置与测试数据/economy.v1.json，configVersion=economy-v1.0.0）。
 * 字段与设计文档 04 章一致；纯 TS 层与 Cocos 运行时共用。
 */
import type { IndustryId } from '../domain/types';


export interface IndustryConfig {
  label: string;
  firstYearDemandYuan: number;
  baseAnnualCapacityPerSkill60EmployeeYuan: number;
  directCostBps: number;
  otherOperatingCostBps: number;
  afterSalesCostBps: number;
  fixedManagementAnnualYuan: number;
  exampleEmployeeSalaryMonthlyYuan: number;
  procurementEligibleDirectCostBps: number;
}

/** 员工人数→边际效益乘数表（按人数索引，第 n 人为 table[n]，见 06.3）。 */
export type StaffMultiplierTable = readonly number[];

export interface HrEffect {
  effectOn: 'recruitmentFee_and_businessCapacity';
  recruitmentDiscountOneStaffBps: number;
  recruitmentDiscountCapBps: number;
  businessCapacityOneStaffBps: number;
  businessCapacityCapBps: number;
}

export interface ProcurementEffect {
  effectOn: 'eligibleDirectCost';
  oneQualifiedStaffBps: number;
  capBps: number;
}

export interface MarketingEffect {
  effectOn: 'potentialDemand';
  oneQualifiedStaffBps: number;
  capBps: number;
}

export interface CustomerServiceEffect {
  effectOn: 'afterSalesCost';
  oneQualifiedStaffBps: number;
  capBps: number;
}

export interface FinanceEffect {
  effectOn: 'fixedPlusOtherOperatingCost';
  oneQualifiedStaffBps: number;
  capBps: number;
}

export interface DepartmentEffects {
  HR: HrEffect;
  PROCUREMENT: ProcurementEffect;
  MARKETING: MarketingEffect;
  CUSTOMER_SERVICE: CustomerServiceEffect;
  FINANCE: FinanceEffect;
}

export interface Policies {
  STEADY: { autoHireMarginThresholdBps: number; cashReserveMonths: number };
  GROWTH: { autoHireMarginThresholdBps: number; cashReserveMonths: number };
  PROFIT: { autoHireMarginThresholdBps: number; cashReserveMonths: number };
}

export interface Demand {
  naturalAnnualGrowthBps: number;
  acquisitionMultiplierMinBps: number;
  acquisitionMultiplierMaxBps: number;
  ceoBusinessPerPointBps: number;
  defaultCompletionRateBps: number;
}

export interface Productivity {
  skillBaseBps: number;
  skillPerPointBps: number;
  ceoManagementPerPointFrom50Bps: number;
  teamworkPerPointFrom50Bps: number;
  minGroupModifierBps: number;
  maxGroupModifierBps: number;
  businessAssetCapBps: number;
  businessAssetPer10000YuanBps: number;
  businessAssetInvestStepYuan: number;
  annualDepreciationBpsFromNextYear: number;
}

export interface Time {
  onlineYearDurationMsAt1x: number;
  onlineSpeedMultipliers: number[];
  monthsPerYear: number;
  offlineRealMsPerGameMonth: number;
  maxOfflineMonthsPerSession: number;
  maxEligibleOfflineMsPerSession: number;
}

export interface Recruitment {
  candidateCount: number;
  salaryMonthlyYuanMin: number;
  salaryMonthlyYuanMax: number;
  maxAutoHiresPerMonth: number;
  maxAutoHiresPerYear: number;
  tenurePayMonthCeil: number;
  annualSkillGrowthDenominator: number;
}

export interface Departments {
  setupFeeYuan: number;
  /** 第 n 名在岗员工的边际乘数表（bps），索引 0 无人=0；超出表长按末档。 */
  staffMultiplierBps: readonly number[];
  /** 员工技能对部门效益的系数上限/下限（bps，skill 映射后钳制）。 */
  maxSkillFactorBps: number;
  minSkillFactorBps: number;
  effects: DepartmentEffects;
}

export interface Risk {
  eventAnnualChanceBps: number;
  eventMaxPerYear: number;
  eventEffectMinBps: number;
  eventEffectMaxBps: number;
  oneTimeRescueCapitalYuan: number;
  cashWarningRequiredMonths: number;
}

export interface Save {
  schemaVersion: number;
  targetMaxBytesPerSlot: number;
  rollingMonthlyLedgers: number;
  keepAnnualReports: number;
  keepRecentEventDetails: number;
}

export interface LocalBots {
  count: number;
  initialAssetYuanMin: number;
  initialAssetYuanMax: number;
  initialCompletedYearsMin: number;
  initialCompletedYearsMax: number;
  baseAnnualAssetGrowthBpsMin: number;
  baseAnnualAssetGrowthBpsMax: number;
  yearJitterBpsMin: number;
  yearJitterBpsMax: number;
  sharedSeed: string;
}

export interface Player {
  initialCapitalYuan: number;
  initialEmployeeCount: number;
  continuousProfitYearsForGoal: number;
  maxMoneyYuan: number;
}

export interface Ui {
  designWidthLogicalPx: number;
  designHeightLogicalPx: number;
  minTouchTargetLogicalPx: number;
}

export interface EconomyConfig {
  configVersion: string;
  currency: string;
  ratioUnit: string;
  player: Player;
  time: Time;
  recruitment: Recruitment;
  departments: Departments;
  policies: Policies;
  demand: Demand;
  productivity: Productivity;
  industry: Record<IndustryId, IndustryConfig>;
  risk: Risk;
  save: Save;
  localBots: LocalBots;
  ui: Ui;
}
