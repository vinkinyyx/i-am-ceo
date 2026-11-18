// Apply the shared startup artwork to the local Cocos Web preview.
const fs = require('node:fs');
const path = require('node:path');

const buildRoot = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(__dirname, '../build');
const webDir = path.join(buildRoot, 'web-mobile');
if (!fs.existsSync(path.join(webDir, 'index.html'))) {
  throw new Error('Web preview index.html is missing: ' + webDir);
}
const srcDir = path.join(__dirname, 'splash');
const LOGO = path.join(srcDir, 'logo.png');
const SLOGAN = path.join(srcDir, 'slogan.png');
const SPLASH_ART = path.join(srcDir, 'splash-art.png');

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
  copyFile(SPLASH_ART, path.join(dir, 'splash-art.png'));
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

/** web-mobile：注入整图覆盖层（构建产物 index.html 每次会被重建，故每次补丁）。 */
function patchWebIndex(dir) {
  const file = path.join(dir, 'index.html');
  if (!fs.existsSync(file)) return null;
  let src = fs.readFileSync(file, 'utf8');
  if (src.includes('data-tap-splash')) return { file, changed: false };

  const block = `
  <div id="tap-splash" data-tap-splash="1" style="position:fixed;left:0;top:0;width:100%;height:100%;z-index:99;background:#dcecfb;overflow:hidden;">
    <img src="splash-art.png" alt="" style="width:100%;height:100%;object-fit:cover;display:block;" />
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

copyAssets(webDir);
console.log(JSON.stringify({
  webSettings: patchWebSettings(path.join(webDir, 'src', 'settings.json')),
  webIndex: patchWebIndex(webDir),
}, null, 2));
