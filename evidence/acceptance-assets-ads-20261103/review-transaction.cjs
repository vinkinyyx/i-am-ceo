// Review probe: real production TS modules; only an in-memory storage host is fault injected.
const fs=require('fs'),path=require('path'),vm=require('vm'),ts=require('typescript');
const root=path.resolve(__dirname,'../..'),cache=new Map();
function load(file){file=path.resolve(file);if(!path.extname(file))file+='.ts';if(file.endsWith('.json'))return JSON.parse(fs.readFileSync(file,'utf8'));if(cache.has(file))return cache.get(file).exports;const m={exports:{}};cache.set(file,m);const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText;vm.runInThisContext('(function(require,module,exports){'+code+'\n})',{filename:file})(id=>id.startsWith('.')?load(path.resolve(path.dirname(file),id)):id.startsWith('@core/')?load(path.join(root,'assets/core',id.slice(6))):require(id),m,m.exports);return m.exports;}
(async()=>{
 const {GameFacade}=load(path.join(root,'assets/core/application/GameFacade.ts'));
 const {registerConfig}=load(path.join(root,'assets/core/config/configLoader.ts'));
 const {GameError,GameErrorCode}=load(path.join(root,'assets/core/domain/errors.ts'));
 const raw=JSON.parse(fs.readFileSync(path.join(root,'evidence/m3/TASK-M3-09-R27/attempt-01/seed-save-375.json'),'utf8'));
 const cfg=registerConfig(JSON.parse(fs.readFileSync(path.join(root,'assets/resources/config/economy.v1.json'),'utf8')));
 const data=new Map(Object.entries(raw).map(([k,v])=>[k,JSON.parse(v)]));let failPointerAfterWrite=false;
 const platform={getEnvironment:()=> 'EDITOR',getWindowInfo:()=>({width:375,height:812}),get:async k=>data.has(k)?structuredClone(data.get(k)):null,set:async(k,v)=>{data.set(k,structuredClone(v));if(k==='ceo/save/active'&&failPointerAfterWrite){failPointerAfterWrite=false;throw new GameError(GameErrorCode.SAVE_UNAVAILABLE,{reason:'simulated callback timeout AFTER actual pointer write'});}},remove:async k=>{data.delete(k);},onShow:()=>()=>{},onHide:()=>()=>{},login:async()=>({mock:true}),getNetworkState:async()=> 'online',request:async()=>({statusCode:200,data:{}})};
 const facade=await GameFacade.bootstrap(platform,cfg);const runId=facade.getState().runId;
 const disk=()=>{const p=data.get('ceo/save/active');const e=data.get('ceo/save/'+p.slot);return {revision:e.revision,cash:e.payload.company.cashYuan,assets:e.payload.company.businessAssetBookYuan,policy:e.payload.policy,commandRecorded:e.payload.executedCommandIds.includes('review-invest-unknown'),journalPresent:data.has('ceo/save/transaction')};};
 const initial=disk();failPointerAfterWrite=true;
 const investment=await facade.invest(10000,{commandId:'review-invest-unknown',expectedRunId:runId});
 const afterUnknown={result:investment,memory:{revision:facade.getRevision(),cash:facade.getState().company.cashYuan,assets:facade.getState().company.businessAssetBookYuan},disk:disk()};
 const next=await facade.setPolicy('GROWTH',{commandId:'review-next-policy',expectedRunId:runId});
 const afterNext={result:next,memory:{revision:facade.getRevision(),cash:facade.getState().company.cashYuan,assets:facade.getState().company.businessAssetBookYuan},disk:disk()};
 const reloaded=await GameFacade.bootstrap(platform,cfg);
 const report={scope:'real GameFacade, GameStore, SaveRepository, InvestmentService; injected pointer callback failure after successful storage write; no real player save modified',initial,afterUnknown,afterNext,reloaded:{cash:reloaded.getState().company.cashYuan,assets:reloaded.getState().company.businessAssetBookYuan,policy:reloaded.getState().policy},expected:'After reconciling an actually committed investment, a different command must preserve that investment and advance revision, or block until recovery.',lostCommittedInvestment:afterUnknown.disk.assets===initial.assets+10000&&afterNext.disk.assets===initial.assets,revisionReused:afterUnknown.disk.revision===afterNext.disk.revision};
 fs.writeFileSync(path.join(__dirname,'transaction-review.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
