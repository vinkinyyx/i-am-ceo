// §30.5 UI V2 D1 专项实操：六处界面截图 + 招聘三候选/费用确认 + 头像一致性/回退 + 异步错图回退。
// 用法：node tools/e2e/d1-visual-audit.cjs [url] [outDir]
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

/** 读取装饰/头像节点状态：节点名 -> { hasFrame, fallbackActive } */
async function inspectNodes(page, names) {
  return page.evaluate((wanted) => {
    const out = {};
    const walk = (node) => {
      if (wanted.includes(node.name)) {
        const sprite = node.getComponent(cc.Sprite);
        const entry = { activeInHierarchy: node.activeInHierarchy, hasFrame: Boolean(sprite && sprite.spriteFrame) };
        const fallback = node.children.find((c) => c.name === 'AvatarFallback');
        if (fallback) entry.fallbackActive = fallback.active;
        const img = node.children.find((c) => c.name === 'AvatarImage');
        if (img) {
          const s = img.getComponent(cc.Sprite);
          entry.imageHasFrame = Boolean(s && s.spriteFrame);
        }
        if (!out[node.name]) out[node.name] = [];
        out[node.name].push(entry);
      }
      node.children.forEach(walk);
    };
    walk(cc.director.getScene());
    return out;
  }, names);
}

/** 人才页头像一致性采样：每个 AvatarSlot 对应同行员工名与头像状态 */
async function sampleTalentAvatars(page) {
  return page.evaluate(() => {
    const rows = [];
    const walk = (node) => {
      if (node.name === 'AvatarSlot' && node.activeInHierarchy) {
        const parentRow = node.parent;
        let empName = null;
        parentRow.children.forEach((c) => {
          const label = c.getComponent(cc.Label);
          if (label && label.string && !empName && c.name !== 'AvatarInitial') empName = label.string;
        });
        const fallback = node.children.find((c) => c.name === 'AvatarFallback');
        const img = node.children.find((c) => c.name === 'AvatarImage');
        const s = img && img.getComponent(cc.Sprite);
        rows.push({ empName, fallbackActive: fallback ? fallback.active : null, imageHasFrame: Boolean(s && s.spriteFrame) });
      }
      node.children.forEach(walk);
    };
    walk(cc.director.getScene());
    return rows;
  });
}

(async () => {
  const outDir = process.argv[3] || 'build/logs/browser/ui-v2-d1-20261108/visual-audit';
  fs.mkdirSync(outDir, { recursive: true });
  const url = process.argv[2] || 'http://127.0.0.1:8153/';

  // fixture：6 名员工覆盖 已登记头像×4 + 未知ID×1 + 无ID×1
  const seed = JSON.parse(fs.readFileSync('tests/fixtures/browser/seed-staffed.json', 'utf8'));
  const pointer = JSON.parse(seed['ceo/save/active']);
  const slot = pointer.slot;
  const env = JSON.parse(seed[`ceo/save/${slot}`]);
  const avatarIds = ['avatar_01', 'avatar_02', 'avatar_03', 'avatar_24', 'avatar_99', null];
  env.payload.employees.forEach((e, i) => { e.avatarId = avatarIds[i % avatarIds.length]; });
  env.payload.gameYear = 3;
  env.payload.annualReports = [
    { year: 1, revenueYuan: 120000, directCostYuan: 40000, otherOperatingCostYuan: 20000, afterSalesCostYuan: 1000, fixedCostYuan: 12000, payrollYuan: 80000, recruitmentCostYuan: 5000, severanceCostYuan: 0, deptSetupCostYuan: 10000, eventCostYuan: 0, depreciationYuan: 0, profitYuan: -48000, cashOpenYuan: 500000, cashCloseYuan: 452000, assetCloseYuan: 10000, headcountClose: 6, settled: true },
    { year: 2, revenueYuan: 180000, directCostYuan: 60000, otherOperatingCostYuan: 25000, afterSalesCostYuan: 2000, fixedCostYuan: 12000, payrollYuan: 80000, recruitmentCostYuan: 0, severanceCostYuan: 0, deptSetupCostYuan: 0, eventCostYuan: 1000, depreciationYuan: 1000, profitYuan: -1000, cashOpenYuan: 452000, cashCloseYuan: 461000, assetCloseYuan: 9000, headcountClose: 6, settled: true, cashBridge: { monthlyLedgerNetCashDeltaYuan: 9000, investmentCashFlowYuan: 0, rescueCapitalYuan: 0, unattributedCashFlowYuan: 0, attributionComplete: true, balanced: true } },
  ];
  const { checksum: oldChecksum, ...rest } = env;
  const sealed = { ...rest, checksum: checksum(rest) };
  const fixture = { ...seed, [`ceo/save/${slot}`]: JSON.stringify(sealed), 'ceo/save/active': JSON.stringify({ ...pointer, revision: sealed.revision }) };

  const checks = [];
  const check = (id, ok, detail) => { checks.push({ id, status: ok ? 'PASS' : 'FAIL', detail }); };

  const driver = await CanvasDriver.launch({
    url,
    viewport: { width: 375, height: 812 },
    outDir,
    executablePath: process.env.CHROME_EXE || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  });
  await driver.loadFixture(fixture);
  await driver.page.waitForTimeout(1800);
  if ((await driver.findLabels('同意并继续')).length) {
    await driver.clickLabel('同意并继续');
    await driver.page.waitForTimeout(2600);
  }

  // ---------------- UI-05 公司页 ----------------
  await driver.waitForLabel('公司', { timeoutMs: 15_000 });
  await driver.page.waitForTimeout(1200);
  const companyNodes = await inspectNodes(driver.page, ['CashIcon', 'ProfitIcon', 'SettingsIcon', 'TabIcon', 'CompanyBanner']);
  check('ui05-company-icons-loaded',
    companyNodes.CashIcon?.[0]?.hasFrame && companyNodes.ProfitIcon?.[0]?.hasFrame && companyNodes.SettingsIcon?.[0]?.hasFrame,
    companyNodes);
  check('ui05-tab-icons-loaded', (companyNodes.TabIcon || []).filter((n) => n.hasFrame).length === 4, companyNodes.TabIcon);
  await driver.screenshot('d1-company-375x812');

  // ---------------- UI-09 年报 ----------------
  await driver.clickLabel('年度报告');
  await driver.waitForLabel('财务报告', { exact: false });
  await driver.page.waitForTimeout(900);
  const annualNodes = await inspectNodes(driver.page, ['AnnualDeco', 'LedgerIcon']);
  check('ui09-annual-deco-loaded', Boolean(annualNodes.AnnualDeco?.length) && annualNodes.LedgerIcon?.[0]?.hasFrame, annualNodes);
  await driver.screenshot('d1-annual-375x812');
  // 滚动到末行（现金桥/折旧），验证固定关闭可触达
  await driver.page.evaluate(() => {
    let sv = null;
    const find = (n) => { if (!sv && n.getComponent(cc.ScrollView)) sv = n.getComponent(cc.ScrollView); n.children.forEach(find); };
    find(cc.director.getScene());
    if (sv) sv.scrollToBottom(0.3);
  });
  await driver.page.waitForTimeout(800);
  await driver.screenshot('d1-annual-bottom-375x812');
  await driver.clickLabel('关闭');
  await driver.page.waitForTimeout(400);

  // ---------------- UI-06 部门页 ----------------
  await driver.clickLabel('部门');
  await driver.page.waitForTimeout(1200);
  const deptNodes = await inspectNodes(driver.page, ['DeptBanner', 'DeptIcon']);
  const deptScene = await driver.page.evaluate(() => {
    let ok = false;
    const walk = (n) => {
      if (n.name === 'BannerScene') { const s = n.getComponent(cc.Sprite); if (s && s.spriteFrame) ok = true; }
      n.children.forEach(walk);
    };
    walk(cc.director.getScene());
    return ok;
  });
  check('ui06-dept-banner-scene-loaded', deptScene, null);
  check('ui06-dept-icons-loaded', (deptNodes.DeptIcon || []).filter((n) => n.hasFrame).length >= 6, (deptNodes.DeptIcon || []).length);
  await driver.screenshot('d1-department-375x812');

  // ---------------- UI-16 招聘：三候选 + 费用确认 ----------------
  await driver.clickLabel('招聘');
  await driver.waitForLabel('招聘候选人');
  await driver.page.waitForTimeout(1200);
  const hireNodes = await inspectNodes(driver.page, ['HireAvatar0', 'HireAvatar1', 'HireAvatar2', 'HireBanner']);
  check('ui16-hire-avatars-present',
    ['HireAvatar0', 'HireAvatar1', 'HireAvatar2'].every((k) => hireNodes[k]?.length === 1),
    hireNodes);
  await driver.screenshot('d1-hire-candidates-375x812');
  const feeCount = await driver.page.evaluate(() => {
    let n = 0;
    const walk = (node) => {
      if (!node.activeInHierarchy) return;
      const l = node.getComponent(cc.Label);
      if (l && l.string.includes('｜招聘费')) n += 1;
      node.children.forEach(walk);
    };
    walk(cc.director.getScene());
    return n;
  });
  check('ui16-hire-fee-readback', feeCount >= 3, feeCount);
  await driver.clickLabel('录用');
  await driver.waitForLabel('确认录用？');
  await driver.page.waitForTimeout(400);
  const confirmFee = await driver.findLabels('确认支付', { exact: false });
  check('ui16-hire-confirm-fee', confirmFee.length === 1, confirmFee.map((l) => l.string || l.text));
  await driver.screenshot('d1-hire-confirm-375x812');
  await driver.clickLabel('再想想（取消）');
  await driver.waitForLabel('招聘候选人');
  await driver.clickLabel('关闭');
  await driver.page.waitForTimeout(400);

  // ---------------- UI-07 人才页：头像一致性与回退 ----------------
  await driver.clickLabel('人才');
  await driver.page.waitForTimeout(1500);
  const avatars1 = await sampleTalentAvatars(driver.page);
  check('ui07-talent-avatars-real', avatars1.filter((a) => a.imageHasFrame && a.fallbackActive === false).length >= 4, avatars1);
  check('ui07-talent-avatars-fallback', avatars1.some((a) => a.fallbackActive === true && !a.imageHasFrame), avatars1);
  await driver.screenshot('d1-talent-375x812');
  // 快切部门→人才，同一批员工头像状态应保持一致（绑定令牌不串图）
  await driver.clickLabel('部门');
  await driver.page.waitForTimeout(300);
  await driver.clickLabel('人才');
  await driver.page.waitForTimeout(1200);
  const avatars2 = await sampleTalentAvatars(driver.page);
  const consistent = JSON.stringify(avatars1.map((a) => [a.empName, a.imageHasFrame])) === JSON.stringify(avatars2.map((a) => [a.empName, a.imageHasFrame]));
  check('ui07-avatar-consistency-after-tab-switch', consistent, { before: avatars1, after: avatars2 });

  // ---------------- UI-08 排行页 ----------------
  await driver.clickLabel('排行');
  await driver.waitForLabel('本地模拟');
  await driver.page.waitForTimeout(1200);
  const rankNodes = await inspectNodes(driver.page, ['RankMedal', 'RankSelfBadge', 'RankTitleBadge', 'RankBanner']);
  check('ui08-rank-medals-loaded', (rankNodes.RankMedal || []).filter((n) => n.hasFrame).length === 3, rankNodes.RankMedal);
  check('ui08-rank-self-badge-loaded', Boolean(rankNodes.RankSelfBadge?.[0]?.hasFrame) && Boolean(rankNodes.RankTitleBadge?.[0]?.hasFrame), { self: rankNodes.RankSelfBadge, title: rankNodes.RankTitleBadge });
  await driver.screenshot('d1-rank-375x812');
  const browserErrorsClean = driver.errors.length === 0;
  check('main-flow-no-browser-errors', browserErrorsClean, driver.errors.slice(0, 5));
  await driver.finish('d1-main-flow-report.json');

  // ---------------- 异步错图回退：avatar_01 与 rank_01 纹理 404 ----------------
  const uuids = {
    ...JSON.parse(fs.readFileSync('materials/design/CEO_UI_V2_ArtSamples_v1/tools/import_uuids.json', 'utf8')),
    ...JSON.parse(fs.readFileSync('materials/design/CEO_UI_V2_D1_ArtHandoff_v1/tools/import_uuids.json', 'utf8')),
  };
  const blockedUuids = [
    uuids['img:ui/avatars/EmployeeAvatar_01_Male_ShortHair_Color1.png'],
    uuids['img:ui_v2/rank/rank_01.png'],
  ].filter(Boolean);

  const driver2 = await CanvasDriver.launch({
    url,
    viewport: { width: 375, height: 812 },
    outDir,
    executablePath: process.env.CHROME_EXE || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  });
  await driver2.page.route('**/assets/resources/**', (route) => {
    const hit = blockedUuids.some((u) => route.request().url().includes(u));
    if (hit) return route.abort();
    return route.continue();
  });
  await driver2.loadFixture(fixture);
  await driver2.page.waitForTimeout(1800);
  if ((await driver2.findLabels('同意并继续')).length) {
    await driver2.clickLabel('同意并继续');
    await driver2.page.waitForTimeout(2600);
  }
  // 排行页：奖章缺失但名次 Label 仍在、无 uncaught error
  await driver2.clickLabel('排行');
  await driver2.waitForLabel('本地模拟');
  await driver2.page.waitForTimeout(1200);
  const rankFallback = await inspectNodes(driver2.page, ['RankMedal']);
  const rankLabels = await driver2.findLabels('1', { exact: true });
  check('fallback-rank-labels-survive', rankLabels.length >= 1, { medals: rankFallback.RankMedal });
  await driver2.screenshot('d1-fallback-rank-375x812');
  // 人才页：avatar_01 缺失 -> 中性首字回退
  await driver2.clickLabel('人才');
  await driver2.page.waitForTimeout(1500);
  const fbAvatars = await sampleTalentAvatars(driver2.page);
  const fb01 = fbAvatars.find((a) => a.empName && a.empName.includes('梁思远'));
  check('fallback-avatar01-neutral', Boolean(fb01) && fb01.fallbackActive === true && !fb01.imageHasFrame, fb01 || fbAvatars);
  await driver2.screenshot('d1-fallback-talent-375x812');
  const fatal = driver2.errors.filter((e) => {
    const text = typeof e === 'string' ? e : (e && e.message) || JSON.stringify(e);
    return !/404|Failed to load resource|net::/i.test(text);
  });
  check('fallback-no-uncaught-errors', fatal.length === 0, fatal.slice(0, 5));
  await driver2.finish('d1-fallback-flow-report.json');

  const passCount = checks.filter((c) => c.status === 'PASS').length;
  const summary = { status: passCount === checks.length ? 'PASS' : 'FAIL', checks, passCount, total: checks.length };
  fs.writeFileSync(path.join(outDir, 'd1-visual-audit-checks.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  process.exit(passCount === checks.length ? 0 : 1);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
