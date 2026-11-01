#!/usr/bin/env node
/**
 * 《我是CEO》code2Session 最小服务端（设计文档 08.4）。
 *
 * 零第三方依赖（Node >=18，使用内置 http/fetch/crypto）。
 * 职责边界：
 *  - 接收客户端一次性 code；
 *  - 仅在服务端携带 AppID/Server Secret 调用 TapTap code2Session；
 *  - 校验上游响应，签发短期不透明 sessionToken；
 *  - 绝不把 session_key / openid / secret 回传客户端；
 *  - 不保存任何经营数据、姓名等业务/个人资料。
 *
 * 注意：TapTap code2Session 的真实 URL 与字段以官方当期文档为准，
 * 通过环境变量 TAPTAP_CODE2SESSION_URL 配置；如官方字段名不同，
 * 仅需调整 readUpstreamIdentity 一处。
 */

import { createServer } from 'node:http';
import { randomUUID, randomBytes } from 'node:crypto';

const PORT = Number(process.env.PORT ?? 8787);
const APP_ID = process.env.TAPTAP_APP_ID ?? '';
const SERVER_SECRET = process.env.TAPTAP_SERVER_SECRET ?? '';
const CODE2SESSION_URL = process.env.TAPTAP_CODE2SESSION_URL ?? '';
const SESSION_TTL_SEC = Number(process.env.SESSION_TTL_SEC ?? 3600);
// 上游请求超时
const UPSTREAM_TIMEOUT_MS = 6000;

// 进程内存会话表：token -> 过期 epoch ms（MVP 单实例足够；多实例需外置存储）
const sessions = new Map();

function failStart(message) {
  console.error(`[auth-server] 启动失败：${message}`);
  process.exit(1);
}

if (!APP_ID) failStart('缺少环境变量 TAPTAP_APP_ID');
if (!SERVER_SECRET) failStart('缺少环境变量 TAPTAP_SERVER_SECRET');
if (!CODE2SESSION_URL) failStart('缺少环境变量 TAPTAP_CODE2SESSION_URL（官方 code2Session 地址）');

function sendJson(res, statusCode, body) {
  const json = JSON.stringify(body);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(json);
}

function readBody(req, limitBytes = 8192) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limitBytes) {
        reject(new Error('payload too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/**
 * 调用官方 code2Session。
 * 文档要求的最小回传是平台身份；不同版本字段名可能为
 * openid / openId，session_key / sessionKey —— 这里做容忍解析，
 * 但 session_key 只在服务端使用，永不下发。
 */
async function exchangeWithTapTap(code) {
  const url = new URL(CODE2SESSION_URL);
  url.searchParams.set('client_id', APP_ID);
  url.searchParams.set('code', code);
  // 密钥优先走请求头（不在 URL/日志中出现）；若官方仅接受 query，
  // 在真机联调阶段按官方文档调整这一小段。
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  let upstream;
  try {
    upstream = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${SERVER_SECRET}`,
        'X-Tap-App-Id': APP_ID,
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  const text = await upstream.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!upstream.ok) {
    const code = data && typeof data === 'object' && 'code' in data ? String(data.code) : `http_${upstream.status}`;
    const invalid = upstream.status === 401 || upstream.status === 400 || /invalid|deny|expired/i.test(code);
    return { ok: false, invalid };
  }

  const identity = readUpstreamIdentity(data);
  if (!identity.ok) return { ok: false, invalid: identity.invalid };
  return { ok: true, openid: identity.openid };
}

function readUpstreamIdentity(data) {
  if (!data || typeof data !== 'object') return { ok: false, invalid: false };
  // 常见包裹：{data:{openid,...}} 或顶层 openid
  const candidate = data.data && typeof data.data === 'object' ? data.data : data;
  // 错误码显式判定
  const errcode = candidate.errcode ?? candidate.error ?? candidate.code;
  if (errcode !== undefined && errcode !== 0 && errcode !== '0') {
    const invalid = /invalid|deny|expired|40029|40163/i.test(String(errcode));
    return { ok: false, invalid };
  }
  const openid = candidate.openid ?? candidate.openId ?? candidate.unionid ?? candidate.unionId;
  if (typeof openid === 'string' && openid.length > 0) return { ok: true, openid };
  return { ok: false, invalid: false };
}

function issueSession(openid) {
  const token = `${randomUUID()}.${randomBytes(16).toString('hex')}`;
  const expiresAt = Date.now() + SESSION_TTL_SEC * 1000;
  sessions.set(token, { openid, expiresAt });
  return token;
}

// 惰性清理过期会话
setInterval(() => {
  const now = Date.now();
  for (const [token, meta] of sessions) {
    if (meta.expiresAt <= now) sessions.delete(token);
  }
}, 10 * 60 * 1000).unref();

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost');

    if (req.method === 'GET' && url.pathname === '/healthz') {
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/v1/auth/taptap/exchange') {
      let parsed;
      try {
        const raw = await readBody(req);
        parsed = JSON.parse(raw || '{}');
      } catch {
        sendJson(res, 400, { code: 'BAD_REQUEST' });
        return;
      }
      const code = typeof parsed?.code === 'string' ? parsed.code.trim() : '';
      if (code.length === 0 || code.length > 512) {
        sendJson(res, 400, { code: 'BAD_REQUEST' });
        return;
      }

      let result;
      try {
        result = await exchangeWithTapTap(code);
      } catch {
        sendJson(res, 503, { code: 'TAPTAP_UPSTREAM_UNAVAILABLE' });
        return;
      }

      if (!result.ok) {
        if (result.invalid) sendJson(res, 401, { code: 'TAPTAP_CODE_INVALID' });
        else sendJson(res, 503, { code: 'TAPTAP_UPSTREAM_UNAVAILABLE' });
        return;
      }

      const sessionToken = issueSession(result.openid);
      sendJson(res, 200, { sessionToken, expiresInSec: SESSION_TTL_SEC });
      return;
    }

    sendJson(res, 404, { code: 'NOT_FOUND' });
  } catch (err) {
    console.error('[auth-server] unhandled', err);
    sendJson(res, 500, { code: 'INTERNAL_ERROR' });
  }
});

server.listen(PORT, () => {
  console.log(`[auth-server] listening on :${PORT} (appId=${APP_ID ? '***set***' : 'missing'})`);
});
