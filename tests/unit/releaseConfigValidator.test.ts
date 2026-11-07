import { describe, it, expect } from 'vitest';
import { parseCloudConfig, parseLeaderboardConfig } from '../../assets/core/platform/externalServiceConfig';
import { parseAdsConfig } from '../../assets/scripts/ads/adConfig';

/**
 * DEV-04：发行配置组合校验器正反例。
 * 锚定三模式：diagnostic-disabled / L2 test candidate / production candidate。
 * 关键：任何会被运行时 parse*Config 静默降级为 disabled 的配置，校验器必须显式失败并定位字段。
 * 与 packageHygiene 相同方式取 node require/fs（避免 @types/node 依赖）。
 */
declare const require: ((id: string) => unknown) | undefined;
declare const __dirname: string;
type NodeFs = { readFileSync(path: string, enc: string): string };
type NodePath = { resolve(...parts: string[]): string };
const fallbackRequire = (globalThis as unknown as { require?: (id: string) => unknown }).require;
const nodeRequire = (typeof require === 'function' ? require : fallbackRequire) as
  | ((id: string) => unknown)
  | undefined;
if (!nodeRequire) throw new Error('node require unavailable in test runtime');
const fs = nodeRequire('fs') as NodeFs;
const path = nodeRequire('path') as NodePath;
const ROOT = path.resolve(__dirname, '../../');

type ConfigError = { field: string; message: string };
type ValidateResult = { ok: boolean; mode: string | null; errors: ConfigError[] };
type ValidateInput = {
  purpose: string;
  runtime: Record<string, unknown>;
  cloud: Record<string, unknown>;
  ads: Record<string, unknown>;
  leaderboards: Record<string, unknown>;
};
const { validateReleaseConfig } = nodeRequire(path.resolve(ROOT, 'tools/validate-release-config.cjs')) as {
  validateReleaseConfig(input: ValidateInput): ValidateResult;
};

const disabledCloud = {
  schemaVersion: 1, enabled: false, environment: 'disabled', appId: '', policyVersion: 3,
  minUploadIntervalMs: 65000, autoBackupIntervalMs: 120000, retainedCheckpoints: 3,
};
const disabledBoards = {
  schemaVersion: 1, enabled: false, environment: 'disabled', appId: '', policyVersion: 3,
  assetsBoardId: '', yearsBoardId: '', calculation: 'latest',
};
const disabledAds = {
  schemaVersion: 2, enabled: false, environment: 'disabled', policyVersion: 3,
  rewardedAdUnitId: '', dailyGrantLimit: 1, privacyReviewed: false,
};
const emptyRuntime = { authEndpoint: '', privacyPolicyUrl: '' };

const realRuntime = {
  authEndpoint: 'https://service-abc123.cd.apigw.tencentcs.com/release',
  privacyPolicyUrl: 'https://privacy.ceogame.cn/policy',
};
const testCloud = { ...disabledCloud, enabled: true, environment: 'test', appId: '1016161' };
const testBoards = {
  ...disabledBoards, enabled: true, environment: 'test', appId: '1016161',
  assetsBoardId: 'board_assets_001', yearsBoardId: 'board_years_002',
};
const testAds = {
  ...disabledAds, enabled: true, environment: 'test',
  rewardedAdUnitId: 'adunit-9f8e7d6c5b', privacyReviewed: true,
};
const prodCloud = { ...testCloud, environment: 'production' };
const prodBoards = { ...testBoards, environment: 'production', assetsBoardId: 'board_assets_p01', yearsBoardId: 'board_years_p02' };
const prodAds = { ...testAds, environment: 'production', rewardedAdUnitId: 'adunit-prod-001' };

function input(overrides: Partial<ValidateInput>): ValidateInput {
  return {
    purpose: 'diagnostic',
    runtime: { ...emptyRuntime },
    cloud: { ...disabledCloud },
    ads: { ...disabledAds },
    leaderboards: { ...disabledBoards },
    ...overrides,
  };
}
function fields(result: ValidateResult): string[] {
  return result.errors.map((e) => e.field);
}

describe('DEV-04 发行配置组合校验器：正例', () => {
  it('diagnostic：仓库当前提交态（三能力关闭、endpoint/隐私URL空）通过', () => {
    const read = (name: string) => JSON.parse(fs.readFileSync(path.resolve(ROOT, `assets/resources/config/${name}`), 'utf8')) as Record<string, unknown>;
    const result = validateReleaseConfig({
      purpose: 'diagnostic',
      runtime: read('runtime.config.json'),
      cloud: read('cloud.config.json'),
      ads: read('ads.config.json'),
      leaderboards: read('leaderboards.config.json'),
    });
    expect(result.ok).toBe(true);
    expect(result.mode).toBe('diagnostic-disabled');
  });

  it('L2：云+榜 test 启用、广告明确关闭，逐项启用合法', () => {
    const result = validateReleaseConfig(input({
      purpose: 'product-test-candidate',
      runtime: { ...realRuntime },
      cloud: { ...testCloud },
      leaderboards: { ...testBoards },
    }));
    expect(result.ok).toBe(true);
    expect(result.mode).toBe('L2-test-candidate');
  });

  it('L2：三能力全部 test 启用（真实ID/HTTPS/隐私资料齐）通过', () => {
    const result = validateReleaseConfig(input({
      purpose: 'product-test-candidate',
      runtime: { ...realRuntime },
      cloud: { ...testCloud },
      ads: { ...testAds },
      leaderboards: { ...testBoards },
    }));
    expect(result.ok).toBe(true);
  });

  it('production：三能力 production 启用（真实生产ID）通过', () => {
    const result = validateReleaseConfig(input({
      purpose: 'product-production-candidate',
      runtime: { ...realRuntime },
      cloud: { ...prodCloud },
      ads: { ...prodAds },
      leaderboards: { ...prodBoards },
    }));
    expect(result.ok).toBe(true);
    expect(result.mode).toBe('production-candidate');
  });

  it('endpoint 路径含本游戏 appId=1016161 不误报', () => {
    const result = validateReleaseConfig(input({
      purpose: 'product-test-candidate',
      runtime: { ...realRuntime, authEndpoint: 'https://service-abc.cd.apigw.tencentcs.com/release/1016161' },
      cloud: { ...testCloud },
    }));
    expect(result.ok).toBe(true);
  });
});

describe('DEV-04 发行配置组合校验器：反例必须失败并定位字段', () => {
  it('diagnostic 下任一能力启用 → 失败', () => {
    const result = validateReleaseConfig(input({ ads: { ...testAds } }));
    expect(result.ok).toBe(false);
    expect(fields(result)).toContain('ads.enabled');
  });

  it('L2 下 cloud env=production → cloud.environment', () => {
    const result = validateReleaseConfig(input({
      purpose: 'product-test-candidate',
      runtime: { ...realRuntime },
      cloud: { ...prodCloud },
    }));
    expect(result.ok).toBe(false);
    expect(fields(result)).toContain('cloud.environment');
  });

  it('enabled=true 但 environment=disabled（运行时静默降级）→ cloud.environment', () => {
    const result = validateReleaseConfig(input({
      purpose: 'product-test-candidate',
      runtime: { ...realRuntime },
      cloud: { ...testCloud, environment: 'disabled' },
    }));
    expect(result.ok).toBe(false);
    expect(fields(result)).toContain('cloud.environment');
  });

  it('enabled=false 但 environment=test（关闭不诚实）→ cloud.environment', () => {
    const result = validateReleaseConfig(input({
      purpose: 'product-test-candidate',
      runtime: { ...realRuntime },
      cloud: { ...disabledCloud, environment: 'test' },
      leaderboards: { ...testBoards },
    }));
    expect(result.ok).toBe(false);
    expect(fields(result)).toContain('cloud.environment');
  });

  it('云/榜启用但 endpoint 为空 → runtime.authEndpoint required', () => {
    const result = validateReleaseConfig(input({
      purpose: 'product-test-candidate',
      cloud: { ...testCloud },
      runtime: { ...emptyRuntime, privacyPolicyUrl: realRuntime.privacyPolicyUrl },
    }));
    expect(result.ok).toBe(false);
    expect(fields(result)).toContain('runtime.authEndpoint');
  });

  it('endpoint 非 https → 失败', () => {
    const result = validateReleaseConfig(input({
      purpose: 'product-test-candidate',
      runtime: { ...realRuntime, authEndpoint: 'http://service-abc.cd.apigw.tencentcs.com/release' },
      cloud: { ...testCloud },
    }));
    expect(result.ok).toBe(false);
    expect(fields(result)).toContain('runtime.authEndpoint');
  });

  it('endpoint 带用户凭据 → 失败', () => {
    const result = validateReleaseConfig(input({
      purpose: 'product-test-candidate',
      runtime: { ...realRuntime, authEndpoint: 'https://user:pass@service-abc.cd.apigw.tencentcs.com/release' },
      cloud: { ...testCloud },
    }));
    expect(result.ok).toBe(false);
    expect(fields(result)).toContain('runtime.authEndpoint');
  });

  it('endpoint 带 fragment → 失败', () => {
    const result = validateReleaseConfig(input({
      purpose: 'product-test-candidate',
      runtime: { ...realRuntime, authEndpoint: 'https://service-abc.cd.apigw.tencentcs.com/release#frag' },
      cloud: { ...testCloud },
    }));
    expect(result.ok).toBe(false);
    expect(fields(result)).toContain('runtime.authEndpoint');
  });

  it('endpoint 占位域名 example.com → 失败', () => {
    const result = validateReleaseConfig(input({
      purpose: 'product-test-candidate',
      runtime: { ...realRuntime, authEndpoint: 'https://your-api-domain.example.com' },
      cloud: { ...testCloud },
    }));
    expect(result.ok).toBe(false);
    expect(fields(result)).toContain('runtime.authEndpoint');
  });

  it('endpoint 路径指向别的游戏 appId → 失败', () => {
    const result = validateReleaseConfig(input({
      purpose: 'product-test-candidate',
      runtime: { ...realRuntime, authEndpoint: 'https://service-abc.cd.apigw.tencentcs.com/release/9999999' },
      cloud: { ...testCloud },
    }));
    expect(result.ok).toBe(false);
    expect(fields(result)).toContain('runtime.authEndpoint');
  });

  it('cloud appId 非 1016161 → cloud.appId', () => {
    const result = validateReleaseConfig(input({
      purpose: 'product-test-candidate',
      runtime: { ...realRuntime },
      cloud: { ...testCloud, appId: '414107' },
    }));
    expect(result.ok).toBe(false);
    expect(fields(result)).toContain('cloud.appId');
  });

  it('leaderboards appId 非 1016161 → leaderboards.appId', () => {
    const result = validateReleaseConfig(input({
      purpose: 'product-test-candidate',
      runtime: { ...realRuntime },
      leaderboards: { ...testBoards, appId: '414107' },
    }));
    expect(result.ok).toBe(false);
    expect(fields(result)).toContain('leaderboards.appId');
  });

  it('榜启用但 assetsBoardId 空 → leaderboards.assetsBoardId', () => {
    const result = validateReleaseConfig(input({
      purpose: 'product-test-candidate',
      runtime: { ...realRuntime },
      leaderboards: { ...testBoards, assetsBoardId: '' },
    }));
    expect(result.ok).toBe(false);
    expect(fields(result)).toContain('leaderboards.assetsBoardId');
  });

  it('两榜 ID 相同 → leaderboards', () => {
    const result = validateReleaseConfig(input({
      purpose: 'product-test-candidate',
      runtime: { ...realRuntime },
      leaderboards: { ...testBoards, yearsBoardId: testBoards.assetsBoardId },
    }));
    expect(result.ok).toBe(false);
    expect(fields(result)).toContain('leaderboards');
  });

  it('榜 ID 为占位值 → 失败', () => {
    const result = validateReleaseConfig(input({
      purpose: 'product-test-candidate',
      runtime: { ...realRuntime },
      leaderboards: { ...testBoards, assetsBoardId: 'fake-board-id' },
    }));
    expect(result.ok).toBe(false);
    expect(fields(result)).toContain('leaderboards.assetsBoardId');
  });

  it('广告启用但位ID空 → ads.rewardedAdUnitId', () => {
    const result = validateReleaseConfig(input({
      purpose: 'product-test-candidate',
      runtime: { ...realRuntime },
      cloud: { ...testCloud },
      ads: { ...testAds, rewardedAdUnitId: ' ' },
    }));
    expect(result.ok).toBe(false);
    expect(fields(result)).toContain('ads.rewardedAdUnitId');
  });

  it('广告位ID为占位值 → ads.rewardedAdUnitId', () => {
    const result = validateReleaseConfig(input({
      purpose: 'product-test-candidate',
      runtime: { ...realRuntime },
      cloud: { ...testCloud },
      ads: { ...testAds, rewardedAdUnitId: 'your-ad-unit-id' },
    }));
    expect(result.ok).toBe(false);
    expect(fields(result)).toContain('ads.rewardedAdUnitId');
  });

  it('广告启用但 privacyReviewed=false → ads.privacyReviewed', () => {
    const result = validateReleaseConfig(input({
      purpose: 'product-test-candidate',
      runtime: { ...realRuntime },
      cloud: { ...testCloud },
      ads: { ...testAds, privacyReviewed: false },
    }));
    expect(result.ok).toBe(false);
    expect(fields(result)).toContain('ads.privacyReviewed');
  });

  it('生产模式广告位含 test 字样 → ads.rewardedAdUnitId', () => {
    const result = validateReleaseConfig(input({
      purpose: 'product-production-candidate',
      runtime: { ...realRuntime },
      cloud: { ...prodCloud },
      ads: { ...prodAds, rewardedAdUnitId: 'test-unit-001' },
    }));
    expect(result.ok).toBe(false);
    expect(fields(result)).toContain('ads.rewardedAdUnitId');
  });

  it('ads policyVersion≠3 → ads.policyVersion', () => {
    const result = validateReleaseConfig(input({
      purpose: 'product-test-candidate',
      runtime: { ...realRuntime },
      cloud: { ...testCloud },
      ads: { ...testAds, policyVersion: 2 },
    }));
    expect(result.ok).toBe(false);
    expect(fields(result)).toContain('ads.policyVersion');
  });

  it('L2 三能力全关 → 冒充诊断包，mode 失败', () => {
    const result = validateReleaseConfig(input({ purpose: 'product-test-candidate' }));
    expect(result.ok).toBe(false);
    expect(fields(result)).toContain('mode');
  });

  it('L2/生产 privacyPolicyUrl 空 → runtime.privacyPolicyUrl required', () => {
    const result = validateReleaseConfig(input({
      purpose: 'product-test-candidate',
      runtime: { ...emptyRuntime, authEndpoint: realRuntime.authEndpoint },
      cloud: { ...testCloud },
    }));
    expect(result.ok).toBe(false);
    expect(fields(result)).toContain('runtime.privacyPolicyUrl');
  });

  it('生产 privacyPolicyUrl 占位域名 → 失败', () => {
    const result = validateReleaseConfig(input({
      purpose: 'product-production-candidate',
      runtime: { ...realRuntime, privacyPolicyUrl: 'https://your-site.example.com/privacy' },
      cloud: { ...prodCloud },
    }));
    expect(result.ok).toBe(false);
    expect(fields(result)).toContain('runtime.privacyPolicyUrl');
  });

  it('云 test / 榜 production 混 env → leaderboards.environment', () => {
    const result = validateReleaseConfig(input({
      purpose: 'product-test-candidate',
      runtime: { ...realRuntime },
      cloud: { ...testCloud },
      leaderboards: { ...prodBoards },
    }));
    expect(result.ok).toBe(false);
    expect(fields(result)).toContain('leaderboards.environment');
  });

  it('diagnostic 下 endpoint 非空（stray 配置）→ runtime.authEndpoint', () => {
    const result = validateReleaseConfig(input({
      runtime: { ...emptyRuntime, authEndpoint: realRuntime.authEndpoint },
    }));
    expect(result.ok).toBe(false);
    expect(fields(result)).toContain('runtime.authEndpoint');
  });

  it('未知 purpose → 失败', () => {
    const result = validateReleaseConfig(input({ purpose: 'release' }));
    expect(result.ok).toBe(false);
  });
});

describe('DEV-04 与运行时 parse*Config 静默降级行为一致', () => {
  it('cloud 间隔被改：parse 静默 disabled，校验器显式失败', () => {
    const bad = { ...testCloud, minUploadIntervalMs: 60000 };
    expect(parseCloudConfig(bad).enabled).toBe(false);
    const result = validateReleaseConfig(input({
      purpose: 'product-test-candidate',
      runtime: { ...realRuntime },
      cloud: bad,
    }));
    expect(result.ok).toBe(false);
    expect(fields(result)).toContain('cloud.minUploadIntervalMs');
  });

  it('ads policyVersion 被改：parse 静默 disabled，校验器显式失败', () => {
    const bad = { ...testAds, policyVersion: 2 };
    expect(parseAdsConfig(bad).enabled).toBe(false);
    const result = validateReleaseConfig(input({
      purpose: 'product-test-candidate',
      runtime: { ...realRuntime },
      cloud: { ...testCloud },
      ads: bad,
    }));
    expect(result.ok).toBe(false);
    expect(fields(result)).toContain('ads.policyVersion');
  });

  it('leaderboards 单榜空：parse 静默 disabled，校验器显式失败', () => {
    const bad = { ...testBoards, assetsBoardId: '' };
    expect(parseLeaderboardConfig(bad).enabled).toBe(false);
    const result = validateReleaseConfig(input({
      purpose: 'product-test-candidate',
      runtime: { ...realRuntime },
      leaderboards: bad,
    }));
    expect(result.ok).toBe(false);
    expect(fields(result)).toContain('leaderboards.assetsBoardId');
  });

  it('合法 L2 配置：parse 与校验器同时放行（不互相矛盾）', () => {
    expect(parseCloudConfig(testCloud).enabled).toBe(true);
    expect(parseLeaderboardConfig(testBoards).enabled).toBe(true);
    expect(parseAdsConfig(testAds).enabled).toBe(true);
    const result = validateReleaseConfig(input({
      purpose: 'product-test-candidate',
      runtime: { ...realRuntime },
      cloud: { ...testCloud },
      ads: { ...testAds },
      leaderboards: { ...testBoards },
    }));
    expect(result.ok).toBe(true);
  });
});
