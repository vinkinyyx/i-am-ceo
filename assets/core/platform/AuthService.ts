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

/** 会话记录（存平台存储，独立于业务存档信封）。 */
export interface AuthSession {
  kind: 'taptap' | 'mock';
  /** 不透明短期会话令牌（真机由服务端签发；mock 为本地标记）。 */
  sessionToken: string;
  /** epoch 毫秒过期时间；0 表示不过期（mock）。 */
  expiresAtMs: number;
  /** 登录时网络状态，用于诊断。 */
  endpoint?: string;
}

interface ExchangeSuccess {
  sessionToken: string;
  expiresInSec: number;
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

export class AuthService {
  private readonly platform: ITapPlatform;
  private readonly endpoint: string;
  private readonly timeoutMs: number;
  private readonly now: () => number;
  private session: AuthSession | null = null;

  constructor(platform: ITapPlatform, options: AuthServiceOptions = {}) {
    this.platform = platform;
    this.endpoint = (options.endpoint ?? '').replace(/\/+$/, '');
    this.timeoutMs = options.timeoutMs ?? 8000;
    this.now = options.now ?? (() => Date.now());
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
    if (existing && this.isSessionValid(existing)) {
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
    };
    this.session = session;
    await this.writeStored(session);
    return session;
  }

  /** 当前会话是否有效（未过期）。 */
  isSessionValid(session: AuthSession): boolean {
    if (session.kind === 'mock') return true;
    return session.expiresAtMs > this.now();
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
    return !!s && this.isSessionValid(s);
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
        return body;
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
    // 503 / 网络层 / 其它状态码：服务端暂不可用（断网可本地游玩，登录稍后重试）
    throw new GameError(GameErrorCode.PLATFORM_UNAVAILABLE, {
      api: 'exchange',
      cause: body?.code ?? `http ${res.statusCode}`,
    });
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
