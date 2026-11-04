/**
 * R03：引擎前诊断与启动状态机（纯 TS 核心，注入式宿主）。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  installBootDiagnostics,
  getBootSnapshot,
  __resetBootDiagnosticsForTest,
  BOOT_STAGES,
  type BootHost,
} from '@core/platform/bootDiagnostics';

beforeEach(() => __resetBootDiagnosticsForTest());

function makeHost(overrides: Partial<BootHost> = {}): BootHost & { logs: string[]; errors: string[] } {
  const logs: string[] = [];
  const errors: string[] = [];
  return {
    now: () => 1000,
    console: {
      log: (...a: unknown[]) => logs.push(a.join(' ')),
      error: (...a: unknown[]) => errors.push(a.join(' ')),
    },
    ...overrides,
    logs,
    errors,
  };
}

describe('R03 启动诊断状态机', () => {
  it('打点顺序被记录，markInteractive 后置 ready', () => {
    const host = makeHost();
    const diag = installBootDiagnostics(host, { releaseId: 'r-test', watchdogMs: 0 });
    diag.beginStage('engine');
    diag.endStage('engine');
    expect(getBootSnapshot()?.ready).toBe(false);
    diag.markInteractive();
    const snap = diag.snapshot();
    expect(snap.ready).toBe(true);
    expect(snap.stage).toBe('interactive');
    const stages = snap.events.map((e) => e.stage);
    expect(stages).toContain('engine');
    expect(stages).toContain('interactive');
  });

  it('R03-T02：仅完成 engine 阶段不置 interactive', () => {
    const host = makeHost();
    const diag = installBootDiagnostics(host, { releaseId: 'r-test2', watchdogMs: 0 });
    diag.beginStage('engine');
    diag.endStage('engine');
    expect(diag.snapshot().ready).toBe(false);
  });

  it('R03-T01：业务模块前 throw 留下首错（不依赖 Cocos）', () => {
    const host = makeHost();
    const diag = installBootDiagnostics(host, { releaseId: 'r-test3', watchdogMs: 0 });
    diag.beginStage('modules');
    diag.fail('MODULE_IMPORT_FAILED', 'modules', 'Unexpected token in business module');
    const snap = diag.snapshot();
    expect(snap.failures[0]?.code).toBe('MODULE_IMPORT_FAILED');
    expect(snap.failures[0]?.stage).toBe('modules');
  });

  it('R03-T03：看门狗在未 ready 时触发一次，ready 后不误报', () => {
    const resultBox: { snap?: { failures: Array<{ code: string }> } } = {};
    const box: { cb?: () => void } = {};
    const host = makeHost();
    host.setTimeout = (fn: () => void) => {
      box.cb = fn;
      return 1;
    };
    host.clearTimeout = () => undefined;
    const diag = installBootDiagnostics(host, {
      releaseId: 'r-wd',
      watchdogMs: 8000,
      onTimeout: (s) => {
        resultBox.snap = s;
      },
    });
    box.cb?.();
    expect(resultBox.snap).toBeDefined();
    expect(resultBox.snap?.failures[0]?.code).toBe('BOOT_WATCHDOG_TIMEOUT');

    // ready 后再无迟到误报
    diag.markInteractive();
    box.cb?.();
    expect(diag.snapshot().failures).toHaveLength(1);
  });

  it('R03-T04：日志有上限且屏蔽 code/token/secret/存档正文', () => {
    const host = makeHost({ watchdogMs: 0 } as Partial<BootHost>);
    const diag = installBootDiagnostics(host, { releaseId: 'r-sec', watchdogMs: 0 });
    diag.fail('AUTH_ECHO', 'save', 'login code=ABCDEF123456 secret=S and token=T and payload={"cash":300000}');
    const msg = diag.snapshot().failures[0]?.message ?? '';
    expect(msg).not.toContain('ABCDEF123456');
    expect(msg).not.toContain('payload={"cash"');
    expect(msg).toMatch(/code=\*\*\*/);
    expect(msg).toMatch(/payload=\*\*\*/);
  });

  it('重试分配新 attemptId，旧看门狗作废', () => {
    const host = makeHost();
    const first = installBootDiagnostics(host, { releaseId: 'r-a', watchdogMs: 0 });
    expect(first.snapshot().attemptId).toBe(1);
    const second = installBootDiagnostics(host, { releaseId: 'r-a', watchdogMs: 0 });
    expect(second.snapshot().attemptId).toBe(2);
  });

  it('BOOT_STAGES 顺序覆盖 entry→interactive', () => {
    expect(BOOT_STAGES[0]).toBe('entry');
    expect(BOOT_STAGES[BOOT_STAGES.length - 1]).toBe('interactive');
  });
});
