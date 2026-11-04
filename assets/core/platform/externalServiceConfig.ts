import type { CloudRuntimeConfig } from '../persistence/CloudSaveTypes';
import { PRIVACY_POLICY_VERSION } from './privacyConsent';

export interface LeaderboardRuntimeConfig {
  schemaVersion: 1;
  enabled: boolean;
  environment: 'disabled' | 'test' | 'production';
  appId: string;
  policyVersion: number;
  assetsBoardId: string;
  yearsBoardId: string;
  calculation: 'latest';
}

export const CLOUD_DISABLED: CloudRuntimeConfig = {
  schemaVersion: 1, enabled: false, environment: 'disabled', appId: '', policyVersion: PRIVACY_POLICY_VERSION,
  minUploadIntervalMs: 65_000, autoBackupIntervalMs: 120_000, retainedCheckpoints: 3,
};

export const LEADERBOARDS_DISABLED: LeaderboardRuntimeConfig = {
  schemaVersion: 1, enabled: false, environment: 'disabled', appId: '', policyVersion: PRIVACY_POLICY_VERSION,
  assetsBoardId: '', yearsBoardId: '', calculation: 'latest',
};

export function parseCloudConfig(input: unknown): CloudRuntimeConfig {
  if (!input || typeof input !== 'object') return { ...CLOUD_DISABLED };
  const v = input as Partial<CloudRuntimeConfig>;
  if (v.schemaVersion !== 1 || typeof v.enabled !== 'boolean'
    || !['disabled', 'test', 'production'].includes(v.environment as string)
    || typeof v.appId !== 'string' || !Number.isInteger(v.policyVersion) || v.policyVersion !== PRIVACY_POLICY_VERSION
    || v.minUploadIntervalMs !== 65_000 || v.autoBackupIntervalMs !== 120_000
    || v.retainedCheckpoints !== 3) return { ...CLOUD_DISABLED };
  const enabled = v.enabled && v.environment !== 'disabled' && v.appId.trim().length > 0;
  return { ...CLOUD_DISABLED, ...v, enabled } as CloudRuntimeConfig;
}

export function parseLeaderboardConfig(input: unknown): LeaderboardRuntimeConfig {
  if (!input || typeof input !== 'object') return { ...LEADERBOARDS_DISABLED };
  const v = input as Partial<LeaderboardRuntimeConfig>;
  if (v.schemaVersion !== 1 || typeof v.enabled !== 'boolean'
    || !['disabled', 'test', 'production'].includes(v.environment as string)
    || typeof v.appId !== 'string' || !Number.isInteger(v.policyVersion) || v.policyVersion !== PRIVACY_POLICY_VERSION
    || typeof v.assetsBoardId !== 'string' || typeof v.yearsBoardId !== 'string'
    || v.calculation !== 'latest') return { ...LEADERBOARDS_DISABLED };
  const validIds = v.assetsBoardId.trim().length > 0 && v.yearsBoardId.trim().length > 0
    && v.assetsBoardId !== v.yearsBoardId;
  const enabled = v.enabled && v.environment !== 'disabled' && v.appId.trim().length > 0 && validIds;
  return { ...LEADERBOARDS_DISABLED, ...v, enabled } as LeaderboardRuntimeConfig;
}
