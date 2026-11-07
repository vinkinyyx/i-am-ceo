import type { GameFacade } from './GameFacade';
import type { CloudArchiveRef, CloudCheckpointV1, CloudOperationResult, CloudRuntimeConfig } from '../persistence/CloudSaveTypes';
import { decodeCloudCheckpoint } from '../persistence/CloudSaveCodec';
import type { ICloudSaveProvider } from '../platform/ICloudSaveProvider';
import type { IStorageBackend } from '../platform/ITapPlatform';

const LEGACY_INTENT_KEY = 'ceo/cloud/pending-create/v1';

export interface PendingCreate { operationId: string; checkpointId: string; profileId: string; createdAtMs: number; }
export interface CloudSyncStatus {
  enabled: boolean;
  available: boolean;
  profileId: string | null;
  lastConfirmedAtMs: number | null;
  pendingCheckpointId: string | null;
  legacyPending: PendingCreate | null;
}
export interface CloudRestorePreview {
  checkpoint: CloudCheckpointV1;
  base: { runId: string; revision: number };
  operationId: string;
  sourceOwner: { appId: string; environment: 'test' | 'production'; profileId: string; authEpoch?: number; contextEpoch?: number };
}
export interface LegacyReconcileResult {
  operationId: string;
  checkpointId: string;
  /** 仅在核对成功且唯一命中时返回；不包含任何账号凭据。 */
  archiveCheckpointId?: string;
  confirmedAtMs?: number;
}
export interface CloudRestoreReceipt {
  operationId: string;
  checkpointId: string;
  sourceOwner: CloudRestorePreview['sourceOwner'];
  beforeRunId: string;
  beforeRevision: number;
  appliedRunId: string;
  appliedRevision: number;
}

/** Player initiated cloud checkpoint orchestration. It never resolves a timeout by replaying create. */
export class CloudSyncService {
  private readonly intentKey: string;
  private readonly lastUploadKey: string;
  constructor(
    private readonly provider: ICloudSaveProvider,
    private readonly storage: IStorageBackend,
    private readonly config: CloudRuntimeConfig,
    private readonly appId: string,
    private readonly environment: 'test' | 'production',
    private readonly profileId: string | null,
  ) {
    const scope = `${encodeURIComponent(appId)}/${environment}/${encodeURIComponent(profileId ?? 'unbound')}`;
    this.intentKey = `ceo/cloud/v2/${scope}/pending-create`;
    this.lastUploadKey = `ceo/cloud/v2/${scope}/last-upload`;
  }

  async status(): Promise<CloudSyncStatus> {
    const pending = await this.storage.get<PendingCreate>(this.intentKey).catch(() => null);
    const legacyPending = await this.storage.get<PendingCreate>(LEGACY_INTENT_KEY).catch(() => null);
    const last = await this.storage.get<number>(this.lastUploadKey).catch(() => null);
    return { enabled: this.config.enabled, available: this.config.enabled && this.provider.capabilities().available,
      profileId: this.profileId, lastConfirmedAtMs: Number.isSafeInteger(last) ? last : null,
      pendingCheckpointId: pending?.checkpointId ?? legacyPending?.checkpointId ?? null, legacyPending };
  }

  async list(operationId: string, ownerCurrent: () => boolean = () => true): Promise<CloudOperationResult<CloudArchiveRef[]>> {
    if (!this.ready() || !ownerCurrent()) return { kind: 'unsupported' };
    const result = await this.provider.list(operationId);
    if (!ownerCurrent()) return { kind: 'unavailable', reason: 'operation-owner-changed' };
    if (result.kind !== 'ok') return result;
    return { kind: 'ok', value: result.value.filter((ref) => this.belongsToBoundProfile(ref)) };
  }

  async backup(
    checkpoint: CloudCheckpointV1,
    filePath: string,
    operationId: string,
    nowMs: number,
    ownerCurrent: () => boolean = () => true,
    options: { allowNewCheckpointWithLegacy?: boolean } = {},
  ): Promise<CloudOperationResult<CloudArchiveRef>> {
    if (!this.ready() || checkpoint.appId !== this.appId || checkpoint.environment !== this.environment
      || checkpoint.cloudProfileId !== this.profileId || !ownerCurrent()) return { kind: 'unsupported' };
    const legacyPending = await this.storage.get<PendingCreate>(LEGACY_INTENT_KEY).catch(() => null);
    // A2：旧未决默认阻止上传；只有用户明确选择“保留旧未决，另建新备份”才允许创建
    // 一个全新 checkpoint/operation，旧记录与旧云档都保持原样，且绝不重放旧 create。
    if (legacyPending && !options.allowNewCheckpointWithLegacy) {
      return { kind: 'unknown', operationId: legacyPending.operationId, reason: 'legacy-create-needs-manual-reconciliation' };
    }
    const pending = await this.storage.get<PendingCreate>(this.intentKey).catch(() => null);
    if (pending) {
      if (pending.profileId !== this.profileId) return { kind: 'unavailable', reason: 'account-switch-pending-create' };
      const resolved = await this.findCheckpoint(pending.checkpointId, `${operationId}:recover`);
      if (!ownerCurrent()) return { kind: 'unavailable', reason: 'operation-owner-changed' };
      if (resolved.kind === 'ok') {
        await this.storage.set(this.lastUploadKey, pending.createdAtMs);
        await this.storage.remove(this.intentKey);
        return { kind: 'ok', value: resolved.value };
      }
      // A list failure or absent record cannot prove the create failed. Never replay it.
      return { kind: 'unknown', operationId: pending.operationId, reason: 'prior-create-needs-platform-reconciliation' };
    }
    if (!Number.isSafeInteger(nowMs) || nowMs < 0) return { kind: 'unavailable', reason: 'invalid-time' };
    const last = await this.storage.get<number>(this.lastUploadKey).catch(() => null);
    if (Number.isSafeInteger(last) && nowMs - (last as number) < this.config.minUploadIntervalMs) {
      return { kind: 'unavailable', reason: 'upload-rate-limited' };
    }
    const intent: PendingCreate = { operationId, checkpointId: checkpoint.checkpointId, profileId: this.profileId!, createdAtMs: nowMs };
    try { await this.storage.set(this.intentKey, intent); }
    catch { return { kind: 'unavailable', reason: 'intent-not-durable' }; }
    if (!ownerCurrent()) return { kind: 'unknown', operationId, reason: 'operation-owner-changed-after-intent' };
    const created = await this.provider.create(operationId, checkpoint, filePath);
    if (created.kind === 'ok') {
      await this.storage.set(this.lastUploadKey, nowMs);
      await this.storage.remove(this.intentKey);
    } else if (created.kind !== 'unknown') {
      await this.storage.remove(this.intentKey).catch(() => undefined);
    }
    return created;
  }

  /**
   * A2：旧全局 pending 的只读核对。
   * - 只调用 list / download / 本地读取，绝不 create，绝不删除旧云档；
   * - 只有唯一命中且 app/env/profile/checkpoint 全部一致时，才把该记录迁移为“已确认”
   *   （写入 last-upload 水位并清理原始 legacy 键）。
   * - 未命中、列表失败、重复命中、外账号、校验失败都保留隔离与说明。
   */
  async reconcileLegacyPending(
    legacy: PendingCreate,
    targetFilePath: string,
    nowMs: number,
    ownerCurrent: () => boolean = () => true,
  ): Promise<CloudOperationResult<LegacyReconcileResult>> {
    if (!this.ready() || !ownerCurrent()) return { kind: 'unsupported' };
    const stored = await this.storage.get<PendingCreate>(LEGACY_INTENT_KEY).catch(() => null);
    if (!stored || stored.operationId !== legacy.operationId || stored.checkpointId !== legacy.checkpointId) {
      return { kind: 'missing', reason: 'legacy-intent-no-longer-present' };
    }
    // 核对只读：list 不创建记录。
    const listed = await this.provider.list(`legacy-reconcile:${legacy.operationId}`);
    if (!ownerCurrent()) return { kind: 'unavailable', reason: 'operation-owner-changed' };
    if (listed.kind !== 'ok') return { kind: 'unavailable', reason: `legacy-list-${listed.kind}` };
    const matches = listed.value.filter((ref) => this.metadata(ref)?.checkpointId === legacy.checkpointId);
    if (matches.length === 0) return { kind: 'missing', reason: 'legacy-create-not-found' };
    if (matches.length > 1) return { kind: 'unknown', operationId: legacy.operationId, reason: 'duplicate-checkpoint-metadata' };
    const archive = matches[0]!;
    const meta = this.metadata(archive)!;
    if (meta.appId !== this.appId || meta.environment !== this.environment) {
      return { kind: 'unavailable', reason: 'legacy-scope-mismatch' };
    }
    if (meta.profileId !== this.profileId) return { kind: 'unavailable', reason: 'legacy-account-mismatch' };
    const downloaded = await this.provider.download(`legacy-reconcile:${legacy.operationId}:download`, archive, targetFilePath);
    if (!ownerCurrent()) return { kind: 'unavailable', reason: 'operation-owner-changed' };
    if (downloaded.kind !== 'ok') return { kind: 'unavailable', reason: 'legacy-download-failed' };
    const raw = await this.provider.readLocal(`legacy-reconcile:${legacy.operationId}:read`, downloaded.value);
    if (!ownerCurrent()) return { kind: 'unavailable', reason: 'operation-owner-changed' };
    if (raw.kind !== 'ok') return { kind: 'unavailable', reason: 'legacy-read-failed' };
    const decoded = decodeCloudCheckpoint(raw.value, this.appId, this.environment);
    if (!decoded.ok) return { kind: 'unavailable', reason: `legacy-checkpoint-${decoded.reason}` };
    if (decoded.checkpoint.cloudProfileId !== this.profileId) return { kind: 'unavailable', reason: 'legacy-account-mismatch' };
    if (decoded.checkpoint.checkpointId !== legacy.checkpointId) return { kind: 'unavailable', reason: 'legacy-checkpoint-mismatch' };
    const confirmedAtMs = Number.isSafeInteger(nowMs) && nowMs >= 0 ? nowMs : legacy.createdAtMs;
    // 迁移：只记录已确认水位并清理旧键；旧云档不删除。
    await this.storage.set(this.lastUploadKey, Math.max(confirmedAtMs, legacy.createdAtMs));
    await this.storage.remove(LEGACY_INTENT_KEY);
    return { kind: 'ok', value: { operationId: legacy.operationId, checkpointId: legacy.checkpointId,
      archiveCheckpointId: decoded.checkpoint.checkpointId, confirmedAtMs } };
  }

  async restore(
    archive: CloudArchiveRef,
    targetFilePath: string,
    operationId: string,
    facade: GameFacade,
    nowMs: number,
    expected?: { runId: string; revision: number },
    ownerCurrent: () => boolean = () => true,
  ): Promise<CloudOperationResult<CloudRestoreReceipt>> {
    const prepared = await this.prepareRestore(archive, targetFilePath, operationId, facade, expected, ownerCurrent);
    if (prepared.kind !== 'ok') return prepared as CloudOperationResult<CloudRestoreReceipt>;
    return this.confirmRestore(prepared.value, facade, nowMs, ownerCurrent);
  }

  async prepareRestore(
    archive: CloudArchiveRef,
    targetFilePath: string,
    operationId: string,
    facade: GameFacade,
    expected?: { runId: string; revision: number },
    ownerCurrent: () => boolean = () => true,
    ownerStamp?: { authEpoch: number; contextEpoch: number },
  ): Promise<CloudOperationResult<CloudRestorePreview>> {
    if (!this.ready() || !this.belongsToBoundProfile(archive) || !ownerCurrent()) return { kind: 'unsupported' };
    // A24-08：下载前捕获原意图；下载/解码后仍须命中同一 run/revision，
    // 不能用下载后的新状态“宽免”用户确认时的基线。
    const expectedBase = expected ?? null;
    const downloaded = await this.provider.download(operationId, archive, targetFilePath);
    if (!ownerCurrent()) return { kind: 'unavailable', reason: 'operation-owner-changed' };
    if (downloaded.kind !== 'ok') return downloaded as CloudOperationResult<CloudRestorePreview>;
    const raw = await this.provider.readLocal(`${operationId}:read`, downloaded.value);
    if (!ownerCurrent()) return { kind: 'unavailable', reason: 'operation-owner-changed' };
    if (raw.kind !== 'ok') return raw as CloudOperationResult<CloudRestorePreview>;
    // 调用方未指定基线（保持经营时预览）时，以“下载完成这一刻”为本机基线；
    // 之后任何经营推进都会让确认被安全拒绝，而不是让预览本身永远无法生成。
    const base = expectedBase ?? { runId: facade.getState().runId, revision: facade.getRevision() };
    if (expectedBase
      && (facade.getState().runId !== expectedBase.runId || facade.getRevision() !== expectedBase.revision)) {
      return { kind: 'unavailable', reason: 'base-changed-after-download' };
    }
    const decoded = decodeCloudCheckpoint(raw.value, this.appId, this.environment);
    if (!decoded.ok || decoded.checkpoint.cloudProfileId !== this.profileId) {
      return { kind: 'unavailable', reason: decoded.ok ? 'account-profile-mismatch' : decoded.reason };
    }
    const archiveCheckpointId = this.metadata(archive)?.checkpointId;
    if (archiveCheckpointId !== decoded.checkpoint.checkpointId) return { kind: 'unavailable', reason: 'archive-checkpoint-mismatch' };
    if (!ownerCurrent()) return { kind: 'unavailable', reason: 'operation-owner-changed' };
    return { kind: 'ok', value: { checkpoint: decoded.checkpoint, base, operationId,
      sourceOwner: { appId: this.appId, environment: this.environment, profileId: this.profileId!, ...ownerStamp } } };
  }

  async confirmRestore(
    preview: CloudRestorePreview,
    facade: GameFacade,
    nowMs: number,
    ownerCurrent: () => boolean = () => true,
  ): Promise<CloudOperationResult<CloudRestoreReceipt>> {
    if (!this.ready() || !ownerCurrent()) return { kind: 'unsupported' };
    if (facade.getState().runId !== preview.base.runId || facade.getRevision() !== preview.base.revision) {
      return { kind: 'unavailable', reason: 'base-changed-after-download' };
    }
    const imported = await facade.importCloudCheckpointState(preview.checkpoint.snapshot.payload,
      preview.base.runId, preview.base.revision, nowMs, ownerCurrent, {
        operationId: preview.operationId, ownerScope: `${preview.sourceOwner.appId}/${preview.sourceOwner.environment}/${preview.sourceOwner.profileId}`,
      });
    if (imported.ok) {
      return { kind: 'ok', value: { operationId: preview.operationId, checkpointId: preview.checkpoint.checkpointId,
        sourceOwner: preview.sourceOwner, beforeRunId: preview.base.runId, beforeRevision: preview.base.revision,
        appliedRunId: facade.getState().runId, appliedRevision: facade.getRevision() } };
    }
    const reason = imported.details && typeof imported.details.reason === 'string' ? imported.details.reason : imported.code;
    if (facade.getPersistenceStatus() !== 'ready') {
      return { kind: 'unknown', operationId: preview.operationId, reason: 'restore-commit-reconciliation-required' };
    }
    return { kind: 'unavailable', reason };
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
