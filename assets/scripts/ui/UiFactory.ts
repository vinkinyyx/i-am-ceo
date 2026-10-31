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
} from 'cc';
import { THEME, MIN_TOUCH } from './theme';

/**
 * 代码驱动 UI 工厂（设计文档 07 / 13.4）。
 * 全部使用引擎原生 Graphics 矩形/Label/Button，不依赖美术图片；动态文字由 Label 渲染。
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
  tr.setContentSize(new Size(opts.width ?? 200, opts.height ?? opts.fontSize ?? 20));
  const label = node.addComponent(Label);
  label.string = opts.text;
  label.fontSize = opts.fontSize ?? 14;
  label.lineHeight = opts.lineHeight ?? (opts.fontSize ?? 14) + 4;
  label.color = opts.color ?? THEME.text;
  label.isBold = opts.bold ?? false;
  label.horizontalAlign =
    opts.align === 'left'
      ? HorizontalTextAlignment.LEFT
      : opts.align === 'right'
        ? HorizontalTextAlignment.RIGHT
        : HorizontalTextAlignment.CENTER;
  label.verticalAlign = VerticalTextAlignment.CENTER;
  label.overflow = Overflow.RESIZE_HEIGHT;
  if (opts.width) {
    label.overflow = Overflow.SHRINK;
  }
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
  const height = opts.height ?? MIN_TOUCH;
  const node = createRect({
    name: opts.name ?? 'Button',
    width: opts.width,
    height,
    color: opts.disabled ? THEME.disabled : (opts.color ?? THEME.primary),
    radius: 8,
    parent: opts.parent,
  });
  // 拦截点击穿透
  node.addComponent(BlockInputEvents);
  const labelNode = createLabel({
    text: opts.text,
    fontSize: opts.fontSize ?? 15,
    color: opts.textColor ?? Color.WHITE,
    width: opts.width - 16,
    height,
    bold: true,
    parent: node,
  });
  labelNode.setPosition(Vec3.ZERO);

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

  sv.content = content.getComponent(UITransform);
  return { root, content };
}

export function moneyText(yuan: number): string {
  const sign = yuan < 0 ? '-' : '';
  const abs = Math.abs(yuan);
  return `${sign}¥${abs.toLocaleString('zh-CN')}`;
}
