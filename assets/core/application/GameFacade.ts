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
import type { CandidateOffer, Employee, GameState, IndustryId } from '../domain/types';
import { NameGenerator } from '../domain/NameGenerator';
import { Rng, deriveSeed } from '../simulation/rng';

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

  private constructor(platform: ITapPlatform, store: GameStore) {
    this.platform = platform;
    this.store = store;
  }

  static async bootstrap(platform: ITapPlatform): Promise<GameFacade> {
    const loaded = await GameStore.load(platform);
    const store = loaded ?? new GameStore(platform, createInitialState(Date.now()));
    return new GameFacade(platform, store);
  }

  /** 测试/首启直接注入存储。 */
  static async fromStorage(storage: IStorageBackend & ITapPlatform): Promise<GameFacade> {
    return GameFacade.bootstrap(storage);
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
}
