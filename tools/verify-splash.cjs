// 启动画面替换验证：加载 web-mobile 构建，在启动早期抓帧，确认展示自有启动图。
const fs = require('fs');
const { chromium } = require('playwright-core');

const url = process.argv[2] || 'http://localhost:8123/';
const dir = process.argv[3] || 'evidence/test-v1.1/R6/splash';

(async () => {
  fs.mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url, { waitUntil: 'load', timeout: 60000 });

  const shots = [];
  for (const ms of [300, 700, 1200, 1800, 3000]) {
    await page.waitForTimeout(ms === 300 ? 300 : ms - shots[shots.length - 1].ms);
    const file = `${dir}/splash-${ms}ms.png`;
    await page.screenshot({ path: file });
    shots.push({ ms, file });
  }

  const settings = await page.evaluate(async () => {
    const r = await fetch('src/settings.json');
    const j = await r.json();
    return { logoType: j.splashScreen.logo.type, totalTime: j.splashScreen.totalTime, base64Chars: (j.splashScreen.logo.base64 || '').length };
  });

  const result = { url, shots, settings, errorCount: errors.length, errors: [...new Set(errors)].slice(0, 10) };
  fs.writeFileSync(`${dir}/splash-check.json`, JSON.stringify(result, null, 2), 'utf8');
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
