// M1 验证：走完向导→进入公司→5×加速推进月份→扩产弹窗→（等待满1年）真实年度报告。
// 设计坐标 375x812 中心原点、y 向上；body 节点整体 +30，世界y = 本地y + 30。
const { chromium } = require('playwright-core');
const url = process.argv[2] || 'http://localhost:8133/';
const dir = process.argv[3] || 'evidence/m1/m1-08';

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
  // 清除可能残留的本地双槽存档，强制走全新新手流程
  await page.evaluate(() => {
    try {
      window.localStorage.clear();
    } catch (_) { /* ignore */ }
  });
  await page.reload({ waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(4000);

  const geom = await page.$$eval('canvas', (els) =>
    els.map((e) => {
      const r = e.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    }),
  );
  const c = geom[0];
  const scale = c.w / 375;
  const tap = async (dx, dy, wait = 600) => {
    const px = c.x + c.w / 2 + dx * scale;
    const py = c.y + c.h / 2 - dy * scale;
    await page.mouse.click(px, py);
    await page.waitForTimeout(wait);
  };
  const shot = (name) => page.screenshot({ path: `${dir}/${name}.png` });

  // 向导 S01→S02→S03
  await tap(0, -330);
  await tap(85, -300, 900);
  // 录用两人 + 进入公司
  await tap(124, 164, 500);
  await tap(124, 46, 500);
  await tap(0, -360, 1500);
  // 满2人进入后为 TUTORIAL_DASHBOARD 看板态，弹 TUT-04/05 合并引导：点「开始经营」启动时钟
  await tap(0, -78, 800);
  await shot('m1-company-month1');

  // 先打开年度报告（首年未结束 → 空态）。actionCard 世界y=80，按钮内嵌 y=-14 → 世界 66
  await tap(83, 66, 700);
  await shot('m1-annual-empty');
  await tap(0, -120, 500); // 知道了

  // 打开扩产弹窗
  await tap(-83, 66, 700);
  await shot('m1-invest-dialog');
  await tap(0, -190, 400); // 取消

  // 切 5×（时间控件世界 y=240，5× 按钮 x=114）
  await tap(114, 240, 500);
  await shot('m1-speed-5x');

  // 5× 每月 5000ms；等待约 13s 推进 2~3 个月
  await page.waitForTimeout(13000);
  await shot('m1-company-running');

  // 继续等到满 12 个月（再等约 50s）触发年结
  await page.waitForTimeout(52000);
  await shot('m1-after-year1');
  // 打开年度报告（此时应有真实第1年年报）
  await tap(83, 66, 900);
  await shot('m1-annual-report-y1');

  console.log(JSON.stringify({ errors: [...new Set(errors)].slice(0, 10) }, null, 2));
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
