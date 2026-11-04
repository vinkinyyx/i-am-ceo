/**
 * R17：登录态校验（checkSession guard + 失败/拒绝路径）。
 */
import { describe, it, expect } from 'vitest';
import { AuthService, SESSION_STORAGE_KEY } from '@core/platform/AuthService';
import { GameError, GameErrorCode } from '@core/domain/errors';
import { ScriptedTapRuntime } from '../helpers/faults';
import { TapPlatform } from '@core/platform/TapPlatform';

function tapPlatform(tap: ScriptedTapRuntime): TapPlatform {
  return new TapPlatform(tap, { opTimeoutMs: 50, loginCallbackTimeoutMs: 50 });
}

describe('R17-T01 checkSession 不触发 login/网络', () => {
  it('无记录→none；有效→valid；过期→expired；且无 login 调用', async () => {
    const tap = new ScriptedTapRuntime();
    const svc = new AuthService(tapPlatform(tap), { now: () => 10_000 });
    expect(await svc.checkSession()).toEqual({ status: 'none' });

    await svc.clearSession();
    tap.seedStorage(SESSION_STORAGE_KEY, {
      kind: 'taptap',
      sessionToken: 'tok',
      expiresAtMs: 20_000,
    });
    const valid = await svc.checkSession();
    expect(valid.status).toBe('valid');

    const expiredSvc = new AuthService(tapPlatform(tap), { now: () => 30_000 });
    const expired = await expiredSvc.checkSession();
    expect(expired.status).toBe('expired');
    expect(tap.invocations.filter((i) => i.api === 'login')).toHaveLength(0);
  });
});

describe('R17-T02 存储不可读→unknown，不当作未登录', () => {
  it('get 超时 reject SAVE_UNAVAILABLE → status unknown/reason timeout', async () => {
    const tap = new ScriptedTapRuntime();
    tap.script('getStorage', { type: 'silent' });
    const svc = new AuthService(tapPlatform(tap));
    const r = await svc.checkSession();
    expect(r.status).toBe('unknown');
    if (r.status === 'unknown') expect(r.reason).toBe('timeout');
  });
});

describe('R17-T03 授权拒绝不丢本地经营档（认证与存档分离）', () => {
  it('login deny → AUTH_REQUIRED，存档键完全不被触碰', async () => {
    const tap = new ScriptedTapRuntime();
    tap.script('login', { type: 'fail', result: { errMsg: 'login:fail auth deny' } });
    const platform = tapPlatform(tap);
    const svc = new AuthService(platform);
    const err = await svc.loginFresh().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(GameError);
    expect((err as GameError).code).toBe(GameErrorCode.AUTH_REQUIRED);
    // 没有任何 save 键写入
    expect(tap.invocations.filter((i) => i.api === 'setStorage')).toHaveLength(0);
  });
});

describe('R17-T06 日志不含 code/session/secret', () => {
  it('授权拒绝 details 只含错误原因，不含登录 code 值', async () => {
    const tap = new ScriptedTapRuntime();
    tap.script('login', { type: 'fail', result: { errMsg: 'login:fail code=SECRET123 deny' } });
    const svc = new AuthService(tapPlatform(tap));
    const err = await svc.loginFresh().catch((e: unknown) => e);
    const ge = err as GameError;
    expect(ge.code).toBe(GameErrorCode.AUTH_REQUIRED);
    expect(JSON.stringify(ge.details)).not.toContain('SECRET123');
  });
});
