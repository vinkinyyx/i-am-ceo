export interface PlayerLeaderboardScore {
  rank: number | null;
  score: number | null;
  name?: string;
}

export interface ILeaderboardProvider {
  isAvailable(): boolean;
  open(leaderboardId: string): Promise<{ kind: 'ok' } | { kind: 'unavailable'; code?: number; reason: string }>;
  submit(leaderboardId: string, score: number): Promise<{ kind: 'ok' } | { kind: 'unavailable'; code?: number; reason: string }>;
  loadCurrent(leaderboardId: string): Promise<{ kind: 'ok'; value: PlayerLeaderboardScore } | { kind: 'unavailable'; code?: number; reason: string }>;
}
