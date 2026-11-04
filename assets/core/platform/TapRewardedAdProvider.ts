import type { IRewardedAdProvider, RewardedAdResult } from './IRewardedAdProvider';

type Listener<T> = (value: T) => void;
interface RewardedVideoAd {
  show(): Promise<void>;
  load?(): Promise<void>;
  onLoad?(callback: () => void): void;
  offLoad?(callback?: () => void): void;
  onClose(callback: Listener<{ isEnded?: boolean }>): void;
  offClose(callback?: Listener<{ isEnded?: boolean }>): void;
  onError(callback: Listener<unknown>): void;
  offError(callback?: Listener<unknown>): void;
}
interface TapAdsRuntime { createRewardedVideoAd?(params: { adUnitId: string }): RewardedVideoAd; }
interface ActiveAttempt {
  sessionId: string;
  settle(result: RewardedAdResult): void;
  allowReward: boolean;
  onClose: Listener<{ isEnded?: boolean }>;
  onError: Listener<unknown>;
  onLoad: () => void;
  timeout: ReturnType<typeof setTimeout>;
  settled: boolean;
  nativeMayBeShowing: boolean;
}

/** One Tap singleton per provider. A late native close always belongs to the fenced attempt. */
export class TapRewardedAdProvider implements IRewardedAdProvider {
  private ad: RewardedVideoAd | null = null;
  private activeAttempt: ActiveAttempt | null = null;
  private loaded = false;
  private loading: Promise<boolean> | null = null;
  private hasTriedLoad = false;
  private loadGeneration = 0;

  constructor(private readonly enabled: boolean, private readonly adUnitId: string, private readonly host: unknown = globalThis) {}

  isAvailable(): boolean {
    const tap = (this.host as { tap?: TapAdsRuntime } | null)?.tap;
    return !this.activeAttempt && !this.loading && this.enabled && this.adUnitId.trim().length > 0 && typeof tap?.createRewardedVideoAd === 'function';
  }

  async show(sessionId: string): Promise<RewardedAdResult> {
    if (!sessionId || this.activeAttempt || this.loading) return { kind: 'unavailable', reason: 'previous-session-unresolved' };
    if (!this.isAvailable()) return { kind: 'unavailable', reason: 'disabled-or-no-ad-unit' };
    let ad: RewardedVideoAd;
    try {
      const tap = (this.host as { tap: TapAdsRuntime }).tap;
      this.ad ??= tap.createRewardedVideoAd!({ adUnitId: this.adUnitId });
      ad = this.ad;
    } catch { this.ad = null; return { kind: 'failed', reason: 'create-failed' }; }

    // Tap creates and loads automatically. Do not call show until onLoad. A failed
    // pre-show load is retryable; it never leaves the native playback fence held.
    const generation = ++this.loadGeneration;
    if (!this.loaded && !(await this.waitUntilLoaded(ad))) return { kind: 'unavailable', reason: 'load-failed' };
    if (generation !== this.loadGeneration) return { kind: 'skipped', reason: 'request-canceled-before-show' };
    if (this.activeAttempt) return { kind: 'unavailable', reason: 'previous-native-session-unresolved' };

    return new Promise<RewardedAdResult>((resolve) => {
      const attempt: ActiveAttempt = {
        sessionId, allowReward: true, settled: false, nativeMayBeShowing: false,
        settle: (result) => { if (!attempt.settled) { attempt.settled = true; resolve(result); } },
        onClose: () => undefined, onError: () => undefined, onLoad: () => { this.loaded = true; },
        timeout: undefined as unknown as ReturnType<typeof setTimeout>,
      };
      const release = () => {
        clearTimeout(attempt.timeout);
        ad.offClose(attempt.onClose); ad.offError(attempt.onError);
        if (this.activeAttempt === attempt) this.activeAttempt = null;
      };
      attempt.onClose = (result) => {
        if (!attempt.settled) attempt.settle(attempt.allowReward && result?.isEnded === true
          ? { kind: 'completed', sessionId } : { kind: 'skipped', reason: 'not-completed' });
        this.loaded = false; release();
      };
      attempt.onError = (error) => {
        // Errors while native playback could have started are not terminal evidence.
        if (!attempt.nativeMayBeShowing) {
          this.loaded = false;
          attempt.settle({ kind: 'failed', reason: errorCode(error) });
          release();
        }
      };
      attempt.timeout = setTimeout(() => {
        attempt.allowReward = false;
        attempt.settle({ kind: 'failed', reason: 'callback-timeout' });
        // Preserve listener and fence: timeout does not prove native playback ended.
      }, 120_000);
      this.activeAttempt = attempt;
      ad.onClose(attempt.onClose); ad.onError(attempt.onError);
      attempt.nativeMayBeShowing = true;
      void ad.show().catch((error) => {
        // Since onLoad was observed, rejection may race native presentation. Keep
        // the fence until a terminal close; never allow a stale close to reward later.
        attempt.allowReward = false;
        attempt.settle({ kind: 'failed', reason: errorCode(error) });
      });
    });
  }

  cancelActive(): void {
    if (this.loading) { this.loadGeneration++; return; }
    if (!this.activeAttempt) return;
    this.activeAttempt.allowReward = false;
    this.activeAttempt.settle({ kind: 'skipped', reason: 'app-hidden' });
    // Do not call hide/destroy/off-all: the native component owns its playback lifecycle.
  }

  cancelLoading(): void { if (this.loading) this.loadGeneration++; }

  private waitUntilLoaded(ad: RewardedVideoAd): Promise<boolean> {
    if (this.loaded) return Promise.resolve(true);
    if (this.loading) return this.loading;
    if (!ad.onLoad) return Promise.resolve(false);
    let resolveLoad!: (loaded: boolean) => void;
    const task = new Promise<boolean>((resolve) => { resolveLoad = resolve; });
    this.loading = task;
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true; clearTimeout(timer); ad.offLoad?.(onLoad); ad.offError(onError);
      if (this.loading === task) this.loading = null;
      this.loaded = ok; resolveLoad(ok);
    };
    const onLoad = () => finish(true);
    const onError = (error: unknown) => { void error; finish(false); };
    const timer = setTimeout(() => finish(false), 15_000);
    ad.onLoad!(onLoad); ad.onError(onError);
    // Creation auto-loads. Subsequent content auto-loads after close. Call load
    // only on a later explicit user retry after a failed load.
    if (ad.load && this.hasTriedLoad) void ad.load().catch(() => finish(false));
    this.hasTriedLoad = true;
    return task;
  }
}

function errorCode(error: unknown): string {
  const code = (error as { errCode?: unknown } | null)?.errCode;
  return typeof code === 'number' ? `platform-error-${code}` : 'platform-error';
}
