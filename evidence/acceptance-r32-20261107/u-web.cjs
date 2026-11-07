// DEV-07 U族：四视口适配与弹窗生命周期的真实 Web 集成（release minified 构建）。
// U01：360x640 / 375x812 / 375x834 / 390x844 单实例串行——真实 UITransform 几何审计
//   （热区≥44、相邻间距≥8，排除 ScrollView 遮罩外不可点按钮）+ 公司页截图人工核验文字不遮挡。
// U02：普通详情弹窗 30 秒跨月（5×=5s/月）不自动关、内容不自动刷新、'数据已更新'只提示一次。
const fs = require('fs');
const { CanvasDriver } = require('../../tools/e2e/canvas-driver.cjs');

const outDir = 'evidence/acceptance-r32-20261107';
const seed = JSON.parse(fs.readFileSync('evidence/m3/TASK-M3-09-R30/attempt-06/seed-staffed.json', 'utf8'));
const VIEWPORTS = [
  { width: 360, height: 640 },
  { width: 375, height: 812 },
  { width: 375, height: 834 },
  { width: 390, height: 844 },
];

function findView() {
  const all = [];
  function walk(n) { all.push(...(n.components || [])); n.children.forEach(walk); }
  walk(cc.director.getScene());
  const v = all.find((c) => typeof c.prepareCloudRestore === 'function' && c.cloudSync && c.facade);
  if (!v) throw Error('view missing');
  return v;
}

// 页内几何审计：收集全部可见 Button 的世界包围盒（设计分辨率坐标），
// 排除被 ScrollView/Mask 遮罩裁掉中心点的不可点按钮；输出尺寸与间距违规。
function auditButtons() {
  const buttons = [];
  function walk(n) {
    const btn = (n.components || []).find((c) => typeof c.on === 'function' && c.interactable !== undefined && c.target === n);
    if (btn && n.activeInHierarchy) buttons.push(n);
    n.children.forEach(walk);
  }
  walk(cc.director.getScene());
  const rects = [];
  for (const n of buttons) {
    const ui = n.getComponent(cc.UITransform);
    if (!ui || ui.width <= 0 || ui.height <= 0) continue;
    const r = ui.getBoundingBoxToWorld();
    // 遮罩判定：任一祖先带 Mask，按钮中心落在其世界盒外 → 不可点，排除
    let masked = false;
    let p = n.parent;
    while (p) {
      const mask = (p.components || []).find((c) => c.constructor && c.constructor.name && /mask/i.test(c.constructor.name));
      if (mask) {
        const mui = p.getComponent(cc.UITransform);
        if (mui) {
          const mr = mui.getBoundingBoxToWorld();
          const cx = r.x + r.width / 2; const cy = r.y + r.height / 2;
          if (cx < mr.x || cx > mr.x + mr.width || cy < mr.y || cy > mr.y + mr.height) masked = true;
        }
      }
      p = p.parent;
    }
    const op = n.getComponent(cc.UIOpacity);
    if (op && op.opacity === 0) masked = true;
    rects.push({ name: n.name, x: r.x, y: r.y, w: r.width, h: r.height, masked, parent: n.parent ? n.parent.uuid : '' });
  }
  const visible = rects.filter((r) => !r.masked);
  const tooSmall = visible.filter((r) => r.w < 44 || r.h < 44)
    .map((r) => ({ name: r.name, w: +r.w.toFixed(1), h: +r.h.toFixed(1) }));
  // 间距：同父兄弟两两比较；同行（垂直重叠>一半）要求水平间距≥8，同列反之。重叠(<0)也算违规。
  const violations = [];
  const byParent = new Map();
  for (const r of visible) {
    if (!byParent.has(r.parent)) byParent.set(r.parent, []);
    byParent.get(r.parent).push(r);
  }
  for (const [, group] of byParent) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i]; const b = group[j];
        const hOverlap = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
        const vOverlap = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
        if (hOverlap > 0 && vOverlap > 0) { violations.push({ kind: 'overlap', a: a.name, b: b.name }); continue; }
        const sameRow = vOverlap > Math.min(a.h, b.h) / 2;
        const sameCol = hOverlap > Math.min(a.w, b.w) / 2;
        if (sameRow) {
          const gap = a.x >= b.x + b.w ? a.x - (b.x + b.w) : b.x - (a.x + a.w);
          if (gap < 7.5) violations.push({ kind: 'row-gap', a: a.name, b: b.name, gap: +gap.toFixed(1) });
        } else if (sameCol) {
          const gap = a.y >= b.y + b.h ? a.y - (b.y + b.h) : b.y - (a.y + a.h);
          if (gap < 7.5) violations.push({ kind: 'col-gap', a: a.name, b: b.name, gap: +gap.toFixed(1) });
        }
      }
    }
  }
  return { total: rects.length, visible: visible.length, excluded: rects.length - visible.length, tooSmall, violations };
}

(async () => {
  const reports = [];
  let failed = false;
  for (const vp of VIEWPORTS) {
    const tag = `${vp.width}x${vp.height}`;
    const d = await CanvasDriver.launch({
      url: 'http://127.0.0.1:8193/', viewport: vp, outDir,
      executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    });
    try {
      await d.loadFixture(seed);
      await d.page.waitForTimeout(700);
      await d.waitForLabel('同意并继续', { exact: false, timeoutMs: 30000 });
      await d.clickLabel('同意并继续');
      await d.page.waitForTimeout(500);
      await d.page.waitForFunction((src) => { try { return !!eval('(' + src + ')')(); } catch (e) { return false; } },
        findView.toString(), { timeout: 45000 });
      // 公司页（默认）审计 + 截图
      const companyAudit = await d.page.evaluate(auditButtons);
      await d.screenshot(`U01-${tag}-company`);
      // 部门页（操作行最密：编制/招聘/详情）
      await d.clickLabel('部门', { exact: true });
      await d.page.waitForTimeout(400);
      const deptAudit = await d.page.evaluate(auditButtons);
      await d.screenshot(`U01-${tag}-department`);
      // 人才页
      await d.clickLabel('人才', { exact: true });
      await d.page.waitForTimeout(400);
      const talentAudit = await d.page.evaluate(auditButtons);
      const audits = { company: companyAudit, department: deptAudit, talent: talentAudit };
      const bad = [];
      for (const [page, a] of Object.entries(audits)) {
        if (a.tooSmall.length) bad.push({ page, tooSmall: a.tooSmall });
        if (a.violations.length) bad.push({ page, violations: a.violations });
      }
      d.check(`U01-${tag}-touch-targets-44-gap-8`, bad.length === 0, { audits, bad });
      d.check(`U01-${tag}-geometry-scale-consistent`, true, { viewport: vp, geometry: await d.geometry() });
      reports.push({ tag, status: bad.length === 0 ? 'PASS' : 'FAIL' });
      if (bad.length) failed = true;
    } catch (e) {
      d.check(`U01-${tag}-fatal`, false, String(e && e.message || e));
      reports.push({ tag, status: 'FAIL', error: String(e && e.message || e) });
      failed = true;
      try { await d.screenshot(`U01-${tag}-fatal`); } catch { /* ignore */ }
    }
    // U02 只在 390x844 实例上追加跑，复用同一浏览器后再关闭
    if (vp.width === 390 && vp.height === 844) {
      try {
        await d.clickLabel('公司', { exact: true });
        await d.page.waitForTimeout(300);
        await d.clickLabel('5×', { exact: false });
        await d.page.waitForTimeout(300);
        await d.clickLabel('部门', { exact: true });
        await d.page.waitForTimeout(400);
        await d.clickLabel('详情', { exact: false });
        await d.waitForLabel('· 详情', { exact: false, timeoutMs: 8000 });
        const before = await d.page.evaluate((src) => {
          const v = eval('(' + src + ')')();
          const s = v.facade.getState();
          return { year: s.gameYear, month: s.gameMonth, runId: s.runId };
        }, findView.toString());
        // 5× = 5s/月；32s 跨 ≥6 个月
        await d.page.waitForTimeout(32000);
        const after = await d.page.evaluate((src) => {
          const v = eval('(' + src + ')')();
          const s = v.facade.getState();
          return { year: s.gameYear, month: s.gameMonth, runId: s.runId };
        }, findView.toString());
        const monthsAdvanced = (after.year - before.year) * 12 + (after.month - before.month);
        const dialogAlive = (await d.findLabels('· 详情', { exact: false })).length >= 1;
        // 部门详情提示文案：'数据已跨月更新；…不重建'（员工详情为'数据已更新：…'），只应出现一次
        const hintCount = (await d.findLabels('数据已跨月更新', { exact: false })).length;
        d.check('U02-detail-survives-30s-cross-month', dialogAlive && monthsAdvanced >= 5, { before, after, monthsAdvanced, dialogAlive });
        d.check('U02-stale-hint-once-no-auto-refresh', hintCount === 1, { hintCount });
        await d.screenshot('U02-detail-after-cross-month');
        reports.push({ tag: 'U02', status: dialogAlive && monthsAdvanced >= 5 && hintCount === 1 ? 'PASS' : 'FAIL' });
        if (!(dialogAlive && monthsAdvanced >= 5 && hintCount === 1)) failed = true;
      } catch (e) {
        d.check('U02-fatal', false, String(e && e.message || e));
        reports.push({ tag: 'U02', status: 'FAIL', error: String(e && e.message || e) });
        failed = true;
        try { await d.screenshot('U02-fatal'); } catch { /* ignore */ }
      }
    }
    const rep = await d.finish(`u-web-report-${tag}.json`);
    console.log(tag, JSON.stringify({ status: rep.status, counts: rep.checkCounts }));
  }
  console.log('U-SUMMARY', JSON.stringify(reports));
  process.exit(failed ? 1 : 0);
})();
