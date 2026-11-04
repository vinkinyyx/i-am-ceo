import type { SaveEnvelope } from './SaveTypes';

export type CloudEnvironment = 'test' | 'production';

export interface CloudResetEpoch {
  id: string;
  parentId: string | null;
  closedRunId: string | null;
}

export interface CloudCheckpointSummary {
  industry: string | null;
  phase: string;
  year: number;
  month: number;
  cashYuan: number;
  assetsYuan: number;
  employeeCount: number;
}

/** Immutable client checkpoint. CRC only detects accidental corruption; it is not a signature. */
export interface CloudCheckpointV1 {
  protocolVersion: 1;
  appId: string;
  environment: CloudEnvironment;
  cloudProfileId: string;
  checkpointId: string;
  parentCheckpointIds: string[];
  resetEpoch: CloudResetEpoch;
  deviceInstanceId: string;
  localRevision: number;
  capturedAtMs: number;
  snapshot: SaveEnvelope;
  summary: CloudCheckpointSummary;
  checksum: string;
}

export interface CloudArchiveRef {
  uuid: string;
  fileId: string;
  name: string;
  summary?: string;
  extra?: string;
}

export type CloudOperationResult<T> =
  | { kind: 'ok'; value: T }
  | { kind: 'missing' }
  | { kind: 'unsupported' }
  | { kind: 'unavailable'; code?: number; reason: string }
  | { kind: 'unknown'; operationId: string; reason: string };

export interface CloudRuntimeConfig {
  schemaVersion: 1;
  enabled: boolean;
  environment: 'disabled' | CloudEnvironment;
  appId: string;
  policyVersion: number;
  minUploadIntervalMs: number;
  autoBackupIntervalMs: number;
  retainedCheckpoints: number;
}

export const CLOUD_MAX_SNAPSHOT_BYTES = 500_000;
export const CLOUD_MAX_TRANSFER_BYTES = 550_000;
export const CLOUD_MAX_PARENTS = 2;
