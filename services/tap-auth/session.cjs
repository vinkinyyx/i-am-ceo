'use strict';

/**
 * 短期自定义会话 token（HMAC-SHA256 紧凑格式）。
 *
 * 格式：base64url(payloadJson) + "." + base64url(hmacSha256(payloadPart))
 * payload 至少包含 sub / aud / iat / exp / jti。
 * 只使用 Node 内置 crypto，无第三方依赖。
 */

const crypto = require('node:crypto');

const DEFAULT_TTL_SEC = 900;
const MIN_TTL_SEC = 60;
const MAX_TTL_SEC = 3600;
/** 允许的客户端/服务端时钟偏差（秒）。 */
const MAX_CLOCK_SKEW_SEC = 60;
/** token 最大长度，超长直接视为非法，避免解析开销。 */
const MAX_TOKEN_LENGTH = 4096;

function hasUsableKey(key) {
  if (typeof key === 'string') return key.length > 0;
  return Buffer.isBuffer(key) && key.length > 0;
}

function toBase64Url(value) {
  return Buffer.from(value).toString('base64url');
}

function decodePayloadPart(part) {
  try {
    const raw = Buffer.from(part, 'base64url');
    if (raw.length === 0) return null;
    const parsed = JSON.parse(raw.toString('utf8'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** 会话有效期：默认 900，仅接受 [60, 3600] 的整数，否则回落默认值。 */
function resolveTtlSec(value) {
  if (value === undefined || value === null || value === '') return DEFAULT_TTL_SEC;
  const numeric = Number(value);
  if (!Number.isInteger(numeric)) return DEFAULT_TTL_SEC;
  if (numeric < MIN_TTL_SEC || numeric > MAX_TTL_SEC) return DEFAULT_TTL_SEC;
  return numeric;
}

/**
 * 签发会话 token。
 * @param {Record<string, unknown>} payload
 * @param {string|Buffer} key
 * @returns {string}
 */
function signSession(payload, key) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new TypeError('payload must be a plain object');
  }
  if (!hasUsableKey(key)) throw new TypeError('session signing key is required');
  const body = toBase64Url(JSON.stringify(payload));
  const signature = crypto.createHmac('sha256', key).update(body).digest();
  return `${body}.${signature.toString('base64url')}`;
}

/**
 * 校验会话 token。
 * @param {string} token
 * @param {string|Buffer} key
 * @param {string} expectedAud
 * @param {number} nowMs
 * @returns {{ok: true, payload: Record<string, unknown>} | {ok: false, reason: string}}
 */
function verifySession(token, key, expectedAud, nowMs) {
  if (typeof token !== 'string' || token.length === 0 || token.length > MAX_TOKEN_LENGTH) {
    return { ok: false, reason: 'malformed' };
  }
  const parts = token.split('.');
  if (parts.length !== 2 || parts[0].length === 0 || parts[1].length === 0) {
    return { ok: false, reason: 'malformed' };
  }
  if (!hasUsableKey(key)) return { ok: false, reason: 'invalid-key' };

  const expected = crypto.createHmac('sha256', key).update(parts[0]).digest();
  let actual;
  try {
    actual = Buffer.from(parts[1], 'base64url');
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
    return { ok: false, reason: 'bad-signature' };
  }

  const payload = decodePayloadPart(parts[0]);
  if (!payload) return { ok: false, reason: 'malformed' };

  if (typeof expectedAud === 'string' && payload.aud !== expectedAud) {
    return { ok: false, reason: 'audience-mismatch' };
  }

  const nowSeconds = Math.floor(Number(nowMs) / 1000);
  if (!Number.isFinite(nowSeconds)) return { ok: false, reason: 'invalid-clock' };

  const { iat, exp } = payload;
  if (!Number.isInteger(iat) || !Number.isInteger(exp)) return { ok: false, reason: 'malformed' };
  if (iat > nowSeconds + MAX_CLOCK_SKEW_SEC) return { ok: false, reason: 'issued-in-future' };
  if (exp <= iat || exp - iat > MAX_TTL_SEC + MAX_CLOCK_SKEW_SEC) {
    return { ok: false, reason: 'invalid-lifetime' };
  }
  if (exp <= nowSeconds) return { ok: false, reason: 'expired' };
  if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
    return { ok: false, reason: 'missing-subject' };
  }

  return { ok: true, payload };
}

module.exports = {
  DEFAULT_TTL_SEC,
  MIN_TTL_SEC,
  MAX_TTL_SEC,
  MAX_CLOCK_SKEW_SEC,
  resolveTtlSec,
  signSession,
  verifySession,
};
