// 临时验证脚本（交互回归）：隐私弹窗 → 公司页换一批 → 进入 CEO 页 → 点随机姓名
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const outDir = path.resolve(__dirname);
const exe = process.env.CHROME_EXE || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const url = process.argv[2] || 'http://127.0.0.1:8123/';

const W = 390;
const H = 844;
const SCALE = W / 375;
const sx = (x) => Math.round(W / 2 + x * SCALE);
const sy = (y) => Math.round(H / 2 - y * SCALE);

(async () => {
  const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });

  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(9000);
  await page.screenshot({ path: path.join(outDir, 'v1-privacy.png') });

  // 同意并继续（privacyPolicyUrl 为空时卡片高 396 → 按钮 y=-164）
  await page.mouse.click(sx(0), sy(-164));
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(outDir, 'v2-company.png') });

  // 换一批
  await page.mouse.click(sx(-64), sy(-198));
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(outDir, 'v3-reroll.png') });

  // 下一步：创建 CEO
  await page.mouse.click(sx(0), sy(-330));
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(outDir, 'v4-ceo.png') });

  // 随机姓名（CEO 页 y=198）
  await page.mouse.click(sx(0), sy(198));
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(outDir, 'v5-ceo-random.png') });

  // 自定义名称入口（公司页）→ 返回上一步后再点自定义
  await page.mouse.click(sx(-85), sy(-300));
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(outDir, 'v6-back-company.png') });
  await page.mouse.click(sx(64), sy(-198));
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(outDir, 'v7-custom-dialog.png') });

  // 自定义输入框（弹窗内 y=26）：输入文字 → 使用这个名字
  await page.mouse.click(sx(0), sy(26));
  await page.waitForTimeout(600);
  await page.keyboard.type('向上生长科技');
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(outDir, 'v8-custom-typed.png') });
  await page.mouse.click(sx(0), sy(26 - 72));
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(outDir, 'v9-custom-selected.png') });

  console.log(JSON.stringify({ errors: errors.slice(0, 12), shots: 9 }, null, 2));
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
