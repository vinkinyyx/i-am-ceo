/**
 * R06：initApp 帧调度与单次启动。
 */
import { describe, it, expect } from 'vitest';
import { startOnceInit, detectRuntimeKind, type FrameSchedulerHost } from '@core/platform/onceInit';

interface FakeHost extends FrameSchedulerHost {
  timers: Map<number, () => void>;
  rafQueue: Array<(t: number) => void>;
  seq: number;
  fireTimer(): void;
  fireFrame(): void;
}

function makeHost(raf: boolean): FakeHost {
  const timers = new Map<number, () => void>();
  const rafQueue: Array<(t: number) => void> = [];
  let seq = 1;
  const host: FakeHost = {
    now: () => 1,
    timers,
    rafQueue,
    seq,
    setTimeout(fn) {
      const id = seq++;
      timers.set(id, fn);
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    fireTimer() {
      const all = [...timers.values()];
      timers.clear();
      all.forEach((fn) => fn());
    },
    fireFrame() {
      const q = [...rafQueue];
      rafQueue.length = 0;
      q.forEach((fn) => fn(16));
    },
  };
  if (raf) {
    host.requestAnimationFrame = (cb) => {
      const id = seq++;
      rafQueue.push(cb);
      return id;
    };
    host.cancelAnimationFrame = () => undefined;
  }
  return host;
}

describe('R06-T01 rAF 缺失时定时兜底仍进入一次 init', () => {
  it('无 rAF：timer 触发，initCount=1', async () => {
    const host = makeHost(false);
    let calls = 0;
    const h = startOnceInit(
      host,
      async () => {
        calls += 1;
        return 'ok';
      },
      { fallbackMs: 10 },
    );
    host.fireTimer();
    await expect(h.promise).resolves.toBe('ok');
    expect(calls).toBe(1);
    expect(h.initCount()).toBe(1);
  });
});

describe('R06-T02 rAF 只注册不回调：兜底生效', () => {
  it('帧不来：timer 触发一次', async () => {
    const host = makeHost(true);
    let calls = 0;
    const h = startOnceInit(host, () => (calls += 1));
    host.fireTimer();
    await h.promise;
    expect(calls).toBe(1);
  });
});

describe('R06-T03 两路都到 initCount=1', () => {
  it('帧先到后，迟到 timer 被忽略', async () => {
    const host = makeHost(true);
    let calls = 0;
    const h = startOnceInit(host, () => (calls += 1), { fallbackMs: 100 });
    host.fireFrame();
    await h.promise;
    host.fireTimer();
    expect(calls).toBe(1);
    expect(h.initCount()).toBe(1);
  });

  it('timer 先到后，迟到帧被忽略', async () => {
    const host = makeHost(true);
    let calls = 0;
    const h = startOnceInit(host, () => (calls += 1), { fallbackMs: 5 });
    host.fireTimer();
    await h.promise;
    host.fireFrame();
    expect(calls).toBe(1);
  });
});

describe('R06-T04 平台分流按实际能力', () => {
  it('tap/wx/web/unknown 正确识别', () => {
    expect(detectRuntimeKind({ tap: {} })).toBe('taptap');
    expect(detectRuntimeKind({ wx: {} })).toBe('wx');
    expect(detectRuntimeKind({ window: {}, document: {} })).toBe('web');
    expect(detectRuntimeKind({})).toBe('unknown');
  });
});

describe('R06-T05 init throw 只失败一次', () => {
  it('init 抛错时 promise reject，不重复初始化', async () => {
    const host = makeHost(false);
    let calls = 0;
    const h = startOnceInit(host, () => {
      calls += 1;
      throw new Error('init boom');
    });
    host.fireTimer();
    await expect(h.promise).rejects.toThrow('init boom');
    host.fireTimer();
    expect(calls).toBe(1);
  });
});
