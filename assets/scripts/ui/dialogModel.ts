/**
 * R25：弹窗通用件的纯逻辑（无引擎依赖，Node 可直接单测）。
 * - 几何分配：卡片在可视区内自适应，长正文给 ScrollView，底部操作常驻；
 * - 确认状态机：一次开框一个意图，连点只提交一次，忙碌/未知状态禁止关闭与重试；
 * - 输入校验：可见字数（emoji 计 1）、空值/超长文案、键盘弹出时的卡片位置的避让计算。
 */

export type DialogPhase = 'IDLE' | 'SUBMITTING' | 'UNCERTAIN' | 'FAILED' | 'CLOSED';

export const DIALOG_METRICS = {
  /** 卡片默认宽（375 设计宽下留 24 边距，含阴影呼吸空间） */
  width: 320,
  /** 标题区高（标题 + 副标题 + 上下留白） */
  titleHeight: 56,
  /** 底部固定操作区高（两行按钮） */
  footerHeight: 108,
  /** 卡片距屏幕边缘的最小间距 */
  margin: 20,
  /** 正文可视高下限（再小的屏也保证基本可读） */
  minBodyHeight: 96,
} as const;

// ---------------------------------------------------------------- 确认状态机

/**
 * 确认操作状态机（R25 T03/T04）。
 * - `begin()` 只有在 IDLE/FAILED 时成功：快速连点只产生一次意图；
 * - SUBMITTING：提交中，不能关闭、不能再次提交；
 * - UNCERTAIN：结果未知（超时/平台无响应），保持锁定，避免“关掉弹窗再点一次”造成重复收费；
 * - FAILED：明确失败，允许同 commandId 重试，也允许取消关闭。
 */
export class ConfirmGuard {
  private current: DialogPhase = 'IDLE';
  private submitCount = 0;

  get phase(): DialogPhase {
    return this.current;
  }

  /** 本弹窗已发起的提交次数（幂等重试仍记多次，便于证据核对）。 */
  get attempts(): number {
    return this.submitCount;
  }

  get busy(): boolean {
    return this.current === 'SUBMITTING' || this.current === 'UNCERTAIN';
  }

  get canClose(): boolean {
    return this.current === 'IDLE' || this.current === 'FAILED';
  }

  get canConfirm(): boolean {
    return this.canClose;
  }

  begin(): boolean {
    if (!this.canConfirm) return false;
    this.current = 'SUBMITTING';
    this.submitCount += 1;
    return true;
  }

  fail(): void {
    if (this.current === 'SUBMITTING') this.current = 'FAILED';
  }

  /** 结果未知：保持锁定（不恢复按钮、不允许关闭），直到调用方确认最终结果。 */
  markUncertain(): void {
    if (this.current === 'SUBMITTING') this.current = 'UNCERTAIN';
  }

  /** 提交成功：从 SUBMITTING 直接进入 CLOSED（其他状态拒绝）。 */
  succeed(): boolean {
    if (this.current !== 'SUBMITTING') return false;
    this.current = 'CLOSED';
    return true;
  }

  /** 关闭（用户取消）。忙碌/未知时拒绝。 */
  close(): boolean {
    if (!this.canClose) return false;
    this.current = 'CLOSED';
    return true;
  }
}

// ---------------------------------------------------------------- 几何

export interface DialogGeometryInput {
  viewportHeight: number;
  /** 期望的正文可视高（内容自然高或设计值） */
  desiredBodyHeight: number;
  titleHeight?: number;
  footerHeight?: number;
  margin?: number;
  minBodyHeight?: number;
}

export interface DialogGeometry {
  cardHeight: number;
  bodyHeight: number;
  /** 正文被压缩（内容需要滚动） */
  clamped: boolean;
}

/** 卡片总高 = 标题 + 正文 + 底部；正文按可视区压缩，绝不超出屏幕。 */
export function computeDialogGeometry(input: DialogGeometryInput): DialogGeometry {
  const margin = input.margin ?? DIALOG_METRICS.margin;
  const titleHeight = input.titleHeight ?? DIALOG_METRICS.titleHeight;
  const footerHeight = input.footerHeight ?? DIALOG_METRICS.footerHeight;
  const minBodyHeight = input.minBodyHeight ?? DIALOG_METRICS.minBodyHeight;

  const viewportHeight = Number.isFinite(input.viewportHeight) && input.viewportHeight > 0
    ? input.viewportHeight
    : 812;
  const maxBodyHeight = Math.max(minBodyHeight, viewportHeight - margin * 2 - titleHeight - footerHeight);
  const desired = Number.isFinite(input.desiredBodyHeight) ? input.desiredBodyHeight : minBodyHeight;
  const bodyHeight = Math.max(minBodyHeight, Math.min(desired, maxBodyHeight));
  return {
    cardHeight: titleHeight + bodyHeight + footerHeight,
    bodyHeight,
    clamped: bodyHeight < desired,
  };
}

/**
 * 输入框卡片的 Y（设计坐标，原点屏幕中心）。
 * 键盘弹出时下半屏被遮挡，卡片固定放在上半区；同时不越过屏幕顶部。
 */
export function computeInputCardY(viewportHeight: number, cardHeight: number, margin = 24): number {
  const height = Number.isFinite(viewportHeight) && viewportHeight > 0 ? viewportHeight : 812;
  const topAlignedY = height / 2 - margin - cardHeight / 2;
  const upperHalfY = height / 4;
  return Math.min(topAlignedY, upperHalfY);
}

/** 可见字形数（emoji/代理对按 1 个计，与领域层 visibleLength 一致）。 */
export function dialogInputLength(raw: string): number {
  return Array.from(raw).length;
}

export interface DialogInputRule {
  minLength: number;
  maxLength: number;
}

/** 输入框的基础校验（空值/字数）；业务规则（敏感词/标签等）由调用方传入 validate 补充。 */
export function basicInputError(raw: string, rule: DialogInputRule): string | null {
  const value = raw.trim();
  if (value.length === 0) return '内容不能为空';
  const len = dialogInputLength(value);
  if (len < rule.minLength) return `至少 ${rule.minLength} 个字`;
  if (len > rule.maxLength) return `最多 ${rule.maxLength} 个字`;
  return null;
}
