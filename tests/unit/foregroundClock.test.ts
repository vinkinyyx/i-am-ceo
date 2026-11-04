/**
 * R15：前后台真实时间水位与离线去重。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createForegroundClock } from '@core/platform/foregroundClock';

let t = 0;
beforeEach(() => {
  t = 1_000_000;
});

describe('R15 前后台水位', () => {
  it('后台 8h 回前台：返回真实 elapsed（不是固定 200ms）', () => {
    const c = createForegroundClock(() => t);
    c.enterBackground(t);
    t += 8 * 3_600_000;
    expect(c.enterForeground(t)).toBe(8 * 3_600_000);
  });

  it('T03：快速连续两次 onShow 只结算一次（第二次 0）', () => {
    const c = createForegroundClock(() => t);
    c.enterBackground(t);
    t += 3_600_000;
    const first = c.enterForeground(t);
    const second = c.enterForeground(t);
    expect(first).toBe(3_600_000);
    expect(second).toBe(0);
  });

  it('markSettled 后重复 onShow 同区间不重复计时', () => {
    const c = createForegroundClock(() => t);
    c.enterBackground(t);
    t += 3_600_000;
    const elapsed = c.enterForeground(t);
    c.markSettled(t);
    expect(elapsed).toBe(3_600_000);
    // 再次进入后台立即回前台，且时间未前进：0
    expect(c.enterForeground(t)).toBe(0);
  });

  it('未提交的前台区间可重复读取，只有持久化成功后markSettled才消费', () => {
    const c = createForegroundClock(() => t);
    c.enterBackground(t);
    expect(c.peekForegroundElapsed(t + 8_000)).toBe(8_000);
    expect(c.peekForegroundElapsed(t + 9_000)).toBe(9_000);
    c.markSettled(t + 9_000);
    expect(c.peekForegroundElapsed(t + 10_000)).toBe(1_000);
  });

  it('T03：10 次快速前后台切换只有实际经过的时间被计一次', () => {
    const c = createForegroundClock(() => t);
    c.enterBackground(t);
    t += 10 * 60_000;
    let total = 0;
    for (let i = 0; i < 10; i++) total += c.enterForeground(t);
    expect(total).toBe(10 * 60_000);
  });

  it('时间回拨（now<离场时间）返回 0', () => {
    const c = createForegroundClock(() => t);
    c.enterBackground(5_000_000);
    expect(c.enterForeground(4_000_000)).toBe(0);
  });

  it('在线推进 noteOnlineProgress 后，下次离线不重复计入该区间', () => {
    const c = createForegroundClock(() => t);
    c.enterBackground(t);
    t += 60_000;
    c.enterForeground(t);
    c.noteOnlineProgress(t + 60_000);
    // 2 分钟后又短暂后台 1 分钟：只有后 1 分钟可计
    t += 120_000;
    c.enterBackground(t);
    t += 60_000;
    const elapsed = c.enterForeground(t);
    expect(elapsed).toBe(60_000);
  });

  it('暂停态判定由调用方依据 state.speed；水位服务本身不结 0 以下', () => {
    const c = createForegroundClock(() => t);
    expect(c.enterForeground(t)).toBe(0);
  });
});
