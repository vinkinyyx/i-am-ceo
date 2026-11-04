import { installBootDiagnostics, type BootStage } from '../../core/platform/bootDiagnostics';
import type { BootDiagnosticsSnapshot } from '../../core/platform/bootDiagnostics';

/**
 * R03：把引擎前诊断核心接到 Cocos/小游戏宿主。
 * - 引擎前阶段（entry/adapter/polyfills/modules）由构建注入片段打点（R20）；
 * - 引擎后的 engine/scene/config/save/interactive 由 AppView.start 调用本控制器。
 * releaseId 由注入片段写入 globalThis.__CEO_RELEASE_ID__；缺省用 'dev'。
 */
declare const globalThis: {
  __CEO_RELEASE_ID__?: string;
  __CEO_BOOT_DIAG_INSTALLED__?: boolean;
  addEventListener?: (type: string, cb: (e: unknown) => void) => void;
  console?: Console;
};

export interface CocosBootController {
  begin(stage: BootStage): void;
  end(stage: BootStage): void;
  fail(code: string, stage: BootStage, message: string): void;
  markInteractive(): void;
  snapshot(): BootDiagnosticsSnapshot;
}

let controller: CocosBootController | null = null;

export function getBootController(): CocosBootController | null {
  return controller;
}

export function initCocosBootDiagnostics(releaseId?: string): CocosBootController {
  const injected =
    typeof globalThis !== 'undefined' ? globalThis.__CEO_RELEASE_ID__ : undefined;
  const id = releaseId ?? injected ?? 'dev';
  const diag = installBootDiagnostics(
    {
      now: () => Date.now(),
      setTimeout: (fn, ms) => setTimeout(fn, ms) as unknown as number,
      clearTimeout: (idTimer) => clearTimeout(idTimer),
      console: typeof globalThis !== 'undefined' ? globalThis.console : undefined,
      onError(handler) {
        try {
          globalThis.addEventListener?.('error', (e: unknown) => {
            const ev = e as { message?: string; error?: Error };
            handler(ev.error?.message ?? ev.message ?? String(e));
          });
          globalThis.addEventListener?.('unhandledrejection', (e: unknown) => {
            const ev = e as { reason?: unknown };
            handler(ev.reason instanceof Error ? ev.reason.message : String(ev.reason ?? e));
          });
        } catch {
          /* 宿主不支持全局监听时仅保留看门狗与显式 fail */
        }
      },
      onUnhandledRejection(handler) {
        try {
          globalThis.addEventListener?.('unhandledrejection', (e: unknown) => {
            const ev = e as { reason?: unknown };
            handler(ev.reason instanceof Error ? ev.reason.message : String(ev.reason ?? e));
          });
        } catch {
          /* ignore */
        }
      },
    },
    { releaseId: id, watchdogMs: 12000 },
  );
  controller = {
    begin: (stage) => diag.beginStage(stage),
    end: (stage) => diag.endStage(stage),
    fail: (code, stage, message) => diag.fail(code, stage, message),
    markInteractive: () => diag.markInteractive(),
    snapshot: () => diag.snapshot(),
  };
  return controller;
}
