import type { ILeaderboardProvider, PlayerLeaderboardScore } from './ILeaderboardProvider';

interface TapScoreResult { currentUserScore?: { rank?: number; score?: number; user?: { name?: string } }; }
interface TapLeaderboardManager {
  submitScores?(args: { scores: Array<{ leaderboardId: string; score: number }>; callback: { onSuccess: (res: unknown) => void; onFailure: (code: number, message: string) => void } }): void;
  openLeaderboard?(args: { leaderboardId: string; collection: 'public'; callback: { onSuccess: (res: unknown) => void; onFailure: (code: number, message: string) => void } }): void;
  loadCurrentPlayerLeaderboardScore?(args: { leaderboardId: string; collection: 'public'; callback: { onSuccess: (res: TapScoreResult) => void; onFailure: (code: number, message: string) => void } }): void;
}
interface TapLeaderboardRuntime { getLeaderboardManager?(): TapLeaderboardManager; }

/** Standard public leaderboard only; never requests friend scope or profile access. */
export class TapLeaderboardProvider implements ILeaderboardProvider {
  private readonly manager: TapLeaderboardManager | null;
  constructor(host: unknown = globalThis) {
    try { this.manager = (host as { tap?: TapLeaderboardRuntime } | null)?.tap?.getLeaderboardManager?.() ?? null; }
    catch { this.manager = null; }
  }
  isAvailable(): boolean { return !!this.manager?.submitScores && !!this.manager.openLeaderboard && !!this.manager.loadCurrentPlayerLeaderboardScore; }
  open(leaderboardId: string): Promise<{ kind: 'ok' } | { kind: 'unavailable'; code?: number; reason: string }> {
    if (!valid(leaderboardId) || !this.manager?.openLeaderboard) return Promise.resolve({ kind: 'unavailable', reason: 'leaderboard-unavailable' });
    return new Promise((resolve) => {
      let done = false;
      const finish = (result: { kind: 'ok' } | { kind: 'unavailable'; code?: number; reason: string }) => { if (!done) { done = true; clearTimeout(timer); resolve(result); } };
      const timer = setTimeout(() => finish({ kind: 'unavailable', reason: 'callback-timeout' }), 20_000);
      try { this.manager!.openLeaderboard!({ leaderboardId, collection: 'public', callback: { onSuccess: () => finish({ kind: 'ok' }), onFailure: (code, reason) => finish({ kind: 'unavailable', code, reason: reason.slice(0, 160) }) } }); }
      catch { finish({ kind: 'unavailable', reason: 'platform-throw' }); }
    });
  }
  submit(leaderboardId: string, score: number): Promise<{ kind: 'ok' } | { kind: 'unavailable'; code?: number; reason: string }> {
    if (!valid(leaderboardId) || !Number.isSafeInteger(score) || !this.manager?.submitScores) return Promise.resolve({ kind: 'unavailable', reason: 'invalid-leaderboard-score' });
    return new Promise((resolve) => {
      let done = false;
      const finish = (result: { kind: 'ok' } | { kind: 'unavailable'; code?: number; reason: string }) => { if (!done) { done = true; clearTimeout(timer); resolve(result); } };
      const timer = setTimeout(() => finish({ kind: 'unavailable', reason: 'callback-timeout' }), 20_000);
      try { this.manager!.submitScores!({ scores: [{ leaderboardId, score }], callback: { onSuccess: () => finish({ kind: 'ok' }), onFailure: (code, reason) => finish({ kind: 'unavailable', code, reason: reason.slice(0, 160) }) } }); }
      catch { finish({ kind: 'unavailable', reason: 'platform-throw' }); }
    });
  }
  loadCurrent(leaderboardId: string): Promise<{ kind: 'ok'; value: PlayerLeaderboardScore } | { kind: 'unavailable'; code?: number; reason: string }> {
    if (!valid(leaderboardId) || !this.manager?.loadCurrentPlayerLeaderboardScore) return Promise.resolve({ kind: 'unavailable', reason: 'leaderboard-unavailable' });
    return new Promise((resolve) => {
      let done = false;
      const finish = (result: { kind: 'ok'; value: PlayerLeaderboardScore } | { kind: 'unavailable'; code?: number; reason: string }) => { if (!done) { done = true; clearTimeout(timer); resolve(result); } };
      const timer = setTimeout(() => finish({ kind: 'unavailable', reason: 'callback-timeout' }), 20_000);
      try { this.manager!.loadCurrentPlayerLeaderboardScore!({ leaderboardId, collection: 'public', callback: { onSuccess: (res) => {
        const score = res?.currentUserScore;
        finish({ kind: 'ok', value: { rank: Number.isSafeInteger(score?.rank) ? score!.rank! : null, score: Number.isSafeInteger(score?.score) ? score!.score! : null,
          ...(typeof score?.user?.name === 'string' ? { name: score.user.name } : {}) } });
      }, onFailure: (code, reason) => finish({ kind: 'unavailable', code, reason: reason.slice(0, 160) }) } }); }
      catch { finish({ kind: 'unavailable', reason: 'platform-throw' }); }
    });
  }
}

function valid(value: string): boolean { return /^[A-Za-z0-9_-]{1,96}$/.test(value); }
