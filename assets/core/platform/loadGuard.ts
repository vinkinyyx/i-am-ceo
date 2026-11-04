/**
 * R07：资源/配置加载守卫（§14.4 / §15.4 R07）。
 * - 必需资源失败必须阻断业务并给出错误码（不留下黑屏）；
 * - 可选资源失败回落默认值并记录原因；
 * - 回调/ Promise 限时且只 settle 一次，迟到结果不能复活旧尝试；
 * - 每次尝试有 attemptId，取消后迟到回调忽略。
 * 纯 TS、宿主无关（注入时钟）。
 */

export type LoadErrorCode =
  | 'RESOURCE_NOT_FOUND'
  | 'RESOURCE_TIMEOUT'
  | 'RESOURCE_INVALID'
  | 'RESOURCE_FAILED';

export class ResourceLoadError extends Error {
  constructor(
    readonly code: LoadErrorCode,
    readonly resource: string,
    readonly attemptId: number,
    causeMessage?: string,
  ) {
    super(`load ${resource} failed: ${code}${causeMessage ? ` (${causeMessage})` : ''}`);
    this.name = 'ResourceLoadError';
  }
}

export interface GuardScheduler {
  setTimeout(fn: () => void, ms: number): number;
  clearTimeout(id: number): void;
  now(): number;
}

export const defaultScheduler: GuardScheduler = {
  setTimeout: (fn, ms) => setTimeout(fn, ms) as unknown as number,
  clearTimeout: (id) => clearTimeout(id),
  now: () => Date.now(),
};

export interface LoadHandle<T> {
  promise: Promise<T>;
  attemptId: number;
  cancel(reason?: string): void;
}

/**
 * 包装一个回调式资源加载。
 * @param required true=失败/超时抛 ResourceLoadError；false=失败回落 fallback 并记录。
 */
export function guardResourceLoad<T>(
  resource: string,
  options: {
    required: boolean;
    timeoutMs: number;
    start: (sink: {
      succeed(value: T): void;
      fail(cause: unknown, code?: LoadErrorCode): void;
    }) => void;
    fallback?: () => T;
    onRecoverable?: (info: { resource: string; code: LoadErrorCode; cause?: string }) => void;
    scheduler?: GuardScheduler;
  },
): LoadHandle<T> {
  const scheduler = options.scheduler ?? defaultScheduler;
  const attemptId = nextAttempt();
  let settled = false;
  let cancelled = false;
  let timer: number | null = scheduler.setTimeout(() => {
    timer = null;
    finish.fail(new ResourceLoadError('RESOURCE_TIMEOUT', resource, attemptId));
  }, options.timeoutMs);

  const cleanup = (): void => {
    if (timer !== null) scheduler.clearTimeout(timer);
    timer = null;
  };

  const finish = {
    succeed(value: T): void {
      if (settled || cancelled) return;
      settled = true;
      cleanup();
      resolve(value);
    },
    fail(cause: unknown, code?: LoadErrorCode): void {
      if (settled || cancelled) return;
      settled = true;
      cleanup();
      const causeMessage = cause instanceof Error ? cause.message : cause === undefined ? undefined : String(cause);
      const errorCode: LoadErrorCode = code ?? inferCode(cause);
      if (options.required) {
        reject(new ResourceLoadError(errorCode, resource, attemptId, causeMessage));
        return;
      }
      options.onRecoverable?.({ resource, code: errorCode, cause: causeMessage });
      try {
        resolve(options.fallback ? options.fallback() : (undefined as T));
      } catch (fallbackErr) {
        reject(fallbackErr);
      }
    },
  };

  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  try {
    options.start({
      succeed: finish.succeed,
      fail: (cause, code) => finish.fail(cause, code),
    });
  } catch (err) {
    finish.fail(err, 'RESOURCE_FAILED');
  }

  return {
    promise,
    attemptId,
    cancel: () => {
      if (cancelled || settled) return;
      cancelled = true;
      cleanup();
    },
  };
}

function inferCode(cause: unknown): LoadErrorCode {
  if (cause instanceof ResourceLoadError) return cause.code;
  const msg = cause instanceof Error ? cause.message : String(cause ?? '');
  if (/not\s*found|404|missing|does not exist/i.test(msg)) return 'RESOURCE_NOT_FOUND';
  if (/timeout|timed?\s*out/i.test(msg)) return 'RESOURCE_TIMEOUT';
  if (/invalid|parse|json|schema|校验/i.test(msg)) return 'RESOURCE_INVALID';
  return 'RESOURCE_FAILED';
}

let attemptCounter = 0;
function nextAttempt(): number {
  attemptCounter += 1;
  return attemptCounter;
}

/** 测试辅助：重置 attempt 计数。 */
export function __resetLoadAttemptsForTest(): void {
  attemptCounter = 0;
}
