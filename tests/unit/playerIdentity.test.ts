import { describe, expect, it } from 'vitest';
import { PlayerIdentityState, SessionPlayerIdentityProvider } from '@core/platform/PlayerIdentity';

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
    const unavailableEpoch = state.currentEpoch;
    state.apply({ kind: 'unavailable', reason: 'still-unavailable' });
    expect(state.currentEpoch).toBe(unavailableEpoch);
  });
});

describe('B2 session-backed identity provider', () => {
  const session = (overrides: Record<string, unknown> = {}) => ({
    kind: 'taptap' as const,
    expiresAtMs: 20_000,
    profile: { profileId: 'tap_AbCdEfGhIjKlMnOp', appId: 'app-test', environment: 'test' as const, scope: 'tap-minigame-account' },
    ...overrides,
  });
  const provider = (load: () => Promise<ReturnType<typeof session> | null>) =>
    new SessionPlayerIdentityProvider(load, 'app-test', 'test', () => 10_000);

  it('verified only when the server-issued profile matches scope and session is fresh', async () => {
    const result = await provider(async () => session()).resolve();
    expect(result).toMatchObject({ kind: 'verified', profileId: 'tap_AbCdEfGhIjKlMnOp', appId: 'app-test', environment: 'test' });
  });

  it('rejects sessions without a stable profile, expired sessions and other scopes', async () => {
    await expect(provider(async () => session({ profile: undefined })).resolve())
      .resolves.toMatchObject({ kind: 'unavailable', reason: 'session-without-stable-profile' });
    await expect(provider(async () => session({ expiresAtMs: 9_999 })).resolve())
      .resolves.toMatchObject({ kind: 'unavailable', reason: 'session-expired' });
    await expect(provider(async () => session({ profile: { ...session().profile!, appId: 'other-app' } })).resolve())
      .resolves.toMatchObject({ kind: 'unavailable', reason: 'identity-scope-mismatch' });
    await expect(provider(async () => session({ profile: { ...session().profile!, scope: 'legacy-openid' } })).resolve())
      .resolves.toMatchObject({ kind: 'unavailable', reason: 'identity-scope-unsupported' });
    await expect(provider(async () => null).resolve())
      .resolves.toMatchObject({ kind: 'unavailable', reason: 'no-platform-session' });
  });

  it('mock sessions never become cloud identities', async () => {
    await expect(provider(async () => session({ kind: 'mock' })).resolve())
      .resolves.toMatchObject({ kind: 'unavailable', reason: 'not-tap-runtime' });
  });
});
