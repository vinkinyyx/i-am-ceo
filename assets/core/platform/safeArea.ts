import type { SafeArea, WindowInfo } from './ITapPlatform';

/**
 * 安全区适配计算（设计文档 08 / A21）。纯 TS、无引擎依赖，可单测。
 *
 * 设计分辨率 375×812（FIXED_WIDTH）。平台 getWindowInfo 的单位为逻辑像素
 * （windowWidth/windowHeight 即 CSS 像素），safeArea 四边同为距屏幕物理边缘的
 * 逻辑像素；FIXED_WIDTH 下设计坐标与逻辑像素水平方向 1:1，可直接换算。
 *
 * 输出让 375×812 内容层在安全区内等比缩放、居中：
 * - scale：安全区可用尺寸相对设计尺寸的缩放（取宽/高较小者，内容不被裁切）；
 * - offsetX/offsetY：因安全区上下/左右不对称，内容中心相对屏幕中心的设计坐标偏移。
 */
export interface SafeAreaTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
  /** 是否取得了真实安全区（false = 全屏无避让）。 */
  applied: boolean;
}

export const SAFE_DESIGN_WIDTH = 375;
export const SAFE_DESIGN_HEIGHT = 812;

const IDENTITY: SafeAreaTransform = { scale: 1, offsetX: 0, offsetY: 0, applied: false };

export function computeSafeAreaTransform(
  info: WindowInfo,
  design: { width: number; height: number } = { width: SAFE_DESIGN_WIDTH, height: SAFE_DESIGN_HEIGHT },
): SafeAreaTransform {
  const area: SafeArea | undefined = info.safeArea;
  const winW = info.width > 0 ? info.width : design.width;
  const winH = info.height > 0 ? info.height : design.height;

  if (!area) return IDENTITY;

  // 安全区四边（逻辑像素）；容忍越界/缺省值
  const insetLeft = Math.max(0, Math.min(area.left, winW));
  const insetRight = Math.max(0, Math.min(winW - area.right, winW));
  const insetTop = Math.max(0, Math.min(area.top, winH));
  const insetBottom = Math.max(0, Math.min(winH - area.bottom, winH));

  const safeW = winW - insetLeft - insetRight;
  const safeH = winH - insetTop - insetBottom;
  if (safeW <= 0 || safeH <= 0) return IDENTITY;

  const scale = Math.min(safeW / design.width, safeH / design.height);
  if (!Number.isFinite(scale) || scale <= 0) return IDENTITY;

  // 屏幕中心到安全区中心 = (底部内边距 - 顶部内边距)/2；
  // 除以内容层 scale 换算回设计坐标
  const offsetY = (insetBottom - insetTop) / 2 / scale;
  const offsetX = (insetRight - insetLeft) / 2 / scale;

  if (insetLeft + insetRight + insetTop + insetBottom === 0) return IDENTITY;

  return { scale, offsetX, offsetY, applied: true };
}
