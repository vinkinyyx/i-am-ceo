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
import { EditorMockPlatform } from '../helpers/EditorMockPlatform';

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

describe('B2 换票账号档案与缓存作用域', () => {
  let p: FakeTapPlatform;
  const profileBody = {
    protocolVersion: 1, sessionToken: 'tok-p', expiresInSec: 900,
    profileId: 'tap_AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_ab',
    appId: '1016161', environment: 'test', scope: 'tap-minigame-account',
  };
  beforeEach(() => { p = new FakeTapPlatform(); });

  it('严格解析档案并持久化，身份作用域与云配置一致', async () => {
    p.http = () => ({ statusCode: 200, data: profileBody });
    const auth = new AuthService(p, { endpoint: 'https://api.example.com', now: () => 1_000 });
    auth.setExpectedScope('1016161', 'test');
    const s = await auth.ensureAuthenticated();
    expect(s.profile).toEqual({
      profileId: profileBody.profileId, appId: '1016161', environment: 'test',
      scope: 'tap-minigame-account', protocolVersion: 1,
    });
    expect((await p.get<AuthSession>(SESSION_STORAGE_KEY))?.profile?.profileId).toBe(profileBody.profileId);
  });

  it('旧服务端（无 protocolVersion）仍可登录，但不产生账号作用域', async () => {
    const auth = new AuthService(p, { endpoint: 'https://api.example.com' });
    const s = await auth.ensureAuthenticated();
    expect(s.profile).toBeUndefined();
    expect(await auth.currentSession()).not.toBeNull();
  });

  it('档案 profileId 畸形 → AUTH_REQUIRED 且不落盘', async () => {
    p.http = () => ({ statusCode: 200, data: { ...profileBody, profileId: 'nickname-not-stable' } });
    const auth = new AuthService(p, { endpoint: 'https://api.example.com' });
    await expect(auth.ensureAuthenticated()).rejects.toMatchObject({ code: GameErrorCode.AUTH_REQUIRED });
    expect(await p.get(SESSION_STORAGE_KEY)).toBeNull();
  });

  it('服务端返回其他 app/环境 → AUTH_REQUIRED，拒绝跨作用域', async () => {
    p.http = () => ({ statusCode: 200, data: { ...profileBody, appId: '999999' } });
    const auth = new AuthService(p, { endpoint: 'https://api.example.com' });
    auth.setExpectedScope('1016161', 'test');
    await expect(auth.ensureAuthenticated()).rejects.toMatchObject({ code: GameErrorCode.AUTH_REQUIRED });
  });

  it('缓存会话属于其他作用域时强制重新登录，不复用旧账号档', async () => {
    await p.set(SESSION_STORAGE_KEY, {
      kind: 'taptap', sessionToken: 'old-token', expiresAtMs: Date.now() + 60_000,
      profile: { profileId: 'tap_otherAccount123', appId: 'other-app', environment: 'test', scope: 'tap-minigame-account' },
    });
    p.http = () => ({ statusCode: 200, data: profileBody });
    const auth = new AuthService(p, { endpoint: 'https://api.example.com' });
    auth.setExpectedScope('1016161', 'test');
    const s = await auth.ensureAuthenticated();
    expect(p.logins).toBe(1);
    expect(s.profile?.appId).toBe('1016161');
    expect(await auth.hasValidSession()).toBe(true);
  });

  it('currentSession 对过期/跨作用域缓存返回 null', async () => {
    const auth = new AuthService(p, { endpoint: 'https://api.example.com', now: () => 10_000 });
    auth.setExpectedScope('1016161', 'test');
    await p.set(SESSION_STORAGE_KEY, {
      kind: 'taptap', sessionToken: 'expired', expiresAtMs: 9_000,
      profile: { profileId: 'tap_expiredAccount1', appId: '1016161', environment: 'test', scope: 'tap-minigame-account' },
    });
    expect(await auth.currentSession()).toBeNull();
  });
});

describe('DEV-01 权威身份刷新（缓存TTL不能证明平台未换号）', () => {
  const profileA = 'tap_AccountA111111111';
  const profileB = 'tap_AccountB222222222';
  const bodyA = {
    protocolVersion: 1, sessionToken: 'tok-A', expiresInSec: 900,
    profileId: profileA, appId: '1016161', environment: 'test', scope: 'tap-minigame-account',
  };
  const bodyB = {
    protocolVersion: 1, sessionToken: 'tok-B', expiresInSec: 900,
    profileId: profileB, appId: '1016161', environment: 'test', scope: 'tap-minigame-account',
  };

  /** 带 set 追踪的假真机平台（用于断言刷新只写会话键）。 */
  class TrackingPlatform extends FakeTapPlatform {
    readonly setKeys: string[] = [];
    override async set(key: string, data: unknown): Promise<void> {
      this.setKeys.push(key);
      await super.set(key, data);
    }
  }

  it('缓存A未过期但平台已是B：权威刷新必须得到B并替换缓存', async () => {
    const p = new TrackingPlatform();
    await p.set(SESSION_STORAGE_KEY, {
      kind: 'taptap', sessionToken: 'tok-A', expiresAtMs: 1_000_000 + 3_600_000,
      endpoint: 'https://api.example.com',
      profile: { profileId: profileA, appId: '1016161', environment: 'test', scope: 'tap-minigame-account', protocolVersion: 1 },
    });
    p.http = () => ({ statusCode: 200, data: bodyB });
    const auth = new AuthService(p, { endpoint: 'https://api.example.com', now: () => 1_000_000 });
    auth.setExpectedScope('1016161', 'test');
    // 普通缓存查询仍返回A（不联网），证明旧测试语义保留
    expect((await auth.currentSession())?.profile?.profileId).toBe(profileA);
    expect(p.logins).toBe(0);
    const r = await auth.refreshCurrentIdentity({ reason: 'cloud', generation: 1, stillCurrent: () => true });
    expect(r.kind).toBe('verified');
    if (r.kind === 'verified') expect(r.session.profile?.profileId).toBe(profileB);
    expect((await auth.currentSession())?.profile?.profileId).toBe(profileB);
    expect((await p.get<AuthSession>(SESSION_STORAGE_KEY))?.profile?.profileId).toBe(profileB);
    // 刷新只写会话键，不触碰任何经营数据
    expect(p.setKeys.filter((k) => k !== SESSION_STORAGE_KEY)).toHaveLength(0);
  });

  it('同代际10并发刷新只发1次login/exchange（singleflight）', async () => {
    const p = new FakeTapPlatform();
    p.http = () => ({ statusCode: 200, data: bodyA });
    const auth = new AuthService(p, { endpoint: 'https://api.example.com' });
    auth.setExpectedScope('1016161', 'test');
    const results = await Promise.all(Array.from({ length: 10 }, () =>
      auth.refreshCurrentIdentity({ reason: 'foreground', generation: 7, stillCurrent: () => true })));
    expect(p.logins).toBe(1);
    expect(p.requests).toHaveLength(1);
    for (const r of results) expect(r.kind).toBe('verified');
  });

  it('旧代际A晚于新代际B返回：A不得覆盖B，且A调用方得到superseded', async () => {
    const p = new FakeTapPlatform();
    let gen = 1;
    let resolveFirst: ((v: { statusCode: number; data: unknown }) => void) | null = null;
    let firstHttpStarted!: () => void;
    const firstHttpStartedPromise = new Promise<void>((res) => { firstHttpStarted = res; });
    p.http = () => {
      if (p.requests.length === 1) {
        firstHttpStarted();
        return new Promise((res) => { resolveFirst = res; });
      }
      return { statusCode: 200, data: bodyB };
    };
    const auth = new AuthService(p, { endpoint: 'https://api.example.com', now: () => 1_000_000 });
    auth.setExpectedScope('1016161', 'test');
    const promiseA = auth.refreshCurrentIdentity({ reason: 'foreground', generation: 1, stillCurrent: () => gen === 1 });
    await firstHttpStartedPromise;
    gen = 2;
    const resultB = await auth.refreshCurrentIdentity({ reason: 'foreground', generation: 2, stillCurrent: () => gen === 2 });
    expect(resultB.kind).toBe('verified');
    resolveFirst!({ statusCode: 200, data: bodyA });
    const resultA = await promiseA;
    expect(resultA.kind).toBe('superseded');
    // 迟到A未污染内存与落盘缓存
    expect((await auth.currentSession())?.profile?.profileId).toBe(profileB);
    expect((await p.get<AuthSession>(SESSION_STORAGE_KEY))?.profile?.profileId).toBe(profileB);
  });

  it('endpoint变化使旧缓存失效：ensureAuthenticated强制重新换票', async () => {
    const p = new FakeTapPlatform();
    await p.set(SESSION_STORAGE_KEY, {
      kind: 'taptap', sessionToken: 'tok-old-endpoint', expiresAtMs: Date.now() + 3_600_000,
      endpoint: 'https://old.example.com',
      profile: { profileId: profileA, appId: '1016161', environment: 'test', scope: 'tap-minigame-account' },
    });
    p.http = () => ({ statusCode: 200, data: bodyA });
    const auth = new AuthService(p, { endpoint: 'https://api.example.com' });
    auth.setExpectedScope('1016161', 'test');
    expect(await auth.currentSession()).toBeNull();
    const s = await auth.ensureAuthenticated();
    expect(p.logins).toBe(1);
    expect(s.endpoint).toBe('https://api.example.com');
  });

  it('网络未知：unavailable/retryable，无verified、不清旧会话、无误判换号副作用', async () => {
    const p = new TrackingPlatform();
    const storedA = {
      kind: 'taptap', sessionToken: 'tok-A', expiresAtMs: Date.now() + 3_600_000,
      endpoint: 'https://api.example.com',
      profile: { profileId: profileA, appId: '1016161', environment: 'test', scope: 'tap-minigame-account' },
    };
    await p.set(SESSION_STORAGE_KEY, storedA);
    p.setKeys.length = 0;
    p.http = () => { throw new Error('offline'); };
    const auth = new AuthService(p, { endpoint: 'https://api.example.com' });
    auth.setExpectedScope('1016161', 'test');
    const r = await auth.refreshCurrentIdentity({ reason: 'cloud', generation: 1, stillCurrent: () => true });
    expect(r.kind).toBe('unavailable');
    if (r.kind === 'unavailable') expect(r.retryable).toBe(true);
    // 旧会话原样保留，不写任何存储
    expect(await p.get(SESSION_STORAGE_KEY)).toEqual(storedA);
    expect(p.setKeys).toHaveLength(0);
    expect((await auth.currentSession())?.sessionToken).toBe('tok-A');
  });

  it('code一次使用：401后再次刷新重新tap.login，不重用旧code', async () => {
    const p = new FakeTapPlatform();
    p.http = () => ({ statusCode: 401, data: { code: 'TAPTAP_CODE_INVALID' } });
    const auth = new AuthService(p, { endpoint: 'https://api.example.com' });
    const r1 = await auth.refreshCurrentIdentity({ reason: 'cloud', generation: 1, stillCurrent: () => true });
    expect(r1.kind).toBe('unavailable');
    if (r1.kind === 'unavailable') expect(r1.retryable).toBe(false);
    expect(p.logins).toBe(1);
    const r2 = await auth.refreshCurrentIdentity({ reason: 'cloud', generation: 1, stillCurrent: () => true });
    expect(r2.kind).toBe('unavailable');
    expect(p.logins).toBe(2);
    expect(p.requests).toHaveLength(2);
  });

  it('429限流：unavailable但可重试，不误判凭据失效', async () => {
    const p = new FakeTapPlatform();
    p.http = () => ({ statusCode: 429, data: { code: 'TAPTAP_RATE_LIMIT' } });
    const auth = new AuthService(p, { endpoint: 'https://api.example.com' });
    const r = await auth.refreshCurrentIdentity({ reason: 'cloud', generation: 1, stillCurrent: () => true });
    expect(r.kind).toBe('unavailable');
    if (r.kind === 'unavailable') expect(r.retryable).toBe(true);
    // 恢复后下一次刷新成功
    p.http = () => ({ statusCode: 200, data: bodyA });
    const r2 = await auth.refreshCurrentIdentity({ reason: 'cloud', generation: 2, stillCurrent: () => true });
    expect(r2.kind).toBe('verified');
  });

  it('等待期间代际已切换：superseded，结果不再被调用方使用', async () => {
    const p = new FakeTapPlatform();
    p.http = () => ({ statusCode: 200, data: bodyA });
    const auth = new AuthService(p, { endpoint: 'https://api.example.com' });
    const r = await auth.refreshCurrentIdentity({ reason: 'foreground', generation: 1, stillCurrent: () => false });
    expect(r.kind).toBe('superseded');
  });

  it('未配置服务端：平台登录态verified但无profile（单机可用，云榜由上层禁用）', async () => {
    const p = new FakeTapPlatform();
    const auth = new AuthService(p, { endpoint: '', now: () => 2_000_000 });
    const r = await auth.refreshCurrentIdentity({ reason: 'cloud', generation: 1, stillCurrent: () => true });
    expect(r.kind).toBe('verified');
    if (r.kind === 'verified') {
      expect(r.session.sessionToken).toBe('tap-platform-session');
      expect(r.session.profile).toBeUndefined();
    }
    expect(p.logins).toBe(1);
    expect(p.requests).toHaveLength(0);
  });

  it('旧服务端无protocolVersion：刷新verified但会话无profile，不产生账号绑定', async () => {
    const p = new FakeTapPlatform();
    p.http = () => ({ statusCode: 200, data: { sessionToken: 'tok-legacy', expiresInSec: 900 } });
    const auth = new AuthService(p, { endpoint: 'https://api.example.com' });
    const r = await auth.refreshCurrentIdentity({ reason: 'cloud', generation: 1, stillCurrent: () => true });
    expect(r.kind).toBe('verified');
    if (r.kind === 'verified') expect(r.session.profile).toBeUndefined();
  });

  it('编辑器环境：verified mock，无login无网络', async () => {
    const auth = new AuthService(new EditorMockPlatform(), { endpoint: 'https://api.example.com' });
    const r = await auth.refreshCurrentIdentity({ reason: 'cloud', generation: 1, stillCurrent: () => true });
    expect(r.kind).toBe('verified');
    if (r.kind === 'verified') expect(r.session.kind).toBe('mock');
  });

  it('刷新流程不触碰经营存储：仅SESSION_STORAGE_KEY被写入', async () => {
    const p = new TrackingPlatform();
    p.http = () => ({ statusCode: 200, data: bodyA });
    const auth = new AuthService(p, { endpoint: 'https://api.example.com' });
    await auth.refreshCurrentIdentity({ reason: 'reward-reconcile', generation: 1, stillCurrent: () => true });
    expect(p.setKeys).toEqual([SESSION_STORAGE_KEY]);
  });
});
