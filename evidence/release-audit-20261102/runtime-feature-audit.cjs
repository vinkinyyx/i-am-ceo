const fs=require('fs');const path=require('path');const http=require('http');const {chromium}=require('playwright-core');
const root=path.resolve(__dirname,'../../build/web-mobile');
const server=http.createServer((req,res)=>{const f=path.join(root,req.url==='/'?'index.html':decodeURIComponent(req.url.split('?')[0]));fs.readFile(f,(e,b)=>{res.writeHead(e?404:200,{'Content-Type':f.endsWith('.js')?'application/javascript':f.endsWith('.html')?'text/html':'application/octet-stream'});res.end(e?'not found':b);});});
const results=[];let browser;
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
for(const feature of ['TextEncoder','structuredClone']){
 const context=await browser.newContext({viewport:{width:390,height:844}});const p=await context.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await p.addInitScript(feature=>{globalThis[feature]=undefined;localStorage.setItem('ceo/privacy/consent',JSON.stringify({accepted:true,policyVersion:1,acceptedAtMs:Date.now()}));},feature);
 await p.goto('http://127.0.0.1:'+server.address().port);await p.waitForTimeout(5500);
 const state=await p.evaluate(async(feature)=>{const c=globalThis.cc||await System.import('cc');const scene=c.director.getScene();const canvas=scene?.getChildByName('Canvas');const app=canvas?.components.find(v=>v.facade);const result={scene:scene?.name,hasApp:!!app,feature:typeof globalThis[feature]};if(app&&feature==='structuredClone'){const s=app.facade.getState();result.before={phase:s.phase,runId:s.runId};result.create=await app.facade.createCompany({companyName:'兼容性测试公司',industry:'TRADE',ceoName:'测试员',ceoTrait:'BOLD'},{commandId:'compat-create',expectedRunId:s.runId});result.after={phase:app.facade.getState().phase};}return result;},feature).catch(e=>({inspectionError:e.message}));
 await p.screenshot({path:path.join(__dirname,'missing-'+feature+'.png')});results.push({feature,scope:'browser API absence simulation; not proof this API is absent on the reported device',errors,state});await context.close();
}
})().catch(e=>{results.push({fatal:String(e)});process.exitCode=1;}).finally(async()=>{fs.writeFileSync(path.join(__dirname,'runtime-feature-report.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));if(browser)await browser.close();server.close();});
