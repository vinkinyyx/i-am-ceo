// R35: reusable Playwright driver for the real Cocos Canvas UI (no facade shortcut).
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

class CanvasDriver {
  constructor(page, browser, outDir) {
    this.page = page;
    this.browser = browser;
    this.outDir = outDir;
    this.errors = [];
    this.checks = [];
    page.on('pageerror', (error) => this.errors.push({ kind: 'pageerror', message: error.message }));
    page.on('requestfailed', (request) => this.errors.push({ kind: 'requestfailed', url: request.url(), message: request.failure()?.errorText }));
    page.on('response', (response) => {
      if (response.status() >= 400 && !/\/favicon\.ico(?:\?|$)/i.test(response.url())) {
        this.errors.push({ kind: 'http', status: response.status(), url: response.url() });
      }
    });
  }

  static async launch({ url, viewport = { width: 375, height: 812 }, outDir, executablePath, headless = true }) {
    fs.mkdirSync(outDir, { recursive: true });
    const browser = await chromium.launch({ executablePath, headless, args: ['--no-sandbox'] });
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const driver = new CanvasDriver(page, browser, outDir);
    driver.url = url;
    await page.goto(url, { waitUntil: 'load', timeout: 60_000 });
    await driver.waitForCanvas();
    return driver;
  }

  async waitForCanvas(timeoutMs = 20_000) {
    await this.page.waitForFunction(() => typeof cc !== 'undefined' && !!cc.director?.getScene(), null, { timeout: timeoutMs });
  }

  async geometry() {
    return this.page.$$eval('canvas', (elements) => {
      const rect = elements[0]?.getBoundingClientRect();
      if (!rect) throw new Error('canvas-missing');
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, scale: rect.width / 375, visibleH: rect.height / (rect.width / 375) };
    });
  }

  async findLabels(text, { exact = true, parentContains, nth = 0 } = {}) {
    return this.page.evaluate(({ text, exact, parentContains }) => {
      // Some Cocos web builds do not expose cc.UITransform on the global `cc` object;
      // fall back to the component list so geometry assertions do not silently read 0.
      const uiTransformOf = (node) =>
        node.getComponent(cc.UITransform) ||
        node.components?.find((component) => component.constructor?.name === 'UITransform') ||
        null;
      const found = [];
      const walk = (node) => {
        if (!node.activeInHierarchy) return;
        const label = node.getComponent(cc.Label);
        if (label && (exact ? label.string === text : label.string.includes(text))) {
          const parentLabels = node.parent?.children.map((child) => child.getComponent(cc.Label)?.string || '').join('\n') || '';
          if (!parentContains || parentLabels.includes(parentContains)) {
            // Button label bounds can be empty before font layout; use the actual
            // parent Button hitbox so clicks exercise the same target as a player.
            let targetNode = node;
            let ancestor = node.parent;
            while (ancestor) {
              if (ancestor.getComponent(cc.Button)) { targetNode = ancestor; break; }
              ancestor = ancestor.parent;
            }
            const transform = uiTransformOf(targetNode);
            const box = transform?.getBoundingBoxToWorld();
            if (box) found.push({ text: label.string, x: box.x + box.width / 2, y: box.y + box.height / 2, width: box.width, height: box.height });
            else {
              const pos = targetNode.getWorldPosition();
              const size = transform?.contentSize;
              found.push({ text: label.string, x: pos.x, y: pos.y, width: size?.width ?? 1, height: size?.height ?? 1 });
            }
          }
        }
        node.children.forEach(walk);
      };
      walk(cc.director.getScene());
      return found;
    }, { text, exact, parentContains }).then((found) => found.slice(nth, nth + 1));
  }

  async clickLabel(text, options = {}) {
    const matches = await this.findLabels(text, options);
    if (!matches.length) throw new Error(`action-not-found: ${text}`);
    const g = await this.geometry();
    const target = matches[0];
    await this.page.mouse.click(g.x + target.x * g.scale, g.y + (g.visibleH - target.y) * g.scale);
    return target;
  }

  async waitForLabel(text, { exact = true, timeoutMs = 5000 } = {}) {
    const end = Date.now() + timeoutMs;
    while (Date.now() < end) {
      const found = await this.findLabels(text, { exact });
      if (found.length) return found[0];
      await this.page.waitForTimeout(100);
    }
    throw new Error(`wait-timeout: ${text}`);
  }

  async loadFixture(storageEntries) {
    await this.page.evaluate((entries) => {
      localStorage.clear();
      for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, value);
    }, storageEntries);
    await this.page.reload({ waitUntil: 'load', timeout: 60_000 });
    await this.waitForCanvas();
  }

  async readCommittedSave() {
    return this.page.evaluate(() => {
      const pointerText = localStorage.getItem('ceo/save/active');
      const pointer = pointerText ? JSON.parse(pointerText) : null;
      const envelopeText = pointer && localStorage.getItem(`ceo/save/${pointer.slot}`);
      const envelope = envelopeText ? JSON.parse(envelopeText) : null;
      const journalText = localStorage.getItem('ceo/save/transaction');
      return { pointer, envelope, journal: journalText ? JSON.parse(journalText) : null };
    });
  }

  async screenshot(name) {
    const file = path.join(this.outDir, `${name}.png`);
    await this.page.screenshot({ path: file, fullPage: true });
    return file;
  }

  check(id, passed, detail = null) { this.record(id, passed ? 'PASS' : 'FAIL', detail); }

  record(id, status, detail = null) {
    const allowed = new Set(['PASS', 'FAIL', 'SKIP', 'BLOCKED', 'TIMEOUT']);
    if (!allowed.has(status)) throw new Error(`invalid-check-status: ${status}`);
    this.checks.push({ id, status, detail });
  }

  async finish(name = 'e2e-report.json') {
    const nonPassing = this.checks.filter((check) => check.status !== 'PASS');
    const report = {
      url: this.url,
      viewport: this.page.viewportSize(),
      checks: this.checks,
      checkCounts: Object.fromEntries(['PASS', 'FAIL', 'SKIP', 'BLOCKED', 'TIMEOUT'].map((status) => [status, this.checks.filter((check) => check.status === status).length])),
      browserErrors: this.errors,
      status: nonPassing.length === 0 && this.errors.length === 0 ? 'PASS' : 'FAIL',
      exitCode: nonPassing.length === 0 && this.errors.length === 0 ? 0 : 1,
    };
    fs.writeFileSync(path.join(this.outDir, name), JSON.stringify(report, null, 2));
    await this.browser.close();
    return report;
  }
}

module.exports = { CanvasDriver };
