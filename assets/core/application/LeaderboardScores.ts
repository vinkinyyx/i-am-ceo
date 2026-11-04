import type { GameState } from '../domain/types';

export interface CurrentCompanyLeaderboardScores {
  assets: number;
  completedYears: number;
}

/** Scores use only the current committed company, never bot rows or pruned report counts. */
export function currentCompanyLeaderboardScores(state: GameState): CurrentCompanyLeaderboardScores {
  const cash = state.company?.cashYuan ?? 0;
  const bookAssets = state.company?.businessAssetBookYuan ?? 0;
  const assets = Math.max(0, cash + bookAssets);
  const completedYears = Math.max(0, state.gameYear - 1);
  if (!Number.isSafeInteger(assets) || !Number.isSafeInteger(completedYears)) throw new Error('leaderboard-score-not-safe-integer');
  return { assets, completedYears };
}

export function hasCurrentCompany(state: GameState): boolean { return state.company !== null; }
