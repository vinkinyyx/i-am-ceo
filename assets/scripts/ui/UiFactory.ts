import {
  BlockInputEvents,
  Button,
  Color,
  HorizontalTextAlignment,
  Label,
  Layout,
  Node,
  ScrollView,
  Size,
  UITransform,
  Vec3,
  VerticalTextAlignment,
  Widget,
  Graphics,
  Mask,
  Overflow,
  Sprite,
  SpriteFrame,
  resources,
  isValid,
} from 'cc';
import { THEME } from './theme';
import { ensureTouchSize, TEXT_TOKENS } from './textTokens';
import { moneyText } from './money';
import {
  BUTTON_BASELINE,
  BUTTON_VARIANTS,
  type ButtonVariant,
  buttonTextCapacity,
  estimateTextWidth,
  estimateWrappedLines,
  layoutActionRow,
} from './uiMetrics';

export { moneyText };

/** Decorative background only; real controls/text remain independent Cocos nodes. */
export function attachCoverBackground(parent: Node, resourceKey: string): void {
  const image = new Node('BackgroundImage');
  image.parent = parent;
  const transform = image.addComponent(UITransform);
  const sprite = image.addComponent(Sprite);
  sprite.sizeMode = Sprite.SizeMode.CUSTOM;
  const resize = (): void => {
    const target = parent.getComponent(UITransform);
    const source = sprite.spriteFrame?.originalSize;
    if (!target || !source || source.width <= 0 || source.height <= 0) return;
    const scale = Math.max(target.width / source.width, target.height / source.height);
    transform.setContentSize(source.width * scale, source.height * scale);
  };
  parent.on(Node.EventType.SIZE_CHANGED, resize);
  resources.load(resourceKey, SpriteFrame, (error, frame) => {
    if (!isValid(parent, true) || !isValid(image, true)) return;
    if (error || !frame) {
      console.warn('[background] image unavailable; keeping theme color');
      return;
    }
    sprite.spriteFrame = frame;
    resize();
    // Keep the solid-color fallback until the optional texture is ready.
    const fallback = parent.getComponent(Graphics);
    if (fallback) fallback.enabled = false;
  });
}

/**
 * 代码驱动 UI 工厂（设计文档 07 / 13.4）。
 * 控件使用引擎原生 Graphics/Label/Button，装饰底图可选加载；动态文字由 Label 渲染。
 */

export interface RectOptions {
  name?: string;
  width: number;
  height: number;
  color?: Color;
  parent?: Node;
  radius?: number;
}

/** 圆角/纯色矩形卡片（用 Graphics 绘制九宫格底色，避免依赖图片资源）。 */
export function createRect(opts: RectOptions): Node {
  const node = new Node(opts.name ?? 'Rect');
  const tr = node.addComponent(UITransform);
  tr.setContentSize(new Size(opts.width, opts.height));
  if (opts.parent) node.parent = opts.parent;

  const g = node.addComponent(Graphics);
  const color = opts.color ?? THEME.card;
  g.fillColor = color;
  g.roundRect(-opts.width / 2, -opts.height / 2, opts.width, opts.height, opts.radius ?? 8);
  g.fill();
  return node;
}

export interface LabelOptions {
  name?: string;
  text: string;
  fontSize?: number;
  color?: Color;
  width?: number;
  height?: number;
  bold?: boolean;
  align?: 'left' | 'center' | 'right';
  parent?: Node;
  lineHeight?: number;
}

export function createLabel(opts: LabelOptions): Node {
  const node = new Node(opts.name ?? 'Label');
  if (opts.parent) node.parent = opts.parent;
  const tr = node.addComponent(UITransform);
  // R23：字号下限 12；默认行高取语义令牌近似（body），禁止靠缩字塞内容
  const fontSize = Math.max(opts.fontSize ?? TEXT_TOKENS.body.fontSize, TEXT_TOKENS.caption.fontSize);
  const lineHeight = opts.lineHeight ?? Math.round(fontSize * 1.45);
  // R31：换行 Label 在创建时按“估算行数 × 行高”给初值，避免 Layout 首帧把下一行叠到正文上。
  const width = opts.width ?? 200;
  const estimatedLines = opts.width ? estimateWrappedLines(opts.text, fontSize, width) : 1;
  const height = opts.height ?? lineHeight * estimatedLines;
  tr.setContentSize(new Size(width, height));
  const label = node.addComponent(Label);
  label.string = opts.text;
  label.fontSize = fontSize;
  label.lineHeight = lineHeight;
  label.color = opts.color ?? THEME.text;
  label.isBold = opts.bold ?? false;
  label.horizontalAlign =
    opts.align === 'left'
      ? HorizontalTextAlignment.LEFT
      : opts.align === 'right'
        ? HorizontalTextAlignment.RIGHT
        : HorizontalTextAlignment.CENTER;
  label.verticalAlign = VerticalTextAlignment.TOP;
  // R23：有宽度时按宽度换行并向下撑高；单行无宽度时自适应；不再默认 SHRINK 缩字
  label.overflow = opts.width ? Overflow.RESIZE_HEIGHT : Overflow.NONE;
  if (opts.width) label.enableWrapText = true;
  return node;
}

export interface ButtonOptions {
  name?: string;
  text: string;
  width: number;
  height?: number;
  color?: Color;
  textColor?: Color;
  fontSize?: number;
  parent?: Node;
  onClick: () => void;
  disabled?: boolean;
  /** R31：语义变体。声明后强制同一变体同高（48），并参与几何验收。 */
  variant?: ButtonVariant;
}

interface ButtonVisualState {
  label: Node;
  color: Color;
  textColor: Color;
  width: number;
  height: number;
  radius: number;
}

const BUTTON_VISUALS = new WeakMap<Node, ButtonVisualState>();

/** 重绘按钮底色；只改颜色/透明度，不改布局尺寸。 */
function paintButton(node: Node, state: ButtonVisualState, color: Color, textColor: Color): void {
  const graphics = node.getComponent(Graphics);
  const tr = node.getComponent(UITransform);
  if (graphics && tr) {
    graphics.clear();
    graphics.fillColor = color;
    graphics.roundRect(-tr.width / 2, -tr.height / 2, tr.width, tr.height, state.radius);
    graphics.fill();
  }
  const label = state.label.getComponent(Label);
  if (label) label.color = textColor;
}

/** 按当前运行态启/禁按钮；与创建时的初始 disabled 解耦。 */
export function setButtonEnabled(node: Node, enabled: boolean): void {
  if (!isValid(node, true)) return;
  const state = BUTTON_VISUALS.get(node);
  const button = node.getComponent(Button);
  if (button) button.interactable = enabled;
  if (!state) return;
  paintButton(node, state, enabled ? state.color : THEME.disabled, enabled ? state.textColor : THEME.textWeak);
}

export function isButtonEnabled(node: Node): boolean {
  const button = node.getComponent(Button);
  return Boolean(button && button.interactable);
}

/** 就地更新开关类按钮的底色/文字色（不重建节点，不改变几何）。 */
export function setButtonLook(node: Node, color: Color, textColor: Color): void {
  if (!isValid(node, true)) return;
  const state = BUTTON_VISUALS.get(node);
  if (!state) return;
  state.color = color;
  state.textColor = textColor;
  const enabled = node.getComponent(Button)?.interactable ?? true;
  paintButton(node, state, enabled ? color : THEME.disabled, enabled ? textColor : THEME.textWeak);
}

/** 就地更新按钮文案（保持同一按钮框，不重建节点）。 */
export function setButtonLabel(node: Node, text: string): void {
  const state = BUTTON_VISUALS.get(node);
  const label = state?.label.getComponent(Label);
  if (!label) return;
  label.string = text;
  if (state) {
    const capacity = buttonTextCapacity(state.width);
    if (estimateTextWidth(text, label.fontSize) > capacity) {
      console.warn(`[ui] button label overflows: "${text}" (${estimateTextWidth(text, label.fontSize)} > ${capacity})`);
    }
  }
}

export function getButtonLabel(node: Node): string {
  return stateLabelString(node);
}

function stateLabelString(node: Node): string {
  const state = BUTTON_VISUALS.get(node);
  return state?.label.getComponent(Label)?.string ?? '';
}

export function createButton(opts: ButtonOptions): Node {
  const variant = opts.variant;
  const minHeight = variant ? BUTTON_VARIANTS[variant].height : BUTTON_BASELINE.minHit;
  // 常规按钮统一 48 高；未声明变体的旧入口保留 44 触控底线，避免历史坐标组整体错位。
  const requestedHeight = opts.height ?? (variant ? BUTTON_VARIANTS[variant].height : BUTTON_BASELINE.minHit);
  const touch = ensureTouchSize(opts.width, Math.max(requestedHeight, minHeight));
  const height = touch.height;
  const radius = 8;
  const node = createRect({
    name: opts.name ?? 'Button',
    width: touch.width,
    height,
    color: opts.disabled ? THEME.disabled : (opts.color ?? THEME.primary),
    radius,
    parent: opts.parent,
  });
  // 拦截点击穿透
  node.addComponent(BlockInputEvents);

  // R31/V05：Label 无条件挂到 Button；支持先创建、后挂载父节点。
  const labelNode = new Node('ButtonLabel');
  labelNode.parent = node;
  labelNode.setPosition(Vec3.ZERO);
  const tr = labelNode.addComponent(UITransform);
  const contentWidth = Math.max(1, touch.width - BUTTON_BASELINE.paddingX * 2);
  tr.setContentSize(new Size(contentWidth, height));
  const label = labelNode.addComponent(Label);
  label.string = opts.text;
  label.fontSize = opts.fontSize ?? (variant === 'compact' ? 14 : 15);
  // R31：行高使用文字令牌，不再等于按钮高度。
  label.lineHeight = variant === 'compact' ? TEXT_TOKENS.caption.lineHeight : TEXT_TOKENS.button.lineHeight;
  label.color = opts.textColor ?? Color.WHITE;
  label.isBold = true;
  label.horizontalAlign = HorizontalTextAlignment.CENTER;
  label.verticalAlign = VerticalTextAlignment.CENTER;
  label.overflow = Overflow.NONE; // 单行禁止换行/缩字，调用方负责宽度
  label.enableWrapText = false;

  const textColor = opts.textColor ?? Color.WHITE;
  const fillColor = opts.color ?? THEME.primary;
  if (estimateTextWidth(opts.text, label.fontSize) > contentWidth) {
    // 开发期可定位警告：长文案必须由调用方改宽度/换行/缩短，不能静默裁字。
    console.warn(
      `[ui] button label overflow at create: "${opts.text}" (${estimateTextWidth(opts.text, label.fontSize)} > ${contentWidth})`,
    );
  }

  const button = node.addComponent(Button);
  button.transition = Button.Transition.SCALE;
  button.zoomScale = 0.96;
  button.interactable = !opts.disabled;
  BUTTON_VISUALS.set(node, { label: labelNode, color: fillColor, textColor, width: touch.width, height, radius });
  node.on(Button.EventType.CLICK, () => {
    // V07：读取当前 interactable，而不是创建时的 opts.disabled 闭包。
    if (!node.getComponent(Button)?.interactable) return;
    opts.onClick();
  });
  return node;
}

/** 生成一行等宽按钮；按钮数量/宽度由可用宽与 gap 统一决定。 */
export function createActionRow(
  parent: Node,
  totalWidth: number,
  buttons: Array<Omit<ButtonOptions, 'parent' | 'width'>>,
  y = 0,
  gap = BUTTON_BASELINE.gap,
): Node[] {
  const items = layoutActionRow(totalWidth, buttons.length, gap);
  return buttons.map((spec, index) => {
    const item = items[index]!;
    const node = createButton({
      ...spec,
      parent,
      width: item.width,
      height: spec.height ?? BUTTON_BASELINE.height,
      variant: spec.variant ?? 'secondary',
    });
    node.setPosition(item.x, y);
    return node;
  });
}

/** 让节点四边对齐父节点（安全区/全屏面板用）。 */
export function stretchToParent(node: Node, top = 0, bottom = 0, left = 0, right = 0): Widget {
  const widget = node.getComponent(Widget) ?? node.addComponent(Widget);
  widget.isAlignTop = true;
  widget.isAlignBottom = true;
  widget.isAlignLeft = true;
  widget.isAlignRight = true;
  widget.top = top;
  widget.bottom = bottom;
  widget.left = left;
  widget.right = right;
  widget.alignMode = Widget.AlignMode.ON_WINDOW_RESIZE;
  return widget;
}

export function addVerticalLayout(
  node: Node,
  spacing = 8,
  padding = 12,
): Layout {
  const layout = node.getComponent(Layout) ?? node.addComponent(Layout);
  layout.type = Layout.Type.VERTICAL;
  layout.spacingY = spacing;
  layout.paddingTop = padding;
  layout.paddingBottom = padding;
  layout.paddingLeft = padding;
  layout.paddingRight = padding;
  layout.horizontalDirection = Layout.HorizontalDirection.LEFT_TO_RIGHT;
  layout.verticalDirection = Layout.VerticalDirection.TOP_TO_BOTTOM;
  return layout;
}

export function createScrollContainer(parent: Node, width: number, height: number): {
  root: Node;
  content: Node;
} {
  const root = new Node('ScrollView');
  root.parent = parent;
  root.addComponent(UITransform).setContentSize(new Size(width, height));
  root.addComponent(BlockInputEvents);
  const sv = root.addComponent(ScrollView);
  sv.horizontal = false;
  sv.vertical = true;

  const view = new Node('View');
  view.parent = root;
  view.addComponent(UITransform).setContentSize(new Size(width, height));
  const mask = view.addComponent(Mask);
  mask.type = Mask.Type.GRAPHICS_RECT;

  const content = new Node('Content');
  content.parent = view;
  content.addComponent(UITransform).setContentSize(new Size(width, 1));
  const layout = addVerticalLayout(content, 8, 8);
  layout.constraint = Layout.Constraint.NONE;

  const contentTransform = content.getComponent(UITransform);
  if (contentTransform) sv.content = contentTransform as unknown as Node;
  return { root, content };
}
