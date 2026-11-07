// R20：发布包统一补丁（单一流水线入口）。
// 职责：
//  1) 自有启动层（logo/slogan/无字splash-art/first-screen.js）幂等复制；
//  2) game.js：fetch 兼容（不抛错）、rAF/setTimeout 竞速 once（R06）、
//     引擎前启动诊断安装（R03，__CEO-BOOT-DIAG 标记，带 releaseId 与阶段打点）；
//  3) check-version.js 可选链防御；
//  4) 每个补丁断言命中次数（多命中/零命中按严重度报告，缺失关键补丁则失败）。
// 用法：node tools/patch-release.cjs <tapGameDir> <releaseId> <gameVersion>
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const [tapDir, releaseId, gameVersion] = process.argv.slice(2);
if (!tapDir || !releaseId) {
  console.error('PATCH_FAIL usage');
  process.exit(2);
}
if (!/^\d+\.\d+\.\d+$/.test(gameVersion)) {
  console.error('PATCH_FAIL gameVersion must match x.y.z');
  process.exit(2);
}
const splashSrc = path.join(__dirname, 'splash');
const report = { releaseId, gameVersion, copied: [], patches: [], warnings: [] };

function fail(msg) {
  console.error('PATCH_FAIL', msg);
  process.exit(1);
}
function copyAsset(name) {
  const from = path.join(splashSrc, name);
  if (!fs.existsSync(from)) return report.warnings.push(`missing splash asset ${name}`);
  fs.copyFileSync(from, path.join(tapDir, name));
  report.copied.push(name);
}

function findFiles(dir, base = dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? findFiles(file, base) : [path.relative(base, file)];
  });
}

function applyOnce(file, pattern, replacement, label, required = true) {
  if (!fs.existsSync(file)) {
    if (required) fail(`${label}: ${path.basename(file)} not found`);
    return;
  }
  const src = fs.readFileSync(file, 'utf8');
  const matches = src.match(pattern);
  const marker = '/* CEO-PATCH:' + label + ' */';
  if (src.includes(marker)) {
    const markerCount = src.split(marker).length - 1;
    const valid = markerCount === 1 && (label === 'fetch-guard'
      ? src.includes("console.warn('[compat] fetch is not defined')") && !src.includes("throw new Error('fetch is not defined')")
      : label === 'init-once'
        ? src.includes('var __fired = false;') && src.includes('function __fireInit()') && src.includes('__initApp();')
        : true);
    if (!valid) fail(`${label}: existing marker is duplicated or patch content is invalid`);
    report.patches.push({ label, status: 'already-applied' });
    return;
  }
  const count = matches ? matches.length : 0;
  if (count === 0) {
    if (required) {
      // 不静默继续：补丁找不到锚点说明转换器版本变化
      fail(`${label}: anchor not found (0 matches)`);
    }
    report.warnings.push(`${label}: anchor not found`);
    return;
  }
  if (count > 1) fail(`${label}: expected exactly one anchor, got ${count}`);
  const out = src.replace(pattern, replacement);
  fs.writeFileSync(file, out, 'utf8');
  report.patches.push({ label, matches: count });
}

// 1) 启动资源
for (const asset of ['logo.png', 'slogan.png', 'splash-art.png', 'first-screen.js']) copyAsset(asset);
// Keep the verifier-required root logo.png. Remove a converter-emitted hashed copy only
// when it is byte-identical and no text asset references that exact filename.
const canonicalLogo = path.join(tapDir, 'logo.png');
report.removedDuplicateLogos = [];
if (fs.existsSync(canonicalLogo)) {
  const canonicalHash = crypto.createHash('sha256').update(fs.readFileSync(canonicalLogo)).digest('hex');
  const textExtensions = new Set(['.js', '.json', '.html', '.css', '.xml', '.plist', '.txt']);
  const textFiles = findFiles(tapDir).filter((relative) => textExtensions.has(path.extname(relative).toLowerCase()));
  for (const name of fs.readdirSync(tapDir)) {
    if (!/^logo\.[a-f0-9]{5}\.png$/i.test(name)) continue;
    const file = path.join(tapDir, name);
    const hash = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    if (hash !== canonicalHash) continue;
    const referenced = textFiles.some((relative) => fs.readFileSync(path.join(tapDir, relative), 'utf8').includes(name));
    if (!referenced) {
      fs.unlinkSync(file);
      report.removedDuplicateLogos.push(name);
    }
  }
}
// Do not ship the legacy flattened loading image: converters may rename it to
// a content-hashed JPG. Runtime art and progress now live in separate layers.
const legacySplash = path.join(splashSrc, 'splash.jpg');
if (fs.existsSync(legacySplash)) {
  const legacyHash = crypto.createHash('sha256').update(fs.readFileSync(legacySplash)).digest('hex');
  report.removed = [];
  for (const entry of fs.readdirSync(tapDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const file = path.join(tapDir, entry.name);
    const hash = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    if (hash !== legacyHash) continue;
    fs.unlinkSync(file);
    report.removed.push(entry.name);
  }
}

// 2) game.js
const gameJs = path.join(tapDir, 'game.js');
if (!fs.existsSync(gameJs)) fail('game.js missing after convert');

applyOnce(
  gameJs,
  /if \(!GameGlobal\.oldFetch\) \{\s*throw new Error\('fetch is not defined'\);\s*\}/,
  "/* CEO-PATCH:fetch-guard */ if (!GameGlobal.oldFetch) { console.warn('[compat] fetch is not defined'); }",
  'fetch-guard',
);

applyOnce(
  gameJs,
  /var sysInfo = wx\.getSystemInfoSync\(\);\s*if \(sysInfo\.platform\.toLocaleLowerCase\(\) === 'android'\) \{\s*GameGlobal\.requestAnimationFrame\s*\(__initApp\);\s*\} else \{\s*__initApp\(\);\s*\}/,
  [
    '/* CEO-PATCH:init-once */',
    'var sysInfo = wx.getSystemInfoSync();',
    '(function () {',
    "  var platform = sysInfo && sysInfo.platform ? String(sysInfo.platform).toLowerCase() : '';",
    '  var raf = null;',
    '  try { raf = GameGlobal && GameGlobal.requestAnimationFrame; } catch (e) {}',
    "  if (!raf && typeof requestAnimationFrame === 'function') raf = requestAnimationFrame;",
    "  if (!raf && typeof GameGlobal.raf === 'function') raf = GameGlobal.raf.bind(GameGlobal);",
    '  var __fired = false;',
    '  function __fireInit() { if (__fired) return; __fired = true; __initApp(); }',
    '  var __fallbackTimer = setTimeout(__fireInit, 120);',
    "  if (platform === 'android') {",
    '    if (raf) raf(function () { clearTimeout(__fallbackTimer); __fireInit(); }); else __fireInit();',
    '  } else { __fireInit(); }',
    '})();',
  ].join('\n'),
  'init-once',
);

// 引擎前诊断安装（插在文件最前）
const diagBootstrap = `/* CEO-PATCH:boot-diag */
(function () {
  try {
    var G = (typeof GameGlobal !== 'undefined') ? GameGlobal : globalThis;
    G.__CEO_RELEASE_ID__ = ${JSON.stringify(releaseId)};
    G.__CEO_BUILD__ = { kind: 'taptap', releaseId: ${JSON.stringify(releaseId)}, gameVersion: ${JSON.stringify(gameVersion ?? '1.0.0')} };
    var stages = ['entry','adapter','polyfills','modules','engine','scene','config','save','interactive'];
    var failures = [];
    var stage = 'entry', ready = false;
    function sanitize(m){ m = String(m); return m.length > 300 ? m.slice(0,300) : m; }
    function fail(code, msg) { failures.push({ code: code, stage: stage, message: sanitize(msg) }); try { console.error('[boot]', code, msg); } catch (e) {} }
    G.__CEO_BOOT_DIAG__ = {
      mark: function (s, p) { if (ready) return; stage = s; if (p === 'end') console.log('[boot]', s); },
      ready: function () { ready = true; stage = 'interactive'; },
      fail: fail,
      snapshot: function () { return { releaseId: ${JSON.stringify(releaseId)}, stage: stage, ready: ready, failures: failures.slice(-30) }; },
    };
    G.__CEO_BOOT_DIAG__.mark('entry','end');
    if (typeof G.addEventListener === 'function') {
      G.addEventListener('error', function (e) { fail('HOST_ERROR', (e && (e.message || (e.error && e.error.message))) || 'error'); });
      G.addEventListener('unhandledrejection', function (e) { fail('UNHANDLED_REJECTION', (e && e.reason && e.reason.message) || 'rejection'); });
    }
    setTimeout(function () { if (!ready && failures.length === 0) fail('BOOT_WATCHDOG_TIMEOUT', 'stage ' + stage + ' timeout'); }, 12000);
  } catch (e) { try { console.error('boot-diag install failed', e); } catch (_) {} }
})();
`;
let gs = fs.readFileSync(gameJs, 'utf8');
if (!gs.includes('CEO-PATCH:boot-diag')) {
  fs.writeFileSync(gameJs, diagBootstrap + gs, 'utf8');
  report.patches.push({ label: 'boot-diag', matches: 1 });
} else {
  const releaseValue = `G.__CEO_RELEASE_ID__ = ${JSON.stringify(releaseId)};`;
  const versionValue = `gameVersion: ${JSON.stringify(gameVersion ?? '1.0.0')}`;
  if ((gs.match(/CEO-PATCH:boot-diag/g) || []).length !== 1 ||
      !gs.includes(releaseValue) || !gs.includes(versionValue) ||
      !gs.includes('snapshot: function ()') || !gs.includes("'interactive'")) {
    fail('boot-diag: existing patch does not match this releaseId/version or is incomplete');
  }
  report.patches.push({ label: 'boot-diag', status: 'already-applied' });
}

// 3) check-version.js
const cv = path.join(tapDir, 'check-version.js');
applyOnce(
  cv,
  /const miniProgram = wx\.getAccountInfoSync\(\)\.miniProgram;/,
  [
    '/* CEO-PATCH:account-guard */',
    'let __accountInfo = null;',
    'try { __accountInfo = wx.getAccountInfoSync ? wx.getAccountInfoSync() : null; } catch (e) { __accountInfo = null; }',
    'const miniProgram = (__accountInfo && __accountInfo.miniProgram) || {};',
  ].join('\n'),
  'account-guard',
  false,
);
applyOnce(
  cv,
  /exports\.isDevelop = miniProgram\?\.envVersion === "develop";/,
  'exports.isDevelop = !!(miniProgram && miniProgram.envVersion === "develop");',
  'isdevelop',
  false,
);

console.log('PATCH_OK');
console.log(JSON.stringify(report, null, 2));
