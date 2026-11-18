import type { MiniGameTarget } from './buildProfile';
import type { IGamePlatform } from './IGamePlatform';
import type { IPlatformAuth } from './IPlatformAuth';
import type { ICloudSaveProvider } from './ICloudSaveProvider';
import type { ILeaderboardProvider } from './ILeaderboardProvider';
import type { IRewardedAdProvider } from './IRewardedAdProvider';

export interface PlatformServices {
  readonly configRoot: string;
  createAuth(platform: IGamePlatform, endpoint?: string): IPlatformAuth;
  createRewardedAds(enabled: boolean, adUnitId: string): IRewardedAdProvider;
  createCloudSave(): ICloudSaveProvider;
  createLeaderboard(): ILeaderboardProvider;
}

export interface PlatformBinding {
  platform: IGamePlatform;
  services: PlatformServices;
}

/** An unfinished target has no factory until its required platform APIs are implemented. */
export interface MiniGameAdapter {
  readonly target: MiniGameTarget;
  readonly create: (() => PlatformBinding | null) | null;
}
