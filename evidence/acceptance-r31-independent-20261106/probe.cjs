const fs = require('node:fs');
const path = require('node:path');
const { CanvasDriver } = require('../../tools/e2e/canvas-driver.cjs');
const root = path.resolve(__dirname, '../..');
async function snapshot(driver) {
  return driver.page.evaluate(() => {
    const tr = n => n.components?.find(c => c.constructor?.name === 'UITransform') || (cc.UITransformComponent ? n.getComponent(cc.UITransformComponent) : null);
    const labels = [], nodes = [], buttons = [];
    const walk = n => {
      if (!n.activeInHierarchy) return;
      const label = n.getComponent(cc.Label);
      if (label) labels.push(label.string);
      const t = tr(n), box = t?.getBoundingBoxToWorld();
      if (['ModalOverlay','DialogScroll','View','DialogFooter'].includes(n.name)) nodes.push({ name:n.name,uuid:n.uuid,parent:n.parent?.name,w:t?.width,h:t?.height });
      if (n.getComponent(cc.Button) && n.parent?.name === 'DialogFooter') buttons.push({text:n.getComponentInChildren(cc.Label)?.string,box:box && {x:box.x,y:box.y,w:box.width,h:box.height}});
      n.children.forEach(walk);
    };
    walk(cc.director.getScene());
    return {labels,nodes,buttons};
  });
}
async function main() {
  let d;
  try {
    d = await CanvasDriver.launch({url:'http://127.0.0.1:8176/',viewport:{width:375,height:812},outDir:__dirname,executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'});
    await d.loadFixture(JSON.parse(fs.readFileSync(path.join(root,'evidence/m3/TASK-M3-09-R30/attempt-06/seed-staffed.json'),'utf8')));
    await d.waitForLabel('当前可用现金',{exact:false,timeoutMs:20000});
    await d.page.waitForFunction(()=>!document.querySelector('[data-tap-splash]'),null,{timeout:20000});
    if ((await d.findLabels('同意并继续')).length) {await d.clickLabel('同意并继续');await d.page.waitForTimeout(1000);}
    await d.clickLabel('暂停');
    await d.clickLabel('人才');
    await d.clickLabel('详情');
    await d.waitForLabel('员工详情');
    const original = await snapshot(d);
    await d.clickLabel('裁员');
    await d.waitForLabel('确认裁员？');
    const child = await snapshot(d);
    await d.screenshot('child-confirm');
    const [a,b] = [...child.buttons].sort((x,y)=>x.box.y-y.box.y);
    const actualGap = a && b ? b.box.y-(a.box.y+a.box.h) : null;
    await d.clickLabel('再想想（取消）');
    await d.page.waitForTimeout(350);
    const afterCancel=await snapshot(d);
    await d.screenshot('after-cancel');
    await d.clickLabel('详情');
    await d.waitForLabel('员工详情');
    const beforeResize=await snapshot(d);
    await d.page.setViewportSize({width:360,height:640});
    await d.page.waitForTimeout(1000);
    const afterResize=await snapshot(d);
    await d.screenshot('after-resize');
    const result={artifact:'build/web-mobile',parentDetailOriginallyPresent:original.labels.includes('员工详情'),parentDetailWhileChild:child.labels.includes('员工详情'),parentDetailRestoredAfterCancel:afterCancel.labels.includes('员工详情'),confirmFooterGap:actualGap,expectedMinGap:8,beforeResize:beforeResize.nodes,afterResize:afterResize.nodes,browserErrors:d.errors};
    fs.writeFileSync(path.join(__dirname,'probe-result.json'),JSON.stringify(result,null,2));
    console.log(JSON.stringify(result,null,2));
  } finally { if(d) await d.browser.close(); }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
