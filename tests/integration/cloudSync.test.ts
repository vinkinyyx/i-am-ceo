import { describe, expect, it } from 'vitest';
import { createInitialState } from '@core/domain/gameStateFactory';
import { encodeEnvelope } from '@core/persistence/SaveCodec';
import { createCloudCheckpoint, encodeCloudCheckpoint } from '@core/persistence/CloudSaveCodec';
import type { CloudArchiveRef, CloudCheckpointV1, CloudOperationResult, CloudRuntimeConfig } from '@core/persistence/CloudSaveTypes';
import type { ICloudSaveProvider } from '@core/platform/ICloudSaveProvider';
import { CloudSyncService } from '@core/application/CloudSyncService';
import { MemoryStorage } from '../helpers/MemoryStorage';

class FakeCloud implements ICloudSaveProvider {
  archives: CloudArchiveRef[] = [];
  files = new Map<string, string>();
  creates = 0;
  nextCreate: CloudOperationResult<CloudArchiveRef> = { kind: 'ok', value: { uuid: 'u1', fileId: 'f1', name: 'n', extra: '' } };
  capabilities() { return { available: true, deleteAvailable: true }; }
  async list() { return { kind: 'ok' as const, value: this.archives }; }
  async download(_op: string, _archive: CloudArchiveRef, target: string) { this.files.set(target, this.files.get('cloud')!); return { kind: 'ok' as const, value: target }; }
  async readLocal(_op: string, path: string) { const value = this.files.get(path); return value ? { kind: 'ok' as const, value } : { kind: 'missing' as const }; }
  async writeLocal(_op: string, path: string, data: string) { this.files.set(path, data); return { kind: 'ok' as const, value: true as const }; }
  async create(_op: string, cp: CloudCheckpointV1) {
    this.creates += 1;
    const result = this.nextCreate;
    if (result.kind === 'ok') {
      const ref = { ...result.value, extra: JSON.stringify({ appId: cp.appId, environment: cp.environment, profileId: cp.cloudProfileId, checkpointId: cp.checkpointId }) };
      this.archives.push(ref); this.files.set('cloud', encodeCloudCheckpoint(cp));
      return { kind: 'ok' as const, value: ref };
    }
    return result;
  }
  async delete() { return { kind: 'unsupported' as const }; }
}

const config: CloudRuntimeConfig = { schemaVersion: 1, enabled: true, environment: 'test', appId: 'app-test', policyVersion: 3, minUploadIntervalMs: 65_000, autoBackupIntervalMs: 120_000, retainedCheckpoints: 3 };
function checkpoint() {
  const state = createInitialState(1_800_000_000_000, 772);
  return createCloudCheckpoint({ appId: 'app-test', environment: 'test', cloudProfileId: 'profile-a', checkpointId: 'cp-a',
    parentCheckpointIds: [], resetEpoch: { id: 'epoch-a', parentId: null, closedRunId: null }, deviceInstanceId: 'dev-a',
    localRevision: 0, capturedAtMs: 1_800_000_000_000,
    snapshot: encodeEnvelope(state, { revision: 0, runId: state.runId, resetGeneration: 0 }) });
}

describe('cloud sync account isolation and ambiguous create handling', () => {
  it('scopes listing by explicit local profile binding', async () => {
    const fake = new FakeCloud();
    fake.archives = [
      { uuid: 'a', fileId: 'a', name: 'a', extra: '{"appId":"app-test","environment":"test","profileId":"profile-a"}' },
      { uuid: 'b', fileId: 'b', name: 'b', extra: '{"appId":"app-test","environment":"test","profileId":"profile-b"}' },
      { uuid: 'c', fileId: 'c', name: 'c', extra: 'malformed' },
    ];
    const service = new CloudSyncService(fake, new MemoryStorage(), config, 'app-test', 'test', 'profile-a');
    const result = await service.list('list2');
    expect(result.kind === 'ok' ? result.value.map((x) => x.uuid) : []).toEqual(['a']);
  });

  it('persists a timed-out create intent and will not issue another create until found', async () => {
    const fake = new FakeCloud(); fake.nextCreate = { kind: 'unknown', operationId: 'op', reason: 'timeout' };
    const storage = new MemoryStorage();
    const service = new CloudSyncService(fake, storage, config, 'app-test', 'test', 'profile-a');
    expect((await service.backup(checkpoint(), '/user/checkpoint', 'op', 1_800_000_000_000)).kind).toBe('unknown');
    const retry = await service.backup(checkpoint(), '/user/checkpoint', 'op2', 1_800_000_100_000);
    expect(retry.kind).toBe('unknown');
    expect(fake.creates).toBe(1);
  });
});
