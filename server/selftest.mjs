/**
 * auth-server 本地自检（不访问真实 TapTap）：
 * 起一个假 code2Session 上游 + 真 auth-server，验证：
 *  - 200 正常签发会话；
 *  - 401 code 非法；503 上游 5xx；
 *  - 不回传 session_key/openid；
 *  - healthz 与 404。
 * 运行：node server/selftest.mjs
 */
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const UPSTREAM_PORT = 8911;
const SERVER_PORT = 8912;

let mode = 'ok'; // ok | invalid | error
const upstream = createServer((req, res) => {
  const u = new URL(req.url ?? '/', 'http://x');
  const auth = req.headers['authorization'];
  const appId = req.headers['x-tap-app-id'];
  if (!auth || !appId) {
    res.writeHead(401); res.end(JSON.stringify({ errcode: 'no_auth' })); return;
  }
  if (mode === 'invalid') { res.writeHead(400); res.end(JSON.stringify({ errcode: 40029 })); return; }
  if (mode === 'error') { res.writeHead(500); res.end('boom'); return; }
  res.writeHead(200, { 'Content-Type': 'application/json' });
  // 故意带 session_key，验证服务端绝不下发
  res.end(JSON.stringify({ openid: 'open-test-123', session_key: 'SUPER_SECRET_KEY' }));
  void u;
});

await new Promise((r) => upstream.listen(UPSTREAM_PORT, r));

const child = spawn(process.execPath, [path.join(here, 'auth-server.mjs')], {
  env: {
    ...process.env,
    PORT: String(SERVER_PORT),
    TAPTAP_APP_ID: 'tap-test-app',
    TAPTAP_SERVER_SECRET: 'test-secret',
    TAPTAP_CODE2SESSION_URL: `http://127.0.0.1:${UPSTREAM_PORT}/jscode2session`,
    SESSION_TTL_SEC: '3600',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
child.stderr.on('data', (d) => process.stderr.write(`[srv] ${d}`));

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
await wait(400);

async function exchange(code) {
  const res = await fetch(`http://127.0.0.1:${SERVER_PORT}/v1/auth/taptap/exchange`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  return { status: res.status, body: await res.json() };
}

let failures = 0;
function check(name, cond, extra = '') {
  if (cond) console.log(`PASS ${name}`);
  else { failures += 1; console.error(`FAIL ${name} ${extra}`); }
}

// 1) 正常交换
mode = 'ok';
let r = await exchange('good-code');
check('200 签发会话', r.status === 200 && typeof r.body.sessionToken === 'string' && r.body.sessionToken.length > 20, JSON.stringify(r));
check('expiresInSec=3600', r.body.expiresInSec === 3600, JSON.stringify(r.body));
check('不下发 session_key/openid', !('session_key' in r.body) && !('openid' in r.body), JSON.stringify(r.body));

// 2) 空 code 拒绝
r = await exchange('   ');
check('空 code -> 400', r.status === 400, String(r.status));

// 3) 非法 code
mode = 'invalid';
r = await exchange('bad');
check('非法 code -> 401', r.status === 401 && r.body.code === 'TAPTAP_CODE_INVALID', JSON.stringify(r));

// 4) 上游错误
mode = 'error';
r = await exchange('x');
check('上游 5xx -> 503', r.status === 503 && r.body.code === 'TAPTAP_UPSTREAM_UNAVAILABLE', JSON.stringify(r));

// 5) healthz / 404
const h = await fetch(`http://127.0.0.1:${SERVER_PORT}/healthz`);
check('healthz 200', h.status === 200, String(h.status));
const nf = await fetch(`http://127.0.0.1:${SERVER_PORT}/nope`);
check('未知路径 404', nf.status === 404, String(nf.status));

child.kill();
upstream.close();
await wait(150);
console.log(failures === 0 ? '\nSELFTEST ALL PASS' : `\nSELFTEST ${failures} FAILED`);
process.exitCode = failures === 0 ? 0 : 1;
child.unref();
upstream.unref?.();
setTimeout(() => process.exit(process.exitCode), 50).unref();
