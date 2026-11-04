import { JsonAsset, resources } from 'cc';
import { setRuntimeConfig, type RuntimeConfig } from './runtimeConfig';
import { guardResourceLoad } from '../../core/platform/loadGuard';

/** 可选运行时配置加载超时（毫秒）。 */
const OPTIONAL_CONFIG_TIMEOUT_MS = 3000;

/**
 * 加载本地运行时平台配置 resources/config/runtime.config.json（可选）。
 * R07：
 * - 文件缺失属正常（尚未配置服务端/政策 URL）：回落空配置，不阻断启动；
 * - 内容非法要与缺失区分：记录 RESOURCE_INVALID 但仍回落安全空配置，
 *   绝不伪造登录态或隐私同意；
 * - 回调丢失经超时回落，可恢复原因供诊断。
 */
export function loadRuntimeConfig(): Promise<RuntimeConfig> {
  const handle = guardResourceLoad<unknown>('config/runtime.config', {
    required: false,
    timeoutMs: OPTIONAL_CONFIG_TIMEOUT_MS,
    fallback: () => null,
    start: ({ succeed, fail }) => {
      resources.load('config/runtime.config', JsonAsset, (err: Error | null, asset: JsonAsset) => {
        if (err) {
          fail(err);
          return;
        }
        const json = asset.json;
        if (json !== null && typeof json === 'object') {
          succeed(json);
        } else {
          fail(new Error('runtime.config json is not an object'), 'RESOURCE_INVALID');
        }
      });
    },
  });
  return handle.promise.then((json) => setRuntimeConfig((json as Partial<RuntimeConfig>) ?? null));
}
