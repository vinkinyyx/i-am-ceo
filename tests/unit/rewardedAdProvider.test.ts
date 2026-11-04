import { describe, expect, it } from 'vitest';
import { parseAdsConfig } from '../../assets/scripts/ads/adConfig';
import { TapRewardedAdProvider } from '@core/platform/TapRewardedAdProvider';

describe('optional rewarded ad provider', () => {
  it('defaults missing, malformed, and no-unit configuration to disabled', () => {
    expect(parseAdsConfig(null).enabled).toBe(false);
    expect(parseAdsConfig({ schemaVersion: 2, enabled: true }).enabled).toBe(false);
    expect(parseAdsConfig({ schemaVersion: 2, enabled: true, environment: 'test', policyVersion: 1, rewardedAdUnitId: '', dailyGrantLimit: 1, privacyReviewed: true }).enabled).toBe(false);
    expect(parseAdsConfig({ schemaVersion: 2, enabled: true, environment: 'test', policyVersion: 1, rewardedAdUnitId: 'real-redacted-unit', dailyGrantLimit: 1, privacyReviewed: false }).enabled).toBe(false);
    expect(parseAdsConfig({ schemaVersion: 2, enabled: true, environment: 'test', policyVersion: 3, rewardedAdUnitId: 'provider-test-fixture', dailyGrantLimit: 1, privacyReviewed: true }).enabled).toBe(true);
  });

  it('waits for onLoad, only marks explicit isEnded true as completed, and removes only own callbacks', async () => {
    let close: ((result: { isEnded: boolean }) => void) | undefined;
    let load: (() => void) | undefined;
    let removedForPlayback = 0;
    const ad = {
      show: async () => { close?.({ isEnded: true }); },
      onLoad: (fn: () => void) => { load = fn; },
      offLoad: () => undefined,
      onClose: (fn: (result: { isEnded: boolean }) => void) => { close = fn; },
      offClose: (fn?: (result: { isEnded: boolean }) => void) => { if (fn === close) removedForPlayback++; },
      onError: () => undefined,
      offError: (fn?: (error: unknown) => void) => { if (fn && close) removedForPlayback++; },
    };
    const host = { tap: { createRewardedVideoAd: () => ad } };
    const provider = new TapRewardedAdProvider(true, 'test-unit', host);
    const pending = provider.show('s1');
    await Promise.resolve();
    expect(close).toBeUndefined(); // show callback is not installed before material load
    load?.();
    await expect(pending).resolves.toEqual({ kind: 'completed', sessionId: 's1' });
    expect(removedForPlayback).toBe(2);
  });

  it('releases a failed pre-show load so a later explicit retry can load and show', async () => {
    let load: (() => void) | undefined;
    let error: ((value: unknown) => void) | undefined;
    let close: ((result: { isEnded?: boolean }) => void) | undefined;
    let showCalls = 0;
    let loadCalls = 0;
    const ad = {
      load: async () => { loadCalls++; },
      onLoad: (fn: () => void) => { load = fn; }, offLoad: () => undefined,
      onClose: (fn: typeof close) => { close = fn; }, offClose: () => undefined,
      onError: (fn: typeof error) => { error = fn; }, offError: () => undefined,
      show: async () => { showCalls++; },
    };
    const provider = new TapRewardedAdProvider(true, 'unit', { tap: { createRewardedVideoAd: () => ad } });
    const first = provider.show('s1');
    await Promise.resolve();
    error?.({ errCode: 1004 });
    await expect(first).resolves.toMatchObject({ kind: 'unavailable', reason: 'load-failed' });
    expect(showCalls).toBe(0);
    const second = provider.show('s2');
    await Promise.resolve();
    load?.();
    await Promise.resolve();
    close?.({ isEnded: false });
    await expect(second).resolves.toMatchObject({ kind: 'skipped' });
    expect(loadCalls).toBe(1);
  });

  it('does not auto-show if the user leaves while material is loading', async () => {
    let load: (() => void) | undefined;
    let showCalls = 0;
    const ad = {
      onLoad: (fn: () => void) => { load = fn; }, offLoad: () => undefined,
      onClose: () => undefined, offClose: () => undefined,
      onError: () => undefined, offError: () => undefined,
      show: async () => { showCalls++; },
    };
    const provider = new TapRewardedAdProvider(true, 'unit', { tap: { createRewardedVideoAd: () => ad } });
    const pending = provider.show('cancel-before-load');
    await Promise.resolve();
    provider.cancelActive();
    load?.();
    await expect(pending).resolves.toEqual({ kind: 'skipped', reason: 'request-canceled-before-show' });
    expect(showCalls).toBe(0);
  });

  it('returns unavailable when disabled and never constructs a platform ad', async () => {
    const host = { tap: { createRewardedVideoAd: () => { throw new Error('must not construct'); } } };
    const provider = new TapRewardedAdProvider(false, 'test-unit', host);
    await expect(provider.show('s1')).resolves.toMatchObject({ kind: 'unavailable' });
  });

  it('cancels a pending session when app hides without treating it as a reward', async () => {
    let close: ((result: { isEnded: boolean }) => void) | undefined;
    const ad = {
      show: async () => undefined,
      onLoad: (fn: () => void) => { fn(); },
      offLoad: () => undefined,
      onClose: (fn: (result: { isEnded: boolean }) => void) => { close = fn; },
      offClose: () => undefined,
      onError: () => undefined,
      offError: () => undefined,
      destroy: () => undefined,
    };
    const provider = new TapRewardedAdProvider(true, 'unit', { tap: { createRewardedVideoAd: () => ad } });
    const pending = provider.show('s-hide');
    await Promise.resolve();
    provider.cancelActive();
    await expect(pending).resolves.toEqual({ kind: 'skipped', reason: 'app-hidden' });
    close?.({ isEnded: true });
  });

  it('fences a canceled native session until its late close and never rewards a later attempt', async () => {
    const closes: Array<(result: { isEnded?: boolean }) => void> = [];
    let showCalls = 0;
    const ad = {
      show: async () => { showCalls++; },
      onLoad: (fn: () => void) => { fn(); },
      offLoad: () => undefined,
      onClose: (fn: (result: { isEnded?: boolean }) => void) => { closes.push(fn); },
      offClose: (fn?: (result: { isEnded?: boolean }) => void) => { if (fn) { const i = closes.indexOf(fn); if (i >= 0) closes.splice(i, 1); } else closes.length = 0; },
      onError: () => undefined,
      offError: () => undefined,
    };
    const provider = new TapRewardedAdProvider(true, 'unit', { tap: { createRewardedVideoAd: () => ad } });
    const first = provider.show('old-session');
    await Promise.resolve();
    provider.cancelActive();
    await expect(first).resolves.toMatchObject({ kind: 'skipped' });
    await expect(provider.show('new-session')).resolves.toMatchObject({ kind: 'unavailable' });
    expect(showCalls).toBe(1);
    closes[0]?.({ isEnded: true });
    const next = provider.show('new-session');
    await Promise.resolve();
    expect(showCalls).toBe(2);
    closes[closes.length - 1]?.({ isEnded: true });
    await expect(next).resolves.toEqual({ kind: 'completed', sessionId: 'new-session' });
  });
});
