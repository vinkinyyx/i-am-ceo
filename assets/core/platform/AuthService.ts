import { GameError, GameErrorCode } from '../domain/errors';
import type { ITapPlatform } from './ITapPlatform';

/**
 * 平台认证服务（设计文档 08.4）。
 *
 * 流程（真机 TAPTAP 环境）：
 *   tap.login() 取一次性 code
 *     -> POST {endpoint}/v1/auth/taptap/exchange { code }
 *     -> { sessionToken, expiresInSec }
 * 会话短期有效、仅存本地、不写入业务存档；code 一次性不可复用。
 *
 * 纪律：
 * - session_key / App Secret 只在服务端，客户端永远拿不到；
 * - 编辑器 / 预览环境返回 mock 会话，不发网络请求；
 * - 任何失败都转 GameError(AUTH_REQUIRED / PLATFORM_UNAVAILABLE)，
 *   不把平台原始异常或堆栈抛给 UI；
 * - 本服务不采集、不上传任何公司经营数据。
 */

export const SESSION_STORAGE_KEY = 'ceo/auth/session';
const AUTH_PATH = '/v1/auth/taptap/exchange';

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

    if (!this.endpoint) {
      // 真机但未配置服务端地址：不能伪造登录成功
      throw new GameError(GameErrorCode.PLATFORM_UNAVAILABLE, {
        api: 'auth',
        cause: 'auth endpoint not configured',
      });
    }

    const login = await this.platform.login();
    if (!login.code) {
      throw new GameError(GameErrorCode.AUTH_REQUIRED, {
        api: 'auth',
        cause: 'empty login code',
      });
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
