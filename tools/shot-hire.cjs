// 走完 S03 录用两人 → 进入公司 → 主界面，并截图。
const { chromium } = require('playwright-core');
const url = process.argv[2] || 'http://localhost:8133/';
const dir = process.argv[3] || 'evidence/m0/m0-10';

(async () => {
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

  const geom = await page.$$eval('canvas', (els) =>
    els.map((e) => {
      const r = e.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    }),
  );
  const c = geom[0];
  const scale = c.w / 375;
  const tap = async (dx, dy) => {
    const px = c.x + c.w / 2 + dx * scale;
    const py = c.y + c.h / 2 - dy * scale;
    await page.mouse.click(px, py);
    await page.waitForTimeout(700);
  };

  // S01 → S02 → S03
  await tap(0, -330);
  await page.waitForTimeout(400);
  await tap(85, -300);
  await page.waitForTimeout(900);

  // 录用第1张卡（y≈164）与第2张卡（y≈46）右侧录用按钮
  await tap(124, 164);
  await page.waitForTimeout(500);
  await tap(124, 46);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${dir}/s03-hired2.png` });

  // 进入公司（按钮变为可用，y≈-360）
  await tap(0, -360);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${dir}/t01-company.png` });

  // 点底部 部门 tab（x≈-47,y≈-372 → 实际第2个 tab x=-141+94=-47）
  await tap(-47, -372);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${dir}/t02-department.png` });

  console.log(JSON.stringify({ errors: [...new Set(errors)].slice(0, 10) }, null, 2));
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
