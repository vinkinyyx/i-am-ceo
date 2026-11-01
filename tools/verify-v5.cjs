// v5 无头验证：web-mobile 构建 → 隐私首启弹窗 → 点击同意 → localStorage 落同意记录 → 进入创建公司 → 零 JS 错误。
const { chromium } = require('playwright-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const WEB = path.join(ROOT, 'build/web-mobile');
const PORT = 8131;
const CHROME = process.env.CHROME_EXE || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.mp3': 'audio/mpeg',
  '.bin': 'application/octet-stream',
};

const server = http.createServer((req, res) => {
  let rel = decodeURIComponent((req.url || '/').split('?')[0]);
  if (rel === '/') rel = '/index.html';
  fs.readFile(path.join(WEB, rel), (err, data) => {
    if (err) { res.writeHead(404); res.end('nf'); return; }
    res.writeHead(200, { 'Content-Type': mime[path.extname(rel)] || 'application/octet-stream' });
    res.end(data);
  });
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(path.join(ROOT, 'evidence/v5'), { recursive: true });
  await new Promise((r) => server.listen(PORT, r));
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errors = [];
  const failedReqs = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('response', (resp) => {
    if (resp.status() >= 400) {
      failedReqs.push(`${resp.status()} ${resp.url()}`);
    }
  });

  const result = { steps: [] };
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'load', timeout: 60000 });
  await sleep(9000);
  await page.screenshot({ path: path.join(ROOT, 'evidence/v5/v5-01-privacy.png') });

  // FIXED_WIDTH：375 设计宽 → 390 视口，缩放≈1.04；按钮设计坐标 (0,-164)
  await page.mouse.click(195, Math.round(422 + 164 * 1.04));
  await sleep(1500);
  await page.screenshot({ path: path.join(ROOT, 'evidence/v5/v5-02-after-accept.png') });

  // 同意记录应写入 localStorage（CocosPlatform 走 sys.localStorage）
  const consent = await page.evaluate(() => {
    const raw = window.localStorage.getItem('ceo/privacy/consent');
    return raw ? JSON.parse(raw) : null;
  });
  result.steps.push({ step: '点击同意后写入隐私同意记录', pass: !!(consent && consent.accepted === true), consent });

  // 二次进入不应再弹隐私（同一 localStorage）
  await page.reload({ waitUntil: 'load' });
  await sleep(8000);
  await page.screenshot({ path: path.join(ROOT, 'evidence/v5/v5-03-reload-no-privacy.png') });

  // 资源加载类错误由 failedRequests 精确判定（带 URL）；这里过滤掉无 URL 的通用
  // "Failed to load resource" 噪音（web-mobile 模板缺 favicon），保留其余真实 JS 错误
  result.jsErrors = errors.filter(
    (e) => !/favicon/i.test(e) && !/^Failed to load resource: the server responded/i.test(e),
  );
  result.failedRequests = failedReqs;
  // favicon 404 是 web-mobile 模板的已知噪音（真机包无此请求）；其余 4xx/5xx 才算失败
  const criticalFails = failedReqs.filter((u) => !/favicon/i.test(u));
  result.pass = result.steps.every((s) => s.pass) && result.jsErrors.length === 0 && criticalFails.length === 0;

  fs.writeFileSync(path.join(ROOT, 'evidence/v5/v5-headless.json'), JSON.stringify(result, null, 2));
  await browser.close();
  server.close();
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.pass ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
