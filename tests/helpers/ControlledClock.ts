/**
 * R02 故障夹具：受控时钟。
 * - 不依赖真实 sleep：所有定时任务进入队列，由测试显式 advance。
 * - now() 可由测试设置，用于前后台/离线真实时间语义（R15）。
 * 仅供测试使用，禁止从生产代码引用 tests/helpers。
 */
export class ControlledClock {
  private currentMs: number;
  private seq = 0;
  private readonly timers = new Map<
    number,
    { dueAt: number; fn: () => void; kind: 'timeout' | 'interval'; periodMs?: number }
  >();

  constructor(startMs = 1_700_000_000_000) {
    this.currentMs = startMs;
  }

  now(): number {
    return this.currentMs;
  }

  setNow(ms: number): void {
    this.currentMs = ms;
  }

  advance(ms: number): void {
    if (ms < 0) throw new Error('clock cannot move backwards in this fixture');
    const target = this.currentMs + ms;
    // 到期任务可能在同一点注册新任务；循环排空
    let guard = 0;
    for (;;) {
      const due = [...this.timers.values()]
        .filter((t) => t.dueAt <= target)
        .sort((a, b) => a.dueAt - b.dueAt);
      const next = due[0];
      if (!next) break;
      this.currentMs = next.dueAt;
      const id = [...this.timers.entries()].find(([, t]) => t === next)?.[0];
      if (id !== undefined) {
        if (next.kind === 'interval') {
          next.dueAt += next.periodMs ?? 0;
        } else {
          this.timers.delete(id);
        }
        next.fn();
      }
      if (++guard > 100_000) throw new Error('ControlledClock: timer runaway');
    }
    this.currentMs = target;
  }

  setTimeout(fn: () => void, ms: number): number {
    const id = ++this.seq;
    this.timers.set(id, { dueAt: this.currentMs + Math.max(0, ms), fn, kind: 'timeout' });
    return id;
  }

  setInterval(fn: () => void, ms: number): number {
    const id = ++this.seq;
    this.timers.set(id, {
      dueAt: this.currentMs + Math.max(0, ms),
      fn,
      kind: 'interval',
      periodMs: Math.max(0, ms),
    });
    return id;
  }

  clearTimer(id: number): void {
    this.timers.delete(id);
  }

  get pendingCount(): number {
    return this.timers.size;
  }

  /** 立即执行某个尚未到期的回调（模拟平台迟到/主动触发），不推进时钟。 */
  fireDueCallbackFor(fn: () => void): void {
    fn();
  }
}
