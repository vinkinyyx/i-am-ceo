/**
 * 金钱与基点工具（设计文档 02.1 / 03.5）。
 * - MoneyYuan 一律整数元，严格安全整数；禁止用浮点显示值回写账本。
 * - bps（基点）：10000 = 100%。
 * - 统一四舍五入 half-up（对非负数）；负数先算绝对值再还原符号。
 */
export type MoneyYuan = number;
export type Bps = number;

export const MAX_MONEY_YUAN = 100_000_000_000;
export const BPS_DENOMINATOR = 10_000;

export function isSafeMoney(value: number): value is MoneyYuan {
  return typeof value === 'number' && Number.isSafeInteger(value) && Math.abs(value) <= MAX_MONEY_YUAN;
}

export function assertSafeMoney(value: number, field = 'money'): MoneyYuan {
  if (!isSafeMoney(value)) {
    throw new Error(`invalid ${field}: ${value}`);
  }
  return value;
}

/** 非负数 half-up 四舍五入到整数。 */
function roundHalfUpPositive(value: number): number {
  return Math.floor(value + 0.5);
}

/**
 * 基点乘除：roundHalfUpNonNegative(a*bps,10000) 的带符号版本。
 * 负数额先算绝对值再还原符号，保证跨平台一致（不依赖 Math.round 对负数的行为）。
 */
export function applyBps(amount: number, bps: number): number {
  if (!Number.isFinite(amount) || !Number.isFinite(bps)) {
    throw new Error(`non-finite bps calc: ${amount}, ${bps}`);
  }
  const sign = amount < 0 ? -1 : 1;
  const magnitude = Math.abs(amount) * Math.abs(bps);
  return sign * roundHalfUpPositive(magnitude / BPS_DENOMINATOR);
}

/** 通用 half-up 四舍五入（带符号安全）。 */
export function roundHalfUp(value: number): number {
  const sign = value < 0 ? -1 : 1;
  return sign * roundHalfUpPositive(Math.abs(value));
}

/** 钳制到安全金钱上限。 */
export function clampMoney(value: number): MoneyYuan {
  const rounded = Math.trunc(value);
  if (rounded > MAX_MONEY_YUAN) return MAX_MONEY_YUAN;
  if (rounded < -MAX_MONEY_YUAN) return -MAX_MONEY_YUAN;
  return rounded;
}

/** 元 → 万元展示字符串（仅展示层使用，绝不回写账本）。 */
export function formatWan(yuan: number): string {
  return (yuan / 10_000).toFixed(2);
}
