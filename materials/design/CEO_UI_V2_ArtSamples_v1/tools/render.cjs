// UI V2 样板渲染器：SVG 源稿 → 超采样 PNG（透明背景）。
// 用法：node render.cjs --in <svg> --out <png> --w 1080 --h 660 [--scale 3] [--alpha 1]
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const CHROME_CANDIDATES = [
  process.env.CHROME_EXE,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Users\\vinki\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe',
].filter(Boolean);

function arg(name, fallback) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (hit) return hit.split('=').slice(1).join('=');
  const idx = process.argv.indexOf(`--${name}`);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
  return fallback;
}

(async () => {
  const input = arg('in');
  const output = arg('out');
  const width = Number(arg('w', 0));
  const height = Number(arg('h', 0));
  const scale = Number(arg('scale', 3));
  const alpha = arg('alpha', '1') !== '0';
  if (!input || !output || !width || !height) throw new Error('缺少 --in/--out/--w/--h');

  const svg = fs.readFileSync(input, 'utf8');
  const executablePath = CHROME_CANDIDATES.find((p) => fs.existsSync(p));
  if (!executablePath) throw new Error('未找到 Chrome 可执行文件，请设置 CHROME_EXE');

  const browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox', '--force-color-profile=srgb'] });
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: scale });
  await page.setContent(
    `<html><head><meta charset="utf-8"><style>
       html,body{margin:0;padding:0;width:${width}px;height:${height}px;overflow:hidden;background:transparent}
       svg{display:block;width:${width}px;height:${height}px}
     </style></head><body>${svg}</body></html>`,
    { waitUntil: 'load' },
  );
  await page.waitForTimeout(120);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  await page.screenshot({ path: output, omitBackground: alpha, clip: { x: 0, y: 0, width, height } });
  await browser.close();
  console.log(`rendered ${path.basename(input)} -> ${output} (${width}x${height} @${scale}x)`);
})();
