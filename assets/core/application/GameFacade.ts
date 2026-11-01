import { GameErrorCode, errorMessage } from '../domain/errors';
import type { CommandResult } from '../domain/result';
import { ok, fail } from '../domain/result';
import type { IStorageBackend, ITapPlatform } from '../platform/ITapPlatform';
import { GameStore } from './GameStore';
import { createCompany, type CreateCompanyInput } from './CompanyService';
import { getOffer, refreshOffer } from './OfferService';
import { hireEmployee, startOperating } from './RecruitmentService';
import { closeCompanyPreview, confirmCloseCompany } from './ResetService';
import { createInitialState } from '../domain/gameStateFactory';
import type { AnnualReport, CandidateOffer, Employee, GameSpeed, GameState, IndustryId, MonthlyLedger } from '../domain/types';
import { NameGenerator } from '../domain/NameGenerator';
import { Rng, deriveSeed } from '../simulation/rng';
import { GameClock, type ClockTickResult } from '../simulation/GameClock';
import { investInBusiness, previewInvest, type InvestPreview } from './InvestmentService';
import type { EconomyConfig } from '../config/EconomyConfig';

export interface BootstrapResult {
  state: GameState;
  recovered: boolean;
  recoveryNote?: string;
  environment: 'EDITOR' | 'TAPTAP';
}

function toFailure(err: unknown): CommandResult<never> {
  const code = err instanceof Error && err.message in GameErrorCodeLike
    ? (err.message as GameErrorCode)
    : GameErrorCode.NOT_READY;
  return fail(code, errorMessage(code));
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
  private readonly platform: ITapPlatform;
  private readonly cfg: EconomyConfig;
  private readonly clock = new GameClock();

  private constructor(platform: ITapPlatform, store: GameStore, cfg: EconomyConfig) {
    this.platform = platform;
    this.store = store;
    this.cfg = cfg;
  }

  static async bootstrap(platform: ITapPlatform, cfg: EconomyConfig): Promise<GameFacade> {
    const loaded = await GameStore.load(platform);
    const store = loaded ?? new GameStore(platform, createInitialState(Date.now()));
    return new GameFacade(platform, store, cfg);
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

  getRevision(): number {
    return this.store.currentRevision;
  }

  /** 公司名刷新使用独立 RNG 流，不改变市场事件序列。 */
  rollCompanyNames(industry: IndustryId, count = 3): string[] {
    const state = this.store.current;
    const rng = new Rng(deriveSeed(state.seed, 'companyName', state.rngCounter));
    // 刷新不推进市场 RNG：用 rngCounter 的临时派生子流，且不写回
    const generator = new NameGenerator(rng.derive(`names:${state.rngCounter}`));
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
    input: { offerId: string; candidateId: string; departmentId: string },
    ctx: { commandId: string; expectedRunId: string },
  ): Promise<CommandResult<{ employee: Employee; feePaidYuan: number; cashAfterYuan: number }>> {
    try {
      const { result, revision } = await this.store.mutate(
        (draft) => hireEmployee(draft, input, ctx),
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

  beginCloseCompany(nowMs = Date.now()) {
    return this.store.read((s) => closeCompanyPreview(s, nowMs));
  }

  async confirmCloseCompany(
    token: { confirmationToken: string; expiresAtMs: number; oldRunId: string },
    nowMs = Date.now(),
  ): Promise<CommandResult<{ newRunId: string }>> {
    try {
      const current = this.store.current;
      const { oldRunId, newState } = confirmCloseCompany(current, token, nowMs);
      await this.store.replaceWithNewRun(newState, oldRunId, nowMs);
      return ok(newState.runId, this.store.currentRevision, { newRunId: newState.runId });
    } catch (err) {
      return toFailure(err);
    }
  }

  getEnvironment(): 'EDITOR' | 'TAPTAP' {
    return this.platform.getEnvironment();
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
  ): Promise<CommandResult<ClockTickResult>> {
    try {
      const result = await this.store.mutate(
        (draft) => this.clock.tick(draft, this.cfg, elapsedRealMs),
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
        (draft) => investInBusiness(draft, this.cfg, amount),
        ctx.expectedRunId,
      );
      return ok(this.store.current.runId, this.store.currentRevision, result);
    } catch (err) {
      return toFailure(err);
    }
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
}
