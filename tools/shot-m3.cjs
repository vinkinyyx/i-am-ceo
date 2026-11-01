// M3 验证：走完向导→进公司→排行榜双榜→设置(声音开关/操作指引)。
const { chromium } = require('playwright-core');
const url = process.argv[2] || 'http://localhost:8133/';
const dir = process.argv[3] || 'evidence/m3/m3-ui';

(async () => {
  const fs = require('fs');
  fs.mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  // 预置隐私同意记录，避免隐私弹窗遮挡后续点击（测试专用，不改产品逻辑）
  await page.addInitScript(() => {
    try {
      const k = 'ceo/privacy/consent';
      if (!window.localStorage.getItem(k)) {
        window.localStorage.setItem(
          k,
          JSON.stringify({ accepted: true, policyVersion: 1, acceptedAtMs: Date.now() }),
        );
      }
    } catch (e) {}
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  await page.evaluate(() => { try { window.localStorage.clear(); } catch (_) {} });
  await page.reload({ waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(4000);

  const geom = await page.$$eval('canvas', (els) =>
    els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }));
  const c = geom[0];
  const scale = c.w / 375;
  const tap = async (dx, dy, wait = 500) => {
    await page.mouse.click(c.x + c.w / 2 + dx * scale, c.y + c.h / 2 - dy * scale);
    await page.waitForTimeout(wait);
  };
  const shot = (n) => page.screenshot({ path: `${dir}/${n}.png` });

  await tap(0, -330);
  await tap(85, -300, 900);
  await tap(124, 164, 500);
  await tap(124, 46, 500);
  await tap(0, -360, 1500);
  await tap(0, -78, 800);

  // 排行榜（底栏第4个 x=141）
  await tap(141, -372, 800);
  await shot('m3-rank-assets');
  // 切年限榜
  await tap(58, 330, 600);
  await shot('m3-rank-years');

  // 回公司页，打开设置（顶部右侧设置按钮：世界 y≈402, x≈145）
  await tap(-141, -372, 500);
  await tap(145, 360, 700);
  await shot('m3-settings');
  // 操作指引重播（设置弹窗内「重新查看操作指引」世界 y≈-42）
  await tap(0, -42, 1000);
  await shot('m3-tutorial-replay');

  console.log(JSON.stringify({ errors: [...new Set(errors)].slice(0, 10) }, null, 2));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
