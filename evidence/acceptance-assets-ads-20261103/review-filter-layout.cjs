const fs = require('fs');
const path = require('path');
const { CanvasDriver } = require('../../tools/e2e/canvas-driver.cjs');
(async () => {
  const seed = JSON.parse(fs.readFileSync('evidence/m3/TASK-M3-09-R30/attempt-06/seed-staffed.json', 'utf8'));
  const driver = await CanvasDriver.launch({ url: 'http://127.0.0.1:8147/', viewport: { width: 375, height: 812 }, outDir: __dirname, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    await driver.loadFixture(seed);
    await driver.waitForLabel('人才');
    // The legacy Web splash intercepts input briefly after the scene exists.
    await driver.page.waitForTimeout(1600);
    await driver.clickLabel('人才');
    await driver.waitForLabel('员工');
    const result = await driver.page.evaluate(() => {
      const labels = [];
      const walk = (n) => { const label = n.getComponent(cc.Label); if (label && n.activeInHierarchy) labels.push({ node: n, text: label.string }); n.children.forEach(walk); };
      walk(cc.director.getScene());
      const ownBox = (node) => { const t = node.getComponent(cc.UITransformComponent); const p = node.worldPosition; const s = node.worldScale; const width = t.width * s.x; const height = t.height * s.y; return { x: p.x - width / 2, y: p.y - height / 2, width, height, xMax: p.x + width / 2, yMax: p.y + height / 2 }; };
      const card = ownBox(labels.find((l) => l.text.startsWith('梁思远（')).node.parent);
      const filters = labels.filter((l) => ['市场 1', '客服 1', '财务 0'].includes(l.text)).map((l) => { const box = ownBox(l.node.parent); return { text: l.text, box, intersection: Math.max(0, Math.min(card.yMax, box.yMax) - Math.max(card.y, box.y)) }; });
      return { card, filters, status: filters.some((f) => f.intersection > 0) ? 'FAIL' : 'PASS' };
    });
    await driver.screenshot('r30-filter-card-overlap');
    fs.writeFileSync(path.join(__dirname, 'filter-layout-review.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
  } finally { await driver.browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
