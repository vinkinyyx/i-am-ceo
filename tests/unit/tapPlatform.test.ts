import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GameError, GameErrorCode, errorMessage } from '@core/domain/errors';
import {
  resolveTapRuntime,
  TapPlatform,
  type TapRuntime,
  type TapSuccessFailCallback,
  type TapWindowInfoResult,
} from '@core/platform/TapPlatform';

/**
 * 注入式假 tap 全局对象：模拟 TapTap 小游戏运行时。
 * 只实现 TapRuntime 最小结构子集，行为开关覆盖成功/失败/同步抛异常。
 */
class FakeTap implements TapRuntime {
  windowInfo: TapWindowInfoResult = {
    pixelRatio: 3,
    screenWidth: 1080,
    screenHeight: 2400,
    windowWidth: 360,
    windowHeight: 780,
    statusBarHeight: 30,
    safeArea: { left: 0, right: 360, top: 30, bottom: 760, width: 360, height: 730 },
  };
  windowInfoThrows = false;

  readonly showListeners = new Set<(res: unknown) => void>();
  readonly hideListeners = new Set<() => void>();
  offShowCalls = 0;
  offHideCalls = 0;

  readonly storage = new Map<string, unknown>();
  missingKeyBehavior: 'fail-not-found' | 'success-empty' = 'fail-not-found';
  getMode: 'ok' | 'fail' | 'throw' | 'silent' = 'ok';
  getFailErrMsg = 'getStorage:fail io error';
  setMode: 'ok' | 'fail' | 'throw' | 'silent' = 'ok';
  removeMode: 'ok' | 'fail' | 'throw' | 'silent' = 'ok';
  readonly setCalls: Array<{ key: string; data: unknown }> = [];

  loginMode: 'ok' | 'fail' | 'empty-code' | 'throw' | 'silent' = 'ok';
  loginCode = 'once-code-abc';
  loginErrMsg = 'login:fail auth deny';
  lastLoginTimeout?: number;

  networkType = 'wifi';
  networkMode: 'ok' | 'fail' | 'throw' | 'silent' = 'ok';

  getWindowInfo(): TapWindowInfoResult {
    if (this.windowInfoThrows) throw new Error('native getWindowInfo boom');
    return this.windowInfo;
  }

  onShow(callback: (res: unknown) => void): void {
    this.showListeners.add(callback);
  }

  offShow(callback?: (res: unknown) => void): void {
    this.offShowCalls += 1;
    if (callback) this.showListeners.delete(callback);
  }

  onHide(callback: () => void): void {
    this.hideListeners.add(callback);
  }

  offHide(callback?: () => void): void {
    this.offHideCalls += 1;
    if (callback) this.hideListeners.delete(callback);
  }

  emitShow(): void {
    for (const cb of this.showListeners) cb({ query: {}, scene: 1001 });
  }

  emitHide(): void {
    for (const cb of this.hideListeners) cb();
  }

  getStorage(params: { key: string } & TapSuccessFailCallback<{ data: unknown }>): void {
    if (this.getMode === 'throw') throw new Error('native getStorage boom');
    if (this.getMode === 'silent') return; // 鸿蒙场景：运行时不回任何回调
    if (this.getMode === 'fail') {
      params.fail?.({ errMsg: this.getFailErrMsg });
      return;
    }
    if (!this.storage.has(params.key)) {
      if (this.missingKeyBehavior === 'success-empty') {
        params.success?.({ data: '' });
      } else {
        params.fail?.({ errMsg: 'getStorage:fail data not found' });
      }
      return;
    }
    params.success?.({ data: this.storage.get(params.key) });
  }

  setStorage(params: { key: string; data: unknown } & TapSuccessFailCallback): void {
    if (this.setMode === 'throw') throw new Error('native setStorage boom');
    if (this.setMode === 'silent') return;
    if (this.setMode === 'fail') {
      params.fail?.({ errMsg: 'setStorage:fail exceed storage limit' });
      return;
    }
    this.setCalls.push({ key: params.key, data: params.data });
    this.storage.set(params.key, params.data);
    params.success?.({});
  }

  removeStorage(params: { key: string } & TapSuccessFailCallback): void {
    if (this.removeMode === 'throw') throw new Error('native removeStorage boom');
    if (this.removeMode === 'silent') return;
    if (this.removeMode === 'fail') {
      params.fail?.({ errMsg: 'removeStorage:fail' });
      return;
    }
    this.storage.delete(params.key);
    params.success?.({});
  }

  login(params?: { timeout?: number } & TapSuccessFailCallback<{ code: string }>): void {
    this.lastLoginTimeout = params?.timeout;
    if (this.loginMode === 'throw') throw new Error('native login boom');
    if (this.loginMode === 'silent') return;
    if (this.loginMode === 'fail') {
      params?.fail?.({ errMsg: this.loginErrMsg });
      return;
    }
    if (this.loginMode === 'empty-code') {
      params?.success?.({ code: '' });
      return;
    }
    params?.success?.({ code: this.loginCode });
  }

  getNetworkType(params?: TapSuccessFailCallback<{ networkType: string }>): void {
    if (this.networkMode === 'throw') throw new Error('native getNetworkType boom');
    if (this.networkMode === 'silent') return;
    if (this.networkMode === 'fail') {
      params?.fail?.({ errMsg: 'getNetworkType:fail' });
      return;
    }
    params?.success?.({ networkType: this.networkType });
  }
}

const g = globalThis as Record<string, unknown>;
let originalTap: unknown;
let fake: FakeTap;
let platform: TapPlatform;

beforeEach(() => {
  originalTap = g.tap;
  delete g.tap;
  fake = new FakeTap();
  platform = new TapPlatform(fake);
});

afterEach(() => {
  if (originalTap === undefined) delete g.tap;
  else g.tap = originalTap;
});

describe('resolveTapRuntime 运行时探测', () => {
  it('globalThis.tap 缺失时返回 null', () => {
    expect(resolveTapRuntime()).toBeNull();
  });

  it('tap 方法不全时返回 null（不视为真机运行时）', () => {
    g.tap = { login: () => undefined };
    expect(resolveTapRuntime()).toBeNull();
  });

  it('tap 方法齐全时返回运行时', () => {
    g.tap = fake;
    expect(resolveTapRuntime()).toBe(fake);
  });

  it('无运行时时构造 TapPlatform 抛 PLATFORM_UNAVAILABLE', () => {
    let err: unknown;
    try {
      new TapPlatform();
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(GameError);
    expect((err as GameError).code).toBe(GameErrorCode.PLATFORM_UNAVAILABLE);
  });
});

describe('环境与窗口信息', () => {
  it('getEnvironment 返回 TAPTAP', () => {
    expect(platform.getEnvironment()).toBe('TAPTAP');
  });

  it('getWindowInfo 映射窗口尺寸、像素比与安全区', () => {
    const info = platform.getWindowInfo();
    expect(info.width).toBe(360);
    expect(info.height).toBe(780);
    expect(info.pixelRatio).toBe(3);
    expect(info.safeArea).toEqual({ top: 30, bottom: 760, left: 0, right: 360 });
  });

  it('getWindowInfo 同步异常映射为 PLATFORM_UNAVAILABLE，不泄漏原始异常', () => {
    fake.windowInfoThrows = true;
    let err: unknown;
    try {
      platform.getWindowInfo();
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(GameError);
    expect((err as GameError).code).toBe(GameErrorCode.PLATFORM_UNAVAILABLE);
    expect((err as GameError).details?.api).toBe('getWindowInfo');
    expect((err as GameError).message).toBe(errorMessage(GameErrorCode.PLATFORM_UNAVAILABLE));
  });
});

describe('login 登录', () => {
  it('成功返回一次性 code', async () => {
    await expect(platform.login()).resolves.toEqual({ code: 'once-code-abc' });
  });

  it('透传 timeout 参数', async () => {
    const p = new TapPlatform(fake, { loginTimeoutMs: 5000 });
    await p.login();
    expect(fake.lastLoginTimeout).toBe(5000);
  });

  it('fail 映射为 AUTH_REQUIRED：玩家文案固定，原始 errMsg 只进 details', async () => {
    fake.loginMode = 'fail';
    const err = await platform.login().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(GameError);
    const ge = err as GameError;
    expect(ge.code).toBe(GameErrorCode.AUTH_REQUIRED);
    expect(ge.message).toBe(errorMessage(GameErrorCode.AUTH_REQUIRED));
    expect(ge.message).not.toContain('auth deny');
    expect(ge.details?.cause).toContain('auth deny');
  });

  it('成功但 code 为空也按 AUTH_REQUIRED 处理', async () => {
    fake.loginMode = 'empty-code';
    const err = await platform.login().catch((e: unknown) => e);
    expect((err as GameError).code).toBe(GameErrorCode.AUTH_REQUIRED);
  });

  it('同步抛异常映射为 AUTH_REQUIRED', async () => {
    fake.loginMode = 'throw';
    const err = await platform.login().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(GameError);
    expect((err as GameError).code).toBe(GameErrorCode.AUTH_REQUIRED);
  });
});

describe('存储读写删', () => {
  it('写入→读取→删除→读取为 null', async () => {
    const payload = { a: 1, nested: { b: '存档' } };
    await platform.set('k1', payload);
    await expect(platform.get<typeof payload>('k1')).resolves.toEqual(payload);
    await platform.remove('k1');
    await expect(platform.get('k1')).resolves.toBeNull();
  });

  it('key 不存在（fail data not found）读作 null', async () => {
    await expect(platform.get('missing')).resolves.toBeNull();
  });

  it('key 不存在（success 空值）读作 null', async () => {
    fake.missingKeyBehavior = 'success-empty';
    await expect(platform.get('missing')).resolves.toBeNull();
  });

  it('getStorage 真实失败映射 SAVE_FAILED，details 带 key 与原因', async () => {
    fake.getMode = 'fail';
    const err = await platform.get('k1').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(GameError);
    const ge = err as GameError;
    expect(ge.code).toBe(GameErrorCode.SAVE_FAILED);
    expect(ge.details?.key).toBe('k1');
    expect(ge.details?.cause).toContain('io error');
    expect(ge.message).toBe(errorMessage(GameErrorCode.SAVE_FAILED));
  });

  it('getStorage 同步抛异常映射 SAVE_FAILED', async () => {
    fake.getMode = 'throw';
    const err = await platform.get('k1').catch((e: unknown) => e);
    expect((err as GameError).code).toBe(GameErrorCode.SAVE_FAILED);
  });

  it('setStorage 失败映射 SAVE_FAILED', async () => {
    fake.setMode = 'fail';
    const err = await platform.set('k1', { a: 1 }).catch((e: unknown) => e);
    const ge = err as GameError;
    expect(ge.code).toBe(GameErrorCode.SAVE_FAILED);
    expect(ge.details?.cause).toContain('exceed storage limit');
  });

  it('removeStorage 失败映射 SAVE_FAILED', async () => {
    fake.removeMode = 'fail';
    const err = await platform.remove('k1').catch((e: unknown) => e);
    expect((err as GameError).code).toBe(GameErrorCode.SAVE_FAILED);
  });

  it('写前大小估算：超预算抛 SAVE_FAILED 且不落盘，details 可诊断', async () => {
    const small = new TapPlatform(fake, { maxKeyBytes: 100 });
    const bigPayload = { blob: '中'.repeat(200) }; // JSON 约 600+ 字节（UTF-8）
    const err = await small.set('save.slot.a', bigPayload).catch((e: unknown) => e);
    const ge = err as GameError;
    expect(ge.code).toBe(GameErrorCode.SAVE_FAILED);
    expect(ge.details?.key).toBe('save.slot.a');
    expect(typeof ge.details?.bytes).toBe('number');
    expect(ge.details?.bytes as number).toBeGreaterThan(100);
    expect(ge.details?.budgetBytes).toBe(100);
    // 未调用平台写入
    expect(fake.setCalls).toHaveLength(0);
    expect(fake.storage.has('save.slot.a')).toBe(false);
  });

  it('预算边界内正常写入', async () => {
    const small = new TapPlatform(fake, { maxKeyBytes: 100 });
    await small.set('k', { a: 1 });
    expect(fake.setCalls).toHaveLength(1);
  });
});

describe('生命周期监听', () => {
  it('onShow 回调触发，退订后不再触发', () => {
    let count = 0;
    const unsubscribe = platform.onShow(() => {
      count += 1;
    });
    fake.emitShow();
    expect(count).toBe(1);
    unsubscribe();
    fake.emitShow();
    expect(count).toBe(1);
    expect(fake.offShowCalls).toBe(1);
  });

  it('onHide 回调触发，退订后不再触发', () => {
    let count = 0;
    const unsubscribe = platform.onHide(() => {
      count += 1;
    });
    fake.emitHide();
    expect(count).toBe(1);
    unsubscribe();
    fake.emitHide();
    expect(count).toBe(1);
    expect(fake.offHideCalls).toBe(1);
  });

  it('退订幂等：重复调用 unsubscribe 只对平台退订一次', () => {
    const unsubscribe = platform.onHide(() => undefined);
    unsubscribe();
    unsubscribe();
    unsubscribe();
    expect(fake.offHideCalls).toBe(1);
    expect(fake.hideListeners.size).toBe(0);
  });

  it('多监听器互不影响：退订一个保留另一个', () => {
    let a = 0;
    let b = 0;
    const unsubA = platform.onShow(() => {
      a += 1;
    });
    platform.onShow(() => {
      b += 1;
    });
    unsubA();
    fake.emitShow();
    expect(a).toBe(0);
    expect(b).toBe(1);
  });
});

describe('网络状态', () => {
  it('wifi/4g 映射 online', async () => {
    fake.networkType = 'wifi';
    await expect(platform.getNetworkState()).resolves.toBe('online');
    fake.networkType = '4g';
    await expect(platform.getNetworkState()).resolves.toBe('online');
  });

  it('none 映射 offline（断网）', async () => {
    fake.networkType = 'none';
    await expect(platform.getNetworkState()).resolves.toBe('offline');
  });

  it('unknown 映射 unknown', async () => {
    fake.networkType = 'unknown';
    await expect(platform.getNetworkState()).resolves.toBe('unknown');
  });

  it('探测失败降级 unknown，不抛错', async () => {
    fake.networkMode = 'fail';
    await expect(platform.getNetworkState()).resolves.toBe('unknown');
    fake.networkMode = 'throw';
    await expect(platform.getNetworkState()).resolves.toBe('unknown');
  });
});

describe('回调防挂死（silent 运行时：鸿蒙场景）', () => {
  function silentPlatform(): TapPlatform {
    return new TapPlatform(fake, { opTimeoutMs: 20, loginCallbackTimeoutMs: 20 });
  }

  it('get 不回调时超时读作 null（启动装载不被挂死）', async () => {
    fake.getMode = 'silent';
    await expect(silentPlatform().get('k1')).resolves.toBeNull();
  });

  it('set 不回调时超时抛 SAVE_FAILED（不落盘、可诊断）', async () => {
    fake.setMode = 'silent';
    const err = await silentPlatform().set('k1', { a: 1 }).catch((e: unknown) => e);
    const ge = err as GameError;
    expect(ge.code).toBe(GameErrorCode.SAVE_FAILED);
    expect(ge.details?.key).toBe('k1');
    expect(ge.details?.cause).toContain('timeout');
  });

  it('remove 不回调时超时按成功处理（清理 best-effort）', async () => {
    fake.removeMode = 'silent';
    await expect(silentPlatform().remove('k1')).resolves.toBeUndefined();
  });

  it('login 不回调时超时抛 AUTH_REQUIRED', async () => {
    fake.loginMode = 'silent';
    const err = await silentPlatform().login().catch((e: unknown) => e);
    expect((err as GameError).code).toBe(GameErrorCode.AUTH_REQUIRED);
    expect((err as GameError).details?.cause).toContain('timeout');
  });

  it('getNetworkType 不回调时超时降级 unknown', async () => {
    fake.networkMode = 'silent';
    await expect(silentPlatform().getNetworkState()).resolves.toBe('unknown');
  });

  it('超时先 settle 后，迟到回调被丢弃（get 仍为 null）', async () => {
    fake.getMode = 'silent';
    const p = silentPlatform();
    await expect(p.get('k1')).resolves.toBeNull();
  });
});
