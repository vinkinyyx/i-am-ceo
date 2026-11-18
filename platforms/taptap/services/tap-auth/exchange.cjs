'use strict';

/**
 * TapTap 普通小游戏 tap.login 一次性 code -> 稳定 profileId + 短期自定义 session。
 *
 * 纯业务：所有 I/O 通过依赖注入（fetchImpl / nowMs / nonce / logger），
 * 便于本地测试与平台无关部署。
 *
 * 安全纪律：
 * - session_key、secret、openid、完整上游 URL（含 query）绝不进入返回值或日志；
 * - 上游错误只映射为固定错误码，原始 errmsg 不外泄；
 * - 同一 code 不自动重试上游（一次性 code 重试必然失败）。
 */

const crypto = require('node:crypto');
const session = require('./session.cjs');

const DEFAULT_CODE2SESSION_URL = 'https://cloud-miniapp.tapapis.cn/auth/v1/jscode2session';
const UPSTREAM_TIMEOUT_MS = 4000;
const MAX_CODE_LENGTH = 1024;
/** 上游明确表示 code 无效/过期/已使用的错误码。 */
const INVALID_CODE_SET = new Set(['40029', '1040029', '40163', '41008', '41009']);
const REQUIRED_KEYS = [
  'TAP_MINIAPP_ID',
  'TAP_MINIAPP_SECRET',
  'GAME_APP_ID',
  'GAME_ENV',
  'PROFILE_HMAC_KEY',
  'SESSION_SIGNING_KEY',
];
const SUPPORTED_ENVIRONMENTS = new Set(['test', 'production']);

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * 读取并校验必需环境变量。缺失时返回 ready=false，不抛异常（便于健康检查）。
 * @param {Record<string, string|undefined>} env
 */
function readConfig(env) {
  const source = env && typeof env === 'object' ? env : {};
  const missingKeys = REQUIRED_KEYS.filter((key) => !nonEmptyString(source[key]));
  const invalidKeys = [];
  if (!missingKeys.includes('GAME_ENV') && !SUPPORTED_ENVIRONMENTS.has(source.GAME_ENV.trim())) {
    invalidKeys.push('GAME_ENV');
  }
  if (missingKeys.length > 0 || invalidKeys.length > 0) {
    return { ok: false, missingKeys, invalidKeys };
  }
  const overrideUrl = nonEmptyString(source.TAP_CODE2SESSION_URL)
    ? source.TAP_CODE2SESSION_URL.trim()
    : DEFAULT_CODE2SESSION_URL;
  return {
    ok: true,
    config: {
      miniAppId: source.TAP_MINIAPP_ID.trim(),
      miniAppSecret: source.TAP_MINIAPP_SECRET,
      gameAppId: source.GAME_APP_ID.trim(),
      environment: source.GAME_ENV.trim(),
      profileHmacKey: source.PROFILE_HMAC_KEY,
      sessionSigningKey: source.SESSION_SIGNING_KEY,
      code2SessionUrl: overrideUrl,
      ttlSec: session.resolveTtlSec(source.SESSION_TTL_SEC),
    },
  };
}

/**
 * profileId = 'tap_' + base64url(HMAC-SHA256(key, len(miniAppId):miniAppId + openid))。
 * 长度前缀消除拼接歧义；截断到 43 字符，满足云档 ID 的 [A-Za-z0-9_-] 与长度限制。
 */
function deriveProfileId(config, openid) {
  const material = `${Buffer.byteLength(config.miniAppId, 'utf8')}:${config.miniAppId}${openid}`;
  const digest = crypto.createHmac('sha256', config.profileHmacKey).update(material, 'utf8').digest('base64url');
  return `tap_${digest.slice(0, 43)}`;
}

function collectErrorCodes(data) {
  const codes = [];
  const sources = [data];
  if (data && typeof data === 'object' && data.data && typeof data.data === 'object' && !Array.isArray(data.data)) {
    sources.push(data.data);
  }
  for (const source of sources) {
    if (!source || typeof source !== 'object') continue;
    for (const key of ['errcode', 'errCode', 'error', 'errorCode', 'code']) {
      if (source[key] !== undefined && source[key] !== null) codes.push(String(source[key]));
    }
  }
  return codes;
}

/** 容忍 openid / openId 位于顶层或 data 包裹内。 */
function readOpenId(data) {
  if (!data || typeof data !== 'object') return null;
  const sources = [data];
  if (data.data && typeof data.data === 'object' && !Array.isArray(data.data)) sources.push(data.data);
  for (const source of sources) {
    for (const key of ['openid', 'openId']) {
      const value = source[key];
      if (typeof value === 'string' && value.trim().length > 0) return value.trim();
    }
  }
  return null;
}

function logEvent(logger, level, event, fields) {
  if (!logger || typeof logger[level] !== 'function') return;
  try {
    logger[level](event, fields);
  } catch {
    // 日志失败不得影响请求处理
  }
}

function classifyError(error) {
  if (error && typeof error === 'object' && error.name === 'AbortError') return 'timeout';
  return 'network';
}

async function callUpstream(config, code, fetchImpl) {
  const url = new URL(config.code2SessionUrl);
  url.searchParams.set('appid', config.miniAppId);
  url.searchParams.set('secret', config.miniAppSecret);
  url.searchParams.set('js_code', code);
  url.searchParams.set('grant_type', 'authorization_code');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
      redirect: 'error',
    });
    let text = '';
    if (response && typeof response.text === 'function') {
      text = await response.text();
    } else if (response && typeof response.json === 'function') {
      text = JSON.stringify(await response.json());
    }
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    const status = Number(response && response.status);
    const ok = response && response.ok === true ? true : status >= 200 && status < 300;
    return { ok, status, data };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 交换一次性 code。
 *
 * @param {object} input
 * @param {unknown} input.code 客户端一次性 code
 * @param {Record<string, string|undefined>} input.env 环境变量集合（不读 process.env）
 * @param {(url: URL, init: object) => Promise<any>} [input.fetchImpl]
 * @param {number} [input.nowMs]
 * @param {string} [input.nonce] 测试用 jti
 * @param {{info?: Function, warn?: Function, error?: Function}} [input.logger]
 * @returns {Promise<{ok: boolean, status: number, body: object}>}
 */
async function exchangeTapCode(input) {
  const { code, env, fetchImpl, nowMs, nonce, logger } = input || {};

  const configResult = readConfig(env);
  if (!configResult.ok) {
    logEvent(logger, 'warn', 'tap-auth.config.incomplete', {
      missingKeys: configResult.missingKeys,
      invalidKeys: configResult.invalidKeys,
    });
    return { ok: false, status: 503, body: { code: 'TAPTAP_UNAVAILABLE' } };
  }
  const config = configResult.config;

  const normalizedCode = typeof code === 'string' ? code.trim() : '';
  if (normalizedCode.length === 0 || normalizedCode.length > MAX_CODE_LENGTH) {
    return { ok: false, status: 400, body: { code: 'BAD_REQUEST' } };
  }

  const impl = typeof fetchImpl === 'function' ? fetchImpl : globalThis.fetch;
  if (typeof impl !== 'function') {
    logEvent(logger, 'error', 'tap-auth.fetch.unavailable', {});
    return { ok: false, status: 503, body: { code: 'TAPTAP_UNAVAILABLE' } };
  }

  let upstream;
  try {
    upstream = await callUpstream(config, normalizedCode, impl);
  } catch (error) {
    logEvent(logger, 'warn', 'tap-auth.upstream.unavailable', { reason: classifyError(error) });
    return { ok: false, status: 503, body: { code: 'TAPTAP_UNAVAILABLE' } };
  }

  // 上游限流：HTTP 429 或 TapTap/微信系 errcode 45009（api freq out of limit）→ 429，客户端可稍后重试。
  if (upstream.status === 429 || collectErrorCodes(upstream.data).some((value) => value === '45009')) {
    logEvent(logger, 'warn', 'tap-auth.upstream.rate_limited', {});
    return { ok: false, status: 429, body: { code: 'TAPTAP_RATE_LIMIT' } };
  }
  if (collectErrorCodes(upstream.data).some((value) => INVALID_CODE_SET.has(value))) {
    logEvent(logger, 'warn', 'tap-auth.upstream.code_invalid', {});
    return { ok: false, status: 401, body: { code: 'TAPTAP_CODE_INVALID' } };
  }
  if (!upstream.ok) {
    logEvent(logger, 'warn', 'tap-auth.upstream.unavailable', { reason: 'http_status' });
    return { ok: false, status: 503, body: { code: 'TAPTAP_UNAVAILABLE' } };
  }

  const openid = readOpenId(upstream.data);
  if (!openid) {
    logEvent(logger, 'error', 'tap-auth.upstream.malformed', {});
    return { ok: false, status: 503, body: { code: 'TAPTAP_UNAVAILABLE' } };
  }

  const now = Number(nowMs);
  const effectiveNowMs = Number.isFinite(now) ? now : Date.now();
  const issuedAtSec = Math.floor(effectiveNowMs / 1000);
  const ttlSec = config.ttlSec;
  const profileId = deriveProfileId(config, openid);
  const sessionToken = session.signSession(
    {
      sub: profileId,
      aud: `${config.gameAppId}/${config.environment}`,
      iat: issuedAtSec,
      exp: issuedAtSec + ttlSec,
      jti: nonEmptyString(nonce) ? nonce : crypto.randomUUID(),
    },
    config.sessionSigningKey,
  );

  logEvent(logger, 'info', 'tap-auth.exchange.ok', { ttlSec });
  return {
    ok: true,
    status: 200,
    body: {
      protocolVersion: 1,
      sessionToken,
      expiresInSec: ttlSec,
      profileId,
      appId: config.gameAppId,
      environment: config.environment,
      scope: 'tap-minigame-account',
    },
  };
}

module.exports = {
  DEFAULT_CODE2SESSION_URL,
  UPSTREAM_TIMEOUT_MS,
  MAX_CODE_LENGTH,
  readConfig,
  deriveProfileId,
  readOpenId,
  exchangeTapCode,
};
