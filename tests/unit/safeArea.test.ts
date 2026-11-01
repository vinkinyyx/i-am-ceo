import { describe, it, expect } from 'vitest';
import { computeSafeAreaTransform } from '@core/platform/safeArea';
import type { WindowInfo } from '@core/platform/ITapPlatform';

describe('安全区变换 computeSafeAreaTransform（A21）', () => {
  it('无 safeArea 时恒等变换', () => {
    const t = computeSafeAreaTransform({ width: 360, height: 800 });
    expect(t.applied).toBe(false);
    expect(t.scale).toBe(1);
    expect(t.offsetY).toBe(0);
  });

  it('全屏机型四边均 0 时恒等变换', () => {
    const info: WindowInfo = {
      width: 375,
      height: 812,
      safeArea: { top: 0, bottom: 812, left: 0, right: 375 },
    };
    const t = computeSafeAreaTransform(info);
    expect(t.applied).toBe(false);
    expect(t.scale).toBe(1);
  });

  it('刘海屏（顶 47 底 34）整体缩放到安全区内且不被裁切', () => {
    const info: WindowInfo = {
      width: 375,
      height: 812,
      // 顶部刘海 47、底部 Home 指示条 34
      safeArea: { top: 47, bottom: 812 - 34, left: 0, right: 375 },
    };
    const t = computeSafeAreaTransform(info);
    expect(t.applied).toBe(true);
    const safeH = 812 - 47 - 34; // 731
    expect(t.scale).toBeCloseTo(safeH / 812, 6);
    expect(t.scale).toBeLessThan(1);
    // 内容不超出安全区：缩放后内容高 *scale <= 安全区高
    expect(812 * t.scale).toBeLessThanOrEqual(safeH + 1e-6);
    expect(375 * t.scale).toBeLessThanOrEqual(375 + 1e-6);
  });

  it('内容中心向较空的一侧（底部内边距小）偏移为负，避开刘海', () => {
    const info: WindowInfo = {
      width: 375,
      height: 812,
      safeArea: { top: 59, bottom: 778, left: 0, right: 375 }, // 顶59 底34
    };
    const t = computeSafeAreaTransform(info);
    // offsetY = (bottomInset - topInset)/2/scale = (34-59)/2/scale < 0
    expect(t.offsetY).toBeLessThan(0);
  });

  it('左右对称的安全区 offsetX 为 0，按更紧一侧缩放', () => {
    const info: WindowInfo = {
      width: 375,
      height: 812,
      safeArea: { top: 20, bottom: 792, left: 10, right: 365 },
    };
    const t = computeSafeAreaTransform(info);
    expect(t.applied).toBe(true);
    expect(t.offsetX).toBeCloseTo(0, 6);
    const sx = (375 - 20) / 375;
    const sy = (812 - 40) / 812;
    expect(t.scale).toBeCloseTo(Math.min(sx, sy), 6);
  });

  it('非法/越界安全区回退恒等，不产生 NaN/负缩放', () => {
    const bad: WindowInfo = {
      width: 375,
      height: 812,
      safeArea: { top: 400, bottom: 100, left: 200, right: 100 },
    };
    const t = computeSafeAreaTransform(bad);
    expect(Number.isFinite(t.scale)).toBe(true);
    expect(t.scale).toBeGreaterThan(0);
  });
});
