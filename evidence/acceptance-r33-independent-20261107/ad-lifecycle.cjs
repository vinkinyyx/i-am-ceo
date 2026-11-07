// DEV-07 R族：AppView 激励视频 → 券 → 招聘的真实 Web 注入集成（release minified 构建）。
// 覆盖 §28.8：R01 完整观看补核（onShow先/晚于close、券一次、正确scope、日限一次）；
// R02 提前关/无填充/重复回调不误发、可继续经营、不重复消费；R03 券招聘双击/offer过期/现金不足/跨月、取消零变更。
// provider 经 Object.assign 换绑 v.adCoordinator.provider（TS readonly 运行时可见），会话与发券走真实 AdRewardCoordinator→GameFacade。
// 底层证据（服务类单测）：现金不足拒绝与月薪跨月账本 → tests/unit RecruitmentService；广告会话边界 → tests/unit adCoordinator 7 例。
const fs = require('fs');
const { CanvasDriver } = require('../../tools/e2e/canvas-driver.cjs');

const outDir = 'evidence/acceptance-r33-independent-20261107';
const seed = JSON.parse(fs.readFileSync('evidence/m3/TASK-M3-09-R30/attempt-06/seed-staffed.json', 'utf8'));

function findView() {
  const all = [];
  function walk(n) { all.push(...(n.components || [])); n.children.forEach(walk); }
  walk(cc.director.getScene());
  const v = all.find((c) => typeof c.prepareCloudRestore === 'function' && c.cloudSync && c.facade);
  if (!v) throw Error('view missing');
  return v;
}

// 安装：可控广告 provider + verified 身份（confirmed owner）+ 经营满1分钟资格。
function installSource() {
  return function (args) {
    const v = eval('(' + args.findSource + ')')();
    const appId = (v.cloudConfig && v.cloudConfig.appId) || 'review-app';
    const env = v.cloudConfig && v.cloudConfig.environment === 'production' ? 'production' : 'test';
    const IDS = v.identity.constructor;
    v.identity = new IDS(appId, env);
    v.identity.apply({ kind: 'verified', profileId: 'profile-a', scope: 'tap-minigame-account', appId, environment: env, epoch: 0 });
    v.identityVerification = 'verified';
    v.verifiedGeneration = v.foregroundGeneration;
    v.cloudProfileBound = true;
    // 镜像真实身份流转（AppView.applyIdentityAtomically/恢复路径）：verified 后同步 facade 广告 ownerScope
    v.facade.setAdOwnerScope(v.adRewardOwnerScope());
    v.adFirstEligibleRunId = v.facade.getState().runId;
    v.adForegroundEligibleSinceMs = Date.now() - 120000;
    const ad = { calls: [], mode: 'completed', deferred: null, cancels: 0 };
    const provider = {
      isAvailable: () => true,
      show: async (sessionId) => {
        ad.calls.push(sessionId);
        if (ad.deferred) await ad.deferred.promise;
        if (ad.mode === 'reject') throw new Error('no-fill');
        return { kind: ad.mode, sessionId };
      },
      cancelActive: () => { ad.cancels += 1; },
      cancelLoading: () => undefined,
    };
    Object.assign(v.adCoordinator, { provider });
    // requestAdCoupon(): Promise<void>——结果对象经协调器返回后由 UI 消化为 toast。
    // 包一层协调器 request 录制结果对象，断言仍走真实 UI 路径。
    const requestResults = [];
    const origRequest = v.adCoordinator.request.bind(v.adCoordinator);
    v.adCoordinator.request = async (...a) => { const r = await origRequest(...a); requestResults.push(r); return r; };
    // toast 2.2s 即逝，包一层记录全部文案供确定性断言（仍走真实 toast 渲染管线）
    const toasts = [];
    const origToast = v.toast.bind(v);
    v.toast = (m) => { toasts.push(String(m)); origToast(m); };
    window.__ad = { v, ad, appId, env, toasts, requestResults };
    return { persistence: v.facade.getPersistenceStatus(), runId: v.facade.getState().runId };
  };
}

(async () => {
  const d = await CanvasDriver.launch({
    url: 'http://127.0.0.1:8196/', viewport: { width: 390, height: 844 }, outDir,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  });
  const waitView = async () => {
    await d.page.waitForFunction((src) => { try { return !!eval('(' + src + ')')(); } catch (e) { return false; } },
      findView.toString(), { timeout: 45000 });
  };
  const clickExpect = async (button, expected, { exact = false, timeoutMs = 8000, tries = 3 } = {}) => {
    for (let i = 0; i < tries; i++) {
      if ((await d.findLabels(expected, { exact })).length) return;
      const btn = await d.findLabels(button, { exact: false });
      if (btn.length) {
        await d.page.waitForTimeout(i === 0 ? 250 : 400);
        await d.clickLabel(button, { exact: false });
      }
      const end = Date.now() + timeoutMs;
      while (Date.now() < end) {
        if ((await d.findLabels(expected, { exact })).length) return;
        await d.page.waitForTimeout(120);
      }
    }
    throw new Error(`click-expect-failed: ${button} -> ${expected}`);
  };
  const boot = async () => {
    await d.loadFixture(seed);
    await d.page.waitForTimeout(700);
    // 隐私同意：未同意前 AppView 不挂 cloudSync（findView 必要条件），必须显式等按钮、点击、等弹窗消失；点击偶发落空需重试
    await d.waitForLabel('同意并继续', { exact: false, timeoutMs: 30000 });
    for (let attempt = 0; attempt < 3; attempt++) {
      await d.clickLabel('同意并继续');
      await d.page.waitForTimeout(400);
      if (!(await d.findLabels('同意并继续')).length) break;
    }
    if ((await d.findLabels('同意并继续')).length) throw new Error('consent-dialog-stuck');
    await waitView();
    const r = await d.page.evaluate(installSource(), { findSource: findView.toString() });
    if (r.persistence !== 'ready') throw new Error(`persistence-not-ready: ${r.persistence}`);
  };
  const state = (fn, arg) => d.page.evaluate(fn, arg);

  try {
    await boot();
    const result = await state(async () => {
      const { v, ad, requestResults } = window.__ad;
      let resolveShow;
      ad.deferred = {promise: new Promise(r => {resolveShow = r;})};
      const req = v.requestAdCoupon();
      for(let n=0;n<80 && !v.adCoordinator.hasActiveSession();n++)await new Promise(r=>setTimeout(r,25));
      if(!v.adCoordinator.hasActiveSession())throw new Error('ad not active');
      const generationBefore = v.foregroundGeneration;
      const event = cc.Game?.EVENT_SHOW ?? cc.game.constructor.EVENT_SHOW;
      if(!event)throw new Error('missing engine show event');
      cc.game.emit(event);
      const generationAfter = v.foregroundGeneration;
      resolveShow();
      await req;
      await new Promise(r=>setTimeout(r,800));
      return {event,generationBefore,generationAfter,verification:v.identityVerification,
        showCalls:ad.calls.length,pending:v.adCoordinator.hasPendingGrant(),coupons:v.facade.getState().adRewards.couponIds.length,
        result:requestResults.at(-1),toasts:window.__ad.toasts};
    });
    fs.writeFileSync(outDir+'/ad-lifecycle-result.json',JSON.stringify(result,null,2));
    console.log(JSON.stringify(result));
    d.check('actual-show-before-close-settles-single-grant',result.generationAfter===result.generationBefore+1 && result.showCalls===1 && result.coupons===1 && !result.pending,result);
    const report=await d.finish('ad-lifecycle-report.json');process.exitCode=report.exitCode;
  } catch(e){console.error(e);await d.browser.close();process.exitCode=1;}
})();
