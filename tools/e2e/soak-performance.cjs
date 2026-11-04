#!/usr/bin/env node
// R34 full-duration browser soak. Browser metrics are diagnostics, not Tap process metrics.
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright-core');
const { CanvasDriver } = require('./canvas-driver.cjs');

function usage() {
  return 'Usage: node tools/e2e/soak-performance.cjs --url <URL> --minutes 30 --out <new-directory> [--warmup-minutes 2] [--sample-seconds 10]';
}
function argsOf(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--help') return { help: true };
    if (!argv[i].startsWith('--') || !argv[i + 1] || argv[i + 1].startsWith('--')) throw new Error(`invalid-argument: ${argv[i]}`);
    args[argv[i].slice(2)] = argv[++i];
  }
  return args;
}
function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortValue(value[key]) ]));
  return value;
}
function crc32(text) {
  let crc = 0xffffffff;
  for (const byte of Buffer.from(text, 'utf8')) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return ((crc ^ 0xffffffff) >>> 0).toString(16).padStart(8, '0');
}
function seal(envelope) {
  const { checksum: _old, ...rest } = envelope;
  return { ...rest, checksum: crc32(JSON.stringify(sortValue(rest))) };
}
function makeStressFixture() {
  const root = path.resolve(__dirname, '../..');
  const large = JSON.parse(fs.readFileSync(path.join(root, 'evidence/m3/TASK-M3-09-R30/attempt-06/seed-size-100.json'), 'utf8'));
  const staffed = JSON.parse(fs.readFileSync(path.join(root, 'evidence/m3/TASK-M3-09-R30/attempt-06/seed-staffed.json'), 'utf8'));
  const pointer = JSON.parse(large['ceo/save/active']);
  const envelope = JSON.parse(large[`ceo/save/${pointer.slot}`]);
  const staffedPointer = JSON.parse(staffed['ceo/save/active']);
  const staffedEnvelope = JSON.parse(staffed[`ceo/save/${staffedPointer.slot}`]);
  const departments = staffedEnvelope.payload.departments;
  if (envelope.payload.employees.length !== 100 || departments.length !== 6) throw new Error('fixture-shape-invalid');
  envelope.payload.departments = departments;
  envelope.payload.employees = envelope.payload.employees.map((employee, index) => ({
    ...employee,
    departmentId: departments[index % departments.length].deptId,
    pendingDepartmentId: undefined,
    transferFromMonthIndex: undefined,
  }));
  const next = seal(envelope);
  return {
    fixture: { ...large, [`ceo/save/${pointer.slot}`]: JSON.stringify(next) },
    readback: {
      runId: next.runId,
      revision: next.revision,
      employeeCount: next.payload.employees.length,
      departments: next.payload.departments.map((d) => d.type),
      seed: next.payload.seed,
      checksum: next.checksum,
      note: '100-employee/6-department performance fixture; employee assignments are test-only distribution.' ,
    },
  };
}
async function main() {
  const opts = argsOf(process.argv.slice(2));
  if (opts.help) { console.log(usage()); return; }
  const minutes = Number(opts.minutes);
  const warmupMinutes = Number(opts['warmup-minutes'] ?? 2);
  const sampleSeconds = Number(opts['sample-seconds'] ?? 10);
  if (!opts.url || !opts.out || minutes !== 30 || !Number.isInteger(warmupMinutes) || warmupMinutes < 0
    || !Number.isInteger(sampleSeconds) || sampleSeconds < 1 || sampleSeconds > 60) {
    console.error('SOAK_FAIL invalid args; minutes must be exactly 30');
    console.error(usage());
    process.exitCode = 2;
    return;
  }
  const outDir = path.resolve(opts.out);
  if (fs.existsSync(outDir)) throw new Error(`output-exists: ${outDir}`);
  fs.mkdirSync(outDir, { recursive: true });
  const { fixture, readback } = makeStressFixture();
  fs.writeFileSync(path.join(outDir, 'seed-100x6-readback.json'), JSON.stringify(readback, null, 2));
  const executablePath = process.env.CHROME_EXE || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 1 });
  await context.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (String(key).startsWith('ceo/save/')) window.__soakSaveWrites = (window.__soakSaveWrites || 0) + 1;
      return original.call(this, key, value);
    };
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push({ kind: 'pageerror', message: error.message }));
  page.on('requestfailed', (request) => errors.push({ kind: 'requestfailed', url: request.url(), message: request.failure()?.errorText }));
  await page.goto(opts.url, { waitUntil: 'load', timeout: 60_000 });
  await page.evaluate((entries) => { localStorage.clear(); for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, value); }, fixture);
  await page.reload({ waitUntil: 'load', timeout: 60_000 });
  await page.waitForFunction(() => typeof cc !== 'undefined' && !!cc.director?.getScene(), null, { timeout: 60_000 });
  await page.waitForFunction(() => !document.querySelector('[data-tap-splash]'), null, { timeout: 15_000 });
  const driver = new CanvasDriver(page, browser, outDir);
  driver.url = opts.url;
  await driver.waitForLabel('年度报告', { timeoutMs: 30_000 });
  const fixtureState = await driver.readCommittedSave();
  driver.check('fixture-loaded-100-employees-six-departments', fixtureState.envelope?.payload?.employees?.length === 100
    && fixtureState.envelope?.payload?.departments?.length === 6, {
    employees: fixtureState.envelope?.payload?.employees?.length,
    departments: fixtureState.envelope?.payload?.departments?.map((d) => d.type),
  });
  await page.evaluate(() => {
    window.__soakFrames = [];
    window.__soakPriorFrame = performance.now();
    window.__soakRaf = 0;
    const step = (now) => { window.__soakFrames.push(now - window.__soakPriorFrame); window.__soakPriorFrame = now; window.__soakRaf = requestAnimationFrame(step); };
    window.__soakRaf = requestAnimationFrame(step);
  });
  const start = Date.now();
  const warmupMs = warmupMinutes * 60_000;
  await page.waitForTimeout(warmupMs);
  const measuredStart = Date.now();
  const durationMs = 30 * 60_000;
  const sampleMs = sampleSeconds * 1000;
  const samples = [];
  const actions = [];
  const click = async (label) => {
    await driver.clickLabel(label);
    actions.push({ atMs: Date.now() - measuredStart, action: `click:${label}` });
  };
  await click('1×');
  for (let elapsed = 0; elapsed < durationMs; elapsed += sampleMs) {
    const minute = Math.floor(elapsed / 60_000);
    if (elapsed > 0 && elapsed % (5 * 60_000) === 0) {
      if (minute === 5) await click('2×');
      else if (minute === 10) await click('5×');
      else if (minute === 15) { await click('2×'); await click('人才'); }
      else if (minute === 20) { await click('部门'); await click('排行'); }
      else if (minute === 25) { await click('1×'); await click('公司'); }
    }
    if (minute >= 15 && minute < 20 && elapsed % 60_000 === 0) {
      await page.mouse.move(180, 420);
      await page.mouse.wheel(0, minute % 2 ? 480 : -480);
      actions.push({ atMs: Date.now() - measuredStart, action: 'scroll:employee-list' });
    }
    const wait = Math.min(sampleMs, durationMs - elapsed);
    await page.waitForTimeout(wait);
    const sample = await page.evaluate(() => {
      const values = window.__soakFrames.splice(0).sort((a, b) => a - b);
      const at = (p) => values.length ? values[Math.min(values.length - 1, Math.floor(values.length * p))] : null;
      let nodes = 0, activeNodes = 0, listeners = 0;
      const walk = (node) => { nodes++; if (node.activeInHierarchy) activeNodes++; listeners += node._eventProcessor?.listeners?.length || 0; node.children.forEach(walk); };
      const scene = cc.director.getScene();
      if (scene) walk(scene);
      return {
        frameCount: values.length,
        frameMs: { p50: at(0.50), p95: at(0.95), max: values.length ? values[values.length - 1] : null },
        longFramesOver50ms: values.filter((value) => value > 50).length,
        nodes, activeNodes, cocosNodeListeners: listeners,
        heapUsedBytes: performance.memory?.usedJSHeapSize ?? null,
        saveWrites: window.__soakSaveWrites || 0,
      };
    });
    sample.atMs = Date.now() - measuredStart;
    samples.push(sample);
    if (samples.length % 6 === 0) fs.writeFileSync(path.join(outDir, 'progress.json'), JSON.stringify({ measuredMs: sample.atMs, sampleCount: samples.length, errors: errors.length }, null, 2));
  }
  await page.evaluate(() => cancelAnimationFrame(window.__soakRaf));
  const before = await driver.readCommittedSave();
  driver.check('save-envelope-readable-after-soak', !!before.envelope && before.envelope.payload.employees.length === 100, { revision: before.envelope?.revision, employees: before.envelope?.payload?.employees?.length });
  await driver.screenshot('soak-final-company');
  const report = {
    status: errors.length || driver.checks.some((check) => check.status !== 'PASS') ? 'FAIL' : 'PASS',
    profile: 'Chrome headless WebGL, 375x812, fixed test seed with 100 employees / 6 departments',
    warmupMs,
    measuredMs: Date.now() - measuredStart,
    requestedMeasuredMs: durationMs,
    sampleIntervalMs: sampleMs,
    samples,
    actions,
    fixture: readback,
    storage: { revision: before.envelope?.revision, runId: before.envelope?.runId, employees: before.envelope?.payload?.employees?.length, departments: before.envelope?.payload?.departments?.length },
    checks: driver.checks,
    browserErrors: errors,
    lifecycle: 'NOT_RUN: browser visibility simulation is not Tap onHide/onShow or native lifecycle verification',
    caveats: ['Chrome heap/FPS are not Tap process memory/FPS.', 'This run uses a fixed test fixture and does not claim natural-play economy.', 'Actual Tap lifecycle, audio focus, and device performance remain external device checks.'],
  };
  fs.writeFileSync(path.join(outDir, 'soak-performance-report.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(outDir, 'actions.json'), JSON.stringify(actions, null, 2));
  await browser.close();
  console.log(JSON.stringify({ status: report.status, measuredMs: report.measuredMs, samples: samples.length, errors: errors.length, outDir }, null, 2));
  if (report.status !== 'PASS' || report.measuredMs < durationMs) process.exitCode = 1;
}

main().catch((error) => { console.error('SOAK_FAIL', error); process.exitCode = 1; });
