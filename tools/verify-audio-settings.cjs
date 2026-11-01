// TC-072/070/071：声音设置持久化与分项保留验证（Web 预览 + localStorage）。
// 流程：向导→公司→设置；关背景音乐→记录；刷新→重开设置核对；再切总开关核对分项。
const { chromium } = require('playwright-core');
const fs = require('fs');
const KEY = 'ceo.audio.settings.v1';
const url = process.argv[2] || 'http://localhost:8123/';
const dir = process.argv[3] || 'evidence/test-v1.1/R5/audio';

(async () => {
  fs.mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  await page.addInitScript(() => {
    try {
      const k = 'ceo/privacy/consent';
      if (!window.localStorage.getItem(k)) {
        window.localStorage.setItem(
          k,
          JSON.stringify({ accepted: true, policyVersion: 1, acceptedAtMs: Date.now() }),
        );
      }
    } catch (e) {}
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  let c = null;
  let scale = 1;
  const tap = async (dx, dy, wait = 600) => {
    await page.mouse.click(c.x + c.w / 2 + dx * scale, c.y + c.h / 2 - dy * scale);
    await page.waitForTimeout(wait);
  };
  const readKey = () => page.evaluate((k) => window.localStorage.getItem(k), KEY);
  const shot = (n) => page.screenshot({ path: `${dir}/${n}.png` });

  const boot = async (clear) => {
    await page.goto(url, { waitUntil: 'load', timeout: 60000 });
    if (clear) await page.evaluate(() => { try { window.localStorage.clear(); } catch (_) {} });
    await page.reload({ waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(4000);
    const geom = await page.$$eval('canvas', (els) =>
      els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }));
    c = geom[0];
    scale = c.w / 375;
  };

  await boot(true);
  const keyInit = await readKey();

  // 向导 → 公司 → 设置
  await tap(0, -330);
  await tap(85, -300, 900);
  await tap(124, 164, 500);
  await tap(124, 46, 500);
  await tap(0, -360, 1500);
  await tap(0, -78, 800);
  await tap(145, 360, 700);
  await shot('audio-settings-before');
  const keyBefore = await readKey();

  // 关闭背景音乐（toggle 世界 y=56，右侧 x≈120）
  await tap(120, 56, 700);
  await shot('audio-settings-music-off');
  const keyMusicOff = await readKey();

  // 刷新页面（不清档）→ 重开设置
  await boot(false);
  await page.waitForTimeout(3000);
  await tap(145, 360, 900);
  await shot('audio-settings-after-reload');
  const keyAfterReload = await readKey();

  // 关闭总开关 → 再开回，核对分项保持（TC-070）
  await tap(120, 100, 600);
  const keyMasterOff = await readKey();
  await shot('audio-settings-master-off');
  await tap(120, 100, 600);
  const keyMasterOn = await readKey();
  await shot('audio-settings-master-on');

  const result = {
    errors: [...new Set(errors)],
    keyInit,
    keyBefore,
    keyMusicOff,
    keyAfterReload,
    keyMasterOff,
    keyMasterOn,
    checks: {
      musicOffPersisted: keyAfterReload === keyMusicOff,
      masterOffAllFalse: !!keyMasterOff && JSON.parse(keyMasterOff).musicEnabled === false,
      masterOnKeepsMusicOff: !!keyMasterOn && JSON.parse(keyMasterOn).musicEnabled === false,
    },
  };
  fs.writeFileSync(`${dir}/audio-persist-result.json`, JSON.stringify(result, null, 2), 'utf8');
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
