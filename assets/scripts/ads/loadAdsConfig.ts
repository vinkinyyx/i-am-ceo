import { JsonAsset, resources } from 'cc';
import { guardResourceLoad } from '../../core/platform/loadGuard';
import { ADS_DISABLED, parseAdsConfig } from './adConfig';

/** Optional ads resource. Missing/invalid config always disables ads. */
export function loadAdsConfig() {
  const handle = guardResourceLoad<unknown>('config/ads.config', {
    required: false,
    timeoutMs: 3000,
    fallback: () => ADS_DISABLED,
    start: ({ succeed, fail }) => {
      resources.load('config/ads.config', JsonAsset, (err: Error | null, asset: JsonAsset) => {
        if (err) fail(err);
        else succeed(asset.json);
      });
    },
  });
  return handle.promise.then(parseAdsConfig, () => ({ ...ADS_DISABLED }));
}
