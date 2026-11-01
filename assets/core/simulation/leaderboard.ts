import type { EconomyConfig } from '../config/EconomyConfig';
import { Rng, deriveSeed } from './rng';
import type { BotCompany, GameState } from '../domain/types';

/**
 * 本地模拟排行榜（设计文档 09.7 / A14）。
 * - 12 个模拟企业，全部由 sharedSeed 确定性派生：同版本新建 run 的 12 bot 完全一致，
 *   不依赖玩家操作、不写盘继承（重开即按同种子重新生成，天然「不继承玩家资产」）。
 * - bot 按年结推进「已完成年限」并按其增长率增加资产（只在玩家年结时同步推进 1 年）。
 * - 两个榜：按总资产、按经营年限；玩家用「现金 + 业务资产账面」作为资产。
 */

export interface LeaderboardRow {
  id: string;
  name: string;
  isPlayer: boolean;
  assetsYuan: number;
  yearsOperated: number;
}

/** 由 sharedSeed 确定性生成 12 个初始 bot（玩家年限 0 起）。 */
export function generateBots(cfg: EconomyConfig): BotCompany[] {
  const rng = new Rng(deriveSeed(cfg.localBots.sharedSeed, 'bots-v1'));
  const count = cfg.localBots.count;
  const bots: BotCompany[] = [];
  for (let i = 0; i < count; i++) {
    const initialAssets = rng.nextInt(
      cfg.localBots.initialAssetYuanMin,
      cfg.localBots.initialAssetYuanMax,
    );
    const initialYears = rng.nextInt(
      cfg.localBots.initialCompletedYearsMin,
      cfg.localBots.initialCompletedYearsMax,
    );
    const baseGrowth = rng.nextInt(
      cfg.localBots.baseAnnualAssetGrowthBpsMin,
      cfg.localBots.baseAnnualAssetGrowthBpsMax,
    );
    bots.push({
      botId: `bot_${i + 1}`,
      name: `模拟企业 ${String(i + 1).padStart(2, '0')}`,
      assetsYuan: initialAssets,
      yearsOperated: initialYears,
      initialAssetsYuan: initialAssets,
      baseGrowthBps: baseGrowth,
    });
  }
  return bots;
}

/** 确保 state 已有 12 bot（新建 run 后惰性初始化一次）。 */
export function ensureBots(state: GameState, cfg: EconomyConfig): BotCompany[] {
  if (state.botCompanies.length !== cfg.localBots.count) {
    state.botCompanies = generateBots(cfg);
  }
  return state.botCompanies;
}

/**
 * 年结时推进所有 bot 一个经营年（稳定发展：资产按 baseGrowth + 小幅确定性抖动）。
 * 只在玩家完成年结时调用，玩家不推进则 bot 也不凭空增加年限（09.7）。
 */
export function advanceBotsOneYear(state: GameState, cfg: EconomyConfig, completedYear: number): void {
  const bots = ensureBots(state, cfg);
  bots.forEach((bot, i) => {
    const rng = new Rng(deriveSeed(cfg.localBots.sharedSeed, bot.botId, completedYear));
    const jitter = rng.nextInt(cfg.localBots.yearJitterBpsMin, cfg.localBots.yearJitterBpsMax);
    const growthBps = bot.baseGrowthBps + jitter;
    const delta = Math.round((bot.assetsYuan * growthBps) / 10_000);
    bot.assetsYuan = Math.max(0, bot.assetsYuan + delta);
    bot.yearsOperated += 1;
    void i;
  });
}

/** 玩家当前总资产（现金 + 业务资产账面）。 */
export function playerAssets(state: GameState): number {
  if (!state.company) return 0;
  return state.company.cashYuan + state.company.businessAssetBookYuan;
}

/** 玩家已完成经营年数（= 已入册年报数）。 */
export function playerYears(state: GameState): number {
  return state.annualReports.filter((r) => r.settled).length;
}

function assemble(state: GameState, cfg: EconomyConfig): LeaderboardRow[] {
  const bots = ensureBots(state, cfg);
  const rows: LeaderboardRow[] = bots.map((b) => ({
    id: b.botId,
    name: b.name,
    isPlayer: false,
    assetsYuan: b.assetsYuan,
    yearsOperated: b.yearsOperated,
  }));
  if (state.company) {
    rows.push({
      id: 'player',
      name: state.company.name,
      isPlayer: true,
      assetsYuan: playerAssets(state),
      yearsOperated: playerYears(state),
    });
  }
  return rows;
}

/** 资产榜（降序）。 */
export function assetsLeaderboard(state: GameState, cfg: EconomyConfig): LeaderboardRow[] {
  return assemble(state, cfg).sort((a, b) => b.assetsYuan - a.assetsYuan);
}

/** 经营年限榜（降序，年限相同按资产）。 */
export function yearsLeaderboard(state: GameState, cfg: EconomyConfig): LeaderboardRow[] {
  return assemble(state, cfg).sort(
    (a, b) => b.yearsOperated - a.yearsOperated || b.assetsYuan - a.assetsYuan,
  );
}
