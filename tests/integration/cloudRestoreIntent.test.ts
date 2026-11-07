import { describe, expect, it } from 'vitest';
import { GameFacade } from '@core/application/GameFacade';
import { CloudSyncService } from '@core/application/CloudSyncService';
import { registerConfig } from '@core/config/configLoader';
import { encodeCloudCheckpoint } from '@core/persistence/CloudSaveCodec';
import type { CloudArchiveRef, CloudCheckpointV1, CloudOperationResult, CloudRuntimeConfig } from '@core/persistence/CloudSaveTypes';
import type { ICloudSaveProvider } from '@core/platform/ICloudSaveProvider';
import economyJson from '../../assets/resources/config/economy.v1.json';
import type { EconomyConfig } from '@core/config/EconomyConfig';
import { EditorMockPlatform } from '../helpers/EditorMockPlatform';
import { GameStore } from '@core/application/GameStore';

const economy = registerConfig(economyJson as unknown as EconomyConfig);
const cloudConfig: CloudRuntimeConfig = {
  schemaVersion: 1, enabled: true, environment: 'test', appId: 'app-test', policyVersion: 3,
  minUploadIntervalMs: 65_000, autoBackupIntervalMs: 120_000, retainedCheckpoints: 3,
};

class FakeCloud implements ICloudSaveProvider {
  files = new Map<string, string>();
  archives: CloudArchiveRef[] = [];
  onDownload: (() => void) | null = null;
  createCalls = 0;
  capabilities() { return { available: true, deleteAvailable: true }; }
  async list(): Promise<CloudOperationResult<CloudArchiveRef[]>> { return { kind: 'ok', value: this.archives }; }
  async download(_op: string, _archive: CloudArchiveRef, target: string): Promise<CloudOperationResult<string>> {
    this.onDownload?.();
    const value = this.files.get('cloud');
    if (!value) return { kind: 'missing' };
    this.files.set(target, value);
    return { kind: 'ok', value: target };
  }
  async readLocal(_op: string, path: string): Promise<CloudOperationResult<string>> {
    const value = this.files.get(path);
    return value ? { kind: 'ok', value } : { kind: 'missing' };
  }
  async writeLocal(_op: string, path: string, data: string) { this.files.set(path, data); return { kind: 'ok' as const, value: true as const }; }
  async create(): Promise<CloudOperationResult<CloudArchiveRef>> { this.createCalls += 1; return { kind: 'unsupported' }; }
  async delete(): Promise<CloudOperationResult<true>> { return { kind: 'unsupported' }; }
}

function connect(fake: FakeCloud, checkpoint: CloudCheckpointV1): CloudArchiveRef {
  const ref: CloudArchiveRef = {
    uuid: 'u1', fileId: 'f1', name: 'n',
    extra: JSON.stringify({ appId: 'app-test', environment: 'test', profileId: checkpoint.cloudProfileId, checkpointId: checkpoint.checkpointId }),
  };
  fake.archives = [ref];
  fake.files.set('cloud', encodeCloudCheckpoint(checkpoint));
  return ref;
}

async function setup(seed: number) {
  const platform = new EditorMockPlatform();
  const facade = await GameFacade.fromStorage(platform, economy);
  const checkpoint = facade.captureCloudCheckpoint({
    appId: 'app-test', environment: 'test', cloudProfileId: 'profile-a',
    checkpointId: `cp-${seed}`, parentCheckpointIds: [],
    resetEpoch: { id: 'epoch-a', parentId: null, closedRunId: null },
    deviceInstanceId: 'dev-a', capturedAtMs: 1_800_000_000_000,
  });
  const fake = new FakeCloud();
  const ref = connect(fake, checkpoint);
  const service = new CloudSyncService(fake, platform, cloudConfig, 'app-test', 'test', 'profile-a');
  return { platform, facade, checkpoint, fake, ref, service };
}

describe('cloud restore intent capture (A24-08)', () => {
  it('surfaces legacy pending identity and never replays or clears an unscoped create', async () => {
    const { platform, facade, checkpoint, fake, service } = await setup(900);
    const pending = { operationId: 'legacy-op-900', checkpointId: checkpoint.checkpointId, profileId: 'profile-a', createdAtMs: 1_800_000_000_000 };
    await platform.set('ceo/cloud/pending-create/v1', pending);
    const status = await service.status();
    expect(status.pendingCheckpointId).toBe(checkpoint.checkpointId);
    expect(status.legacyPending).toEqual(pending);

    const result = await service.backup(checkpoint, '/tmp/unused-cloud-900.json', 'new-create-900', 1_800_000_100_000);
    expect(result).toMatchObject({ kind: 'unknown', operationId: 'legacy-op-900', reason: 'legacy-create-needs-manual-reconciliation' });
    expect(fake.createCalls).toBe(0);
    expect(await platform.get('ceo/cloud/pending-create/v1')).toEqual(pending);
    expect(facade.getRevision()).toBe(0);
  });

  it('restores when the caller base is still current', async () => {
    const { facade, platform, ref, service } = await setup(901);
    const startingRunId = facade.getState().runId;
    const created = await facade.createCompany({ companyName: '恢复前本机公司', industry: 'TRADE', ceoName: '恢复测试CEO', ceoTrait: 'BOLD' },
      { commandId: 'pre-restore-company', expectedRunId: startingRunId });
    expect(created.ok).toBe(true);
    expect(facade.getState().company?.name).toBe('恢复前本机公司');
    const base = { runId: facade.getState().runId, revision: facade.getRevision() };
    const result = await service.restore(ref, '/tmp/restore-a.json', 'op-a', facade, 1_800_000_000_100, base);
    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    expect(result.value).toMatchObject({
      operationId: 'op-a', checkpointId: 'cp-901',
      beforeRunId: base.runId, beforeRevision: base.revision,
      appliedRunId: base.runId, appliedRevision: base.revision + 1,
      sourceOwner: { appId: 'app-test', environment: 'test', profileId: 'profile-a' },
    });
    expect(facade.getRevision()).toBe(base.revision + 1);
    expect(facade.getState().runId).toBe(base.runId);
    expect(facade.getState().company).toBeNull();
    expect(facade.getState().phase).toBe('CREATING');
    const restarted = await GameStore.load(platform);
    expect(restarted?.current.runId).toBe(result.value.appliedRunId);
    expect(restarted?.currentRevision).toBe(result.value.appliedRevision);
    expect(restarted?.current).toEqual(facade.getState());
  });

  it('rejects with base-changed-after-download when the caller base no longer matches', async () => {
    const { facade, ref, service } = await setup(902);
    const before = JSON.stringify(facade.getState());
    const result = await service.restore(ref, '/tmp/restore-b.json', 'op-b', facade, 1_800_000_000_100,
      { runId: facade.getState().runId, revision: 999 });
    expect(result).toMatchObject({ kind: 'unavailable', reason: 'base-changed-after-download' });
    expect(JSON.stringify(facade.getState())).toBe(before);
  });

  it('rejects an archive bound to another account profile', async () => {
    const { facade, fake, ref, service } = await setup(903);
    const checkpoint = JSON.parse(fake.files.get('cloud')!) as CloudCheckpointV1;
    const foreign = { ...checkpoint, cloudProfileId: 'profile-b' };
    fake.files.set('cloud', JSON.stringify(foreign));
    const result = await service.restore(ref, '/tmp/restore-c.json', 'op-c', facade, 1_800_000_000_100);
    expect(result).toMatchObject({ kind: 'unavailable' });
  });

  it('checks the captured owner after download and before any local import', async () => {
    const { facade, fake, ref, service } = await setup(904);
    const before = JSON.stringify(facade.getState());
    let ownerCurrent = true;
    fake.onDownload = () => { ownerCurrent = false; };
    const result = await service.restore(ref, '/tmp/restore-owner.json', 'op-owner', facade, 1_800_000_000_100,
      { runId: facade.getState().runId, revision: facade.getRevision() }, () => ownerCurrent);
    expect(result).toMatchObject({ kind: 'unavailable', reason: 'operation-owner-changed' });
    expect(JSON.stringify(facade.getState())).toBe(before);
  });
});
