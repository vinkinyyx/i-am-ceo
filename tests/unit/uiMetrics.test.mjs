// R31：按钮/操作行几何令牌（纯 TS，经 esbuild 转译直测）。
import { describe, it, expect } from 'vitest';
import {
  BUTTON_BASELINE,
  BUTTON_VARIANTS,
  buttonTextCapacity,
  estimateTextWidth,
  estimateWrappedLines,
  fitsButtonLabel,
  layoutActionRow,
} from '../../assets/scripts/ui/uiMetrics.ts';

describe('R31 按钮基线', () => {
  it('常规按钮 48 高，最小热区 44，间距 8', () => {
    expect(BUTTON_BASELINE.height).toBe(48);
    expect(BUTTON_BASELINE.minHit).toBe(44);
    expect(BUTTON_BASELINE.gap).toBe(8);
  });

  it('所有变体统一 48 高，开关不小于 44', () => {
    Object.values(BUTTON_VARIANTS).forEach((v) => {
      expect(v.height).toBe(48);
      expect(v.minWidth).toBeGreaterThanOrEqual(44);
    });
  });
});

describe('R31 操作行等宽等距', () => {
  it('两按钮填满内宽，间距恰好 8', () => {
    const [a, b] = layoutActionRow(292, 2, 8);
    expect(a.width).toBeCloseTo(142, 5);
    expect(b.width).toBeCloseTo(142, 5);
    expect(b.x - a.x - a.width).toBeCloseTo(8, 5);
    expect(a.x).toBeCloseTo(-75, 5);
    expect(b.x).toBeCloseTo(75, 5);
  });

  it('三按钮仍等宽，总宽度不超父内宽', () => {
    const items = layoutActionRow(288, 3, 8);
    expect(items).toHaveLength(3);
    const left = items[0].x - items[0].width / 2;
    const right = items[2].x + items[2].width / 2;
    expect(right - left).toBeCloseTo(288, 5);
    expect(items[0].width).toBeCloseTo(items[2].width, 5);
  });

  it('非法输入返回空数组，不产生 NaN 坐标', () => {
    expect(layoutActionRow(0, 2)).toEqual([]);
    expect(layoutActionRow(Number.NaN, 2)).toEqual([]);
    expect(layoutActionRow(200, 0)).toEqual([]);
  });
});

describe('R31 文案宽度测量', () => {
  it('CJK 按 1em，ASCII 更窄；测量随字号线性变化', () => {
    expect(estimateTextWidth('关闭', 15)).toBeGreaterThanOrEqual(30);
    expect(estimateTextWidth('关', 15)).toBeGreaterThan(estimateTextWidth('C', 15));
    expect(estimateTextWidth('关闭', 30)).toBe(estimateTextWidth('关闭', 15) * 2);
  });

  it('容量扣除左右内边距，长文案不可单行时判失败', () => {
    expect(buttonTextCapacity(48)).toBe(24);
    expect(fitsButtonLabel('关闭', 15, 80)).toBe(true);
    expect(fitsButtonLabel('关闭', 15, 44)).toBe(false);
  });

  it('换行行数按宽度估算：空段算一行，长中文会多行', () => {
    expect(estimateWrappedLines('', 15, 100)).toBe(1);
    expect(estimateWrappedLines('第一行\n第二行', 15, 200)).toBe(2);
    expect(estimateWrappedLines('一'.repeat(30), 15, 200)).toBeGreaterThan(1);
    expect(estimateWrappedLines('短', 15, 200)).toBe(1);
  });
});
