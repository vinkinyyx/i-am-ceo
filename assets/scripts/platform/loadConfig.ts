import { JsonAsset, resources } from 'cc';
import { registerConfig, validateEconomyConfig } from '../../core/config/configLoader';
import type { EconomyConfig } from '../../core/config/EconomyConfig';

/**
 * 从 resources/config/economy.v1 加载经济配置并校验注册。
 * 纯 TS 测试侧改为直接 import JSON + registerConfig。
 */
export function loadEconomyConfig(): Promise<EconomyConfig> {
  return new Promise((resolve, reject) => {
    resources.load('config/economy.v1', JsonAsset, (err, asset) => {
      if (err) {
        reject(err);
        return;
      }
      try {
        const cfg = validateEconomyConfig(asset.json as unknown);
        resolve(registerConfig(cfg));
      } catch (e) {
        reject(e as Error);
      }
    });
  });
}
