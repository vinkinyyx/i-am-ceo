import { GameError, GameErrorCode } from '../domain/errors';
import type {
  ITapPlatform,
  LoginResult,
  NetworkState,
  PlatformHttpRequest,
  PlatformHttpResponse,
  Unsubscribe,
  WindowInfo,
} from './ITapPlatform';

/**
 * TapTap 小游戏真机平台实现（设计文档 08.2 / 08.3）。
 * - 调用 globalThis.tap 的 tap.* API；签名以官方适配扩展
 *   extensions/taptap-minigame-tools/tap-minigame.d.ts 为准，不臆造 d.ts 之外的 API。
 * - 平台原始异常一律转换为领域错误（GameError），原始 errMsg 只进 details 供诊断，
 *   禁止把平台异常对象泄漏到上层/玩家页面。
 * - 存储写入前做 UTF-8 字节估算，超预算抛 SAVE_FAILED 且不落盘。
 */

// ---------------------------------------------------------------- tap 运行时最小结构子集
// 仅声明本实现用到的 API，签名与 tap-minigame.d.ts 保持一致。

export interface TapCallbackResult {
  errMsg?: string;
  errCode?: number;
  errno?: number;
}

export interface TapSuccessFailCallback<T = unknown> {
  success?: (res: T) => void;
  fail?: (res: TapCallbackResult) => void;
  complete?: () => void;
}

export interface TapWindowInfoResult {
  pixelRatio: number;
  screenWidth: number;
  screenHeight: number;
  windowWidth: number;
  windowHeight: number;
  statusBarHeight: number;
  safeArea: {
    left: number;
    right: number;
    top: number;
    bottom: number;
    width: number;
    height: number;
  };
}

export interface TapRuntime {
  getWindowInfo(): TapWindowInfoResult;
  onShow(callback: (res: unknown) => void): void;
  offShow(callback?: (res: unknown) => void): void;
  onHide(callback: () => void): void;
  offHide(callback?: () => void): void;
  /** 窗口尺寸变化（R24）；旧运行时可能缺失，故为可选，不进 REQUIRED_METHODS。 */
  onWindowResize?(callback: (res: { windowWidth: number; windowHeight: number }) => void): void;
  offWindowResize?(callback?: (res: { windowWidth: number; windowHeight: number }) => void): void;
  getStorage(params: { key: string } & TapSuccessFailCallback<{ data: unknown }>): void;
  setStorage(params: { key: string; data: unknown } & TapSuccessFailCallback): void;
  removeStorage(params: { key: string } & TapSuccessFailCallback): void;
  login(params?: { timeout?: number } & TapSuccessFailCallback<{ code: string }>): void;
  getNetworkType(params?: TapSuccessFailCallback<{ networkType: string }>): void;
  request(params: {
    url: string;
    data?: unknown;
    header?: Record<string, string>;
    method?: string;
    timeout?: number;
  } & TapSuccessFailCallback<{ data: unknown; statusCode: number; header?: unknown }>): {
    abort?: () => void;
  };
}

const REQUIRED_METHODS = [
  'getWindowInfo',
  'onShow',
  'offShow',
  'onHide',
  'offHide',
  'getStorage',
  'setStorage',
  'removeStorage',
  'login',
  'getNetworkType',
  'request',
] as const;

/**
 * 探测当前是否处于 TapTap 小游戏真机运行时。
 * 编辑器 / web 预览 / 单测环境没有 tap 全局或方法不全时返回 null。
 */
export function resolveTapRuntime(host: unknown = globalThis): TapRuntime | null {
  if (!host || typeof host !== 'object') return null;
  const tap = (host as { tap?: unknown }).tap;
  if (!tap || typeof tap !== 'object') return null;
  for (const method of REQUIRED_METHODS) {
    if (typeof (tap as Record<string, unknown>)[method] !== 'function') return null;
  }
  return tap as TapRuntime;
}

/** 单 key 硬预算（设计文档 08.3：官方上限 1MB；业务 slot 目标 <500KB 由 SaveRepository 把关）。 */
export const TAP_STORAGE_MAX_KEY_BYTES = 1_000_000;

export interface TapPlatformOptions {
  /** 单 key 写入预算（字节），默认 1MB。 */
  maxKeyBytes?: number;
  /** tap.login 超时参数（毫秒），不传则不设置。 */
  loginTimeoutMs?: number;
  /** 存储类回调操作的最大等待（毫秒），默认 3000；超时按降级语义处理（读=null/写=SAVE_FAILED）。 */
  opTimeoutMs?: number;
  /** login 回调的最大等待（毫秒），默认 10000；超时抛 AUTH_REQUIRED。 */
  loginCallbackTimeoutMs?: number;
}

const DEFAULT_OP_TIMEOUT_MS = 3000;
const LOGIN_CALLBACK_TIMEOUT_MS = 10000;

/**
 * 回调防挂死计时器（鸿蒙等运行时可能既不回 success 也不回 fail）。
 * 任一回调或超时先到者生效，后到者丢弃，保证 Promise 必定 settle。
 */
class CallbackGuard {
  private settled = false;
  private readonly timer: ReturnType<typeof setTimeout>;

  constructor(ms: number, private readonly onTimeout: () => void) {
    this.timer = setTimeout(() => this.fire(this.onTimeout), ms);
  }

  fire(action: () => void): void {
    if (this.settled) return;
    this.settled = true;
    clearTimeout(this.timer);
    action();
  }
}

/** UTF-8 字节数上界估算：代理对按 6 字节计（真实 4），高估更安全。 */
function estimateUtf8Bytes(text: string): number {
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else bytes += 3;
  }
  return bytes;
}

/** 提取平台回调/异常中的可诊断文本（只进 GameError.details，不进玩家文案）。 */
function describeCause(cause: unknown): string {
  if (cause && typeof cause === 'object') {
    const errMsg = (cause as TapCallbackResult).errMsg;
    if (typeof errMsg === 'string' && errMsg.length > 0) return errMsg;
  }
  if (cause instanceof Error) return cause.message;
  return String(cause);
}

function platformError(api: string, cause: unknown): GameError {
  return new GameError(GameErrorCode.PLATFORM_UNAVAILABLE, {
    api,
    cause: describeCause(cause),
  });
}

function saveError(api: string, key: string, cause: unknown): GameError {
  return new GameError(GameErrorCode.SAVE_FAILED, {
    api,
    key,
    cause: describeCause(cause),
  });
}

/** R10：读取类 IO/超时失败使用 SAVE_UNAVAILABLE，区别于已确认 missing（null）。 */
function saveUnavailable(
  api: string,
  key: string,
  reason: 'timeout' | 'io' | 'permission',
  cause: unknown,
): GameError {
  return new GameError(GameErrorCode.SAVE_UNAVAILABLE, {
    api,
    key,
    reason,
    cause: describeCause(cause),
  });
}

/** 各端对“key 不存在”的 fail 文案不统一，按子串容忍识别（缺失≠失败，读作 null）。 */
function isMissingKeyFailure(res: TapCallbackResult): boolean {
  const msg = res.errMsg ?? '';
  return msg.includes('data not found') || msg.includes('not exist') || msg.includes('not found');
}

/** R17/T06：诊断原因不得回显一次性 code/secret/token（这些只属于请求参数，不应出现在错误详情）。 */
function redactSecrets(text: string): string {
  return text
    .replace(/\bcode\s*[:=]\s*[^\s,}&]+/gi, 'code=***')
    .replace(/\b(secret|token|session[_-]?key|authorization|password)\s*[:=]\s*[^\s,}&]+/gi, '$1=***');
}

function mapNetworkType(networkType: unknown): NetworkState {
  if (typeof networkType !== 'string') return 'unknown';
  if (networkType === 'none') return 'offline';
  if (networkType === 'unknown') return 'unknown';
  return 'online';
}

export class TapPlatform implements ITapPlatform {
  private readonly tap: TapRuntime;
  private readonly maxKeyBytes: number;
  private readonly loginTimeoutMs?: number;
  private readonly opTimeoutMs: number;
  private readonly loginCallbackTimeoutMs: number;
  private unsettledNativeWrites = 0;

  /**
   * @param tap 注入的 tap 运行时（测试可注入假对象）；缺省探测 globalThis.tap。
   *            探测失败立即抛 PLATFORM_UNAVAILABLE（fail-fast，不进半可用状态）。
   */
  constructor(tap?: TapRuntime | null, options?: TapPlatformOptions) {
    const runtime = tap ?? resolveTapRuntime();
    if (!runtime) {
      throw new GameError(GameErrorCode.PLATFORM_UNAVAILABLE, {
        api: 'runtime',
        cause: 'globalThis.tap missing or incomplete',
      });
    }
    this.tap = runtime;
    this.maxKeyBytes = options?.maxKeyBytes ?? TAP_STORAGE_MAX_KEY_BYTES;
    this.loginTimeoutMs = options?.loginTimeoutMs;
    this.opTimeoutMs = options?.opTimeoutMs ?? DEFAULT_OP_TIMEOUT_MS;
    this.loginCallbackTimeoutMs = options?.loginCallbackTimeoutMs ?? LOGIN_CALLBACK_TIMEOUT_MS;
  }

  getEnvironment(): 'TAPTAP' {
    return 'TAPTAP';
  }

  hasUnsettledNativeWrites(): boolean {
    return this.unsettledNativeWrites > 0;
  }

  getWindowInfo(): WindowInfo {
    let info: TapWindowInfoResult;
    try {
      info = this.tap.getWindowInfo();
    } catch (err) {
      throw platformError('getWindowInfo', err);
    }
    return {
      width: info.windowWidth,
      height: info.windowHeight,
      pixelRatio: info.pixelRatio,
      safeArea: info.safeArea
        ? {
            top: info.safeArea.top,
            bottom: info.safeArea.bottom,
            left: info.safeArea.left,
            right: info.safeArea.right,
          }
        : undefined,
    };
  }

  onShow(callback: () => void): Unsubscribe {
    this.tap.onShow(callback);
    let active = true;
    return () => {
      // 幂等退订：热重载/重复清理时只对平台退订一次（设计文档 08.2）
      if (!active) return;
      active = false;
      this.tap.offShow(callback);
    };
  }

  onHide(callback: () => void): Unsubscribe {
    this.tap.onHide(callback);
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      this.tap.offHide(callback);
    };
  }

  /**
   * R24：窗口/安全区变化 → 重新取完整 WindowInfo 通知 UI 重排。
   * 旧运行时无 onWindowResize 时退化为 no-op（UI 层有 view 级 canvas-resize 兜底）。
   */
  onWindowResize(callback: (info: WindowInfo) => void): Unsubscribe {
    if (typeof this.tap.onWindowResize !== 'function') return () => undefined;
    const handler = () => {
      try {
        callback(this.getWindowInfo());
      } catch {
        // 布局数据瞬时不可得不阻断平台回调；下一帧 view 级事件仍会兜底
      }
    };
    this.tap.onWindowResize(handler);
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      this.tap.offWindowResize?.(handler);
    };
  }

  login(): Promise<LoginResult> {
    return new Promise((resolve, reject) => {
      const guard = new CallbackGuard(this.loginCallbackTimeoutMs, () =>
        reject(
          new GameError(GameErrorCode.AUTH_REQUIRED, {
            api: 'login',
            cause: 'login callback timeout (runtime did not respond)',
          }),
        ),
      );
      const params: { timeout?: number } & TapSuccessFailCallback<{ code: string }> = {
        success: (res) =>
          guard.fire(() => {
            if (res && typeof res.code === 'string' && res.code.length > 0) {
              resolve({ code: res.code });
            } else {
              reject(
                new GameError(GameErrorCode.AUTH_REQUIRED, {
                  api: 'login',
                  cause: 'login succeeded but returned empty code',
                }),
              );
            }
          }),
        fail: (res) =>
          guard.fire(() =>
            reject(
              new GameError(GameErrorCode.AUTH_REQUIRED, {
                api: 'login',
                cause: redactSecrets(describeCause(res)),
              }),
            ),
          ),
      };
      if (this.loginTimeoutMs !== undefined) params.timeout = this.loginTimeoutMs;
      try {
        this.tap.login(params);
      } catch (err) {
        guard.fire(() =>
          reject(
            new GameError(GameErrorCode.AUTH_REQUIRED, {
              api: 'login',
              cause: describeCause(err),
            }),
          ),
        );
      }
    });
  }

  getNetworkState(): Promise<NetworkState> {
    // 网络探测失败不视为错误：接口本身提供 'unknown' 语义；超时也降级为 unknown
    return new Promise((resolve) => {
      const guard = new CallbackGuard(this.opTimeoutMs, () => resolve('unknown'));
      try {
        this.tap.getNetworkType({
          success: (res) => guard.fire(() => resolve(mapNetworkType(res ? res.networkType : undefined))),
          fail: () => guard.fire(() => resolve('unknown')),
        });
      } catch {
        guard.fire(() => resolve('unknown'));
      }
    });
  }

  get<T>(key: string): Promise<T | null> {
    return new Promise((resolve, reject) => {
      // R10/REL-04：超时/无回调必须 reject SAVE_UNAVAILABLE(timeout)，
      // 绝不能 resolve(null) 把“暂时不可读”冒充成“确认无档”，
      // 否则启动层会误入首建并把活动档切到新 run（§14.5 复现事故）。
      const guard = new CallbackGuard(this.opTimeoutMs, () =>
        reject(
          new GameError(GameErrorCode.SAVE_UNAVAILABLE, {
            api: 'getStorage',
            key,
            reason: 'timeout',
            cause: 'getStorage callback timeout (runtime did not respond)',
          }),
        ),
      );
      try {
        this.tap.getStorage({
          key,
          success: (res) =>
            guard.fire(() => {
              if (res === undefined || res === null) {
                // R10：success 但载荷结构非法，按错误处理，不任意判空
                reject(
                  new GameError(GameErrorCode.SAVE_UNAVAILABLE, {
                    api: 'getStorage',
                    key,
                    reason: 'io',
                    cause: 'success callback without response envelope',
                  }),
                );
                return;
              }
              const data = res.data;
              // 缺失 key 的平台表现之一：成功回调但空值，统一读作 null（已确认不存在）
              if (data === undefined || data === null || data === '') {
                resolve(null);
              } else {
                resolve(data as T);
              }
            }),
          fail: (res) =>
            guard.fire(() => {
              if (isMissingKeyFailure(res)) {
                resolve(null);
              } else {
                reject(saveUnavailable('getStorage', key, 'io', res));
              }
            }),
        });
      } catch (err) {
        guard.fire(() => reject(saveUnavailable('getStorage', key, 'io', err)));
      }
    });
  }

  set<T>(key: string, data: T): Promise<void> {
    // 写前预算（设计文档 08.3）：超预算不落盘，details 带 key/字节数/预算供诊断
    let bytes: number;
    try {
      const json = JSON.stringify(data);
      bytes = json === undefined ? 0 : estimateUtf8Bytes(json);
    } catch (err) {
      return Promise.reject(
        new GameError(GameErrorCode.SAVE_FAILED, {
          api: 'setStorage',
          key,
          cause: `serialize failed: ${describeCause(err)}`,
        }),
      );
    }
    if (bytes > this.maxKeyBytes) {
      return Promise.reject(
        new GameError(GameErrorCode.SAVE_FAILED, {
          api: 'setStorage',
          key,
          bytes,
          budgetBytes: this.maxKeyBytes,
          cause: `payload ${bytes}B exceeds per-key budget ${this.maxKeyBytes}B`,
        }),
      );
    }
    return this.trackedNativeWrite('setStorage', key, (callbacks) => {
      this.tap.setStorage({ key, data, ...callbacks });
    });
  }

  remove(key: string): Promise<void> {
    // Cleanup keeps its best-effort timeout result, while the write fence
    // remains raised until the host confirms the native remove has settled.
    return this.trackedNativeWrite('removeStorage', key, (callbacks) => {
      this.tap.removeStorage({ key, ...callbacks });
    }, true);
  }

  private trackedNativeWrite(
    api: 'setStorage' | 'removeStorage',
    key: string,
    start: (callbacks: TapSuccessFailCallback) => void,
    timeoutIsSuccess = false,
  ): Promise<void> {
    this.unsettledNativeWrites += 1;
    let nativeSettled = false;
    const settleNative = (): void => {
      if (nativeSettled) return;
      nativeSettled = true;
      this.unsettledNativeWrites = Math.max(0, this.unsettledNativeWrites - 1);
    };
    return new Promise((resolve, reject) => {
      const guard = new CallbackGuard(this.opTimeoutMs, () => {
        if (timeoutIsSuccess) resolve();
        else reject(new GameError(GameErrorCode.SAVE_FAILED, {
          api,
          key,
          cause: `${api} callback timeout (native operation may still be pending)`,
        }));
      });
      try {
        start({
          success: () => {
            settleNative();
            guard.fire(() => resolve());
          },
          fail: (res) => {
            settleNative();
            guard.fire(() => reject(saveError(api, key, res)));
          },
        });
      } catch (err) {
        settleNative();
        guard.fire(() => reject(saveError(api, key, err)));
      }
    });
  }

  request<T = unknown>(req: PlatformHttpRequest): Promise<PlatformHttpResponse<T>> {
    const timeoutMs = req.timeoutMs ?? Math.max(this.opTimeoutMs, 5000);
    return new Promise((resolve, reject) => {
      const guard = new CallbackGuard(timeoutMs, () =>
        reject(platformError('request', `timeout after ${timeoutMs}ms`)),
      );
      try {
        this.tap.request({
          url: req.url,
          method: req.method ?? 'GET',
          data: req.data,
          header: req.headers,
          timeout: timeoutMs,
          success: (res) =>
            guard.fire(() => resolve({ statusCode: res.statusCode, data: res.data as T })),
          fail: (res) => guard.fire(() => reject(platformError('request', res))),
        });
      } catch (err) {
        guard.fire(() => reject(platformError('request', err)));
      }
    });
  }
}
