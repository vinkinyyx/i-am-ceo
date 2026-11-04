import { crc32String } from './crc32';
import { canonicalStringify } from './canonical';
import { verifyEnvelope } from './SaveCodec';
import { migrateEnvelope } from './SaveMigration';
import { validateGameState } from './stateIntegrity';
import { utf8ByteLength } from './utf8';
import type { CloudCheckpointSummary, CloudCheckpointV1, CloudEnvironment } from './CloudSaveTypes';
import { CLOUD_MAX_SNAPSHOT_BYTES, CLOUD_MAX_TRANSFER_BYTES, CLOUD_MAX_PARENTS } from './CloudSaveTypes';
import type { GameState } from '../domain/types';

export type CloudDecodeResult =
  | { ok: true; checkpoint: CloudCheckpointV1 }
  | { ok: false; reason: string };

function checkpointBody(checkpoint: Omit<CloudCheckpointV1, 'checksum'> | CloudCheckpointV1): Omit<CloudCheckpointV1, 'checksum'> {
  const body = { ...checkpoint } as Partial<CloudCheckpointV1>;
  delete body.checksum;
  return body as Omit<CloudCheckpointV1, 'checksum'>;
}

export function cloudCheckpointChecksum(checkpoint: Omit<CloudCheckpointV1, 'checksum'>): string {
  return crc32String(canonicalStringify(checkpoint));
}

export function summarizeGameState(state: GameState): CloudCheckpointSummary {
  return {
    industry: state.company?.industry ?? null,
    phase: state.phase,
    year: state.gameYear,
    month: state.gameMonth,
    cashYuan: state.company?.cashYuan ?? 0,
    assetsYuan: (state.company?.cashYuan ?? 0) + (state.company?.businessAssetBookYuan ?? 0),
    employeeCount: state.employees.filter((e) => e.status === 'ACTIVE' || e.status === 'PENDING_DISMISSAL').length,
  };
}

export function createCloudCheckpoint(input: Omit<CloudCheckpointV1, 'protocolVersion' | 'checksum' | 'summary'>): CloudCheckpointV1 {
  const checkpoint = {
    ...input,
    protocolVersion: 1 as const,
    summary: summarizeGameState(input.snapshot.payload),
  };
  const bytes = utf8ByteLength(canonicalStringify(checkpoint));
  if (bytes > CLOUD_MAX_TRANSFER_BYTES) throw new Error(`cloud-checkpoint-too-large:${bytes}`);
  if (utf8ByteLength(canonicalStringify(input.snapshot)) > CLOUD_MAX_SNAPSHOT_BYTES) throw new Error('cloud-snapshot-too-large');
  return { ...checkpoint, checksum: cloudCheckpointChecksum(checkpoint) };
}

export function encodeCloudCheckpoint(checkpoint: CloudCheckpointV1): string {
  const checked = decodeCloudCheckpoint(canonicalStringify(checkpoint), checkpoint.appId, checkpoint.environment);
  if (!checked.ok) throw new Error(`invalid-cloud-checkpoint:${checked.reason}`);
  return canonicalStringify(checkpoint);
}

export function decodeCloudCheckpoint(
  raw: string,
  expectedAppId: string,
  expectedEnvironment: CloudEnvironment,
): CloudDecodeResult {
  if (typeof raw !== 'string' || utf8ByteLength(raw) > CLOUD_MAX_TRANSFER_BYTES) return { ok: false, reason: 'transfer-size' };
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return { ok: false, reason: 'invalid-json' }; }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { ok: false, reason: 'not-object' };
  const value = parsed as Partial<CloudCheckpointV1>;
  if (value.protocolVersion !== 1) return { ok: false, reason: 'unsupported-protocol' };
  if (value.appId !== expectedAppId || value.environment !== expectedEnvironment) return { ok: false, reason: 'app-or-environment-mismatch' };
  if (!validId(value.cloudProfileId, 96) || !validId(value.checkpointId, 128) || !validId(value.deviceInstanceId, 128)) return { ok: false, reason: 'invalid-id' };
  if (!Array.isArray(value.parentCheckpointIds) || value.parentCheckpointIds.length > CLOUD_MAX_PARENTS
    || value.parentCheckpointIds.some((id) => !validId(id, 128))
    || new Set(value.parentCheckpointIds).size !== value.parentCheckpointIds.length) return { ok: false, reason: 'invalid-parents' };
  if (!value.resetEpoch || !validId(value.resetEpoch.id, 128)
    || (value.resetEpoch.parentId !== null && !validId(value.resetEpoch.parentId, 128))
    || (value.resetEpoch.closedRunId !== null && !validId(value.resetEpoch.closedRunId, 128))) return { ok: false, reason: 'invalid-reset-epoch' };
  if (!Number.isSafeInteger(value.localRevision) || (value.localRevision ?? -1) < 0
    || !Number.isSafeInteger(value.capturedAtMs) || (value.capturedAtMs ?? -1) < 0) return { ok: false, reason: 'invalid-time-or-revision' };
  if (!value.snapshot || typeof value.snapshot !== 'object') return { ok: false, reason: 'missing-snapshot' };
  if (utf8ByteLength(canonicalStringify(value.snapshot)) > CLOUD_MAX_SNAPSHOT_BYTES) return { ok: false, reason: 'snapshot-size' };
  const verified = verifyEnvelope(value.snapshot);
  if (!verified.ok) return { ok: false, reason: `snapshot-${verified.reason}` };
  let migrated;
  try { migrated = migrateEnvelope(value.snapshot, 1); } catch { return { ok: false, reason: 'snapshot-migration' }; }
  const integrity = validateGameState(migrated.payload);
  if (!integrity.ok) return { ok: false, reason: `snapshot-${integrity.reason}` };
  if (value.resetEpoch?.closedRunId && value.resetEpoch.closedRunId === migrated.payload.runId) {
    return { ok: false, reason: 'checkpoint-resurrects-closed-run' };
  }
  if (!value.summary || canonicalStringify(value.summary) !== canonicalStringify(summarizeGameState(migrated.payload))) return { ok: false, reason: 'summary-mismatch' };
  const body = checkpointBody(value as CloudCheckpointV1);
  if (typeof value.checksum !== 'string' || cloudCheckpointChecksum(body) !== value.checksum) return { ok: false, reason: 'checkpoint-checksum' };
  return { ok: true, checkpoint: value as CloudCheckpointV1 };
}

function validId(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= max && /^[A-Za-z0-9._:-]+$/.test(value);
}
