import { JsonAsset, resources } from 'cc';
import { registerConfig, validateEconomyConfig } from '../../core/config/configLoader';
import type { EconomyConfig } from '../../core/config/EconomyConfig';
import { guardResourceLoad } from '../../core/platform/loadGuard';

/** 必需经济配置加载超时（毫秒）：超时是可恢复错误，由启动失败页提供重试。 */
const REQUIRED_CONFIG_TIMEOUT_MS = 8000;

/**
 * 从 resources/config/economy.v1 加载经济配置并校验注册（必需资源）。
 * R07：回调丢失/404/非法 JSON 一律经 loadGuard 产生可诊断错误码，不留下黑屏。
 * 纯 TS 测试侧改为直接 import JSON + registerConfig。
 */
export function loadEconomyConfig(): Promise<EconomyConfig> {
  const handle = guardResourceLoad<unknown>('config/economy.v1', {
    required: true,
    timeoutMs: REQUIRED_CONFIG_TIMEOUT_MS,
    start: ({ succeed, fail }) => {
      resources.load('config/economy.v1', JsonAsset, (err: Error | null, asset: JsonAsset) => {
        if (err) {
          fail(err);
          return;
        }
        try {
          const cfg = validateEconomyConfig(asset.json as unknown);
          succeed(registerConfig(cfg));
        } catch (e) {
          fail(e instanceof Error ? e : new Error(String(e)), 'RESOURCE_INVALID');
        }
      });
    },
  });
  return handle.promise as Promise<EconomyConfig>;
}
