import {
  BlockInputEvents,
  Button,
  Color,
  EditBox,
  Input,
  KeyCode,
  Label,
  Layout,
  Mask,
  Node,
  ScrollView,
  Size,
  UIOpacity,
  UITransform,
  input,
} from 'cc';
import { THEME } from './theme';
import { SPACE_TOKENS, TEXT_TOKENS } from './textTokens';
import { createButton, createLabel, createRect } from './UiFactory';
import {
  ConfirmGuard,
  DIALOG_METRICS,
  basicInputError,
  computeDialogGeometry,
  computeInputCardY,
  dialogInputLength,
  type DialogPhase,
} from './dialogModel';

/**
 * R25：弹窗、输入与确认操作通用件（不修改现金、不调用平台登录，只负责交互壳）。
 *
 * 结构约定：遮罩（拦截穿透）→ 卡片 → 固定标题 / 可滚动正文 / 固定底部操作。
 * 确认语义：
 * - 一次开框只持有一个意图（commandId 由调用方在开框时生成并闭包捕获）；
 * - 连点只发一次提交；提交中与结果未知时不能关闭、不能再次提交；
 * - 返回键/ESC 只做取消，绝不触发确认；
 * - 关闭即解绑（销毁遮罩与内容），旧回调不得重开已关闭的弹窗。
 */

export interface DialogHandle {
  readonly overlay: Node;
  readonly card: Node;
  /** 正文容器（Scrollable/Confirm 已装纵向 Layout；Input 为固定区） */
  readonly body: Node;
  /** 底部固定操作区容器 */
  readonly footer: Node;
  readonly phase: DialogPhase;
  readonly closed: boolean;
  readonly busy: boolean;
  /** 是否允许取消关闭（忙碌/结果未知时为 false） */
  canClose(): boolean;
  /** 切换忙碌视觉（按钮禁用 + 文案），不改变状态机 */
  setBusy(busy: boolean, busyText?: string): void;
  /** 内联错误提示（null 清除） */
  setError(message: string | null): void;
  /** 明确失败：恢复可重试状态并显示原因 */
  fail(message: string): void;
  /** 结果未知：保持锁定，提示稍后核对（不能关闭/重试） */
  markUncertain(message: string): void;
  /** 成功提交：关闭弹窗 */
  succeed(): void;
  /** 取消关闭（忙碌时忽略） */
  cancel(): void;
  /** 直接关闭（无确认流程 / 纯展示弹窗） */
  close(): void;
  onClose(cb: () => void): void;
}

// ---------------------------------------------------------------- 返回键栈

const dialogStack: DialogHandleImpl[] = [];
let backKeyInstalled = false;

function installBackKey(): void {
  if (backKeyInstalled) return;
  backKeyInstalled = true;
  input.on(Input.EventType.KEY_DOWN, onBackKey);
}

function onBackKey(event: { keyCode: number }): void {
  if (event.keyCode !== KeyCode.MOBILE_BACK && event.keyCode !== KeyCode.ESCAPE) return;
  const top = dialogStack.length > 0 ? dialogStack[dialogStack.length - 1] : undefined;
  // 只做取消/关闭：危险操作必须由玩家点确认按钮
  if (top) top.requestCancel();
}

// ---------------------------------------------------------------- 通用卡片

interface ScaffoldOptions {
  overlay: Node;
  viewportHeight: number;
  title: string;
  subtitle?: string;
  titleColor?: Color;
  width?: number;
  desiredBodyHeight: number;
  scrollable: boolean;
  cardY?: number;
}

interface Scaffold {
  card: Node;
  body: Node;
  footer: Node;
  scrollView: ScrollView | null;
  cardHeight: number;
  bodyHeight: number;
  width: number;
}

function buildScaffold(opts: ScaffoldOptions): Scaffold {
  const width = opts.width ?? DIALOG_METRICS.width;
  const geo = computeDialogGeometry({
    viewportHeight: opts.viewportHeight,
    desiredBodyHeight: opts.desiredBodyHeight,
  });
  const card = createRect({ width, height: geo.cardHeight, color: Color.WHITE, radius: 12, parent: opts.overlay });
  card.setPosition(0, opts.cardY ?? 0);

  const titleY = geo.cardHeight / 2 - 28;
  createLabel({
    text: opts.title,
    fontSize: TEXT_TOKENS.heading.fontSize,
    bold: true,
    color: opts.titleColor ?? THEME.text,
    width: width - 32,
    parent: card,
  }).setPosition(0, titleY);
  if (opts.subtitle) {
    createLabel({
      text: opts.subtitle,
      fontSize: TEXT_TOKENS.caption.fontSize,
      color: THEME.textWeak,
      width: width - 32,
      parent: card,
    }).setPosition(0, titleY - 24);
  }

  const innerWidth = width - 32;
  const bodyCenterY = (DIALOG_METRICS.footerHeight - DIALOG_METRICS.titleHeight) / 2;
  let body: Node;
  let scrollView: ScrollView | null = null;
  if (opts.scrollable) {
    const scroll = buildScroll(card, innerWidth, geo.bodyHeight);
    scroll.root.setPosition(0, bodyCenterY);
    body = scroll.content;
    scrollView = scroll.scrollView;
  } else {
    body = new Node('DialogBody');
    body.parent = card;
    body.addComponent(UITransform).setContentSize(new Size(innerWidth, geo.bodyHeight));
    body.setPosition(0, bodyCenterY);
  }

  const footer = new Node('DialogFooter');
  footer.parent = card;
  footer.addComponent(UITransform).setContentSize(new Size(innerWidth, DIALOG_METRICS.footerHeight));
  footer.setPosition(0, -geo.cardHeight / 2 + DIALOG_METRICS.footerHeight / 2);

  return {
    card,
    body,
    footer,
    scrollView,
    cardHeight: geo.cardHeight,
    bodyHeight: geo.bodyHeight,
    width,
  };
}

/** 自建 ScrollView（修正旧工厂把 UITransform 误赋给 sv.content 的问题）。 */
function buildScroll(parent: Node, width: number, height: number): {
  root: Node;
  content: Node;
  scrollView: ScrollView;
} {
  const root = new Node('DialogScroll');
  root.parent = parent;
  root.addComponent(UITransform).setContentSize(new Size(width, height));
  root.addComponent(BlockInputEvents);
  const scrollView = root.addComponent(ScrollView);
  scrollView.horizontal = false;
  scrollView.vertical = true;

  const viewNode = new Node('View');
  viewNode.parent = root;
  viewNode.addComponent(UITransform).setContentSize(new Size(width, height));
  viewNode.addComponent(Mask).type = Mask.Type.GRAPHICS_RECT;

  const content = new Node('Content');
  content.parent = viewNode;
  const tr = content.addComponent(UITransform);
  tr.setContentSize(new Size(width, 1));
  tr.setAnchorPoint(0.5, 1);
  content.setPosition(0, height / 2);
  const layout = content.addComponent(Layout);
  layout.type = Layout.Type.VERTICAL;
  layout.resizeMode = Layout.ResizeMode.CONTAINER;
  layout.spacingY = SPACE_TOKENS.cardGap;
  layout.paddingTop = 8;
  layout.paddingBottom = 8;
  layout.paddingLeft = 8;
  layout.paddingRight = 8;
  scrollView.content = content;
  return { root, content, scrollView };
}

// ---------------------------------------------------------------- 句柄实现

class DialogHandleImpl implements DialogHandle {
  readonly guard = new ConfirmGuard();
  readonly overlay: Node;
  readonly card: Node;
  readonly body: Node;
  readonly footer: Node;
  private readonly scrollView: ScrollView | null;
  private readonly closeCallbacks: Array<() => void> = [];
  private readonly onCancelCb: (() => void) | undefined;
  private closedFlag = false;
  private errorNode: Node | null = null;
  private submitNode: Node | null = null;
  private cancelNode: Node | null = null;
  private submitIdleText = '';
  private submitBusyText = '处理中…';

  constructor(scaffold: Scaffold, overlay: Node, onCancelCb?: () => void) {
    this.overlay = overlay;
    this.card = scaffold.card;
    this.body = scaffold.body;
    this.footer = scaffold.footer;
    this.scrollView = scaffold.scrollView;
    this.onCancelCb = onCancelCb;
    dialogStack.push(this);
    installBackKey();
  }

  get phase(): DialogPhase {
    return this.guard.phase;
  }

  get closed(): boolean {
    return this.closedFlag;
  }

  get busy(): boolean {
    return this.guard.busy;
  }

  canClose(): boolean {
    return !this.closedFlag && this.guard.canClose;
  }

  /** 绑定底部按钮（确认/取消），由 Confirm/Input 构造时调用。 */
  attachActions(submit: Node, cancelButton: Node, idleText: string, busyText: string): void {
    this.submitNode = submit;
    this.cancelNode = cancelButton;
    this.submitIdleText = idleText;
    this.submitBusyText = busyText;
  }

  setBusy(busy: boolean, busyText?: string): void {
    if (busyText) this.submitBusyText = busyText;
    if (this.submitNode) {
      setEnabled(this.submitNode, !busy);
      const label = this.submitNode.getComponentInChildren(Label);
      if (label) label.string = busy ? this.submitBusyText : this.submitIdleText;
    }
    if (this.cancelNode) setEnabled(this.cancelNode, !busy);
  }

  setError(message: string | null): void {
    if (message === null) {
      if (this.errorNode) {
        this.errorNode.destroy();
        this.errorNode = null;
      }
      return;
    }
    const errorColor = THEME.danger;
    if (!this.errorNode) {
      this.errorNode = createLabel({
        text: message,
        fontSize: TEXT_TOKENS.caption.fontSize,
        color: errorColor,
        width: Math.max(160, this.card.getComponent(UITransform)?.contentSize.width ?? DIALOG_METRICS.width),
        lineHeight: TEXT_TOKENS.caption.lineHeight,
        align: 'left',
        parent: this.body,
      });
      this.errorNode.setSiblingIndex(0);
    } else {
      const label = this.errorNode.getComponent(Label);
      if (label) label.string = message;
    }
    this.scrollView?.scrollToTop(0);
  }

  fail(message: string): void {
    if (this.closedFlag) return;
    this.guard.fail();
    this.setBusy(false);
    this.setError(message);
  }

  markUncertain(message: string): void {
    if (this.closedFlag) return;
    this.guard.markUncertain();
    this.setBusy(true);
    this.setError(message);
  }

  succeed(): void {
    if (this.closedFlag) return;
    if (!this.guard.succeed()) return;
    this.finish();
  }

  cancel(): void {
    if (this.closedFlag) return;
    if (!this.guard.canClose) return;
    this.close();
    this.onCancelCb?.();
  }

  close(): void {
    if (this.closedFlag) return;
    if (!this.guard.close()) return;
    this.finish();
  }

  requestCancel(): void {
    if (this.closedFlag) return;
    if (!this.guard.canClose) return;
    // 返回键/ESC 只走取消，不触发确认
    this.cancel();
  }

  onClose(cb: () => void): void {
    if (this.closedFlag) {
      cb();
      return;
    }
    this.closeCallbacks.push(cb);
  }

  private finish(): void {
    this.closedFlag = true;
    const idx = dialogStack.indexOf(this);
    if (idx >= 0) dialogStack.splice(idx, 1);
    const overlay = this.overlay;
    for (const cb of this.closeCallbacks) cb();
    this.closeCallbacks.length = 0;
    if (overlay.isValid) overlay.destroy();
  }
}

function setEnabled(node: Node, enabled: boolean): void {
  const button = node.getComponent(Button);
  if (button) button.enabled = enabled;
  const opacity = node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
  opacity.opacity = enabled ? 255 : 150;
}

// ---------------------------------------------------------------- ScrollableDialog

export interface ScrollableDialogOptions {
  overlay: Node;
  viewportHeight: number;
  title: string;
  subtitle?: string;
  titleColor?: Color;
  width?: number;
  /** 正文期望可视高（超出则滚动；小屏自动压缩） */
  desiredBodyHeight?: number;
  onCancel?: () => void;
}

/**
 * 标题与底部固定、正文可滚动的通用弹窗（隐私政策全文、年报、关闭公司摘要等）。
 * 调用方往 handle.body 添加内容，往 handle.footer 添加按钮。
 */
export function openScrollableDialog(opts: ScrollableDialogOptions): DialogHandle {
  const scaffold = buildScaffold({
    overlay: opts.overlay,
    viewportHeight: opts.viewportHeight,
    title: opts.title,
    subtitle: opts.subtitle,
    titleColor: opts.titleColor,
    width: opts.width,
    desiredBodyHeight: opts.desiredBodyHeight ?? 360,
    scrollable: true,
  });
  return new DialogHandleImpl(scaffold, opts.overlay, opts.onCancel);
}

// ---------------------------------------------------------------- ConfirmDialog

export interface ConfirmDialogOptions {
  overlay: Node;
  viewportHeight: number;
  title: string;
  titleColor?: Color;
  /** 正文（\n 分段，自动换行；超出可视高时滚动） */
  message: string;
  width?: number;
  desiredBodyHeight?: number;
  confirmText: string;
  busyText?: string;
  cancelText?: string;
  danger?: boolean;
  /** false 时确认按钮初始置灰（如余额不足），点击不发起提交 */
  confirmEnabled?: boolean;
  onConfirm: (handle: DialogHandle) => void | Promise<void>;
  onCancel?: () => void;
}

/**
 * 确认弹窗：一次开框一个意图；连点只提交一次；提交中/未知状态不可关闭；
 * 明确失败可同意图重试；成功调用 handle.succeed() 关闭。
 */
export function openConfirmDialog(opts: ConfirmDialogOptions): DialogHandle {
  const width = opts.width ?? DIALOG_METRICS.width;
  const lineCount = opts.message.split('\n').length;
  const desiredBodyHeight = opts.desiredBodyHeight ?? Math.max(120, lineCount * 22 + 16);
  const scaffold = buildScaffold({
    overlay: opts.overlay,
    viewportHeight: opts.viewportHeight,
    title: opts.title,
    titleColor: opts.titleColor ?? (opts.danger ? THEME.danger : THEME.primary),
    width,
    desiredBodyHeight,
    scrollable: true,
  });

  createLabel({
    text: opts.message,
    fontSize: TEXT_TOKENS.body.fontSize,
    lineHeight: TEXT_TOKENS.body.lineHeight,
    color: THEME.text,
    width: width - 56,
    align: 'left',
    parent: scaffold.body,
  });

  const handle = new DialogHandleImpl(scaffold, opts.overlay, opts.onCancel);
  const confirmButton = createButton({
    text: opts.confirmText,
    width: Math.min(240, width - 64),
    height: 48,
    color: opts.danger ? THEME.danger : THEME.primary,
    disabled: opts.confirmEnabled === false,
    parent: scaffold.footer,
    onClick: () => void runConfirm(),
  });
  confirmButton.setPosition(0, 28);

  const cancelButton = createButton({
    text: opts.cancelText ?? '再想想（取消）',
    width: Math.min(200, width - 88),
    height: 44,
    fontSize: TEXT_TOKENS.caption.fontSize,
    color: Color.WHITE,
    textColor: THEME.text,
    parent: scaffold.footer,
    onClick: () => handle.cancel(),
  });
  cancelButton.setPosition(0, -26);

  handle.attachActions(confirmButton, cancelButton, opts.confirmText, opts.busyText ?? '处理中…');

  async function runConfirm(): Promise<void> {
    // 状态机拦截连点：同一弹窗只发一个意图
    if (!handle.guard.begin()) return;
    handle.setError(null);
    handle.setBusy(true);
    try {
      await opts.onConfirm(handle);
      if (!handle.closed) {
        // 调用方未同时给出成功/失败结论 → 视为可重试的明确失败
        handle.fail('操作未完成，请重试');
      }
    } catch (err) {
      handle.fail(err instanceof Error ? err.message : '操作失败，请重试');
    }
  }

  return handle;
}

// ---------------------------------------------------------------- InputDialog

export interface InputDialogOptions {
  overlay: Node;
  viewportHeight: number;
  title: string;
  /** 输入框上方标签 */
  label: string;
  hint?: string;
  width?: number;
  initialValue?: string;
  minLength?: number;
  maxLength: number;
  placeholder?: string;
  submitText?: string;
  cancelText?: string;
  /** 业务校验（返回错误文案；null 通过）。基础空值/字数已由通用件处理 */
  validate?: (value: string) => string | null;
  onSubmit: (value: string, handle: DialogHandle) => void | Promise<void>;
  onCancel?: () => void;
}

/**
 * 输入弹窗：标签 + 字数 + 内联校验；卡片固定在上半区，键盘弹出不遮挡输入框与按钮。
 */
export function openInputDialog(opts: InputDialogOptions): DialogHandle {
  const width = opts.width ?? DIALOG_METRICS.width;
  const minLength = opts.minLength ?? 1;
  const cardHeight = DIALOG_METRICS.titleHeight + 132 + DIALOG_METRICS.footerHeight;
  const cardY = computeInputCardY(opts.viewportHeight, cardHeight);

  const scaffold = buildScaffold({
    overlay: opts.overlay,
    viewportHeight: opts.viewportHeight,
    title: opts.title,
    width,
    desiredBodyHeight: 132,
    scrollable: false,
    cardY,
  });

  const innerWidth = width - 32;
  const labelY = scaffold.bodyHeight / 2 - 10;
  createLabel({
    text: opts.label,
    fontSize: TEXT_TOKENS.body.fontSize,
    bold: true,
    width: innerWidth,
    align: 'left',
    parent: scaffold.body,
  }).setPosition(0, labelY);
  if (opts.hint) {
    createLabel({
      text: opts.hint,
      fontSize: TEXT_TOKENS.caption.fontSize,
      color: THEME.textWeak,
      width: innerWidth,
      align: 'left',
      parent: scaffold.body,
    }).setPosition(0, labelY - 20);
  }

  const inputY = labelY - (opts.hint ? 62 : 44);
  createRect({ width: innerWidth, height: 46, color: THEME.bg, radius: 8, parent: scaffold.body }).setPosition(0, inputY);
  const inputNode = new Node('DialogInput');
  inputNode.parent = scaffold.body;
  inputNode.setPosition(0, inputY);
  inputNode.addComponent(UITransform).setContentSize(new Size(innerWidth - 12, 40));
  const edit = inputNode.addComponent(EditBox);
  edit.placeholder = opts.placeholder ?? '';
  edit.maxLength = opts.maxLength;
  edit.inputMode = EditBox.InputMode.SINGLE_LINE;
  edit.string = opts.initialValue ?? '';

  // EditBox 默认白字在浅色卡片上不可见；统一改深色（覆盖 placeholder/文本）
  // 引擎把两个 Label 定位在节点左上角（(-w/2+2, +h/2)），程序化创建的 Label
  // 默认 anchor=(0.5,0.5)，会把文字甩到卡片外；改为 (0,1) 才能落在输入框内。
  const placeLabel = (label: Label | null): void => {
    const tr = label?.node.getComponent(UITransform);
    if (tr) tr.setAnchorPoint(0, 1);
  };
  const paintLabel = (): void => {
    const placeholder = edit.placeholderLabel as Label | null;
    if (placeholder) {
      placeholder.color = THEME.textWeak;
      placeholder.fontSize = TEXT_TOKENS.body.fontSize;
      placeLabel(placeholder);
    }
    const text = edit.textLabel as Label | null;
    if (text) {
      text.color = THEME.text;
      text.fontSize = TEXT_TOKENS.body.fontSize;
      placeLabel(text);
    }
  };
  paintLabel();
  // 键盘收起后再补一次颜色，避免原生输入覆盖编辑态样式
  const schedulePaint = (): void => paintLabel();

  const counter = createLabel({
    text: `${dialogInputLength(edit.string ?? '')}/${opts.maxLength}`,
    fontSize: TEXT_TOKENS.caption.fontSize,
    color: THEME.textWeak,
    width: 72,
    align: 'right',
    parent: scaffold.body,
  });
  counter.setPosition(innerWidth / 2 - 36, inputY - 26);

  const errorLabel = createLabel({
    text: '',
    fontSize: TEXT_TOKENS.caption.fontSize,
    color: THEME.danger,
    width: innerWidth - 84,
    align: 'left',
    parent: scaffold.body,
  });
  errorLabel.setPosition(-42, inputY - 26);

  const handle = new DialogHandleImpl(scaffold, opts.overlay, opts.onCancel);
  const submitButton = createButton({
    text: opts.submitText ?? '确定',
    width: Math.min(240, width - 64),
    height: 48,
    parent: scaffold.footer,
    onClick: () => void submit(),
  });
  submitButton.setPosition(0, 28);
  const cancelButton = createButton({
    text: opts.cancelText ?? '取消',
    width: Math.min(200, width - 88),
    height: 44,
    fontSize: TEXT_TOKENS.caption.fontSize,
    color: Color.WHITE,
    textColor: THEME.text,
    parent: scaffold.footer,
    onClick: () => handle.cancel(),
  });
  cancelButton.setPosition(0, -26);
  handle.attachActions(submitButton, cancelButton, opts.submitText ?? '确定', '提交中…');

  edit.node.on(EditBox.EventType.TEXT_CHANGED, () => {
    const current = edit.string ?? '';
    const label = counter.getComponent(Label);
    if (label) label.string = `${dialogInputLength(current)}/${opts.maxLength}`;
    const err = errorLabel.getComponent(Label);
    if (err && err.string !== '') err.string = '';
  });
  // 键盘收起后仍保留输入与按钮（不重建节点，只补一次 Label 颜色）
  edit.node.on(EditBox.EventType.EDITING_DID_ENDED, () => schedulePaint());

  async function submit(): Promise<void> {
    const raw = edit.string ?? '';
    const basic = basicInputError(raw, { minLength, maxLength: opts.maxLength });
    const custom = basic ? null : opts.validate?.(raw) ?? null;
    const message = basic ?? custom;
    if (message) {
      const label = errorLabel.getComponent(Label);
      if (label) label.string = message;
      return;
    }
    if (!handle.guard.begin()) return;
    handle.setBusy(true);
    try {
      await opts.onSubmit(raw.trim(), handle);
      if (!handle.closed) handle.fail('提交未完成，请重试');
    } catch (err) {
      handle.fail(err instanceof Error ? err.message : '提交失败，请重试');
    }
  }

  return handle;
}

/** 便于证据脚本/测试读取当前打开弹窗数量（不参与业务）。 */
export function openDialogCount(): number {
  return dialogStack.length;
}
