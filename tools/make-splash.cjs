// 生成《我是CEO》自有启动图（logo.png / slogan.png），供 Cocos 启动画面替换使用。
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright-core');

const dir = __dirname;
const outDir = path.join(dir, 'splash');
fs.mkdirSync(outDir, { recursive: true });

const jobs = [
  { html: 'splash.html', png: 'logo.png', width: 768, height: 768, opaque: true },
  { html: 'slogan.html', png: 'slogan.png', width: 768, height: 192, opaque: false },
];

(async () => {
  const exe = process.env.CHROME_EXE || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--no-sandbox'] });
  for (const job of jobs) {
    const page = await browser.newPage({
      viewport: { width: job.width, height: job.height },
      deviceScaleFactor: 1,
    });
    await page.goto(pathToFileURL(path.join(outDir, job.html)).href, { waitUntil: 'load' });
    await page.waitForTimeout(300);
    const file = path.join(outDir, job.png);
    await page.screenshot({ path: file, omitBackground: !job.opaque });
    const size = fs.statSync(file).size;
    console.log(JSON.stringify({ png: file, bytes: size, width: job.width, height: job.height }));
    await page.close();
  }
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
