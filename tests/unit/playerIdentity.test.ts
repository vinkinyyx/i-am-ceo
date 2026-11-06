import { describe, expect, it } from 'vitest';
import { PlayerIdentityState } from '@core/platform/PlayerIdentity';

const verified = (profileId: string, epoch = 0) => ({
  kind: 'verified' as const,
  profileId,
  scope: 'tap-minigame-account' as const,
  appId: 'app-test',
  environment: 'test' as const,
  epoch,
});

describe('player identity epoch (A24-05)', () => {
  it('keeps the same epoch for the same stable profile and bumps it when the account changes', () => {
    const state = new PlayerIdentityState('app-test', 'test');
    const first = state.apply(verified('profile-a'));
    expect(first.kind).toBe('verified');
    expect(state.currentEpoch).toBe(1);

    const same = state.apply(verified('profile-a'));
    expect(same.kind).toBe('verified');
    expect(state.currentEpoch).toBe(1);

    const changed = state.apply(verified('profile-b'));
    expect(changed).toEqual({ kind: 'changed', fromProfileId: 'profile-a', toProfileId: 'profile-b' });
    expect(state.currentEpoch).toBe(2);
    expect(state.profileId).toBe('profile-b');
  });

  it('rejects identity from another app/environment scope and never binds it', () => {
    const state = new PlayerIdentityState('app-test', 'production');
    const result = state.apply(verified('profile-a'));
    expect(result).toEqual({ kind: 'unavailable', reason: 'identity-scope-mismatch' });
    expect(state.profileId).toBeNull();
  });

  it('clears the binding and advances the epoch when the platform stops providing identity', () => {
    const state = new PlayerIdentityState('app-test', 'test');
    state.apply(verified('profile-a'));
    const epoch = state.currentEpoch;
    const result = state.apply({ kind: 'unavailable', reason: 'official-stable-account-id-unconfirmed' });
    expect(result.kind).toBe('unavailable');
    expect(state.profileId).toBeNull();
    expect(state.currentEpoch).toBe(epoch + 1);
  });
});
