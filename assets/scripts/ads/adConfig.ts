import { PRIVACY_POLICY_VERSION } from '../../core/platform/privacyConsent';

export interface AdsConfig {
  schemaVersion: 2;
  enabled: boolean;
  environment: 'disabled' | 'test' | 'production';
  policyVersion: number;
  rewardedAdUnitId: string;
  dailyGrantLimit: number;
  privacyReviewed: boolean;
}

export const ADS_DISABLED: AdsConfig = {
  schemaVersion: 2,
  enabled: false,
  environment: 'disabled',
  policyVersion: PRIVACY_POLICY_VERSION,
  rewardedAdUnitId: '',
  dailyGrantLimit: 1,
  privacyReviewed: false,
};

/** Invalid, absent, or incomplete resources fail closed without affecting play. */
export function parseAdsConfig(input: unknown): AdsConfig {
  if (!input || typeof input !== 'object') return { ...ADS_DISABLED };
  const value = input as Partial<AdsConfig>;
  if (value.schemaVersion !== 2 || typeof value.enabled !== 'boolean'
    || !['disabled', 'test', 'production'].includes(value.environment as string)
    || !Number.isInteger(value.policyVersion) || value.policyVersion !== PRIVACY_POLICY_VERSION
    || typeof value.rewardedAdUnitId !== 'string'
    || !Number.isInteger(value.dailyGrantLimit) || value.dailyGrantLimit !== 1
    || typeof value.privacyReviewed !== 'boolean') return { ...ADS_DISABLED };
  return {
    ...value,
    enabled: value.enabled && value.environment !== 'disabled' && value.rewardedAdUnitId.trim().length > 0 && value.privacyReviewed,
  } as AdsConfig;
}
