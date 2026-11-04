/**
 * R07：资源/配置加载守卫（超时、一次 settle、必需阻断、可选回落）。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  guardResourceLoad,
  ResourceLoadError,
  __resetLoadAttemptsForTest,
  type GuardScheduler,
} from '@core/platform/loadGuard';

function manualScheduler(): GuardScheduler & { fire(): void; pending(): number } {
  const timers = new Map<number, () => void>();
  let seq = 1;
  return {
    now: () => 0,
    setTimeout(fn) {
      const id = seq++;
      timers.set(id, fn);
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    fire() {
      const all = [...timers.values()];
      timers.clear();
      all.forEach((f) => f());
    },
    pending() {
      return timers.size;
    },
  };
}

beforeEach(() => __resetLoadAttemptsForTest());

describe('R07 必需资源', () => {
  it('成功返回值', async () => {
    const h = guardResourceLoad<string>('cfg', {
      required: true,
      timeoutMs: 100,
      scheduler: manualScheduler(),
      start: ({ succeed }) => succeed('ok'),
    });
    await expect(h.promise).resolves.toBe('ok');
    expect(h.attemptId).toBe(1);
  });

  it('回调丢失→超时抛 RESOURCE_TIMEOUT', async () => {
    const sch = manualScheduler();
    const h = guardResourceLoad<string>('cfg', {
      required: true,
      timeoutMs: 50,
      scheduler: sch,
      start: () => undefined,
    });
    sch.fire();
    const err = await h.promise.catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ResourceLoadError);
    expect((err as ResourceLoadError).code).toBe('RESOURCE_TIMEOUT');
    expect((err as ResourceLoadError).resource).toBe('cfg');
  });

  it('404 错误归 RESOURCE_NOT_FOUND', async () => {
    const h = guardResourceLoad<string>('cfg', {
      required: true,
      timeoutMs: 50,
      scheduler: manualScheduler(),
      start: ({ fail }) => fail(new Error('404 not found')),
    });
    const err = await h.promise.catch((e: unknown) => e);
    expect((err as ResourceLoadError).code).toBe('RESOURCE_NOT_FOUND');
  });

  it('无效 JSON 归 RESOURCE_INVALID', async () => {
    const h = guardResourceLoad<string>('cfg', {
      required: true,
      timeoutMs: 50,
      scheduler: manualScheduler(),
      start: ({ fail }) => fail(new Error('invalid json schema')),
    });
    const err = await h.promise.catch((e: unknown) => e);
    expect((err as ResourceLoadError).code).toBe('RESOURCE_INVALID');
  });

  it('迟到成功回调不改变超时结果（一次 settle）', async () => {
    const sch = manualScheduler();
    const box: { late?: (v: string) => void } = {};
    const h = guardResourceLoad<string>('cfg', {
      required: true,
      timeoutMs: 50,
      scheduler: sch,
      start: ({ succeed }) => {
        box.late = succeed;
      },
    });
    sch.fire();
    box.late?.('late');
    const err = await h.promise.catch((e: unknown) => e);
    expect((err as ResourceLoadError).code).toBe('RESOURCE_TIMEOUT');
  });
});

describe('R07 可选资源', () => {
  it('失败回落 fallback 并记录可恢复原因', async () => {
    const recovered: Array<{ code: string }> = [];
    const h = guardResourceLoad<string>('runtime', {
      required: false,
      timeoutMs: 50,
      scheduler: manualScheduler(),
      start: ({ fail }) => fail(new Error('not found')),
      fallback: () => 'default',
      onRecoverable: (info) => recovered.push({ code: info.code }),
    });
    await expect(h.promise).resolves.toBe('default');
    expect(recovered[0]?.code).toBe('RESOURCE_NOT_FOUND');
  });

  it('超时也回落，不阻断启动', async () => {
    const sch = manualScheduler();
    const h = guardResourceLoad<string>('runtime', {
      required: false,
      timeoutMs: 50,
      scheduler: sch,
      start: () => undefined,
      fallback: () => 'empty',
    });
    sch.fire();
    await expect(h.promise).resolves.toBe('empty');
  });
});

describe('R07 取消旧尝试', () => {
  it('cancel 后迟到回调被忽略，promise 不 settle', async () => {
    const box: { succeed?: (v: number) => void } = {};
    const sch = manualScheduler();
    const h = guardResourceLoad<number>('cfg', {
      required: true,
      timeoutMs: 1000,
      scheduler: sch,
      start: (sink) => {
        box.succeed = sink.succeed;
      },
    });
    h.cancel('superseded');
    box.succeed?.(1);
    let settled = false;
    void h.promise.then(
      () => (settled = true),
      () => (settled = true),
    );
    await Promise.resolve();
    expect(settled).toBe(false);
  });
});
