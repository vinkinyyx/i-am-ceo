import { describe, it, expect, beforeEach } from 'vitest';
import { EditorMockPlatform } from '../helpers/EditorMockPlatform';
import {
  acceptPrivacy,
  hasAcceptedPrivacy,
  PRIVACY_CONSENT_KEY,
  PRIVACY_POLICY_VERSION,
  type PrivacyConsentRecord,
} from '@core/platform/privacyConsent';

describe('隐私政策同意（A23）', () => {
  let p: EditorMockPlatform;
  beforeEach(() => {
    p = new EditorMockPlatform();
  });

  it('首次未同意返回 false', async () => {
    expect(await hasAcceptedPrivacy(p)).toBe(false);
  });

  it('同意后写入版本号与时间戳，再次检查为 true', async () => {
    const rec = await acceptPrivacy(p, () => 12345);
    expect(rec.accepted).toBe(true);
    expect(rec.policyVersion).toBe(PRIVACY_POLICY_VERSION);
    expect(rec.acceptedAtMs).toBe(12345);
    expect(await hasAcceptedPrivacy(p)).toBe(true);
  });

  it('同意的是旧版本政策时视为未同意（需重新确认）', async () => {
    const old: PrivacyConsentRecord = {
      accepted: true,
      policyVersion: PRIVACY_POLICY_VERSION - 1,
      acceptedAtMs: 1,
    };
    await p.set(PRIVACY_CONSENT_KEY, old);
    expect(await hasAcceptedPrivacy(p)).toBe(false);
  });

  it('读盘异常时 fail-safe 返回 false（不默认放行）', async () => {
    const broken = new EditorMockPlatform();
    broken.setHttpHandler(null);
    // 制造 get 抛错
    (broken as unknown as { get: () => Promise<never> }).get = () =>
      Promise.reject(new Error('io'));
    expect(await hasAcceptedPrivacy(broken)).toBe(false);
  });
});
