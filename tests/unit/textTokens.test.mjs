// R23：文字/热区令牌运行时守卫（脚本层纯 TS 经 esbuild 转译可直接 import）。
import { describe, it, expect } from 'vitest';
import { TEXT_TOKENS, TOUCH_TARGET, ensureTouchSize, SPACE_TOKENS } from '../../assets/scripts/ui/textTokens.ts';

describe('R23 文字令牌', () => {
  it('辅助文字最小 12，正文 14—16，按钮 15', () => {
    expect(TEXT_TOKENS.caption.fontSize).toBe(12);
    expect(TEXT_TOKENS.body.fontSize).toBeGreaterThanOrEqual(14);
    expect(TEXT_TOKENS.body.fontSize).toBeLessThanOrEqual(16);
    expect(TEXT_TOKENS.button.fontSize).toBe(15);
    Object.values(TEXT_TOKENS).forEach((t) => {
      expect(t.lineHeight).toBeGreaterThanOrEqual(t.fontSize + 3);
    });
  });

  it('间距令牌齐全', () => {
    for (const k of ['cardPadding', 'cardGap', 'rowGap', 'sectionGap']) {
      expect(SPACE_TOKENS[k]).toBeGreaterThan(0);
    }
  });
});

describe('R23 热区', () => {
  it('ensureTouchSize 不小于 44×44，已大的不缩小', () => {
    expect(ensureTouchSize(30, 38)).toEqual({ width: 44, height: 44 });
    expect(ensureTouchSize(200, 46)).toEqual({ width: 200, height: 46 });
    expect(TOUCH_TARGET.gap).toBe(8);
  });
});
