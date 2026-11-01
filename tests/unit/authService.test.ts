import { describe, it, expect, beforeEach } from 'vitest';
import { GameError, GameErrorCode } from '@core/domain/errors';
import {
  AuthService,
  SESSION_STORAGE_KEY,
  type AuthSession,
} from '@core/platform/AuthService';
import type {
  ITapPlatform,
  PlatformHttpRequest,
  PlatformHttpResponse,
} from '@core/platform/ITapPlatform';
import { EditorMockPlatform } from '@core/platform/EditorMockPlatform';

/** 可控假真机平台（TAPTAP 环境）。 */
class FakeTapPlatform implements ITapPlatform {
  loginMode: 'ok' | 'fail' | 'empty' = 'ok';
  code = 'code-xyz';
  http: (req: PlatformHttpRequest) => PlatformHttpResponse | Promise<PlatformHttpResponse> = () => ({
    statusCode: 200,
    data: { sessionToken: 'tok-123', expiresInSec: 3600 },
  });
  readonly requests: PlatformHttpRequest[] = [];
  logins = 0;
  private store = new Map<string, unknown>();

  getEnvironment(): 'TAPTAP' {
    return 'TAPTAP';
  }
  getWindowInfo() {
    return { width: 360, height: 780 };
  }
  onShow(): () => void {
    return () => undefined;
  }
  onHide(): () => void {
    return () => undefined;
  }
  async login() {
    this.logins += 1;
    if (this.loginMode === 'fail') throw new GameError(GameErrorCode.AUTH_REQUIRED);
    if (this.loginMode === 'empty') return { code: '' };
    return { code: this.code };
  }
  async getNetworkState() {
    return 'online' as const;
  }
  async request<T>(req: PlatformHttpRequest): Promise<PlatformHttpResponse<T>> {
    this.requests.push(req);
    return (await this.http(req)) as PlatformHttpResponse<T>;
  }
  async get<T>(key: string): Promise<T | null> {
    return (this.store.get(key) as T) ?? null;
  }
  async set(key: string, data: unknown): Promise<void> {
    this.store.set(key, data);
  }
  async remove(key: string): Promise<void> {
    this.store.delete(key);
  }
}

describe('AuthService 编辑器/预览', () => {
  it('EDITOR 环境直接返回 mock 会话，不发任何网络请求', async () => {
    const p = new EditorMockPlatform();
    const auth = new AuthService(p, { endpoint: 'https://x.example.com' });
    const s = await auth.ensureAuthenticated();
    expect(s.kind).toBe('mock');
    await expect(auth.hasValidSession()).resolves.toBe(true);
  });
});

describe('AuthService 真机 TAPTAP 登录交换（08.4）', () => {
  let p: FakeTapPlatform;
  beforeEach(() => {
    p = new FakeTapPlatform();
  });

  it('正常：login code → POST exchange → 200 会话，且落盘 session', async () => {
    const auth = new AuthService(p, { endpoint: 'https://api.example.com/', now: () => 1_000_000 });
    const s = await auth.ensureAuthenticated();
    expect(s.kind).toBe('taptap');
    expect(s.sessionToken).toBe('tok-123');
    expect(s.expiresAtMs).toBe(1_000_000 + 3600_000);
    // 请求路径、方法、body
    expect(p.requests).toHaveLength(1);
    expect(p.requests[0]?.url).toBe('https://api.example.com/v1/auth/taptap/exchange');
    expect(p.requests[0]?.method).toBe('POST');
    expect(p.requests[0]?.data).toEqual({ code: 'code-xyz' });
    // 会话已持久化（独立于业务存档）
    const stored = await p.get<AuthSession>(SESSION_STORAGE_KEY);
    expect(stored?.sessionToken).toBe('tok-123');
  });

  it('未配置 endpoint 时走平台登录态：仍调用 tap.login()，不伪造 openid、不抛错', async () => {
    const auth = new AuthService(p, { endpoint: '', now: () => 2_000_000 });
    const s = await auth.ensureAuthenticated();
    expect(s.kind).toBe('taptap');
    expect(s.sessionToken).toBe('tap-platform-session');
    expect(s.expiresAtMs).toBe(2_000_000 + 30 * 24 * 3600 * 1000);
    // 平台登录必须真实发生（审核要求包体内已接入 TapTap 登录）
    expect(p.logins).toBe(1);
    // 未配置 endpoint 时不发任何网络请求
    expect(p.requests).toHaveLength(0);
  });

  it('login 返回空 code → AUTH_REQUIRED', async () => {
    p.loginMode = 'empty';
    const auth = new AuthService(p, { endpoint: 'https://api.example.com' });
    await expect(auth.ensureAuthenticated()).rejects.toMatchObject({ code: GameErrorCode.AUTH_REQUIRED });
  });

  it('服务端 401 / TAPTAP_CODE_INVALID → AUTH_REQUIRED', async () => {
    p.http = () => ({ statusCode: 401, data: { code: 'TAPTAP_CODE_INVALID' } });
    const auth = new AuthService(p, { endpoint: 'https://api.example.com' });
    await expect(auth.ensureAuthenticated()).rejects.toMatchObject({ code: GameErrorCode.AUTH_REQUIRED });
  });

  it('服务端 503 → PLATFORM_UNAVAILABLE（断网可本地游玩，稍后重试）', async () => {
    p.http = () => ({ statusCode: 503, data: { code: 'TAPTAP_UPSTREAM_UNAVAILABLE' } });
    const auth = new AuthService(p, { endpoint: 'https://api.example.com' });
    await expect(auth.ensureAuthenticated()).rejects.toMatchObject({
      code: GameErrorCode.PLATFORM_UNAVAILABLE,
    });
  });

  it('200 但响应畸形（无 token）→ AUTH_REQUIRED', async () => {
    p.http = () => ({ statusCode: 200, data: { sessionToken: '' } });
    const auth = new AuthService(p, { endpoint: 'https://api.example.com' });
    await expect(auth.ensureAuthenticated()).rejects.toMatchObject({ code: GameErrorCode.AUTH_REQUIRED });
  });

  it('request 抛错 → PLATFORM_UNAVAILABLE，不泄漏底层异常', async () => {
    p.http = () => {
      throw new Error('native boom');
    };
    const auth = new AuthService(p, { endpoint: 'https://api.example.com' });
    const err = await auth.ensureAuthenticated().catch((e) => e);
    expect(err).toBeInstanceOf(GameError);
    expect((err as GameError).code).toBe(GameErrorCode.PLATFORM_UNAVAILABLE);
  });

  it('已存在未过期会话时复用，不重复 login', async () => {
    const auth = new AuthService(p, { endpoint: 'https://api.example.com', now: () => 5_000_000 });
    await auth.ensureAuthenticated();
    expect(p.logins).toBe(1);
    const auth2 = new AuthService(p, { endpoint: 'https://api.example.com', now: () => 5_000_000 + 1000 });
    await auth2.ensureAuthenticated();
    expect(p.logins).toBe(1); // 复用落盘会话
  });

  it('过期会话触发重新登录', async () => {
    const auth = new AuthService(p, { endpoint: 'https://api.example.com', now: () => 1_000_000 });
    await auth.ensureAuthenticated();
    expect(p.logins).toBe(1);
    const auth2 = new AuthService(p, {
      endpoint: 'https://api.example.com',
      now: () => 1_000_000 + 3600_000 + 1,
    });
    await auth2.ensureAuthenticated();
    expect(p.logins).toBe(2);
  });

  it('loginFresh 强制重新登录；clearSession 清除本地会话', async () => {
    const auth = new AuthService(p, { endpoint: 'https://api.example.com' });
    await auth.ensureAuthenticated();
    await auth.loginFresh();
    expect(p.logins).toBe(2);
    await auth.clearSession();
    expect(await p.get(SESSION_STORAGE_KEY)).toBeNull();
  });
});
