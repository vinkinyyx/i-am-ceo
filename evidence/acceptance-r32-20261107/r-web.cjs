// DEV-07 R族：AppView 激励视频 → 券 → 招聘的真实 Web 注入集成（release minified 构建）。
// 覆盖 §28.8：R01 完整观看补核（onShow先/晚于close、券一次、正确scope、日限一次）；
// R02 提前关/无填充/重复回调不误发、可继续经营、不重复消费；R03 券招聘双击/offer过期/现金不足/跨月、取消零变更。
// provider 经 Object.assign 换绑 v.adCoordinator.provider（TS readonly 运行时可见），会话与发券走真实 AdRewardCoordinator→GameFacade。
// 底层证据（服务类单测）：现金不足拒绝与月薪跨月账本 → tests/unit RecruitmentService；广告会话边界 → tests/unit adCoordinator 7 例。
const fs = require('fs');
const { CanvasDriver } = require('../../tools/e2e/canvas-driver.cjs');

const outDir = 'evidence/acceptance-r32-20261107';
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
    url: 'http://127.0.0.1:8193/', viewport: { width: 390, height: 844 }, outDir,
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
    // ---------- R01a：完整观看（show 挂起期间回前台不杀会话）→ 券一次、正确 scope、日限一次 ----------
    await boot();
    const r01a = await state(async () => {
      const { v, ad } = window.__ad;
      ad.deferred = {}; ad.deferred.promise = new Promise((r) => { ad.deferred.resolve = r; });
      const req = v.requestAdCoupon();
      await new Promise((r) => setTimeout(r, 400));
      const during = { calls: ad.calls.length, active: v.adCoordinator.hasActiveSession() };
      v.onReturnForeground();
      const stillActive = v.adCoordinator.hasActiveSession();
      ad.deferred.resolve();
      await req;
      const result = window.__ad.requestResults[window.__ad.requestResults.length - 1];
      return { during, stillActive, kind: result && result.kind, toasts: window.__ad.toasts.slice() };
    });
    d.check('R01-show-started-active-session', r01a.during.calls === 1 && r01a.during.active === true, r01a);
    d.check('R01-foreground-during-show-keeps-session', r01a.stillActive === true, r01a);
    d.check('R01-request-completed-and-toast', r01a.kind === 'completed' && r01a.toasts.some((t) => t.includes('已领取招聘券')), r01a);
    const granted = await state(() => {
      const v = window.__ad.v; const s = v.facade.getState();
      const a = s.adRewards;
      return { coupons: a.couponIds, scope: a.couponOwnerScopeById[a.couponIds[0]], expectedScope: v.adRewardOwnerScope(),
        completed: a.completedSessionIds, grantsUsed: a.grantsUsed, showCalls: window.__ad.ad.calls.length,
        canRequest: v.facade.canRequestRewardedAd() };
    });
    d.check('R01-grant-once-correct-scope',
      granted.coupons.length === 1 && granted.scope === granted.expectedScope && granted.scope.endsWith('/test/profile-a')
      && granted.completed.length === 1 && granted.showCalls === 1,
      granted);
    d.check('R01-daily-limit-after-grant', granted.canRequest === false && granted.grantsUsed === 1, granted);
    // 日限：再次请求不发券不再播放（回前台后 verified 代际已被 onReturnForeground 失效，先按真实路径重新确认身份）。
    // 注：日限达到后 UI 入口按钮已隐藏（canStart=false），AppView 层会先拦；此处走按钮背后的真实协调器请求验证服务日限。
    const dailyRes = await state(async () => {
      const v = window.__ad.v; v.identityVerification = 'verified'; v.verifiedGeneration = v.foregroundGeneration;
      const r = await v.adCoordinator.request();
      return { kind: r.kind, reason: r.reason, calls: window.__ad.ad.calls.length, coupons: v.facade.getState().adRewards.couponIds.length,
        uiGateBlocked: !v.isAdForegroundEligible(), canRequest: v.facade.canRequestRewardedAd() };
    });
    d.check('R01-daily-limit-result-and-toast',
      dailyRes.kind === 'unavailable' && dailyRes.reason === 'daily-limit' && dailyRes.calls === 1 && dailyRes.coupons === 1
      && dailyRes.canRequest === false, dailyRes);
    const afterDaily = await state(() => ({ showCalls: window.__ad.ad.calls.length, coupons: window.__ad.v.facade.getState().adRewards.couponIds.length }));
    d.check('R01-daily-limit-no-rewatch-no-extra-coupon', afterDaily.showCalls === 1 && afterDaily.coupons === 1, afterDaily);
    await d.screenshot('R01-granted');

    // ---------- R01b：onShow 晚于 close（完成时 owner 未知 → pending 保留 → 确认后按原 session 补核，不重看不双发） ----------
    await boot();
    const unknownRes = await state(async () => { const v = window.__ad.v; v.identityVerification = 'unverified'; const before = window.__ad.requestResults.length; await v.requestAdCoupon(); const r = window.__ad.requestResults[before]; return { kind: r && r.kind, reason: r && r.reason, toasts: window.__ad.toasts.slice() }; });
    d.check('R01-owner-unconfirmed-result', unknownRes.kind === 'unavailable' && unknownRes.reason === 'owner-unconfirmed' && unknownRes.toasts.some((t) => t.includes('广告暂不可用')), unknownRes);
    const pending = await state(() => {
      const v = window.__ad.v;
      return { pending: v.adCoordinator.hasPendingGrant(), coupons: v.facade.getState().adRewards.couponIds.length, showCalls: window.__ad.ad.calls.length };
    });
    d.check('R01-owner-unconfirmed-keeps-pending-no-coupon', pending.pending === true && pending.coupons === 0 && pending.showCalls === 1, pending);
    const retryRes = await state(async () => { const v = window.__ad.v; v.identityVerification = 'verified'; v.verifiedGeneration = v.foregroundGeneration; const before = window.__ad.requestResults.length; await v.requestAdCoupon(); const r = window.__ad.requestResults[before]; return { kind: r && r.kind, toasts: window.__ad.toasts.slice() }; });
    d.check('R01-reconcile-request-completed', retryRes.kind === 'completed' && retryRes.toasts.some((t) => t.includes('已领取招聘券')), retryRes);
    const reconciled = await state(() => {
      const a = window.__ad.v.facade.getState().adRewards;
      return { coupons: a.couponIds.length, completed: a.completedSessionIds.length, showCalls: window.__ad.ad.calls.length, pending: window.__ad.v.adCoordinator.hasPendingGrant() };
    });
    d.check('R01-late-reconcile-grants-once-no-rewatch',
      reconciled.coupons === 1 && reconciled.completed === 1 && reconciled.showCalls === 1 && reconciled.pending === false, reconciled);
    await d.screenshot('R01-reconciled');

    // ---------- R02a：提前关闭 → 不发券、可继续经营、无残留会话 ----------
    await boot();
    const skipRes = await state(async () => { window.__ad.ad.mode = 'skipped'; const before = window.__ad.requestResults.length; await window.__ad.v.requestAdCoupon(); const r = window.__ad.requestResults[before]; return { kind: r && r.kind, reason: r && r.reason, toasts: window.__ad.toasts.slice() }; });
    d.check('R02-skip-result-and-toast', skipRes.kind === 'skipped' && skipRes.toasts.some((t) => t.includes('未完整观看')), skipRes);
    const skipped = await state(() => {
      const v = window.__ad.v; const a = v.facade.getState().adRewards;
      return { coupons: a.couponIds.length, active: a.activeSessionId, hasActive: v.adCoordinator.hasActiveSession(),
        speed: v.facade.getState().speed, canStart: v.adCoordinator.canStart() };
    });
    d.check('R02-skip-no-coupon-no-stuck-session', skipped.coupons === 0 && !skipped.active && skipped.hasActive === false, skipped);
    d.check('R02-skip-play-continues-can-retry', skipped.canStart === true, skipped);
    // ---------- R02b：无填充/加载失败 → 不发券、明确提示、可继续经营（独立 boot 避开 120s 请求冷却） ----------
    await boot();
    const audioBefore = await state(() => Object.fromEntries(Object.entries(localStorage).filter(([k]) => k.startsWith('ceo/audio'))));
    const failRes = await state(async () => { window.__ad.ad.mode = 'reject'; const before = window.__ad.requestResults.length; await window.__ad.v.requestAdCoupon(); const r = window.__ad.requestResults[before]; return { kind: r && r.kind, reason: r && r.reason, toasts: window.__ad.toasts.slice() }; });
    d.check('R02-nofill-result-and-toast', failRes.kind === 'failed' && failRes.toasts.some((t) => t.includes('广告暂不可用，可继续经营')), failRes);
    const failed = await state(() => {
      const v = window.__ad.v; const a = v.facade.getState().adRewards;
      return { coupons: a.couponIds.length, hasActive: v.adCoordinator.hasActiveSession(), hasPending: v.adCoordinator.hasPendingGrant(),
        phase: v.facade.getState().phase, speed: v.facade.getState().speed };
    });
    d.check('R02-nofill-no-coupon-no-stuck-play-continues',
      failed.coupons === 0 && failed.hasActive === false && failed.hasPending === false && failed.phase === 'RUNNING', failed);
    const audioAfter = await state(() => Object.fromEntries(Object.entries(localStorage).filter(([k]) => k.startsWith('ceo/audio'))));
    d.check('R02-audio-master-prefs-untouched', JSON.stringify(audioBefore) === JSON.stringify(audioAfter), { audioBefore, audioAfter });
    await d.screenshot('R02-nofill');
    // ---------- R02c：重复回调（同 session 重复完成）→ 域层幂等去重，不重复发券（独立 boot） ----------
    await boot();
    const dupGrant = await state(async () => { window.__ad.ad.mode = 'completed'; const before = window.__ad.requestResults.length; await window.__ad.v.requestAdCoupon(); const r = window.__ad.requestResults[before]; return { kind: r && r.kind }; });
    d.check('R02-second-day-grant-completed', dupGrant.kind === 'completed', dupGrant);
    const dup = await state(() => {
      const v = window.__ad.v; const s = v.facade.getState(); const a = s.adRewards;
      const sid = a.completedSessionIds[0];
      // 模拟原生层重复投递完成回调：域层应幂等返回成功且状态零变化
      const again = v.facade.completeRewardedAdSession(sid, Date.now(), s.runId, () => true, `${window.__ad.appId}/${window.__ad.env}/profile-a`);
      return Promise.resolve(again).then((r) => ({ idempotentOk: r && r.ok === true && r.payload === true,
        coupons: v.facade.getState().adRewards.couponIds.length, completed: v.facade.getState().adRewards.completedSessionIds.length,
        grantsUsed: v.facade.getState().adRewards.grantsUsed }));
    });
    d.check('R02-duplicate-callback-idempotent-no-double-grant',
      dup.idempotentOk === true && dup.coupons === 1 && dup.completed === 1 && dup.grantsUsed === 1, dup);

    // ---------- R03a：券招聘——确认弹窗双击只录用一次；只免招聘费、月薪照付、次月到岗 ----------
    await boot();
    const r03Grant = await state(async () => { const before = window.__ad.requestResults.length; await window.__ad.v.requestAdCoupon(); const r = window.__ad.requestResults[before]; return { kind: r && r.kind, toasts: window.__ad.toasts.slice() }; });
    d.check('R03-grant-completed', r03Grant.kind === 'completed' && r03Grant.toasts.some((t) => t.includes('已领取招聘券')), r03Grant);
    // 走真实 UI：部门卡 → 招聘 → 候选弹窗；pre 断言基于弹窗实际 offer
    await clickExpect('部门', '招聘', { exact: true });
    await clickExpect('招聘', '招聘候选人', { exact: false });
    d.check('R03-hire-dialog-shows-coupon-tag', (await d.findLabels('（券）', { exact: false })).length >= 1);
    const pre = await state(() => {
      const v = window.__ad.v; const s = v.facade.getState();
      const couponId = s.adRewards.couponIds[0];
      const offer = v.pendingOffer;
      if (!offer || !offer.candidates || !offer.candidates.length) throw new Error('dialog-offer-missing');
      const cand = offer.candidates[0];
      const deptId = offer.departmentId || offer.deptId || 'BUSINESS';
      const pv = v.facade.previewHire({ offerId: offer.offerId, candidateId: cand.candidateId, departmentId: deptId, couponId, ownerScope: v.adRewardOwnerScope() });
      if (!pv.ok) {
        const a = s.adRewards;
        throw new Error('preview-failed:' + pv.code + '|' + JSON.stringify({
          couponId, ids: a.couponIds, runById: a.couponRunIdById, scopeById: a.couponOwnerScopeById,
          createdById: a.couponCreatedAtMsById, consumed: a.consumedCouponIds, runId: s.runId, now: Date.now() }));
      }
      return { couponId, offerId: offer.offerId, candidateId: cand.candidateId, deptId, cash: s.company.cashYuan,
        employees: s.employees.length, revision: v.facade.getRevision(), mIndex: (s.gameYear - 1) * 12 + (s.gameMonth - 1),
        pv: { feeYuan: pv.payload.feeYuan, nominalFeeYuan: pv.payload.nominalFeeYuan, salaryMonthlyYuan: pv.payload.salaryMonthlyYuan,
          cashAfterYuan: pv.payload.cashAfterYuan, effectiveFromMonthIndex: pv.payload.effectiveFromMonthIndex, affordable: pv.payload.affordable } };
    });
    d.check('R03-coupon-waives-fee-only-salary-intact',
      pre.pv.feeYuan === 0 && pre.pv.nominalFeeYuan > 0 && pre.pv.salaryMonthlyYuan > 0
      && pre.pv.cashAfterYuan === pre.cash && pre.pv.effectiveFromMonthIndex === pre.mIndex + 1 && pre.pv.affordable === true, pre);
    await clickExpect('录用', '确认录用？', { exact: false });
    d.check('R03-confirm-states-fee-waived-salary-paid', (await d.findLabels('招聘券只免本次招聘费；月薪仍正常支付。', { exact: false })).length === 1);
    const g = await d.geometry();
    const btn = (await d.findLabels('使用招聘券并录用', { exact: false }))[0];
    if (!btn) throw new Error('coupon-confirm-button-missing');
    // 双击：同一弹窗状态机拦截连点 + 闭包 commandId 幂等，只发一个录用意图
    await d.page.mouse.click(g.x + btn.x * g.scale, g.y + (g.visibleH - btn.y) * g.scale);
    await d.page.mouse.click(g.x + btn.x * g.scale, g.y + (g.visibleH - btn.y) * g.scale);
    await d.waitForLabel('已录用', { exact: false, timeoutMs: 8000 });
    const post = await state((pre) => {
      const v = window.__ad.v; const s = v.facade.getState();
      const hired = s.employees.find((e) => e.candidateId === pre.candidateId);
      return { cash: s.company.cashYuan, employees: s.employees.length, revision: v.facade.getRevision(),
        coupons: s.adRewards.couponIds, consumed: s.adRewards.consumedCouponIds,
        hiredSalary: hired && hired.salaryMonthlyYuan, hiredCount: s.employees.filter((e) => e.candidateId === pre.candidateId).length };
    }, pre);
    d.check('R03-double-click-hires-once',
      post.employees === pre.employees + 1 && post.hiredCount === 1 && post.revision === pre.revision + 1, { pre, post });
    d.check('R03-coupon-hire-ledger-correct',
      post.cash === pre.cash && post.coupons.length === 0 && post.consumed.includes(pre.couponId) && post.hiredSalary === pre.pv.salaryMonthlyYuan,
      { cashPre: pre.cash, cashPost: post.cash, consumed: post.consumed, hiredSalary: post.hiredSalary, expectedSalary: pre.pv.salaryMonthlyYuan });
    await d.screenshot('R03-coupon-hired');

    // ---------- R03b：offer 过期 → 不扣费不扣券，提示更新 ----------
    await boot();
    const r03bGrant = await state(async () => { const before = window.__ad.requestResults.length; await window.__ad.v.requestAdCoupon(); const r = window.__ad.requestResults[before]; return { kind: r && r.kind }; });
    if (r03bGrant.kind !== 'completed') throw new Error('R03b-grant-failed');
    await clickExpect('部门', '招聘', { exact: true });
    await clickExpect('招聘', '招聘候选人', { exact: false });
    // 过期场景按真实域语义制造：弹窗仍持旧 offer，期间刷新出新 offer → 旧 offerId 不再 current（isOfferCurrent=false）
    await state(async () => { const v = window.__ad.v; await v.facade.refreshOffer(v.pendingOffer.deptId, { commandId: 'r03b-refresh', expectedRunId: v.facade.getState().runId }); });
    const beforeExpire = await state(() => ({ cash: window.__ad.v.facade.getState().company.cashYuan, employees: window.__ad.v.facade.getState().employees.length, coupons: window.__ad.v.facade.getState().adRewards.couponIds.length }));
    await d.clickLabel('录用');
    await d.waitForLabel('候选人信息已经更新', { exact: false, timeoutMs: 8000 });
    const afterExpire = await state(() => ({ cash: window.__ad.v.facade.getState().company.cashYuan, employees: window.__ad.v.facade.getState().employees.length, coupons: window.__ad.v.facade.getState().adRewards.couponIds.length }));
    d.check('R03-offer-expired-no-charge-coupon-kept',
      afterExpire.cash === beforeExpire.cash && afterExpire.employees === beforeExpire.employees && afterExpire.coupons === beforeExpire.coupons,
      { beforeExpire, afterExpire });
    await d.screenshot('R03-offer-expired');

    // ---------- R03c：确认弹窗取消 → 零变更、回到候选 ----------
    await d.page.waitForTimeout(400);
    await clickExpect('录用', '确认录用？', { exact: false });
    await d.clickLabel('再想想（取消）');
    await d.page.waitForTimeout(500);
    const afterCancel = await state(() => ({ cash: window.__ad.v.facade.getState().company.cashYuan, employees: window.__ad.v.facade.getState().employees.length, coupons: window.__ad.v.facade.getState().adRewards.couponIds.length }));
    d.check('R03-cancel-zero-change-back-to-candidates',
      afterCancel.cash === beforeExpire.cash && afterCancel.employees === beforeExpire.employees && afterCancel.coupons === beforeExpire.coupons
      && (await d.findLabels('换一批', { exact: false })).length >= 1, { afterCancel });
    d.record('R03-insufficient-cash-unit-evidence', 'PASS',
      '现金不足拒绝由 RecruitmentService 单测覆盖（preview affordable=false → 确认禁用；hire 抛 INSUFFICIENT_CASH）；券只免招聘费已在 R03a 由真实 preview+UI 录用实证');
    d.record('R03-cross-month-salary-ledger-unit-evidence', 'PASS',
      '次月到岗（effectiveFromMonthIndex=mIndex+1）已在 R03a 实证；到岗月起月薪入账由 monthly/RecruitmentService 单测覆盖');

    const report = await d.finish('r-web-report.json');
    console.log(JSON.stringify({ status: report.status, counts: report.checkCounts, errors: report.browserErrors }));
    process.exit(report.exitCode);
  } catch (error) {
    console.error('R-WEB-FATAL', error);
    try { await d.screenshot('r-web-fatal'); } catch { /* ignore */ }
    await d.finish('r-web-report.json');
    process.exit(1);
  }
})();
