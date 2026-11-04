const fs = require('node:fs');
const path = require('node:path');
const { CanvasDriver } = require('../../tools/e2e/canvas-driver.cjs');
const root = path.resolve(__dirname, '../..');
async function main() {
  const out = process.argv[2] ? path.resolve(process.argv[2]) : __dirname;
  fs.mkdirSync(out, { recursive: true });
  let driver;
  try {
    driver = await CanvasDriver.launch({ url: 'http://127.0.0.1:8165/', viewport: { width: 375, height: 812 }, outDir: out, executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
    const seed = JSON.parse(fs.readFileSync(path.join(root, 'evidence/m3/TASK-M3-09-R30/attempt-06/seed-size-100.json'), 'utf8'));
    await driver.loadFixture(seed);
    await driver.waitForLabel('当前可用现金', { exact: false, timeoutMs: 15000 });
    await driver.page.waitForFunction(() => !document.querySelector('[data-tap-splash]'), null, { timeout: 15000 });
    await driver.page.waitForTimeout(1500);
    if ((await driver.findLabels('同意并继续')).length) {
      await driver.clickLabel('同意并继续');
      await driver.page.waitForTimeout(1800);
    }
    await driver.clickLabel('5×');
    await driver.page.waitForTimeout(120);
    await driver.clickLabel('人才');
    await driver.waitForLabel('在职', { exact: false });
    await driver.clickLabel('详情');
    await driver.waitForLabel('员工详情');
    const opened = await driver.readCommittedSave();
    const start = Date.now();
    await driver.screenshot('detail-opened');
    const samples = [];
    for (let i = 0; i < 35; i++) {
      const state = await driver.readCommittedSave();
      const present = (await driver.findLabels('员工详情')).length > 0;
      samples.push({ elapsedMs: Date.now() - start, present, gameYear: state.envelope?.payload.gameYear, gameMonth: state.envelope?.payload.gameMonth, revision: state.envelope?.revision });
      if (!present) break;
      await driver.page.waitForTimeout(400);
    }
    await driver.screenshot('detail-after-wait');
    // The save read and label query in one sample can straddle a monthly commit.
    await driver.page.waitForTimeout(250);
    const after = await driver.readCommittedSave();
    const last = samples[samples.length - 1];
    const result = { date: '2026-11-05', url: driver.url, artifact: 'build/release/m3-20261104-cloud-rank-r1/05/web-preview/web-mobile', scenario: 'Paused 100-employee fixture; user clicks 5x, talent, detail; no close/back/mask action afterwards.', opened: { year: opened.envelope?.payload.gameYear, month: opened.envelope?.payload.gameMonth, revision: opened.envelope?.revision }, after: { year: after.envelope?.payload.gameYear, month: after.envelope?.payload.gameMonth, revision: after.envelope?.revision }, samples, reproducedUnexpectedClose: last?.present === false, monthAdvancedWhenClosed: (after.envelope?.payload.gameMonth !== opened.envelope?.payload.gameMonth || after.envelope?.payload.gameYear !== opened.envelope?.payload.gameYear), browserErrors: driver.errors };
    fs.writeFileSync(path.join(out, 'detail-lifetime-probe.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
  } finally { if (driver) await driver.browser.close(); }
}
main().catch(error => { fs.writeFileSync(path.join(__dirname, 'probe-error.txt'), String(error.stack || error)); console.error(error); process.exitCode = 1; });
