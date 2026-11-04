const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const blocked = [];
    await page.route('**/assets/resources/native/**/*.png', (route) => { blocked.push(route.request().url()); return route.abort(); });
    const seed = JSON.parse(fs.readFileSync('evidence/m3/TASK-M3-09-R30/attempt-06/seed-staffed.json', 'utf8'));
    await page.goto('http://127.0.0.1:8148/');
    await page.evaluate((entries) => { localStorage.clear(); Object.entries(entries).forEach(([key, value]) => localStorage.setItem(key, value)); }, seed);
    await page.reload();
    await page.waitForFunction(() => typeof cc !== 'undefined' && cc.director.getScene()?.getChildByName('Canvas')?.getChildByName('AppRoot')?.children.length > 0);
    await page.waitForTimeout(1500);
    const state = await page.evaluate(() => {
      const canvas = cc.director.getScene().getChildByName('Canvas');
      const background = canvas.getChildByName('Backdrop');
      const labels = [];
      const walk = (n) => { const l = n.getComponent(cc.Label); if (l && n.activeInHierarchy) labels.push(l.string); n.children.forEach(walk); }; walk(canvas);
      return { fallback: background.getComponent(cc.Graphics).enabled, loaded: !!background.getChildByName('BackgroundImage').getComponent(cc.Sprite).spriteFrame, companyUi: labels.includes('年度报告') };
    });
    const report = { status: blocked.length > 0 && state.fallback && !state.loaded && state.companyUi && errors.length === 0 ? 'PASS' : 'FAIL', blocked, state, pageErrors: errors };
    await page.screenshot({ path: path.join(__dirname, 'background-load-failure-fallback.png') });
    fs.writeFileSync(path.join(__dirname, 'background-failure-report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
    if (report.status !== 'PASS') process.exitCode = 1;
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
