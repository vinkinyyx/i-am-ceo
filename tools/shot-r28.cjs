// R28 证据：公司首页、时间倍速与经营操作（三尺寸 + 长名/大额/负利润压力档）。
// T01 长名单行裁切 + 独立设置热区 + 完整档案；大额现金与负利润不压设置。
// T02 暂停/1×/2×/5× 实际生效（5× 月结推进、暂停不动）并持久化到重载后。
// T03 扩产取消不扣款；确认后现金−投资、业务资产+投资、总资产当时不变。
// T04 扩产预览显示真实产能/需求与闲置风险（数值全部来自 previewInvest）。
// T05 连续三年盈利目标达成后仍可继续经营（首页文案 + 倍速可切换）。
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const url = process.argv[2] || 'http://localhost:8123/';
const baseDir = process.argv[3] || 'evidence/m3/TASK-M3-09-R28/attempt-01';
const dir = `${baseDir}/shots`;
const SEED_FILE = 'evidence/m3/TASK-M3-09-R27/attempt-01/seed-save-375.json';
const CHROME = process.env.CHROME_EXE || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

// ---------------------------------------------------------------- checksum（与领域层同实现）
const TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32String(text) {
  const bytes = Buffer.from(text, 'utf8');
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return ((crc ^ 0xffffffff) >>> 0).toString(16).padStart(8, '0');
}

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value !== null && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = sortValue(value[key]);
    return out;
  }
  return value;
}

function computeChecksum(env) {
  const { schemaVersion, gameVersion, configVersion, revision, runId, resetGeneration, payload } = env;
  return crc32String(
    JSON.stringify(sortValue({ schemaVersion, gameVersion, configVersion, revision, runId, resetGeneration, payload })),
  );
}

function seal(env) {
  const { checksum, ...rest } = env;
  return { ...rest, checksum: computeChecksum(rest) };
}

// ---------------------------------------------------------------- 种子
const rawSeed = JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'));
const pointerKey = 'ceo/save/active';
const pointer = JSON.parse(rawSeed[pointerKey]);
const slot = pointer.slot === 'b' ? 'b' : 'a';
const baseEnvelope = JSON.parse(rawSeed[`ceo/save/${slot}`]);
if (computeChecksum(baseEnvelope) !== baseEnvelope.checksum) {
  throw new Error(`checksum 复算失败：${computeChecksum(baseEnvelope)} != ${baseEnvelope.checksum}`);
}

const nowMs = Date.now();
function makeLive() {
  const env = JSON.parse(JSON.stringify(baseEnvelope));
  env.payload.speed = 0;
  env.payload.progressMsInMonth = 0;
  env.payload.lastWallClockMs = nowMs;
  const sealed = seal(env);
  return {
    'ceo/privacy/consent': rawSeed['ceo/privacy/consent'],
    [pointerKey]: JSON.stringify({ ...pointer, revision: sealed.revision }),
    [`ceo/save/${slot}`]: JSON.stringify(sealed),
  };
}

function makeStress() {
  const env = JSON.parse(JSON.stringify(baseEnvelope));
  const p = env.payload;
  p.speed = 0;
  p.progressMsInMonth = 0;
  p.lastWallClockMs = nowMs;
  p.company.cashYuan = 1_234_567;
  p.company.businessAssetBookYuan = 0;
  p.company.businessCapacityInvestmentYuan = 0;
  p.monthlyLedgersRolling = [
    {
      runId: p.runId,
      year: 1,
      month: 1,
      revenueYuan: 950_000,
      directCostYuan: 980_000,
      otherOperatingCostYuan: 120_000,
      afterSalesCostYuan: 60_000,
      fixedCostYuan: 40_000,
      payrollYuan: 60_000,
      recruitmentCostYuan: 15_000,
      severanceCostYuan: 0,
      deptSetupCostYuan: 0,
      eventCostYuan: 0,
      depreciationYuan: 0,
      profitYuan: -325_000,
      cashDeltaYuan: -15_000,
    },
  ];
  p.consecutiveProfitableYears = 3;
  p.target3YearsAchieved = true;
  p.cashRisk = 'NORMAL';
  const sealed = seal(env);
  return {
    'ceo/privacy/consent': rawSeed['ceo/privacy/consent'],
    [pointerKey]: JSON.stringify({ ...pointer, revision: sealed.revision }),
    [`ceo/save/${slot}`]: JSON.stringify(sealed),
  };
}

const liveSeed = makeLive();
const stressSeed = makeStress();
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(`${baseDir}/seed-live.json`, JSON.stringify(liveSeed, null, 2));
fs.writeFileSync(`${baseDir}/seed-stress.json`, JSON.stringify(stressSeed, null, 2));
fs.writeFileSync(`${baseDir}/seed-base-crc-verified.json`, JSON.stringify({ ok: true, checksum: baseEnvelope.checksum }, null, 2));

// ---------------------------------------------------------------- 页面工具
const readState = (page) =>
  page.evaluate(() => {
    try {
      const active = JSON.parse(localStorage.getItem('ceo/save/active') || 'null');
      const s = active && active.slot === 'b' ? 'b' : 'a';
      const env = JSON.parse(localStorage.getItem(`ceo/save/${s}`) || 'null');
      if (!env) return null;
      const p = env.payload || {};
      const c = p.company || {};
      const ledgers = (p.monthlyLedgersRolling || []).filter((l) => l.runId === p.runId && l.year === p.gameYear);
      return {
        runId: env.runId,
        revision: env.revision,
        phase: p.phase,
        speed: p.speed,
        gameYear: p.gameYear,
        gameMonth: p.gameMonth,
        progressMsInMonth: p.progressMsInMonth,
        cash: c.cashYuan,
        asset: c.businessAssetBookYuan,
        capacityInvestment: c.businessCapacityInvestmentYuan,
        total: (c.cashYuan || 0) + (c.businessAssetBookYuan || 0),
        ytdRevenue: ledgers.reduce((n, l) => n + (l.revenueYuan || 0), 0),
        ytdProfit: ledgers.reduce((n, l) => n + (l.profitYuan || 0), 0),
        ledgerCount: ledgers.length,
        companyName: c.name,
        target3YearsAchieved: p.target3YearsAchieved,
        consecutiveProfitableYears: p.consecutiveProfitableYears,
        cashRisk: p.cashRisk,
        employees: (p.employees || []).length,
        executedCommandCount: (p.executedCommandIds || []).length,
      };
    } catch (e) {
      return { error: String(e) };
    }
  });

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
  const report = {
    url,
    generatedAt: new Date().toISOString(),
    checks: [],
    states: {},
    finance: {},
    screenshots: [],
    errors: [],
  };
  const pageErrors = [];
  const shots = [];

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

  const mk = (page, G, tag) => ({
    shot: async (n) => {
      const name = `${tag}-${n}.png`;
      await page.screenshot({ path: `${dir}/${name}` });
      shots.push(name);
    },
    crop: (box) => page.screenshot({ clip: box }),
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
      await page.waitForTimeout(600);
    },
    seed: async (seed) => {
      await page.goto(url, { waitUntil: 'load', timeout: 60000 });
      await page.evaluate((s) => {
        try {
          localStorage.clear();
          for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
        } catch (e) {}
      }, seed);
      await page.reload({ waitUntil: 'load', timeout: 60000 });
      await page.waitForTimeout(4500);
    },
  });

  const check = (id, pass, detail) => report.checks.push({ id, pass: !!pass, detail });

  // 375×812 顶到 authored 坐标 == 屏幕坐标；360×640 需按可视高换算
  const topY = (G, aY) => G.visibleH / 2 - 406 + aY;
  const bottomY = (G, aY, footerH = 72) => -G.visibleH / 2 + footerH + 406 + aY;

  // ---------------------------------------------------------------- A：375×812 实机流程
  {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => pageErrors.push(`A:${e.message}`));
    const G = await geom(await (async () => {
      await page.goto(url, { waitUntil: 'load', timeout: 60000 });
      return page;
    })());
    const u = mk(page, G, '375');
    await u.seed(liveSeed);
    const s0 = await readState(page);
    report.states.liveInitial = s0;
    await u.shot('01-home-top');

    // T01：长名不压设置；点公司名看完整档案
    await u.tap(-38, 364);
    await u.shot('02-company-detail');
    const sDetail = await readState(page);
    check('T01-detail-readonly', sDetail.cash === s0.cash && sDetail.revision === s0.revision, {
      cash: sDetail.cash,
      revision: sDetail.revision,
    });
    await u.tap(0, -208);
    await u.tap(145, 364);
    await u.shot('03-settings-independent');
    const sSettings = await readState(page);
    check('T01-long-name-does-not-cover-settings', sSettings.cash === s0.cash, { opened: true, cash: sSettings.cash });
    await u.tap(0, -184);

    // T02：5× 实际推进月结 → 暂停不动 → 1×/2×/5× 依次持久化 → 重载保速
    await u.tap(114, 126, 900);
    const s5 = await readState(page);
    await page.waitForTimeout(4800);
    const s5b = await readState(page);
    check('T02-5x-actually-advances', s5b.gameMonth > s5.gameMonth || s5b.ledgerCount > s5.ledgerCount, {
      from: { month: s5.gameMonth, ledgers: s5.ledgerCount },
      to: { month: s5b.gameMonth, ledgers: s5b.ledgerCount },
    });
    await u.tap(-66, 126, 900);
    const sp = await readState(page);
    await page.waitForTimeout(1600);
    const sp2 = await readState(page);
    check('T02-pause-freezes-clock', sp.speed === 0 && sp2.gameMonth === sp.gameMonth && sp2.progressMsInMonth === sp.progressMsInMonth, {
      speed: sp.speed,
      month: sp2.gameMonth,
      progress: sp2.progressMsInMonth,
    });
    await u.tap(-6, 126, 900);
    const s1 = await readState(page);
    await u.tap(54, 126, 900);
    const s2 = await readState(page);
    await u.shot('04-speed-2x');
    await u.tap(114, 126, 900);
    const s5c = await readState(page);
    check('T02-speed-persisted-live', s1.speed === 1 && s2.speed === 2 && s5c.speed === 5, {
      speeds: [s1.speed, s2.speed, s5c.speed],
    });
    await page.reload({ waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(3500);
    const sr = await readState(page);
    await u.shot('05-speed-5x-after-reload');
    check('T02-speed-survives-reload', sr.speed === 5, { speedAfterReload: sr.speed });
    await u.tap(-66, 126, 900);
    const paused = await readState(page);
    report.states.pausedBeforeInvest = paused;

    // T03：扩产预览 → 取消不扣 → 确认后现金→资产
    // 行位经节点探针标定：1万/5万/10万 行中心 dy = 80/-34/-148（375×812 原点居中）
    await u.tap(-83, -66);
    await u.shot('06-invest-dialog-375');
    await u.tap(0, 80);
    await u.shot('07-invest-confirm-375');
    await u.tap(0, -128);
    await u.shot('08-invest-cancelled');
    // 取消只关二次确认；扩产弹窗仍在，需点底部“取消”关闭后再回到首页
    await u.tap(0, -238);
    const afterCancel = await readState(page);
    check(
      'T03-cancel-no-deduction',
      afterCancel.cash === paused.cash &&
        afterCancel.asset === paused.asset &&
        afterCancel.total === paused.total &&
        afterCancel.capacityInvestment === paused.capacityInvestment,
      { before: { cash: paused.cash, asset: paused.asset, total: paused.total }, after: { cash: afterCancel.cash, asset: afterCancel.asset, total: afterCancel.total } },
    );

    await u.tap(-83, -66);
    await u.tap(0, 80);
    await u.shot('09-invest-confirm-before');
    await u.tap(0, -74, 1200);
    await u.shot('10-invest-after');
    const afterInvest = await readState(page);
    const diff = {
      cashDelta: afterInvest.cash - afterCancel.cash,
      assetDelta: afterInvest.asset - afterCancel.asset,
      totalDelta: afterInvest.total - afterCancel.total,
      capacityInvestmentDelta: afterInvest.capacityInvestment - afterCancel.capacityInvestment,
    };
    report.finance = {
      before: { cash: afterCancel.cash, asset: afterCancel.asset, total: afterCancel.total, capacityInvestment: afterCancel.capacityInvestment },
      after: { cash: afterInvest.cash, asset: afterInvest.asset, total: afterInvest.total, capacityInvestment: afterInvest.capacityInvestment },
      diff,
    };
    fs.writeFileSync(`${baseDir}/finance-before.json`, JSON.stringify(report.finance.before, null, 2));
    fs.writeFileSync(`${baseDir}/finance-after.json`, JSON.stringify(report.finance.after, null, 2));
    fs.writeFileSync(`${baseDir}/finance-diff.json`, JSON.stringify(diff, null, 2));
    check(
      'T03-confirm-transfers-cash-to-asset',
      diff.cashDelta === -10_000 && diff.assetDelta === 10_000 && diff.totalDelta === 0 && diff.capacityInvestmentDelta === 10_000,
      diff,
    );

    // 年报入口（首年未结算 → 空态说明）
    await u.tap(83, -66);
    await u.shot('11-annual-report-entry');
    await u.tap(0, -243);

    report.states.liveFinal = afterInvest;
    fs.writeFileSync(`${baseDir}/state-375.json`, JSON.stringify({ initial: s0, paused, afterCancel, afterInvest }, null, 2));
    await ctx.close();
  }

  // ---------------------------------------------------------------- A2：375×812 压力档（长名/大额/负利润/三年目标）
  {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => pageErrors.push(`A2:${e.message}`));
    await page.goto(url, { waitUntil: 'load', timeout: 60000 });
    const G = await geom(page);
    const u = mk(page, G, '375-stress');
    await u.seed(stressSeed);
    const st = await readState(page);
    report.states.stress = st;
    await u.shot('12-home-large-negative-longname');
    check(
      'T01-large-cash-and-negative-profit-rendered',
      st.cash === 1_234_567 && st.ytdProfit < 0 && (st.companyName || '').length >= 16,
      { cash: st.cash, ytdProfit: st.ytdProfit, nameLength: (st.companyName || '').length },
    );
    check('T05-three-year-goal-achieved', st.target3YearsAchieved === true && st.consecutiveProfitableYears === 3, {
      target: st.target3YearsAchieved,
      years: st.consecutiveProfitableYears,
    });
    await u.tap(145, 364);
    await u.shot('13-stress-settings');
    const stSet = await readState(page);
    check('T01-stress-settings-still-clickable', stSet.cash === st.cash, { clicked: true });
    await u.tap(0, -184);
    await u.tap(-38, 364);
    await u.shot('14-stress-full-name-detail');
    const stDetail = await readState(page);
    check('T01-stress-full-name-in-detail', stDetail.revision === st.revision, { revision: stDetail.revision });
    await u.tap(0, -208);
    await u.tap(-83, -66);
    await u.shot('15-stress-invest-idle-risk');
    await u.tap(0, -238);
    await page.reload({ waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(3000);
    const stReload = await readState(page);
    check('T05-keeps-operating-after-goal', stReload.target3YearsAchieved === true && stReload.cash === st.cash, {
      target: stReload.target3YearsAchieved,
      cash: stReload.cash,
    });
    fs.writeFileSync(`${baseDir}/state-375-stress.json`, JSON.stringify(st, null, 2));
    await ctx.close();
  }

  // ---------------------------------------------------------------- B：360×640 小屏滚动
  {
    const ctx = await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => pageErrors.push(`B:${e.message}`));
    await page.goto(url, { waitUntil: 'load', timeout: 60000 });
    const G = await geom(page);
    const u = mk(page, G, '360');
    await u.seed(liveSeed);
    const sb = await readState(page);
    report.states.smallInitial = sb;
    await u.shot('16-small-home-top');

    // 滚到底部后切换 5×：不重建整页、不重置滚动
    await u.wheel(0, 0);
    await u.shot('17-small-scrolled-bottom');
    // 直接读取滚动内容节点位置：比像素比对更可靠（不受倍速高亮/提示条影响）
    const readScrollY = () =>
      page.evaluate(() => {
        try {
          let y = null;
          const walk = (n) => {
            if (n.name === 'BodyContent') {
              y = Math.round(n.position.y);
              return;
            }
            for (const ch of n.children) walk(ch);
          };
          walk(cc.director.getScene());
          return y;
        } catch (e) {
          return null;
        }
      });
    const scrollBefore = await readScrollY();
    await u.tap(114, bottomY(G, 126), 900);
    const sp5 = await readState(page);
    const scrollAfter = await readScrollY();
    await u.shot('18-small-speed-5x-after-scroll');
    check('T02-speed-switch-keeps-scroll', sp5.speed === 5 && scrollBefore === scrollAfter && scrollAfter !== null, {
      speed: sp5.speed,
      scrollBefore,
      scrollAfter,
    });
    await u.tap(-66, bottomY(G, 126), 900);
    const sp0 = await readState(page);
    check('T02-small-screen-speed-pause', sp0.speed === 0, { speed: sp0.speed });

    // 小屏扩产弹窗：底部按钮常驻、正文可滚动
    await u.tap(-83, bottomY(G, -66));
    await u.shot('19-small-invest-dialog');
    await u.wheel(0, 0, 3, 300);
    await u.shot('20-small-invest-dialog-scrolled');
    await u.tap(0, -238);
    fs.writeFileSync(`${baseDir}/state-360.json`, JSON.stringify({ initial: sb, speedAfterScroll: sp5.speed, speedPaused: sp0.speed, scrollBefore, scrollAfter }, null, 2));
    await ctx.close();
  }

  // ---------------------------------------------------------------- C：390×844 第三尺寸
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => pageErrors.push(`C:${e.message}`));
    await page.goto(url, { waitUntil: 'load', timeout: 60000 });
    const G = await geom(page);
    const u = mk(page, G, '390');
    await u.seed(liveSeed);
    const sc = await readState(page);
    await u.shot('21-390-home-top');
    await u.tap(-38, 364);
    await u.shot('22-390-company-detail');
    await u.tap(0, -208);
    await u.tap(114, 126, 900);
    const speed5 = await readState(page);
    await u.shot('23-390-speed-5x');
    await u.tap(-66, 126, 900);
    const pause = await readState(page);
    await u.tap(-83, -66);
    await u.shot('24-390-invest-dialog');
    await u.tap(0, 80);
    await u.shot('25-390-invest-confirm');
    await u.tap(0, -128);
    await u.tap(0, -238);
    const after = await readState(page);
    check('C-third-viewport-stable', sc.cash === after.cash && speed5.speed === 5 && pause.speed === 0, {
      cash: after.cash,
      speed5: speed5.speed,
      pause: pause.speed,
    });
    fs.writeFileSync(`${baseDir}/state-390.json`, JSON.stringify({ initial: sc, speed5: speed5.speed, paused: pause.speed, afterCancel: after.cash }, null, 2));
    await ctx.close();
  }

  report.screenshots = shots;
  report.errors = pageErrors;
  const failed = report.checks.filter((c) => !c.pass);
  report.ok = failed.length === 0 && pageErrors.length === 0;
  fs.writeFileSync(`${baseDir}/r28-report.json`, JSON.stringify(report, null, 2));
  await browser.close();
  console.log(JSON.stringify({ ok: report.ok, checks: report.checks.length, failed, errors: pageErrors, shots: shots.length }, null, 2));
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
