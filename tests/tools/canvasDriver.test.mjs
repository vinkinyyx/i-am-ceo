import { describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { CanvasDriver } = require('../../tools/e2e/canvas-driver.cjs');

describe('R35 CanvasDriver failure sensitivity', () => {
  it('任何 FAIL 检查使验收结果为 FAIL', async () => {
    const browser = { close: vi.fn(async () => {}) };
    const page = { on: vi.fn(), viewportSize: () => ({ width: 375, height: 812 }) };
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ceo-canvas-driver-'));
    const driver = new CanvasDriver(page, browser, outDir);
    driver.check('intentional-covered-action', false, { reason: 'button intentionally covered' });
    const report = await driver.finish();
    expect(report.status).toBe('FAIL');
    expect(report.checks[0].status).toBe('FAIL');
    expect(browser.close).toHaveBeenCalledOnce();
    fs.rmSync(outDir, { recursive: true, force: true });
  });

  it('pageerror 和非 favicon 的 HTTP 错误被计为故障', () => {
    const page = { on: vi.fn() };
    const driver = new CanvasDriver(page, { close: async () => {} }, '.');
    const callbacks = Object.fromEntries(page.on.mock.calls.map(([event, callback]) => [event, callback]));
    callbacks.pageerror(new Error('intentional page error'));
    callbacks.response({ status: () => 404, url: () => 'http://localhost/missing-resource.png' });
    expect(driver.errors.map((e) => e.kind)).toEqual(['pageerror', 'http']);
  });

  it.each(['SKIP', 'BLOCKED', 'TIMEOUT'])('%s 不能被汇总成验收通过', async (status) => {
    const browser = { close: vi.fn(async () => {}) };
    const page = { on: vi.fn(), viewportSize: () => ({ width: 375, height: 812 }) };
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ceo-canvas-status-'));
    const driver = new CanvasDriver(page, browser, outDir);
    driver.record(`intentional-${status.toLowerCase()}`, status, { reason: 'not satisfied' });
    const report = await driver.finish();
    expect(report.status).toBe('FAIL');
    expect(report.exitCode).toBe(1);
    expect(report.checkCounts[status]).toBe(1);
    await fs.promises.rm(outDir, { recursive: true, force: true });
  });

  it('未知状态拒绝写入报告', () => {
    const driver = new CanvasDriver({ on: vi.fn() }, { close: async () => {} }, '.');
    expect(() => driver.record('bad-state', 'MAYBE')).toThrow('invalid-check-status');
  });
});
