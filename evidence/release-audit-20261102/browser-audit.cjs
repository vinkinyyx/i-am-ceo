const fs = require('fs');
const path = require('path');
const http = require('http');
const { chromium } = require('playwright-core');
const root = path.resolve(__dirname, '../../build/web-mobile');
const mime = {'.html':'text/html','.js':'application/javascript','.json':'application/json','.wasm':'application/wasm','.png':'image/png','.jpg':'image/jpeg','.mp3':'audio/mpeg','.css':'text/css'};
const server = http.createServer((req,res)=>{const rel=decodeURIComponent(req.url.split('?')[0]);const f=path.join(root,rel==='/'?'index.html':rel);fs.readFile(f,(e,b)=>{res.writeHead(e?404:200,{'Content-Type':mime[path.extname(f)]||'application/octet-stream'});res.end(e?'not found':b);});});
const report = {build:'existing web-mobile, 2026-11-01; not a Tap runtime',checks:[],errors:[],screens:[]};
let browser;
async function attach(page){await page.evaluate(async()=>{globalThis.__auditCC=globalThis.cc||await System.import('cc');globalThis.__auditApp=__auditCC.director.getScene().getChildByName('Canvas').components.find(c=>c.facade);});}
async function inspect(page){return page.evaluate(()=>{const c=__auditCC;const scene=c.director.getScene();const labels=[];const buttons=[];function walk(n){if(!n.activeInHierarchy)return;const l=n.getComponent(c.Label);if(l)labels.push(l.string);const b=n.getComponent(c.Button);if(b){const label=n.getComponentsInChildren(c.Label).map(l=>l.string).join(' ');const p=n.worldPosition;const tr=n._uiProps?.uiTransformComp||n.getComponent(c.UITransform);buttons.push({text:label,x:p.x,y:p.y,width:tr?.width,height:tr?.height,scale:n.worldScale.x});}n.children.forEach(walk);}walk(scene);const s=__auditApp?.facade.getState();return {labels,buttons,size:c.view.getVisibleSize(),state:s?{runId:s.runId,phase:s.phase,year:s.gameYear,month:s.gameMonth,speed:s.speed,cash:s.company?.cashYuan,assets:s.company?.businessAssetBookYuan,industry:s.company?.industry,employees:s.employees,departments:s.departments,reports:s.annualReports,onboarding:s.onboarding}:null};});}
async function click(page,text,index=0){const snap=await inspect(page);const b=snap.buttons.filter(b=>b.text===text)[index];if(!b)throw Error('missing button '+text+' available='+snap.buttons.map(b=>b.text).join('|'));const rect=await page.locator('canvas').first().boundingBox();await page.mouse.click(rect.x+b.x/snap.size.width*rect.width,rect.y+rect.height-b.y/snap.size.height*rect.height);await page.waitForTimeout(350);}
async function shot(page,name){await page.screenshot({path:path.join(__dirname,name+'.png')});const snap=await inspect(page);fs.writeFileSync(path.join(__dirname,name+'.json'),JSON.stringify(snap,null,2));report.screens.push(name);return snap;}
function check(name,pass,details){report.checks.push({name,status:pass?'PASS':'FAIL',details});console.log(name,pass?'PASS':'FAIL');}
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const context=await browser.newContext({viewport:{width:390,height:844}});const page=await context.newPage();
 page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&!r.url().includes('favicon'))report.errors.push(r.status()+' '+r.url());});
 await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForTimeout(5000);await attach(page);
 await shot(page,'01-privacy');await click(page,'同意并继续');
 check('privacy persisted',await page.evaluate(()=>JSON.parse(localStorage.getItem('ceo/privacy/consent')).accepted));
 await shot(page,'02-company');await click(page,'下一步：创建 CEO');await shot(page,'03-ceo');
 let snap=await inspect(page);console.log('CEO BUTTONS',snap.buttons.map(b=>b.text));
 await click(page,'下一步：招聘员工');snap=await shot(page,'04-hiring');const cash=snap.state.cash;
 await click(page,'录用',0);snap=await shot(page,'05-first-hire');const run=snap.state.runId;const fee=cash-snap.state.cash;
 check('first hire one charge',snap.state.employees.length===1&&fee===snap.state.employees[0].salaryMonthlyYuan,{fee,cash:snap.state.cash});
 await page.reload();await page.waitForTimeout(4000);await attach(page);snap=await inspect(page);check('reload restores first hire',snap.state.runId===run&&snap.state.employees.length===1&&snap.state.cash===cash-fee,snap.state);
 await click(page,'录用',1);snap=await inspect(page);check('second hire completes onboarding',snap.state.employees.length===2&&snap.state.cash===cash-snap.state.employees.reduce((n,e)=>n+e.salaryMonthlyYuan,0),snap.state.onboarding);
 if(snap.buttons.some(b=>b.text==='进入公司'))await click(page,'进入公司');else report.onboardingAutoAdvanced=true;snap=await shot(page,'06-tutorial');console.log('TUTORIAL BUTTONS',snap.buttons.map(b=>b.text));
 const start=snap.buttons.find(b=>b.text.includes('开始经营')||b.text.includes('开始自动'));if(start)await click(page,start.text);
 snap=await shot(page,'07-home');check('running via UI',snap.state.phase==='RUNNING',snap.state.phase);
 const pause=snap.buttons.find(b=>b.text==='暂停');if(pause)await click(page,pause.text);
 await click(page,'部门');await shot(page,'08-departments');
 await click(page,'创建',0);snap=await shot(page,'09-create-dept');console.log('CREATE BUTTONS',snap.buttons.map(b=>b.text));
 const pay=snap.buttons.find(b=>/创建|支付/.test(b.text)&&!['创建'].includes(b.text));if(pay)await click(page,pay.text);
 snap=await inspect(page);check('create department persists',snap.state.departments.length===2&&snap.state.cash===cash-snap.state.employees.reduce((n,e)=>n+e.salaryMonthlyYuan,0)-10000,snap.state.departments);
 await click(page,'人才');await shot(page,'10-talent');await click(page,'详情',0);snap=await shot(page,'11-employee');console.log('EMPLOYEE BUTTONS',snap.buttons.map(b=>b.text));
 const close=snap.buttons.find(b=>/关闭|返回/.test(b.text));if(close)await click(page,close.text);
 await click(page,'排行');await shot(page,'12-rank');
 await click(page,'公司');await click(page,'年度报告');await shot(page,'13-report-empty');await click(page,'知道了');
 // Deterministic command-layer time advancement: explicitly not a wall-clock UI speed proof.
 const advance=await page.evaluate(async()=>{const a=__auditApp;const f=a.facade;const s=f.getState();await f.setSpeed(5,{commandId:'audit-speed',expectedRunId:s.runId});const r=await f.advanceRealTime(60000,s.runId);a.render();return r;});
 report.commandTimeAdvance=advance;snap=await inspect(page);check('command layer 60s at 5x closes year',snap.state.reports.length>=1&&snap.state.reports.every(r=>r.profitYuan===r.revenueYuan+r.directCostYuan+r.otherOperatingCostYuan+r.afterSalesCostYuan+r.fixedCostYuan+r.payrollYuan+r.recruitmentCostYuan+r.severanceCostYuan+r.deptSetupCostYuan+r.eventCostYuan+r.depreciationYuan&&r.cashCloseYuan===r.cashOpenYuan+r.profitYuan-r.depreciationYuan),{year:snap.state.year,reports:snap.state.reports,advance});
 await click(page,'年度报告');await shot(page,'14-annual-report');await click(page,'关闭');
 await click(page,'暂停');let pausedBefore=(await inspect(page)).state;await page.waitForTimeout(6200);let pausedAfter=(await inspect(page)).state;check('UI pause freezes month',pausedBefore.year===pausedAfter.year&&pausedBefore.month===pausedAfter.month);await click(page,'5×');const liveBefore=(await inspect(page)).state;console.log('waiting 61 seconds for real UI 5x year');await page.waitForTimeout(61000);const liveAfter=(await inspect(page)).state;check('UI 5x advances full year in real time',liveAfter.reports.length>=liveBefore.reports.length+1,{before:liveBefore.reports.length,after:liveAfter.reports.length});await click(page,'暂停');await shot(page,'14b-live-year');await click(page,'设置');await shot(page,'15-settings');snap=await inspect(page);console.log('SETTINGS BUTTONS',snap.buttons.map(b=>b.text));
 const back=snap.buttons.find(b=>b.text==='取消');if(back)await click(page,back.text);
 for(const [w,h] of [[360,640],[428,926]]){await page.setViewportSize({width:w,height:h});await page.waitForTimeout(500);await shot(page,`16-live-resize-${w}x${h}`);await page.reload();await page.waitForTimeout(3500);await attach(page);await click(page,'暂停');await click(page,'部门');let d=await shot(page,`16-departments-${w}x${h}`);check(`cold viewport department ${w}x${h}`,d.labels.includes('部门')&&d.labels.includes('主营业务部'));await click(page,'公司');await shot(page,`17-home-${w}x${h}`);}
 await page.setViewportSize({width:390,height:844});await page.reload();await page.waitForTimeout(4000);await attach(page);snap=await shot(page,'18-reload');check('reload keeps year and department',snap.state.runId===run&&snap.state.reports.length>=1&&snap.state.departments.length===2,snap.state);
 await click(page,'设置');snap=await inspect(page);const reset=snap.buttons.find(b=>/关闭公司/.test(b.text));if(reset){await click(page,reset.text);await shot(page,'19-reset-dialog');await click(page,'再想想（取消）');snap=await inspect(page);check('cancel reset preserves run',snap.state.runId===run);await click(page,'设置');await click(page,reset.text);await click(page,'永久清除本局');snap=await shot(page,'20-reset');check('confirmed reset removes run data',snap.state.runId!==run&&!snap.state.cash&&snap.state.employees.length===0,snap.state);await page.reload();await page.waitForTimeout(4000);await attach(page);snap=await inspect(page);check('reset survives reload',snap.state.runId!==run&&snap.state.employees.length===0,snap.state);}
})().catch(e=>{report.fatal=String(e.stack||e);console.error(report.fatal);process.exitCode=1;}).finally(async()=>{fs.writeFileSync(path.join(__dirname,'browser-report.json'),JSON.stringify(report,null,2));if(browser)await browser.close();server.close();});
