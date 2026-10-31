import { crc32String } from './crc32';
import { canonicalStringify } from './canonical';
import { CURRENT_CONFIG_VERSION, CURRENT_SCHEMA_VERSION, type SaveEnvelope } from './SaveTypes';
import type { GameState } from '../domain/types';

export const GAME_VERSION = '0.1.0';

/** 计算信封 checksum：对去掉 checksum 字段的其余内容做规范序列化。 */
export function computeChecksum(envelope: Omit<SaveEnvelope, 'checksum'>): string {
  const { schemaVersion, gameVersion, configVersion, revision, runId, resetGeneration, payload } =
    envelope;
  return crc32String(
    canonicalStringify({
      schemaVersion,
      gameVersion,
      configVersion,
      revision,
      runId,
      resetGeneration,
      payload,
    }),
  );
}

export interface EncodeOptions {
  revision: number;
  runId: string;
  resetGeneration: number;
  gameVersion?: string;
  configVersion?: string;
}

/** 生成带 checksum 的完整信封。 */
export function encodeEnvelope(state: GameState, options: EncodeOptions): SaveEnvelope {
  const base = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    gameVersion: options.gameVersion ?? GAME_VERSION,
    configVersion: options.configVersion ?? CURRENT_CONFIG_VERSION,
    revision: options.revision,
    runId: options.runId,
    resetGeneration: options.resetGeneration,
    payload: state,
  };
  return { ...base, checksum: computeChecksum(base) };
}

export type VerifyResult = { ok: true } | { ok: false; reason: string };

/** 校验信封结构与 checksum。 */
export function verifyEnvelope(envelope: unknown): VerifyResult {
  if (envelope === null || typeof envelope !== 'object') {
    return { ok: false, reason: 'not-an-object' };
  }
  const e = envelope as Partial<SaveEnvelope>;
  if (e.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    return { ok: false, reason: `unsupported-schema:${String(e.schemaVersion)}` };
  }
  if (typeof e.revision !== 'number' || typeof e.runId !== 'string') {
    return { ok: false, reason: 'missing-fields' };
  }
  if (typeof e.checksum !== 'string' || e.payload === undefined) {
    return { ok: false, reason: 'missing-checksum-or-payload' };
  }
  const expected = computeChecksum({
    schemaVersion: e.schemaVersion,
    gameVersion: e.gameVersion ?? GAME_VERSION,
    configVersion: e.configVersion ?? CURRENT_CONFIG_VERSION,
    revision: e.revision,
    runId: e.runId,
    resetGeneration: e.resetGeneration ?? 0,
    payload: e.payload,
  });
  if (expected !== e.checksum) {
    return { ok: false, reason: 'checksum-mismatch' };
  }
  return { ok: true };
}
