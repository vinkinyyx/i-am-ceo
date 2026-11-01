import type { IStorageBackend } from './ITapPlatform';

/**
 * 隐私政策同意记录（A23 / 合规清单 §1）。
 * 仅记录“已展示并同意”这一本地事实与政策版本，不采集任何个人信息。
 */
export const PRIVACY_CONSENT_KEY = 'ceo/privacy/consent';
/** 隐私政策版本：文案变更时递增，已同意旧版本的玩家需重新确认。 */
export const PRIVACY_POLICY_VERSION = 1;

export interface PrivacyConsentRecord {
  accepted: true;
  policyVersion: number;
  acceptedAtMs: number;
}

/** 是否已同意当前版本隐私政策。读盘失败按“未同意”处理（fail-safe）。 */
export async function hasAcceptedPrivacy(
  storage: IStorageBackend,
  now: () => number = Date.now,
): Promise<boolean> {
  void now;
  try {
    const rec = await storage.get<PrivacyConsentRecord>(PRIVACY_CONSENT_KEY);
    return !!rec && rec.accepted === true && rec.policyVersion === PRIVACY_POLICY_VERSION;
  } catch {
    return false;
  }
}

/** 写入同意记录。 */
export async function acceptPrivacy(
  storage: IStorageBackend,
  now: () => number = Date.now,
): Promise<PrivacyConsentRecord> {
  const rec: PrivacyConsentRecord = {
    accepted: true,
    policyVersion: PRIVACY_POLICY_VERSION,
    acceptedAtMs: now(),
  };
  await storage.set(PRIVACY_CONSENT_KEY, rec);
  return rec;
}
