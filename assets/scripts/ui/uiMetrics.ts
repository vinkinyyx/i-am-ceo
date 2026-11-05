/**
 * R31：交互控件的统一几何令牌（无引擎依赖，可直接单测）。
 * 背景：旧页面的按钮由各调用点自行给高度/宽度，出现 38/40/42/46 混用、
 * 同组按钮不等宽、文字与按钮宽度不匹配。这里把“按钮基线 / 操作行分配 /
 * 文本宽度估算”统一到一处，页面只描述语义（主操作、行内动作、开关）。
 */

/** 按钮基线：常规按钮 48 高；最小热区 44×44；相邻按钮最小间距 8。 */
export const BUTTON_BASELINE = {
  height: 48,
  minWidth: 80,
  gap: 8,
  paddingX: 12,
  minHit: 44,
} as const;

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'toggle' | 'compact';

/** 同一变体的按钮必须同高；toggle 仅宽度更窄。 */
export const BUTTON_VARIANTS: Record<ButtonVariant, { height: number; minWidth: number }> = {
  primary: { height: 48, minWidth: 120 },
  secondary: { height: 48, minWidth: 100 },
  danger: { height: 48, minWidth: 100 },
  ghost: { height: 48, minWidth: 80 },
  toggle: { height: 48, minWidth: 64 },
  compact: { height: 48, minWidth: 44 },
};

export interface ActionRowItem {
  width: number;
  /** 以行中心为原点的 X 坐标 */
  x: number;
}

/**
 * 把一组按钮等宽排在给定总宽内。
 * 放不下时按最小宽度等比压缩（仍保持 gap），由调用方负责换行。
 */
export function layoutActionRow(totalWidth: number, count: number, gap = BUTTON_BASELINE.gap): ActionRowItem[] {
  if (!Number.isFinite(totalWidth) || totalWidth <= 0 || count <= 0) return [];
  const slots = count - 1;
  const usable = Math.max(1, totalWidth - slots * gap);
  const width = usable / count;
  const left = -totalWidth / 2 + width / 2;
  return Array.from({ length: count }, (_, index) => ({
    width,
    x: left + index * (width + gap),
  }));
}

/**
 * 估算单行文本宽度（CJK/全角按 1em，ASCII 按 0.56em）。
 * 用于在创建文案时提前判断按钮宽度是否足够，避免运行时静默缩字/截断。
 */
export function estimateTextWidth(text: string, fontSize: number): number {
  let units = 0;
  for (const ch of Array.from(text)) {
    if (isWideChar(ch)) units += 1;
    else if (ch === ' ') units += 0.28;
    else units += 0.56;
  }
  return Math.ceil(units * fontSize);
}

function isWideChar(ch: string): boolean {
  const code = ch.codePointAt(0) ?? 0;
  return (
    (code >= 0x2e80 && code <= 0x9fff) ||
    (code >= 0xac00 && code <= 0xd7af) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xff00 && code <= 0xffef) ||
    (code >= 0x1f300 && code <= 0x1faff)
  );
}

/** 单行按钮文字可用宽度（扣除左右内边距）。 */
export function buttonTextCapacity(buttonWidth: number): number {
  return Math.max(0, buttonWidth - BUTTON_BASELINE.paddingX * 2);
}

/**
 * 估算换行 Label 的行数：显式 \n 逐段计算，CJK 按 1em、ASCII 按 0.56em。
 * 只用于创建时的初值，最终高度仍由 Label 的 RESIZE_HEIGHT 决定。
 */
export function estimateWrappedLines(text: string, fontSize: number, width: number): number {
  const usable = Math.max(1, width - 4);
  let total = 0;
  for (const paragraph of text.split('\n')) {
    if (paragraph.length === 0) {
      total += 1;
      continue;
    }
    total += Math.max(1, Math.ceil(estimateTextWidth(paragraph, fontSize) / usable));
  }
  return Math.max(1, total);
}

/** 文案是否能在给定按钮宽度内单行展示。 */
export function fitsButtonLabel(text: string, fontSize: number, buttonWidth: number): boolean {
  return estimateTextWidth(text, fontSize) <= buttonTextCapacity(buttonWidth);
}
