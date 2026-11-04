// R21：最终 zip 校验与 manifest（从最终包解包，不检查源目录）。
// 检查：zip 可解、条目均为正斜杠、game.json/版本/平台、必需文件存在、
//       无 Mock/测试写状态 hook、无密钥、历史重复构建残留、大小 <20MB、篡改字节失败。
// 用法：node tools/verify-package.cjs <zipPath> <releaseId> <gameVersion> <outDir>
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.join(__dirname, '..');
const { readZipEntries } = require(path.join(__dirname, 'lib', 'read-zip.cjs'));

const [zipPath, releaseId, gameVersion, outDir] = process.argv.slice(2);
if (!zipPath || !releaseId) {
  console.error('VERIFY_FAIL usage');
  process.exit(2);
}
if (!gameVersion || !/^\d+\.\d+\.\d+$/.test(gameVersion)) fail('gameVersion must match x.y.z', gameVersion);
function fail(msg, extra) {
  console.error('VERIFY_FAIL', msg, extra ?? '');
  process.exit(1);
}
if (!fs.existsSync(zipPath)) fail('zip missing', zipPath);
const zipBuf = fs.readFileSync(zipPath);
let entries;
try {
  entries = readZipEntries(zipBuf);
} catch (e) {
  fail('zip not readable', e.message);
}
if (!entries.length) fail('empty zip');

const findings = {
  backslashEntries: [],
  absoluteOrTraversal: [],
  duplicateNames: {},
  missing: [],
  forbidden: [],
  secrets: [],
  versionMismatch: null,
  profileMismatch: null,
  missingResourceReferences: [],
  releaseConfigErrors: [],
  adsEnvironment: null,
  policyVersion: null,
};
for (const e of entries) {
  const name = e.entryName;
  if (name.includes('\\')) findings.backslashEntries.push(name);
  if (path.isAbsolute(name) || /^[A-Za-z]:[\\/]/.test(name) || /^\\\\/.test(name) || name.split('/').includes('..')) findings.absoluteOrTraversal.push(name);
  findings.duplicateNames[name] = (findings.duplicateNames[name] ?? 0) + 1;
}
Object.entries(findings.duplicateNames).forEach(([n, c]) => {
  if (c > 1) findings.duplicateNames[n] = c;
  else delete findings.duplicateNames[n];
});

function readEntry(name) {
  const e = entries.find((x) => x.entryName === name);
  return e ? e.getText() : null;
}
const REQUIRED = ['game.js', 'game.json', 'first-screen.js', 'logo.png', 'slogan.png', 'splash-art.png'];
for (const f of REQUIRED) {
  if (!readEntry(f)) findings.missing.push(f);
}
const entryNames = new Set(entries.map((e) => e.entryName));
const gameJs = readEntry('game.js') ?? '';
const applicationMatch = gameJs.match(/(?:System\[\s*["']import["']\s*\]|require)\s*\(\s*["']\.\/(application(?:\.[A-Za-z0-9_-]+)?\.js)["']\s*\)/);
const applicationEntry = applicationMatch?.[1] ?? null;
if (!applicationEntry) findings.missing.push('game.js application entry');
else if (!entryNames.has(applicationEntry)) findings.missingResourceReferences.push(`game.js -> ${applicationEntry}`);

// Resolve every direct relative require/System.import from the Tap entry.
// Extensionless local imports (for example ./first-screen) resolve to .js.
const gameJsRelativeReferences = new Set();
const relativeCall = /(?:System\[\s*["']import["']\s*\]|require)\s*\(\s*["'](\.\/[A-Za-z0-9_./-]+)["']\s*\)/g;
for (const match of gameJs.matchAll(relativeCall)) gameJsRelativeReferences.add(match[1]);
for (const reference of gameJsRelativeReferences) {
  const normalized = path.posix.normalize(reference.slice(2));
  if (!normalized || normalized === '..' || normalized.startsWith('../') || path.posix.isAbsolute(normalized)) {
    findings.missingResourceReferences.push(`game.js -> unsafe ${reference}`);
    continue;
  }
  const candidates = path.posix.extname(normalized) ? [normalized] : [`${normalized}.js`, `${normalized}/index.js`];
  if (!candidates.some((candidate) => entryNames.has(candidate))) {
    findings.missingResourceReferences.push(`game.js -> ${reference}`);
  }
}
// 平台/版本
const gameJson = readEntry('game.json');
let parsedGameJson = null;
if (gameJson) {
  try {
    parsedGameJson = JSON.parse(gameJson);
  } catch (e) {
    fail('game.json invalid', e.message);
  }
  if (parsedGameJson.deviceOrientation !== 'portrait') {
    findings.versionMismatch = `deviceOrientation=${parsedGameJson.deviceOrientation}`;
  }
  if (gameVersion && parsedGameJson.productVersion !== gameVersion) {
    findings.versionMismatch = `productVersion ${parsedGameJson.productVersion} != ${gameVersion}`;
  }
}
// 禁止内容：Mock 平台/测试改状态 hook/旧 fetch 抛错/明文密钥
const FORBIDDEN_PATTERNS = [
  { re: /EditorMockPlatform/, name: 'EditorMockPlatform in package' },
  { re: /throw new Error\('fetch is not defined'\)/, name: 'fetch throw remains' },
  { re: /__setBuildProfileForTest|__CEO_TEST_(?:HOOK|WRITE)__|__setGameStateForTest|injectTestState/i, name: 'development test hook in package' },
];
const SECRET_PATTERNS = [
  /session[_-]?key\s*[:=]\s*['"][A-Za-z0-9]{12,}/,
  /app[_-]?secret\s*[:=]\s*['"][^'"]{6,}/i,
];
const legacySplashPath = path.join(root, 'tools', 'splash', 'splash.jpg');
const legacySplashHash = fs.existsSync(legacySplashPath)
  ? crypto.createHash('sha256').update(fs.readFileSync(legacySplashPath)).digest('hex')
  : null;
for (const e of entries) {
  if (legacySplashHash && crypto.createHash('sha256').update(e.getData()).digest('hex') === legacySplashHash) {
    findings.forbidden.push(`${e.entryName}: baked-progress splash artwork`);
  }
  if (!/\.(js|json|html|txt)$/.test(e.entryName)) continue;
  const text = e.getData().toString('utf8');
  for (const p of FORBIDDEN_PATTERNS) if (p.re.test(text)) findings.forbidden.push(`${e.entryName}: ${p.name}`);
  for (const re of SECRET_PATTERNS) if (re.test(text)) findings.secrets.push(e.entryName);
}
// 启动补丁标记必须存在
for (const marker of ['CEO-PATCH:boot-diag', 'CEO-PATCH:init-once', 'CEO-PATCH:fetch-guard']) {
  const count = gameJs.split(marker).length - 1;
  if (count !== 1) findings.missing.push(`marker ${marker} count=${count}`);
}

// Read Cocos-imported JsonAsset payloads from the ZIP, not the source tree.
const packagedJsonAssets = [];
function findJsonAssets(value, entryName) {
  if (!Array.isArray(value)) return;
  if (value.length >= 3 && typeof value[1] === 'string'
    && (value[1] === 'ads.config' || value[1] === 'privacy-policy')
    && value[2] && typeof value[2] === 'object' && !Array.isArray(value[2])) {
    packagedJsonAssets.push({ name: value[1], data: value[2], entryName });
  }
  for (const child of value) findJsonAssets(child, entryName);
}
for (const e of entries) {
  if (!e.entryName.endsWith('.json')) continue;
  try { findJsonAssets(JSON.parse(e.getText()), e.entryName); } catch { /* other JSON formats are validated separately */ }
}
const packagedAds = packagedJsonAssets.filter((asset) => asset.name === 'ads.config');
const packagedPrivacy = packagedJsonAssets.filter((asset) => asset.name === 'privacy-policy');
if (packagedAds.length !== 1) findings.releaseConfigErrors.push(`expected 1 packaged ads.config JsonAsset, found ${packagedAds.length}`);
if (packagedPrivacy.length !== 1) findings.releaseConfigErrors.push(`expected 1 packaged privacy-policy JsonAsset, found ${packagedPrivacy.length}`);
if (packagedAds.length === 1 && packagedPrivacy.length === 1) {
  const ads = packagedAds[0].data;
  const privacy = packagedPrivacy[0].data;
  findings.adsEnvironment = ads.environment ?? null;
  findings.policyVersion = privacy.version ?? null;
  if (ads.schemaVersion !== 2 || typeof ads.enabled !== 'boolean'
    || !['disabled', 'test', 'production'].includes(ads.environment)
    || typeof ads.rewardedAdUnitId !== 'string'
    || !Number.isInteger(ads.policyVersion) || ads.policyVersion !== privacy.version) {
    findings.releaseConfigErrors.push('packaged ads configuration is malformed or policyVersion differs from packaged privacy policy');
  }
  if (ads.environment === 'disabled' && (ads.enabled !== false || ads.rewardedAdUnitId !== '')) {
    findings.releaseConfigErrors.push('disabled ads environment must have enabled=false and an empty adUnitId');
  }
  if (ads.enabled === true && (ads.environment === 'disabled' || !ads.rewardedAdUnitId.trim() || ads.privacyReviewed !== true)) {
    findings.releaseConfigErrors.push('enabled ads require a non-empty real adUnitId and privacyReviewed=true');
  }
}
if (!gameJs.includes(`G.__CEO_RELEASE_ID__ = ${JSON.stringify(releaseId)};`) ||
    !gameJs.includes(`gameVersion: ${JSON.stringify(gameVersion)}`) ||
    !gameJs.includes("kind: 'taptap'")) {
  findings.profileMismatch = { expectedReleaseId: releaseId, expectedGameVersion: gameVersion, profile: 'taptap' };
}
const bootScreen = readEntry('first-screen.js') ?? '';
const splashMatch = bootScreen.match(/var BG_NAME\s*=\s*['"]([^'"]+)['"]/);
if (!splashMatch || !readEntry(splashMatch[1])) findings.missingResourceReferences.push(splashMatch?.[1] ?? 'first-screen splash BG_NAME');
const sha256 = crypto.createHash('sha256').update(zipBuf).digest('hex');
const sizeBytes = zipBuf.length;
const manifest = {
  releaseId,
  gameVersion: gameVersion || parsedGameJson?.productVersion || null,
  verifiedAt: new Date().toISOString(),
  projectSizeBudgetBytes: 20 * 1024 * 1024,
  zipPath: path.relative(root, zipPath),
  sizeBytes,
  sizeMib: Number((sizeBytes / 1024 / 1024).toFixed(3)),
  sha256,
  entryCount: entries.length,
  gameJson: parsedGameJson,
  applicationEntry,
  gameJsRelativeReferences: [...gameJsRelativeReferences].sort(),
  productionProfile: findings.profileMismatch ? null : { kind: 'taptap', releaseId, gameVersion },
  findings,
};

const hardFails = [
  ...findings.backslashEntries,
  ...findings.absoluteOrTraversal,
  ...Object.keys(findings.duplicateNames),
  ...findings.missing,
  ...findings.forbidden,
  ...findings.secrets,
];
if (findings.versionMismatch) hardFails.push(findings.versionMismatch);
if (findings.profileMismatch) hardFails.push('production profile mismatch');
hardFails.push(...findings.missingResourceReferences);
hardFails.push(...findings.releaseConfigErrors);
if (sizeBytes >= 20 * 1024 * 1024) hardFails.push(`size ${sizeBytes} >= 20MB`);

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'package-check.json'), JSON.stringify(manifest, null, 2));
fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
fs.writeFileSync(path.join(outDir, 'entry-list.txt'), entries.map((e) => e.entryName).sort().join('\n'));

if (hardFails.length) {
  console.error('VERIFY_FAIL', JSON.stringify(hardFails, null, 2));
  process.exit(1);
}
console.log('VERIFY_OK', sha256, sizeBytes, 'bytes', entries.length, 'entries');
