// 启动画面替换：把自有启动图覆盖到各平台构建产物，并把 web 端 settings.json 的
// 内置 Cocos logo（base64）替换为自有图片。可在每次构建后重复执行。
// 用法：node tools/patch-splash.cjs [--skip-web] [--skip-tap]
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const srcDir = path.join(__dirname, 'splash');
const LOGO = path.join(srcDir, 'logo.png');
const SLOGAN = path.join(srcDir, 'slogan.png');

// 与 tools/splash/splash.html 的卡片背景一致，避免启动层留白出现色差
const BG = { x: 11 / 255, y: 21 / 255, z: 38 / 255, w: 1 };
const CARD_BG = [11 / 255, 21 / 255, 38 / 255, 1];
const SPLASH_TOTAL_TIME = 1500;
// Cocos 启动层 logo 高度 = 18.5% 屏幕高 × displayRatio；2.4 让 375×812 屏上的
// 方形启动图接近满宽（约 360px），避免官方默认的“小图”观感。
const SPLASH_DISPLAY_RATIO = 2.4;

function copyInto(dir) {
  if (!fs.existsSync(dir)) return false;
  fs.copyFileSync(LOGO, path.join(dir, 'logo.png'));
  fs.copyFileSync(SLOGAN, path.join(dir, 'slogan.png'));
  return true;
}

function patchWebSettings(file) {
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
  return base64.length;
}

/**
 * 小游戏启动层（first-screen.js）不读 settings.json：背景色与 logo 缩放均为硬编码。
 * 这里把纯黑底改为自有深蓝（与卡片背景一致，消除方形留白色差），并把 logo 放大到与 Web 一致。
 */
function patchFirstScreen(file) {
  if (!fs.existsSync(file)) return null;
  let src = fs.readFileSync(file, 'utf8');
  const before = src;
  src = src.replace(/(?:var|let|const) bgColor ?= ?\[[^\]]*\];/, 'var bgColor = [' + CARD_BG.join(', ') + '];');
  src = src.replace(/(?:var|let|const) displayRatio ?= ?[^;]+;/, 'var displayRatio = ' + SPLASH_DISPLAY_RATIO + ';');
  if (src !== before) fs.writeFileSync(file, src, 'utf8');
  return { file, changed: src !== before };
}

const targets = [
  { name: 'web-mobile', dir: path.join(root, 'build', 'web-mobile') },
  { name: 'wechatgame', dir: path.join(root, 'build', 'wechatgame') },
  { name: 'tap', dir: path.join(root, 'build', 'TapBuild', 'game') },
];

const report = { copied: [], webSettings: null, firstScreen: [], missing: [] };
for (const t of targets) {
  if (copyInto(t.dir)) report.copied.push(t.name);
  else report.missing.push(t.name);
  const fsPatch = patchFirstScreen(path.join(t.dir, 'first-screen.js'));
  if (fsPatch) report.firstScreen.push(fsPatch);
}

const webSettings = path.join(root, 'build', 'web-mobile', 'src', 'settings.json');
if (fs.existsSync(webSettings)) report.webSettings = { file: webSettings, base64Chars: patchWebSettings(webSettings) };

// build-templates 让后续构建自动带上自有启动图（web 端 settings 仍需本脚本补丁）
for (const name of ['web-mobile', 'wechatgame']) {
  const dir = path.join(root, 'build-templates', name);
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(LOGO, path.join(dir, 'logo.png'));
  fs.copyFileSync(SLOGAN, path.join(dir, 'slogan.png'));
}

console.log(JSON.stringify(report, null, 2));
