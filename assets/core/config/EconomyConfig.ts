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

export interface StaffMultiplierBps {
  staffCount: number;
  multiplierBps: number;
}

export interface DepartmentEffects {
  recruitmentDiscountOneStaffBps: number;
  recruitmentDiscountCapBps: number;
  recruitmentDiscountOneStaffHrBusinessCapacityBps: number;
  businessCapacityCapBps: number;
  staffMultiplierBps: readonly StaffMultiplierBps[];
  maxSkillFactorBps: number;
  minSkillFactorBps: number;
  effects: {
    HR: { oneQualifiedStaffBps: number; totalMaxBps: number };
    PROCUREMENT: {
      oneQualifiedStaffBps: number;
      capBps: number;
      eligiblePart: string;
    };
    MARKETING: { oneQualifiedStaffBps: number; capBps: number };
    CUSTOMER_SERVICE: { oneQualifiedStaffBps: number; capBps: number };
    FINANCE: {
      fixedManagementPlusOtherControllable: string;
      oneQualifiedStaffBps: number;
    };
  };
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
  effects: DepartmentEffects;
}

export interface Risk {
  eventAnnualChanceBps: number;
  eventMaxPerYear: number;
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
