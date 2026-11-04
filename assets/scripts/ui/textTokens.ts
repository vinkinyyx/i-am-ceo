/**
 * R23：语义化文字/间距/热区令牌（§15.7 / §14.7）。
 * 禁止默认 SHRINK 缩字：正文 14—16、辅助文字 ≥12、按钮有效热区 ≥44×44。
 * createLabel/createButton 必须引用这些令牌，不允许在调用处靠缩小字号挤空间。
 */

export type TextRole = 'heading' | 'title' | 'body' | 'bodyStrong' | 'caption' | 'money' | 'button';

export interface TextStyle {
  fontSize: number;
  lineHeight: number;
}

export const TEXT_TOKENS: Record<TextRole, TextStyle> = {
  heading: { fontSize: 20, lineHeight: 28 },
  title: { fontSize: 17, lineHeight: 24 },
  bodyStrong: { fontSize: 15, lineHeight: 22 },
  body: { fontSize: 14, lineHeight: 21 },
  caption: { fontSize: 12, lineHeight: 18 },
  money: { fontSize: 16, lineHeight: 22 },
  button: { fontSize: 15, lineHeight: 21 },
};

export const SPACE_TOKENS = {
  /** 卡片内边距 */
  cardPadding: 12,
  /** 卡片间距 */
  cardGap: 10,
  /** 操作行间距 */
  rowGap: 8,
  /** 列表分组间距 */
  sectionGap: 16,
};

/** 最小触控热区（逻辑像素）。 */
export const TOUCH_TARGET = {
  width: 44,
  height: 44,
  /** 相邻可点元素最小间距，避免贴边误触 */
  gap: 8,
};

/** 运行时几何守卫：任何按钮/热区小于此值会在开发环境报警并返回修正值。 */
export function ensureTouchSize(width: number, height: number): { width: number; height: number } {
  return {
    width: Math.max(width, TOUCH_TARGET.width),
    height: Math.max(height, TOUCH_TARGET.height),
  };
}

export function textStyle(role: TextRole): TextStyle {
  return TEXT_TOKENS[role];
}
