/**
 * R02 故障夹具：存储/回调宿主/宿主能力/旧档构造。
 * 供 R04/R05/R10—R14 等回归共用，禁止各任务各写一份假平台。
 * 仅测试侧使用（不得被 assets/ 生产代码引用）。
 */
import { SAVE_KEYS, type ResetTombstone, type SaveEnvelope, type SavePointer } from '@core/persistence/SaveTypes';
import { SaveRepository } from '@core/persistence/SaveRepository';
import { encodeEnvelope } from '@core/persistence/SaveCodec';
import type { GameState } from '@core/domain/types';
import type { IStorageBackend } from '@core/platform/ITapPlatform';
import type {
  TapRuntime,
  TapSuccessFailCallback,
  TapCallbackResult,
  TapWindowInfoResult,
} from '@core/platform/TapPlatform';

// ---------------------------------------------------------------- 受控调度
export type Scheduler = {
  setTimeout: (fn: () => void, ms: number) => number;
  clearTimeout: (id: number) => void;
};

export const immediateScheduler: Scheduler = {
  setTimeout: (fn) => {
    fn();
    return 0;
  },
  clearTimeout: () => undefined,
};

// ------------------------------------------------- IStorageBackend 故障后端
export type StorageFault =
  | { kind: 'reject'; reason: 'timeout' | 'io' | 'permission'; error?: Error }
  | { kind: 'hang' } // 永不 settle（平台回调不响应）
  | { kind: 'corrupt-raw'; raw: unknown }; // 返回无法通过校验的原始值

/**
 * 脚本化 IStorageBackend：
 * - 默认行为等价于内存 KV；null 仅表示“已确认不存在”。
 * - 每个 key 可安排 get/set/remove 的故障脚本；脚本按调用次数消耗。
 * - 记录每次调用，供断言“迟到结果不得发起写入”等时序问题。
 */
export class ScriptedStorage implements IStorageBackend {
  private readonly data = new Map<string, unknown>();
  private readonly getScript = new Map<string, StorageFault[]>();
  private readonly setScript = new Map<string, StorageFault[]>();
  readonly getCalls: Array<{ key: string; at: number }> = [];
  readonly setCalls: Array<{ key: string; at: number }> = [];
  readonly removeCalls: Array<{ key: string; at: number }> = [];
  private tick = 0;

  seed(key: string, value: unknown): this {
    this.data.set(key, value);
    return this;
  }

  seedPointer(pointer: SavePointer): this {
    return this.seed(SAVE_KEYS.active, pointer);
  }

  onGet(key: string, ...faults: StorageFault[]): this {
    this.getScript.set(key, faults);
    return this;
  }

  onSet(key: string, ...faults: StorageFault[]): this {
    this.setScript.set(key, faults);
    return this;
  }

  private consume(script: Map<string, StorageFault[]>, key: string): StorageFault | undefined {
    const queue = script.get(key);
    if (!queue || queue.length === 0) return undefined;
    const next = queue.shift()!;
    if (queue.length === 0) script.delete(key);
    return next;
  }

  async get<T>(key: string): Promise<T | null> {
    const at = this.tick++;
    this.getCalls.push({ key, at });
    const fault = this.consume(this.getScript, key);
    if (fault) return applyFault(fault, `get:${key}`);
    return (this.data.has(key) ? (this.data.get(key) as T) : null);
  }

  async set<T>(key: string, value: T): Promise<void> {
    const at = this.tick++;
    this.setCalls.push({ key, at });
    const fault = this.consume(this.setScript, key);
    if (fault) return applyFault(fault, `set:${key}`);
    this.data.set(key, value);
  }

  async remove(key: string): Promise<void> {
    const at = this.tick++;
    this.removeCalls.push({ key, at });
    this.data.delete(key);
  }

  /** 测试辅助：窥视原始值（不经过故障脚本）。 */
  peek<T>(key: string): T | null {
    return this.data.has(key) ? (this.data.get(key) as T) : null;
  }

  has(key: string): boolean {
    return this.data.has(key);
  }

  keys(): string[] {
    return [...this.data.keys()];
  }
}

function applyFault(fault: StorageFault, where: string): Promise<never> {
  switch (fault.kind) {
    case 'reject': {
      const err =
        fault.error ??
        new Error(`SAVE_UNAVAILABLE:${fault.reason}:${where}`);
      return Promise.reject(err);
    }
    case 'hang':
      return new Promise<never>(() => undefined);
    case 'corrupt-raw':
      return Promise.resolve(fault.raw as never);
    default:
      return Promise.reject(new Error(`unknown fault at ${where}`));
  }
}

// ------------------------------------------------------ tap.* 回调宿主脚本
export type TapApiName = 'getStorage' | 'setStorage' | 'removeStorage' | 'login' | 'getNetworkType';

export type TapInvocation =
  | { api: 'getStorage'; key: string }
  | { api: 'setStorage'; key: string; bytes: number }
  | { api: 'removeStorage'; key: string }
  | { api: 'login' }
  | { api: 'getNetworkType' };

export type TapResponseScript =
  | { type: 'success'; delayMs?: number }
  | { type: 'fail'; result?: TapCallbackResult; delayMs?: number }
  | { type: 'silent' } // success/fail 均不回调
  | { type: 'deferred' } // native storage mutation applies only when test releases it
  | { type: 'success-twice'; delayMs?: number }
  | { type: 'fail-then-success' }
  | { type: 'success-empty' };

/**
 * 脚本化 tap 运行时：可安排迟到/重复/乱序/不回调，调用记录完整。
 * 定时回调通过注入 scheduler 触发（默认真实 setTimeout，
 * 时序回归可注入受控时钟，禁止用固定 sleep 等待）。
 */
export class ScriptedTapRuntime implements TapRuntime {
  readonly invocations: TapInvocation[] = [];
  private readonly storage = new Map<string, unknown>();
  private scripts = new Map<string, TapResponseScript[]>();
  private readonly deferredSetCallbacks: Array<{ key: string; data: unknown; callback: TapSuccessFailCallback }> = [];
  window: TapWindowInfoResult = {
    pixelRatio: 3,
    screenWidth: 1080,
    screenHeight: 2400,
    windowWidth: 390,
    windowHeight: 844,
    statusBarHeight: 30,
    safeArea: { left: 0, right: 390, top: 30, bottom: 814, width: 390, height: 784 },
  };

  private readonly showListeners = new Set<(res: unknown) => void>();
  private readonly hideListeners = new Set<() => void>();

  constructor(private readonly scheduler: Scheduler = immediateScheduler) {}

  seedStorage(key: string, value: unknown): this {
    this.storage.set(key, value);
    return this;
  }

  /** 对指定 API 的第 N 次调用依次应用脚本；脚本耗尽后恢复“正常”行为。 */
  script(api: TapApiName, ...items: TapResponseScript[]): this {
    this.scripts.set(api, items);
    return this;
  }

  private next(api: TapApiName): TapResponseScript | undefined {
    const queue = this.scripts.get(api);
    if (!queue || queue.length === 0) return undefined;
    const item = queue.shift()!;
    if (queue.length === 0) this.scripts.delete(api);
    return item;
  }

  private schedule(delayMs: number | undefined, fn: () => void): void {
    if (delayMs && delayMs > 0) this.scheduler.setTimeout(fn, delayMs);
    else fn();
  }

  getWindowInfo(): TapWindowInfoResult {
    return this.window;
  }

  onShow(cb: (res: unknown) => void): void {
    this.showListeners.add(cb);
  }

  offShow(cb?: (res: unknown) => void): void {
    if (cb) this.showListeners.delete(cb);
  }

  onHide(cb: () => void): void {
    this.hideListeners.add(cb);
  }

  offHide(cb?: () => void): void {
    if (cb) this.hideListeners.delete(cb);
  }

  emitShow(): void {
    for (const cb of this.showListeners) cb({ query: {}, scene: 1001 });
  }

  emitHide(): void {
    for (const cb of this.hideListeners) cb();
  }

  getStorage(params: { key: string } & TapSuccessFailCallback<{ data: unknown }>): void {
    this.invocations.push({ api: 'getStorage', key: params.key });
    const script = this.next('getStorage');
    const failNow = (result: TapCallbackResult): void => params.fail?.(result);
    const succeedWith = (data: unknown): void => params.success?.({ data });
    switch (script?.type) {
      case 'silent':
        return;
      case 'fail':
        this.schedule(script.delayMs, () => failNow(script.result ?? { errMsg: 'getStorage:fail io' }));
        return;
      case 'fail-then-success':
        params.fail?.({ errMsg: 'getStorage:fail transient' });
        if (this.storage.has(params.key)) succeedWith(this.storage.get(params.key));
        else params.fail?.({ errMsg: 'getStorage:fail data not found' });
        return;
      case 'success-twice':
        this.schedule(script.delayMs, () => {
          if (this.storage.has(params.key)) {
            succeedWith(this.storage.get(params.key));
            succeedWith(this.storage.get(params.key));
          } else {
            params.fail?.({ errMsg: 'getStorage:fail data not found' });
          }
        });
        return;
      case 'success-empty':
        this.schedule(undefined, () => succeedWith(''));
        return;
      case 'success':
        this.schedule(script.delayMs, () => {
          if (this.storage.has(params.key)) succeedWith(this.storage.get(params.key));
          else params.fail?.({ errMsg: 'getStorage:fail data not found' });
        });
        return;
      default:
        // 无脚本：平台“正常”语义——缺失 key 回 data not found
        if (this.storage.has(params.key)) succeedWith(this.storage.get(params.key));
        else params.fail?.({ errMsg: 'getStorage:fail data not found' });
    }
  }

  setStorage(params: { key: string; data: unknown } & TapSuccessFailCallback): void {
    this.invocations.push({
      api: 'setStorage',
      key: params.key,
      bytes: JSON.stringify(params.data)?.length ?? 0,
    });
    const script = this.next('setStorage');
    switch (script?.type) {
      case 'deferred':
        this.deferredSetCallbacks.push({ key: params.key, data: params.data, callback: params });
        return;
      case 'silent':
        return;
      case 'fail':
        this.schedule(script.delayMs, () => params.fail?.(script.result ?? { errMsg: 'setStorage:fail io' }));
        return;
      case 'success-twice':
        this.schedule(script.delayMs, () => {
          this.storage.set(params.key, params.data);
          params.success?.({});
          params.success?.({});
        });
        return;
      default:
        this.storage.set(params.key, params.data);
        this.schedule(script?.type === 'success' ? script.delayMs : undefined, () => params.success?.({}));
    }
  }

  /** Apply a held native set and deliver its actual completion callback. */
  completeDeferredSet(index = 0): void {
    const item = this.deferredSetCallbacks.splice(index, 1)[0];
    if (!item) throw new Error(`no deferred storage write at index ${index}`);
    this.storage.set(item.key, item.data);
    item.callback.success?.({});
  }

  removeStorage(params: { key: string } & TapSuccessFailCallback): void {
    this.invocations.push({ api: 'removeStorage', key: params.key });
    const script = this.next('removeStorage');
    switch (script?.type) {
      case 'silent':
        return;
      case 'fail':
        this.schedule(script.delayMs, () => params.fail?.(script.result ?? { errMsg: 'removeStorage:fail io' }));
        return;
      default:
        this.storage.delete(params.key);
        params.success?.({});
    }
  }

  login(params?: { timeout?: number } & TapSuccessFailCallback<{ code: string }>): void {
    this.invocations.push({ api: 'login' });
    const script = this.next('login');
    switch (script?.type) {
      case 'silent':
        return;
      case 'fail':
        this.schedule(script.delayMs, () => params?.fail?.(script.result ?? { errMsg: 'login:fail deny' }));
        return;
      default:
        this.schedule(script?.type === 'success' ? script.delayMs : undefined, () =>
          params?.success?.({ code: 'fixture-code' }),
        );
    }
  }

  getNetworkType(params?: TapSuccessFailCallback<{ networkType: string }>): void {
    this.invocations.push({ api: 'getNetworkType' });
    const script = this.next('getNetworkType');
    if (script?.type === 'silent') return;
    if (script?.type === 'fail') {
      this.schedule(script.delayMs, () => params?.fail?.(script.result ?? { errMsg: 'getNetworkType:fail' }));
      return;
    }
    params?.success?.({ networkType: 'wifi' });
  }

  request(): { abort?: () => void } {
    return {};
  }
}

// ----------------------------------------------------------- 宿主能力开关
/**
 * 在 fn 执行期间移除全局能力（TextEncoder / structuredClone 等），
 * 结束后恢复（即使抛错）。用于 REL-02/REL-03 缺能力环境模拟。
 */
export async function withoutGlobalCapability<T>(
  name: 'TextEncoder' | 'TextDecoder' | 'structuredClone',
  fn: () => Promise<T>,
): Promise<T> {
  const g = globalThis as Record<string, unknown>;
  const had = Object.prototype.hasOwnProperty.call(g, name);
  const saved = g[name];
  delete g[name];
  try {
    return await fn();
  } finally {
    if (had) g[name] = saved;
    else delete g[name];
  }
}

// ------------------------------------------------------------- 旧档/损坏档
export interface BuiltSave {
  storage: ScriptedStorage;
  state: GameState;
  envelope: SaveEnvelope;
  slot: 'a' | 'b';
}

/** 走真实 SaveRepository 提交一份合法存档（用于构造可信旧档）。 */
export async function buildCommittedSave(
  state: GameState,
  meta: { revision: number; resetGeneration?: number },
  slotPreference?: 'a' | 'b',
): Promise<BuiltSave> {
  const storage = new ScriptedStorage();
  const repo = new SaveRepository(storage);
  const envelope = await repo.commit(state, {
    revision: meta.revision,
    resetGeneration: meta.resetGeneration ?? 0,
    expectedBase: null,
  });
  const pointer = storage.peek<SavePointer>(SAVE_KEYS.active);
  const slot = pointer?.slot ?? slotPreference ?? 'a';
  return { storage, state, envelope, slot };
}

/** 直接构造信封（不经过提交），便于制造跨 run/坏 checksum 档。 */
export function makeEnvelope(
  state: GameState,
  meta: { revision: number; resetGeneration?: number },
): SaveEnvelope {
  return encodeEnvelope(state, {
    revision: meta.revision,
    runId: state.runId,
    resetGeneration: meta.resetGeneration ?? 0,
  });
}

export function tamperChecksum(envelope: SaveEnvelope): SaveEnvelope {
  return { ...envelope, checksum: `deadbeef` };
}

export function makeTombstone(oldRunId: string, generation: number, nowMs: number): ResetTombstone {
  return { oldRunId, newResetGeneration: generation, resetAtMs: nowMs };
}

export function makePointer(p: SavePointer): SavePointer {
  return { ...p };
}
