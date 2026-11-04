import type { GameFacade } from './GameFacade';
import type { CloudArchiveRef, CloudCheckpointV1, CloudOperationResult, CloudRuntimeConfig } from '../persistence/CloudSaveTypes';
import { decodeCloudCheckpoint } from '../persistence/CloudSaveCodec';
import type { ICloudSaveProvider } from '../platform/ICloudSaveProvider';
import type { IStorageBackend } from '../platform/ITapPlatform';

const INTENT_KEY = 'ceo/cloud/pending-create/v1';
const LAST_UPLOAD_KEY = 'ceo/cloud/last-upload/v1';

interface PendingCreate { operationId: string; checkpointId: string; profileId: string; createdAtMs: number; }
export interface CloudSyncStatus {
  enabled: boolean;
  available: boolean;
  profileId: string | null;
  lastConfirmedAtMs: number | null;
  pendingCheckpointId: string | null;
}

/** Player initiated cloud checkpoint orchestration. It never resolves a timeout by replaying create. */
export class CloudSyncService {
  constructor(
    private readonly provider: ICloudSaveProvider,
    private readonly storage: IStorageBackend,
    private readonly config: CloudRuntimeConfig,
    private readonly appId: string,
    private readonly environment: 'test' | 'production',
    private readonly profileId: string | null,
  ) {}

  async status(): Promise<CloudSyncStatus> {
    const pending = await this.storage.get<PendingCreate>(INTENT_KEY).catch(() => null);
    const last = await this.storage.get<number>(LAST_UPLOAD_KEY).catch(() => null);
    return { enabled: this.config.enabled, available: this.config.enabled && this.provider.capabilities().available,
      profileId: this.profileId, lastConfirmedAtMs: Number.isSafeInteger(last) ? last : null,
      pendingCheckpointId: pending?.checkpointId ?? null };
  }

  async list(operationId: string): Promise<CloudOperationResult<CloudArchiveRef[]>> {
    if (!this.ready()) return { kind: 'unsupported' };
    const result = await this.provider.list(operationId);
    if (result.kind !== 'ok') return result;
    return { kind: 'ok', value: result.value.filter((ref) => this.belongsToBoundProfile(ref)) };
  }

  async backup(checkpoint: CloudCheckpointV1, filePath: string, operationId: string, nowMs: number): Promise<CloudOperationResult<CloudArchiveRef>> {
    if (!this.ready() || checkpoint.appId !== this.appId || checkpoint.environment !== this.environment
      || checkpoint.cloudProfileId !== this.profileId) return { kind: 'unsupported' };
    const pending = await this.storage.get<PendingCreate>(INTENT_KEY).catch(() => null);
    if (pending) {
      if (pending.profileId !== this.profileId) return { kind: 'unavailable', reason: 'account-switch-pending-create' };
      const resolved = await this.findCheckpoint(pending.checkpointId, `${operationId}:recover`);
      if (resolved.kind === 'ok') {
        await this.storage.set(LAST_UPLOAD_KEY, pending.createdAtMs);
        await this.storage.remove(INTENT_KEY);
        return { kind: 'ok', value: resolved.value };
      }
      // A list failure or absent record cannot prove the create failed. Never replay it.
      return { kind: 'unknown', operationId: pending.operationId, reason: 'prior-create-needs-platform-reconciliation' };
    }
    if (!Number.isSafeInteger(nowMs) || nowMs < 0) return { kind: 'unavailable', reason: 'invalid-time' };
    const last = await this.storage.get<number>(LAST_UPLOAD_KEY).catch(() => null);
    if (Number.isSafeInteger(last) && nowMs - (last as number) < this.config.minUploadIntervalMs) {
      return { kind: 'unavailable', reason: 'upload-rate-limited' };
    }
    const intent: PendingCreate = { operationId, checkpointId: checkpoint.checkpointId, profileId: this.profileId!, createdAtMs: nowMs };
    try { await this.storage.set(INTENT_KEY, intent); }
    catch { return { kind: 'unavailable', reason: 'intent-not-durable' }; }
    const created = await this.provider.create(operationId, checkpoint, filePath);
    if (created.kind === 'ok') {
      await this.storage.set(LAST_UPLOAD_KEY, nowMs);
      await this.storage.remove(INTENT_KEY);
    } else if (created.kind !== 'unknown') {
      await this.storage.remove(INTENT_KEY).catch(() => undefined);
    }
    return created;
  }

  async restore(
    archive: CloudArchiveRef,
    targetFilePath: string,
    operationId: string,
    facade: GameFacade,
    nowMs: number,
  ): Promise<CloudOperationResult<true>> {
    if (!this.ready() || !this.belongsToBoundProfile(archive)) return { kind: 'unsupported' };
    const downloaded = await this.provider.download(operationId, archive, targetFilePath);
    if (downloaded.kind !== 'ok') return downloaded as CloudOperationResult<true>;
    const raw = await this.provider.readLocal(`${operationId}:read`, downloaded.value);
    if (raw.kind !== 'ok') return raw as CloudOperationResult<true>;
    const decoded = decodeCloudCheckpoint(raw.value, this.appId, this.environment);
    if (!decoded.ok || decoded.checkpoint.cloudProfileId !== this.profileId) {
      return { kind: 'unavailable', reason: decoded.ok ? 'account-profile-mismatch' : decoded.reason };
    }
    const archiveCheckpointId = this.metadata(archive)?.checkpointId;
    if (archiveCheckpointId !== decoded.checkpoint.checkpointId) return { kind: 'unavailable', reason: 'archive-checkpoint-mismatch' };
    const current = facade.getState();
    const imported = await facade.importCloudCheckpointState(decoded.checkpoint.snapshot.payload, current.runId, facade.getRevision(), nowMs);
    return imported.ok ? { kind: 'ok', value: true } : { kind: 'unavailable', reason: imported.code };
  }

  private ready(): boolean {
    return this.config.enabled && this.config.policyVersion === 3 && !!this.profileId
      && this.provider.capabilities().available;
  }

  private belongsToBoundProfile(ref: CloudArchiveRef): boolean {
    const extra = this.metadata(ref);
    return !!this.profileId && extra?.appId === this.appId && extra.environment === this.environment
      && extra.profileId === this.profileId;
  }

  private async findCheckpoint(checkpointId: string, operationId: string): Promise<CloudOperationResult<CloudArchiveRef>> {
    const listed = await this.provider.list(operationId);
    if (listed.kind !== 'ok') return listed as CloudOperationResult<CloudArchiveRef>;
    const matches = listed.value.filter((ref) => this.belongsToBoundProfile(ref) && this.metadata(ref)?.checkpointId === checkpointId);
    if (matches.length > 1) return { kind: 'unknown', operationId, reason: 'duplicate-checkpoint-metadata' };
    return matches[0] ? { kind: 'ok', value: matches[0] } : { kind: 'missing' };
  }

  private metadata(ref: CloudArchiveRef): { appId?: unknown; environment?: unknown; profileId?: unknown; checkpointId?: unknown } | null {
    if (typeof ref.extra !== 'string') return null;
    try { return JSON.parse(ref.extra) as { appId?: unknown; environment?: unknown; profileId?: unknown; checkpointId?: unknown }; }
    catch { return null; }
  }
}
