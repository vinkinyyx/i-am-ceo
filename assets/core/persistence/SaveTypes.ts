import type { GameState } from '../domain/types';

/**
 * 存档信封（设计文档 02.2 / save.schema.json）。
 */
export interface SaveEnvelope {
  schemaVersion: 1;
  gameVersion: string;
  configVersion: string;
  checksum: string;
  revision: number;
  runId: string;
  resetGeneration: number;
  payload: GameState;
}

/** 活动指针：指向当前生效的槽位。 */
export interface SavePointer {
  slot: 'a' | 'b';
  revision: number;
  runId: string;
  resetGeneration: number;
}

/** 关闭公司墓碑：阻止旧 run 复活（设计文档 02.5）。 */
export interface ResetTombstone {
  oldRunId: string;
  newResetGeneration: number;
  resetAtMs: number;
}

export const SAVE_KEYS = {
  slotA: 'ceo/save/a',
  slotB: 'ceo/save/b',
  active: 'ceo/save/active',
  tombstone: 'ceo/reset/tombstone',
} as const;

export const CURRENT_SCHEMA_VERSION = 1 as const;
export const CURRENT_CONFIG_VERSION = 'economy-v1.0.0';
