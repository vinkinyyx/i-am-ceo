import { describe, expect, it } from 'vitest';
import { createInitialState } from '@core/domain/gameStateFactory';
import { adQuotaForDay, beginAdSession, canRequestAdCoupon, consumeAdCoupon, grantAdCoupon, markAdPromptShown } from '@core/application/AdRewardService';

describe('ad reward state', () => {
  it('allows one daily prompt and shares one grant quota across both entries', () => {
    const state = createInitialState(Date.parse('2026-11-03T00:00:00Z'), 991);
    state.phase = 'RUNNING'; state.onboarding.initialHiresCompleted = 2;
    const day = Date.parse('2026-11-03T04:00:00Z');
    expect(markAdPromptShown(state, day)).toBe(true);
    expect(markAdPromptShown(state, day)).toBe(false);
    expect(beginAdSession(state, 'session-1', day)).toBe(true);
    expect(grantAdCoupon(state, 'session-1', day)).toBe(true);
    expect(beginAdSession(state, 'session-2', day)).toBe(false);
    expect(grantAdCoupon(state, 'session-2', day)).toBe(false);
    expect(canRequestAdCoupon(state, day)).toBe(false);
    expect(markAdPromptShown(state, day)).toBe(false);
    expect(adQuotaForDay(state, Date.parse('2026-11-03T10:00:00Z')).grantsUsed).toBe(1);
    expect(canRequestAdCoupon(state, Date.parse('2026-11-04T01:00:00Z'))).toBe(false); // unspent coupon survives day rollover
  });

  it('makes completed session idempotent and consumes a coupon once', () => {
    const state = createInitialState(1_700_000_000_000, 992);
    state.phase = 'RUNNING'; state.onboarding.initialHiresCompleted = 2;
    expect(beginAdSession(state, 's1', 1_700_000_000_000)).toBe(true);
    expect(grantAdCoupon(state, 's1', 1_700_000_000_000)).toBe(true);
    expect(grantAdCoupon(state, 's1', 1_700_000_000_000)).toBe(true);
    expect(state.adRewards?.couponIds).toEqual(['s1']);
    expect(consumeAdCoupon(state, 's1', 1_700_000_000_000)).toBe(true);
    expect(() => consumeAdCoupon(state, 's1', 1_700_000_000_000)).toThrow('ALREADY_USED');
  });

  it('keeps quota closed after wall-clock rollback and makes read queries side-effect free', () => {
    const state = createInitialState(1_800_000_000_000, 993);
    state.phase = 'RUNNING'; state.onboarding.initialHiresCompleted = 2;
    const before = JSON.stringify(state.adRewards);
    expect(adQuotaForDay(state, Date.parse('2026-11-04T01:00:00Z')).maxObservedDayIndex).toBeGreaterThan(-1);
    expect(JSON.stringify(state.adRewards)).toBe(before);
    expect(beginAdSession(state, 'run:s1', Date.parse('2026-11-04T01:00:00Z'))).toBe(true);
    expect(grantAdCoupon(state, 'run:s1', Date.parse('2026-11-04T01:01:00Z'))).toBe(true);
    const rolledBack = Date.parse('2026-11-03T12:00:00Z');
    expect(canRequestAdCoupon(state, rolledBack)).toBe(false);
    expect(beginAdSession(state, 'run:s2', rolledBack)).toBe(false);
  });

  it('charges an ad to its reserved UTC+8 day across midnight and expires at the seventh calendar boundary', () => {
    const state = createInitialState(1_800_000_000_000, 994);
    state.phase = 'RUNNING'; state.onboarding.initialHiresCompleted = 2;
    const reserved = Date.parse('2026-11-03T15:59:00Z');
    expect(beginAdSession(state, 'midnight', reserved)).toBe(true);
    expect(grantAdCoupon(state, 'midnight', Date.parse('2026-11-03T16:01:00Z'))).toBe(true);
    expect(adQuotaForDay(state, Date.parse('2026-11-03T16:01:00Z')).grantsUsed).toBe(0);
    expect(adQuotaForDay(state, Date.parse('2026-11-04T00:00:00Z')).grantsUsed).toBe(0);
    expect(state.adRewards?.grantDayIndexes).toContain(Math.floor((reserved + 8 * 60 * 60_000) / 86_400_000));
    expect(state.adRewards?.couponIds).toHaveLength(1);
  });

  it('keeps legacy timestamp-less coupons until a transaction stamps a bounded expiry basis', () => {
    const state = createInitialState(1_800_000_000_000, 995);
    state.phase = 'RUNNING'; state.onboarding.initialHiresCompleted = 2;
    state.adRewards = { localDay: '2026-11-03', promptsShown: 1, grantsUsed: 1, couponIds: ['legacy'], completedSessionIds: [] };
    expect(canRequestAdCoupon(state, Date.parse('2026-11-04T01:00:00Z'))).toBe(false);
    expect(markAdPromptShown(state, Date.parse('2026-11-04T01:00:00Z'))).toBe(false);
  });

  it('bounds coupon metadata while retaining only a bounded consumed-id ledger', () => {
    const state = createInitialState(1_800_000_000_000, 996);
    state.phase = 'RUNNING'; state.onboarding.initialHiresCompleted = 2;
    state.adRewards = { localDay: '', promptsShown: 0, grantsUsed: 0, couponIds: [], completedSessionIds: [],
      couponCreatedAtMsById: Object.fromEntries(Array.from({ length: 80 }, (_, i) => [`old-${i}`, i])),
      couponRunIdById: Object.fromEntries(Array.from({ length: 80 }, (_, i) => [`old-${i}`, 'old-run'])) };
    const now = Date.parse('2026-11-04T04:00:00Z');
    expect(beginAdSession(state, 'bounded', now)).toBe(true);
    expect(grantAdCoupon(state, 'bounded', now)).toBe(true);
    expect(Object.keys(state.adRewards!.couponCreatedAtMsById!).length).toBeLessThanOrEqual(32);
    expect(consumeAdCoupon(state, 'bounded', now)).toBe(true);
    expect(state.adRewards?.couponCreatedAtMsById?.bounded).toBeUndefined();
  });
});
