/**
 * 构建后置诊断注入（不改工程源码，只作用于 build/TapBuild/game 产物）。
 *
 * 目的：真机（尤其鸿蒙）卡在 Cocos 启动页时，把"卡在哪一步 + 真实报错"直接显示在屏幕上，
 * 而不是只写 console（玩家/开发者看不到）。
 *
 * 做的事：
 * 1. game.js 顶部注入诊断层：捕获 window error / unhandledrejection / console.error / wx.onError，
 *    记录 require 轨迹与 firstScreen 进度，用覆盖层显示。
 * 2. 修正平台分支：原模板只有 android 走 requestAnimationFrame（等第二帧拿正确画布尺寸），
 *    鸿蒙等未知平台走同步路径 → 改为"非 iOS 一律走 rAF"。
 * 3. 重新打包 game.zip。
 *
 * 用法：node tools/diag-inject.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const GAME_DIR = join(ROOT, 'build', 'TapBuild', 'game');
const ENTRY = join(GAME_DIR, 'game.js');
const ZIP = join(ROOT, 'build', 'TapBuild', 'game.zip');

if (!existsSync(ENTRY)) {
  console.error('[diag] 未找到 build/TapBuild/game/game.js，请先构建');
  process.exit(1);
}

const DIAG = String.raw`/* ===== CEO-BOOT-DIAG (build-time injected) ===== */
;(function () {
  var G = typeof GameGlobal !== 'undefined' ? GameGlobal : (typeof globalThis !== 'undefined' ? globalThis : this);
  var D = G.__CEODIAG = { stage: 'entry', errors: [], req: 'none', progress: 'none' };
  function fmt(e) {
    try {
      if (!e) return String(e);
      if (e && e.stack) return String(e.stack).slice(0, 700);
      if (e && e.message) return String(e.message);
      return String(e).slice(0, 400);
    } catch (x) { return '[unprintable]'; }
  }
  function lines() {
    var L = ['CEO-DIAG'];
    L.push('stage=' + D.stage + '  progress=' + D.progress);
    L.push('lastRequire=' + D.req);
    try { L.push('UA=' + String(navigator.userAgent).slice(0, 100)); } catch (e) {}
    try { L.push('sysInfo=' + JSON.stringify(wx.getSystemInfoSync())); } catch (e) {}
    try { L.push('tap=' + (typeof tap) + '  wx=' + (typeof wx) + '  fetch=' + (typeof fetch)); } catch (e) {}
    try { L.push('canvas=' + (typeof canvas !== 'undefined' && canvas ? canvas.width + 'x' + canvas.height : 'null')); } catch (e) {}
    for (var i = 0; i < D.errors.length; i++) L.push('E' + i + ': ' + D.errors[i]);
    return L.join('\n');
  }
  // 小游戏环境无 DOM，覆盖层不可见；用原生弹窗保证错误一定能被玩家看到
  var shown = 0;
  function modal(msg) {
    try {
      var api = (typeof wx !== 'undefined' && wx && typeof wx.showModal === 'function') ? wx
        : (typeof tap !== 'undefined' && tap && typeof tap.showModal === 'function' ? tap : null);
      if (!api || shown >= 3) return;
      shown++;
      api.showModal({
        title: '启动诊断 ' + shown,
        content: String(msg).slice(0, 900),
        showCancel: false,
        confirmText: '知道了'
      });
    } catch (e) {}
  }
  function render() {
    try {
      if (typeof document !== 'undefined' && document && document.body && document.createElement) {
        var el = document.getElementById('__ceodiag');
        if (!el) {
          el = document.createElement('div');
          el.id = '__ceodiag';
          el.style.cssText = 'position:fixed;left:0;top:0;width:100%;box-sizing:border-box;z-index:2147483647;background:rgba(168,0,0,.94);color:#fff;font:11px/1.35 monospace;padding:6px;white-space:pre-wrap;word-break:break-all;max-height:66%;overflow:auto';
          document.body.appendChild(el);
        }
        el.textContent = lines();
      }
    } catch (e) {}
  }
  D.push = function (m) {
    if (D.errors.length < 20) D.errors.push(m);
    render();
    if (D.errors.length <= 3 && String(m).indexOf('TIMEOUT') >= 0) modal(lines());
    else if (String(m).indexOf('console.error') === 0 || String(m).indexOf('wx.onError') === 0 || String(m).indexOf('rejection') === 0) modal(lines());
  };
  D.set = function (s) { D.stage = s; render(); };

  try { if (typeof wx !== 'undefined' && wx.onError) wx.onError(function (r) { D.push('wx.onError: ' + fmt(r && (r.message || r))); }); } catch (e) {}
  try { if (typeof wx !== 'undefined' && wx.onUnhandledRejection) wx.onUnhandledRejection(function (r) { D.push('rejection: ' + fmt(r && r.reason)); }); } catch (e) {}

  try {
    var _ce = console.error;
    console.error = function () {
      var p = [];
      for (var i = 0; i < arguments.length; i++) p.push(fmt(arguments[i]));
      D.push('console.error: ' + p.join(' '));
      return _ce.apply(console, arguments);
    };
  } catch (e) {}

  // require 轨迹：定位卡在哪个文件（SystemJS 的 defaultHandler 也走 require）
  try {
    if (typeof require === 'function') {
      var _rq = require;
      var wrapped = function (p) {
        D.req = String(p); render();
        var mod = _rq.apply(this, arguments);
        if (String(p) === './first-screen' && mod && typeof mod.setProgress === 'function') {
          var _sp = mod.setProgress;
          mod.setProgress = function (v) { D.progress = v; render(); return _sp.apply(mod, arguments); };
        }
        return mod;
      };
      if (typeof GameGlobal !== 'undefined') GameGlobal.require = wrapped;
      G.require = wrapped;
    }
  } catch (e) {}

  // 判定"真的跑起来了"：AppView.buildRoot 会建出名为 AppRoot 的节点
  function getCC() {
    try { if (typeof cc !== 'undefined' && cc && cc.director) return cc; } catch (e) {}
    try { var w = (typeof window !== 'undefined' && window) ? window : G; if (w.cc && w.cc.director) return w.cc; } catch (e) {}
    try { if (G.cc && G.cc.director) return G.cc; } catch (e) {}
    return null;
  }
  function appRootAlive() {
    try {
      var c = getCC();
      var sc = c && c.director && c.director.getScene();
      return !!(sc && sc.getChildByName && sc.getChildByName('AppRoot'));
    } catch (e) { return false; }
  }
  setInterval(function () { if (D.stage !== 'running' && appRootAlive()) D.stage = 'running'; }, 500);

  setTimeout(function () {
    if (D.stage === 'running' || appRootAlive()) return; // 正常跑起来，不打扰玩家
    D.push('TIMEOUT@12s: 启动未完成 stage=' + D.stage + ' progress=' + D.progress + ' lastRequire=' + D.req);
  }, 12000);
  render();
})();
/* ===== end CEO-BOOT-DIAG ===== */
`;

let src = readFileSync(ENTRY, 'utf8');

// 幂等：重复执行先剥掉旧注入与旧打点
src = src.replace(/^\/\* ===== CEO-BOOT-DIAG[\s\S]*?\/\* ===== end CEO-BOOT-DIAG ===== \*\/\n/, '');
src = src.replace(/__CEODIAG&&__CEODIAG\.set\('[^']*'\);/g, '');

src = DIAG + src;

// 关键节点打点：把"卡在第几步"变成可上报的事实
const STAMPS = [
  ["require('./web-adapter');", "s:webAdapter"],
  ['require("src/polyfills.bundle.43263.js");', 's:polyfills'],
  ['require("src/system.bundle.f45da.js");', 's:systemjs'],
  ['System.warmup({', 's:warmup'],
  ["firstScreen.start('default'", 's:splash'],
  ["System[\"import\"]('./application.e1d19.js')", 's:loadApplication'],
  ["System[\"import\"]('cc')", 's:loadEngine'],
  ['require(\'./engine-adapter\');', 's:engineAdapter'],
  ['application.init(cc)', 's:engineInit'],
  ['application.start()', 's:appStart'],
];
let stamped = 0;
for (const [needle, tag] of STAMPS) {
  if (!src.includes(needle)) continue;
  src = src.replace(needle, `__CEODIAG&&__CEODIAG.set('${tag}');${needle}`);
  stamped++;
}
console.log(`[diag] 已插入 ${stamped}/${STAMPS.length} 个启动节点打点`);

// 平台分支修正：非 iOS 一律等第二帧（鸿蒙/未知平台走安全路径）
const oldBranch = /var sysInfo = wx\.getSystemInfoSync\(\);\s*\nif \(sysInfo\.platform\.toLocaleLowerCase\(\) === 'android'\) \{\s*\n\s*GameGlobal\.requestAnimationFrame\(__initApp\);\s*\n\} else \{\s*\n\s*__initApp\(\);\s*\n\}/;
const newBranch = `var sysInfo = wx.getSystemInfoSync();
var __plat = String(sysInfo.platform || '').toLowerCase();
if (__plat === 'ios') {
  __initApp();
} else if (typeof GameGlobal.requestAnimationFrame === 'function') {
  // android / ohos / harmony 等一律等第二帧，确保画布尺寸已就绪
  GameGlobal.requestAnimationFrame(__initApp);
} else {
  __initApp();
}`;
if (oldBranch.test(src)) {
  src = src.replace(oldBranch, newBranch);
  console.log('[diag] 已修正平台分支（非 iOS 一律走 requestAnimationFrame）');
} else {
  console.log('[diag] 警告：未匹配到平台分支，跳过该修正');
}

writeFileSync(ENTRY, src, 'utf8');
console.log(`[diag] 已注入诊断层 → ${ENTRY}`);

// 重新打包（保持 zip 内为相对根路径）
if (existsSync(ZIP)) {
  execFileSync('powershell', [
    '-NoProfile',
    '-Command',
    `Add-Type -AssemblyName System.IO.Compression.FileSystem; ` +
      `Remove-Item -LiteralPath '${ZIP}' -Force -ErrorAction SilentlyContinue; ` +
      `[System.IO.Compression.ZipFile]::CreateFromDirectory('${GAME_DIR}', '${ZIP}', [System.IO.Compression.CompressionLevel]::Optimal, $false)`,
  ], { stdio: 'inherit' });
  console.log(`[diag] 已重新打包 → ${ZIP}`);
}
