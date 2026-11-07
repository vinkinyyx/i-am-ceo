import { GameError, GameErrorCode } from '../domain/errors';
import type { ITapPlatform } from './ITapPlatform';

/**
 * 平台认证服务（设计文档 08.4）。
 *
 * 流程（真机 TAPTAP 环境）：
 *   tap.login() 取一次性 code（平台内真实授权，用户已在 TapTap 客户端登录）
 *     -> 配置了 authEndpoint 时：POST {endpoint}/v1/auth/taptap/exchange { code } 换服务端会话
 *     -> 未配置 authEndpoint 时：直接使用平台登录态（纯单机不需要 openid，无需自建服务端）
 *
 * 纪律：
 * - 小游戏形态下 **不要求自建服务端**：TapTap 平台已完成用户认证，游戏不采集身份标识；
 * - session_key / App Secret 只在服务端，客户端永远拿不到；
 * - 编辑器 / 预览环境返回 mock 会话，不发网络请求；
 * - 任何失败都转 GameError(AUTH_REQUIRED / PLATFORM_UNAVAILABLE)，
 *   不把平台原始异常或堆栈抛给 UI；
 * - 本服务不采集、不上传任何公司经营数据。
 */

export const SESSION_STORAGE_KEY = 'ceo/auth/session';
const AUTH_PATH = '/v1/auth/taptap/exchange';
/** 未配置服务端时的平台登录态标记（不是身份令牌，仅表示「已通过平台登录」）。 */
const PLATFORM_SESSION_MARKER = 'tap-platform-session';
/** 平台登录态有效期（TapTap Access Token 最长 30 天）。 */
const PLATFORM_SESSION_TTL_MS = 30 * 24 * 3600 * 1000;

/** 服务端下发的稳定账号档案（最小不透明标识，不含昵称/Token 原文）。 */
export interface AuthProfile {
  profileId: string;
  appId: string;
  environment: 'test' | 'production';
  scope: 'tap-minigame-account';
  protocolVersion: 1;
}

/** 会话记录（存平台存储，独立于业务存档信封）。 */
export interface AuthSession {
  kind: 'taptap' | 'mock';
  /** 不透明短期会话令牌（真机由服务端签发；mock 为本地标记）。 */
  sessionToken: string;
  /** epoch 毫秒过期时间；0 表示不过期（mock）。 */
  expiresAtMs: number;
  /** 登录时网络状态，用于诊断。 */
  endpoint?: string;
  /** 服务端换票返回的稳定账号档案；旧版服务端无此字段时仅表示“已登录”。 */
  profile?: AuthProfile;
}

interface ExchangeSuccess {
  protocolVersion?: number;
  sessionToken: string;
  expiresInSec: number;
  profileId?: string;
  appId?: string;
  environment?: string;
  scope?: string;
  /** 客户端解析后附加（服务端原始响应不含该字段）。 */
  profile?: AuthProfile;
}
interface ExchangeError {
  code: string;
  message?: string;
}

export interface AuthServiceOptions {
  /** code2Session 最小服务端基础地址（不含 path），例如 https://api.example.com */
  endpoint?: string;
  /** 请求超时（毫秒），默认 8000。 */
  timeoutMs?: number;
  /** 注入当前时间（测试用），默认 Date.now。 */
  now?: () => number;
}

/**
 * DEV-01：权威身份刷新结果。
 * - verified：本次用新 tap.login code 向平台/服务端重新确认过当前账号；
 * - unavailable：网络/认证暂时无法确认（无 verified、无账号切换副作用）；
 * - superseded：等待期间前台代际已变化，本次结果不得再被使用。
 */
export type IdentityRefreshResult =
  | { kind: 'verified'; session: AuthSession; requestGeneration: number }
  | { kind: 'unavailable'; reason: string; retryable: boolean }
  | { kind: 'superseded' };

/** 权威刷新原因（仅诊断归类，不记录任何敏感值）。 */
export type IdentityRefreshReason = 'foreground' | 'cloud' | 'leaderboard' | 'reward-reconcile';

type FreshLoginOutcome = { session: AuthSession } | { error: GameError };

export class AuthService {
  private readonly platform: ITapPlatform;
  private readonly endpoint: string;
  private readonly timeoutMs: number;
  private readonly now: () => number;
  private session: AuthSession | null = null;
  private expectedAppId: string | null = null;
  private expectedEnvironment: 'test' | 'production' | null = null;
  /**
   * DEV-01：权威刷新 singleflight 状态。
   * 同一 (endpoint/app/env/generation) 共享一次 login/exchange；
   * 代际不同立即发起新刷新，旧代际迟到结果凭 serial 不得覆盖新会话。
   */
  private refreshState: {
    key: string;
    serial: number;
    promise: Promise<FreshLoginOutcome>;
  } | null = null;
  private refreshSerial = 0;

  constructor(platform: ITapPlatform, options: AuthServiceOptions = {}) {
    this.platform = platform;
    this.endpoint = (options.endpoint ?? '').replace(/\/+$/, '');
    this.timeoutMs = options.timeoutMs ?? 8000;
    this.now = options.now ?? (() => Date.now());
  }

  /**
   * B2：声明本构建期望的账号作用域（来自云配置）。
   * 缓存会话若属于其他 app/环境，视为不可用并强制重新换票，避免拿旧账号档写新作用域。
   */
  setExpectedScope(appId: string, environment: 'test' | 'production'): void {
    this.expectedAppId = appId;
    this.expectedEnvironment = environment;
    if (this.session && !this.isScopeValid(this.session)) this.session = null;
  }

  /** 当前是否真机 TapTap 环境。 */
  isTapRuntime(): boolean {
    return this.platform.getEnvironment() === 'TAPTAP';
  }

  /**
   * 确保已认证：已有有效会话直接复用；否则走平台登录 + 服务端交换。
   * 编辑器/预览环境返回 mock 会话且不联网。
   */
  async ensureAuthenticated(): Promise<AuthSession> {
    const existing = this.session ?? (await this.readStored());
    if (existing && this.isUsable(existing)) {
      this.session = existing;
      return existing;
    }

    if (!this.isTapRuntime()) {
      const mock: AuthSession = {
        kind: 'mock',
        sessionToken: 'mock-editor-session',
        expiresAtMs: 0,
      };
      this.session = mock;
      return mock;
    }

    return this.loginFresh();
  }

  /** 强制重新登录（登录失效 / code 过期 / 用户点击重试时调用）。 */
  async loginFresh(): Promise<AuthSession> {
    if (!this.isTapRuntime()) {
      const mock: AuthSession = { kind: 'mock', sessionToken: 'mock-editor-session', expiresAtMs: 0 };
      this.session = mock;
      return mock;
    }

    // 无论是否配置服务端，都必须先走一次平台登录：这是 TapTap 小游戏对「已接入登录」的要求，
    // 也让用户在 TapTap 客户端内完成一次真实授权（而不是跳过登录直接进游戏）。
    const login = await this.platform.login();
    if (!login.code) {
      throw new GameError(GameErrorCode.AUTH_REQUIRED, {
        api: 'auth',
        cause: 'empty login code',
      });
    }

    if (!this.endpoint) {
      // 未配置服务端：使用平台登录态即可。
      // TapTap 小游戏运行在 TapTap 客户端内，用户身份已由平台认证，tap.login() 成功
      // 本身就是一次真实授权；本作是纯单机游戏，不使用 openid/unionid，
      // 因此不需要自建服务端换取会话，也不伪造任何身份标识。
      const session: AuthSession = {
        kind: 'taptap',
        sessionToken: PLATFORM_SESSION_MARKER,
        expiresAtMs: this.now() + PLATFORM_SESSION_TTL_MS,
      };
      this.session = session;
      await this.writeStored(session);
      return session;
    }

    const exchanged = await this.exchangeCode(login.code);
    const session: AuthSession = {
      kind: 'taptap',
      sessionToken: exchanged.sessionToken,
      expiresAtMs: this.now() + exchanged.expiresInSec * 1000,
      endpoint: this.endpoint,
      ...(exchanged.profile ? { profile: exchanged.profile } : {}),
    };
    this.session = session;
    await this.writeStored(session);
    return session;
  }

  /**
   * DEV-01：权威身份刷新——缓存 TTL 只能证明“旧会话未过期”，不能证明“平台未换号”。
   * 云/榜/奖励等敏感操作前调用：强制用新 tap.login code 重新确认当前平台账号。
   *
   * 纪律：
   * - 同一 (endpoint/app/env/generation) singleflight，共享一次 login/exchange，
   *   onShow、云按钮、自动补榜并发不重复消费登录 code；
   * - 代际不同立即发起新刷新；旧代际迟到的结果凭 serial 不得写入内存/落盘缓存；
   * - 网络未知只返回 unavailable（retryable），不清旧会话、不产生账号切换副作用；
   * - code 一次使用：失败不重用，下次刷新重新 tap.login；
   * - 只写 SESSION_STORAGE_KEY，不触碰任何经营数据。
   */
  async refreshCurrentIdentity(input: {
    reason: IdentityRefreshReason;
    generation: number;
    stillCurrent: () => boolean;
  }): Promise<IdentityRefreshResult> {
    // 编辑器/预览：无平台账号可确认，直接给 mock（云/榜由上层按 profile 缺失另行禁用）。
    if (!this.isTapRuntime()) {
      const mock: AuthSession = { kind: 'mock', sessionToken: 'mock-editor-session', expiresAtMs: 0 };
      this.session = mock;
      return { kind: 'verified', session: mock, requestGeneration: input.generation };
    }

    const key = `${this.endpoint}|${this.expectedAppId ?? ''}|${this.expectedEnvironment ?? ''}|${input.generation}`;
    let state = this.refreshState;
    if (!state || state.key !== key) {
      const serial = ++this.refreshSerial;
      state = { key, serial, promise: this.performFreshLogin() };
      this.refreshState = state;
      void state.promise.finally(() => {
        if (this.refreshState === state) this.refreshState = null;
      });
    }
    const outcome = await state.promise;
    return this.finishRefresh(outcome, input, state.serial);
  }

  /** 发起一次全新的 tap.login →（配置服务端时）换票；任何异常收敛为 outcome，不抛出。 */
  private async performFreshLogin(): Promise<FreshLoginOutcome> {
    try {
      const login = await this.platform.login();
      if (!login.code) {
        return { error: new GameError(GameErrorCode.AUTH_REQUIRED, { api: 'refresh', cause: 'empty login code' }) };
      }
      if (!this.endpoint) {
        return {
          session: {
            kind: 'taptap',
            sessionToken: PLATFORM_SESSION_MARKER,
            expiresAtMs: this.now() + PLATFORM_SESSION_TTL_MS,
          },
        };
      }
      const exchanged = await this.exchangeCode(login.code);
      return {
        session: {
          kind: 'taptap',
          sessionToken: exchanged.sessionToken,
          expiresAtMs: this.now() + exchanged.expiresInSec * 1000,
          endpoint: this.endpoint,
          ...(exchanged.profile ? { profile: exchanged.profile } : {}),
        },
      };
    } catch (err) {
      if (err instanceof GameError) return { error: err };
      return { error: new GameError(GameErrorCode.PLATFORM_UNAVAILABLE, { api: 'refresh' }) };
    }
  }

  /** 校验并（仅在仍是最新刷新时）发布候选会话；最后按前台代际决定 verified/superseded。 */
  private async finishRefresh(
    outcome: FreshLoginOutcome,
    input: { generation: number; stillCurrent: () => boolean },
    serial: number,
  ): Promise<IdentityRefreshResult> {
    if ('error' in outcome) {
      // AUTH_REQUIRED（用户取消/凭据失效）需要用户显式动作；平台/网络类可稍后自动重试。
      const retryable = outcome.error.code !== GameErrorCode.AUTH_REQUIRED;
      return { kind: 'unavailable', reason: outcome.error.code, retryable };
    }
    const session = outcome.session;
    if (session.kind === 'taptap' && !this.isSessionValid(session)) {
      return { kind: 'unavailable', reason: 'session-invalid', retryable: true };
    }
    // 串行守卫：只有最新发起的刷新允许更新内存与落盘缓存（旧代际迟到不覆盖新会话）。
    if (serial === this.refreshSerial) {
      this.session = session;
      await this.writeStored(session);
    }
    if (!input.stillCurrent()) return { kind: 'superseded' };
    return { kind: 'verified', session, requestGeneration: input.generation };
  }

  /** 当前会话是否有效（未过期 + 作用域匹配）。 */
  isSessionValid(session: AuthSession): boolean {
    if (session.kind === 'mock') return true;
    return session.expiresAtMs > this.now() && this.isScopeValid(session);
  }

  /** 账号作用域校验：无档案（旧服务端）时不做账号断言；有档案必须与本构建一致。 */
  private isScopeValid(session: AuthSession): boolean {
    if (session.kind === 'mock') return true;
    // DEV-01：endpoint 变化使旧确认失效——旧会话无法证明来自当前服务端，必须重新换票。
    if ((session.endpoint ?? '') !== this.endpoint) return false;
    if (!session.profile) return true;
    if (this.expectedAppId && session.profile.appId !== this.expectedAppId) return false;
    if (this.expectedEnvironment && session.profile.environment !== this.expectedEnvironment) return false;
    return true;
  }

  private isUsable(session: AuthSession): boolean {
    return this.isSessionValid(session);
  }

  /** 只读返回当前可用会话（不触发登录/网络）；供身份解析使用。 */
  async currentSession(): Promise<AuthSession | null> {
    const session = this.session ?? (await this.readStored());
    if (!session || !this.isUsable(session)) return null;
    this.session = session;
    return session;
  }

  /**
   * R17-T01：显式校验本地登录态，不触发 tap.login、不发网络请求。
   * - 已确认无记录（null）→ { status:'none' }；
   * - 存在且未过期 → { status:'valid' }；
   * - 存在但过期 → { status:'expired' }（UI 据此静默重登，不先清空本地档）；
   * - 存储暂时不可读 → { status:'unknown' }，区别于 none，禁止当作未登录新建/外发。
   */
  async checkSession(): Promise<
    | { status: 'none' }
    | { status: 'unknown'; reason?: string }
    | { status: 'valid'; session: AuthSession }
    | { status: 'expired'; session: AuthSession }
  > {
    if (this.session) {
      return this.isSessionValid(this.session)
        ? { status: 'valid', session: this.session }
        : { status: 'expired', session: this.session };
    }
    let stored: AuthSession | null;
    try {
      stored = await this.platform.get<AuthSession>(SESSION_STORAGE_KEY);
    } catch (err) {
      const reason =
        err instanceof GameError && err.code === GameErrorCode.SAVE_UNAVAILABLE
          ? (err.details?.reason as string | undefined) ?? 'io'
          : 'io';
      return { status: 'unknown', reason };
    }
    if (!stored) return { status: 'none' };
    this.session = stored;
    return this.isSessionValid(stored)
      ? { status: 'valid', session: stored }
      : { status: 'expired', session: stored };
  }

  /** 是否已具备有效认证（UI 判断是否展示“未登录”状态用）。 */
  async hasValidSession(): Promise<boolean> {
    const s = this.session ?? (await this.readStored());
    return !!s && this.isUsable(s);
  }

  /** 清除本地会话（不注销平台账号；仅供重置/登出诊断）。 */
  async clearSession(): Promise<void> {
    this.session = null;
    await this.platform.remove(SESSION_STORAGE_KEY).catch(() => undefined);
  }

  // ------------------------------------------------------------ internals

  private async exchangeCode(code: string): Promise<ExchangeSuccess> {
    let res;
    try {
      res = await this.platform.request<ExchangeSuccess | ExchangeError>({
        url: `${this.endpoint}${AUTH_PATH}`,
        method: 'POST',
        data: { code },
        headers: { 'Content-Type': 'application/json' },
        timeoutMs: this.timeoutMs,
      });
    } catch (err) {
      throw new GameError(GameErrorCode.PLATFORM_UNAVAILABLE, {
        api: 'exchange',
        cause: err instanceof Error ? err.message : String(err),
      });
    }

    if (res.statusCode === 200) {
      const body = res.data as ExchangeSuccess;
      if (
        body &&
        typeof body.sessionToken === 'string' &&
        body.sessionToken.length > 0 &&
        typeof body.expiresInSec === 'number' &&
        body.expiresInSec > 0
      ) {
        return { ...body, profile: this.parseProfile(body) };
      }
      throw new GameError(GameErrorCode.AUTH_REQUIRED, {
        api: 'exchange',
        cause: 'malformed 200 response',
      });
    }
    const body = res.data as ExchangeError;
    if (res.statusCode === 401 || body?.code === 'TAPTAP_CODE_INVALID') {
      throw new GameError(GameErrorCode.AUTH_REQUIRED, {
        api: 'exchange',
        cause: body?.code ?? 'code invalid',
      });
    }
    if (res.statusCode === 429 || body?.code === 'TAPTAP_RATE_LIMIT') {
      // 限流：可稍后重试，不算凭据失效（同一代际的 singleflight 结束后由下一次刷新重新取 code）
      throw new GameError(GameErrorCode.PLATFORM_UNAVAILABLE, {
        api: 'exchange',
        cause: 'rate-limited',
      });
    }
    // 503 / 网络层 / 其它状态码：服务端暂不可用（断网可本地游玩，登录稍后重试）
    throw new GameError(GameErrorCode.PLATFORM_UNAVAILABLE, {
      api: 'exchange',
      cause: body?.code ?? `http ${res.statusCode}`,
    });
  }

  /**
   * B2：严格校验换票响应中的账号档案。
   * 协议版本存在时必须完整且作用域匹配；“旧服务端”无 protocolVersion 时退回纯登录态（不产生账号作用域）。
   */
  private parseProfile(body: ExchangeSuccess): AuthProfile | undefined {
    if (body.protocolVersion === undefined) return undefined;
    if (body.protocolVersion !== 1
      || body.scope !== 'tap-minigame-account'
      || typeof body.profileId !== 'string'
      || !/^tap_[A-Za-z0-9_-]{8,60}$/.test(body.profileId)
      || typeof body.appId !== 'string' || body.appId.length === 0
      || (body.environment !== 'test' && body.environment !== 'production')) {
      throw new GameError(GameErrorCode.AUTH_REQUIRED, { api: 'exchange', cause: 'profile-protocol-invalid' });
    }
    if ((this.expectedAppId && body.appId !== this.expectedAppId)
      || (this.expectedEnvironment && body.environment !== this.expectedEnvironment)) {
      throw new GameError(GameErrorCode.AUTH_REQUIRED, { api: 'exchange', cause: 'profile-scope-mismatch' });
    }
    return {
      profileId: body.profileId,
      appId: body.appId,
      environment: body.environment,
      scope: 'tap-minigame-account',
      protocolVersion: 1,
    };
  }

  private async readStored(): Promise<AuthSession | null> {
    try {
      return await this.platform.get<AuthSession>(SESSION_STORAGE_KEY);
    } catch {
      return null;
    }
  }

  private async writeStored(session: AuthSession): Promise<void> {
    try {
      await this.platform.set(SESSION_STORAGE_KEY, session);
    } catch {
      // 会话落盘失败不阻塞本次内存会话；下次启动重新登录即可
    }
  }
}
