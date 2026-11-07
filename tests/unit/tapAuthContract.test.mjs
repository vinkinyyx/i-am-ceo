// TapTap code 换票云函数契约测试（ESM；被测实现为 CommonJS，经 createRequire 载入）。
import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', '..');
const require = createRequire(import.meta.url);
const { createApp } = require(path.join(root, 'services', 'tap-auth', 'handler.cjs'));
const session = require(path.join(root, 'services', 'tap-auth', 'session.cjs'));
const exchangeModule = require(path.join(root, 'services', 'tap-auth', 'exchange.cjs'));

const EXCHANGE_PATH = '/v1/auth/taptap/exchange';
const OPENID = 'openid-abc-XYZ-sensitive-value';
const MINIAPP_SECRET = 'miniapp-server-secret-DO-NOT-LEAK';
const UPSTREAM_SESSION_KEY = 'upstream-session-key-DO-NOT-LEAK';
const CODE_MARKER = 'ONE_TIME_CODE_MARKER_7f3a';
const NOW_MS = Date.parse('2026-11-07T12:00:00Z');

const ENV = {
  TAP_MINIAPP_ID: 'miniapp-1016161',
  TAP_MINIAPP_SECRET: MINIAPP_SECRET,
  GAME_APP_ID: '1016161',
  GAME_ENV: 'test',
  PROFILE_HMAC_KEY: 'profile-hmac-key-for-tests-0123456789',
  SESSION_SIGNING_KEY: 'session-signing-key-for-tests-9876543210',
  SESSION_TTL_SEC: '900',
};

function jsonResponse(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (typeof payload === 'string' ? payload : JSON.stringify(payload)),
  };
}

function upstreamWithOpenId(openid) {
  return async () => jsonResponse(200, { openid, session_key: UPSTREAM_SESSION_KEY });
}

function makeLogger() {
  const lines = [];
  const push = (level) => (event, fields) => {
    lines.push(`${level} ${event} ${JSON.stringify(fields ?? {})}`);
  };
  return { info: push('info'), warn: push('warn'), error: push('error'), lines };
}

async function call(app, options = {}) {
  const {
    method = 'POST',
    path: requestPath = EXCHANGE_PATH,
    headers = { 'content-type': 'application/json; charset=utf-8' },
    body,
  } = options;
  const response = await app.handleRequest({
    method,
    path: requestPath,
    headers,
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    bodyTooLarge: options.bodyTooLarge === true,
  });
  return {
    status: response.statusCode,
    headers: response.headers,
    raw: response.body,
    body: JSON.parse(response.body),
  };
}

function makeApp(overrides = {}) {
  return createApp({
    env: { ...ENV },
    now: () => NOW_MS,
    fetchImpl: upstreamWithOpenId(OPENID),
    ...overrides,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('合法交换', () => {
  it('返回 200 与完整会话字段，sessionToken 可验签', async () => {
    let capturedUrl = null;
    const app = makeApp({
      fetchImpl: async (url) => {
        capturedUrl = url;
        return jsonResponse(200, { openid: OPENID, session_key: UPSTREAM_SESSION_KEY });
      },
    });

    const r = await call(app, { body: { code: CODE_MARKER } });

    expect(r.status).toBe(200);
    expect(r.body.protocolVersion).toBe(1);
    expect(r.body.profileId).toMatch(/^tap_[A-Za-z0-9_-]+$/);
    expect(r.body.profileId.length).toBeLessThanOrEqual(64);
    expect(r.body.appId).toBe('1016161');
    expect(r.body.environment).toBe('test');
    expect(r.body.scope).toBe('tap-minigame-account');
    expect(r.body.expiresInSec).toBe(900);
    expect(typeof r.body.sessionToken).toBe('string');

    const verified = session.verifySession(r.body.sessionToken, ENV.SESSION_SIGNING_KEY, '1016161/test', NOW_MS);
    expect(verified.ok).toBe(true);
    expect(verified.payload.sub).toBe(r.body.profileId);
    expect(verified.payload.exp - verified.payload.iat).toBe(900);
    expect(typeof verified.payload.jti).toBe('string');

    // 上游请求参数符合官方 code2Session 契约（secret 仅在服务端侧发出）
    expect(capturedUrl instanceof URL).toBe(true);
    expect(capturedUrl.searchParams.get('appid')).toBe(ENV.TAP_MINIAPP_ID);
    expect(capturedUrl.searchParams.get('secret')).toBe(MINIAPP_SECRET);
    expect(capturedUrl.searchParams.get('js_code')).toBe(CODE_MARKER);
    expect(capturedUrl.searchParams.get('grant_type')).toBe('authorization_code');
  });

  it('响应与错误不泄漏 secret / session_key / openid', async () => {
    const app = makeApp();
    const r = await call(app, { body: { code: CODE_MARKER } });
    expect(r.raw).not.toContain(MINIAPP_SECRET);
    expect(r.raw).not.toContain(UPSTREAM_SESSION_KEY);
    expect(r.raw).not.toContain(OPENID);
  });

  it('同一 openid 稳定得到同一 profileId，不同 openid 不同', async () => {
    const appA = makeApp({ fetchImpl: upstreamWithOpenId(OPENID) });
    const appB = makeApp({ fetchImpl: upstreamWithOpenId(OPENID) });
    const appC = makeApp({ fetchImpl: upstreamWithOpenId('another-openid-value') });

    const first = await call(appA, { body: { code: 'code-1' } });
    const second = await call(appB, { body: { code: 'code-2' } });
    const other = await call(appC, { body: { code: 'code-3' } });

    expect(first.body.profileId).toBe(second.body.profileId);
    expect(other.body.profileId).not.toBe(first.body.profileId);
    expect(first.body.profileId.startsWith('tap_')).toBe(true);
  });

  it('data 包裹与 openId 命名均可解析', async () => {
    const app = makeApp({ fetchImpl: async () => jsonResponse(200, { data: { openId: OPENID } }) });
    const r = await call(app, { body: { code: 'code-wrapped' } });
    expect(r.status).toBe(200);
  });

  it('忽略客户端提交的越权字段', async () => {
    const app = makeApp();
    const r = await call(app, {
      body: {
        code: 'code-extra',
        openid: 'attacker-openid',
        profileId: 'tap_attacker',
        appId: '9999999',
        secret: 'attacker-secret',
        TAP_CODE2SESSION_URL: 'https://evil.example/steal',
      },
    });
    expect(r.status).toBe(200);
    expect(r.body.appId).toBe('1016161');
    expect(r.body.profileId).not.toBe('tap_attacker');
    expect(r.raw).not.toContain('attacker');
  });
});

describe('上游错误映射', () => {
  it('上游 400 + 40029 → 401 TAPTAP_CODE_INVALID', async () => {
    const app = makeApp({
      fetchImpl: async () => jsonResponse(400, { code: 40029, errmsg: 'invalid code SECRET_ERRMSG' }),
    });
    const r = await call(app, { body: { code: 'used-code' } });
    expect(r.status).toBe(401);
    expect(r.body).toEqual({ code: 'TAPTAP_CODE_INVALID' });
    expect(r.raw).not.toContain('SECRET_ERRMSG');
    expect(r.raw).not.toContain('40029');
  });

  it('上游 200 + errcode 1040029 → 401', async () => {
    const app = makeApp({ fetchImpl: async () => jsonResponse(200, { errcode: 1040029 }) });
    const r = await call(app, { body: { code: 'expired-code' } });
    expect(r.status).toBe(401);
    expect(r.body).toEqual({ code: 'TAPTAP_CODE_INVALID' });
  });

  it('上游 401 + 40163 → 401', async () => {
    const app = makeApp({ fetchImpl: async () => jsonResponse(401, { errcode: 40163 }) });
    const r = await call(app, { body: { code: 'reused-code' } });
    expect(r.status).toBe(401);
    expect(r.body).toEqual({ code: 'TAPTAP_CODE_INVALID' });
  });

  it('上游超时（AbortError）→ 503 TAPTAP_UNAVAILABLE，且同一 code 不自动重试', async () => {
    let calls = 0;
    const app = makeApp({
      fetchImpl: async () => {
        calls += 1;
        const error = new Error('The operation was aborted');
        error.name = 'AbortError';
        throw error;
      },
    });
    const r = await call(app, { body: { code: 'slow-code' } });
    expect(r.status).toBe(503);
    expect(r.body).toEqual({ code: 'TAPTAP_UNAVAILABLE' });
    expect(calls).toBe(1);
  });

  it('上游 5xx → 503 且不泄漏原始 errmsg', async () => {
    const app = makeApp({
      fetchImpl: async () => jsonResponse(500, { errmsg: 'upstream stack SECRET_ERRMSG' }),
    });
    const r = await call(app, { body: { code: 'code-5xx' } });
    expect(r.status).toBe(503);
    expect(r.body).toEqual({ code: 'TAPTAP_UNAVAILABLE' });
    expect(r.raw).not.toContain('SECRET_ERRMSG');
  });

  it('上游缺 openid → 503', async () => {
    const app = makeApp({ fetchImpl: async () => jsonResponse(200, { session_key: UPSTREAM_SESSION_KEY }) });
    const r = await call(app, { body: { code: 'code-no-openid' } });
    expect(r.status).toBe(503);
    expect(r.body).toEqual({ code: 'TAPTAP_UNAVAILABLE' });
    expect(r.raw).not.toContain(UPSTREAM_SESSION_KEY);
  });

  it('上游非 JSON → 503', async () => {
    const app = makeApp({ fetchImpl: async () => jsonResponse(200, '<html>bad gateway SECRET_ERRMSG</html>') });
    const r = await call(app, { body: { code: 'code-html' } });
    expect(r.status).toBe(503);
    expect(r.body).toEqual({ code: 'TAPTAP_UNAVAILABLE' });
  });

  it('上游 HTTP 429 → 429 TAPTAP_RATE_LIMIT（客户端可稍后重试，不误判 code 失效）', async () => {
    const app = makeApp({ fetchImpl: async () => jsonResponse(429, { errmsg: 'freq limited SECRET_ERRMSG' }) });
    const r = await call(app, { body: { code: 'rate-limited-code' } });
    expect(r.status).toBe(429);
    expect(r.body).toEqual({ code: 'TAPTAP_RATE_LIMIT' });
    expect(r.raw).not.toContain('SECRET_ERRMSG');
  });

  it('上游 200 + errcode 45009 → 429 TAPTAP_RATE_LIMIT', async () => {
    const app = makeApp({ fetchImpl: async () => jsonResponse(200, { errcode: 45009, errmsg: 'api freq out of limit' }) });
    const r = await call(app, { body: { code: 'freq-code' } });
    expect(r.status).toBe(429);
    expect(r.body).toEqual({ code: 'TAPTAP_RATE_LIMIT' });
  });

  it('限流日志不含 code / secret / errmsg', async () => {
    const logger = makeLogger();
    const app = makeApp({
      logger,
      fetchImpl: async () => jsonResponse(429, { errmsg: 'SECRET_ERRMSG', openid: OPENID }),
    });
    await call(app, { body: { code: CODE_MARKER } });
    const text = logger.lines.join('\n');
    expect(text).not.toContain(MINIAPP_SECRET);
    expect(text).not.toContain(OPENID);
    expect(text).not.toContain(CODE_MARKER);
    expect(text).not.toContain('SECRET_ERRMSG');
  });
});

describe('请求校验', () => {
  it('非法 JSON → 400', async () => {
    const app = makeApp();
    const r = await call(app, { body: '{not-json' });
    expect(r.status).toBe(400);
    expect(r.body).toEqual({ code: 'BAD_REQUEST' });
  });

  it('非 JSON Content-Type → 400', async () => {
    const app = makeApp();
    const r = await call(app, { body: { code: 'x' }, headers: { 'content-type': 'text/plain' } });
    expect(r.status).toBe(400);
    expect(r.body).toEqual({ code: 'BAD_REQUEST' });
  });

  it('缺少 Content-Type → 400', async () => {
    const app = makeApp();
    const r = await call(app, { body: { code: 'x' }, headers: {} });
    expect(r.status).toBe(400);
  });

  it('body 超过 4KiB → 400', async () => {
    const app = makeApp();
    const r = await call(app, { body: JSON.stringify({ code: 'a'.repeat(5000) }) });
    expect(r.status).toBe(400);
    expect(r.body).toEqual({ code: 'BAD_REQUEST' });
  });

  it('本地服务器标记的超大 body → 400', async () => {
    const app = makeApp();
    const r = await call(app, { body: JSON.stringify({ code: 'ok' }), bodyTooLarge: true });
    expect(r.status).toBe(400);
  });

  it('code 缺失 / 空串 / 非字符串 / 超长 → 400', async () => {
    const app = makeApp();
    for (const body of [{}, { code: '' }, { code: '   ' }, { code: 123 }, { code: null }, { code: 'a'.repeat(1025) }]) {
      const r = await call(app, { body });
      expect(r.status).toBe(400);
      expect(r.body).toEqual({ code: 'BAD_REQUEST' });
    }
  });

  it('body 为数组或 null → 400', async () => {
    const app = makeApp();
    expect((await call(app, { body: '[]' })).status).toBe(400);
    expect((await call(app, { body: 'null' })).status).toBe(400);
  });

  it('code 长度恰为 1024 时通过校验并进入上游', async () => {
    let called = 0;
    const app = makeApp({
      fetchImpl: async () => {
        called += 1;
        return jsonResponse(200, { openid: OPENID });
      },
    });
    const r = await call(app, { body: { code: 'a'.repeat(1024) } });
    expect(r.status).toBe(200);
    expect(called).toBe(1);
  });
});

describe('health / 路由', () => {
  it('GET /health 返回固定字段且无敏感信息', async () => {
    const app = makeApp();
    const r = await call(app, { method: 'GET', path: '/health' });
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ protocolVersion: 1, serviceVersion: '1.0.0', ready: true });
    expect(r.raw).not.toContain(MINIAPP_SECRET);
    expect(r.raw).not.toContain(OPENID);
    expect(r.raw).not.toContain(ENV.PROFILE_HMAC_KEY);
    expect(r.raw).not.toContain(ENV.SESSION_SIGNING_KEY);
  });

  it('缺少必需环境变量时 ready=false 且 exchange 返回 503（不崩溃）', async () => {
    const app = createApp({ env: {}, now: () => NOW_MS, fetchImpl: upstreamWithOpenId(OPENID) });
    const health = await call(app, { method: 'GET', path: '/health' });
    expect(health.status).toBe(200);
    expect(health.body.ready).toBe(false);
    const exchange = await call(app, { body: { code: 'code' } });
    expect(exchange.status).toBe(503);
    expect(exchange.body).toEqual({ code: 'TAPTAP_UNAVAILABLE' });
  });

  it('GAME_ENV 非法时 ready=false', async () => {
    const app = createApp({
      env: { ...ENV, GAME_ENV: 'staging' },
      now: () => NOW_MS,
      fetchImpl: upstreamWithOpenId(OPENID),
    });
    const health = await call(app, { method: 'GET', path: '/health' });
    expect(health.body.ready).toBe(false);
  });

  it('GET exchange → 405，未知路径 → 404', async () => {
    const app = makeApp();
    const wrongMethod = await call(app, { method: 'GET', body: undefined });
    expect(wrongMethod.status).toBe(405);
    expect(wrongMethod.body).toEqual({ code: 'METHOD_NOT_ALLOWED' });

    const notFound = await call(app, { method: 'GET', path: '/v1/unknown' });
    expect(notFound.status).toBe(404);
    expect(notFound.body).toEqual({ code: 'NOT_FOUND' });
  });

  it('SCF 事件适配：函数 URL 事件可正常换票', async () => {
    const app = makeApp();
    const event = {
      version: '2.0',
      rawPath: EXCHANGE_PATH,
      rawQueryString: '',
      headers: { 'content-type': 'application/json' },
      requestContext: { http: { method: 'POST', path: EXCHANGE_PATH } },
      body: JSON.stringify({ code: 'scf-code' }),
      isBase64Encoded: false,
    };
    const response = await app.handleEvent(event, {});
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.protocolVersion).toBe(1);
    expect(body.profileId).toMatch(/^tap_/);
  });

  it('SCF 事件适配：base64 body 可解析', async () => {
    const app = makeApp();
    const event = {
      httpMethod: 'POST',
      path: EXCHANGE_PATH,
      headers: { 'Content-Type': 'application/json' },
      body: Buffer.from(JSON.stringify({ code: 'scf-base64' }), 'utf8').toString('base64'),
      isBase64Encoded: true,
    };
    const response = await app.handleEvent(event, {});
    expect(response.statusCode).toBe(200);
  });

  it('要求模块时不启动本地监听', () => {
    // 本文件顶部已 require handler.cjs；若 require 时监听端口，后续用例会冲突/进程挂起。
    const handlerSource = fs.readFileSync(path.join(root, 'services', 'tap-auth', 'handler.cjs'), 'utf8');
    expect(handlerSource).toContain('require.main === module');
  });
});

describe('session token 校验', () => {
  const KEY = ENV.SESSION_SIGNING_KEY;
  const AUD = '1016161/test';
  const nowSec = Math.floor(NOW_MS / 1000);
  const basePayload = {
    sub: 'tap_abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG',
    aud: AUD,
    iat: nowSec,
    exp: nowSec + 900,
    jti: 'jti-test',
  };

  it('正常 token 验签成功', () => {
    const token = session.signSession(basePayload, KEY);
    const result = session.verifySession(token, KEY, AUD, NOW_MS);
    expect(result.ok).toBe(true);
    expect(result.payload.sub).toBe(basePayload.sub);
  });

  it('篡改 payload（保留原签名）→ bad-signature', () => {
    const token = session.signSession(basePayload, KEY);
    const [payloadPart, sigPart] = token.split('.');
    const tamperedPayload = Buffer.from(
      JSON.stringify({ ...basePayload, sub: 'tap_attacker' }),
      'utf8',
    ).toString('base64url');
    const result = session.verifySession(`${tamperedPayload}.${sigPart}`, KEY, AUD, NOW_MS);
    expect(result).toEqual({ ok: false, reason: 'bad-signature' });
    expect(payloadPart).not.toBe(tamperedPayload);
  });

  it('篡改签名 → bad-signature', () => {
    const token = session.signSession(basePayload, KEY);
    const [payloadPart, sigPart] = token.split('.');
    const flipped = (sigPart[0] === 'A' ? 'B' : 'A') + sigPart.slice(1);
    expect(session.verifySession(`${payloadPart}.${flipped}`, KEY, AUD, NOW_MS)).toEqual({
      ok: false,
      reason: 'bad-signature',
    });
  });

  it('过期 → expired', () => {
    const token = session.signSession(basePayload, KEY);
    const result = session.verifySession(token, KEY, AUD, (nowSec + 901) * 1000);
    expect(result).toEqual({ ok: false, reason: 'expired' });
  });

  it('错误 aud → audience-mismatch', () => {
    const token = session.signSession(basePayload, KEY);
    expect(session.verifySession(token, KEY, '1016161/production', NOW_MS)).toEqual({
      ok: false,
      reason: 'audience-mismatch',
    });
  });

  it('错误密钥 / 畸形 token / iat 超前 → 明确失败', () => {
    const token = session.signSession(basePayload, KEY);
    expect(session.verifySession(token, 'another-key', AUD, NOW_MS).ok).toBe(false);
    expect(session.verifySession('not-a-token', KEY, AUD, NOW_MS)).toEqual({ ok: false, reason: 'malformed' });
    expect(session.verifySession(token, KEY, AUD, NaN)).toEqual({ ok: false, reason: 'invalid-clock' });

    const future = session.signSession({ ...basePayload, iat: nowSec + 3600, exp: nowSec + 4500 }, KEY);
    expect(session.verifySession(future, KEY, AUD, NOW_MS)).toEqual({ ok: false, reason: 'issued-in-future' });
  });

  it('TTL 归一到 60..3600，默认 900', () => {
    expect(session.resolveTtlSec(undefined)).toBe(900);
    expect(session.resolveTtlSec('300')).toBe(300);
    expect(session.resolveTtlSec('59')).toBe(900);
    expect(session.resolveTtlSec('3601')).toBe(900);
    expect(session.resolveTtlSec('abc')).toBe(900);
  });
});

describe('日志脱敏', () => {
  it('注入 logger 时日志不含 secret / openid / code', async () => {
    const logger = makeLogger();
    const app = makeApp({ logger });
    await call(app, { body: { code: CODE_MARKER } });
    await call(app, { body: { code: 'bad-code' }, headers: { 'content-type': 'text/plain' } });

    const text = logger.lines.join('\n');
    expect(logger.lines.length).toBeGreaterThan(0);
    expect(text).not.toContain(MINIAPP_SECRET);
    expect(text).not.toContain(UPSTREAM_SESSION_KEY);
    expect(text).not.toContain(OPENID);
    expect(text).not.toContain(CODE_MARKER);
  });

  it('上游失败时日志不含 openid / secret / code / errmsg', async () => {
    const logger = makeLogger();
    const app = makeApp({
      logger,
      fetchImpl: async () => jsonResponse(500, { errmsg: 'SECRET_ERRMSG', openid: OPENID }),
    });
    await call(app, { body: { code: CODE_MARKER } });
    const text = logger.lines.join('\n');
    expect(text).not.toContain(MINIAPP_SECRET);
    expect(text).not.toContain(OPENID);
    expect(text).not.toContain(CODE_MARKER);
    expect(text).not.toContain('SECRET_ERRMSG');
  });

  it('未注入 logger 时 console 也不输出敏感信息', async () => {
    const captured = [];
    vi.spyOn(console, 'log').mockImplementation((...args) => captured.push(args.join(' ')));
    vi.spyOn(console, 'warn').mockImplementation((...args) => captured.push(args.join(' ')));
    vi.spyOn(console, 'error').mockImplementation((...args) => captured.push(args.join(' ')));

    const app = createApp({
      env: { ...ENV },
      now: () => NOW_MS,
      fetchImpl: upstreamWithOpenId(OPENID),
    });
    await call(app, { body: { code: CODE_MARKER } });

    const text = captured.join('\n');
    expect(text).not.toContain(MINIAPP_SECRET);
    expect(text).not.toContain(OPENID);
    expect(text).not.toContain(CODE_MARKER);
  });
});

describe('模块自检', () => {
  it('exchange 模块不读取 process.env 作为唯一来源（env 注入生效）', async () => {
    const result = await exchangeModule.exchangeTapCode({
      code: 'code',
      env: { ...ENV, GAME_APP_ID: '7777777' },
      fetchImpl: upstreamWithOpenId(OPENID),
      nowMs: NOW_MS,
      nonce: 'fixed-jti',
    });
    expect(result.ok).toBe(true);
    expect(result.body.appId).toBe('7777777');
    expect(session.verifySession(result.body.sessionToken, ENV.SESSION_SIGNING_KEY, '7777777/test', NOW_MS).ok).toBe(
      true,
    );
  });
});
