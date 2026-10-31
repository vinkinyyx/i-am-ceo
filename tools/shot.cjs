// 使用本机 Chrome + playwright-core 加载 web-mobile 构建并截图/采集错误。
const { chromium } = require('playwright-core');

(async () => {
  const exe =
    process.env.CHROME_EXE || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const url = process.argv[2] || 'http://localhost:8123/';
  const shot = process.argv[3] || 'evidence/m0/m0-10/webmobile.png';
  const fs = require('fs');
  fs.mkdirSync(require('path').dirname(shot), { recursive: true });

  const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  // 等待 Cocos 启动与首屏渲染
  await page.waitForTimeout(8000);

  await page.screenshot({ path: shot });
  const canvas = await page.$$eval('canvas', (els) => els.map((e) => ({ w: e.width, h: e.height })));
  console.log(JSON.stringify({ shot, canvas, errorCount: errors.length, errors: errors.slice(0, 20) }, null, 2));
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
