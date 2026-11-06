import { GameError, GameErrorCode, errorMessage } from '../domain/errors';
import type { CommandResult } from '../domain/result';
import { ok, fail } from '../domain/result';
import type { IStorageBackend, ITapPlatform } from '../platform/ITapPlatform';
import { GameStore } from './GameStore';
import { createCompany, type CreateCompanyInput } from './CompanyService';
import { getOffer, refreshOffer } from './OfferService';
import { hireEmployee, previewHire, startOperating, skipTutorial } from './RecruitmentService';
import { closeCompanyPreview, confirmCloseCompany } from './ResetService';
import { createInitialState } from '../domain/gameStateFactory';
import type { AnnualReport, CandidateOffer, Employee, GameSpeed, GameState, IndustryId, MonthlyLedger } from '../domain/types';
import { NameGenerator } from '../domain/NameGenerator';
import { Rng, deriveSeed } from '../simulation/rng';
import { GameClock, type ClockTickResult } from '../simulation/GameClock';
import { investInBusiness, previewInvest, type InvestPreview } from './InvestmentService';
import { buildCompanyOverview, type CompanyOverview } from './CompanyOverviewService';
import { buildDepartmentOverview, type DepartmentOverview } from './DepartmentOverviewService';
import {
  buildTalentOverview,
  buildTransferImpact,
  estimateLayoffCapacityLoss,
  transferTargets,
  type TalentOverview,
  type TransferImpactVM,
} from './TalentOverviewService';
import {
  createDepartment,
  previewCreateDepartment,
  setStaffingMode,
  setTargetCount,
} from './DepartmentService';
import {
  previewLayoff,
  createLayoffToken,
  confirmLayoff,
  type LayoffPreview,
  type LayoffToken,
} from './LayoffService';
import { runMonthlyAutoHire, appendAutomationLog } from './AutoHireService';
import { previewTransfer, transferEmployee } from './TransferService';
import { injectRescueCapital, assessRisk, refreshRisk } from './RiskService';
import { settleOffline } from '../simulation/offline';
import { assetsLeaderboard, yearsLeaderboard } from '../simulation/leaderboard';
import type { AutomationLogEntry, Department, DeptType, Policy, StaffingMode, SupportDeptType } from '../domain/types';
import type { EconomyConfig } from '../config/EconomyConfig';
import { beginAdSession, cancelAdSession, canRequestAdCoupon, grantAdCoupon, markAdPromptShown } from './AdRewardService';
import { createCloudCheckpoint } from '../persistence/CloudSaveCodec';
import { encodeEnvelope } from '../persistence/SaveCodec';
import type { CloudCheckpointV1 } from '../persistence/CloudSaveTypes';

export interface BootstrapResult {
  state: GameState;
  recovered: boolean;
  recoveryNote?: string;
  environment: 'EDITOR' | 'TAPTAP';
}

/** R13：启动装载结果（可写 facade 仅在已确认档/新游戏时存在）。 */
export type FacadeBootstrapResult =
  | { kind: 'new-game'; facade: GameFacade }
  | { kind: 'loaded'; facade: GameFacade }
  | { kind: 'recovered'; facade: GameFacade; note?: string }
  | { kind: 'unavailable'; reason: string; message: string }
  | { kind: 'corrupt'; message: string };

function toFailure(err: unknown): CommandResult<never> {
  const code = err instanceof GameError
    ? err.code
    : err instanceof Error && err.message in GameErrorCodeLike
      ? (err.message as GameErrorCode)
      : GameErrorCode.NOT_READY;
  const details = err instanceof GameError ? err.details : undefined;
  return details ? { ok: false, code, displayMessage: errorMessage(code), details: { ...details } } : fail(code, errorMessage(code));
}

const GameErrorCodeLike: Record<string, true> = Object.fromEntries(
  Object.values(GameErrorCode).map((c) => [c, true]),
);

/**
 * 应用外观（设计文档 01.4）。
 * M0 阶段编排：bootstrap、rollCompanyNames、createCompany、首聘、开始经营、关闭重开。
 * 所有命令在 GameStore 的串行锁内执行，成功后持久化；失败不改状态。
 */
export class GameFacade {
  private store: GameStore;
  private readonly platform: IStorageBackend;
  private readonly cfg: EconomyConfig;
  private readonly clock = new GameClock();

  private constructor(platform: IStorageBackend, store: GameStore, cfg: EconomyConfig) {
    this.platform = platform;
    this.store = store;
    this.cfg = cfg;
    // 自动招聘在每月月结前同一变更锁内执行（保守、可解释、禁自动裁员）
    this.clock.beforeMonthSettle = (s) => {
      const decision = runMonthlyAutoHire(s, this.cfg);
      appendAutomationLog(s, decision);
    };
    // 月结后刷新现金风险；进入 DISTRESS 时返回 false 让时钟冻结
    this.clock.afterMonthSettle = (s) => refreshRisk(s, this.cfg) !== 'DISTRESS';
  }

  static async bootstrap(platform: ITapPlatform, cfg: EconomyConfig): Promise<GameFacade> {
    const loaded = await GameStore.load(platform);
    const store = loaded ?? new GameStore(platform, createInitialState(Date.now()));
    return new GameFacade(platform, store, cfg);
  }

  /**
   * R13：显式启动装载。只有 new-game/loaded/recovered 返回可写 facade；
   * unavailable/corrupt 返回结果但不创建 facade，UI 必须显示重试/退出且禁止写入。
   */
  static async bootstrapWithStatus(
    platform: IStorageBackend,
    cfg: EconomyConfig,
  ): Promise<FacadeBootstrapResult> {
    const result = await GameStore.inspectForBootstrap(platform);
    if (result.kind === 'new-game') {
      return {
        kind: 'new-game',
        facade: new GameFacade(platform, new GameStore(platform, createInitialState(Date.now())), cfg),
      };
    }
    if (result.kind === 'loaded' || result.kind === 'recovered') {
      const note = result.kind === 'recovered' ? result.note : undefined;
      return { kind: result.kind, facade: new GameFacade(platform, result.store, cfg), note } as FacadeBootstrapResult;
    }
    return result;
  }

  /** 测试/首启直接注入存储。 */
  static async fromStorage(
    storage: IStorageBackend & ITapPlatform,
    cfg: EconomyConfig,
  ): Promise<GameFacade> {
    return GameFacade.bootstrap(storage, cfg);
  }

  getState(): GameState {
    return this.store.current;
  }

  canRequestRewardedAd(nowMs = Date.now()): boolean {
    return canRequestAdCoupon(this.store.current, nowMs);
  }

  getRevision(): number {
    return this.store.currentRevision;
  }

  async importCloudCheckpointState(state: GameState, expectedRunId: string, expectedRevision: number, nowMs = Date.now()): Promise<CommandResult<true>> {
    try {
      // A24-08：同 run 走普通日志提交；活跃不同 run 走显式整档替换事务（墓碑 + replace-run）。
      const revision = await this.store.replaceWithCloudState(state, expectedRunId, expectedRevision, nowMs);
      return ok(this.store.current.runId, revision, true);
    } catch (err) { return toFailure(err); }
  }

  /** 云 backup/榜提交使用同一份冻结快照：捕获后不得再从实时 state 回读。 */
  captureCloudCheckpoint(input: {
    appId: string;
    environment: 'test' | 'production';
    cloudProfileId: string;
    checkpointId: string;
    parentCheckpointIds: string[];
    resetEpoch: CloudCheckpointV1['resetEpoch'];
    deviceInstanceId: string;
    capturedAtMs: number;
  }): CloudCheckpointV1 {
    const state = this.store.current;
    return createCloudCheckpoint({
      ...input,
      localRevision: this.store.currentRevision,
      snapshot: encodeEnvelope(state, {
        revision: this.store.currentRevision,
        runId: state.runId,
        resetGeneration: this.store.currentResetGeneration,
      }),
    });
  }

  getPersistenceStatus() {
    return this.store.getPersistenceStatus();
  }

  async retryPersistenceRecovery(): Promise<boolean> {
    return this.store.retryPersistenceRecovery(this.store.current.runId);
  }

  /** Called by a voluntary UI prompt/entry; persisted in the same store gate as gameplay. */
  async markRewardPromptShown(nowMs = Date.now()): Promise<CommandResult<boolean>> {
    const runId = this.store.current.runId;
    try {
      const { result, revision } = await this.store.mutate((draft) => markAdPromptShown(draft, nowMs), runId);
      return ok(this.store.current.runId, revision, result);
    } catch (err) { return toFailure(err); }
  }

  async beginRewardedAdSession(sessionId: string, nowMs = Date.now(), expectedRunId = this.store.current.runId): Promise<CommandResult<boolean>> {
    const runId = expectedRunId;
    try {
      const { result, revision } = await this.store.mutate((draft) => beginAdSession(draft, sessionId, nowMs), runId);
      return ok(this.store.current.runId, revision, result);
    } catch (err) { return toFailure(err); }
  }

  async cancelRewardedAdSession(sessionId: string, expectedRunId = this.store.current.runId): Promise<CommandResult<true>> {
    const runId = expectedRunId;
    try {
      const { revision } = await this.store.mutate((draft) => { cancelAdSession(draft, sessionId, runId); return true as const; }, runId);
      return ok(this.store.current.runId, revision, true);
    } catch (err) { return toFailure(err); }
  }

  /** Only the coordinator calls this after provider's explicit completed callback. */
  async completeRewardedAdSession(sessionId: string, nowMs = Date.now(), expectedRunId = this.store.current.runId): Promise<CommandResult<boolean>> {
    const runId = expectedRunId;
    try {
        const { result, revision } = await this.store.mutate((draft) => grantAdCoupon(draft, sessionId, nowMs, runId), runId);
      return ok(this.store.current.runId, revision, result);
    } catch (err) { return toFailure(err); }
  }

  /**
   * 公司名刷新使用独立 RNG 流，不改变市场事件序列。
   * @param nonce 批次序号：调用方每次点击「换一批」递增，用于换出不同名字。
   *              （同一 nonce 结果稳定，便于回放与测试）
   */
  rollCompanyNames(industry: IndustryId, count = 3, nonce = 0): string[] {
    const state = this.store.current;
    const rng = new Rng(deriveSeed(state.seed, 'companyName', state.rngCounter));
    // 刷新不推进市场 RNG：用 rngCounter 的临时派生子流，且不写回
    const generator = new NameGenerator(rng.derive(`names:${state.rngCounter}:${nonce}`));
    return generator.rollCompanyNames(industry, count);
  }

  async createCompany(
    input: CreateCompanyInput,
    ctx: { commandId: string; expectedRunId: string; expectedRevision?: number },
  ): Promise<CommandResult<{ companyId: string; cashYuan: number }>> {
    try {
      const { result, revision } = await this.store.mutate(
        (draft) => createCompany(draft, input, ctx),
        ctx.expectedRunId,
      );
      return ok(this.store.current.runId, revision, {
        companyId: result.companyId,
        cashYuan: result.cashYuan,
      });
    } catch (err) {
      return toFailure(err);
    }
  }

  getOffer(deptId: string): CandidateOffer {
    return this.store.read((s) => getOffer(s, deptId));
  }

  /** R26：只读招聘预览（真实 HR 折扣费用、现金影响、生效时点），供确认弹窗。 */
  previewHire(input: {
    offerId: string;
    candidateId: string;
    departmentId: string;
    couponId?: string;
  }): CommandResult<import('./RecruitmentService').HirePreview> {
    try {
      const result = this.store.read((s) => previewHire(s, this.cfg, input));
      return ok(this.store.current.runId, this.store.currentRevision, result);
    } catch (err) {
      return toFailure(err);
    }
  }

  async refreshOffer(
    deptId: string,
    ctx: { commandId: string; expectedRunId: string },
  ): Promise<CommandResult<CandidateOffer>> {
    try {
      const { result, revision } = await this.store.mutate(
        (draft) => refreshOffer(draft, deptId),
        ctx.expectedRunId,
      );
      return ok(this.store.current.runId, revision, result);
    } catch (err) {
      return toFailure(err);
    }
  }

  async hireEmployee(
    input: { offerId: string; candidateId: string; departmentId: string; couponId?: string; expectedRevision?: number },
    ctx: { commandId: string; expectedRunId: string },
  ): Promise<CommandResult<{ employee: Employee; feePaidYuan: number; cashAfterYuan: number }>> {
    try {
      const { result, revision } = await this.store.mutate(
        (draft) => {
          // A retry of the same committed command remains idempotent after recovery.
          // A new command must still match the preview revision or require a fresh quote.
          if (!draft.executedCommandIds.includes(ctx.commandId)
            && input.expectedRevision !== undefined
            && this.store.currentRevision !== input.expectedRevision) {
            throw new GameError(GameErrorCode.CONFIRMATION_EXPIRED, { reason: 'hire-preview-stale' });
          }
          return hireEmployee(draft, this.cfg, input, ctx);
        },
        ctx.expectedRunId,
      );
      return ok(this.store.current.runId, revision, {
        employee: result.employee,
        feePaidYuan: result.feePaidYuan,
        cashAfterYuan: result.cashAfterYuan,
      });
    } catch (err) {
      return toFailure(err);
    }
  }

  async startOperating(ctx: { commandId: string; expectedRunId: string }): Promise<CommandResult<true>> {
    try {
      const { revision } = await this.store.mutate(
        (draft) => startOperating(draft, ctx),
        ctx.expectedRunId,
      );
      return ok(this.store.current.runId, revision, true);
    } catch (err) {
      return toFailure(err);
    }
  }

  /** 跳过教学浮层（TC-055）：进入 RUNNING 但保持暂停，仍强制 2 名首聘已完成。 */
  async skipTutorial(ctx: { commandId: string; expectedRunId: string }): Promise<CommandResult<true>> {
    try {
      const { revision } = await this.store.mutate(
        (draft) => skipTutorial(draft, ctx),
        ctx.expectedRunId,
      );
      return ok(this.store.current.runId, revision, true);
    } catch (err) {
      return toFailure(err);
    }
  }

  beginCloseCompany(nowMs = Date.now()) {
    return this.store.read((s) => closeCompanyPreview(s, nowMs));
  }

  async confirmCloseCompany(
    token: { confirmationToken: string; expiresAtMs: number; oldRunId: string },
    nowMs = Date.now(),
  ): Promise<CommandResult<{ newRunId: string }>> {
    try {
      if (this.store.current.adRewards?.activeSessionId) throw new Error(GameErrorCode.RESET_IN_PROGRESS);
      await this.store.replaceWithNewRun(
        (confirmedState) => {
          const newState = confirmCloseCompany(confirmedState, token, nowMs).newState;
          if (confirmedState.adRewards) {
            const limits = { ...confirmedState.adRewards };
            delete limits.couponCreatedAtMsById;
            delete limits.couponRunIdById;
            newState.adRewards = { ...limits, couponIds: [], activeSessionId: null,
              activeSessionStartedAtMs: null, activeRunId: null };
          }
          return newState;
        },
        token.oldRunId,
        nowMs,
      );
      const newRunId = this.store.current.runId;
      return ok(newRunId, this.store.currentRevision, { newRunId });
    } catch (err) {
      return toFailure(err);
    }
  }

  getEnvironment(): 'EDITOR' | 'TAPTAP' {
    return (this.platform as ITapPlatform).getEnvironment();
  }

  // ---------------------------------------------------------------- M1 经营

  /** 设置倍速（0 暂停 / 1 / 2 / 5），成功后持久化。 */
  async setSpeed(
    speed: GameSpeed,
    ctx: { commandId: string; expectedRunId: string },
  ): Promise<CommandResult<true>> {
    try {
      await this.store.mutate((draft) => {
        this.clock.setSpeed(draft, speed);
        return { revision: 0 };
      }, ctx.expectedRunId);
      return ok(this.store.current.runId, this.store.currentRevision, true);
    } catch (err) {
      return toFailure(err);
    }
  }

  /**
   * 推进真实毫秒数（在线时钟）。可能触发多月/年结，成功后持久化。
   */
  async advanceRealTime(
    elapsedRealMs: number,
    expectedRunId: string,
    wallClockNowMs = Date.now(),
  ): Promise<CommandResult<ClockTickResult>> {
    try {
      const wallClockAt = Number.isSafeInteger(wallClockNowMs) && wallClockNowMs >= 0 ? wallClockNowMs : Date.now();
      const result = await this.store.mutate(
        (draft) => {
          const tick = this.clock.tick(draft, this.cfg, elapsedRealMs);
          draft.lastWallClockMs = Math.max(draft.lastWallClockMs, wallClockAt);
          return tick;
        },
        expectedRunId,
      );
      return ok(this.store.current.runId, this.store.currentRevision, result.result);
    } catch (err) {
      return toFailure(err);
    }
  }

  /** 扩产预览（只读，不改状态）。 */
  previewInvest(amount: number): CommandResult<InvestPreview> {
    try {
      return ok(
        this.store.current.runId,
        this.store.currentRevision,
        previewInvest(this.store.current, this.cfg, amount),
      );
    } catch (err) {
      return toFailure(err);
    }
  }

  /** 确认扩产（幂等由 ctx.commandId 保证）。 */
  async invest(
    amount: number,
    ctx: { commandId: string; expectedRunId: string },
  ): Promise<CommandResult<InvestPreview>> {
    try {
      const { result } = await this.store.mutate(
        (draft) => investInBusiness(draft, this.cfg, amount, ctx),
        ctx.expectedRunId,
      );
      return ok(this.store.current.runId, this.store.currentRevision, result);
    } catch (err) {
      return toFailure(err);
    }
  }

  /** R28：公司首页只读视图（现金/累计收支/产能/需求/风险），不改状态。 */
  getCompanyOverview(): CompanyOverview | null {
    return this.store.read((s) => buildCompanyOverview(s, this.cfg));
  }

  /** 最近年度报告（按年）。 */
  getAnnualReport(year: number): AnnualReport | null {
    return this.store.read((s) => s.annualReports.find((r) => r.year === year) ?? null);
  }

  /** 当年已结算月份（只读）。 */
  getYearLedgers(year: number): MonthlyLedger[] {
    const runId = this.store.current.runId;
    return this.store
      .read((s) => s.monthlyLedgersRolling.filter((l) => l.runId === runId && l.year === year));
  }

  // ---------------------------------------------------------------- M2 部门 / 裁员

  /** R29：部门页只读视图（人数/工资/系数/当月估算贡献/未建部门/自动预算），不改状态。 */
  getDepartmentOverview(): DepartmentOverview | null {
    return this.store.read((s) => buildDepartmentOverview(s, this.cfg));
  }

  /** R30：人才页只读视图（筛选、人数/月薪合计、入职月数、次月生效信息），不改状态。 */
  getTalentOverview(filterKey = 'ALL'): TalentOverview | null {
    return this.store.read((s) => buildTalentOverview(s, filterKey));
  }

  /** R30：调岗影响预览（原/目标部门人数与工资总额，次月生效）。 */
  getTransferImpact(employeeId: string, toDeptId: string): TransferImpactVM | null {
    return this.store.read((s) => buildTransferImpact(s, this.cfg, employeeId, toDeptId));
  }

  /** R30：可调岗目标部门（只读）。 */
  getTransferTargets(employeeId: string): Array<{ deptId: string; type: DeptType }> | null {
    return this.store.read((s) => transferTargets(s, employeeId));
  }

  /** R30：裁员当月主营产能损失（只读，非主营为 0）。 */
  getLayoffCapacityLoss(employeeId: string): number | null {
    return this.store.read((s) => estimateLayoffCapacityLoss(s, this.cfg, employeeId));
  }

  /** 预览设立支持部门（只读）。 */
  previewCreateDepartment(type: SupportDeptType) {
    return this.store.read((s) => previewCreateDepartment(s, this.cfg, type));
  }

  /** 创建支持部门（去重、扣设立费，幂等）。 */
  async createDepartment(
    type: SupportDeptType,
    ctx: { commandId: string; expectedRunId: string },
  ): Promise<CommandResult<{ department: Department; feePaidYuan: number; cashAfterYuan: number }>> {
    try {
      const { result } = await this.store.mutate(
        (draft) => createDepartment(draft, this.cfg, type, ctx),
        ctx.expectedRunId,
      );
      return ok(this.store.current.runId, this.store.currentRevision, {
        department: result.department,
        feePaidYuan: result.feePaidYuan,
        cashAfterYuan: result.cashAfterYuan,
      });
    } catch (err) {
      return toFailure(err);
    }
  }

  /** 切换部门编制模式 AUTO/LOCKED。 */
  async setStaffingMode(
    deptId: string,
    mode: StaffingMode,
    ctx: { commandId: string; expectedRunId: string },
  ): Promise<CommandResult<true>> {
    try {
      await this.store.mutate(
        (draft) => {
          setStaffingMode(draft, deptId, mode, ctx);
          return { revision: 0 };
        },
        ctx.expectedRunId,
      );
      return ok(this.store.current.runId, this.store.currentRevision, true);
    } catch (err) {
      return toFailure(err);
    }
  }

  /** 手动设置目标人数（减少目标不裁员）。 */
  async setTargetCount(
    deptId: string,
    target: number,
    ctx: { commandId: string; expectedRunId: string },
  ): Promise<CommandResult<true>> {
    try {
      await this.store.mutate(
        (draft) => {
          setTargetCount(draft, deptId, target, ctx);
          return { revision: 0 };
        },
        ctx.expectedRunId,
      );
      return ok(this.store.current.runId, this.store.currentRevision, true);
    } catch (err) {
      return toFailure(err);
    }
  }

  /** 切换经营方针（STEADY/GROWTH/PROFIT），即时影响后续自动决策，不改历史账。 */
  async setPolicy(
    policy: Policy,
    ctx: { commandId: string; expectedRunId: string },
  ): Promise<CommandResult<true>> {
    if (policy !== 'STEADY' && policy !== 'GROWTH' && policy !== 'PROFIT') {
      return fail(GameErrorCode.INVALID_POLICY, errorMessage(GameErrorCode.INVALID_POLICY));
    }
    try {
      await this.store.mutate(
        (draft) => {
          draft.policy = policy;
          return { revision: 0 };
        },
        ctx.expectedRunId,
      );
      return ok(this.store.current.runId, this.store.currentRevision, true);
    } catch (err) {
      return toFailure(err);
    }
  }

  /** 最近自动化决策日志（自动招聘/跳过原因），只读、不参与财务。 */
  getAutomationLogs(limit = 20): AutomationLogEntry[] {
    return this.store.read((s) => s.automationLogs.slice(-limit).reverse());
  }

  /** 裁员预览（GET，返回 token 所需金额与 60s 有效期信息）。 */
  previewLayoff(employeeId: string, nowMs = Date.now()): LayoffPreview {
    return this.store.read((s) => previewLayoff(s, employeeId, nowMs));
  }

  /** 由预览生成确认 token（前端持有，60s 有效）。 */
  createLayoffToken(preview: LayoffPreview, nowMs = Date.now()): LayoffToken {
    return createLayoffToken(preview, nowMs);
  }

  /** 确认裁员（二次确认、重算补偿、现金校验、幂等）。 */
  async confirmLayoff(
    token: LayoffToken,
    ctx: { commandId: string; expectedRunId: string },
    nowMs = Date.now(),
  ): Promise<CommandResult<{ employee: Employee; severancePaidYuan: number; cashAfterYuan: number }>> {
    try {
      const { result } = await this.store.mutate(
        (draft) => confirmLayoff(draft, this.cfg, token, ctx, nowMs),
        ctx.expectedRunId,
      );
      return ok(this.store.current.runId, this.store.currentRevision, {
        employee: result.employee,
        severancePaidYuan: result.severancePaidYuan,
        cashAfterYuan: result.cashAfterYuan,
      });
    } catch (err) {
      return toFailure(err);
    }
  }

  // ---------------------------------------------------------------- M2-06 调岗

  /** 调岗预览（只读，下月生效、无费用）。 */
  previewTransfer(employeeId: string, toDeptId: string) {
    return this.store.read((s) => previewTransfer(s, employeeId, toDeptId));
  }

  /** 确认调岗（主营↔支持，下月生效，幂等；无招聘费/赔偿）。 */
  async transferEmployee(
    employeeId: string,
    toDeptId: string,
    ctx: { commandId: string; expectedRunId: string },
  ): Promise<CommandResult<true>> {
    try {
      await this.store.mutate(
        (draft) => {
          transferEmployee(draft, employeeId, toDeptId, ctx);
          return { revision: 0 };
        },
        ctx.expectedRunId,
      );
      return ok(this.store.current.runId, this.store.currentRevision, true);
    } catch (err) {
      return toFailure(err);
    }
  }

  // ---------------------------------------------------------------- M3 风控 / 救助 / 离线

  /** 当前现金风险评估（只读）。 */
  assessRisk() {
    return this.store.read((s) => assessRisk(s, this.cfg));
  }

  /** 资产榜（含玩家，降序）。 */
  assetsLeaderboard() {
    return this.store.read((s) => assetsLeaderboard(s, this.cfg));
  }

  /** 经营年限榜（含玩家，降序）。 */
  yearsLeaderboard() {
    return this.store.read((s) => yearsLeaderboard(s, this.cfg));
  }

  /** 领取一次性救助资本 10 万元（全 run 仅一次，不计收入/利润）。 */
  async injectRescueCapital(
    ctx: { commandId: string; expectedRunId: string },
  ): Promise<CommandResult<{ amountYuan: number; cashAfterYuan: number }>> {
    try {
      const { result } = await this.store.mutate(
        (draft) => injectRescueCapital(draft, this.cfg, ctx),
        ctx.expectedRunId,
      );
      if (!result.granted) {
        return fail(GameErrorCode.ALREADY_USED, errorMessage(GameErrorCode.ALREADY_USED));
      }
      // 救助后若恢复 NORMAL，解除 DISTRESS 冻结，回到暂停态由玩家手动恢复经营
      if (this.store.current.phase === 'DISTRESS') {
        await this.store.mutate(
          (draft) => {
            draft.phase = 'RUNNING';
            return { revision: 0 };
          },
          ctx.expectedRunId,
        );
      }
      return ok(this.store.current.runId, this.store.currentRevision, {
        amountYuan: result.amountYuan,
        cashAfterYuan: result.cashAfterYuan,
      });
    } catch (err) {
      return toFailure(err);
    }
  }

  /**
   * 离线结算（应用回前台调用）。
   * 内部先结算月份（含自动招聘/事件/风险），成功后持久化；遇危机中断不跳月。
   */
  async settleOffline(nowMs: number): Promise<
    CommandResult<{
      monthsSettled: number;
      yearsClosed: number[];
      interrupted: boolean;
      cashBefore: number;
      cashAfter: number;
      newRemainderMs: number;
    }>
  > {
    const expectedRunId = this.store.current.runId;
    try {
      const out = await this.store.mutate((draft) => {
        const r = settleOffline({ state: draft, cfg: this.cfg, nowMs });
        return r;
      }, expectedRunId);
      const r = out.result;
      return ok(this.store.current.runId, out.revision, {
        monthsSettled: r.monthsSettled,
        yearsClosed: r.yearsClosed,
        interrupted: r.interrupted,
        cashBefore: r.cashBefore,
        cashAfter: this.store.current.company?.cashYuan ?? r.cashBefore,
        newRemainderMs: r.newRemainderMs,
      });
    } catch (err) {
      return toFailure(err);
    }
  }
}
