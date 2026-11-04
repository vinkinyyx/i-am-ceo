import { JsonAsset, resources } from 'cc';
import { guardResourceLoad } from '../../core/platform/loadGuard';
import { CLOUD_DISABLED, LEADERBOARDS_DISABLED, parseCloudConfig, parseLeaderboardConfig } from '../../core/platform/externalServiceConfig';

function loadOptional(path: string): Promise<unknown> {
  return guardResourceLoad<unknown>(path, {
    required: false, timeoutMs: 3000, fallback: () => null,
    start: ({ succeed, fail }) => resources.load(path, JsonAsset, (error: Error | null, asset: JsonAsset) => {
      if (error) fail(error); else succeed(asset.json);
    }),
  }).promise;
}

export async function loadCloudConfig() {
  try { return parseCloudConfig(await loadOptional('config/cloud.config')); } catch { return { ...CLOUD_DISABLED }; }
}

export async function loadLeaderboardConfig() {
  try { return parseLeaderboardConfig(await loadOptional('config/leaderboards.config')); } catch { return { ...LEADERBOARDS_DISABLED }; }
}
