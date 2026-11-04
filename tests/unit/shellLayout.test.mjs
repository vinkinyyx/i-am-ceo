// R24：页面壳安全区布局纯函数 + 平台 resize 订阅（脚本层纯 TS 经 esbuild 转译可直接 import）。
import { describe, it, expect } from 'vitest';
import { computeShellLayout, SHELL_METRICS } from '../../assets/scripts/ui/shellLayout.ts';
import { EditorMockPlatform } from '../helpers/EditorMockPlatform.ts';

describe('R24 壳布局 computeShellLayout', () => {
  it('无窗口信息兜底：812 全高、无 inset、footer 锚底', () => {
    const l = computeShellLayout(null);
    expect(l.safe).toBe(false);
    expect(l.viewportHeight).toBe(812);
    expect(l.topInset).toBe(0);
    expect(l.bottomInset).toBe(0);
    expect(l.bodyHeight).toBe(812 - SHELL_METRICS.footerHeight);
    expect(l.bodyCenterY).toBeCloseTo((SHELL_METRICS.footerHeight - 0) / 2, 6);
    expect(l.footerTotal).toBe(SHELL_METRICS.footerHeight);
    expect(l.footerBgY).toBeCloseTo(-406 + 36, 6);
    expect(l.footerY).toBeCloseTo(-406 + 36, 6);
    expect(l.contentWidth).toBe(375);
  });

  it('设计基线 375×812 + 刘海安全区（矩形约定）', () => {
    const l = computeShellLayout({
      width: 375,
      height: 812,
      safeArea: { top: 44, bottom: 778, left: 0, right: 375 }, // 顶 44 / 底 34
    });
    expect(l.safe).toBe(true);
    expect(l.topInset).toBe(44);
    expect(l.bottomInset).toBe(34);
    expect(l.footerTotal).toBe(72 + 34);
    expect(l.bodyHeight).toBe(812 - 44 - 106);
    expect(l.bodyCenterY).toBeCloseTo((106 - 44) / 2, 6);
    expect(l.footerBgY).toBeCloseTo(-406 + 53, 6);
    expect(l.footerY).toBeCloseTo(-406 + 34 + 36, 6);
  });

  it('短屏 375×640（无安全区）：body 收缩、footer 跟随可视底', () => {
    const l = computeShellLayout({ width: 375, height: 640 });
    expect(l.viewportHeight).toBe(640);
    expect(l.bodyHeight).toBe(640 - 72);
    expect(l.bodyCenterY).toBeCloseTo(36, 6);
    expect(l.footerY).toBeCloseTo(-320 + 36, 6);
    // 关键：不再依赖整屏缩放，头尾间距 = 真实可视高
    expect(l.bodyHeight + l.footerTotal).toBe(l.viewportHeight);
  });

  it('宽屏 393×852 逻辑像素换算（FIXED_WIDTH unit = 375/393）', () => {
    const unit = 375 / 393;
    const l = computeShellLayout({
      width: 393,
      height: 852,
      safeArea: { top: 59, bottom: 852 - 34, left: 0, right: 393 },
    });
    expect(l.viewportHeight).toBeCloseTo(852 * unit, 6);
    expect(l.topInset).toBeCloseTo(59 * unit, 6);
    expect(l.bottomInset).toBeCloseTo(34 * unit, 6);
    expect(l.footerTotal).toBeCloseTo(72 + 34 * unit, 6);
    expect(l.bodyHeight).toBeCloseTo(852 * unit - 59 * unit - (72 + 34 * unit), 6);
    expect(l.footerY).toBeCloseTo((-852 * unit) / 2 + 34 * unit + 36, 6);
  });

  it('横向 inset：页脚收缩并平移，body 几何不变', () => {
    const l = computeShellLayout({
      width: 375,
      height: 812,
      safeArea: { top: 0, bottom: 812, left: 16, right: 375 - 8 },
    });
    expect(l.leftInset).toBe(16);
    expect(l.rightInset).toBe(8);
    expect(l.contentWidth).toBe(375 - 24);
    expect(l.footerShiftX).toBe((16 - 8) / 2);
    expect(l.bodyHeight).toBe(812 - 72);
  });

  it('极端 inset 收敛：body 不低于下限，输出全为有限值', () => {
    const l = computeShellLayout({
      width: 375,
      height: 812,
      safeArea: { top: 900, bottom: -100, left: 0, right: 375 },
    });
    expect(l.bodyHeight).toBe(SHELL_METRICS.minBodyHeight);
    for (const v of Object.values(l)) {
      if (typeof v === 'number') expect(Number.isFinite(v)).toBe(true);
    }
  });

  it('非法尺寸按兜底处理（不抛异常）', () => {
    const l = computeShellLayout({ width: 0, height: -5 });
    expect(l.safe).toBe(false);
    expect(l.viewportHeight).toBe(812);
  });
});

describe('R24 平台窗口信息', () => {
  it('EditorMockPlatform 默认安全区为矩形约定（顶 44 / 底 34）', () => {
    const p = new EditorMockPlatform();
    const info = p.getWindowInfo();
    expect(info.safeArea).toEqual({ top: 44, bottom: 778, left: 0, right: 375 });
    const l = computeShellLayout(info);
    expect(l.topInset).toBe(44);
    expect(l.bottomInset).toBe(34);
  });

  it('onWindowResize：setWindowInfo 触发订阅，退订后不再触发', () => {
    const p = new EditorMockPlatform();
    const seen = [];
    const off = p.onWindowResize((info) => seen.push(info.width));
    p.setWindowInfo({ width: 393, height: 852 });
    p.setWindowInfo({ width: 360, height: 640 });
    expect(seen).toEqual([393, 360]);
    off();
    p.setWindowInfo({ width: 320, height: 568 });
    expect(seen).toEqual([393, 360]);
  });
});
