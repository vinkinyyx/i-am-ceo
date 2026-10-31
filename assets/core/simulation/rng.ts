/**
 * 可复现随机数（设计文档 05.3 / 03.7）。
 * 使用 mulberry32（确定性 32 位 PRNG）+ 字符串 hash 衍生独立流。
 * 关键约束：刷新公司名 / 打开界面使用独立 RNG 流，绝不改变市场事件随机序列。
 */

/** xmur3 字符串 hash → 32 位无符号整数。 */
export function hashString(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

/** 组合多个输入为一个 32 位 seed。 */
export function deriveSeed(...parts: Array<string | number>): number {
  return hashString(parts.map((p) => String(p)).join('|'));
}

export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** 衍生一个互不相关的子 RNG（命名空间隔离随机流）。 */
  derive(namespace: string): Rng {
    return new Rng(deriveSeed(this.state >>> 0, namespace));
  }

  /** [0, 2^32) 原始整数。 */
  nextUint32(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  }

  /** [0, 1) 浮点。 */
  next(): number {
    return this.nextUint32() / 4294967296;
  }

  /** [min, max] 闭区间整数。 */
  nextInt(min: number, max: number): number {
    if (max < min) throw new Error(`nextInt range invalid: ${min}..${max}`);
    const span = max - min + 1;
    return min + Math.floor(this.next() * span);
  }

  /** 从数组中取一项。 */
  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('pick from empty array');
    const item = items[this.nextInt(0, items.length - 1)];
    if (item === undefined) throw new Error('pick returned undefined');
    return item;
  }

  /** 从数组中取 n 个不重复项。 */
  sample<T>(items: readonly T[], n: number): T[] {
    if (n > items.length) throw new Error(`sample ${n} from ${items.length} items`);
    const pool = [...items];
    const result: T[] = [];
    for (let i = 0; i < n; i++) {
      const idx = this.nextInt(0, pool.length - 1);
      const picked = pool[idx];
      if (picked === undefined) throw new Error('sample returned undefined');
      result.push(picked);
      pool.splice(idx, 1);
    }
    return result;
  }
}

/** 全局随机 32 位 seed（仅用于创建新 run / 非确定性 UI 场景）。 */
export function randomSeed(): number {
  const cryptoApi = (globalThis as { crypto?: { getRandomValues?: (arr: Uint32Array) => void } })
    .crypto;
  if (cryptoApi && typeof cryptoApi.getRandomValues === 'function') {
    const arr = new Uint32Array(1);
    cryptoApi.getRandomValues(arr);
    const v = arr[0];
    if (v !== undefined) return v >>> 0;
  }
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
}
