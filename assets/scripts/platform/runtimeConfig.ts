/**
 * 运行时平台配置（仅本地、不入库）。
 *
 * code2Session 最小服务端地址通过 resources/config/runtime.config.json 注入，
 * 该文件含部署环境信息，按项目纪律不提交 git（见 .gitignore）。
 * 文件缺失时 endpoint 为空：真机登录会明确报“服务端未配置”，不会伪造登录；
 * 编辑器/预览始终走 mock，不受影响。
 */
export interface RuntimeConfig {
  /** code2Session 最小服务端基础地址，例如 https://api.example.com */
  authEndpoint: string;
  /** 隐私政策可访问 URL（商店资料/设置页展示）。 */
  privacyPolicyUrl: string;
}

const FALLBACK: RuntimeConfig = { authEndpoint: '', privacyPolicyUrl: '' };

let cached: RuntimeConfig | null = null;

/** 由 loadConfig 阶段调用注入；未注入时使用空配置。 */
export function setRuntimeConfig(cfg: Partial<RuntimeConfig> | null | undefined): RuntimeConfig {
  cached = {
    authEndpoint: typeof cfg?.authEndpoint === 'string' ? cfg.authEndpoint : '',
    privacyPolicyUrl: typeof cfg?.privacyPolicyUrl === 'string' ? cfg.privacyPolicyUrl : '',
  };
  return cached;
}

export function getRuntimeConfig(): RuntimeConfig {
  return cached ?? FALLBACK;
}
