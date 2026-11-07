// DEV-07 L01：AppView 榜单回执（有限异步两榜）的真实 Web 注入集成（release minified 构建）。
// 覆盖 §28.8：两榜同 checkpoint 口径；空态（未配置榜单不影响主流程）；部分失败→pending→补发（同 checkpoint 不重发已成功榜）；
// 撤回同意阻断；换号清 pending/latest、无旧回包污染；重开（新 run）丢弃旧待补发。latest/0 规则与整数分由断言+单测共同覆盖。
// 注入：云 provider 间谍（备份成功产出真实 checkpoint）+ 榜单 provider 间谍（可控失败）+ enabled 配置与同意标志。
const fs = require('fs');
const { CanvasDriver } = require('../../tools/e2e/canvas-driver.cjs');

const outDir = 'evidence/acceptance-r32-20261107';
const seed = JSON.parse(fs.readFileSync('evidence/m3/TASK-M3-09-R30/attempt-06/seed-staffed.json', 'utf8'));
const APP = 'review-app';

function findView() {
  const all = [];
  function walk(n) { all.push(...(n.components || [])); n.children.forEach(walk); }
  walk(cc.director.getScene());
  const v = all.find((c) => typeof c.prepareCloudRestore === 'function' && c.cloudSync && c.facade);
  if (!v) throw Error('view missing');
  return v;
}

// args: { leaderboards: 'enabled'|'disabled', failYears: boolean }
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
    const spy = { createCalls: [] };
    const cloudProvider = {
      capabilities: () => ({ available: true, deleteAvailable: false }),
      list: async () => ({ kind: 'ok', value: [] }),
      download: async () => ({ kind: 'ok', value: null }),
      readLocal: async () => ({ kind: 'ok', value: null }),
      writeLocal: async () => ({ kind: 'ok', value: true }),
      create: async (op, checkpoint, path) => {
        spy.createCalls.push({ op, checkpointId: checkpoint && checkpoint.checkpointId, profileId: checkpoint && checkpoint.cloudProfileId });
        return { kind: 'ok', value: { filePath: path, checkpointId: checkpoint && checkpoint.checkpointId } };
      },
      delete: async () => ({ kind: 'unsupported' }),
      defaultFilePath: (name) => name,
    };
    Object.assign(v.cloudSync, { config: v.cloudConfig, appId: APPID, environment: 'test', profileId: 'profile-a', provider: cloudProvider });
    v.cloudProvider = cloudProvider;
    // 榜单：enabled 时两榜真实 ID；disabled 保持空配置（空态）
    v.leaderboardConfig = args.leaderboards === 'enabled'
      ? { enabled: true, assetsBoardId: 'board-assets', yearsBoardId: 'board-years' }
      : { enabled: false, assetsBoardId: '', yearsBoardId: '' };
    const lb = { calls: [], failBoards: args.failBoards || [] };
    const lbProvider = {
      isAvailable: () => true,
      submit: async (boardId, value) => {
        lb.calls.push({ boardId, value });
        return lb.failBoards.includes(boardId) ? { kind: 'failed' } : { kind: 'ok' };
      },
    };
    Object.assign(v.leaderboardSync, { config: v.leaderboardConfig, provider: lbProvider });
    v.leaderboardConsent = true;
    window.__l = { v, spy, lb };
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
  const boot = async (args) => {
    await d.loadFixture(seed);
    await d.page.waitForTimeout(700);
    if ((await d.findLabels('同意并继续')).length) await d.clickLabel('同意并继续');
    await d.page.waitForTimeout(300);
    await waitView();
    const status = await d.page.evaluate(installSource(), { findSource: findView.toString(), APP, ...args });
    if (status !== 'ready') throw new Error(`persistence-not-ready: ${status}`);
  };
  const state = (fn, arg) => d.page.evaluate(fn, arg);

  try {
    // ---------- L01a：两榜同 checkpoint 口径（备份成功回执驱动，整数分、两榜同发） ----------
    await boot({ leaderboards: 'enabled' });
    await state(() => { window.__l.backupPromise = window.__l.v.backupToCloud(); });
    await d.waitForLabel('公开榜已同步', { exact: false, timeoutMs: 10000 });
    const synced = await state(() => {
      const { v, spy, lb } = window.__l;
      return { creates: spy.createCalls, calls: lb.calls,
        outcome: v.leaderboardSync.lastOutcome && { target: v.leaderboardSync.lastOutcome.target, assets: v.leaderboardSync.lastOutcome.assets, years: v.leaderboardSync.lastOutcome.years },
        targetKey: v.leaderboardSync.latestTargetKey, runId: v.facade.getState().runId, pending: v.pendingLeaderboard };
    });
    d.check('L01-two-boards-same-checkpoint',
      synced.creates.length === 1 && synced.calls.length === 2
      && synced.calls.every((c) => Number.isSafeInteger(c.value) && c.value >= 0)
      && synced.calls.map((c) => c.boardId).sort().join(',') === 'board-assets,board-years'
      && synced.outcome && synced.outcome.assets === true && synced.outcome.years === true
      && synced.targetKey === `${synced.creates[0].checkpointId}:${synced.runId}` && synced.pending === null, synced);
    await d.screenshot('L01-two-boards-synced');

    // ---------- L01b：空态（榜单未配置）→ 备份照常、零外发（disabled 走静默跳过，不出提示 toast） ----------
    await boot({ leaderboards: 'disabled' });
    await state(() => { window.__l.backupPromise = window.__l.v.backupToCloud(); });
    await d.waitForLabel('云备份成功', { exact: false, timeoutMs: 10000 });
    await d.page.waitForTimeout(600);
    const empty = await state(() => ({ creates: window.__l.spy.createCalls.length, calls: window.__l.lb.calls.length, pending: window.__l.v.pendingLeaderboard }));
    d.check('L01-empty-boards-no-submit-backup-ok', empty.creates === 1 && empty.calls === 0 && empty.pending === null, empty);
    await d.screenshot('L01-empty-boards');

    // ---------- L01c：部分失败（年限榜失败）→ pending 只带失败侧 → 补发只重发失败侧、同 checkpoint ----------
    await boot({ leaderboards: 'enabled', failBoards: ['board-years'] });
    await state(() => { window.__l.backupPromise = window.__l.v.backupToCloud(); });
    await d.waitForLabel('公开榜部分完成', { exact: false, timeoutMs: 10000 });
    const partial = await state(() => {
      const { v, spy, lb } = window.__l;
      return { checkpointId: spy.createCalls[0] && spy.createCalls[0].checkpointId, calls: lb.calls.map((c) => c.boardId),
        pending: v.pendingLeaderboard && { assets: v.pendingLeaderboard.assets, years: v.pendingLeaderboard.years, checkpointId: v.pendingLeaderboard.checkpointId } };
    });
    d.check('L01-partial-failure-pending-carries-failed-side-only',
      partial.calls.length === 2 && partial.pending && partial.pending.assets === true && partial.pending.years === false
      && partial.pending.checkpointId === partial.checkpointId, partial);
    await d.screenshot('L01-partial');
    // 补发：清掉失败标记，走设置里的补发入口（AppView 方法），同 checkpoint 只重发年限榜。
    // 注：服务有 60s 工程节流（lastSubmittedAtMs）；这里模拟"稍后补发"把时钟拨回 61s，不等待墙钟。
    await state(() => {
      window.__l.lb.failBoards = [];
      window.__l.v.leaderboardSync.lastSubmittedAtMs = Date.now() - 61000;
      window.__l.v.retryPendingLeaderboard();
    });
    await d.waitForLabel('公开榜补发完成', { exact: false, timeoutMs: 10000 });
    const retried = await state(() => {
      const { v, lb } = window.__l;
      return { calls: lb.calls, pending: v.pendingLeaderboard,
        outcome: v.leaderboardSync.lastOutcome && { assets: v.leaderboardSync.lastOutcome.assets, years: v.leaderboardSync.lastOutcome.years } };
    });
    const assetCalls = retried.calls.filter((c) => c.boardId === 'board-assets').length;
    const yearCalls = retried.calls.filter((c) => c.boardId === 'board-years').length;
    d.check('L01-retry-resubmits-only-failed-board-same-checkpoint',
      assetCalls === 1 && yearCalls === 2 && retried.pending === null
      && retried.outcome && retried.outcome.assets === true && retried.outcome.years === true,
      { assetCalls, yearCalls, outcome: retried.outcome });
    await d.screenshot('L01-retried');

    // ---------- L01d：撤回同意 → 备份不外发榜单；补发被阻断 ----------
    await boot({ leaderboards: 'enabled' });
    await state(() => { window.__l.v.leaderboardConsent = false; window.__l.backupPromise = window.__l.v.backupToCloud(); });
    await d.waitForLabel('云备份成功', { exact: false, timeoutMs: 10000 });
    await d.page.waitForTimeout(600);
    const withdrawn = await state(() => ({ creates: window.__l.spy.createCalls.length, calls: window.__l.lb.calls.length }));
    d.check('L01-consent-withdrawn-no-leaderboard-submit', withdrawn.creates === 1 && withdrawn.calls === 0, withdrawn);
    await state(() => { window.__l.v.pendingLeaderboard = { assets: false, years: false, checkpointId: 'cp-any', runId: window.__l.v.facade.getState().runId }; window.__l.v.retryPendingLeaderboard(); });
    await d.waitForLabel('公开榜同意已撤回', { exact: false, timeoutMs: 8000 });
    const stillZero = await state(() => ({ calls: window.__l.lb.calls.length, pending: window.__l.v.pendingLeaderboard }));
    d.check('L01-retry-blocked-when-consent-withdrawn', stillZero.calls === 0 && !!stillZero.pending, stillZero);
    await d.screenshot('L01-consent-withdrawn');

    // ---------- L01e：换号 → pending/latest 清空，无旧回包污染，补发提示无待办 ----------
    await boot({ leaderboards: 'enabled', failBoards: ['board-years'] });
    await state(() => { window.__l.backupPromise = window.__l.v.backupToCloud(); });
    await d.waitForLabel('公开榜部分完成', { exact: false, timeoutMs: 10000 });
    const beforeSwitch = await state(() => ({ epoch: window.__l.v.leaderboardSync.accountEpoch, targetKey: window.__l.v.leaderboardSync.latestTargetKey, pending: !!window.__l.v.pendingLeaderboard }));
    await state(async () => {
      const { v } = window.__l;
      const sessionB = { kind: 'taptap', sessionToken: 'tok-b', expiresAtMs: Date.now() + 3600e3,
        profile: { profileId: 'profile-b', appId: 'review-app', environment: 'test', scope: 'tap-minigame-account' } };
      v.auth = { setExpectedScope: () => undefined, currentSession: async () => sessionB,
        refreshCurrentIdentity: async () => ({ kind: 'verified', session: sessionB, requestGeneration: 0 }) };
      v.identityVerification = 'unverified';
      await v.ensureVerifiedIdentity('cloud');
    });
    const afterSwitch = await state(() => {
      const { v, lb } = window.__l;
      return { epoch: v.leaderboardSync.accountEpoch, targetKey: v.leaderboardSync.latestTargetKey, pending: v.pendingLeaderboard,
        profileId: v.identity.profileId, calls: lb.calls.length };
    });
    d.check('L01-account-switch-clears-pending-and-latest',
      afterSwitch.epoch === beforeSwitch.epoch + 1 && beforeSwitch.pending === true
      && afterSwitch.pending === null && afterSwitch.targetKey === '' && afterSwitch.profileId === 'profile-b',
      { beforeSwitch, afterSwitch });
    await state(() => window.__l.v.retryPendingLeaderboard());
    await d.waitForLabel('没有待补发的榜单', { exact: false, timeoutMs: 8000 });
    const noReplay = await state(() => window.__l.lb.calls.length);
    d.check('L01-no-stale-receipt-replay-after-switch', noReplay === afterSwitch.calls, { before: afterSwitch.calls, after: noReplay });
    await d.screenshot('L01-switched');

    // ---------- L01f：重开（关闭公司新 run）→ 旧待补发失效丢弃、不外发 ----------
    await boot({ leaderboards: 'enabled', failBoards: ['board-years'] });
    await state(() => { window.__l.backupPromise = window.__l.v.backupToCloud(); });
    await d.waitForLabel('公开榜部分完成', { exact: false, timeoutMs: 10000 });
    const runBefore = await state(() => ({ runId: window.__l.v.facade.getState().runId, calls: window.__l.lb.calls.length }));
    await clickExpect('设置', '关闭公司', { exact: true });
    // 设置弹窗 ScrollView 遮罩外按钮几何与页脚重叠（probe-settings 实证），关公司入口改直调渲染方法；确认按钮仍真实点击
    await state(() => window.__l.v.renderCloseConfirm());
    await d.waitForLabel('关闭公司并重来？', { exact: false, timeoutMs: 8000 });
    await d.clickLabel('永久清除本局');
    await d.page.waitForFunction((oldRunId) => {
      try {
        const all = []; const walk = (n) => { all.push(...(n.components || [])); n.children.forEach(walk); };
        walk(cc.director.getScene());
        const v = all.find((c) => typeof c.prepareCloudRestore === 'function' && c.cloudSync && c.facade);
        return v && v.facade.getState().runId !== oldRunId;
      } catch (e) { return false; }
    }, runBefore.runId, { timeout: 15000 });
    const afterReset = await state(() => ({ runId: window.__l.v.facade.getState().runId, pending: window.__l.v.pendingLeaderboard, calls: window.__l.lb.calls.length }));
    d.check('L01-reset-new-run-drops-stale-pending',
      afterReset.runId !== runBefore.runId && afterReset.calls === runBefore.calls
      && (afterReset.pending === null || afterReset.pending.runId !== afterReset.runId), { runBefore, afterReset });
    await state(() => window.__l.v.retryPendingLeaderboard());
    await d.page.waitForTimeout(800);
    const finalRetry = await state(() => ({ calls: window.__l.lb.calls.length, pending: window.__l.v.pendingLeaderboard,
      noPending: false }));
    finalRetry.noPending = (await d.findLabels('没有待补发的榜单', { exact: false })).length === 1
      || (await d.findLabels('上下文已变化', { exact: false })).length === 1;
    d.check('L01-retry-after-reset-no-upload',
      finalRetry.calls === runBefore.calls && finalRetry.pending === null && finalRetry.noPending === true, finalRetry);
    await d.screenshot('L01-after-reset');

    const report = await d.finish('l-web-report.json');
    console.log(JSON.stringify({ status: report.status, counts: report.checkCounts, errors: report.browserErrors }));
    process.exit(report.exitCode);
  } catch (error) {
    console.error('L-WEB-FATAL', error);
    try { await d.screenshot('l-web-fatal'); } catch { /* ignore */ }
    await d.finish('l-web-report.json');
    process.exit(1);
  }
})();
