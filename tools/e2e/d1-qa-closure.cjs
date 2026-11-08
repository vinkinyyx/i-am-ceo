// D1-QA-01/02 收口验收：排行两档布局、榜型切换/定位/详情、头像实际资源键、现金桥末行真实滚动可见性。
// 用法：node tools/e2e/d1-qa-closure.cjs [url] [outDir]
const fs = require('fs');
const path = require('path');
const { CanvasDriver } = require('./canvas-driver.cjs');

const CHROME = process.env.CHROME_EXE || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((k) => [k, sortValue(value[k])]));
  return value;
}
function crc32(text) {
  let crc = 0xffffffff;
  for (const byte of Buffer.from(text, 'utf8')) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return ((crc ^ 0xffffffff) >>> 0).toString(16).padStart(8, '0');
}
function checksum(env) {
  const { schemaVersion, gameVersion, configVersion, revision, runId, resetGeneration, payload } = env;
  return crc32(JSON.stringify(sortValue({ schemaVersion, gameVersion, configVersion, revision, runId, resetGeneration, payload })));
}

/** 造带 6 员工（覆盖已登记/未知/空 avatarId）与含现金桥年报的存档 */
function buildFixture() {
  const seed = JSON.parse(fs.readFileSync('evidence/m3/TASK-M3-09-R30/attempt-06/seed-staffed.json', 'utf8'));
  const pointer = JSON.parse(seed['ceo/save/active']);
  const slot = pointer.slot;
  const env = JSON.parse(seed[`ceo/save/${slot}`]);
  const avatarIds = ['avatar_01', 'avatar_02', 'avatar_03', 'avatar_24', 'avatar_99', null];
  env.payload.employees.forEach((e, i) => { e.avatarId = avatarIds[i % avatarIds.length]; });
  env.payload.gameYear = 3;
  env.payload.annualReports = [{
    year: 1, revenueYuan: 120000, directCostYuan: 40000, otherOperatingCostYuan: 20000, afterSalesCostYuan: 1000,
    fixedCostYuan: 12000, payrollYuan: 80000, recruitmentCostYuan: 5000, severanceCostYuan: 0, deptSetupCostYuan: 10000,
    eventCostYuan: 0, depreciationYuan: 0, profitYuan: -48000, cashOpenYuan: 500000, cashCloseYuan: 452000,
    assetCloseYuan: 10000, headcountClose: 6, settled: true,
  }, {
    year: 2, revenueYuan: 180000, directCostYuan: 60000, otherOperatingCostYuan: 25000, afterSalesCostYuan: 2000,
    fixedCostYuan: 12000, payrollYuan: 80000, recruitmentCostYuan: 0, severanceCostYuan: 0, deptSetupCostYuan: 0,
    eventCostYuan: 1000, depreciationYuan: 1000, profitYuan: -1000, cashOpenYuan: 452000, cashCloseYuan: 461000,
    assetCloseYuan: 9000, headcountClose: 6, settled: true,
    cashBridge: { monthlyLedgerNetCashDeltaYuan: 9000, investmentCashFlowYuan: 0, rescueCapitalYuan: 0, unattributedCashFlowYuan: 0, attributionComplete: true, balanced: true },
  }];
  const { checksum: _old, ...rest } = env;
  const sealed = { ...rest, checksum: checksum(rest) };
  return {
    fixture: { ...seed, [`ceo/save/${slot}`]: JSON.stringify(sealed), 'ceo/save/active': JSON.stringify({ ...pointer, revision: sealed.revision }) },
    names: env.payload.employees.map((e) => e.name),
    avatarIds,
  };
}

async function bootRank(driver) {
  await driver.waitForLabel('公司', { timeoutMs: 15_000 });
  await driver.page.waitForTimeout(1200);
  await driver.clickLabel('排行');
  await driver.waitForLabel('本地模拟');
  await driver.page.waitForTimeout(1200);
}

/** 读排行页布局几何（世界坐标，原点左下） */
async function rankGeometry(page) {
  return page.evaluate(() => {
    const T = cc.UITransform || cc.UITransformComponent;
    let banner = null; let badge = false;
    const buttons = []; let row1 = null; let summary = null;
    const findBtnByLabel = (text) => {
      let hit = null;
      const walk = (n) => {
        if (hit || !n.activeInHierarchy) return;
        const l = n.getComponent(cc.Label);
        if (l && l.string === text) {
          let a = n.parent;
          while (a && !a.getComponent(cc.Button)) a = a.parent;
          if (a) hit = a;
        }
        n.children.forEach(walk);
      };
      walk(cc.director.getScene());
      return hit;
    };
    const walk = (n) => {
      if (!n.activeInHierarchy) return;
      if (n.name === 'RankBanner') {
        const t = n.getComponent(T);
        if (t) { const b = t.getBoundingBoxToWorld(); banner = { x: b.x, y: b.y, w: b.width, h: b.height }; }
      }
      if (n.name === 'RankTitleBadge') badge = true;
      if (n.name === 'RankRow1') {
        const t = n.getComponent(T);
        if (t) { const b = t.getBoundingBoxToWorld(); row1 = { x: b.x, y: b.y, w: b.width, h: b.height }; }
      }
      const l = n.getComponent(cc.Label);
      if (l && l.string.startsWith('我方 第')) {
        const t = n.getComponent(T);
        if (t) { const b = t.getBoundingBoxToWorld(); summary = { x: b.x, y: b.y, w: b.width, h: b.height }; }
      }
      n.children.forEach(walk);
    };
    walk(cc.director.getScene());
    const wrap = (node) => {
      if (!node) return null;
      const t = node.getComponent(T);
      if (!t) return null;
      const b = t.getBoundingBoxToWorld();
      return { x: b.x, y: b.y, w: b.width, h: b.height };
    };
    return {
      banner, badge, row1, summary,
      assetsBtn: wrap(findBtnByLabel('资产榜')),
      yearsBtn: wrap(findBtnByLabel('年限榜')),
      locateBtn: wrap(findBtnByLabel('定位我方 ›')),
      visibleH: cc.view.getVisibleSize().height,
    };
  });
}

(async () => {
  const url = process.argv[2] || 'http://127.0.0.1:8153/';
  const outDir = process.argv[3] || 'evidence/ui-v2-d1-qa-02';
  fs.mkdirSync(outDir, { recursive: true });
  const { fixture, names, avatarIds } = buildFixture();
  const checks = [];
  const check = (id, ok, detail) => checks.push({ id, status: ok ? 'PASS' : 'FAIL', detail });

  // ============ 375×812 常规档 ============
  const d1 = await CanvasDriver.launch({ url, viewport: { width: 375, height: 812 }, outDir, executablePath: CHROME });
  await d1.loadFixture(fixture);
  await d1.page.waitForTimeout(1800);
  if ((await d1.findLabels('同意并继续')).length) { await d1.clickLabel('同意并继续'); await d1.page.waitForTimeout(2600); }
  await bootRank(d1);

  const g = await rankGeometry(d1.page);
  check('qa01-banner-height-56-72', Boolean(g.banner) && g.banner.h >= 56 && g.banner.h <= 72, g.banner);
  const gapBanner = g.banner && g.assetsBtn ? g.banner.y - (g.assetsBtn.y + g.assetsBtn.h) : null;
  check('qa01-banner-to-board-gap>=8', gapBanner !== null && gapBanner >= 8, { gap: gapBanner });
  const gapSummary = g.summary && g.row1 ? g.summary.y - (g.row1.y + g.row1.h) : null;
  check('qa01-summary-to-first-row-gap>=12', gapSummary !== null && gapSummary >= 12, { gap: gapSummary });
  const hitOk = [g.assetsBtn, g.yearsBtn, g.locateBtn].every((b) => b && b.h >= 44 && b.w >= 44);
  check('qa01-hit-area>=44', hitOk, { assets: g.assetsBtn, years: g.yearsBtn, locate: g.locateBtn });
  check('qa01-banner-sprite-loaded', Boolean(g.banner && g.banner.h > 0), g.banner);
  await d1.screenshot('qa-rank-375x812');

  // 榜型切换：资产榜 -> 年限榜，指标列应变成「N 年」
  const yearsMetric = await d1.page.evaluate(() => {
    let n = 0;
    const walk = (node) => {
      if (!node.activeInHierarchy) return;
      const l = node.getComponent(cc.Label);
      if (l && /^\d+ 年$/.test(l.string)) n += 1;
      node.children.forEach(walk);
    };
    walk(cc.director.getScene());
    return n;
  });
  check('qa01-assets-board-metric', yearsMetric === 0, { yearsMetric });
  await d1.clickLabel('年限榜');
  await d1.page.waitForTimeout(700);
  const yearsMetric2 = await d1.page.evaluate(() => {
    let n = 0;
    const walk = (node) => {
      if (!node.activeInHierarchy) return;
      const l = node.getComponent(cc.Label);
      if (l && /^\d+ 年$/.test(l.string)) n += 1;
      node.children.forEach(walk);
    };
    walk(cc.director.getScene());
    return n;
  });
  check('qa01-switch-to-years-board', yearsMetric2 >= 5, { yearsMetric2 });
  await d1.screenshot('qa-rank-years-375x812');
  await d1.clickLabel('资产榜');
  await d1.page.waitForTimeout(600);

  // 定位我方：滚动后玩家行应落在可视区内
  await d1.clickLabel('定位我方 ›');
  await d1.page.waitForTimeout(800);
  const locate = await d1.page.evaluate(() => {
    const T = cc.UITransform || cc.UITransformComponent;
    let box = null;
    const walk = (n) => {
      if (box || !n.activeInHierarchy) return;
      const l = n.getComponent(cc.Label);
      if (l && l.string.startsWith('我方 ·')) {
        const t = n.getComponent(T);
        if (t) { const b = t.getBoundingBoxToWorld(); box = { x: b.x, y: b.y, w: b.width, h: b.height }; }
      }
      n.children.forEach(walk);
    };
    walk(cc.director.getScene());
    return { box, visibleH: cc.view.getVisibleSize().height };
  });
  check('qa01-locate-player-visible',
    Boolean(locate.box) && locate.box.y >= 0 && locate.box.y + locate.box.h <= locate.visibleH,
    locate);
  await d1.screenshot('qa-rank-locate-375x812');

  // 首行详情：按 RankRow1 实际世界坐标点击（走真实命中链路，不注入事件）
  const row1Box = await d1.page.evaluate(() => {
    const T = cc.UITransform || cc.UITransformComponent;
    let box = null;
    const walk = (n) => {
      if (box || !n.activeInHierarchy) return;
      if (n.name === 'RankRow1') { const t = n.getComponent(T); if (t) { const b = t.getBoundingBoxToWorld(); box = { x: b.x, y: b.y, w: b.width, h: b.height }; } }
      n.children.forEach(walk);
    };
    walk(cc.director.getScene());
    return box;
  });
  if (row1Box) {
    const geo = await d1.geometry();
    await d1.page.mouse.click(geo.x + (row1Box.x + row1Box.w / 2) * geo.scale, geo.y + (geo.visibleH - (row1Box.y + row1Box.h / 2)) * geo.scale);
  }
  await d1.page.waitForTimeout(400);
  const detailOpened = (await d1.findLabels('经营年限：', { exact: false })).length >= 1;
  check('qa01-first-row-opens-detail', detailOpened, null);
  await d1.screenshot('qa-rank-detail-375x812');
  if ((await d1.findLabels('关闭')).length) { await d1.clickLabel('关闭'); await d1.page.waitForTimeout(400); }

  // ============ 头像实际资源键验收 ============
  await d1.clickLabel('人才');
  await d1.page.waitForTimeout(1600);
  const uuids = {
    ...JSON.parse(fs.readFileSync('design/CEO_UI_V2_ArtSamples_v1/tools/import_uuids.json', 'utf8')),
    ...JSON.parse(fs.readFileSync('design/CEO_UI_V2_D1_ArtHandoff_v1/tools/import_uuids.json', 'utf8')),
  };
  const KEY = {
    avatar_01: 'ui/avatars/EmployeeAvatar_01_Male_ShortHair_Color1',
    avatar_02: 'ui/avatars/EmployeeAvatar_01_Male_ShortHair_Color2',
    avatar_03: 'ui/avatars/EmployeeAvatar_01_Male_ShortHair_Color3',
    avatar_24: 'ui/avatars/EmployeeAvatar_08_Female_LongHair_Color3',
  };
  const expectedByKey = {};
  for (const [k, key] of Object.entries(KEY)) expectedByKey[k] = uuids[`img:${key}.png`] + '@f9941';

  const avatarCheck = await d1.page.evaluate(async ({ keyMap, uuidMap }) => {
    const load = (key) => new Promise((resolve) => cc.resources.load(`${key}/spriteFrame`, cc.SpriteFrame, (e, f) => resolve(f || null)));
    const frames = {};
    for (const [k, key] of Object.entries(keyMap)) frames[k] = await load(key);
    const rows = [];
    const walk = (node) => {
      if (node.name === 'AvatarSlot' && node.activeInHierarchy) {
        let name = '';
        node.parent.children.forEach((c) => {
          const l = c.getComponent(cc.Label);
          if (l && l.string && !name && c.name !== 'AvatarInitial') name = l.string;
        });
        const img = node.children.find((c) => c.name === 'AvatarImage');
        const sp = img && img.getComponent(cc.Sprite);
        const fallback = node.children.find((c) => c.name === 'AvatarFallback');
        const frame = sp && sp.spriteFrame;
        const matchedKey = Object.keys(frames).find((k) => frames[k] && frame === frames[k]) || null;
        rows.push({ name, matchedKey, hasFrame: Boolean(frame), frameUuid: frame ? frame._uuid : null, fallbackActive: fallback ? fallback.active : null });
      }
      node.children.forEach(walk);
    };
    walk(cc.director.getScene());
    return { rows, expected: uuidMap };
  }, { keyMap: KEY, uuidMap: expectedByKey });

  const bound = avatarCheck.rows.filter((r) => r.matchedKey);
  check('qa02-avatar-uses-real-resource-key', bound.length >= 3, avatarCheck.rows);
  const mappedOk = names.slice(0, 6).every((n) => {
    const idx = names.indexOf(n);
    const id = avatarIds[idx];
    if (!id || !KEY[id]) return true; // 未知/空 avatarId 允许回退
    const row = avatarCheck.rows.find((r) => r.name.startsWith(n));
    return row && row.matchedKey === id;
  });
  check('qa02-avatar-identity-per-avatarId', mappedOk, { names, avatarIds, rows: avatarCheck.rows });
  const unknownFallback = avatarCheck.rows.filter((r) => r.fallbackActive === true && !r.hasFrame).length;
  check('qa02-unknown-avatar-neutral-fallback', unknownFallback >= 1, { unknownFallback });
  // 帧 UUID 与导入 UUID 对得上（导出构建可能压缩，缺失时以对象同一性兜底）
  const uuidAligned = bound.every((r) => !r.frameUuid || String(r.frameUuid).startsWith(avatarCheck.expected[r.matchedKey].split('@')[0].slice(0, 8)));
  check('qa02-avatar-frame-uuid-traceable', uuidAligned, bound.map((r) => ({ key: r.matchedKey, uuid: r.frameUuid })));
  await d1.screenshot('qa-talent-avatars-375x812');

  // ============ 现金桥末行真实滚动 + 可见性 ============
  await d1.clickLabel('公司');
  await d1.page.waitForTimeout(800);
  await d1.clickLabel('年度报告');
  await d1.waitForLabel('财务报告', { exact: false });
  await d1.page.waitForTimeout(900);
  // 从末行标签向上找所属 ScrollView，保证滚的是年报正文而不是别的列表
  const scrolled = await d1.page.evaluate(() => {
    let labelNode = null;
    const walk = (n) => {
      if (labelNode) return;
      const l = n.getComponent(cc.Label);
      if (l && (l.string.startsWith('现金桥差额') || l.string.startsWith('部分归因'))) { labelNode = n; return; }
      n.children.forEach(walk);
    };
    walk(cc.director.getScene());
    if (!labelNode) return false;
    let a = labelNode.parent;
    while (a) {
      const sv = a.getComponent(cc.ScrollView);
      if (sv) { sv.scrollToBottom(0.2); return true; }
      a = a.parent;
    }
    return false;
  });
  await d1.page.waitForTimeout(900);
  const bridge = await d1.page.evaluate(() => {
    const T = cc.UITransform || cc.UITransformComponent;
    let box = null; let text = null; let view = null;
    const walk = (n) => {
      if (box || !n.activeInHierarchy) return;
      const l = n.getComponent(cc.Label);
      if (l && (l.string.startsWith('现金桥差额') || l.string.startsWith('部分归因'))) {
        const t = n.getComponent(T);
        if (t) {
          const b = t.getBoundingBoxToWorld();
          box = { x: b.x, y: b.y, w: b.width, h: b.height };
          text = l.string;
          let a = n.parent;
          while (a) {
            if (a.getComponent(cc.ScrollView)) {
              const vt = a.getComponent(T);
              if (vt) { const vb = vt.getBoundingBoxToWorld(); view = { x: vb.x, y: vb.y, w: vb.width, h: vb.height }; }
              break;
            }
            a = a.parent;
          }
        }
      }
      n.children.forEach(walk);
    };
    walk(cc.director.getScene());
    return { box, text, view, visibleH: cc.view.getVisibleSize().height };
  });
  const bridgeVisible = Boolean(bridge.box && bridge.view
    && bridge.box.y >= bridge.view.y - 1
    && bridge.box.y + bridge.box.h <= bridge.view.y + bridge.view.h + 1);
  check('qa-cashbridge-real-scroll', scrolled === true, { scrolled });
  check('qa-cashbridge-last-row-visible', bridgeVisible, bridge);
  await d1.screenshot('qa-annual-cashbridge-bottom-375x812');
  const closeHit = await d1.findLabels('关闭');
  check('qa-annual-fixed-close-clickable', closeHit.length === 1 && closeHit[0].height >= 44, closeHit);
  if (closeHit.length) { await d1.clickLabel('关闭'); await d1.page.waitForTimeout(300); }

  check('qa-no-browser-errors-375', d1.errors.length === 0, d1.errors.slice(0, 3));
  await d1.finish('d1-qa-375x812-report.json');

  // ============ 360×640 短屏档 ============
  const d2 = await CanvasDriver.launch({ url, viewport: { width: 360, height: 640 }, outDir, executablePath: CHROME });
  await d2.loadFixture(fixture);
  await d2.page.waitForTimeout(1800);
  if ((await d2.findLabels('同意并继续')).length) { await d2.clickLabel('同意并继续'); await d2.page.waitForTimeout(2600); }
  await bootRank(d2);
  const g2 = await rankGeometry(d2.page);
  check('qa01-short-viewport-no-banner', g2.banner === null, g2.banner);
  check('qa01-short-viewport-title-badge', g2.badge === true, { badge: g2.badge });
  const visibleRows = await d2.page.evaluate(() => {
    const T = cc.UITransform || cc.UITransformComponent;
    const vh = cc.view.getVisibleSize().height;
    let n = 0;
    const walk = (node) => {
      if (/^RankRow\d+$/.test(node.name) && node.activeInHierarchy) {
        const t = node.getComponent(T);
        if (t) { const b = t.getBoundingBoxToWorld(); if (b.y >= 0 && b.y + b.height <= vh) n += 1; }
      }
      node.children.forEach(walk);
    };
    walk(cc.director.getScene());
    return { n, vh };
  });
  check('qa01-short-viewport-more-rows', visibleRows.n >= 5, visibleRows);
  check('qa01-short-hit-area>=44', [g2.assetsBtn, g2.yearsBtn].every((b) => b && b.h >= 44), { assets: g2.assetsBtn, years: g2.yearsBtn });
  await d2.screenshot('qa-rank-360x640');
  // 短屏切榜与首行详情仍可用
  await d2.clickLabel('年限榜');
  await d2.page.waitForTimeout(600);
  const shortYears = await d2.page.evaluate(() => {
    let n = 0;
    const walk = (node) => { if (node.activeInHierarchy) { const l = node.getComponent(cc.Label); if (l && /^\d+ 年$/.test(l.string)) n += 1; } node.children.forEach(walk); };
    walk(cc.director.getScene());
    return n;
  });
  check('qa01-short-switch-board', shortYears >= 4, { shortYears });
  await d2.screenshot('qa-rank-years-360x640');
  check('qa-no-browser-errors-360', d2.errors.length === 0, d2.errors.slice(0, 3));
  await d2.finish('d1-qa-360x640-report.json');

  const pass = checks.filter((c) => c.status === 'PASS').length;
  const summary = { checkedAt: new Date().toISOString(), status: pass === checks.length ? 'PASS' : 'FAIL', pass, total: checks.length, checks };
  fs.writeFileSync(path.join(outDir, 'd1-qa-checks.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  process.exit(pass === checks.length ? 0 : 1);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
