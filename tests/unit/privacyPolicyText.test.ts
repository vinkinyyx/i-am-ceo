/**
 * R18：隐私政策内容一致性与交互契约（内容层；UI 滚动在 R25 截图复核）。
 */
import { describe, it, expect } from 'vitest';
import {
  PRIVACY_POLICY_TEXT,
  privacyPolicyFullText,
  PRIVACY_POLICY_IN_APP_VERSION,
} from '@core/platform/privacyPolicyText';
import { PRIVACY_POLICY_VERSION } from '@core/platform/privacyConsent';
import policyJson from '../../assets/resources/config/privacy-policy.json';

describe('R18 政策内容完整', () => {
  it('包含关键章节：收集范围/第三方/存储/未成年人/权利/联系方式', () => {
    const text = privacyPolicyFullText();
    expect(text).toContain('本地');
    expect(text).toContain('TapTap');
    expect(text).toContain('vinkinyu@163.com');
    expect(text).toContain('未成年人');
    expect(text).toContain('撤回同意');
    expect(text).toContain('openid');
    expect(PRIVACY_POLICY_TEXT.sections.length).toBeGreaterThanOrEqual(7);
  });

  it('无占位符残留', () => {
    const text = privacyPolicyFullText();
    expect(text).not.toMatch(/【|】|xxx|\[.*\]/);
  });

  it('同意版本号与应用内政策版本一致（旧同意需重新确认）', () => {
    expect(PRIVACY_POLICY_VERSION).toBe(PRIVACY_POLICY_IN_APP_VERSION);
  });

  it('运行时资源与代码单一来源版本一致', () => {
    expect((policyJson as { version: number }).version).toBe(PRIVACY_POLICY_IN_APP_VERSION);
    expect((policyJson as { contact: string }).contact).toBe(PRIVACY_POLICY_TEXT.contact);
    expect((policyJson as { sections: unknown[] }).sections.length).toBe(
      PRIVACY_POLICY_TEXT.sections.length,
    );
  });
});
