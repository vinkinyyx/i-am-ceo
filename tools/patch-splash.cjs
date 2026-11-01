// 启动画面 + 启动兼容补丁（每次构建后可重复执行，幂等）。
// 1) 各平台覆盖自有启动图（logo/slogan/splash.jpg）
// 2) 小游戏首屏替换为整张品牌图 + 真实进度条（tools/splash/first-screen.js）
// 3) game.js / check-version.js 启动兼容（真机 Android 卡首屏的防御）
// 4) web-mobile 注入整图覆盖层
// 用法：node tools/patch-splash.cjs
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const srcDir = path.join(__dirname, 'splash');
const LOGO = path.join(srcDir, 'logo.png');
const SLOGAN = path.join(srcDir, 'slogan.png');
const SPLASH_FULL = path.join(srcDir, 'splash.jpg');
const FIRST_SCREEN_TPL = path.join(srcDir, 'first-screen.js');

// 与 tools/splash/splash.html 的卡片背景一致，避免启动层留白出现色差
const BG = { x: 11 / 255, y: 21 / 255, z: 38 / 255, w: 1 };
const SPLASH_TOTAL_TIME = 1500;
const SPLASH_DISPLAY_RATIO = 2.4;

function copyFile(from, to) {
  if (!fs.existsSync(from)) return false;
  fs.copyFileSync(from, to);
  return true;
}

function copyAssets(dir) {
  if (!fs.existsSync(dir)) return false;
  copyFile(LOGO, path.join(dir, 'logo.png'));
  copyFile(SLOGAN, path.join(dir, 'slogan.png'));
  copyFile(SPLASH_FULL, path.join(dir, 'splash.jpg'));
  return true;
}

function patchWebSettings(file) {
  if (!fs.existsSync(file)) return null;
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  const base64 = 'data:image/png;base64,' + fs.readFileSync(LOGO).toString('base64');
  raw.splashScreen = {
    displayRatio: SPLASH_DISPLAY_RATIO,
    totalTime: SPLASH_TOTAL_TIME,
    logo: { type: 'custom', base64, image: '' },
    background: { type: 'default', color: BG },
    watermarkLocation: 'default',
    autoFit: true,
  };
  fs.writeFileSync(file, JSON.stringify(raw, null, 4), 'utf8');
  return { file, base64Chars: base64.length };
}

/** 小游戏首屏：整张 splash.jpg 铺满 + 进度条（模板覆盖，避免逐处正则替换）。 */
function installFirstScreen(dir) {
  const dst = path.join(dir, 'first-screen.js');
  if (!fs.existsSync(path.dirname(dst))) return null;
  if (!fs.existsSync(FIRST_SCREEN_TPL)) return null;
  fs.copyFileSync(FIRST_SCREEN_TPL, dst);
  return { file: dst, bytes: fs.statSync(dst).size };
}

/**
 * game.js 启动兼容：
 * - 无 fetch 时不再抛错（抛出会直接卡在首屏）；
 * - Android 分支的 GameGlobal.requestAnimationFrame 缺失时退回全局 raf / setTimeout
 *   （华为、vivo 上若容器未挂 GameGlobal.raf，__initApp 永不执行 → 永远停在加载页）；
 * - canvas 全局缺失时不做尺寸调整；
 * - 启动链失败时结束首屏，避免永久卡图。
 */
function patchGameJs(dir) {
  const file = path.join(dir, 'game.js');
  if (!fs.existsSync(file)) return null;
  let src = fs.readFileSync(file, 'utf8');
  const before = src;

  src = src.replace(
    /if \(!GameGlobal\.oldFetch\) \{\s*throw new Error\('fetch is not defined'\);\s*\}/,
    "if (!GameGlobal.oldFetch) {\n    console.warn('[compat] fetch is not defined');\n}",
  );

  src = src.replace(/if \(canvas\)\s*\{/, "if (typeof canvas !== 'undefined' && canvas) {");

  src = src.replace(
    /var sysInfo = wx\.getSystemInfoSync\(\);\s*if \(sysInfo\.platform\.toLocaleLowerCase\(\) === 'android'\) \{\s*GameGlobal\.requestAnimationFrame\s*\(__initApp\);\s*\} else \{\s*__initApp\(\);\s*\}/,
    [
      'var sysInfo = wx.getSystemInfoSync();',
      '(function () {',
      "  var platform = sysInfo && sysInfo.platform ? String(sysInfo.platform).toLowerCase() : '';",
      '  var raf = null;',
      '  try { raf = GameGlobal && GameGlobal.requestAnimationFrame; } catch (e) {}',
      "  if (!raf && typeof requestAnimationFrame === 'function') raf = requestAnimationFrame;",
      "  if (platform === 'android') {",
      '    if (raf) raf(__initApp); else setTimeout(__initApp, 16);',
      '  } else {',
      '    __initApp();',
      '  }',
      '})();',
    ].join('\n'),
  );

  // 两套构建产物写法：Tap 转换后（function 形式）与 Cocos 原生（箭头函数形式）
  src = src.replace(
    /\[\"catch\"\]\(function \(err\) \{\s*console\.error\(err\);\s*\}\);/,
    [
      '["catch"](function (err) {',
      '    console.error(err);',
      '    try { firstScreen.end(); } catch (e) {}',
      '  });',
    ].join('\n'),
  );
  src = src.replace(
    /\}\)\.catch\(\(err\) => \{\s*console\.error\(err\);\s*\}\);/,
    [
      '}).catch((err) => {',
      '    console.error(err);',
      '    try { firstScreen.end(); } catch (e) {}',
      '});',
    ].join('\n'),
  );

  if (src !== before) fs.writeFileSync(file, src, 'utf8');
  return { file, changed: src !== before };
}

/** check-version.js：getAccountInfoSync 缺失/可选链不兼容时的防御。 */
function patchCheckVersion(dir) {
  const file = path.join(dir, 'check-version.js');
  if (!fs.existsSync(file)) return null;
  let src = fs.readFileSync(file, 'utf8');
  const before = src;

  src = src.replace(
    /const miniProgram = wx\.getAccountInfoSync\(\)\.miniProgram;/,
    [
      'let __accountInfo = null;',
      'try { __accountInfo = wx.getAccountInfoSync ? wx.getAccountInfoSync() : null; } catch (e) { __accountInfo = null; }',
      'const miniProgram = (__accountInfo && __accountInfo.miniProgram) || {};',
    ].join('\n'),
  );
  src = src.replace(
    /exports\.isDevelop = miniProgram\?\.envVersion === "develop";/,
    'exports.isDevelop = !!(miniProgram && miniProgram.envVersion === "develop");',
  );

  if (src !== before) fs.writeFileSync(file, src, 'utf8');
  return { file, changed: src !== before };
}

/** web-mobile：注入整图覆盖层（构建产物 index.html 每次会被重建，故每次补丁）。 */
function patchWebIndex(dir) {
  const file = path.join(dir, 'index.html');
  if (!fs.existsSync(file)) return null;
  let src = fs.readFileSync(file, 'utf8');
  if (src.includes('data-tap-splash')) return { file, changed: false };

  const block = `
  <div id="tap-splash" data-tap-splash="1" style="position:fixed;left:0;top:0;width:100%;height:100%;z-index:99;background:#dcecfb;overflow:hidden;">
    <img src="splash.jpg" alt="" style="width:100%;height:100%;object-fit:cover;display:block;" />
  </div>
  <script>
    (function () {
      function hide() {
        var el = document.getElementById('tap-splash');
        if (!el || el.getAttribute('data-hidden')) return;
        el.setAttribute('data-hidden', '1');
        el.style.transition = 'opacity .35s ease';
        el.style.opacity = '0';
        setTimeout(function () { if (el && el.parentNode) el.parentNode.removeChild(el); }, 400);
      }
      window.addEventListener('load', function () { setTimeout(hide, 1800); });
      setTimeout(hide, 6000);
    })();
  </script>
`;
  src = src.replace('</body>', block + '</body>');
  fs.writeFileSync(file, src, 'utf8');
  return { file, changed: true };
}

const targets = [
  { name: 'web-mobile', dir: path.join(root, 'build', 'web-mobile') },
  { name: 'wechatgame', dir: path.join(root, 'build', 'wechatgame') },
  { name: 'tap', dir: path.join(root, 'build', 'TapBuild', 'game') },
];

const report = {
  copied: [],
  firstScreen: [],
  gameJs: [],
  checkVersion: [],
  webSettings: null,
  webIndex: null,
  missing: [],
};

for (const t of targets) {
  if (copyAssets(t.dir)) report.copied.push(t.name);
  else report.missing.push(t.name);
  if (t.name !== 'web-mobile') {
    const fs1 = installFirstScreen(t.dir);
    if (fs1) report.firstScreen.push(fs1);
    const gj = patchGameJs(t.dir);
    if (gj) report.gameJs.push(gj);
    const cv = patchCheckVersion(t.dir);
    if (cv) report.checkVersion.push(cv);
  }
}

const webSettings = path.join(root, 'build', 'web-mobile', 'src', 'settings.json');
report.webSettings = patchWebSettings(webSettings);
const webIndex = patchWebIndex(path.join(root, 'build', 'web-mobile'));
if (webIndex) report.webIndex = webIndex;

// build-templates 让后续构建自动带上自有启动图
for (const name of ['web-mobile', 'wechatgame']) {
  const dir = path.join(root, 'build-templates', name);
  fs.mkdirSync(dir, { recursive: true });
  copyAssets(dir);
}

console.log(JSON.stringify(report, null, 2));
