// §29 体验修后回归：排行整行点击/无重叠、年报年份导航、音频资源索引与播放状态。
const fs = require('fs');
const path = require('path');
const { CanvasDriver } = require('./canvas-driver.cjs');

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortValue(value[key])]));
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

/** §29.12 起长公司名按列宽截断并补「…」，行定位改为匹配固定前缀。 */
const PLAYER_ROW_PREFIX = '我方 · ';

/** 只收集指定层内的文字：避免被弹窗遮住的页面文字造成“重叠”误报，也避开 Toast。 */
async function collectLabels(page, rootName) {
  return page.evaluate((name) => {
    let root = null;
    const findRoot = (node) => {
      if (node.name === name) { root = node; return; }
      node.children.forEach(findRoot);
    };
    findRoot(cc.director.getScene());
    if (!root) return [];
    const size = cc.winSize;
    const out = [];
    const walk = (node) => {
      if (!node.activeInHierarchy) return;
      const label = node.getComponent(cc.Label);
      const tr = node.getComponent(cc.UITransform) || node.getComponent(cc.UITransformComponent);
      if (label && label.string.trim() && tr) {
        const box = tr.getBoundingBoxToWorld();
        const inside = box.x + box.width > 0 && box.x < size.width && box.y + box.height > 76 && box.y < size.height - 4;
        if (inside && box.width > 0 && box.height > 0) {
          out.push({ text: label.string, x: box.x, y: box.y, w: box.width, h: box.height });
        }
      }
      node.children.forEach(walk);
    };
    walk(root);
    return out;
  }, rootName);
}

function findLabelOverlaps(labels) {
  const hits = [];
  for (let i = 0; i < labels.length; i += 1) {
    for (let j = i + 1; j < labels.length; j += 1) {
      const a = labels[i];
      const b = labels[j];
      const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      if (w > 2 && h > 2) hits.push({ a: a.text.slice(0, 24), b: b.text.slice(0, 24), overlapW: Math.round(w), overlapH: Math.round(h) });
    }
  }
  return hits;
}

(async () => {
  const outDir = process.argv[3] || 'evidence/acceptance-r36-experience-20261107/attempt-01';
  fs.mkdirSync(outDir, { recursive: true });
  const seed = JSON.parse(fs.readFileSync('evidence/m3/TASK-M3-09-R30/attempt-06/seed-staffed.json', 'utf8'));
  const pointer = JSON.parse(seed['ceo/save/active']);
  const slot = pointer.slot;
  const env = JSON.parse(seed[`ceo/save/${slot}`]);
  env.payload.gameYear = 3;
  env.payload.annualReports = [
    { year: 1, revenueYuan: 120000, directCostYuan: 40000, otherOperatingCostYuan: 20000, afterSalesCostYuan: 1000, fixedCostYuan: 12000, payrollYuan: 80000, recruitmentCostYuan: 5000, severanceCostYuan: 0, deptSetupCostYuan: 10000, eventCostYuan: 0, depreciationYuan: 0, profitYuan: -48000, cashOpenYuan: 500000, cashCloseYuan: 452000, assetCloseYuan: 10000, headcountClose: 6, settled: true },
    { year: 2, revenueYuan: 180000, directCostYuan: 60000, otherOperatingCostYuan: 25000, afterSalesCostYuan: 2000, fixedCostYuan: 12000, payrollYuan: 80000, recruitmentCostYuan: 0, severanceCostYuan: 0, deptSetupCostYuan: 0, eventCostYuan: 1000, depreciationYuan: 1000, profitYuan: -1000, cashOpenYuan: 452000, cashCloseYuan: 461000, assetCloseYuan: 9000, headcountClose: 6, settled: true, cashBridge: { monthlyLedgerNetCashDeltaYuan: 9000, investmentCashFlowYuan: 0, rescueCapitalYuan: 0, unattributedCashFlowYuan: 0, attributionComplete: true, balanced: true } },
  ];
  const { checksum: oldChecksum, ...rest } = env;
  const sealed = { ...rest, checksum: checksum(rest) };
  if (sealed.checksum === oldChecksum) throw new Error('fixture checksum unchanged');
  const fixture = { ...seed, [`ceo/save/${slot}`]: JSON.stringify(sealed), 'ceo/save/active': JSON.stringify({ ...pointer, revision: sealed.revision }) };

  const driver = await CanvasDriver.launch({
    url: process.argv[2] || 'http://127.0.0.1:8153/',
    viewport: { width: 375, height: 812 },
    outDir,
    executablePath: process.env.CHROME_EXE || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  });
  await driver.loadFixture(fixture);
  await driver.page.waitForTimeout(1800);
  // 冷启动隐私弹层：先完成一次真实点击同意，后续才能操作主界面。
  if ((await driver.findLabels('同意并继续')).length) {
    await driver.clickLabel('同意并继续');
    await driver.page.waitForTimeout(2600);
  }

  // ---------------- 排行页 ----------------
  await driver.waitForLabel('排行', { timeoutMs: 15_000 });
  await driver.clickLabel('排行');
  try {
    await driver.waitForLabel('本地模拟');
  } catch (error) {
    const labels = await collectLabels(driver.page, 'PageLayer');
    fs.writeFileSync(path.join(outDir, 'debug-after-rank.json'), JSON.stringify({ labels, errors: driver.errors }, null, 2));
    await driver.screenshot('debug-after-rank');
    throw error;
  }
  await driver.page.waitForTimeout(500);
  const rankLabels = await collectLabels(driver.page, 'PageLayer');
  fs.writeFileSync(path.join(outDir, 'rank-labels.json'), JSON.stringify(rankLabels, null, 2));
  const rankOverlaps = findLabelOverlaps(rankLabels);
  // §29.12：单行 CLAMP 文本超宽时必须带省略号，不能硬裁像素。
  const clippedTexts = await driver.page.evaluate(() => {
    let root = null;
    const findRoot = (node) => {
      if (node.name === 'PageLayer') { root = node; return; }
      node.children.forEach(findRoot);
    };
    findRoot(cc.director.getScene());
    const out = [];
    if (!root) return out;
    const clampMode = cc.Label.Overflow ? cc.Label.Overflow.CLAMP : 1;
    const ctx = document.createElement('canvas').getContext('2d');
    const walk = (node) => {
      if (!node.activeInHierarchy) return;
      const label = node.getComponent(cc.Label);
      const tr = node.getComponent(cc.UITransform) || node.getComponent(cc.UITransformComponent);
      if (label && label.string.trim() && tr && label.overflow === clampMode && !label.enableWrapText) {
        ctx.font = `${label.isBold ? 'bold ' : ''}${label.fontSize}px sans-serif`;
        const textWidth = ctx.measureText(label.string).width;
        if (textWidth > tr.width + 2 && !label.string.endsWith('…')) {
          out.push({ text: label.string, textWidth: Math.round(textWidth), boxWidth: Math.round(tr.width) });
        }
      }
      node.children.forEach(walk);
    };
    walk(root);
    return out;
  });
  driver.check('§29.12-text-ellipsis-when-clipped', clippedTexts.length === 0, clippedTexts);

  // §29.12：按钮文字超出按钮内宽会压到相邻控件；按钮内边距已算作余量。
  const buttonTextOverflow = await driver.page.evaluate(() => {
    let root = null;
    const findRoot = (node) => {
      if (node.name === 'PageLayer') { root = node; return; }
      node.children.forEach(findRoot);
    };
    findRoot(cc.director.getScene());
    const out = [];
    if (!root) return out;
    const ctx = document.createElement('canvas').getContext('2d');
    const walk = (node, buttonAncestor) => {
      if (!node.activeInHierarchy) return;
      const insideButton = node.getComponent(cc.Button) ? node : buttonAncestor;
      const label = node.getComponent(cc.Label);
      const tr = node.getComponent(cc.UITransform) || node.getComponent(cc.UITransformComponent);
      if (label && tr && insideButton && label.string.trim() && !label.enableWrapText) {
        ctx.font = `${label.isBold ? 'bold ' : ''}${label.fontSize}px sans-serif`;
        const textWidth = ctx.measureText(label.string).width;
        if (textWidth > tr.width + 8) {
          out.push({ text: label.string, textWidth: Math.round(textWidth), boxWidth: Math.round(tr.width) });
        }
      }
      node.children.forEach((child) => walk(child, insideButton));
    };
    walk(root, null);
    return out;
  });
  driver.check('§29.12-button-text-within-bounds', buttonTextOverflow.length === 0, buttonTextOverflow);

  driver.check('§29.4-rank-no-label-overlap', rankOverlaps.length === 0, rankOverlaps.slice(0, 8));
  await driver.screenshot('r36-rank-375x812');

  // 视觉尺寸与热区分离：分段按钮的 ButtonBg 应比 Button 根节点矮。
  const hitSplit = await driver.page.evaluate(() => {
    let root = null;
    const findRoot = (node) => {
      if (node.name === 'PageLayer') { root = node; return; }
      node.children.forEach(findRoot);
    };
    findRoot(cc.director.getScene());
    const found = [];
    if (!root) return found;
    const walk = (node) => {
      if (!node.activeInHierarchy) return;
      const tr = node.getComponent(cc.UITransform) || node.getComponent(cc.UITransformComponent);
      const bg = node.getChildByName('ButtonBg');
      if (tr && bg) {
        const bgTr = bg.getComponent(cc.UITransform) || bg.getComponent(cc.UITransformComponent);
        found.push({ node: node.name, hit: Math.round(tr.height), visual: Math.round(bgTr.height) });
      }
      node.children.forEach(walk);
    };
    walk(root);
    return found;
  });
  driver.check('§29.3-visual-smaller-than-hit-area', hitSplit.some((b) => b.visual < b.hit), hitSplit.slice(0, 10));
  fs.writeFileSync(path.join(outDir, 'button-hit-visual.json'), JSON.stringify(hitSplit, null, 2));

  // 整行点击：直接点玩家行文字（非“详情”按钮）应打开详情。
  await driver.clickLabel(PLAYER_ROW_PREFIX, { exact: false });
  await driver.waitForLabel('我方排行详情');
  await driver.screenshot('r36-rank-detail-375x812');
  const detailLabels = await collectLabels(driver.page, 'DialogScroll');
  driver.check('§29.4-rank-row-opens-detail', detailLabels.some((t) => t.text.startsWith('企业：')), detailLabels.filter((t) => /企业：|总资产：|经营年限：/.test(t.text)));
  await driver.clickLabel('关闭');
  await driver.page.waitForTimeout(300);

  // 定位我方：真实行应进入可视区中部附近。
  await driver.clickLabel('定位我方 ›');
  await driver.page.waitForTimeout(700);
  const geo = await driver.geometry();
  const playerRow = (await driver.findLabels(PLAYER_ROW_PREFIX, { exact: false }))[0];
  const inView = playerRow && playerRow.y > 100 && playerRow.y < geo.visibleH - 120;
  driver.check('§29.4-rank-locate-uses-real-row', Boolean(inView), { playerRow, visibleH: geo.visibleH });
  await driver.screenshot('r36-rank-located-375x812');

  // ---------------- 年报 ----------------
  await driver.clickLabel('公司');
  await driver.page.waitForTimeout(300);
  await driver.clickLabel('年度报告');
  await driver.waitForLabel('第 2 年财务报告');
  await driver.page.waitForTimeout(400);
  const reportLabels = await collectLabels(driver.page, 'DialogScroll');
  fs.writeFileSync(path.join(outDir, 'annual-labels.json'), JSON.stringify(reportLabels, null, 2));
  const reportOverlaps = findLabelOverlaps(reportLabels);
  driver.check('§29.5-annual-no-label-overlap', reportOverlaps.length === 0, reportOverlaps.slice(0, 8));
  driver.check('§29.5-year-only-in-title', !reportLabels.some((t) => t.text === '第 2 年'), reportLabels.filter((t) => t.text.includes('第 2 年')).map((t) => t.text));
  await driver.screenshot('r36-annual-375x812');
  await driver.clickLabel('‹ 较早年度');
  await driver.waitForLabel('第 1 年财务报告');
  await driver.page.waitForTimeout(300);
  await driver.screenshot('r36-annual-year1-375x812');
  await driver.clickLabel('较新年度 ›');
  await driver.waitForLabel('第 2 年财务报告');
  await driver.clickLabel('关闭');
  await driver.page.waitForTimeout(300);

  // ---------------- 360x640 小屏 ----------------
  await driver.page.setViewportSize({ width: 360, height: 640 });
  await driver.page.waitForTimeout(500);
  await driver.clickLabel('排行');
  await driver.page.waitForTimeout(400);
  const smallLabels = await collectLabels(driver.page, 'PageLayer');
  const smallOverlaps = findLabelOverlaps(smallLabels);
  driver.check('§29.8-small-viewport-rank-no-overlap', smallOverlaps.length === 0, smallOverlaps.slice(0, 8));
  await driver.screenshot('r36-rank-360x640');
  await driver.clickLabel('公司');
  await driver.page.waitForTimeout(300);
  await driver.clickLabel('年度报告');
  await driver.waitForLabel('第 2 年财务报告');
  await driver.page.waitForTimeout(300);
  await driver.screenshot('r36-annual-360x640');
  await driver.clickLabel('关闭');
  await driver.page.waitForTimeout(400);

  // ---------------- 四主页面巡检截图（§29.8 第 3 项） ----------------
  await driver.page.setViewportSize({ width: 375, height: 812 });
  await driver.page.waitForTimeout(500);
  for (const [tab, file] of [['公司', 'r36-company-375x812'], ['部门', 'r36-department-375x812'], ['人才', 'r36-talent-375x812']]) {
    await driver.clickLabel(tab);
    await driver.page.waitForTimeout(400);
    await driver.screenshot(file);
  }
  await driver.clickLabel('公司');
  await driver.page.waitForTimeout(300);
  await driver.clickLabel('设置');
  await driver.page.waitForTimeout(600);
  await driver.screenshot('r36-settings-375x812');

  // ---------------- 音频 ----------------
  const audioFiles = [];
  const audioRoot = path.join('build', 'web-mobile', 'assets', 'resources');
  const walkFs = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walkFs(full);
      else if (entry.name.endsWith('.mp3')) audioFiles.push(full);
    }
  };
  walkFs(audioRoot);
  driver.check('§29.7-audio-assets-in-build', audioFiles.length > 0, audioFiles);

  const audioState = await driver.page.evaluate(() => {
    // 与 UITransform 同类问题：release 构建可能改名导出，失败时按 duck-typing 兜底。
    const AudioSourceType = cc.AudioSource || cc.AudioSourceComponent || null;
    const sources = [];
    const audioNodes = [];
    const walk = (node) => {
      if (!node.activeInHierarchy) return;
      const comps = node.components || [];
      if (/audio/i.test(node.name)) {
        audioNodes.push({ node: node.name, components: comps.map((c) => c?.constructor?.name ?? 'unknown') });
      }
      const source = AudioSourceType
        ? node.getComponent(AudioSourceType)
        : comps.find((c) => c && typeof c.playOneShot === 'function' && 'clip' in c);
      if (source) sources.push({ node: node.name, clip: source.clip?.name ?? null, playing: source.playing, loop: source.loop, volume: source.volume });
      node.children.forEach(walk);
    };
    walk(cc.director.getScene());
    return { audioSourceExport: Boolean(AudioSourceType), audioNodes, sources };
  });
  fs.writeFileSync(path.join(outDir, 'audio-state.json'), JSON.stringify({ audioFiles, audioState, console: driver.errors.filter((e) => /audio/i.test(e.url || e.message || '')) }, null, 2));
  driver.record('§29.7-audio-loaded-or-blocked',
    audioState.sources.some((s) => s.clip) ? 'PASS' : 'BLOCKED',
    audioState);
  driver.check('§29.7-no-audio-http-failures', !driver.errors.some((e) => /audio\/|\.mp3/i.test(e.url || '')), driver.errors);

  const report = await driver.finish('r36-report.json');
  console.log(JSON.stringify(report, null, 2));
  if (report.status !== 'PASS') process.exitCode = 1;
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
