/**
 * R06：initApp 帧调度与单次启动（§15.3.3）。
 *
 * 纯 TS、引擎无关。解决：
 * - rAF 缺失：定时器兜底仍进入 init；
 * - rAF 仅注册不回调（部分小游戏容器真实案例）：定时兜底触发；
 * - rAF 与定时器都回调：once guard 保证 initCount===1；
 * - init 抛错：只抛一次并 reject，不重复初始化；
 * - 迟到回调：在完成/取消后全部忽略。
 */

export interface FrameSchedulerHost {
  now(): number;
  requestAnimationFrame?(cb: (t: number) => void): number;
  cancelAnimationFrame?(id: number): void;
  setTimeout(fn: () => void, ms: number): number;
  clearTimeout(id: number): void;
}

export interface OnceInitOptions {
  /** 等待多少帧（rAF 可用时），默认 1。 */
  requiredFrames?: number;
  /** 定时兜底毫秒，默认 120；必须 >0。 */
  fallbackMs?: number;
}

export interface OnceInitHandle<T> {
  promise: Promise<T>;
  initCount: () => number;
  /** 取消本次启动尝试（attempt 作废，迟到回调忽略）。 */
  cancel: () => void;
}

/**
 * 以 once 语义执行 init：rAF 路径与定时兜底竞速，先到先得。
 */
export function startOnceInit<T>(
  host: FrameSchedulerHost,
  init: () => T | Promise<T>,
  options: OnceInitOptions = {},
): OnceInitHandle<T> {
  const requiredFrames = Math.max(1, options.requiredFrames ?? 1);
  const fallbackMs = Math.max(0, options.fallbackMs ?? 120);
  let settled = false;
  let cancelled = false;
  let count = 0;
  let rafId: number | null = null;
  let timerId: number | null = null;
  let framesSeen = 0;

  const cleanup = (): void => {
    if (rafId !== null && typeof host.cancelAnimationFrame === 'function') {
      host.cancelAnimationFrame(rafId);
    }
    if (timerId !== null) host.clearTimeout(timerId);
    rafId = null;
    timerId = null;
  };

  const run = async (resolve: (v: T) => void, reject: (e: unknown) => void): Promise<void> => {
    if (settled || cancelled) return;
    settled = true;
    count += 1;
    cleanup();
    try {
      resolve(await init());
    } catch (err) {
      reject(err);
    }
  };

  const promise = new Promise<T>((resolve, reject) => {
    const trigger = (): void => {
      void run(resolve, reject);
    };

    timerId = host.setTimeout(() => {
      timerId = null;
      trigger();
    }, fallbackMs);

    if (typeof host.requestAnimationFrame === 'function') {
      const onFrame = (): void => {
        framesSeen += 1;
        if (settled || cancelled) return;
        if (framesSeen >= requiredFrames) {
          trigger();
          return;
        }
        rafId = host.requestAnimationFrame!(onFrame);
      };
      try {
        rafId = host.requestAnimationFrame(onFrame);
      } catch {
        // rAF 注册抛错：保留定时兜底
        rafId = null;
      }
    }
  });

  return {
    promise,
    initCount: () => count,
    cancel: () => {
      if (cancelled || settled) return;
      cancelled = true;
      cleanup();
    },
  };
}

/**
 * 平台分流：按实际运行时能力，而不是品牌字符串。
 * 小游戏容器特征不明确时返回 'unknown'，由上层按保守路径处理。
 */
export type PlatformRuntimeKind = 'taptap' | 'wx' | 'web' | 'unknown';

export function detectRuntimeKind(host: {
  tap?: unknown;
  wx?: unknown;
  window?: unknown;
  document?: unknown;
}): PlatformRuntimeKind {
  if (host.tap && typeof host.tap === 'object') return 'taptap';
  if (host.wx && typeof host.wx === 'object') return 'wx';
  if (host.window !== undefined && host.document !== undefined) return 'web';
  return 'unknown';
}
