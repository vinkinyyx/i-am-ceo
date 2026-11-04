/**
 * 全局领域错误码（设计文档 01.4 / 12.10）。
 * 任何业务失败都必须返回这些稳定错误码，并映射固定中文友好文案。
 */
export const GameErrorCode = {
  NOT_READY: 'NOT_READY',
  RUN_CHANGED: 'RUN_CHANGED',
  REVISION_CONFLICT: 'REVISION_CONFLICT',
  INVALID_NAME: 'INVALID_NAME',
  INVALID_INDUSTRY: 'INVALID_INDUSTRY',
  INVALID_TRAIT: 'INVALID_TRAIT',
  INVALID_POLICY: 'INVALID_POLICY',
  INVALID_SPEED: 'INVALID_SPEED',
  INVALID_AMOUNT: 'INVALID_AMOUNT',
  INVALID_TARGET: 'INVALID_TARGET',
  ONBOARDING_INCOMPLETE: 'ONBOARDING_INCOMPLETE',
  OFFER_EXPIRED: 'OFFER_EXPIRED',
  INSUFFICIENT_CASH: 'INSUFFICIENT_CASH',
  DEPT_ALREADY_EXISTS: 'DEPT_ALREADY_EXISTS',
  DEPT_NOT_FOUND: 'DEPT_NOT_FOUND',
  EMPLOYEE_NOT_FOUND: 'EMPLOYEE_NOT_FOUND',
  EMPLOYEE_NOT_DISMISSIBLE: 'EMPLOYEE_NOT_DISMISSIBLE',
  CONFIRMATION_EXPIRED: 'CONFIRMATION_EXPIRED',
  AUTOMATION_LOCKED: 'AUTOMATION_LOCKED',
  MONTH_ALREADY_SETTLED: 'MONTH_ALREADY_SETTLED',
  ALREADY_USED: 'ALREADY_USED',
  SAVE_FAILED: 'SAVE_FAILED',
  SAVE_UNAVAILABLE: 'SAVE_UNAVAILABLE',
  SAVE_RECOVERY_REQUIRED: 'SAVE_RECOVERY_REQUIRED',
  SAVE_CORRUPT: 'SAVE_CORRUPT',
  RESET_IN_PROGRESS: 'RESET_IN_PROGRESS',
  PLATFORM_UNAVAILABLE: 'PLATFORM_UNAVAILABLE',
  AUTH_REQUIRED: 'AUTH_REQUIRED',
} as const;

export type GameErrorCode = (typeof GameErrorCode)[keyof typeof GameErrorCode];

/**
 * 错误码 → 玩家可见中文文案（设计文档 12.10）。
 * 占位符使用 `{name}` 形式，由 UI 层填充，禁止把异常堆栈直接展示给玩家。
 */
const DEFAULT_MESSAGES: Record<GameErrorCode, string> = {
  NOT_READY: '当前还不能进行该操作。',
  RUN_CHANGED: '公司已重新创建，旧操作已取消。',
  REVISION_CONFLICT: '状态已变化，请刷新后重试。',
  INVALID_NAME: '名称不合法，请检查长度或内容后重试。',
  INVALID_INDUSTRY: '请选择一个有效的主营行业。',
  INVALID_TRAIT: '请选择一个有效的 CEO 性格。',
  INVALID_POLICY: '经营方针无效。',
  INVALID_SPEED: '时间速度无效。',
  INVALID_AMOUNT: '金额无效。',
  INVALID_TARGET: '目标人数无效。',
  ONBOARDING_INCOMPLETE: '请先完成初始招聘。',
  OFFER_EXPIRED: '候选人信息已经更新，请重新选择。',
  INSUFFICIENT_CASH: '当前现金不足，还需要 ¥{gap}。',
  DEPT_ALREADY_EXISTS: '已创建此部门，可进入管理。',
  DEPT_NOT_FOUND: '部门不存在。',
  EMPLOYEE_NOT_FOUND: '员工不存在。',
  EMPLOYEE_NOT_DISMISSIBLE: '该员工当前不可裁员。',
  CONFIRMATION_EXPIRED: '确认已失效，请重新查看费用后确认。',
  AUTOMATION_LOCKED: '该部门已手动锁定，自动经营不会改动。',
  MONTH_ALREADY_SETTLED: '本月已结算。',
  ALREADY_USED: '该一次性机会已经使用过。',
  SAVE_FAILED: '保存失败，本次操作未确认保存，请重试。',
  SAVE_UNAVAILABLE: '存档暂时无法读取，请稍后重试。',
  SAVE_RECOVERY_REQUIRED: '正在核对上次操作，核对完成前请勿重复提交。',
  SAVE_CORRUPT: '本地存档损坏且无法自动恢复。',
  RESET_IN_PROGRESS: '正在关闭旧公司，暂不能执行其他操作。',
  PLATFORM_UNAVAILABLE: '平台能力暂不可用，可先进行本地游玩。',
  AUTH_REQUIRED: '需要完成平台登录后才能继续。',
};

export class GameError extends Error {
  readonly code: GameErrorCode;
  readonly details?: Readonly<Record<string, unknown>>;

  constructor(code: GameErrorCode, details?: Record<string, unknown>, message?: string) {
    super(message ?? DEFAULT_MESSAGES[code]);
    this.name = 'GameError';
    this.code = code;
    if (details !== undefined) {
      this.details = { ...details };
    }
  }

  /** 生成玩家文案，支持简单占位符替换。 */
  toDisplayMessage(params?: Record<string, string | number>): string {
    let text = DEFAULT_MESSAGES[this.code];
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        text = text.replace(`{${key}}`, String(value));
      }
    }
    return text;
  }
}

export function errorMessage(code: GameErrorCode, params?: Record<string, string | number>): string {
  let text = DEFAULT_MESSAGES[code];
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      text = text.replace(`{${key}}`, String(value));
    }
  }
  return text;
}
