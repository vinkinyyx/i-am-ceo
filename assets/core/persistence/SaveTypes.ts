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

/** Durable target for a cloud run replacement; it makes the post-tombstone point recoverable. */
export interface PreparedRunReplacement {
  protocolVersion: 1;
  operationId: string;
  ownerScope: string;
  baseRunId: string;
  baseRevision: number;
  baseResetGeneration: number;
  targetRunId: string;
  targetRevision: 1;
  targetResetGeneration: number;
  targetChecksum: string;
  preparedAtMs: number;
}

export const SAVE_KEYS = {
  slotA: 'ceo/save/a',
  slotB: 'ceo/save/b',
  active: 'ceo/save/active',
  tombstone: 'ceo/reset/tombstone',
  /** R12：有界事务日志，只存元数据，不存业务状态。 */
  transaction: 'ceo/save/transaction',
  replaceIntent: 'ceo/save/replace-intent',
  replaceStaging: 'ceo/save/replace-staging',
} as const;

/**
 * R12 事务日志（§15.3.2）：写非活动槽前先落 journal，
 * 用于断电/回调未知时判断“未提交 / 实际已提交”。不保存整份业务状态。
 */
export interface SaveTransactionJournal {
  protocolVersion: 1;
  transactionId: string;
  kind: 'commit' | 'replace-run';
  operationId?: string;
  ownerScope?: string;
  basePointer: SavePointer | null;
  targetPointer: SavePointer;
  targetChecksum: string;
  createdAtMs: number;
}

export const CURRENT_SCHEMA_VERSION = 1 as const;
export const CURRENT_CONFIG_VERSION = 'economy-v1.0.0';
