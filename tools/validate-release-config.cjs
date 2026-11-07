// DEV-04：发行配置模式组合校验器（薄层，只做检查，不做任何外部写入）。
// 三种模式：
//   diagnostic-disabled        三能力全关，endpoint/隐私URL可空；诊断包不得冒充产品候选。
//   product-test-candidate     L2 测试候选：按实际已开能力逐项启用，env=test，真实ID/HTTPS/隐私资料。
//   product-production-candidate 生产候选：实际计划上线能力启用，env=production，不得混测试服务与生产ID。
// 规则要点（§28.5）：
//   - appId 绑定 1016161；各能力 env 一致且与模式一致；
//   - authEndpoint 为合法 HTTPS 基址（无凭据/片段/查询/占位域名）；云或榜启用时必填；
//   - privacyPolicyUrl 在 L2/生产必填且为真实 HTTPS 地址；
//   - policyVersion 只能为 3；广告启用必须真实位ID且 privacyReviewed=true；
//   - 两榜ID非空且互不相同；生产模式拒绝任何 Fake/占位/测试字样 ID；
//   - enabled 与环境必须一致（enabled=true 不得 environment=disabled，反之亦然），
//     防止运行时 parse*Config 静默降级为 disabled 掩盖配置错误。
// 用法：node tools/validate-release-config.cjs <purpose> <outDir>
//   purpose ∈ diagnostic | product-test-candidate | product-production-candidate
//   读取 assets/resources/config/{runtime,cloud,ads,leaderboards}.config.json，
//   写 <outDir>/validate-release-config.json，成功打印 CONFIG_OK，失败 CONFIG_FAIL 并退出码 1。
const fs = require('fs');
const path = require('path');

const EXPECTED_APP_ID = '1016161';
const PRIVACY_POLICY_VERSION = 3;
const ENVIRONMENTS = ['disabled', 'test', 'production'];

const PURPOSE_TO_MODE = {
  diagnostic: { mode: 'diagnostic-disabled', expectedEnv: null },
  'product-test-candidate': { mode: 'L2-test-candidate', expectedEnv: 'test' },
  'product-production-candidate': { mode: 'production-candidate', expectedEnv: 'production' },
};

// 占位/Fake 识别：示例域名、占位词。生产模式额外拒绝 test 字样 ID（不得混测试与生产）。
const PLACEHOLDER_HOST_RE = /(^|\.)example\.(com|org|net)$|^localhost$|^127\.0\.0\.1$/i;
const FAKE_VALUE_RE = /fake|dummy|placeholder|changeme|your[-_]/i;

function isFakeId(value) {
  return FAKE_VALUE_RE.test(value);
}

function validateUrl(field, raw, errors, { required, production }) {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!value) {
    if (required) errors.push({ field, message: 'required but empty' });
    return;
  }
  let url;
  try {
    url = new URL(value);
  } catch {
    errors.push({ field, message: `not a valid URL: ${value}` });
    return;
  }
  if (url.protocol !== 'https:') errors.push({ field, message: `must be https, got ${url.protocol}` });
  if (url.username || url.password) errors.push({ field, message: 'must not contain user credentials' });
  if (url.hash) errors.push({ field, message: 'must not contain fragment' });
  if (url.search) errors.push({ field, message: 'base address must not contain query string' });
  if (PLACEHOLDER_HOST_RE.test(url.hostname)) errors.push({ field, message: `placeholder host not allowed: ${url.hostname}` });
  if (FAKE_VALUE_RE.test(value)) errors.push({ field, message: 'looks like a fake/placeholder value' });
  if (production && /test/i.test(url.hostname)) {
    errors.push({ field, message: 'production must not point at a test host' });
  }
}

function checkShape(field, value, shape, errors) {
  for (const [key, check] of Object.entries(shape)) {
    if (!check(value?.[key])) {
      errors.push({ field: `${field}.${key}`, message: `invalid value ${JSON.stringify(value?.[key])}` });
    }
  }
}

const CLOUD_SHAPE = {
  schemaVersion: (v) => v === 1,
  enabled: (v) => typeof v === 'boolean',
  environment: (v) => ENVIRONMENTS.includes(v),
  appId: (v) => typeof v === 'string',
  policyVersion: (v) => v === PRIVACY_POLICY_VERSION,
  minUploadIntervalMs: (v) => v === 65000,
  autoBackupIntervalMs: (v) => v === 120000,
  retainedCheckpoints: (v) => v === 3,
};
const LEADERBOARDS_SHAPE = {
  schemaVersion: (v) => v === 1,
  enabled: (v) => typeof v === 'boolean',
  environment: (v) => ENVIRONMENTS.includes(v),
  appId: (v) => typeof v === 'string',
  policyVersion: (v) => v === PRIVACY_POLICY_VERSION,
  assetsBoardId: (v) => typeof v === 'string',
  yearsBoardId: (v) => typeof v === 'string',
  calculation: (v) => v === 'latest',
};
const ADS_SHAPE = {
  schemaVersion: (v) => v === 2,
  enabled: (v) => typeof v === 'boolean',
  environment: (v) => ENVIRONMENTS.includes(v),
  policyVersion: (v) => v === PRIVACY_POLICY_VERSION,
  rewardedAdUnitId: (v) => typeof v === 'string',
  dailyGrantLimit: (v) => v === 1,
  privacyReviewed: (v) => typeof v === 'boolean',
};

function checkCapability(name, cfg, shape, expectedEnv, errors) {
  checkShape(name, cfg, shape, errors);
  if (errors.length) return; // 形状已坏，后续一致性判断无意义
  if (cfg.enabled && cfg.environment === 'disabled') {
    errors.push({ field: `${name}.environment`, message: 'enabled=true requires test|production (runtime parser would silently disable)' });
  }
  if (!cfg.enabled && cfg.environment !== 'disabled') {
    errors.push({ field: `${name}.environment`, message: 'explicitly disabled capability must set environment=disabled' });
  }
  if (cfg.enabled && expectedEnv && cfg.environment !== expectedEnv) {
    errors.push({ field: `${name}.environment`, message: `mode requires env=${expectedEnv}, got ${cfg.environment}` });
  }
}

/**
 * 组合校验。输入四个配置对象与 purpose，返回 { ok, mode, errors, summary }。
 * 纯函数：不读文件、不联网、不输出任何密钥。
 */
function validateReleaseConfig({ purpose, runtime, cloud, ads, leaderboards }) {
  const mapping = PURPOSE_TO_MODE[purpose];
  if (!mapping) {
    return { ok: false, mode: null, errors: [{ field: 'purpose', message: `unknown purpose ${purpose}` }] };
  }
  const { mode, expectedEnv } = mapping;
  const production = expectedEnv === 'production';
  const errors = [];

  // 1) 各能力形状与 enabled/env 一致性
  checkCapability('cloud', cloud ?? {}, CLOUD_SHAPE, expectedEnv, errors);
  checkCapability('leaderboards', leaderboards ?? {}, LEADERBOARDS_SHAPE, expectedEnv, errors);
  checkCapability('ads', ads ?? {}, ADS_SHAPE, expectedEnv, errors);

  const cloudOn = cloud?.enabled === true;
  const adsOn = ads?.enabled === true;
  const boardsOn = leaderboards?.enabled === true;

  // 2) 模式总开关
  if (mode === 'diagnostic-disabled') {
    for (const [name, on] of [['cloud', cloudOn], ['leaderboards', boardsOn], ['ads', adsOn]]) {
      if (on) errors.push({ field: `${name}.enabled`, message: 'diagnostic-disabled mode requires all capabilities disabled' });
    }
  } else if (!cloudOn && !adsOn && !boardsOn) {
    errors.push({ field: 'mode', message: `${purpose} with all capabilities disabled is a diagnostic build; use purpose=diagnostic instead of mislabeling` });
  }

  // 3) appId 绑定 1016161（云/榜；广告无 appId 字段，广告位来自官方返回另行核对）
  if (cloudOn && cloud.appId !== EXPECTED_APP_ID) {
    errors.push({ field: 'cloud.appId', message: `must be ${EXPECTED_APP_ID}, got ${JSON.stringify(cloud.appId)}` });
  }
  if (boardsOn && leaderboards.appId !== EXPECTED_APP_ID) {
    errors.push({ field: 'leaderboards.appId', message: `must be ${EXPECTED_APP_ID}, got ${JSON.stringify(leaderboards.appId)}` });
  }

  // 4) 服务端 endpoint：云或榜启用时必填；全关时必须为空（不带 stray 配置）
  const endpointRequired = cloudOn || boardsOn;
  const endpoint = typeof runtime?.authEndpoint === 'string' ? runtime.authEndpoint.trim() : '';
  if (!endpointRequired && endpoint) {
    errors.push({ field: 'runtime.authEndpoint', message: 'endpoint set but neither cloud nor leaderboards enabled' });
  }
  validateUrl('runtime.authEndpoint', endpoint, errors, { required: endpointRequired, production });
  // endpoint 不得指向别的游戏：路径里出现其他数字 appId 直接拒绝
  if (endpoint) {
    try {
      const pathAppIds = new URL(endpoint).pathname.match(/\d{5,}/g) ?? [];
      for (const id of pathAppIds) {
        if (id !== EXPECTED_APP_ID) {
          errors.push({ field: 'runtime.authEndpoint', message: `path contains other appId ${id}, expected ${EXPECTED_APP_ID}` });
        }
      }
    } catch { /* URL 有效性已在上面报告 */ }
  }

  // 5) 隐私政策 URL：诊断可空；L2/生产必填真实 HTTPS（可访问性由平台预检负责）
  validateUrl('runtime.privacyPolicyUrl', runtime?.privacyPolicyUrl ?? '', errors, {
    required: mode !== 'diagnostic-disabled',
    production,
  });

  // 6) 广告启用：真实位 ID + privacyReviewed=true（资料支持由办理流程保证，这里拒绝自动 true 的空位）
  if (adsOn) {
    const unit = ads.rewardedAdUnitId.trim();
    if (!unit) errors.push({ field: 'ads.rewardedAdUnitId', message: 'enabled ads require a real adUnitId' });
    else if (isFakeId(unit) || (production && /test/i.test(unit))) {
      errors.push({ field: 'ads.rewardedAdUnitId', message: 'fake/placeholder/test adUnitId not allowed' });
    }
    if (ads.privacyReviewed !== true) {
      errors.push({ field: 'ads.privacyReviewed', message: 'enabled ads require privacyReviewed=true backed by real materials' });
    }
  }

  // 7) 两榜启用：ID 非空、互不相同、非占位
  if (boardsOn) {
    const assets = leaderboards.assetsBoardId.trim();
    const years = leaderboards.yearsBoardId.trim();
    if (!assets) errors.push({ field: 'leaderboards.assetsBoardId', message: 'enabled leaderboards require assetsBoardId' });
    if (!years) errors.push({ field: 'leaderboards.yearsBoardId', message: 'enabled leaderboards require yearsBoardId' });
    if (assets && years && assets === years) {
      errors.push({ field: 'leaderboards', message: 'assetsBoardId and yearsBoardId must be distinct boards' });
    }
    for (const [field, id] of [['leaderboards.assetsBoardId', assets], ['leaderboards.yearsBoardId', years]]) {
      if (id && (isFakeId(id) || (production && /test/i.test(id)))) {
        errors.push({ field, message: 'fake/placeholder/test board id not allowed' });
      }
    }
  }

  return {
    ok: errors.length === 0,
    mode,
    purpose,
    errors,
    summary: {
      cloud: { enabled: cloudOn, environment: cloud?.environment ?? null },
      leaderboards: { enabled: boardsOn, environment: leaderboards?.environment ?? null },
      ads: { enabled: adsOn, environment: ads?.environment ?? null },
      runtime: { authEndpointSet: endpoint.length > 0, privacyPolicyUrlSet: typeof runtime?.privacyPolicyUrl === 'string' && runtime.privacyPolicyUrl.trim().length > 0 },
    },
  };
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function main() {
  const [purpose, outDir] = process.argv.slice(2);
  if (!purpose || !outDir || !PURPOSE_TO_MODE[purpose]) {
    console.error('CONFIG_FAIL usage: node tools/validate-release-config.cjs <diagnostic|product-test-candidate|product-production-candidate> <outDir>');
    process.exit(2);
  }
  const configDir = path.join(__dirname, '..', 'assets', 'resources', 'config');
  let result;
  try {
    result = validateReleaseConfig({
      purpose,
      runtime: readJson(path.join(configDir, 'runtime.config.json')),
      cloud: readJson(path.join(configDir, 'cloud.config.json')),
      ads: readJson(path.join(configDir, 'ads.config.json')),
      leaderboards: readJson(path.join(configDir, 'leaderboards.config.json')),
    });
  } catch (error) {
    console.error('CONFIG_FAIL cannot read config files:', error.message);
    process.exit(1);
  }
  result.checkedAt = new Date().toISOString();
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'validate-release-config.json'), JSON.stringify(result, null, 2));
  if (!result.ok) {
    console.error('CONFIG_FAIL', JSON.stringify(result.errors, null, 2));
    process.exit(1);
  }
  console.log('CONFIG_OK', result.mode);
}

if (require.main === module) main();

module.exports = { validateReleaseConfig, PURPOSE_TO_MODE, EXPECTED_APP_ID, PRIVACY_POLICY_VERSION };
