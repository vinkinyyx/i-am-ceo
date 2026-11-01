/**
 * 《我是CEO》code2Session 云函数（LeanCloud 云引擎版）
 *
 * 与 server/auth-server.mjs 等价：相同路由、相同请求/响应契约、相同错误码，
 * 客户端无需任何改动。职责边界：
 *  - 接收客户端一次性 code；
 *  - 仅在服务端携带 AppID/Server Secret 调用 TapTap code2Session；
 *  - 校验上游响应，签发短期不透明 sessionToken；
 *  - 绝不把 session_key / openid / secret 回传客户端；
 *  - 不保存任何经营数据、姓名等业务/个人资料。
 *
 * 环境变量（在云引擎控制台「自定义环境变量」配置，切勿写进代码）：
 *  - TAPTAP_APP_ID            TapTap 应用 Client ID
 *  - TAPTAP_SERVER_SECRET     TapTap Server Secret
 *  - TAPTAP_CODE2SESSION_URL  官方 code2Session 地址（以当期官方文档为准）
 *  - SESSION_TTL_SEC          可选，会话有效期秒数，默认 3600
 *
 * 注意：TapTap code2Session 的真实 URL 与字段以官方当期文档为准；
 * 如官方字段名不同，仅需调整 readUpstreamIdentity 一处。
 * 与 server/auth-server.mjs 的任何行为变更请保持两边同步。
 */

'use strict';

const express = require('express');
const AV = require('leanengine');
const { randomUUID, randomBytes } = require('node:crypto');

AV.init({
  appId: process.env.LEANCLOUD_APP_ID,
  appKey: process.env.LEANCLOUD_APP_KEY,
  masterKey: process.env.LEANCLOUD_APP_MASTER_KEY,
});

const APP_ID = process.env.TAPTAP_APP_ID ?? '';
const SERVER_SECRET = process.env.TAPTAP_SERVER_SECRET ?? '';
const CODE2SESSION_URL = process.env.TAPTAP_CODE2SESSION_URL ?? '';
const SESSION_TTL_SEC = Number(process.env.SESSION_TTL_SEC ?? 3600);
const UPSTREAM_TIMEOUT_MS = 6000;

// 进程内存会话表：token -> 过期 epoch ms
// MVP 单实例足够；如扩容多实例，需改用 LeanCache(Redis) 存储会话。
const sessions = new Map();

function requireEnv(name, value) {
  if (!value) {
    console.error(`[auth-cloud] 启动失败：缺少环境变量 ${name}`);
    process.exit(1);
  }
}
requireEnv('TAPTAP_APP_ID', APP_ID);
requireEnv('TAPTAP_SERVER_SECRET', SERVER_SECRET);
requireEnv('TAPTAP_CODE2SESSION_URL', CODE2SESSION_URL);

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
    const errCode = data && typeof data === 'object' && 'code' in data ? String(data.code) : `http_${upstream.status}`;
    const invalid = upstream.status === 401 || upstream.status === 400 || /invalid|deny|expired/i.test(errCode);
    return { ok: false, invalid };
  }

  return readUpstreamIdentity(data);
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

const app = express();
// 云引擎托管中间件（健康检查等），必须保留
app.use(AV.express());
app.use(express.json({ limit: '8kb' }));

app.get('/healthz', (req, res) => {
  res.status(200).json({ ok: true });
});

// 与客户端 AuthService 约定的唯一业务路由（契约见 assets/core/platform/AuthService.ts）
app.post('/v1/auth/taptap/exchange', async (req, res) => {
  try {
    const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
    if (code.length === 0 || code.length > 512) {
      res.status(400).json({ code: 'BAD_REQUEST' });
      return;
    }

    let result;
    try {
      result = await exchangeWithTapTap(code);
    } catch {
      res.status(503).json({ code: 'TAPTAP_UPSTREAM_UNAVAILABLE' });
      return;
    }

    if (!result.ok) {
      if (result.invalid) res.status(401).json({ code: 'TAPTAP_CODE_INVALID' });
      else res.status(503).json({ code: 'TAPTAP_UPSTREAM_UNAVAILABLE' });
      return;
    }

    const sessionToken = issueSession(result.openid);
    res.set('Cache-Control', 'no-store');
    res.status(200).json({ sessionToken, expiresInSec: SESSION_TTL_SEC });
  } catch (err) {
    console.error('[auth-cloud] unhandled', err);
    res.status(500).json({ code: 'INTERNAL_ERROR' });
  }
});

// 未匹配路由统一 404（云引擎自身路由除外）
app.use((req, res) => {
  res.status(404).json({ code: 'NOT_FOUND' });
});

const PORT = Number(process.env.LEANCLOUD_APP_PORT ?? process.env.PORT ?? 3000);
app.listen(PORT, () => {
  console.log(`[auth-cloud] listening on :${PORT} (appId=${APP_ID ? '***set***' : 'missing'})`);
});
