import { describe, expect, it } from 'vitest';
import { createInitialState } from '@core/domain/gameStateFactory';
import { currentCompanyLeaderboardScores } from '@core/application/LeaderboardScores';

describe('public leaderboard score mapping', () => {
  it('uses current company assets and elapsed company years, excluding simulated rows', () => {
    const state = createInitialState(1_800_000_000_000, 84);
    state.gameYear = 8;
    state.company = { companyId: 'c', name: 'CEO', industry: 'TRADE', foundedYear: 1, cashYuan: 100, initialCapitalYuan: 100, paidInCapitalYuan: 100, businessAssetBookYuan: 50, businessCapacityInvestmentYuan: 0, businessCapacityBonusBps: 0, marketDemandIndexBps: 10_000 };
    state.botCompanies = [{ botId: 'bot', name: 'bot', assetsYuan: 9_999_999, yearsOperated: 20, initialAssetsYuan: 1, baseGrowthBps: 1 }];
    expect(currentCompanyLeaderboardScores(state)).toEqual({ assets: 150, completedYears: 7 });
    state.company = null;
    expect(currentCompanyLeaderboardScores(state)).toEqual({ assets: 0, completedYears: 7 });
  });
});
