// M2 验证：走完向导→进公司→部门页(方针/建采购部)→人才页(详情/裁员预览)→切AUTO→招聘弹窗。
const { chromium } = require('playwright-core');
const url = process.argv[2] || 'http://localhost:8133/';
const dir = process.argv[3] || 'evidence/m2/m2-08';

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
  await page.evaluate(() => { try { window.localStorage.clear(); } catch (_) {} });
  await page.reload({ waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(4000);

  const geom = await page.$$eval('canvas', (els) =>
    els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }));
  const c = geom[0];
  const scale = c.w / 375;
  const tap = async (dx, dy, wait = 500) => {
    const px = c.x + c.w / 2 + dx * scale;
    const py = c.y + c.h / 2 - dy * scale;
    await page.mouse.click(px, py);
    await page.waitForTimeout(wait);
  };
  const shot = (n) => page.screenshot({ path: `${dir}/${n}.png` });

  // 向导 → 进入公司
  await tap(0, -330);
  await tap(85, -300, 900);
  await tap(124, 164, 500);
  await tap(124, 46, 500);
  await tap(0, -360, 1500);
  await tap(0, -78, 800); // 开始经营

  // 部门 tab（底栏第2个 x=-47）。body 世界 y = 本地 y + 30
  await tap(-47, -372, 800);
  await shot('m2-dept-list');

  // 主营卡 y=214(世界244)，第一个未建部门卡 y=214-104=110(世界140)；创建按钮 x=150
  await tap(150, 140, 700);
  await shot('m2-create-dept-dialog');
  await tap(0, -72, 900); // 支付创建（弹窗内坐标）
  await tap(-47, -372, 700);
  await shot('m2-dept-created');

  // 新建部门是第2张卡（主营214、新部门110）；其自动/招聘按钮本地 y=110+18=128(世界158)
  await tap(106, 158, 600); // 切 AUTO
  await tap(160, 158, 700); // 招聘
  await shot('m2-hire-dialog');
  await tap(60, -206, 400); // 关闭

  // 切方针为扩张（方针按钮本地 y=268，世界298；GROWTH x=-100）
  await tap(-100, 298, 500);

  // 人才 tab（x=47）
  await tap(47, -372, 800);
  await shot('m2-talent-list');
  // 第一张员工卡 y=282(世界312)，详情按钮 x=138
  await tap(138, 312, 700);
  await shot('m2-employee-detail');
  // 裁员（详情弹窗 x=62,y=-110）
  await tap(62, -110, 700);
  await shot('m2-layoff-confirm');
  await tap(0, -146, 400); // 再想想

  console.log(JSON.stringify({ errors: [...new Set(errors)].slice(0, 10) }, null, 2));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
