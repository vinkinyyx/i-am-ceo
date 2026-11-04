const fs = require('fs');
const path = require('path');
const { CanvasDriver } = require('../../tools/e2e/canvas-driver.cjs');
(async () => {
  const seed = JSON.parse(fs.readFileSync('evidence/m3/TASK-M3-09-R30/attempt-06/seed-staffed.json', 'utf8'));
  const results = [];
  for (const viewport of [{ width: 375, height: 812 }, { width: 375, height: 834 }, { width: 360, height: 640 }, { width: 390, height: 844 }]) {
    const driver = await CanvasDriver.launch({ url: 'http://127.0.0.1:8149/', viewport, outDir: __dirname, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
    try {
      await driver.loadFixture(seed);
      await driver.waitForLabel('人才');
      await driver.page.waitForTimeout(1800); // Existing Web splash duration; not a command-completion assertion.
      await driver.clickLabel('人才');
      await driver.waitForLabel('员工');
      const geometry = await driver.page.evaluate(() => {
        const labels = [];
        const walk = (n) => { const l = n.getComponent(cc.Label); if (l && n.activeInHierarchy) labels.push({ node: n, text: l.string }); n.children.forEach(walk); };
        walk(cc.director.getScene());
        const box = (n) => { const t = n.getComponent(cc.UITransformComponent); const p = n.worldPosition; const s = n.worldScale; return { left: p.x - t.width * s.x / 2, right: p.x + t.width * s.x / 2, bottom: p.y - t.height * s.y / 2, top: p.y + t.height * s.y / 2 }; };
        const card = box(labels.find((l) => l.text.startsWith('梁思远（')).node.parent);
        const filters = labels.filter((l) => ['市场 1', '客服 1', '财务 0'].includes(l.text)).map((l) => ({ text: l.text, ...box(l.node.parent) }));
        const minGap = Math.min(...filters.map((f) => f.bottom - card.top));
        const background = cc.director.getScene().getChildByName('Canvas').getChildByName('Backdrop').getChildByName('BackgroundImage');
        return { card, filters, minGap, backgroundLoaded: !!background?.getComponent(cc.Sprite)?.spriteFrame };
      });
      await driver.screenshot(`layout-${viewport.width}-${viewport.height}`);
      const before = await driver.readCommittedSave();
      await driver.clickLabel('详情');
      await driver.waitForLabel('员工详情');
      const employeeMatches = (await driver.findLabels('梁思远')).length > 0;
      const after = await driver.readCommittedSave();
      results.push({ viewport, ...geometry, detailAction: employeeMatches, detailReadOnly: before.pointer.revision === after.pointer.revision, errors: driver.errors, pass: geometry.minGap >= 8 - 0.01 && geometry.backgroundLoaded && employeeMatches && before.pointer.revision === after.pointer.revision && driver.errors.length === 0 });
    } finally { await driver.browser.close(); }
  }
  fs.writeFileSync(path.join(__dirname, 'layout-report.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results.map((r) => ({ viewport: r.viewport, gap: r.minGap, detailAction: r.detailAction, pass: r.pass }))));
  if (results.some((r) => !r.pass)) process.exitCode = 1;
})().catch((error) => { console.error(error); process.exitCode = 1; });
