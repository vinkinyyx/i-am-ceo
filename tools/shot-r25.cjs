// R25 证据：通用弹窗/输入/确认件。
// T01 长内容（隐私全文）小屏滚动 + 底部固定按钮可达；T02 遮罩不穿透；
// T03 连点确认只产生一次录用（读存档核对）；T05 输入框（含“键盘收起”后）内容与按钮保留；
// 另覆盖：裁员/关闭公司摘要小屏可达、ESC 只取消不确认。
const { chromium } = require('playwright-core');
const fs = require('fs');

const url = process.argv[2] || 'http://localhost:8123/';
const dir = process.argv[3] || 'evidence/m3/TASK-M3-09-R25/attempt-01/shots';
const CHROME = process.env.CHROME_EXE || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const CONSENT_KEY = 'ceo/privacy/consent';

const readState = (page) =>
  page.evaluate(() => {
    try {
      const active = JSON.parse(localStorage.getItem('ceo/save/active') || 'null');
      const slot = active && active.slot === 'b' ? 'b' : 'a';
      const env = JSON.parse(localStorage.getItem(`ceo/save/${slot}`) || 'null');
      if (!env) return null;
      const p = env.payload || {};
      return {
        runId: env.runId,
        revision: env.revision,
        hires: p.onboarding ? p.onboarding.initialHiresCompleted : null,
        employees: Array.isArray(p.employees) ? p.employees.length : null,
        cash: p.company ? p.company.cashYuan : null,
        phase: p.phase,
      };
    } catch (e) {
      return { error: String(e) };
    }
  });

const dumpStorage = (page) =>
  page.evaluate(() => {
    const out = {};
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      out[k] = localStorage.getItem(k);
    }
    return out;
  });

(async () => {
  fs.mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
  const report = { url, results: {}, checks: {}, errors: [] };
  const pageErrors = [];
  const watch = (page) => page.on('pageerror', (e) => pageErrors.push(e.message));

  const geom = async (page) => {
    const g = await page.$$eval('canvas', (els) =>
      els.map((e) => {
        const r = e.getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height };
      }));
    const c = g[0];
    const scale = c.w / 375;
    return { c, scale, visibleH: c.h / scale };
  };

  const mk = (page, G) => ({
    shot: (n) => page.screenshot({ path: `${dir}/${n}.png` }),
    tap: async (dx, dy, wait = 700) => {
      await page.mouse.click(G.c.x + G.c.w / 2 + dx * G.scale, G.c.y + G.c.h / 2 - dy * G.scale);
      await page.waitForTimeout(wait);
    },
    wheel: async (dx, dy, ticks = 6, amount = 600) => {
      await page.mouse.move(G.c.x + G.c.w / 2 + dx * G.scale, G.c.y + G.c.h / 2 - dy * G.scale);
      for (let i = 0; i < ticks; i += 1) {
        await page.mouse.wheel(0, amount);
        await page.waitForTimeout(180);
      }
      await page.waitForTimeout(400);
    },
  });

  // ============================================================ 375×812：全流程
  {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    watch(page);
    await page.goto(url, { waitUntil: 'load', timeout: 60000 });
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await page.reload({ waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(5000);
    const G = await geom(page);
    const u = mk(page, G);

    // T01/T02：隐私政策全文（首次启动），卡片固定标题/底部，正文滚动
    await u.shot('375-privacy-long-top');
    await u.tap(180, 0, 500); // 卡片右侧空白遮罩：不应关闭/穿透
    const stateAfterMask = await readState(page);
    await u.shot('375-privacy-mask-no-passthrough');
    await u.wheel(0, 40, 8, 700); // 滚到政策结尾
    await u.shot('375-privacy-long-bottom');
    report.checks.privacyMaskKeptOpen = stateAfterMask === null; // 仍在隐私闸门（未进入任何存档）

    // 同意并继续 → S01（若出现登录重试浮层则“先进入单机游玩”）
    await u.tap(-60, -218, 1400);
    await u.tap(0, -106, 900);
    await u.shot('375-s01-after-consent');

    // T05：输入弹窗（自定义公司名）
    await u.tap(64, -198, 900);
    await u.shot('375-input-empty');
    await u.tap(0, 137, 600); // 空值提交 → 内联校验
    await u.shot('375-input-error-empty');
    // 聚焦输入框（卡片固定上半区，y≈241）
    await u.tap(0, 241, 400);
    await page.keyboard.type('星河科技集团', { delay: 60 });
    await page.waitForTimeout(500);
    await u.shot('375-input-typed');
    // 模拟键盘收起（失焦）：点卡片上方遮罩空白处
    await u.tap(0, 370, 700);
    await u.shot('375-input-after-keyboard-hidden');
    const afterBlur = await page.evaluate(() => document.activeElement && document.activeElement.tagName);
    report.checks.inputAfterBlurActiveElement = afterBlur;
    // 提交 → 回到 S01，自定义名称生效
    await u.tap(0, 137, 900);
    await u.shot('375-input-applied');

    // 走到 S03 首聘
    await u.tap(0, -330, 900);
    await u.shot('375-s02');
    await u.tap(85, -300, 1200);
    await u.shot('375-s03');
    const before = await readState(page);
    report.checks.hireStateBefore = before;

    // T03：录用确认弹窗，快速双点同一确认按钮 → 只应产生一次收费录用
    await u.tap(124, 164, 800);
    await u.shot('375-hire-confirm');
    const px = G.c.x + G.c.w / 2;
    const py = G.c.y + G.c.h / 2 - -74 * G.scale; // 确认按钮设计坐标 y=-74
    await page.mouse.click(px, py, { delay: 0 });
    await page.waitForTimeout(30);
    await page.mouse.click(px, py, { delay: 0 });
    await page.waitForTimeout(1800);
    const after = await readState(page);
    report.checks.hireStateAfterDoubleClick = after;
    report.checks.rapidTapOnlyOneHire = !!after && after.hires === 1;
    await u.shot('375-after-double-confirm');

    // 第二名候选（单击一次）→ 进入公司
    await u.tap(124, 46, 800);
    await u.tap(0, -74, 1400);
    await u.tap(0, -360, 1600);
    await u.tap(0, -118, 900); // 跳过教学
    await u.shot('375-shell-company');
    const shellState = await readState(page);
    report.checks.shellState = shellState;

    const dump = await dumpStorage(page);
    report.results.seedSaveKeys = Object.keys(dump);

    // 关闭公司摘要（可滚动正文 + 固定底部）
    const visibleH = G.visibleH;
    const settingsY = 360 - 406 + visibleH / 2;
    await u.tap(145, settingsY, 900);
    await u.tap(0, -136, 900);
    await u.shot('375-close-confirm-top');
    await u.wheel(0, 0, 3, 500);
    await u.shot('375-close-confirm-bottom');
    // T02：点遮罩空白 → 不误确认
    await u.tap(185, 0, 500);
    await u.shot('375-close-mask-no-passthrough');
    // ESC 只取消（不触发“永久清除”）
    await page.keyboard.press('Escape');
    await page.waitForTimeout(600);
    await u.shot('375-close-esc-cancelled');
    const afterEsc = await readState(page);
    report.checks.escCancelKeptSave =
      !!afterEsc &&
      !!shellState &&
      afterEsc.runId === shellState.runId &&
      afterEsc.employees === shellState.employees &&
      afterEsc.phase === shellState.phase;

    report.results.baseline = await geom(page);
    // 保存运行中存档，供小屏上下文复用（避免在 640 高下走创建流程）
    fs.writeFileSync(`${dir}/seed-save.json`, JSON.stringify(dump, null, 2), 'utf8');
    await ctx.close();
  }

  // ============================================================ 360×640：小屏长内容
  {
    const seed = JSON.parse(fs.readFileSync(`${dir}/seed-save.json`, 'utf8'));
    // 隐私：仍从零开始，验证政策全文在 640 高屏可滚动
    const ctx = await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    watch(page);
    await page.goto(url, { waitUntil: 'load', timeout: 60000 });
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await page.reload({ waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(5000);
    let G = await geom(page);
    let u = mk(page, G);
    await u.shot('360-privacy-long-top');
    await u.wheel(0, 40, 10, 700);
    await u.shot('360-privacy-long-bottom');
    await u.tap(-60, -218, 1200); // 同意（底部按钮固定，小屏仍可点）
    await u.tap(0, -106, 800);

    // 复用运行中存档，直接进主壳
    await page.evaluate((s) => {
      try {
        localStorage.clear();
        Object.entries(s).forEach(([k, v]) => localStorage.setItem(k, v));
      } catch (e) {}
    }, seed);
    await page.reload({ waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(4000);
    G = await geom(page);
    u = mk(page, G);
    await u.shot('360-shell-company');

    // 关闭公司摘要（小屏）
    const settingsY = 360 - 406 + G.visibleH / 2;
    await u.tap(145, settingsY, 900);
    await u.tap(0, -136, 900);
    await u.shot('360-close-confirm');
    await u.tap(185, 0, 500);
    await u.shot('360-close-mask-no-passthrough');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    await u.shot('360-close-esc-cancelled');

    // 裁员赔偿摘要（人才页 → 详情 → 裁员）
    const footerY = -G.visibleH / 2 + 36;
    await u.tap(47, footerY, 900); // 人才 Tab（x=-141/-47/+47/+141 → 公司/部门/人才/排行）
    await u.shot('360-talent');
    const detailY = 282 - 406 + G.visibleH / 2;
    await u.tap(138, detailY, 800); // 第一张员工卡「详情」
    await u.shot('360-employee-detail');
    await u.tap(62, -110, 800);      // 裁员
    await u.shot('360-layoff-confirm');
    await u.tap(0, -154, 600);       // 再想想（取消）
    await u.shot('360-layoff-cancelled');
    report.results.smallScreen = { visibleH: G.visibleH, footerY };
    await ctx.close();
  }

  report.errors = [...new Set(pageErrors)];
  report.ok = report.errors.length === 0 && report.checks.rapidTapOnlyOneHire === true;
  fs.writeFileSync(`${dir}/r25-report.json`, JSON.stringify(report, null, 2), 'utf8');
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  if (!report.ok) process.exit(1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
