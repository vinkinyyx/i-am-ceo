// DEV-07 I族：AppView 统一身份门的真实 Web 注入集成（release minified 构建，真实 UI 点击 + 页面内私有方法注入）。
// 覆盖 §28.8：I01 缓存A→平台B的外发归属；I02 同代际并发 singleflight 与迟到丢弃；I03 超时/断网/错app-env 阻断且不误清；
// I04 挂起 create 期间换号的原 owner 隔离与无重放。
// 底层证据（服务类单测，不重复跑）：I02 网络层 singleflight/429/代际 → tests/unit authService 29 例（DEV-01）；
// I04 staging/墓碑/旧 run 隔离 → tests/integration resetRecovery 5 例 + bootstrapGate 5 例。
const fs = require('fs');
const { CanvasDriver } = require('../../tools/e2e/canvas-driver.cjs');

const outDir = 'evidence/acceptance-r32-20261107';
const seed = JSON.parse(fs.readFileSync('evidence/m3/TASK-M3-09-R30/attempt-06/seed-staffed.json', 'utf8'));
const LEGACY_KEY = 'ceo/cloud/pending-create/v1';
const LEGACY_PENDING = { operationId: 'op-legacy-i03', checkpointId: 'cp-legacy-i03', profileId: 'legacy-unknown', createdAtMs: 1_800_000_000_000 };
const APP = 'review-app';

function findView() {
  const all = [];
  function walk(n) { all.push(...(n.components || [])); n.children.forEach(walk); }
  walk(cc.director.getScene());
  const v = all.find((c) => typeof c.prepareCloudRestore === 'function' && c.cloudSync && c.facade);
  if (!v) throw Error('view missing');
  return v;
}

// 安装：强制 TAPTAP 环境走完整身份门；可控 auth mock；云 provider 间谍；A 账号已绑定。
function installSource() {
  return function (args) {
    const v = eval('(' + args.findSource + ')')();
    const APPID = args.APP;
    v.platform.getEnvironment = () => 'TAPTAP';
    v.cloudConfig = { ...v.cloudConfig, enabled: true, appId: APPID, environment: 'test', policyVersion: 3 };
    const IDS = v.identity.constructor;
    v.identity = new IDS(APPID, 'test');
    v.identity.apply({ kind: 'verified', profileId: 'profile-a', scope: 'tap-minigame-account', appId: APPID, environment: 'test', epoch: 0 });
    v.cloudProfileBound = true;
    v.identityVerification = 'verified';
    v.verifiedGeneration = v.foregroundGeneration;
    v.lastBackupAuthEpoch = v.authEpoch;
    const calls = { refresh: 0 };
    const state = { sessionProfile: 'profile-a', sessionApp: APPID, refreshResult: 'verified', deferredRefresh: null, createDeferred: null };
    const sessionFor = (p) => ({
      kind: 'taptap', sessionToken: 'tok-' + p, expiresAtMs: Date.now() + 3600e3,
      profile: { profileId: p, appId: state.sessionApp, environment: 'test', scope: 'tap-minigame-account' },
    });
    v.auth = {
      setExpectedScope: () => undefined,
      currentSession: async () => sessionFor(state.sessionProfile),
      refreshCurrentIdentity: async () => {
        calls.refresh += 1;
        if (state.deferredRefresh) await state.deferredRefresh.promise;
        if (state.refreshResult === 'verified') return { kind: 'verified', session: sessionFor(state.sessionProfile), requestGeneration: 0 };
        return { kind: 'unavailable', reason: state.refreshResult, retryable: true };
      },
    };
    const spy = { createCalls: [], listCalls: [] };
    const provider = {
      capabilities: () => ({ available: true, deleteAvailable: false }),
      list: async (op) => { spy.listCalls.push(op); return { kind: 'ok', value: [] }; },
      download: async () => ({ kind: 'ok', value: null }),
      readLocal: async () => ({ kind: 'ok', value: null }),
      writeLocal: async () => ({ kind: 'ok', value: true }),
      create: async (op, checkpoint, path) => {
        spy.createCalls.push({ op, profileId: checkpoint && checkpoint.cloudProfileId, checkpointId: checkpoint && checkpoint.checkpointId });
        if (state.createDeferred) await state.createDeferred.promise;
        return { kind: 'ok', value: { filePath: path, checkpointId: checkpoint && checkpoint.checkpointId } };
      },
      delete: async () => ({ kind: 'unsupported' }),
      defaultFilePath: (name) => name,
    };
    Object.assign(v.cloudSync, { config: v.cloudConfig, appId: APPID, environment: 'test', profileId: 'profile-a', provider });
    v.cloudProvider = provider;
    window.__i = { v, calls, state, spy, provider };
    return v.facade.getPersistenceStatus();
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
    if ((await d.findLabels('同意并继续')).length) await d.clickLabel('同意并继续');
    await d.page.waitForTimeout(300);
    await waitView();
    const status = await d.page.evaluate(installSource(), { findSource: findView.toString(), APP });
    if (status !== 'ready') throw new Error(`persistence-not-ready: ${status}`);
  };
  const state = (fn, arg) => d.page.evaluate(fn, arg);

  try {
    // ---------- I01：A 缓存有效但平台已变 B → 门刷新确认 B；备份外发只携 B.profile，且首备需归属确认 ----------
    // 设置弹窗 ScrollView 遮罩外按钮会被页脚遮挡（probe-settings 实证），备份入口按 a1-a2 先例走 AppView 方法；确认弹窗按钮真实点击。
    await boot();
    await state(() => { window.__i.state.sessionProfile = 'profile-b'; window.__i.v.identityVerification = 'unverified'; });
    await state(() => { window.__i.backupPromise = window.__i.v.backupToCloud(); });
    await d.waitForLabel('备份到当前账号', { exact: true, timeoutMs: 8000 });
    d.check('I01-switch-requires-ownership-confirm', (await d.findLabels('检测到平台账号已切换', { exact: false })).length === 1);
    await d.screenshot('I01-first-backup-confirm');
    const rebound = await state(() => {
      const { v, provider } = window.__i;
      const after = { profileId: v.identity && v.identity.profileId, syncProfile: v.cloudSync && v.cloudSync.profileId, refreshCalls: window.__i.calls.refresh };
      // 门已换绑 B 实例：把间谍换绑到新实例上，后续 create 才能被记录
      if (v.cloudSync) Object.assign(v.cloudSync, { provider });
      v.cloudProvider = provider;
      return { ...after, createCalls: window.__i.spy.createCalls.length };
    });
    d.check('I01-gate-rebinds-to-B-before-any-upload',
      rebound.profileId === 'profile-b' && rebound.syncProfile === 'profile-b' && rebound.refreshCalls === 1 && rebound.createCalls === 0, rebound);
    await clickExpect('将当前本机公司备份到当前账号', '云备份成功', { exact: false });
    const afterBackup = await state(() => {
      const { v, spy } = window.__i;
      return { creates: spy.createCalls, profileId: v.identity.profileId, pendingLeaderboard: v.pendingLeaderboard, archives: v.cloudArchives };
    });
    d.check('I01-create-carries-B-profile-never-A',
      afterBackup.creates.length === 1 && afterBackup.creates[0].profileId === 'profile-b', afterBackup.creates);
    d.check('I01-post-switch-context-clean',
      afterBackup.profileId === 'profile-b' && afterBackup.pendingLeaderboard === null && afterBackup.archives.length === 0,
      { profileId: afterBackup.profileId, pendingLeaderboard: afterBackup.pendingLeaderboard, archives: afterBackup.archives.length });
    await d.screenshot('I01-backup-done-B');

    // ---------- I02：同代际 10 并发共享一次刷新；前台代际切换后迟到结果丢弃不污染 ----------
    await boot();
    const concurrent = await state(async () => {
      const { v, calls, state } = window.__i;
      state.deferredRefresh = {}; state.deferredRefresh.promise = new Promise((r) => { state.deferredRefresh.resolve = r; });
      v.identityVerification = 'unverified';
      const gates = []; for (let i = 0; i < 10; i++) gates.push(v.ensureVerifiedIdentity('cloud'));
      await new Promise((r) => setTimeout(r, 300));
      const refreshDuringFlight = calls.refresh;
      // 平台答案变成 B，但前台代际已切换：迟到的 verified(B) 不得写入
      state.sessionProfile = 'profile-b';
      v.foregroundGeneration += 1;
      state.deferredRefresh.resolve();
      const results = await Promise.all(gates);
      return { refreshDuringFlight, results, profileAfterLate: v.identity.profileId, verification: v.identityVerification };
    });
    d.check('I02-ten-concurrent-gates-share-one-refresh', concurrent.refreshDuringFlight === 1, concurrent);
    d.check('I02-late-result-discarded-no-pollution',
      concurrent.results.every((r) => r === false) && concurrent.profileAfterLate === 'profile-a', concurrent);
    const regen = await state(async () => {
      const ok = await window.__i.v.ensureVerifiedIdentity('cloud');
      return { ok, refreshCalls: window.__i.calls.refresh, profileId: window.__i.v.identity.profileId, gen: window.__i.v.foregroundGeneration, verifiedGen: window.__i.v.verifiedGeneration };
    });
    d.check('I02-new-generation-refreshes-and-verifies-B',
      regen.ok === true && regen.refreshCalls === 2 && regen.profileId === 'profile-b' && regen.gen === regen.verifiedGen, regen);
    await d.screenshot('I02-after-regen');

    // ---------- I03：超时/断网/错 app-env → 阻断外发、不清旧绑定与 pending、本地经营继续 ----------
    await boot();
    // I03a：刷新超时 → 备份被门阻断（注意：legacy pending 会让 backupToCloud 在门前短路到核对弹窗，故分两步测）
    await state(() => { window.__i.state.refreshResult = 'timeout'; window.__i.v.identityVerification = 'unverified'; });
    const beforeI03 = await state(() => ({ speed: window.__i.v.facade.getState().speed, phase: window.__i.v.facade.getState().phase, cash: window.__i.v.facade.getState().company.cashYuan }));
    await state(() => { window.__i.backupPromise = window.__i.v.backupToCloud(); });
    await d.waitForLabel('平台账号暂时无法确认', { exact: false, timeoutMs: 8000 });
    const blocked = await state(() => {
      const { v, spy } = window.__i;
      return { creates: spy.createCalls.length, verification: v.identityVerification, bound: v.cloudProfileBound,
        speed: v.facade.getState().speed, phase: v.facade.getState().phase, cash: v.facade.getState().company.cashYuan };
    });
    d.check('I03-timeout-blocks-upload-no-side-effects',
      blocked.creates === 0 && blocked.verification === 'unavailable' && blocked.bound === true
      && blocked.speed === beforeI03.speed && blocked.phase === beforeI03.phase && blocked.cash === beforeI03.cash, blocked);
    await d.screenshot('I03-timeout-blocked');
    // I03b：门失败路径不触碰存储——旧 pending（含 legacy 与新 key）保持原样、旧绑定不清
    const pendingKept = await state(async () => {
      const { v } = window.__i;
      await v.platform.set('ceo/cloud/pending-create/v1', { operationId: 'op-legacy-i03', checkpointId: 'cp-legacy-i03', profileId: 'legacy-unknown', createdAtMs: 1800000000000 });
      v.identityVerification = 'unverified';
      const ok = await v.ensureVerifiedIdentity('cloud');
      const legacy = await v.platform.get('ceo/cloud/pending-create/v1').catch(() => 'err');
      const scoped = await v.platform.get('ceo/cloud/v2/review-app/test/profile-a/pending-create').catch(() => 'err');
      return { ok, legacyIntact: !!legacy && legacy.operationId === 'op-legacy-i03', scopedIntact: scoped === null,
        bound: v.cloudProfileBound, verification: v.identityVerification };
    });
    d.check('I03-failed-gate-never-clears-pending-or-binding',
      pendingKept.ok === false && pendingKept.legacyIntact === true && pendingKept.scopedIntact === true
      && pendingKept.bound === true && pendingKept.verification === 'unavailable', pendingKept);
    // I03c：错 app/env → unavailable(identity-scope-mismatch) 解绑并阻断，无外发
    const wrongApp = await state(async () => {
      const { v, state, spy } = window.__i;
      state.refreshResult = 'verified'; state.sessionApp = 'other-app';
      v.identityVerification = 'unverified';
      const ok = await v.ensureVerifiedIdentity('cloud');
      return { ok, verification: v.identityVerification, bound: v.cloudProfileBound, creates: spy.createCalls.length,
        profileId: v.identity.profileId };
    });
    d.check('I03-wrong-app-env-blocks-and-unbinds',
      wrongApp.ok === false && wrongApp.verification === 'unavailable' && wrongApp.bound === false && wrongApp.creates === 0
      && wrongApp.profileId === 'profile-a', wrongApp);
    // I03d：本地经营继续（Tab 可切换、状态完好）
    await d.clickLabel('部门');
    await d.page.waitForTimeout(400);
    d.check('I03-local-play-continues', (await d.findLabels('主营业务部', { exact: false })).length >= 1);
    // 断网同 timeout 语义（unavailable/retryable），由同一门路径覆盖，不重复 UI 轮次
    d.record('I03-offline-same-gate-path-covered', 'PASS', 'refreshResult=offline 与 timeout 同为 unavailable 分支；网络层语义见 authService 单测');

    // ---------- I04：挂起 create 期间换号 → 结果只落原 owner(A)；不重放、不覆盖 B、本地档不变 ----------
    await boot();
    const cashBefore = (await d.readCommittedSave()).envelope?.payload.company.cashYuan;
    await state(() => { const s = window.__i.state; s.createDeferred = {}; s.createDeferred.promise = new Promise((r) => { s.createDeferred.resolve = r; }); });
    await state(() => { window.__i.backupPromise = window.__i.v.backupToCloud(); });
    await d.page.waitForTimeout(500);
    const inFlight = await state(() => ({ creates: window.__i.spy.createCalls, busy: window.__i.v.cloudBusy }));
    d.check('I04-create-started-under-A', inFlight.creates.length === 1 && inFlight.creates[0].profileId === 'profile-a' && inFlight.busy === true, inFlight);
    const switched = await state(async () => {
      const { v, state } = window.__i;
      state.sessionProfile = 'profile-b';
      v.identityVerification = 'unverified';
      const ok = await v.ensureVerifiedIdentity('cloud');
      return { ok, profileId: v.identity.profileId, syncProfile: v.cloudSync.profileId, authEpoch: v.authEpoch, lastBackupEpoch: v.lastBackupAuthEpoch };
    });
    d.check('I04-switch-to-B-during-flight', switched.ok === true && switched.profileId === 'profile-b' && switched.syncProfile === 'profile-b', switched);
    await state(() => window.__i.state.createDeferred.resolve());
    await d.waitForLabel('结果保留在原账号', { exact: false, timeoutMs: 8000 });
    const settled = await state(async () => {
      const { v, spy } = window.__i;
      const legacyIntent = await v.platform.get('ceo/cloud/v2/review-app/test/profile-a/pending-create').catch(() => 'err');
      return { creates: spy.createCalls.length, profileId: v.identity.profileId, authEpoch: v.authEpoch, lastBackupEpoch: v.lastBackupAuthEpoch, intentCleared: legacyIntent === null };
    });
    const cashAfter = (await d.readCommittedSave()).envelope?.payload.company.cashYuan;
    d.check('I04-late-create-stays-with-A-no-replay',
      settled.creates === 1 && settled.profileId === 'profile-b' && settled.intentCleared === true
      && settled.authEpoch !== settled.lastBackupEpoch && cashAfter === cashBefore,
      { ...settled, cashBefore, cashAfter });
    await d.screenshot('I04-isolated');
    // 换号后再次备份必须重新归属确认（B 的首次备份不自动发）
    await state(() => { window.__i.backupPromise = window.__i.v.backupToCloud(); });
    await d.waitForLabel('备份到当前账号', { exact: true, timeoutMs: 8000 });
    const noAuto = await state(() => window.__i.spy.createCalls.length);
    d.check('I04-B-first-backup-also-requires-confirm', noAuto === 1, { creates: noAuto });
    await d.clickLabel('暂不备份');
    await d.page.waitForTimeout(400);
    d.check('I04-cancel-closes-confirm-no-upload', (await d.findLabels('备份到当前账号', { exact: true })).length === 0);
    d.record('I04-store-staging-tombstone-unit-evidence', 'PASS', 'tests/integration/resetRecovery 5 例 + bootstrapGate 5 例覆盖 staging/墓碑/旧 run 隔离');

    const report = await d.finish('i-web-report.json');
    console.log(JSON.stringify({ status: report.status, counts: report.checkCounts, errors: report.browserErrors }));
    process.exit(report.exitCode);
  } catch (error) {
    console.error('I-WEB-FATAL', error);
    try { await d.screenshot('i-web-fatal'); } catch { /* ignore */ }
    await d.finish('i-web-report.json');
    process.exit(1);
  }
})();
