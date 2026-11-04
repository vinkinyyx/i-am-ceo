const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const seed = JSON.parse(fs.readFileSync('evidence/m3/TASK-M3-09-R30/attempt-06/seed-staffed.json', 'utf8'));
const outDir = process.argv[3] || 'evidence/m3/TASK-M3-09-R34/attempt-01';
const CHROME = process.env.CHROME_EXE || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 1 });
  await context.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (String(key).startsWith('ceo/save/')) window.__saveWrites = (window.__saveWrites || 0) + 1;
      return original.call(this, key, value);
    };
  });
  const page = await context.newPage();
  const startupStartedAt = Date.now();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(process.argv[2] || 'http://127.0.0.1:8153/', { waitUntil: 'load', timeout: 60_000 });
  await page.evaluate((entries) => { localStorage.clear(); for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, value); }, seed);
  await page.reload({ waitUntil: 'load', timeout: 60_000 });
  await page.waitForFunction(() => typeof cc !== 'undefined' && !!cc.director?.getScene());
  const find = async (text) => page.evaluate((wanted) => {
    const found = [];
    const walk = (node) => {
      const label = node.getComponent(cc.Label);
      const transform = node.components.find((c) => c.constructor?.name === 'UITransform');
      const box = transform?.getBoundingBoxToWorld();
      if (label?.string === wanted && node.activeInHierarchy && box) found.push({ x: box.x + box.width / 2, y: box.y + box.height / 2 });
      node.children.forEach(walk);
    };
    walk(cc.director.getScene()); return found[0] || null;
  }, text);
  const click = async (text) => {
    const target = await find(text);
    if (!target) throw new Error(`action-not-found: ${text}`);
    const rect = await page.locator('canvas').first().boundingBox();
    const scale = rect.width / 375;
    const visibleH = rect.height / scale;
    await page.mouse.click(rect.x + target.x * scale, rect.y + (visibleH - target.y) * scale);
    await page.waitForTimeout(300);
  };
  const sample = async (speed, ms = 20_000) => {
    await click(speed);
    const initial = await page.evaluate(() => ({ writes: window.__saveWrites || 0, started: performance.now() }));
    await page.evaluate(() => {
      window.__frameSamples = [];
      let prior = performance.now();
      const step = (now) => { window.__frameSamples.push(now - prior); prior = now; window.__frameRaf = requestAnimationFrame(step); };
      window.__frameRaf = requestAnimationFrame(step);
    });
    await page.waitForTimeout(ms);
    const result = await page.evaluate(() => {
      cancelAnimationFrame(window.__frameRaf);
      const values = window.__frameSamples.slice(1).sort((a, b) => a - b);
      const at = (p) => values[Math.min(values.length - 1, Math.floor(values.length * p))] || null;
      let nodes = 0, activeNodes = 0, listeners = 0;
      const walk = (node) => { nodes += 1; if (node.activeInHierarchy) activeNodes += 1; listeners += node._eventProcessor?.listeners?.length || 0; node.children.forEach(walk); };
      walk(cc.director.getScene());
      return {
        frameCount: values.length,
        frameMs: { p50: at(0.50), p95: at(0.95), max: values.at(-1) || null },
        longFramesOver50ms: values.filter((value) => value > 50).length,
        nodes, activeNodes, cocosNodeListeners: listeners,
        heapUsedBytes: performance.memory?.usedJSHeapSize ?? null,
        saveWrites: window.__saveWrites || 0,
      };
    });
    result.speed = speed;
    result.windowMs = ms;
    result.saveWritesDuringWindow = result.saveWrites - initial.writes;
    result.saveWritesPerMinute = Math.round(result.saveWritesDuringWindow * 60_000 / ms);
    delete result.saveWrites;
    await page.screenshot({ path: path.join(outDir, `speed-${speed.replace(/[^a-z0-9]/gi, '')}.png`), fullPage: true });
    return result;
  };
  await page.waitForTimeout(1_000);
  const interactive = await find('年度报告');
  if (!interactive) throw new Error('company-dashboard-not-interactive');
  const interactiveAvailableMs = Date.now() - startupStartedAt;
  const metrics = [];
  for (const speed of ['1×', '2×', '5×', '暂停']) metrics.push(await sample(speed));
  const report = {
    status: errors.length ? 'FAIL' : 'PARTIAL',
    profile: 'Chrome headless, WebGL canvas, 375x812, local 6-employee test fixture',
    initialCompanyActionAvailableMs: interactiveAvailableMs,
    sampleWindowEachMs: 20_000,
    metrics,
    browserErrors: errors,
    caveats: ['This is browser diagnostic data, not Tap process FPS or memory.', 'No pre-remediation build was preserved for an apples-to-apples before/after comparison.', 'The project 30-minute soak and device performance thresholds remain unverified.'],
  };
  fs.writeFileSync(path.join(outDir, 'performance-report.json'), JSON.stringify(report, null, 2));
  await browser.close();
  console.log(JSON.stringify(report, null, 2));
  if (errors.length) process.exitCode = 1;
})().catch((error) => { console.error(error); process.exit(1); });
