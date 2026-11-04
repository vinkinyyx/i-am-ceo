/**
 * R03/R06：引擎前启动诊断与状态机（§14.4）。
 *
 * 纯 TS、无 Cocos/DOM 依赖：构建时被注入到转换后 game.js 的最前面，
 * 在 import web-adapter / 业务模块之前安装。宿主侧只需提供：
 *  - now(): 毫秒时间戳
 *  - setTimeout/clearTimeout（可选，缺失时看门狗不启用）
 *  - console（可选）、onError/onUnhandledRejection 注册器（可选）
 *
 * 阶段（entry→interactive）：
 *   entry → adapter → polyfills → modules → engine → scene → config → save → interactive
 * ready 只能由显式 markInteractive()（UI 已建好且事件已绑定）确认，
 * 引擎 init 成功不等于 interactive。
 *
 * 诊断缓冲有界（≤30 条、每条 ≤300 字符），并屏蔽 code/token/存档正文。
 */

export type BootStage =
  | 'entry'
  | 'adapter'
  | 'polyfills'
  | 'modules'
  | 'engine'
  | 'scene'
  | 'config'
  | 'save'
  | 'interactive';

export const BOOT_STAGES: BootStage[] = [
  'entry',
  'adapter',
  'polyfills',
  'modules',
  'engine',
  'scene',
  'config',
  'save',
  'interactive',
];

export interface BootStageEvent {
  stage: BootStage;
  phase: 'start' | 'end';
  t: number;
  attemptId: number;
}

export interface BootFailure {
  code: string;
  stage: BootStage;
  message: string;
  t: number;
  attemptId: number;
}

export interface BootDiagnosticsSnapshot {
  releaseId: string;
  attemptId: number;
  stage: BootStage;
  ready: boolean;
  events: BootStageEvent[];
  failures: BootFailure[];
}

export interface BootHost {
  now(): number;
  setTimeout?(fn: () => void, ms: number): number;
  clearTimeout?(id: number): void;
  console?: { log?(...args: unknown[]): void; error?(...args: unknown[]): void };
  onError?(handler: (message: string) => void): void;
  onUnhandledRejection?(handler: (reason: string) => void): void;
}

const MAX_EVENTS = 30;
const MAX_MESSAGE = 300;
// 屏蔽敏感键及其后的值（值取到空白/分隔符；payload 取整段 JSON 对象），兼容引号与裸键
const SENSITIVE_PATTERNS: RegExp[] = [
  /\b(session[_-]?key|secret|token|authorization|password|checksum|code)\s*[:=]\s*[^\s,}&]+/gi,
  /\bpayload\s*[:=]\s*\{[\s\S]*?\}/gi,
  /"(?:payload|checksum|sessionKey|session_key|secret|token|code)"\s*:\s*(?:"[^"]*"|\{[\s\S]*?\}|\[[\s\S]*?\]|[^,}\s]+)/gi,
];

function sanitize(message: string): string {
  let text = String(message);
  for (const re of SENSITIVE_PATTERNS) {
    text = text.replace(re, (m) => {
      const cut = m.indexOf(':');
      const eq = m.indexOf('=');
      const sep = cut >= 0 && (eq < 0 || cut < eq) ? cut : eq;
      return sep >= 0 ? `${m.slice(0, sep + 1)}***` : `${m.slice(0, 3)}***`;
    });
  }
  return text.length > MAX_MESSAGE ? `${text.slice(0, MAX_MESSAGE)}…` : text;
}

let current: BootDiagnosticsState | null = null;

class BootDiagnosticsState {
  readonly events: BootStageEvent[] = [];
  readonly failures: BootFailure[] = [];
  stage: BootStage = 'entry';
  ready = false;
  private watchdog: number | null = null;

  constructor(
    readonly releaseId: string,
    readonly attemptId: number,
    private readonly host: BootHost,
    private readonly watchdogMs: number,
  ) {}

  startWatchdog(onTimeout: (snapshot: BootDiagnosticsSnapshot) => void): void {
    if (typeof this.host.setTimeout !== 'function' || this.watchdogMs <= 0) return;
    this.watchdog = this.host.setTimeout(() => {
      this.watchdog = null;
      if (this.ready) return;
      this.fail('BOOT_WATCHDOG_TIMEOUT', this.stage, `stage ${this.stage} did not finish`);
      onTimeout(this.snapshot());
    }, this.watchdogMs);
  }

  stopWatchdog(): void {
    if (this.watchdog !== null && typeof this.host.clearTimeout === 'function') {
      this.host.clearTimeout(this.watchdog);
    }
    this.watchdog = null;
  }

  begin(stage: BootStage): void {
    if (this.ready) return;
    this.stage = stage;
    this.pushEvent({ stage, phase: 'start', t: this.host.now(), attemptId: this.attemptId });
  }

  end(stage: BootStage): void {
    if (this.ready) return;
    this.pushEvent({ stage, phase: 'end', t: this.host.now(), attemptId: this.attemptId });
    this.host.console?.log?.(`[boot] ${stage} end`);
  }

  fail(code: string, stage: BootStage, message: string): void {
    const safe = sanitize(message);
    this.failures.push({ code, stage, message: safe, t: this.host.now(), attemptId: this.attemptId });
    if (this.failures.length > MAX_EVENTS) this.failures.shift();
    this.host.console?.error?.(`[boot:error] ${code} @ ${stage}: ${safe}`);
  }

  markReady(): void {
    this.ready = true;
    this.stopWatchdog();
    this.pushEvent({ stage: 'interactive', phase: 'end', t: this.host.now(), attemptId: this.attemptId });
    this.stage = 'interactive';
  }

  snapshot(): BootDiagnosticsSnapshot {
    return {
      releaseId: this.releaseId,
      attemptId: this.attemptId,
      stage: this.stage,
      ready: this.ready,
      events: [...this.events],
      failures: [...this.failures],
    };
  }

  private pushEvent(e: BootStageEvent): void {
    this.events.push(e);
    if (this.events.length > MAX_EVENTS) this.events.shift();
  }
}

export interface InstallOptions {
  releaseId: string;
  attemptId?: number;
  watchdogMs?: number;
  onTimeout?: (snapshot: BootDiagnosticsSnapshot) => void;
}

/**
 * 安装引擎前诊断（幂等；新 attemptId 视为重试，重置状态并作废旧看门狗）。
 * 返回控制器供启动链打点。
 */
export function installBootDiagnostics(host: BootHost, options: InstallOptions): {
  beginStage(stage: BootStage): void;
  endStage(stage: BootStage): void;
  fail(code: string, stage: BootStage, message: string): void;
  markInteractive(): void;
  snapshot(): BootDiagnosticsSnapshot;
} {
  const attemptId = options.attemptId ?? (current ? current.attemptId + 1 : 1);
  current?.stopWatchdog();
  const state = new BootDiagnosticsState(
    options.releaseId,
    attemptId,
    host,
    options.watchdogMs ?? 8000,
  );
  current = state;

  host.onError?.((message) => state.fail('HOST_ERROR', state.ready ? 'interactive' : state.stage, message));
  host.onUnhandledRejection?.((reason) =>
    state.fail('UNHANDLED_REJECTION', state.ready ? 'interactive' : state.stage, reason),
  );

  state.begin('entry');
  state.end('entry');
  state.startWatchdog(options.onTimeout ?? (() => undefined));

  return {
    beginStage: (stage) => state.begin(stage),
    endStage: (stage) => state.end(stage),
    fail: (code, stage, message) => state.fail(code, stage, message),
    markInteractive: () => state.markReady(),
    snapshot: () => state.snapshot(),
  };
}

/** 全局诊断句柄键名（注入到 globalThis，不污染业务状态）。 */
export const BOOT_DIAG_GLOBAL_KEY = '__CEO_BOOT_DIAG__';

export function getBootSnapshot(): BootDiagnosticsSnapshot | null {
  return current?.snapshot() ?? null;
}

/** 仅测试使用：重置模块单例（真实启动链每进程只安装一次，无需调用）。 */
export function __resetBootDiagnosticsForTest(): void {
  current?.stopWatchdog();
  current = null;
}
