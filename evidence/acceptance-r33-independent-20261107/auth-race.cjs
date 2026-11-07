const fs=require('fs'), ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,f);
const {AuthService,SESSION_STORAGE_KEY}=require('../../assets/core/platform/AuthService.ts');
function fixture(){
  let count=0, stored=null, release, markStarted;
  const held=new Promise(r=>release=r), started=new Promise(r=>markStarted=r);
  const p={getEnvironment:()=> 'TAPTAP', login:async()=>({code:String(++count)}),
    request:async r=>({statusCode:200,data:{protocolVersion:1,sessionToken:'fixture',expiresInSec:900,
      profileId:r.data.code==='1'?'tap_profileA':'tap_profileB',appId:'1016161',environment:'test',scope:'tap-minigame-account'}}),
    get:async()=>stored,set:async(_k,s)=>{if(s.profile.profileId==='tap_profileA'){markStarted();await held;}stored=s;}};
  const auth=new AuthService(p,{endpoint:'https://identity.example.com'});
  auth.setExpectedScope('1016161','test');return {auth,p,started,release};
}
const guard=setTimeout(()=>{console.error('probe timed out');process.exit(1);},5000);
(async()=>{
  const a=fixture();let gen=1;
  const one=a.auth.refreshCurrentIdentity({reason:'foreground',generation:1,stillCurrent:()=>gen===1});
  await a.started;gen=2;
  const two=await a.auth.refreshCurrentIdentity({reason:'foreground',generation:2,stillCurrent:()=>gen===2});
  a.release();const old=await one;
  const delayed={old:old.kind,current:two.kind,memory:(await a.auth.currentSession()).profile.profileId,disk:(await a.p.get(SESSION_STORAGE_KEY)).profile.profileId};
  const b=fixture();const stale=b.auth.refreshCurrentIdentity({reason:'foreground',generation:1,stillCurrent:()=>false});
  await b.started;b.release();
  const superseded={result:(await stale).kind,disk:(await b.p.get(SESSION_STORAGE_KEY)).profile.profileId};
  const result={delayed,superseded};
  fs.writeFileSync('evidence/acceptance-r33-independent-20261107/auth-race.json',JSON.stringify(result,null,2));console.log(result);
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>clearTimeout(guard));
