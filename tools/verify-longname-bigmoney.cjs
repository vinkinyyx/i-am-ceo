// TC-068：超长公司名（20 字）+ 千亿现金存档夹具，核对公司页/排行/人才/年报显示。
// 做法：正常开一局 → 读取存档 → 改 payload（名称/现金）→ 重算 checksum 写回 → 重新加载截图。
const fs = require('fs');
const { chromium } = require('playwright-core');

const url = process.argv[2] || 'http://localhost:8123/';
const dir = process.argv[3] || 'evidence/test-v1.1/R6/tc068-longname';

const LONG_NAME = '江南智造数字科技产业发展集团有限责任公司'; // 20 字
const BIG_CASH = 100000000000; // 1000 亿（100b）

// ---- 与 assets/core/persistence/canonical.ts + crc32.ts 等价 ----
function sortValue(v) {
  if (Array.isArray(v)) return v.map(sortValue);
  if (v !== null && typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = sortValue(v[k]);
    return out;
  }
  return v;
}
const canonicalStringify = (v) => JSON.stringify(sortValue(v));

const TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32String(text) {
  const bytes = new TextEncoder().encode(text);
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return ((crc ^ 0xffffffff) >>> 0).toString(16).padStart(8, '0');
}
function computeChecksum(e) {
  return crc32String(
    canonicalStringify({
      schemaVersion: e.schemaVersion,
      gameVersion: e.gameVersion,
      configVersion: e.configVersion,
      revision: e.revision,
      runId: e.runId,
      resetGeneration: e.resetGeneration,
      payload: e.payload,
    }),
  );
}

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

  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  await page.evaluate(() => { try { window.localStorage.clear(); } catch (_) {} });
  await page.reload({ waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(4000);

  const geom = await page.$$eval('canvas', (els) =>
    els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }));
  const c = geom[0];
  const scale = c.w / 375;
  const tap = async (dx, dy, wait = 600) => {
    await page.mouse.click(c.x + c.w / 2 + dx * scale, c.y + c.h / 2 - dy * scale);
    await page.waitForTimeout(wait);
  };
  const shot = (n) => page.screenshot({ path: `${dir}/${n}.png` });

  // 向导 → 公司页
  await tap(0, -330);
  await tap(85, -300, 900);
  await tap(124, 164, 500);
  await tap(124, 46, 500);
  await tap(0, -360, 1500);
  await tap(0, -78, 800);

  // 读取活动存档槽
  const raw = await page.evaluate(() => {
    const ptr = window.localStorage.getItem('ceo/save/active');
    return {
      ptr,
      a: window.localStorage.getItem('ceo/save/a'),
      b: window.localStorage.getItem('ceo/save/b'),
    };
  });
  const pointer = raw.ptr ? JSON.parse(raw.ptr) : null;
  const slot = pointer && pointer.slot === 'b' ? 'b' : 'a';
  const envelope = JSON.parse(raw[slot]);

  const before = { name: envelope.payload.company.name, cash: envelope.payload.company.cashYuan };
  envelope.payload.company.name = LONG_NAME;
  envelope.payload.company.cashYuan = BIG_CASH;
  envelope.checksum = computeChecksum(envelope);
  await page.evaluate(
    ({ key, value }) => { window.localStorage.setItem(key, value); },
    { key: `ceo/save/${slot}`, value: JSON.stringify(envelope) },
  );

  await page.reload({ waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(4500);

  await shot('tc068-company');
  await tap(141, -372, 900); // 排行
  await shot('tc068-rank');
  await tap(47, -372, 900); // 人才
  await shot('tc068-talent');
  await tap(83, 66, 900); // 公司页 → 年度报告（世界 y≈66）
  await shot('tc068-annual-empty');

  const after = await page.evaluate(() => {
    const raw = window.localStorage.getItem('ceo/save/a') || window.localStorage.getItem('ceo/save/b');
    const e = JSON.parse(raw);
    return { name: e.payload.company.name, cash: e.payload.company.cashYuan, checksum: e.checksum };
  });

  const result = {
    longNameChars: [...LONG_NAME].length,
    before,
    after,
    checks: {
      name20: [...after.name].length === 20,
      cash100b: after.cash === BIG_CASH,
      checksumStable: after.checksum === envelope.checksum,
    },
    dir,
    errors: [...new Set(errors)].slice(0, 10),
  };
  fs.writeFileSync(`${dir}/tc068-result.json`, JSON.stringify(result, null, 2), 'utf8');
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
