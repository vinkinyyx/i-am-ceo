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
  tr.setContentSize(new Size(opts.width ?? 200, opts.height ?? lineHeight));
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
}

export function createButton(opts: ButtonOptions): Node {
  // R23：有效热区 ≥44×44（视觉矩形可小于热区时由调用方外扩触摸节点，这里先守底线）
  const touch = ensureTouchSize(opts.width, opts.height ?? 44);
  const height = touch.height;
  const node = createRect({
    name: opts.name ?? 'Button',
    width: touch.width,
    height,
    color: opts.disabled ? THEME.disabled : (opts.color ?? THEME.primary),
    radius: 8,
    parent: opts.parent,
  });
  // 拦截点击穿透
  node.addComponent(BlockInputEvents);

  // TASK-M3-12-02：label 必须用 rect 实际宽度，不能用 opts.width-16（当 width<44 时 rect 被撑宽但 label 仍窄）。
  // 固定单行 CENTER 居中，不靠正文 RESIZE_HEIGHT+TOP。
  const labelNode = new Node('ButtonLabel');
  if (opts.parent) labelNode.parent = node;
  labelNode.setPosition(Vec3.ZERO);
  const tr = labelNode.addComponent(UITransform);
  const contentWidth = touch.width - 16;
  tr.setContentSize(new Size(contentWidth, height));
  const label = labelNode.addComponent(Label);
  label.string = opts.text;
  label.fontSize = opts.fontSize ?? 15;
  label.lineHeight = height; // 单行，行高等于按钮高
  label.color = opts.textColor ?? Color.WHITE;
  label.isBold = true;
  label.horizontalAlign = HorizontalTextAlignment.CENTER;
  label.verticalAlign = VerticalTextAlignment.CENTER;
  label.overflow = Overflow.NONE; // 单行禁止换行/缩字，调用方负责宽度
  label.enableWrapText = false;

  const button = node.addComponent(Button);
  button.transition = Button.Transition.SCALE;
  button.zoomScale = 0.96;
  node.on(Button.EventType.CLICK, () => {
    if (!opts.disabled) opts.onClick();
  });
  return node;
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
