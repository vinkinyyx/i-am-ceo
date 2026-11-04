// TC-067：360×640 小屏适配巡检（向导三页 + 公司页 + 部门页 + 设置弹窗）。
const { chromium } = require('playwright-core');
const fs = require('fs');
const url = process.argv[2] || 'http://localhost:8123/';
const dir = process.argv[3] || 'evidence/test-v1.1/R5/small-360x640';

(async () => {
  fs.mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 1 });
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
  // R24：不再整屏缩放（原 BUG-002 fit 兜底已移除）；页脚锚定可视区底部，
  // 底部 Tab 设计 y = -可视设计高/2 + 36，正文超高部分由 Body ScrollView 滚动触达。
  const visibleDesignHeight = c.h / scale;
  const footerY = -visibleDesignHeight / 2 + 36;
  const tap = async (dx, dy, wait = 600) => {
    await page.mouse.click(c.x + c.w / 2 + dx * scale, c.y + c.h / 2 - dy * scale);
    await page.waitForTimeout(wait);
  };
  const shot = (n) => page.screenshot({ path: `${dir}/${n}.png` });

  await shot('360-s01');
  await tap(0, -330);
  await shot('360-s02');
  await tap(85, -300, 900);
  await shot('360-s03');
  await tap(124, 164, 800);   // 候选 1「录用」→ R26 收费确认弹窗
  await tap(0, -104, 1200);   // 确认支付
  await tap(124, 46, 800);    // 候选 2「录用」
  await tap(0, -104, 1200);   // 确认支付
  await tap(0, -360, 1500);   // 进入公司
  await shot('360-company');
  await tap(-47, footerY, 800);
  await shot('360-dept');
  await tap(-141, footerY, 800); // 回公司页（底部 Tab 锚定可视区底部）
  await tap(145, 360, 800);
  await shot('360-settings');

  const info = { canvas: c, viewport: { w: 360, h: 640 }, scale, visibleDesignHeight, footerY, errors: [...new Set(errors)], dir };
  fs.writeFileSync(`${dir}/small-screen-info.json`, JSON.stringify(info, null, 2), 'utf8');
  console.log(JSON.stringify(info, null, 2));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
