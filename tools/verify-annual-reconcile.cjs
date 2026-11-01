// 临时诊断脚本：复现 M1 首年流程后，从 localStorage 存读取年报与月度账本，校验勾稽。
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const url = process.argv[2] || 'http://localhost:8123/';
const out = process.argv[3] || 'evidence/test-v1.1/R2/save-dump.json';

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
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
  const tap = async (dx, dy, wait = 600) => {
    await page.mouse.click(c.x + c.w / 2 + dx * scale, c.y + c.h / 2 - dy * scale);
    await page.waitForTimeout(wait);
  };

  await tap(0, -330);
  await tap(85, -300, 900);
  await tap(124, 164, 500);
  await tap(124, 46, 500);
  await tap(0, -360, 1500);
  await tap(0, -78, 800);
  await tap(114, 240, 500); // 5×
  await page.waitForTimeout(68000); // 推进到第2年第1月后

  const keys = await page.evaluate(() => Object.keys(window.localStorage));
  const raw = await page.evaluate(() =>
    Object.fromEntries(
      Object.keys(window.localStorage).map((k) => [k, window.localStorage.getItem(k)]),
    ),
  );
  let payload = null;
  let activeSlot = 'a';
  try {
    const active = JSON.parse(raw['ceo/save/active'] || 'null');
    if (active && active.slot) activeSlot = active.slot;
  } catch (e) {}
  try {
    const env = JSON.parse(raw[`ceo/save/${activeSlot}`] || 'null');
    if (env) payload = env.payload;
  } catch (e) {}

  const result = {
    keys,
    activeSlot,
    errors: [...new Set(errors)],
    state: payload
      ? {
          gameYear: payload.gameYear,
          gameMonth: payload.gameMonth,
          phase: payload.phase,
          cashYuan: payload.company && payload.company.cashYuan,
          headcount: (payload.employees || []).length,
          salaries: (payload.employees || []).map((e) => ({ name: e.name, salary: e.salaryMonthlyYuan, eff: e.effectiveFromMonthIndex })),
          annualReports: payload.annualReports,
          ledgers: (payload.monthlyLedgersRolling || []).map((l) => ({
            y: l.year, m: l.month, rev: l.revenueYuan, direct: l.directCostYuan,
            other: l.otherOperatingCostYuan, afterSales: l.afterSalesCostYuan, fixed: l.fixedCostYuan,
            payroll: l.payrollYuan, recruit: l.recruitmentCostYuan, sev: l.severanceCostYuan,
            dept: l.deptSetupCostYuan, event: l.eventCostYuan, dep: l.depreciationYuan,
            profit: l.profitYuan, cashDelta: l.cashDeltaYuan,
          })),
        }
      : null,
  };

  if (result.state) {
    const led = result.state.ledgers.filter((l) => l.y === 1);
    const sum = (f) => led.reduce((s, l) => s + f(l), 0);
    result.check = {
      months: led.length,
      sumRevenue: sum((l) => l.rev),
      sumCosts: sum((l) => l.direct + l.other + l.afterSales + l.fixed + l.payroll + l.recruit + l.sev + l.dept + l.event + l.dep),
      sumProfit: sum((l) => l.profit),
      lineCheck: sum((l) => l.rev + l.direct + l.other + l.afterSales + l.fixed + l.payroll + l.recruit + l.sev + l.dept + l.event + l.dep),
      sumCashDelta: sum((l) => l.cashDelta),
      report: result.state.annualReports && result.state.annualReports[0],
    };
  }

  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(result, null, 2), 'utf8');
  console.log(JSON.stringify({ out, errors: result.errors, check: result.check }, null, 2));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
