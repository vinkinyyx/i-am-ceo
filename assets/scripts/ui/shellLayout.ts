import type { WindowInfo } from '../../core/platform/ITapPlatform';

/**
 * 页面壳布局计算（R24：固定头尾 + 滚动主体 + 真实安全区锚定）。纯 TS、无引擎依赖，可单测。
 *
 * 设计分辨率 375×812（FIXED_WIDTH）：屏宽方向设计坐标与逻辑像素按 unit = 375/windowWidth 换算，
 * 可视高（设计单位）= windowHeight × unit。平台 safeArea 为矩形约定（逻辑像素）：
 * top/left 是安全区左上角坐标，bottom/right 是安全区右下角坐标（同 tap.getWindowInfo）。
 *
 * 输出设计坐标（原点 = 屏幕中心，+Y 向上）：
 * - Body（ScrollView）占据「顶 inset 以下、Footer 以上」的剩余高度；
 * - Footer 背景含底部 inset 抬升，按钮行位于 inset 之上；
 * - 横向 inset 以页脚宽度收缩 + 水平平移体现（竖屏内容宽恒为 375）。
 */
export const SHELL_METRICS = {
  designWidth: 375,
  designHeight: 812,
  /** 底部 Tab 栏视觉高度（不含底部 inset） */
  footerHeight: 72,
  /** 内容实际下探后额外留白 */
  contentBottomMargin: 8,
  /** Body 可视高度下限，防极端 inset 把内容区压没 */
  minBodyHeight: 320,
} as const;

export interface ShellLayout {
  /** 可视高度（设计单位） */
  viewportHeight: number;
  /** 四边安全区内边距（设计单位） */
  topInset: number;
  bottomInset: number;
  leftInset: number;
  rightInset: number;
  /** Body（ScrollView）可视高 */
  bodyHeight: number;
  /** Body 中心 Y */
  bodyCenterY: number;
  /** Footer 背景总高（Tab 栏 + 底部 inset） */
  footerTotal: number;
  /** Footer 背景（含 inset）中心 Y */
  footerBgY: number;
  /** Footer 按钮行中心 Y（相对屏幕） */
  footerY: number;
  /** Footer 可视宽（扣除横向 inset） */
  contentWidth: number;
  /** Footer 水平平移（横向 inset 不对称时） */
  footerShiftX: number;
  /** 是否取得真实窗口信息（false = 无平台数据兜底） */
  safe: boolean;
}

function clampInset(value: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(value, max));
}

export function computeShellLayout(info: WindowInfo | null): ShellLayout {
  const m = SHELL_METRICS;
  const valid = !!info && Number.isFinite(info.width) && info.width > 0 && Number.isFinite(info.height) && info.height > 0;
  const winW = valid ? info.width : m.designWidth;
  const winH = valid ? info.height : m.designHeight;

  // FIXED_WIDTH：设计宽恒铺满屏宽
  const unit = m.designWidth / winW;
  const viewportHeight = winH * unit;

  let topInset = 0;
  let bottomInset = 0;
  let leftInset = 0;
  let rightInset = 0;
  const area = valid ? info?.safeArea : undefined;
  if (area) {
    topInset = clampInset(area.top, winH) * unit;
    bottomInset = clampInset(winH - area.bottom, winH) * unit;
    leftInset = clampInset(area.left, winW) * unit;
    rightInset = clampInset(winW - area.right, winW) * unit;
  }

  const half = viewportHeight / 2;
  const footerTotal = m.footerHeight + bottomInset;
  const bodyHeight = Math.max(m.minBodyHeight, viewportHeight - topInset - footerTotal);
  // bodyTop = half - topInset；bodyBottom = -half + footerTotal
  const bodyCenterY = (footerTotal - topInset) / 2;

  return {
    viewportHeight,
    topInset,
    bottomInset,
    leftInset,
    rightInset,
    bodyHeight,
    bodyCenterY,
    footerTotal,
    footerBgY: -half + footerTotal / 2,
    footerY: -half + bottomInset + m.footerHeight / 2,
    contentWidth: Math.max(m.designWidth - leftInset - rightInset, m.designWidth * 0.6),
    footerShiftX: (leftInset - rightInset) / 2,
    safe: valid,
  };
}

// ---------------------------------------------------------------- 通用滚动页（R27）

export interface PaneOptions {
  /** 固定页头高度（设计单位，不含顶部 inset） */
  headerHeight?: number;
  /** 固定页脚高度（设计单位，不含底部 inset） */
  footerHeight?: number;
  minBodyHeight?: number;
}

export interface PaneLayout {
  headerHeight: number;
  footerHeight: number;
  /** 滚动主体可视高 */
  bodyHeight: number;
  bodyCenterY: number;
  /** 滚动主体可视顶（设计坐标） */
  bodyTopY: number;
  /** 滚动主体可视底（设计坐标） */
  bodyBottomY: number;
  /** 页脚背景总高（含底部 inset） */
  footerTotal: number;
  footerBgY: number;
  /** 页脚按钮行中心 Y（已抬升到 inset 之上） */
  footerRowY: number;
}

/**
 * 通用固定头尾 + 滚动主体几何（创建三步页与后续详情页复用）。
 * 页头在顶部 inset 之下，页脚占「底部 inset + 页脚高」，中间剩余部分滚动。
 */
export function computePaneLayout(layout: ShellLayout, options: PaneOptions = {}): PaneLayout {
  const headerHeight = Math.max(0, options.headerHeight ?? 0);
  const footerHeight = Math.max(0, options.footerHeight ?? 0);
  const half = layout.viewportHeight / 2;
  const footerTotal = footerHeight + layout.bottomInset;
  const bodyTopY = half - layout.topInset - headerHeight;
  const bodyBottomY = -half + footerTotal;
  const bodyHeight = Math.max(
    options.minBodyHeight ?? SHELL_METRICS.minBodyHeight,
    bodyTopY - bodyBottomY,
  );
  return {
    headerHeight,
    footerHeight,
    bodyHeight,
    bodyCenterY: (bodyTopY + bodyBottomY) / 2,
    bodyTopY,
    bodyBottomY,
    footerTotal,
    footerBgY: -half + footerTotal / 2,
    footerRowY: -half + layout.bottomInset + footerHeight / 2,
  };
}

export interface ScrollBodyGeometry {
  contentHeight: number;
  /** 内容容器整体位移（authored 坐标 → 内容坐标） */
  shift: number;
  /** 内容容器相对滚动视图中心的 Y */
  contentY: number;
}

/**
 * 滚动内容几何：authored 坐标以 812 中心原点书写，authoredTop（默认 406）对齐可视顶；
 * 内容高覆盖实际下探，短屏时自动变高以产生滚动。
 */
export function computeScrollBody(
  bodyHeight: number,
  minBottom: number,
  authoredTop = SHELL_METRICS.designHeight / 2,
  bottomMargin = SHELL_METRICS.contentBottomMargin,
): ScrollBodyGeometry {
  const contentHeight = Math.max(bodyHeight, SHELL_METRICS.designHeight, authoredTop - minBottom + bottomMargin);
  return {
    contentHeight,
    shift: contentHeight / 2 - authoredTop,
    contentY: (bodyHeight - contentHeight) / 2,
  };
}
