const { chromium } = require('playwright-core');
const fs = require('fs');
const seed = JSON.parse(fs.readFileSync('evidence/m3/TASK-M3-09-R30/attempt-04/seed-size-100.json', 'utf8'));
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_EXE || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const page = await browser.newPage({ viewport: { width: 360, height: 640 } });
  await page.goto('http://127.0.0.1:8153/');
  await page.evaluate(s => { localStorage.clear(); for (const [k,v] of Object.entries(s)) localStorage.setItem(k,v); }, seed);
  await page.reload(); await page.waitForTimeout(4500);
  const geom = await page.$$eval('canvas', els => { const r=els[0].getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height}; });
  const scale=geom.w/375, visibleH=geom.h/scale;
  const tab=await page.evaluate(() => {let p=null;const walk=n=>{const l=n.getComponent(cc.Label);if(l?.string==='人才')p={x:n.worldPosition.x,y:n.worldPosition.y};n.children.forEach(walk);};walk(cc.director.getScene());return p;});
  await page.mouse.click(geom.x+tab.x*scale,geom.y+(visibleH-tab.y)*scale); await page.waitForTimeout(1000);
  for(let i=0;i<40;i++){ await page.mouse.move(180,320); await page.mouse.wheel(0,500); await page.waitForTimeout(120); }
  await page.waitForTimeout(500);
  const result=await page.evaluate(()=>{let out={cards:[],scrolls:[],content:[],views:[]};const walk=n=>{const tr=n.getComponent(cc.UITransformComponent);if(tr&&Math.abs(tr.width-343)<1&&Math.abs(tr.height-108)<1&&n.activeInHierarchy){out.cards.push({name:n.children.map(c=>c.getComponent(cc.Label)?.string).find(x=>x?.startsWith('员工')),y:n.worldPosition.y});}const s=n.getComponent(cc.ScrollView);if(s){const ct=s.content?.getComponent(cc.UITransformComponent),v=s.view?.getComponent(cc.UITransformComponent);out.scrolls.push({name:n.name,offset:s.getScrollOffset().y,content:s.content?.name,contentHeight:ct?.height,contentY:s.content?.worldPosition.y,view:s.view?.name,viewHeight:v?.height});}if(tr&&n.name==='BodyContent')out.content.push({height:tr.height,y:n.worldPosition.y});if(tr&&n.name==='BodyView')out.views.push({height:tr.height,y:n.worldPosition.y});n.children.forEach(walk);};walk(cc.director.getScene());return out;});
  fs.writeFileSync('evidence/m3/TASK-M3-09-R30/attempt-04/debug-scroll.json',JSON.stringify(result,null,2)); console.log(JSON.stringify(result,null,2)); await page.screenshot({path:'evidence/m3/TASK-M3-09-R30/attempt-04/debug-scroll.png'}); await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
