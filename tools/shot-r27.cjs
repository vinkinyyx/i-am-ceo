// R27 证据：公司/CEO/首聘三步页（三尺寸）。
// T01 换行业/换批/自定义不推进市场 RNG（对照 rngCounter/revision）；
// T02 超长自定义公司名换行不缩字；T03 CEO 随机与手填、上一步不丢；
// T04 首聘 1/2 重载保持且仅 2/2 可继续；T05 三行业均可完成且只注资一次。
const { chromium } = require('playwright-core');
const fs = require('fs');

const url = process.argv[2] || 'http://localhost:8123/';
const baseDir = process.argv[3] || 'evidence/m3/TASK-M3-09-R27/attempt-01';
const dir = `${baseDir}/shots`;
const CHROME = process.env.CHROME_EXE || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const readState = (page) =>
  page.evaluate(() => {
    try {
      const active = JSON.parse(localStorage.getItem('ceo/save/active') || 'null');
      const slot = active && active.slot === 'b' ? 'b' : 'a';
      const env = JSON.parse(localStorage.getItem(`ceo/save/${slot}`) || 'null');
      if (!env) return null;
      const p = env.payload || {};
      const offer = Array.isArray(p.offers) && p.offers[0] ? p.offers[0] : null;
      return {
        runId: env.runId,
        revision: env.revision,
        rngCounter: p.rngCounter,
        industry: p.company ? p.company.industry : null,
        companyName: p.company ? p.company.name : null,
        ceoName: p.company ? p.company.ceoName : null,
        cash: p.company ? p.company.cashYuan : null,
        paidInCapital: p.company ? p.company.paidInCapitalYuan : null,
        initializedCapital: p.initializedCapital,
        hires: p.onboarding ? p.onboarding.initialHiresCompleted : null,
        employees: Array.isArray(p.employees) ? p.employees.length : null,
        phase: p.phase,
        speed: p.speed,
        salaries: offer && Array.isArray(offer.candidates) ? offer.candidates.map((c) => c.salaryMonthlyYuan) : null,
        recruitFees: Array.isArray(p.pendingEntries)
          ? p.pendingEntries.filter((e) => e.category === 'RECRUITMENT').map((e) => e.amountYuan)
          : null,
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
  const report = { url, contexts: {}, errors: [] };
  const pageErrors = [];

  const geom = async (page) => {
    const g = await page.$$eval('canvas', (els) =>
      els.map((e) => {
        const r = e.getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height };
      }));
    const c = g[0];
    const scale = c.w / 375;
    const visibleH = c.h / scale;
    return { c, scale, visibleH, cx: c.x + c.w / 2, cy: c.y + c.h / 2 };
  };

  const mk = (page, G) => ({
    shot: (n) => page.screenshot({ path: `${dir}/${n}.png` }),
    tap: async (dx, dy, wait = 700) => {
      await page.mouse.click(G.cx + dx * G.scale, G.cy - dy * G.scale);
      await page.waitForTimeout(wait);
    },
    wheel: async (dx, dy, ticks = 6, amount = 600) => {
      await page.mouse.move(G.cx + dx * G.scale, G.cy - dy * G.scale);
      for (let i = 0; i < ticks; i += 1) {
        await page.mouse.wheel(0, amount);
        await page.waitForTimeout(180);
      }
      await page.waitForTimeout(500);
    },
    boot: async () => {
      await page.goto(url, { waitUntil: 'load', timeout: 60000 });
      await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
      await page.reload({ waitUntil: 'load', timeout: 60000 });
      await page.waitForTimeout(5000);
    },
    consent: async () => {
      await page.mouse.click(G.cx - 60 * G.scale, G.cy + 218 * G.scale);
      await page.waitForTimeout(1400);
      await page.mouse.click(G.cx, G.cy + 106 * G.scale);
      await page.waitForTimeout(1000);
    },
  });

  // 创建页坐标：authored（812 中心原点）→ 屏幕；header 为该页固定页头高
  const paneY = (G, aY, headerH = 0, scroll = 0) => G.visibleH / 2 - headerH - 406 + aY + scroll;
  // 主体滚到底：authored 底 -406 对齐主体底（footer 不含 header）
  const bottomY = (G, aY, footerH = 72) => -G.visibleH / 2 + footerH + 406 + aY;
  // 输入弹窗：卡片高 296（56 标题 + 132 正文 + 108 底部），输入框在卡片 +20，提交在卡片 -66
  const inputCardY = (G) => Math.min(G.visibleH / 2 - 24 - 148, G.visibleH / 4);
  const inputFieldY = (G) => inputCardY(G) + 20;
  const inputSubmitY = (G) => inputCardY(G) - 66;

  // ---------------------------------------------------------------- A：375×812 TRADE 全流程
  {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => pageErrors.push(e.message));
    await page.goto(url, { waitUntil: 'load', timeout: 60000 });
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await page.reload({ waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(5000);
    const G = await geom(page);
    const u = mk(page, G);
    const out = { viewport: '375x812', industry: 'TRADE', checks: {} };

    await u.shot('375-01-privacy');
    await u.consent();
    await u.shot('375-02-s01');

    await u.tap(0, 160, 700);
    await u.shot('375-03-industry-software');
    await u.tap(0, 92, 700);
    await u.shot('375-04-industry-service');
    await u.tap(0, 228, 700);
    await u.shot('375-05-industry-trade');

    await u.tap(-83, -222, 800);
    await u.shot('375-06-names-batch2');

    await u.tap(83, -222, 900);
    await u.shot('375-07-custom-dialog');
    await u.tap(0, inputFieldY(G), 500);
    await page.keyboard.insertText('超长测试公司名称用于换行验证是否不缩字体');
    await page.waitForTimeout(600);
    await u.shot('375-08-custom-typed');
    await u.tap(0, inputSubmitY(G), 900);
    await u.shot('375-09-custom-applied');

    await u.tap(0, -370, 900);
    await u.shot('375-10-s02');
    await u.tap(-52, 238, 600);
    await page.keyboard.press('Control+A');
    await page.keyboard.insertText('张三丰');
    await page.waitForTimeout(700);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
    await u.shot('375-11-s02-typed');
    await u.tap(-85, -370, 900);
    await u.shot('375-12-s01-back-keeps-custom');
    await u.tap(0, -370, 900);
    await u.shot('375-13-s02-back-keeps-ceo');
    await u.tap(116, 238, 800);
    await u.shot('375-14-s02-random-name');
    await u.tap(0, 12, 800);
    await u.shot('375-15-s02-trait');

    const pxCreate = G.cx + 85 * G.scale;
    const pyCreate = G.cy - -370 * G.scale;
    await page.mouse.click(pxCreate, pyCreate, { delay: 0 });
    await page.waitForTimeout(50);
    await page.mouse.click(pxCreate, pyCreate, { delay: 0 });
    await page.waitForTimeout(1600);
    await u.shot('375-16-s03-after-create-double-click');
    const created = await readState(page);
    out.afterCreate = created;
    out.checks.oneCompanyOnceCapital =
      !!created && created.cash === 300000 && created.paidInCapital === 300000 && created.employees === 0;
    // 换行业 3 次 + 换一批 + 自定义后再创建：市场随机流计数器必须仍为 0
    out.checks.noMarketRngAdvance = !!created && created.rngCounter === 0 && created.revision === 1;

    await u.tap(0, paneY(G, 276, 64), 900);
    await u.shot('375-17-hire-confirm');
    await u.tap(0, -74, 1500);
    await u.shot('375-18-s03-1of2');
    const afterHire1 = await readState(page);
    out.afterHire1 = afterHire1;
    out.checks.feeEqualsSalary1 =
      !!afterHire1 && !!afterHire1.recruitFees && Math.abs(afterHire1.recruitFees[0]) === afterHire1.salaries[0];

    await u.tap(0, -370, 900);
    const afterContinue1 = await readState(page);
    out.checks.continueBlockedAt1of2 =
      !!afterContinue1 && afterContinue1.phase === 'HIRING_INITIAL' && afterContinue1.hires === 1;
    await u.shot('375-19-s03-continue-blocked');

    await page.reload({ waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(4500);
    const reloaded = await readState(page);
    out.afterReload = reloaded;
    out.checks.reloadKeeps1of2 =
      !!reloaded && reloaded.hires === 1 && reloaded.employees === 1 &&
      reloaded.cash === afterHire1.cash && reloaded.paidInCapital === 300000 &&
      reloaded.phase === 'HIRING_INITIAL';
    await u.shot('375-20-s03-reload-1of2');

    await u.tap(0, paneY(G, 106, 64), 900);
    await u.shot('375-21-hire2-confirm');
    await u.tap(0, -74, 1500);
    const afterHire2 = await readState(page);
    out.afterHire2 = afterHire2;
    out.checks.feeSumMatchesCash =
      !!afterHire2 && afterHire2.hires === 2 && afterHire2.employees === 2 &&
      afterHire2.cash === 300000 + afterHire2.recruitFees.reduce((s, v) => s + v, 0) &&
      afterHire2.phase === 'TUTORIAL_DASHBOARD';
    await u.shot('375-22-s03-2of2');

    await u.tap(0, -370, 1400);
    const running = await readState(page);
    out.afterContinue = running;
    out.checks.enterCompanyAt2of2 = !!running && running.phase === 'RUNNING' && running.speed === 1;
    await u.shot('375-23-company-running');

    out.storage = await dumpStorage(page);
    out.geom = { visibleH: G.visibleH, scale: G.scale };
    report.contexts.A = out;
    fs.writeFileSync(`${baseDir}/seed-save-375.json`, JSON.stringify(out.storage, null, 2), 'utf8');
    fs.writeFileSync(`${baseDir}/state-375.json`, JSON.stringify(out, null, 2), 'utf8');
    await ctx.close();
  }

  // ---------------------------------------------------------------- B：360×640 SOFTWARE（小屏滚动）
  {
    const ctx = await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => pageErrors.push(e.message));
    await page.goto(url, { waitUntil: 'load', timeout: 60000 });
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await page.reload({ waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(5000);
    const G = await geom(page);
    const u = mk(page, G);
    const out = { viewport: '360x640', industry: 'SOFTWARE', checks: {} };
    const FOOTER_Y = -G.visibleH / 2 + 36;

    await u.consent();
    await u.shot('360-01-s01');
    await u.tap(0, paneY(G, 160), 800);
    await u.shot('360-02-industry-software');
    await u.wheel(0, 0, 5, 500);
    await u.shot('360-03-s01-scrolled');
    await u.tap(-83, bottomY(G, -222), 800);
    await u.shot('360-04-names-batch2');
    await u.tap(83, bottomY(G, -222), 900);
    await u.shot('360-05-custom-dialog');
    await u.tap(0, inputFieldY(G), 500);
    await page.keyboard.insertText('小屏超长公司名称验证换行是否不缩字体');
    await page.waitForTimeout(600);
    await u.shot('360-06-custom-typed');
    await u.tap(0, inputSubmitY(G), 900);
    await u.shot('360-07-custom-applied');
    await u.wheel(0, 0, 5, 500);
    await u.shot('360-07b-custom-visible');
    await u.tap(0, FOOTER_Y, 900);
    await u.shot('360-08-s02');
    await u.tap(0, paneY(G, -70), 700);
    await u.shot('360-09-s02-trait3');
    await u.tap(116, paneY(G, 238), 800);
    await u.shot('360-10-s02-random');
    await u.tap(85, FOOTER_Y, 1400);
    await u.shot('360-11-s03');
    const s03 = await readState(page);
    out.afterCreate = s03;
    out.checks.createdSoftware =
      !!s03 && s03.industry === 'SOFTWARE' && s03.cash === 300000 && s03.paidInCapital === 300000;
    out.checks.rngUntouchedSoftware = !!s03 && s03.rngCounter === 0;

    await u.tap(0, paneY(G, 276, 64), 900);
    await u.shot('360-12-hire-confirm');
    await u.tap(0, -74, 1400);
    await u.shot('360-13-s03-1of2');
    await u.tap(0, paneY(G, 106, 64), 900);
    await u.tap(0, -74, 1400);
    const s03b = await readState(page);
    out.afterHire2 = s03b;
    out.checks.twoHiresSmall =
      !!s03b && s03b.hires === 2 && s03b.employees === 2 && s03b.phase === 'TUTORIAL_DASHBOARD' &&
      s03b.cash === 300000 + s03b.recruitFees.reduce((s2, v) => s2 + v, 0);
    await u.shot('360-14-s03-2of2');
    await u.tap(0, FOOTER_Y, 1400);
    await u.shot('360-15-company-running');
    const run = await readState(page);
    out.checks.enterSmall = !!run && run.phase === 'RUNNING';
    out.storage = await dumpStorage(page);
    out.geom = { visibleH: G.visibleH, scale: G.scale, footerY: FOOTER_Y };
    report.contexts.B = out;
    fs.writeFileSync(`${baseDir}/state-360.json`, JSON.stringify(out, null, 2), 'utf8');
    await ctx.close();
  }

  // ---------------------------------------------------------------- C：390×844 SERVICE（第三尺寸）
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => pageErrors.push(e.message));
    await page.goto(url, { waitUntil: 'load', timeout: 60000 });
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await page.reload({ waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(5000);
    const G = await geom(page);
    const u = mk(page, G);
    const out = { viewport: '390x844', industry: 'SERVICE', checks: {} };

    await u.consent();
    await u.tap(0, 92, 800);
    await u.shot('390-01-s01-service');
    const names = await readState(page);
    out.rngBefore = names && names.rngCounter;
    await u.tap(0, -370, 900);
    await u.shot('390-02-s02');
    await u.tap(85, -370, 1400);
    await u.shot('390-03-s03');
    const created = await readState(page);
    out.afterCreate = created;
    out.checks.createdService =
      !!created && created.industry === 'SERVICE' && created.cash === 300000 && created.paidInCapital === 300000;
    out.checks.rngUntouchedService = !!created && created.rngCounter === 0;

    await u.tap(0, paneY(G, 276, 64), 900);
    await u.tap(0, -74, 1400);
    await u.tap(0, paneY(G, 106, 64), 900);
    await u.tap(0, -74, 1400);
    const hired = await readState(page);
    out.afterHire2 = hired;
    out.checks.twoHiresService =
      !!hired && hired.hires === 2 && hired.employees === 2 &&
      hired.cash === 300000 + hired.recruitFees.reduce((s2, v) => s2 + v, 0);
    await u.shot('390-04-s03-2of2');
    await u.tap(0, -370, 1400);
    await u.shot('390-05-company-running');
    const run = await readState(page);
    out.checks.enterService = !!run && run.phase === 'RUNNING';
    out.storage = await dumpStorage(page);
    report.contexts.C = out;
    fs.writeFileSync(`${baseDir}/state-390.json`, JSON.stringify(out, null, 2), 'utf8');
    await ctx.close();
  }

  report.errors = [...new Set(pageErrors)];
  report.ok =
    report.errors.length === 0 &&
    Object.values(report.contexts).every((c) => Object.values(c.checks || {}).every(Boolean));
  fs.writeFileSync(`${baseDir}/r27-report.json`, JSON.stringify(report, null, 2), 'utf8');
  console.log(JSON.stringify({
    ok: report.ok,
    errors: report.errors,
    checks: {
      A: report.contexts.A.checks,
      B: report.contexts.B.checks,
      C: report.contexts.C.checks,
    },
  }, null, 2));
  await browser.close();
  if (!report.ok) process.exit(1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
