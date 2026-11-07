/**
 * 核心领域类型（设计文档 02.2 / 02.3 字段字典）。
 * 本文件同时是存档 JSON Schema 的 TS 事实来源，字段命名与 save.schema.json 对齐。
 */

export type IndustryId = 'TRADE' | 'SOFTWARE' | 'SERVICE';
export type DeptType =
  | 'BUSINESS'
  | 'HR'
  | 'PROCUREMENT'
  | 'MARKETING'
  | 'CUSTOMER_SERVICE'
  | 'FINANCE';
export type SupportDeptType = Exclude<DeptType, 'BUSINESS'>;
export type Policy = 'STEADY' | 'GROWTH' | 'PROFIT';
export type CashRisk = 'NORMAL' | 'WARNING' | 'DISTRESS';
export type CeoTrait = 'BOLD' | 'STEADY' | 'PEOPLE';
export type EmployeePersonality = 'BOLD' | 'STEADY' | 'COLLABORATIVE';
export type EmployeeStatus = 'ACTIVE' | 'PENDING_DISMISSAL' | 'DISMISSED';
export type StaffingMode = 'AUTO' | 'LOCKED';
export type GameSpeed = 0 | 1 | 2 | 5;

export type GamePhase =
  | 'CREATING'
  | 'HIRING_INITIAL'
  | 'TUTORIAL_DASHBOARD'
  | 'RUNNING'
  | 'DISTRESS'
  | 'RESETTING';

export const INDUSTRIES: readonly IndustryId[] = ['TRADE', 'SOFTWARE', 'SERVICE'];
export const SUPPORT_DEPARTMENTS: readonly SupportDeptType[] = [
  'HR',
  'PROCUREMENT',
  'MARKETING',
  'CUSTOMER_SERVICE',
  'FINANCE',
];
export const CEO_TRAITS: readonly CeoTrait[] = ['BOLD', 'STEADY', 'PEOPLE'];

export interface Company {
  companyId: string;
  name: string;
  industry: IndustryId;
  foundedYear: number;
  cashYuan: number;
  initialCapitalYuan: number;
  paidInCapitalYuan: number;
  businessAssetBookYuan: number;
  businessCapacityInvestmentYuan: number;
  businessCapacityBonusBps: number;
  marketDemandIndexBps: number;
}

export interface Ceo {
  name: string;
  trait: CeoTrait;
  businessSkill: number;
  managementSkill: number;
  financeSkill: number;
}

export interface Employee {
  employeeId: string;
  name: string;
  avatarId: string;
  departmentId: string;
  skill: number;
  potential: number;
  teamwork: number;
  personality: EmployeePersonality;
  salaryMonthlyYuan: number;
  hiredAtMonthIndex: number;
  effectiveFromMonthIndex: number;
  dismissedAtMonthIndex: number | null;
  /** 调岗：目标部门（下月生效前仍在原部门）。 */
  pendingDepartmentId?: string;
  /** 调岗生效月份轴索引。 */
  transferFromMonthIndex?: number | null;
  status: EmployeeStatus;
  /** 录用该员工的命令 ID（幂等重放依据，不展示给玩家）。 */
  hireCommandId?: string;
  /** 来源候选 ID（防止同一候选被重复录用）。 */
  candidateId?: string;
  /** 因年度事件「意外离职」而离岗（无裁员补偿）。 */
  leftVoluntarily?: boolean;
}

export interface Department {
  deptId: string;
  type: DeptType;
  enabled: boolean;
  staffingMode: StaffingMode;
  targetCount: number;
  createdMonthIndex: number;
  setupPaid: boolean;
}

export interface Candidate {
  candidateId: string;
  name: string;
  avatarId: string;
  skill: number;
  potential: number;
  teamwork: number;
  personality: EmployeePersonality;
  salaryMonthlyYuan: number;
  /** 候选倾向标签：A 即战力 / B 潜力股 / C 经济型 */
  archetype: 'A' | 'B' | 'C';
}

export interface CandidateOffer {
  offerId: string;
  deptId: string;
  generatedForIndex: number;
  expiresAtMonthIndex: number;
  offerSequence: number;
  candidates: readonly Candidate[];
}

export type JournalCategory =
  | 'REVENUE'
  | 'DIRECT_COST'
  | 'OTHER_OPERATING'
  | 'AFTER_SALES'
  | 'FIXED_COST'
  | 'PAYROLL'
  | 'RECRUITMENT'
  | 'SEVERANCE'
  | 'DEPT_SETUP'
  | 'EVENT'
  | 'DEPRECIATION'
  | 'CAPEX'
  | 'CAPITAL_INJECTION';

export interface JournalEntry {
  entryId: string;
  monthKey: string;
  category: JournalCategory;
  amountYuan: number;
  isCash: boolean;
  /** 该笔现金是否已在命令确认时实际扣付（月结不可再次扣现金）。 */
  alreadyPaid: boolean;
  refId?: string;
}

export interface MonthlyLedger {
  runId: string;
  year: number;
  month: number;
  revenueYuan: number;
  directCostYuan: number;
  otherOperatingCostYuan: number;
  afterSalesCostYuan: number;
  fixedCostYuan: number;
  payrollYuan: number;
  recruitmentCostYuan: number;
  severanceCostYuan: number;
  deptSetupCostYuan: number;
  eventCostYuan: number;
  depreciationYuan: number;
  profitYuan: number;
  /** 归属该月的全部现金变化（含已在命令时支付的款项），用于年报勾稽。 */
  cashDeltaYuan: number;
}

export interface AnnualReport {
  year: number;
  revenueYuan: number;
  directCostYuan: number;
  otherOperatingCostYuan: number;
  afterSalesCostYuan: number;
  fixedCostYuan: number;
  payrollYuan: number;
  recruitmentCostYuan: number;
  severanceCostYuan: number;
  deptSetupCostYuan: number;
  eventCostYuan: number;
  depreciationYuan: number;
  profitYuan: number;
  cashOpenYuan: number;
  cashCloseYuan: number;
  assetCloseYuan: number;
  headcountClose: number;
  settled: boolean;
  /** New reports record capital flows separately; absent on backward-compatible legacy saves. */
  cashBridge?: {
    monthlyLedgerNetCashDeltaYuan: number;
    investmentCashFlowYuan: number;
    rescueCapitalYuan: number;
    unattributedCashFlowYuan: number;
    attributionComplete: boolean;
    balanced: boolean;
  };
}

export interface EventRecord {
  eventId: string;
  type: string;
  effectYuan: number;
  year: number;
  month: number;
}

/** 五种轻度年度事件（设计 3.7，每年至多 1 次、概率 25%、固定 seed）。 */
export type AnnualEventType =
  | 'ORDER_SURGE' // 订单临时增加（潜在订单 +）
  | 'ORDER_DROP' // 订单临时减少（潜在订单 −）
  | 'COST_RISE' // 采购/成本上涨（一次性成本）
  | 'EMPLOYEE_LEAVE' // 员工意外离职（次月移除、无补偿）
  | 'ASSET_LOSS'; // 一次性设备/售后损失（一次性成本）

export interface AnnualEvent {
  /** 唯一键 `${runId}:${year}`，保证一年只生成一次 */
  key: string;
  year: number;
  /** 是否发生（75% 为 false，即该年无事件） */
  happened: boolean;
  type: AnnualEventType | null;
  /** 发生月份 1..12（已发生时） */
  month: number;
  /** 影响幅度 bps（500..1200，作用于相关基数的百分比） */
  effectBps: number;
  /** 影响金额（费用事件为正=损失；离职事件为 0） */
  amountYuan: number;
  /** 离职事件选中的员工 id */
  employeeId?: string;
  /** 是否已在月结中应用（防重复） */
  applied: boolean;
}

/** 自动招聘等自动化决策的可解释日志（最近保留若干条，不参与财务勾稽）。 */
export interface AutomationLogEntry {
  logId: string;
  year: number;
  month: number;
  kind: 'AUTO_HIRE' | 'AUTO_SKIP';
  deptType: DeptType | null;
  candidateId?: string;
  /** 预计 12 个月新增贡献（元） */
  projectedBenefitYuan?: number;
  /** 预计 12 个月工资+招聘费（元） */
  projectedCostYuan?: number;
  /** 跳过/录用原因（可解释） */
  reason: string;
}

export interface BotCompany {
  botId: string;
  name: string;
  assetsYuan: number;
  yearsOperated: number;
  initialAssetsYuan: number;
  baseGrowthBps: number;
}

export interface OnboardingState {
  stepId: string;
  completedSteps: string[];
  skipped: boolean;
  lastKnownStep: string;
  tutorialVersion: number;
  initialHiresCompleted: number;
}

export interface GameState {
  phase: GamePhase;
  runId: string;
  seed: number;
  rngCounter: number;
  initializedCapital: boolean;
  gameYear: number;
  gameMonth: number;
  progressMsInMonth: number;
  speed: GameSpeed;
  lastWallClockMs: number;
  lastSettledMonthKey: string | null;
  offlineRemainderMs: number;
  onboarding: OnboardingState;
  company: Company | null;
  ceo: Ceo | null;
  employees: Employee[];
  departments: Department[];
  offers: CandidateOffer[];
  policy: Policy;
  monthlyLedgersRolling: MonthlyLedger[];
  annualReports: AnnualReport[];
  pendingEntries: JournalEntry[];
  eventHistory: EventRecord[];
  /** 各年度事件计划（每年至多 1 条，固定 seed 惰性生成；含未发生年）。 */
  annualEvents: AnnualEvent[];
  botCompanies: BotCompany[];
  consecutiveProfitableYears: number;
  target3YearsAchieved: boolean;
  rescueCapitalUsed: boolean;
  cashRisk: CashRisk;
  /** 自动招聘记录：key=`${year}` → 该年已自动录用人数（每年最多 maxAutoHiresPerYear）。 */
  autoHireCountByYear: Record<number, number>;
  /** 最近的自动化决策日志（保留最近若干条，可解释、不参与财务）。 */
  automationLogs: AutomationLogEntry[];
  /** 各经营年第 1 月结算前的现金快照（年报 cashOpen 口径，含初始注资）。 */
  yearOpenCashYuan: Record<number, number>;
  /** 年结前未进入月账的资本现金流，仅记录真实命令变动；旧档可缺省。 */
  cashFlowsByYear?: Record<number, { investmentOutYuan: number; rescueInYuan: number }>;
  /** 首个可追溯现金流年度；旧档升级时从首次写入该字段的年度开始。 */
  cashFlowTrackingStartYear?: number;
  executedCommandIds: string[];
  /** Optional for legacy saves. Ad counters/coupons survive company reset but not reward sessions. */
  adRewards?: AdRewardState;
}

export interface AdRewardState {
  version?: 2;
  /** Highest UTC+8 calendar day observed. Clock rollback cannot reopen quota. */
  maxObservedDayIndex?: number;
  requestsUsed?: number;
  lastRequestAtMs?: number | null;
  localDay: string;
  promptsShown: number;
  grantsUsed: number;
  couponIds: string[];
  completedSessionIds: string[];
  /** Terminal old-owner sessions that were canceled/quarantined without a reward. */
  quarantinedSessionIds?: string[];
  activeSessionId?: string | null;
  activeSessionStartedAtMs?: number | null;
  activeRunId?: string | null;
  activeSessionReservedDayIndex?: number | null;
  activeOwnerScope?: string | null;
  grantDayIndexes?: number[];
  consumedCouponIds?: string[];
  couponCreatedAtMsById?: Record<string, number>;
  couponRunIdById?: Record<string, string>;
  couponOwnerScopeById?: Record<string, string>;
  quarantinedOwnerScopeById?: Record<string, string>;
}
