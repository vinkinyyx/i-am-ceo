#!/usr/bin/env node
// R39 focused real-Canvas visual pass: primary tabs and settings across four viewports.
const fs = require('node:fs');
const path = require('node:path');
const { CanvasDriver } = require('./canvas-driver.cjs');

const VIEWPORTS = [
  { name: '375x812', width: 375, height: 812 },
  { name: '360x640', width: 360, height: 640 },
  { name: '390x844', width: 390, height: 844 },
  { name: '375x834', width: 375, height: 834 },
];
function usage() {
  return 'Usage: node tools/e2e/visual-viewports.cjs --url <URL> --out <new-directory> [--seed <json>]';
}
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--help') return { help: true };
    if (!['--url', '--out', '--seed'].includes(argv[i]) || !argv[i + 1] || argv[i + 1].startsWith('--')) {
      throw new Error(`invalid-argument:${argv[i] || '<missing>'}`);
    }
    out[argv[i].slice(2)] = argv[++i];
  }
  return out;
}
async function labelTargets(driver, exactText) {
  const matches = [];
  for (let nth = 0; nth < 20; nth += 1) {
    const target = (await driver.findLabels(exactText, { nth }))[0];
    if (!target) break;
    matches.push(target);
  }
  return matches;
}
async function clickTarget(driver, target) {
  const g = await driver.geometry();
  await driver.page.mouse.click(g.x + target.x * g.scale, g.y + (g.visibleH - target.y) * g.scale);
}
async function clickBottomTab(driver, label) {
  const matches = await labelTargets(driver, label);
  if (!matches.length) throw new Error(`tab-not-found:${label}`);
  const target = matches.reduce((best, item) => item.y < best.y ? item : best);
  await clickTarget(driver, target);
  return target;
}
async function clickTopControl(driver, label) {
  const matches = await labelTargets(driver, label);
  if (!matches.length) throw new Error(`control-not-found:${label}`);
  const target = matches.reduce((best, item) => item.y > best.y ? item : best);
  await clickTarget(driver, target);
  return target;
}
async function waitForText(driver, fragment, timeoutMs = 5_000) {
  await driver.page.waitForFunction((needle) => {
    const labels = [];
    const walk = (node) => {
      if (!node.activeInHierarchy) return;
      const label = node.getComponent(cc.Label);
      if (label) labels.push(label.string);
      node.children.forEach(walk);
    };
    walk(cc.director.getScene());
    return labels.some((text) => text.includes(needle));
  }, fragment, { timeout: timeoutMs });
}
async function activeLabels(driver) {
  return driver.page.evaluate(() => {
    const labels = [];
    const walk = (node) => {
      if (!node.activeInHierarchy) return;
      const label = node.getComponent(cc.Label);
      if (label?.string) labels.push(label.string);
      node.children.forEach(walk);
    };
    walk(cc.director.getScene());
    return labels;
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { console.log(usage()); return; }
  if (!args.url || !args.out) {
    console.error('VISUAL_FAIL url-and-new-output-required');
    console.error(usage());
    process.exitCode = 2;
    return;
  }
  const root = path.resolve(__dirname, '../..');
  const outDir = path.resolve(args.out);
  if (fs.existsSync(outDir)) {
    console.error(`VISUAL_FAIL output-exists:${outDir}`);
    process.exitCode = 2;
    return;
  }
  const seedPath = path.resolve(args.seed || path.join(root, 'evidence/m3/TASK-M3-09-R30/attempt-06/seed-size-100.json'));
  if (!fs.existsSync(seedPath)) throw new Error(`seed-missing:${seedPath}`);
  const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
  fs.mkdirSync(outDir, { recursive: true });
  const all = [];
  const executablePath = process.env.CHROME_EXE || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

  for (const viewport of VIEWPORTS) {
    const viewDir = path.join(outDir, viewport.name);
    let driver;
    try {
      driver = await CanvasDriver.launch({
        url: args.url,
        viewport: { width: viewport.width, height: viewport.height },
        outDir: viewDir,
        executablePath,
      });
      await driver.loadFixture(seed);
      await waitForText(driver, '当前可用现金', 15_000);
      await driver.page.waitForTimeout(1_500);
      if ((await activeLabels(driver)).includes('隐私保护提示')) {
        const consentTarget = await driver.clickLabel('同意并继续');
        driver.check(`${viewport.name}-privacy-consent-control`, consentTarget.width > 0 && consentTarget.height > 0, consentTarget);
        await driver.page.waitForFunction(() => {
          const labels = [];
          const walk = (node) => {
            if (!node.activeInHierarchy) return;
            const label = node.getComponent(cc.Label);
            if (label?.string) labels.push(label.string);
            node.children.forEach(walk);
          };
          walk(cc.director.getScene());
          return !labels.includes('隐私保护提示');
        }, null, { timeout: 8_000 });
      }
      await waitForText(driver, '当前可用现金', 15_000);
      await driver.page.waitForFunction(() => !document.querySelector('[data-tap-splash]'), null, { timeout: 15_000 });
      // A visible label is not proof that Canvas events are bound; allow the app's
      // first interactive frame to complete after the real HTML boot overlay exits.
      await driver.page.waitForTimeout(1_500);
      const before = await driver.readCommittedSave();
      driver.check(`${viewport.name}-company-interactive`, !!before.envelope, { revision: before.envelope?.revision });
      await driver.screenshot(`${viewport.name}-company`);

      await clickBottomTab(driver, '部门');
      await waitForText(driver, '自动经营方针：');
      driver.check(`${viewport.name}-department-tab`, true, { anchor: '自动经营方针' });
      await driver.screenshot(`${viewport.name}-department`);

      await clickBottomTab(driver, '人才');
      await waitForText(driver, '在职');
      driver.check(`${viewport.name}-talent-tab`, true);
      await driver.screenshot(`${viewport.name}-talent`);

      await clickBottomTab(driver, '排行');
      await waitForText(driver, '本地模拟排行');
      driver.check(`${viewport.name}-leaderboard-tab`, true);
      await driver.screenshot(`${viewport.name}-leaderboard`);

      // Settings is available from the company dashboard shell, not from ranking.
      await clickBottomTab(driver, '公司');
      await waitForText(driver, '当前可用现金');
      await clickTopControl(driver, '设置');
      await driver.waitForLabel('总开关（关闭后全静音）', { timeoutMs: 5_000 });
      driver.check(`${viewport.name}-settings-modal`, true);
      await driver.screenshot(`${viewport.name}-settings`);
      await driver.clickLabel('关闭');

      const after = await driver.readCommittedSave();
      driver.check(`${viewport.name}-navigation-did-not-mutate-save`,
        JSON.stringify(before.envelope) === JSON.stringify(after.envelope),
        { before: before.envelope?.revision, after: after.envelope?.revision });
      const report = await driver.finish('visual-report.json');
      all.push({ viewport, ...report, screenshots: fs.readdirSync(viewDir).filter((name) => name.endsWith('.png')) });
      if (report.status !== 'PASS') process.exitCode = 1;
    } catch (error) {
      const labels = driver ? await activeLabels(driver).catch(() => []) : [];
      if (driver) await driver.screenshot(`${viewport.name}-failure`).catch(() => undefined);
      if (driver) await driver.browser.close().catch(() => undefined);
      all.push({ viewport, status: 'FAIL', error: error.message, labels, checks: driver?.checks || [], browserErrors: driver?.errors || [] });
      process.exitCode = 1;
    }
  }
  const result = {
    status: all.length === VIEWPORTS.length && all.every((item) => item.status === 'PASS') ? 'PASS' : 'FAIL',
    url: args.url,
    seedPath: path.relative(root, seedPath).replace(/\\/g, '/'),
    states: ['company', 'department', 'talent', 'leaderboard', 'settings'],
    viewports: all,
    caveats: ['This is a focused primary-tab visual pass; it does not cover every §19.11 R39 modal, privacy, annual report, offline, crisis, error state, long-name, or keyboard/safe-area case. Screenshots require human visual inspection.'],
  };
  fs.writeFileSync(path.join(outDir, 'visual-matrix-report.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ status: result.status, viewportCount: all.length, checks: all.reduce((n, x) => n + (x.checks?.length || 0), 0), browserErrors: all.reduce((n, x) => n + (x.browserErrors?.length || 0), 0), outDir }, null, 2));
}

main().catch((error) => { console.error('VISUAL_FAIL', error); process.exit(1); });
