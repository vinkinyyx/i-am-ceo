// R24 证据：三尺寸壳布局（头尾可达）+ 热 resize 后导航可点 + 遮罩防穿透。
// 设计坐标系（375 宽、中心原点、y 向上）；R24 后无整屏缩放，设计坐标 = 屏宽比换算，无 fit。
const { chromium } = require('playwright-core');
const fs = require('fs');

const url = process.argv[2] || 'http://localhost:8123/';
const dir = process.argv[3] || 'evidence/m3/TASK-M3-09-R24/attempt-01/shots';
const CHROME = process.env.CHROME_EXE || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const SIZES = [
  { name: '375x812', width: 375, height: 812 }, // 设计基线
  { name: '360x640', width: 360, height: 640 }, // 短屏（原 BUG-002 场景）
  { name: '393x852', width: 393, height: 852 }, // 宽屏逻辑像素
];

(async () => {
  fs.mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
  const report = { url, sizes: [] };

  for (const sz of SIZES) {
    const ctx = await browser.newContext({ viewport: { width: sz.width, height: sz.height }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(() => {
      try {
        const k = 'ceo/privacy/consent';
        window.localStorage.setItem(k, JSON.stringify({ accepted: true, policyVersion: 1, acceptedAtMs: Date.now() }));
      } catch (e) {}
    });
    await page.goto(url, { waitUntil: 'load', timeout: 60000 });
    await page.evaluate(() => { try { window.localStorage.clear(); } catch (e) {} });
    await page.reload({ waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(5000);

    const shot = (n) => page.screenshot({ path: `${dir}/${sz.name}-${n}.png` });
    const geom = async () => {
      const g = await page.$$eval('canvas', (els) =>
        els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }));
      const c = g[0];
      const scale = c.w / 375;
      return { c, scale, visibleDesignH: c.h / scale, footerY: -(c.h / scale) / 2 + 36 };
    };
    let G = await geom();
    const tap = async (dx, dy, wait = 700) => {
      await page.mouse.click(G.c.x + G.c.w / 2 + dx * G.scale, G.c.y + G.c.h / 2 - dy * G.scale);
      await page.waitForTimeout(wait);
    };

    // 新手向导 → 主壳（坐标取自当前 AppView 源码）
    await shot('s01');
    await tap(0, -330, 900);            // S01 下一步：创建 CEO
    await shot('s02');
    await tap(85, -300, 1200);          // S02 下一步：招聘员工（创建公司命令）
    await shot('s03');
    await tap(124, 164, 800);           // 候选 1「录用」→ 收费确认弹窗
    await shot('hire-confirm');
    await tap(0, -104, 1200);           // 确认支付（R26 弹窗）
    await tap(124, 46, 800);            // 候选 2「录用」
    await tap(0, -104, 1200);           // 确认支付
    await tap(0, -360, 1500);           // 进入公司 → 主壳
    await tap(0, -118, 1200);           // TUT-04/05 新手提示「跳过教学」

    // T01：三尺寸头尾/内容可达——主壳四 Tab 逐个点击截图
    await shot('tab-company');
    await tap(47, G.footerY, 900); await shot('tab-talent');
    await tap(-47, G.footerY, 900); await shot('tab-department');
    await tap(141, G.footerY, 900); await shot('tab-rank');
    await tap(-141, G.footerY, 900); await shot('tab-back-company');

    // T03：热 resize（高度缩 18%）后导航仍可点
    await page.setViewportSize({ width: sz.width, height: Math.round(sz.height * 0.82) });
    await page.waitForTimeout(1200);
    G = await geom();
    await shot('resized-company');
    await tap(47, G.footerY, 900);
    await shot('resized-talent');       // resize 后切 Tab 成功即证明导航可达
    await tap(-141, G.footerY, 900);

    // T02/T05：弹窗打开时，点遮罩与底层按钮均不穿透
    // 「设置」是 Body 内容（authored y=360），顶部对齐后可见 y = authored - 406 + 可视半高
    const settingsY = 360 - 406 + G.visibleDesignH / 2;
    await tap(145, settingsY, 900);     // 公司页头部「设置」
    await shot('settings-open');
    await tap(0, 300, 600);             // 遮罩空白处（弹窗卡片外）
    await tap(141, G.footerY, 600);     // 底层「排行」Tab 坐标（被遮罩覆盖）
    await shot('settings-mask-no-passthrough');

    report.sizes.push({
      ...sz,
      visibleDesignH: +G.visibleDesignH.toFixed(2),
      footerDesignY: +G.footerY.toFixed(2),
      errors: [...new Set(errors)],
    });
    await ctx.close();
  }

  report.ok = report.sizes.every((s) => s.errors.length === 0);
  fs.writeFileSync(`${dir}/r24-report.json`, JSON.stringify(report, null, 2), 'utf8');
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  if (!report.ok) process.exit(1);
})().catch((e) => { console.error(e); process.exit(1); });
