import { JsonAsset, resources } from 'cc';
import { setRuntimeConfig, type RuntimeConfig } from './runtimeConfig';

/**
 * 加载本地运行时平台配置 resources/config/runtime.config.json（不入库）。
 * 文件缺失属正常情况（如尚未部署服务端）：回落空配置，不阻断游戏启动。
 */
export function loadRuntimeConfig(): Promise<RuntimeConfig> {
  return new Promise((resolve) => {
    resources.load('config/runtime.config', JsonAsset, (err, asset) => {
      if (err) {
        resolve(setRuntimeConfig(null));
        return;
      }
      resolve(setRuntimeConfig((asset.json as Partial<RuntimeConfig>) ?? null));
    });
  });
}
