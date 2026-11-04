const fs = require('fs');
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

(async () => {
  const outDir = process.argv[3] || 'evidence/m3/TASK-M3-09-R31-R32/attempt-01';
  const seedFile = 'evidence/m3/TASK-M3-09-R30/attempt-06/seed-staffed.json';
  const seed = JSON.parse(fs.readFileSync(seedFile, 'utf8'));
  const pointer = JSON.parse(seed['ceo/save/active']);
  const slot = pointer.slot;
  const env = JSON.parse(seed[`ceo/save/${slot}`]);
  env.payload.gameYear = 3;
  env.payload.annualReports = [
    { year: 1, revenueYuan: 120000, directCostYuan: 40000, otherOperatingCostYuan: 20000, afterSalesCostYuan: 1000, fixedCostYuan: 12000, payrollYuan: 80000, recruitmentCostYuan: 5000, severanceCostYuan: 0, deptSetupCostYuan: 10000, eventCostYuan: 0, depreciationYuan: 0, profitYuan: -48000, cashOpenYuan: 500000, cashCloseYuan: 452000, assetCloseYuan: 10000, headcountClose: 6, settled: true },
    { year: 2, revenueYuan: 180000, directCostYuan: 60000, otherOperatingCostYuan: 25000, afterSalesCostYuan: 2000, fixedCostYuan: 12000, payrollYuan: 80000, recruitmentCostYuan: 0, severanceCostYuan: 0, deptSetupCostYuan: 0, eventCostYuan: 1000, depreciationYuan: 1000, profitYuan: -1000, cashOpenYuan: 452000, cashCloseYuan: 461000, assetCloseYuan: 9000, headcountClose: 6, settled: true, cashBridge: { monthlyLedgerNetCashDeltaYuan: 9000, investmentCashFlowYuan: 0, rescueCapitalYuan: 0, unattributedCashFlowYuan: 0, attributionComplete: true, balanced: true } },
  ];
  const { checksum: old, ...rest } = env;
  const sealed = { ...rest, checksum: checksum(rest) };
  if (sealed.checksum === old && env.payload.gameYear === 3) throw new Error('fixture checksum unexpectedly unchanged');
  const fixture = { ...seed, [`ceo/save/${slot}`]: JSON.stringify(sealed), 'ceo/save/active': JSON.stringify({ ...pointer, revision: sealed.revision }) };
  const driver = await CanvasDriver.launch({ url: process.argv[2] || 'http://127.0.0.1:8153/', viewport: { width: 375, height: 812 }, outDir, executablePath: process.env.CHROME_EXE || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
  const before = await driver.loadFixture(fixture).then(() => driver.readCommittedSave());
  await driver.page.waitForTimeout(1500);
  fs.writeFileSync(`${outDir}/pre-rank-debug.json`, JSON.stringify({ before, labels: await driver.page.evaluate(() => { const t=[]; const walk=(n)=>{const l=n.getComponent(cc.Label);if(l&&n.activeInHierarchy)t.push(l.string);n.children.forEach(walk)};walk(cc.director.getScene());return t; }), errors: driver.errors }, null, 2));
  await driver.waitForLabel('排行', { timeoutMs: 10_000 });
  await driver.clickLabel('排行');
  await driver.waitForLabel('本地模拟排行');
  await driver.clickLabel('年限榜');
  const yearsPage = await driver.page.evaluate(() => {
    const text = [];
    const walk = (node) => { const label = node.getComponent(cc.Label); if (label && node.activeInHierarchy) text.push(label.string); node.children.forEach(walk); };
    walk(cc.director.getScene()); return text;
  });
  fs.writeFileSync(`${outDir}/rank-years-labels.json`, JSON.stringify(yearsPage, null, 2));
  const row = await driver.findLabels('超长测试公司名称用于换行验证是否不缩字体（你）', { exact: false });
  driver.check('R31-years-rank-uses-operating-years', yearsPage.some((t) => t.includes('2 年')) && row.length > 0, { row, yearsLabels: yearsPage.filter((t) => t.includes('年')) });
  await driver.clickLabel('定位我方');
  await driver.page.waitForTimeout(400);
  const playerRow = (await driver.findLabels('超长测试公司名称用于换行验证是否不缩字体（你）', { exact: false }))[0];
  let playerDetail = null;
  for (let nth = 0; nth < 40; nth += 1) {
    const candidate = (await driver.findLabels('详情', { nth }))[0];
    if (!candidate) break;
    if (Math.abs(candidate.y - playerRow.y) < 26) { playerDetail = candidate; break; }
  }
  if (!playerDetail) throw new Error(`player-detail-button-not-found: ${JSON.stringify({ playerRow })}`);
  const geometry = await driver.geometry();
  await driver.page.mouse.click(geometry.x + playerDetail.x * geometry.scale, geometry.y + (geometry.visibleH - playerDetail.y) * geometry.scale);
  await driver.waitForLabel('我方排行详情');
  const detail = await driver.page.evaluate(() => {
    const text = []; const walk = (node) => { const l = node.getComponent(cc.Label); if (l && node.activeInHierarchy) text.push(l.string); node.children.forEach(walk); }; walk(cc.director.getScene()); return text;
  });
  driver.check('R31-player-detail-has-name-years-assets', detail.some((t) => t.startsWith('企业：')) && detail.some((t) => t.includes('总资产：')) && detail.some((t) => t.includes('经营年限：2 年')), detail.filter((t) => /企业：|总资产：|经营年限：/.test(t)));
  await driver.screenshot('r31-player-detail');
  await driver.clickLabel('关闭');
  const afterRank = await driver.readCommittedSave();
  driver.check('R31-rank-query-is-read-only', JSON.stringify(before.envelope) === JSON.stringify(afterRank.envelope), { beforeRevision: before.envelope.revision, afterRevision: afterRank.envelope.revision });

  await driver.clickLabel('公司');
  await driver.clickLabel('年度报告');
  await driver.waitForLabel('第 2 年财务报告');
  await driver.waitForLabel('现金桥（收入与现金支出均按实际发生记账）', { exact: true });
  for (let i = 0; i < 12; i += 1) { await driver.page.mouse.move(187, 430); await driver.page.mouse.wheel(0, 500); await driver.page.waitForTimeout(80); }
  await driver.screenshot('r32-year-2-bridge-visible');
  for (let i = 0; i < 12; i += 1) { await driver.page.mouse.move(187, 430); await driver.page.mouse.wheel(0, -500); await driver.page.waitForTimeout(80); }
  await driver.clickLabel('较早年度');
  await driver.waitForLabel('第 1 年财务报告');
  const legacy = await driver.findLabels('历史现金流明细未记录', { exact: false });
  driver.check('R32-old-report-explicitly-marks-bridge-unavailable', legacy.length > 0, legacy);
  for (let i = 0; i < 12; i += 1) { await driver.page.mouse.move(187, 430); await driver.page.mouse.wheel(0, 500); await driver.page.waitForTimeout(80); }
  await driver.screenshot('r32-year-1-legacy-bridge-visible');
  const afterReport = await driver.readCommittedSave();
  driver.check('R32-year-navigation-does-not-rewrite-save', JSON.stringify(before.envelope) === JSON.stringify(afterReport.envelope), { beforeRevision: before.envelope.revision, afterRevision: afterReport.envelope.revision });
  const report = await driver.finish();
  fs.writeFileSync(`${outDir}/fixture-readback.json`, JSON.stringify({ runId: before.envelope.runId, revision: before.envelope.revision, reports: before.envelope.payload.annualReports.map((r) => ({ year: r.year, cashBridge: r.cashBridge ?? null })) }, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (report.status !== 'PASS') process.exitCode = 1;
})().catch((error) => { console.error(error); process.exit(1); });
