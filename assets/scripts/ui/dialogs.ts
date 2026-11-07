import {
  BlockInputEvents,
  Color,
  Component,
  EditBox,
  Graphics,
  Input,
  KeyCode,
  Label,
  Layout,
  Mask,
  Node,
  ScrollView,
  Size,
  UITransform,
  _decorator,
  input,
  isValid,
} from 'cc';
import { DESIGN_HEIGHT, DESIGN_WIDTH, THEME } from './theme';
import { SPACE_TOKENS, TEXT_TOKENS } from './textTokens';
import { createButton, createLabel, createRect, setButtonEnabled, setButtonLabel } from './UiFactory';
import { ShortContentAnchor } from './shortContentAnchor';
import {
  ConfirmGuard,
  DIALOG_METRICS,
  basicInputError,
  computeDialogGeometry,
  computeInputCardY,
  dialogInputLength,
  type DialogPhase,
} from './dialogModel';
import {
  DialogSessionModel,
  type DialogCloseReason,
  type DialogKind,
  type DialogOwner,
} from './dialogSessionModel';

const { ccclass } = _decorator;

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
  readonly id: string;
  readonly kind: DialogKind;
  readonly semanticKey: string;
  readonly owner: DialogOwner;
  /** A24-01：子确认所属父会话 id；普通顶层窗口为 undefined。 */
  readonly parentSessionId: string | undefined;
  readonly overlay: Node;
  readonly card: Node;
  /** 正文容器（Scrollable/Confirm 已装纵向 Layout；Input 为固定区） */
  readonly body: Node;
  /** 底部固定操作区容器 */
  readonly footer: Node;
  readonly phase: DialogPhase;
  readonly closed: boolean;
  readonly busy: boolean;
  /** 本次提交是否已由调用方给出明确结论（成功/失败/过期/失效），避免被兜底错误覆盖。 */
  readonly handled: boolean;
  /** 是否允许取消关闭（忙碌/结果未知时为 false） */
  canClose(): boolean;
  /** 切换忙碌视觉（按钮禁用 + 文案），不改变状态机 */
  setBusy(busy: boolean, busyText?: string): void;
  /** 内联错误提示（null 清除） */
  setError(message: string | null): void;
  /** 就地更新正文说明（确认窗过期/重新预览时使用，不重建窗口） */
  setMessage(text: string): void;
  /**
   * 预览/确认令牌过期：保留同一窗口，禁用“直接提交”，转为手动“重新预览”。
   * 不自动关框；用户重新预览并再次确认后才允许提交。
   */
  markExpired(message: string, retryText?: string): void;
  /** 上下文永久失效（换 run/账号）：保留窗口显示原因，但禁止再次提交。 */
  blockSubmit(message: string): void;
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

// ---------------------------------------------------------------- 会话登记 / 返回键栈

/** R31：确认/输入弹窗底部按钮统一 48 高（同基线，不再 48/44 混用）。 */
const BUTTON_ACTION_HEIGHT = 48;
/**
 * A24-02：两行按钮中心距 (±28) → 实际间距 56-48 = 8，满足最小 8；
 * 旧值 26 得到间距 4。footer 高 120 时上下各留 8。
 */
const FOOTER_BUTTON_OFFSET = 28;

/** 弹窗会话元信息（R31）；不传时按普通展示弹窗登记。 */
export interface DialogSessionOptions {
  /** 同语义去重键：employee:<id>、distress:<run>:<year>:<month> 等 */
  semanticKey?: string;
  kind?: DialogKind;
  owner?: Partial<DialogOwner>;
  policy?: 'manual' | 'submit-result' | 'recovery';
  sourceRevision?: number | null;
  /** A24-01：子确认挂到父详情下；父窗口保持打开，取消子框即回到同一父窗口。 */
  parentSessionId?: string;
}

const ownerDefaults: DialogOwner = { runId: null, accountEpoch: 0, contextEpoch: 0 };
const registry = new DialogSessionModel();
const dialogHandles: DialogHandleImpl[] = [];
const closedListeners = new Set<(reason: DialogCloseReason) => void>();
let dialogSequence = 0;
let backKeyInstalled = false;

/** AppView 只注册一个“任何弹窗关闭”监听，用于补弹危机/刷新状态。 */
export function setDialogClosedListener(listener: ((reason: DialogCloseReason) => void) | null): void {
  closedListeners.clear();
  if (listener) closedListeners.add(listener);
}

function notifyClosed(reason: DialogCloseReason): void {
  for (const listener of closedListeners) {
    try {
      listener(reason);
    } catch (err) {
      console.warn('[dialog] closed listener failed', err);
    }
  }
}

/** 供 AppView/广告/危机判断“最上层是否已被占用”，不再靠 ModalLayer 子节点猜测。 */
export function hasOpenDialog(): boolean {
  pruneDialogs();
  return dialogHandles.some((handle) => !handle.closed);
}

export function hasBlockingDialog(): boolean {
  pruneDialogs();
  return registry.hasBlockingModal();
}

export function findOpenDialog(semanticKey: string): DialogHandle | null {
  pruneDialogs();
  return dialogHandles.find((handle) => !handle.closed && handle.semanticKey === semanticKey) ?? null;
}

/** 真正上下文失效（换 run/账号/应用销毁）时强制结束旧 UI；不伪造业务取消/成功。 */
export function invalidateDialogs(reason: DialogCloseReason = 'context-invalidated', owner?: Partial<DialogOwner>): number {
  // A24-07：先按 owner 收集命中集合，再连带其子会话；
  // 旧实现用 () => true 注销整个 registry，会把其它 owner 的有效登记一并清掉。
  const targets = new Set<string>();
  for (const handle of dialogHandles) {
    if (handle.closed) continue;
    if (owner && !handle.ownerMatches(owner)) continue;
    targets.add(handle.id);
    for (const child of registry.descendantsOf(handle.id)) targets.add(child.id);
  }
  let count = 0;
  for (const handle of [...dialogHandles].reverse()) {
    if (handle.closed || !targets.has(handle.id)) continue;
    handle.forceDispose(reason);
    count += 1;
  }
  if (targets.size > 0) {
    registry.pruneInvalid((session) => targets.has(session.id), reason);
  }
  notifyClosed(reason);
  return count;
}

/** 外部 destroy/父层清理后补注销；不模拟用户取消。 */
export function pruneDialogs(): void {
  for (const handle of [...dialogHandles]) {
    if (!handle.closed && !isValid(handle.overlay, true)) handle.handleExternalDestroy();
  }
}

/** 视口变化（热 resize）时同步所有存活窗口的遮罩/卡片/滚动区。 */
export function relayoutDialogs(viewportHeight: number): void {
  for (const handle of dialogHandles) {
    if (!handle.closed) handle.relayout(viewportHeight);
  }
}

/** A24-04：同语义 + 同 owner 的窗口复用，避免工厂重复建壳；不同 owner 不误合并。 */
function reuseExistingDialog(overlay: Node, session: DialogSessionOptions | undefined): DialogHandle | null {
  if (!session?.semanticKey) return null;
  const owner: DialogOwner = { ...ownerDefaults, ...(session.owner ?? {}) };
  const existing = dialogHandles.find(
    (handle) => !handle.closed && handle.semanticKey === session.semanticKey && handle.ownerMatches(owner),
  );
  if (!existing) return null;
  if (isValid(overlay, true)) overlay.destroy();
  return existing;
}

/** 证据脚本只读快照；不包含可写测试 hook。 */
export function dialogDebugSnapshot(): Array<Record<string, unknown>> {
  pruneDialogs();
  return dialogHandles
    .filter((handle) => !handle.closed)
    .map((handle) => ({
      id: handle.id,
      kind: handle.kind,
      semanticKey: handle.semanticKey,
      runId: handle.owner.runId,
      contextEpoch: handle.owner.contextEpoch,
      closed: handle.closed,
      overlayValid: isValid(handle.overlay, true),
    }));
}

@ccclass('CeoDialogLifecycle')
class DialogLifecycle extends Component {
  host: DialogHandleImpl | null = null;

  override onDestroy(): void {
    const host = this.host;
    this.host = null;
    host?.handleExternalDestroy();
  }
}

function installBackKey(): void {
  if (backKeyInstalled) return;
  backKeyInstalled = true;
  input.on(Input.EventType.KEY_DOWN, onBackKey);
}

function onBackKey(event: { keyCode: number }): void {
  if (event.keyCode !== KeyCode.MOBILE_BACK && event.keyCode !== KeyCode.ESCAPE) return;
  pruneDialogs();
  const top = dialogHandles.length > 0 ? dialogHandles[dialogHandles.length - 1] : undefined;
  // 只做取消/关闭：危险操作必须由玩家点确认按钮
  if (top && !top.closed) top.requestCancel();
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
  /** A24-09：热 resize 时需同步的滚动链节点（DialogScroll → View → Content）。 */
  scrollRoot: Node | null;
  viewNode: Node | null;
  cardHeight: number;
  bodyHeight: number;
  width: number;
  /** resize 时按同一实例重排所需信息 */
  geometry: { viewportHeight: number; desiredBodyHeight: number; cardY: number };
  titleNode: Node;
  subtitleNode: Node | null;
}

function paintCard(card: Node, width: number, height: number): void {
  const g = card.getComponent(Graphics);
  if (!g) return;
  g.clear();
  g.fillColor = Color.WHITE;
  g.roundRect(-width / 2, -height / 2, width, height, 12);
  g.fill();
  card.getComponent(UITransform)?.setContentSize(new Size(width, height));
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
  const titleNode = createLabel({
    text: opts.title,
    fontSize: TEXT_TOKENS.heading.fontSize,
    bold: true,
    color: opts.titleColor ?? THEME.text,
    width: width - 32,
    parent: card,
  });
  titleNode.setPosition(0, titleY);
  let subtitleNode: Node | null = null;
  if (opts.subtitle) {
    subtitleNode = createLabel({
      text: opts.subtitle,
      fontSize: TEXT_TOKENS.caption.fontSize,
      color: THEME.textWeak,
      width: width - 32,
      parent: card,
    });
    subtitleNode.setPosition(0, titleY - 24);
  }

  const innerWidth = width - 32;
  const bodyCenterY = (DIALOG_METRICS.footerHeight - DIALOG_METRICS.titleHeight) / 2;
  let body: Node;
  let scrollView: ScrollView | null = null;
  let scrollRoot: Node | null = null;
  let viewNode: Node | null = null;
  if (opts.scrollable) {
    const scroll = buildScroll(card, innerWidth, geo.bodyHeight);
    scroll.root.setPosition(0, bodyCenterY);
    body = scroll.content;
    scrollView = scroll.scrollView;
    scrollRoot = scroll.root;
    viewNode = scroll.viewNode;
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
    scrollRoot,
    viewNode,
    cardHeight: geo.cardHeight,
    bodyHeight: geo.bodyHeight,
    width,
    geometry: {
      viewportHeight: opts.viewportHeight,
      desiredBodyHeight: opts.desiredBodyHeight,
      cardY: opts.cardY ?? 0,
    },
    titleNode,
    subtitleNode,
  };
}

/** 自建 ScrollView（修正旧工厂把 UITransform 误赋给 sv.content 的问题）。 */
function buildScroll(parent: Node, width: number, height: number): {
  root: Node;
  viewNode: Node;
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
  const anchor = root.addComponent(ShortContentAnchor);
  anchor.content = content;
  anchor.viewNode = viewNode;
  return { root, viewNode, content, scrollView };
}

// ---------------------------------------------------------------- 句柄实现

class DialogHandleImpl implements DialogHandle {
  readonly guard = new ConfirmGuard();
  readonly overlay: Node;
  readonly card: Node;
  readonly body: Node;
  readonly footer: Node;
  readonly id: string;
  readonly kind: DialogKind;
  readonly semanticKey: string;
  readonly owner: DialogOwner;
  private readonly scaffold: Scaffold;
  private readonly scrollView: ScrollView | null;
  private readonly closeCallbacks: Array<() => void> = [];
  private readonly onCancelCb: (() => void) | undefined;
  private readonly overlayLifecycle: DialogLifecycle;
  private closedFlag = false;
  private finishing = false;
  private errorNode: Node | null = null;
  private messageNode: Node | null = null;
  private submitNode: Node | null = null;
  private cancelNode: Node | null = null;
  private submitIdleText = '';
  private submitBusyText = '处理中…';
  private expiredFlag = false;
  private handledFlag = false;
  /** A24-08：异步重新预览的去重锁与代次令牌，防止连点/迟到回调改写按钮。 */
  private refreshing = false;
  private refreshToken = 0;
  readonly parentSessionId: string | undefined;
  private refreshHandler: (() => Promise<{ message: string; confirmText: string; confirmEnabled: boolean }>) | null = null;

  constructor(
    scaffold: Scaffold,
    overlay: Node,
    session: DialogSessionOptions | undefined,
    onCancelCb?: () => void,
  ) {
    this.overlay = overlay;
    this.card = scaffold.card;
    this.body = scaffold.body;
    this.footer = scaffold.footer;
    this.scaffold = scaffold;
    this.scrollView = scaffold.scrollView;
    this.onCancelCb = onCancelCb;
    this.kind = session?.kind ?? 'notice';
    this.owner = { ...ownerDefaults, ...(session?.owner ?? {}) };
    this.id = `dialog-${++dialogSequence}`;
    this.semanticKey = session?.semanticKey ?? this.id;
    this.parentSessionId = session?.parentSessionId;

    // 外部销毁（父层清理/场景切换）也要注销，避免残留“幽灵弹窗”阻塞后续交互
    const lifecycle = overlay.addComponent(DialogLifecycle);
    lifecycle.host = this;
    this.overlayLifecycle = lifecycle;

    const registered = registry.register({
      id: this.id,
      kind: this.kind,
      semanticKey: this.semanticKey,
      owner: this.owner,
      sourceRevision: session?.sourceRevision ?? null,
      policy: session?.policy ?? 'manual',
      parentSessionId: this.parentSessionId,
    });
    if (!registered) {
      // 同语义弹窗已存在：不叠层，直接丢弃新壳（调用方应先 findOpenDialog 聚焦旧窗）
      this.closedFlag = true;
      if (isValid(overlay, true)) overlay.destroy();
      return;
    }
    dialogHandles.push(this);
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

  ownerMatches(partial: Partial<DialogOwner>): boolean {
    if (partial.runId !== undefined && partial.runId !== this.owner.runId) return false;
    if (partial.accountEpoch !== undefined && partial.accountEpoch !== this.owner.accountEpoch) return false;
    if (partial.contextEpoch !== undefined && partial.contextEpoch !== this.owner.contextEpoch) return false;
    if (partial.entityId !== undefined && partial.entityId !== this.owner.entityId) return false;
    return true;
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
    if (this.submitNode && isValid(this.submitNode, true)) {
      setButtonEnabled(this.submitNode, !busy);
      setButtonLabel(this.submitNode, busy ? this.submitBusyText : this.submitIdleText);
    }
    if (this.cancelNode && isValid(this.cancelNode, true)) setButtonEnabled(this.cancelNode, !busy);
  }

  setError(message: string | null): void {
    if (this.closedFlag) return;
    if (message === null) {
      if (this.errorNode && isValid(this.errorNode, true)) this.errorNode.destroy();
      this.errorNode = null;
      return;
    }
    if (!this.errorNode || !isValid(this.errorNode, true)) {
      this.errorNode = createLabel({
        text: message,
        fontSize: TEXT_TOKENS.caption.fontSize,
        color: THEME.danger,
        width: this.scaffold.width - 48,
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

  /** R31：就地换正文说明，供“预览已过期/已刷新”复用同一窗口。 */
  setMessage(text: string): void {
    if (this.closedFlag) return;
    if (!this.messageNode || !isValid(this.messageNode, true)) {
      this.messageNode = createLabel({
        text,
        fontSize: TEXT_TOKENS.body.fontSize,
        lineHeight: TEXT_TOKENS.body.lineHeight,
        color: THEME.text,
        width: this.scaffold.width - 56,
        align: 'left',
        parent: this.body,
      });
      return;
    }
    const label = this.messageNode.getComponent(Label);
    if (label) label.string = text;
  }

  /** 当前正文文案（证据脚本读取；无正文返回空串）。 */
  currentMessage(): string {
    return this.messageNode?.getComponent(Label)?.string ?? '';
  }

  bindMessage(node: Node): void {
    this.messageNode = node;
  }

  configureRefresh(handler: (() => Promise<{ message: string; confirmText: string; confirmEnabled: boolean }>) | null): void {
    this.refreshHandler = handler;
  }

  get expired(): boolean {
    return this.expiredFlag;
  }

  get handled(): boolean {
    return this.handledFlag;
  }

  markExpired(message: string, retryText = '重新预览'): void {
    if (this.closedFlag) return;
    this.expiredFlag = true;
    this.handledFlag = true;
    this.guard.fail();
    this.setError(message);
    if (this.submitNode && isValid(this.submitNode, true)) {
      setButtonLabel(this.submitNode, retryText);
      setButtonEnabled(this.submitNode, this.refreshHandler !== null);
    }
    if (this.cancelNode && isValid(this.cancelNode, true)) setButtonEnabled(this.cancelNode, true);
  }

  /** 由确认按钮的点击路径调用；返回 true 表示已消费一次过期状态。 */
  consumeExpired(): boolean {
    if (!this.expiredFlag) return false;
    this.expiredFlag = false;
    return true;
  }

  /** A24-08：每次新的提交尝试都复位 handled，不能沿用上一次尝试的结论。 */
  resetAttempt(): void {
    this.handledFlag = false;
    this.expiredFlag = false;
  }

  /**
   * A24-08：异步重新预览。
   * - refreshing 锁：连点只跑一次
   * - refreshToken：关闭或再次刷新后，迟到的旧回调不得改写按钮
   * - try/catch：异常保留窗口并允许重试，不能卡在“处理中”
   */
  async refreshPreview(): Promise<boolean> {
    if (this.closedFlag || this.refreshing || !this.refreshHandler) return false;
    this.refreshing = true;
    this.handledFlag = false;
    const token = ++this.refreshToken;
    this.guard.fail();
    this.setBusy(true, '重新预览中…');
    try {
      const result = await this.refreshHandler();
      if (this.closedFlag || token !== this.refreshToken) return false;
      this.setMessage(result.message);
      this.submitIdleText = result.confirmText;
      this.setBusy(false);
      if (this.submitNode && isValid(this.submitNode, true)) {
        setButtonLabel(this.submitNode, result.confirmText);
        setButtonEnabled(this.submitNode, result.confirmEnabled);
      }
      this.setError('预览已刷新，请再次确认');
      return true;
    } catch (err) {
      if (this.closedFlag || token !== this.refreshToken) return false;
      // 刷新失败不是业务失败：保留窗口与重试入口，不要求玩家重看视频或重进页面
      this.expiredFlag = true;
      this.setBusy(false);
      if (this.submitNode && isValid(this.submitNode, true)) {
        setButtonLabel(this.submitNode, '重新预览');
        setButtonEnabled(this.submitNode, true);
      }
      this.setError(err instanceof Error ? `刷新失败：${err.message}` : '刷新失败，请重试');
      return false;
    } finally {
      if (token === this.refreshToken) this.refreshing = false;
    }
  }

  blockSubmit(message: string): void {
    if (this.closedFlag) return;
    this.handledFlag = true;
    this.guard.fail();
    this.expiredFlag = false;
    this.setError(message);
    if (this.submitNode && isValid(this.submitNode, true)) setButtonEnabled(this.submitNode, false);
    if (this.cancelNode && isValid(this.cancelNode, true)) setButtonEnabled(this.cancelNode, true);
  }

  fail(message: string): void {
    if (this.closedFlag) return;
    this.handledFlag = true;
    this.guard.fail();
    this.setBusy(false);
    this.setError(message);
  }

  markUncertain(message: string): void {
    if (this.closedFlag) return;
    this.handledFlag = true;
    this.guard.markUncertain();
    this.setBusy(true);
    this.setError(message);
  }

  succeed(): void {
    if (this.closedFlag) return;
    this.handledFlag = true;
    if (!this.guard.succeed()) return;
    this.finish('submit-success');
  }

  cancel(): void {
    if (this.closedFlag) return;
    if (!this.guard.canClose) return;
    if (!this.guard.close()) return;
    this.finish('user-close');
    this.onCancelCb?.();
  }

  close(): void {
    if (this.closedFlag) return;
    if (!this.guard.close()) return;
    this.finish('user-close');
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

  /** 父层/场景销毁导致的失效：注销并清理引用，但不伪造业务成功。 */
  handleExternalDestroy(): void {
    if (this.closedFlag) return;
    this.closedFlag = true;
    this.detach('application-dispose');
    this.notifyClose('application-dispose');
  }

  forceDispose(reason: DialogCloseReason): void {
    if (this.closedFlag) return;
    this.closedFlag = true;
    this.detach(reason);
    if (isValid(this.overlay, true)) this.overlay.destroy();
    this.notifyClose(reason);
  }

  /**
   * 视口变化时按同一几何模型重排，避免卡片越界。
   * A24-09：遮罩、卡片、DialogScroll/View/Content 及锚点必须一起同步；
   * 旧实现只改 body.parent（View），Content 仍按旧高度停在旧位置。
   */
  relayout(viewportHeight: number): void {
    if (this.closedFlag) return;
    const geo = computeDialogGeometry({
      viewportHeight,
      desiredBodyHeight: this.scaffold.geometry.desiredBodyHeight,
    });
    this.scaffold.cardHeight = geo.cardHeight;
    this.scaffold.bodyHeight = geo.bodyHeight;
    this.scaffold.geometry.viewportHeight = viewportHeight;

    // 1) 遮罩：高屏时铺满可视高度，并重绘底色
    const overlayHeight = Math.max(DESIGN_HEIGHT, viewportHeight);
    const overlayTransform = this.overlay.getComponent(UITransform);
    overlayTransform?.setContentSize(new Size(DESIGN_WIDTH, overlayHeight));
    const overlayGraphics = this.overlay.getComponent(Graphics);
    if (overlayGraphics) {
      overlayGraphics.clear();
      overlayGraphics.fillColor = new Color(0, 0, 0, 130);
      overlayGraphics.rect(-DESIGN_WIDTH / 2, -overlayHeight / 2, DESIGN_WIDTH, overlayHeight);
      overlayGraphics.fill();
    }

    // 2) 卡片：尺寸与纵向位置（输入弹窗贴键盘上方，随视口重算）
    paintCard(this.card, this.scaffold.width, geo.cardHeight);
    const cardY = this.scaffold.geometry.cardY === 0 ? 0 : computeInputCardY(viewportHeight, geo.cardHeight);
    this.scaffold.geometry.cardY = cardY;
    this.card.setPosition(0, cardY);

    // 3) 正文：滚动链三层同步（root / View / Content 锚点与位置）
    const innerWidth = this.scaffold.width - 32;
    const bodyCenterY = (DIALOG_METRICS.footerHeight - DIALOG_METRICS.titleHeight) / 2;
    if (this.scaffold.scrollRoot && this.scaffold.viewNode) {
      this.scaffold.scrollRoot.getComponent(UITransform)?.setContentSize(new Size(innerWidth, geo.bodyHeight));
      this.scaffold.scrollRoot.setPosition(0, bodyCenterY);
      this.scaffold.viewNode.getComponent(UITransform)?.setContentSize(new Size(innerWidth, geo.bodyHeight));
      const contentTransform = this.body.getComponent(UITransform);
      contentTransform?.setAnchorPoint(0.5, 1);
      // 高度由 Layout(CONTAINER) 决定，这里只保证顶边贴合新可视区
      this.body.setPosition(0, geo.bodyHeight / 2);
      this.scrollView?.stopAutoScroll();
    } else {
      this.body.getComponent(UITransform)?.setContentSize(new Size(innerWidth, geo.bodyHeight));
      this.body.setPosition(0, bodyCenterY);
    }

    // 4) 标题/副标题/底栏
    this.scaffold.titleNode.setPosition(0, geo.cardHeight / 2 - 28);
    this.scaffold.subtitleNode?.setPosition(0, geo.cardHeight / 2 - 52);
    this.footer.setPosition(0, -geo.cardHeight / 2 + DIALOG_METRICS.footerHeight / 2);
    this.footer.getComponent(UITransform)?.setContentSize(new Size(innerWidth, DIALOG_METRICS.footerHeight));
  }

  private finish(reason: DialogCloseReason): void {
    if (this.closedFlag || this.finishing) return;
    this.finishing = true;
    this.closedFlag = true;
    // A24-08：关闭后作废所有在途刷新回调，避免迟到结果改写已销毁窗口
    this.refreshToken += 1;
    this.refreshing = false;
    this.detach(reason);
    // A24-01：父窗口关闭时一并结束其子确认，避免子框“悬空”
    this.disposeDescendants(reason);
    if (isValid(this.overlay, true)) {
      this.overlayLifecycle.host = null;
      this.overlay.destroy();
    }
    this.notifyClose(reason);
  }

  private disposeDescendants(reason: DialogCloseReason): void {
    for (const child of registry.descendantsOf(this.id)) {
      const handle = dialogHandles.find((candidate) => candidate.id === child.id);
      if (handle && !handle.closed) handle.forceDispose(reason);
      else registry.unregisterOnce(child.id, reason);
    }
  }

  private detach(reason: DialogCloseReason): void {
    const idx = dialogHandles.indexOf(this);
    if (idx >= 0) dialogHandles.splice(idx, 1);
    registry.unregisterOnce(this.id, reason);
  }

  private notifyClose(reason: DialogCloseReason): void {
    const callbacks = [...this.closeCallbacks];
    this.closeCallbacks.length = 0;
    for (const cb of callbacks) {
      try {
        cb();
      } catch (err) {
        console.warn('[dialog] close callback failed', err);
      }
    }
    notifyClosed(reason);
  }
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
  /** 会话元信息（R31）：语义去重键、归属上下文、类型 */
  session?: DialogSessionOptions;
  onCancel?: () => void;
}

/**
 * 标题与底部固定、正文可滚动的通用弹窗（隐私政策全文、年报、关闭公司摘要等）。
 * 调用方往 handle.body 添加内容，往 handle.footer 添加按钮。
 */
export function openScrollableDialog(opts: ScrollableDialogOptions): DialogHandle {
  // A24-04：同语义 + 同 owner 已开 → 复用旧窗，不重复叠层
  const existing = reuseExistingDialog(opts.overlay, opts.session);
  if (existing) return existing;
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
  return new DialogHandleImpl(scaffold, opts.overlay, opts.session, opts.onCancel);
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
  /** 会话元信息（R31）：语义去重键、归属上下文、类型 */
  session?: DialogSessionOptions;
  /** 预览过期时的就地刷新（R31）：返回新的正文/按钮文案与可提交性 */
  onRefreshPreview?: () => Promise<{ message: string; confirmText: string; confirmEnabled: boolean }>;
  onConfirm: (handle: DialogHandle) => void | Promise<void>;
  onCancel?: () => void;
}

/**
 * 确认弹窗：一次开框一个意图；连点只提交一次；提交中/未知状态不可关闭；
 * 明确失败可同意图重试；成功调用 handle.succeed() 关闭。
 */
export function openConfirmDialog(opts: ConfirmDialogOptions): DialogHandle {
  const existing = reuseExistingDialog(opts.overlay, opts.session);
  if (existing) return existing;
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

  const messageNode = createLabel({
    text: opts.message,
    fontSize: TEXT_TOKENS.body.fontSize,
    lineHeight: TEXT_TOKENS.body.lineHeight,
    color: THEME.text,
    width: width - 56,
    align: 'left',
    parent: scaffold.body,
  });

  const handle = new DialogHandleImpl(scaffold, opts.overlay, opts.session, opts.onCancel);
  if (handle.closed) return handle;
  handle.bindMessage(messageNode);
  handle.configureRefresh(opts.onRefreshPreview ?? null);

  // 两个按钮同宽、同基线高（48），上下两行固定；避免 48/44 混用与窄屏文字挤压
  const actionWidth = Math.min(240, width - 64);
  const confirmButton = createButton({
    text: opts.confirmText,
    width: actionWidth,
    height: BUTTON_ACTION_HEIGHT,
    variant: 'primary',
    color: opts.danger ? THEME.danger : THEME.primary,
    disabled: opts.confirmEnabled === false,
    parent: scaffold.footer,
    onClick: () => void runConfirm(),
  });
  confirmButton.setPosition(0, FOOTER_BUTTON_OFFSET);

  const cancelButton = createButton({
    text: opts.cancelText ?? '再想想（取消）',
    width: actionWidth,
    height: BUTTON_ACTION_HEIGHT,
    variant: 'secondary',
    fontSize: TEXT_TOKENS.body.fontSize,
    color: Color.WHITE,
    textColor: THEME.text,
    parent: scaffold.footer,
    onClick: () => handle.cancel(),
  });
  cancelButton.setPosition(0, -FOOTER_BUTTON_OFFSET);

  handle.attachActions(confirmButton, cancelButton, opts.confirmText, opts.busyText ?? '处理中…');

  async function runConfirm(): Promise<void> {
    // 过期令牌：第一次点击只做“重新预览”，绝不携带旧预览直接提交
    if (handle.consumeExpired()) {
      await handle.refreshPreview();
      return;
    }
    // 状态机拦截连点：同一弹窗只发一个意图
    if (!handle.guard.begin()) return;
    // A24-08：每次尝试都必须复位 handled，不能沿用上一轮失败的结论
    handle.resetAttempt();
    handle.setError(null);
    handle.setBusy(true);
    try {
      await opts.onConfirm(handle);
      if (!handle.closed && !handle.handled) {
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
  /** 会话元信息（R31） */
  session?: DialogSessionOptions;
  onSubmit: (value: string, handle: DialogHandle) => void | Promise<void>;
  onCancel?: () => void;
}

/**
 * 输入弹窗：标签 + 字数 + 内联校验；卡片固定在上半区，键盘弹出不遮挡输入框与按钮。
 */
export function openInputDialog(opts: InputDialogOptions): DialogHandle {
  const existing = reuseExistingDialog(opts.overlay, opts.session);
  if (existing) return existing;
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

  const handle = new DialogHandleImpl(scaffold, opts.overlay, opts.session, opts.onCancel);
  const actionWidth = Math.min(240, width - 64);
  const submitButton = createButton({
    text: opts.submitText ?? '确定',
    width: actionWidth,
    height: BUTTON_ACTION_HEIGHT,
    variant: 'primary',
    parent: scaffold.footer,
    onClick: () => void submit(),
  });
  submitButton.setPosition(0, FOOTER_BUTTON_OFFSET);
  const cancelButton = createButton({
    text: opts.cancelText ?? '取消',
    width: actionWidth,
    height: BUTTON_ACTION_HEIGHT,
    variant: 'secondary',
    color: Color.WHITE,
    textColor: THEME.text,
    parent: scaffold.footer,
    onClick: () => handle.cancel(),
  });
  cancelButton.setPosition(0, -FOOTER_BUTTON_OFFSET);
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
    handle.resetAttempt();
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
  pruneDialogs();
  return dialogHandles.length;
}
