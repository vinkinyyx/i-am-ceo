import type { PlatformServices } from '../../core/platform/PlatformServices';
import { AuthService } from './AuthService';
import { TapCloudSaveProvider } from './TapCloudSaveProvider';
import { TapLeaderboardProvider } from './TapLeaderboardProvider';
import { TapRewardedAdProvider } from './TapRewardedAdProvider';

export function createTapServices(host: unknown): PlatformServices {
  return {
    configRoot: 'platforms/taptap',
    createAuth: (platform, endpoint) => new AuthService(platform, { endpoint }),
    createRewardedAds: (enabled, adUnitId) => new TapRewardedAdProvider(enabled, adUnitId, host),
    createCloudSave: () => new TapCloudSaveProvider(host),
    createLeaderboard: () => new TapLeaderboardProvider(host),
  };
}
