import { deriveSeed } from '../simulation/rng';

/**
 * 稳定 ID 生成：优先使用确定性派生（可复现测试），
 * 实体 ID 以类型前缀区分，避免跨实体碰撞。
 */
let nonce = 0;

export function resetNonceForTest(value = 0): void {
  nonce = value;
}

function pad(value: number): string {
  return value.toString(36).padStart(6, '0');
}

export function newRunId(seed: number, createdAtMs: number): string {
  return `run_${deriveSeed(seed, createdAtMs).toString(36)}${pad(nonce++ & 0xffffffff)}`;
}

export function newId(prefix: string, seedKey: string, sequence: number): string {
  return `${prefix}_${deriveSeed(seedKey, sequence).toString(36)}${pad(sequence & 0xffffff)}`;
}

/** 全局唯一 entry/offer token（命令确认令牌等）。 */
export function uniqueToken(prefix: string): string {
  nonce += 1;
  return `${prefix}_${Date.now().toString(36)}${pad(nonce & 0xffffff)}`;
}
