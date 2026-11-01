import { Color, Label, Node, UITransform, view } from 'cc';

/**
 * 启动故障捕获（诊断设施）：真机卡启动页时把错误直接显示在屏幕上。
 * - 捕获全局 error / unhandledrejection；
 * - 8 秒看门狗：超时未 ready 就把已收集的错误（或"无错误但卡死"）显示出来；
 * - 场景未渲染时退化为直接在首屏 canvas 的 2d 上下文上绘制文字。
 * 仅在启动阶段起作用，ready 后自动失效，不影响正常运行。
 */

const errors: string[] = [];
let ready = false;
let watchdogTimer: ReturnType<typeof setTimeout> | null = null;
let labelNode: Node | null = null;
let installed = false;

function pushError(prefix: string, err: unknown): void {
  let msg: string;
  if (err instanceof Error) {
    msg = `${err.name}: ${err.message}`;
  } else if (err && typeof err === 'object' && 'reason' in (err as object)) {
    msg = String((err as { reason: unknown }).reason);
  } else {
    msg = String(err);
  }
  errors.push(`${prefix} ${msg}`.slice(0, 500));
  if (!ready) showErrors();
}

/** 在全局安装错误捕获（幂等）。 */
export function installBootTrap(): void {
  if (installed) return;
  installed = true;
  const g = globalThis as {
    addEventListener?: (type: string, cb: (e: unknown) => void) => void;
    onerror?: unknown;
  };
  try {
    if (typeof g.addEventListener === 'function') {
      g.addEventListener('error', (e) => {
        const ev = e as { message?: string; error?: unknown };
        pushError('[error]', ev.error ?? ev.message ?? e);
      });
      g.addEventListener('unhandledrejection', (e) => pushError('[unhandled]', e));
    }
  } catch {
    /* 运行时不支持全局监听则跳过，看门狗仍会兜底 */
  }
}

/** AppView.start 最早调用：创建隐藏的诊断 Label 并启动看门狗。 */
export function bootTrapWatchdog(parent: Node): void {
  installBootTrap();
  if (watchdogTimer !== null) return;
  const size = view.getVisibleSize();
  labelNode = new Node('BootTrapLabel');
  labelNode.layer = parent.layer;
  const ut = labelNode.addComponent(UITransform);
  ut.setContentSize(size.width - 40, size.height - 160);
  const lb = labelNode.addComponent(Label);
  labelNode.setPosition(0, -40, 0);
  lb.string = '';
  lb.fontSize = 16;
  lb.lineHeight = 22;
  lb.color = new Color(255, 80, 80);
  lb.overflow = Label.Overflow.SHRINK;
  lb.horizontalAlign = Label.HorizontalAlign.LEFT;
  lb.verticalAlign = Label.VerticalAlign.TOP;
  parent.addChild(labelNode);
  watchdogTimer = setTimeout(() => {
    if (!ready) showErrors(true);
  }, 8000);
}

/** 启动成功：撤掉看门狗与诊断 Label。 */
export function bootTrapReady(): void {
  ready = true;
  if (watchdogTimer !== null) {
    clearTimeout(watchdogTimer);
    watchdogTimer = null;
  }
  if (labelNode) {
    labelNode.destroy();
    labelNode = null;
  }
}

/** start 内捕获到异常时调用：立即上屏。 */
export function bootTrapError(err: unknown): void {
  pushError('[boot]', err);
}

function collectText(isTimeout: boolean): string {
  const head = isTimeout && errors.length === 0
    ? 'BOOT TIMEOUT：8 秒未完成启动，且未捕获到 JS 错误（疑似引擎/运行时级卡死）'
    : '启动失败，请截图发给开发：';
  return `${head}\n${errors.join('\n')}`.slice(0, 1500);
}

function showErrors(isTimeout = false): void {
  const text = collectText(isTimeout);
  if (labelNode) {
    const lb = labelNode.getComponent(Label);
    if (lb) lb.string = text;
    return;
  }
  // 场景尚未渲染：直接在首屏 2d 画布上画（引擎卡住时的兜底通道）
  try {
    const g = globalThis as { canvas?: { getContext?: (t: string) => unknown } };
    const canvas = g.canvas;
    const ctx = canvas && typeof canvas.getContext === 'function'
      ? (canvas.getContext('2d') as {
          fillStyle?: string;
          font?: string;
          fillText?: (t: string, x: number, y: number) => void;
        } | null)
      : null;
    if (ctx && typeof ctx.fillText === 'function') {
      ctx.fillStyle = '#ff5050';
      ctx.font = '24px sans-serif';
      const lines = text.split('\n');
      lines.forEach((line, i) => ctx.fillText!(line, 30, 120 + i * 36));
    }
  } catch {
    /* 画布不可写则放弃，真机日志里仍有 console 记录 */
  }
}
