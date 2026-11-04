import { describe, expect, it } from 'vitest';
import { createInitialState } from '@core/domain/gameStateFactory';
import { encodeEnvelope } from '@core/persistence/SaveCodec';
import { createCloudCheckpoint, decodeCloudCheckpoint } from '@core/persistence/CloudSaveCodec';

const input = () => {
  const state = createInitialState(1_800_000_000_000, 991);
  return {
    appId: 'app-test', environment: 'test' as const, cloudProfileId: 'profile-a', checkpointId: 'cp-1',
    parentCheckpointIds: [], resetEpoch: { id: 'epoch-1', parentId: null, closedRunId: null },
    deviceInstanceId: 'device-1', localRevision: 0, capturedAtMs: 1_800_000_000_000,
    snapshot: encodeEnvelope(state, { revision: 0, runId: state.runId, resetGeneration: 0 }),
  };
};

describe('cloud checkpoint codec', () => {
  it('round trips a bounded, checksummed snapshot scoped to app and environment', () => {
    const checkpoint = createCloudCheckpoint(input());
    expect(decodeCloudCheckpoint(JSON.stringify(checkpoint), 'app-test', 'test').ok).toBe(true);
    expect(decodeCloudCheckpoint(JSON.stringify(checkpoint), 'other-app', 'test')).toMatchObject({ ok: false, reason: 'app-or-environment-mismatch' });
  });

  it('rejects tampering and a checkpoint naming its run as closed', () => {
    const cp = createCloudCheckpoint(input());
    expect(decodeCloudCheckpoint(JSON.stringify({ ...cp, summary: { ...cp.summary, cashYuan: 9 } }), 'app-test', 'test')).toMatchObject({ ok: false, reason: 'summary-mismatch' });
    const source = input();
    const bad = createCloudCheckpoint({ ...source, resetEpoch: { id: 'e2', parentId: 'epoch-1', closedRunId: source.snapshot.runId } });
    expect(bad.resetEpoch.closedRunId).toBe(bad.snapshot.runId);
    expect(decodeCloudCheckpoint(JSON.stringify(bad), 'app-test', 'test')).toMatchObject({ ok: false, reason: 'checkpoint-resurrects-closed-run' });
  });
});
