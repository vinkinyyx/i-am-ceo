/**
 * 纯 TS 状态深拷贝（R05 / REL-03）。
 *
 * 设计契约（总览 §15.3.1/§14.4 第 8 条）：
 * - GameState 是纯 JSON 契约：不含 Date/Map/Set/函数/循环引用；
 * - 不依赖宿主 structuredClone（部分小游戏运行时缺失）；
 * - 不安装“行为不全”的全局 structuredClone 假实现；
 * - 发现 undefined 字段值、NaN/Infinity 等无法安全往返的数据时直接抛错，
 *   绝不静默转换成不同业务值（如 null/0）；
 * - 复制结果与原对象无共享嵌套引用。
 */
import type { GameState } from '../domain/types';

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export class CloneError extends Error {
  constructor(
    message: string,
    readonly path: string,
  ) {
    super(`cloneGameState failed at ${path || '<root>'}: ${message}`);
    this.name = 'CloneError';
  }
}

export function cloneJsonValue(value: unknown): JsonValue {
  return cloneJson(value, '');
}

function cloneJson(value: unknown, path: string): JsonValue {
  if (value === null) return null;
  const t = typeof value;
  if (t === 'boolean' || t === 'string') return value as JsonValue;
  if (t === 'number') {
    const n = value as number;
    if (!Number.isFinite(n)) throw new CloneError('non-finite number', path);
    return n;
  }
  if (t === 'undefined') {
    throw new CloneError('undefined is not representable in save JSON', path);
  }
  if (t === 'bigint' || t === 'function' || t === 'symbol') {
    throw new CloneError(`${t} is not serializable`, path);
  }
  if (Array.isArray(value)) {
    return value.map((item, i) => cloneJson(item, `${path}[${i}]`));
  }
  if (t === 'object') {
    if (value instanceof Date) throw new CloneError('Date is not allowed in GameState', path);
    if (value instanceof Map || value instanceof Set) {
      throw new CloneError(`${value.constructor.name} is not allowed in GameState`, path);
    }
    const source = value as Record<string, unknown>;
    const out: Record<string, JsonValue> = {};
    for (const key of Object.keys(source)) {
      const child = source[key];
      if (child === undefined) {
        // 与 JSON.stringify 丢弃 undefined 的行为不同：显式抛错，避免静默丢字段
        throw new CloneError('undefined property value', path ? `${path}.${key}` : key);
      }
      out[key] = cloneJson(child, path ? `${path}.${key}` : key);
    }
    return out;
  }
  throw new CloneError(`unsupported value type ${t}`, path);
}

/**
 * 深拷贝 GameState。输入必须是可安全 JSON 往返的数据。
 * 使用“先序列化再解析”之外的显式递归，使非法数据在确定路径上失败，
 * 同时避免部分宿主 JSON 实现差异；返回类型保持 GameState（结构契约由调用侧保证）。
 */
export function cloneGameState(state: GameState): GameState {
  return cloneJson(state, '') as unknown as GameState;
}

/** 判断宿主是否原生提供可用的 structuredClone（仅探测，不做 polyfill）。 */
export function hasNativeStructuredClone(): boolean {
  return typeof (globalThis as { structuredClone?: unknown }).structuredClone === 'function';
}
