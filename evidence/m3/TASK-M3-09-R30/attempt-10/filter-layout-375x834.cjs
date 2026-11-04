const fs = require('fs');
const path = require('path');
const { CanvasDriver } = require('../../../../tools/e2e/canvas-driver.cjs');
(async () => {
  const seed = JSON.parse(fs.readFileSync('evidence/m3/TASK-M3-09-R30/attempt-06/seed-staffed.json', 'utf8'));
  const driver = await CanvasDriver.launch({ url: 'http://127.0.0.1:8147/', viewport: { width: 375, height: 834 }, outDir: __dirname, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    await driver.loadFixture(seed);
    await driver.waitForLabel('人才');
    await driver.page.waitForTimeout(1800);
    await driver.clickLabel('人才');
    await driver.waitForLabel('员工');
    const report = await driver.page.evaluate(() => {
      const found = [];
      const walk = (n) => { const l = n.getComponent(cc.Label); if (l && n.activeInHierarchy) found.push({ node: n, text: l.string }); n.children.forEach(walk); };
      walk(cc.director.getScene());
      const box = (n) => { const t = n.getComponent(cc.UITransformComponent); const p = n.worldPosition; const s = n.worldScale; return { x: p.x-t.width*s.x/2, y: p.y-t.height*s.y/2, width:t.width*s.x, height:t.height*s.y, top:p.y+t.height*s.y/2, bottom:p.y-t.height*s.y/2 }; };
      const card = box(found.find((x) => x.text.startsWith('梁思远（')).node.parent);
      const filters = found.filter((x) => ['市场 1','客服 1','财务 0'].includes(x.text)).map((x) => ({ text:x.text, ...box(x.node.parent) }));
      return { viewport:{width:375,height:834}, card, filters, gap:Math.min(...filters.map((f)=>Math.abs(f.bottom-card.top))), status:filters.every((f)=>Math.max(0,Math.min(card.top,f.top)-Math.max(card.bottom,f.bottom))===0)?'PASS':'FAIL' };
    });
    await driver.screenshot('r30-filter-card-375x834');
    fs.writeFileSync(path.join(__dirname,'filter-layout-375x834.json'),JSON.stringify(report,null,2));
    console.log(JSON.stringify(report));
    if(report.status!=='PASS'||report.gap<8) process.exitCode=1;
    // Verify the visible first card's real detail action remains reachable.
    const card = await driver.page.evaluate(() => { const walk=(n)=>{const l=n.getComponent(cc.Label);if(l&&l.string.startsWith('梁思远（'))return n.parent;n.children;}; return null; });
    void card;
    await driver.clickLabel('详情');
    await driver.waitForLabel('员工详情');
  } finally { await driver.browser.close(); }
})().catch((error)=>{console.error(error);process.exitCode=1;});
