// 驱动完整新手向导并逐页截图。Cocos FIXED_WIDTH：设计宽375映射到canvas实际宽。
const { chromium } = require('playwright-core');
const url = process.argv[2] || 'http://localhost:8133/';
const dir = process.argv[3] || 'evidence/m0/m0-10';

(async () => {
  const fs = require('fs');
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
  await page.waitForTimeout(4000);

  // 计算设计坐标(375x812,原点中心) → 页面像素
  const geom = await page.$$eval('canvas', (els) =>
    els.map((e) => {
      const r = e.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    }),
  );
  const c = geom[0] || { x: 0, y: 0, w: 390, h: 844 };
  const scale = c.w / 375;
  const tap = async (dx, dy) => {
    // dx,dy 为设计坐标（中心原点，y向上）；屏幕 y 向下
    const px = c.x + c.w / 2 + dx * scale;
    const py = c.y + c.h / 2 - dy * scale;
    await page.mouse.click(px, py);
    await page.waitForTimeout(700);
  };

  // S01：直接点底部"下一步：创建 CEO"（设计 y=-330）
  await tap(0, -330);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${dir}/s02-ceo.png` });

  // S02：右下"下一步：招聘员工"（x=85,y=-300）
  await tap(85, -300);
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${dir}/s03-hiring.png` });

  console.log(JSON.stringify({ canvas: c, scale, errors: [...new Set(errors)].slice(0, 10) }, null, 2));
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
