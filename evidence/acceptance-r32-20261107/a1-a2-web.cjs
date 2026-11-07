// R32 A1/A2 业务验收：真实 Cocos Canvas UI + 注入云 provider（不绕过弹窗与按钮）。
const fs = require('fs');
const { CanvasDriver } = require('../../tools/e2e/canvas-driver.cjs');

const outDir = 'evidence/acceptance-r32-20261107';
const fixtures = JSON.parse(fs.readFileSync('evidence/acceptance-f26-closure-20261106/cloud-fixtures.json', 'utf8'));
const seed = JSON.parse(fs.readFileSync('evidence/m3/TASK-M3-09-R30/attempt-06/seed-staffed.json', 'utf8'));
const LEGACY_KEY = 'ceo/cloud/pending-create/v1';
const pending = { operationId: 'op-legacy-r32', checkpointId: 'cp-review-same', profileId: 'legacy-unknown', createdAtMs: 1_800_000_000_000 };

// 运行时视图查找：release 构建类名被压缩，按方法能力定位真实 AppView 实例。
function findView() {
  const all = [];
  function walk(n) { all.push(...(n.components || [])); n.children.forEach(walk); }
  walk(cc.director.getScene());
  const v = all.find((c) => typeof c.prepareCloudRestore === 'function' && c.cloudSync && c.facade);
  if (!v) throw Error('view missing');
  return v;
}

function injectSource() {
  return function (args) {
    const { fixture, findSource, withLegacy, speed, LEGACY_KEY, pending } = args;
    const v = eval('(' + findSource + ')')();
    v.identity = { profileId: 'profile-a' };
    v.cloudProfileBound = true;
    v.cloudConfig = { ...v.cloudConfig, enabled: true, appId: 'review-app', environment: 'test', policyVersion: 3 };
    window.__creates = 0;
    const provider = {
      capabilities: () => ({ available: true, deleteAvailable: false }),
      list: async () => ({ kind: 'ok', value: [fixture.archive] }),
      download: async (_op, _ref, target) => ({ kind: 'ok', value: target }),
      readLocal: async () => ({ kind: 'ok', value: fixture.raw }),
      writeLocal: async () => ({ kind: 'ok', value: true }),
      create: async () => { window.__creates += 1; return { kind: 'ok', value: fixture.archive }; },
      delete: async () => ({ kind: 'unsupported' }),
      defaultFilePath: (name) => name,
    };
    Object.assign(v.cloudSync, { config: v.cloudConfig, appId: 'review-app', environment: 'test', profileId: 'profile-a', provider });
    v.cloudProvider = provider;
    v.cloudArchives = [fixture.archive];
    if (withLegacy) return v.platform.set(LEGACY_KEY, pending).then(() => true);
    if (v.facade.getState().speed !== speed) {
      return v.facade.setSpeed(speed, { commandId: 'r32-seed-speed', expectedRunId: v.facade.getState().runId })
        .then(() => v.facade.getPersistenceStatus());
    }
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
  // 弹窗首帧布局尚未稳定时点击会落空：等 250ms、确认目标按钮仍在、点击后校验下一状态，
  // 未出现则重试（真实玩家看到的是同一套按钮，不允许用 3 条假数据绕过）。
  const clickExpect = async (button, expected, { exact = false, timeoutMs = 8000, tries = 3 } = {}) => {
    for (let i = 0; i < tries; i++) {
      if ((await d.findLabels(expected, { exact })).length) return;
      const btn = await d.findLabels(button);
      if (btn.length) {
        await d.page.waitForTimeout(i === 0 ? 250 : 400);
        await d.clickLabel(button);
      }
      const end = Date.now() + timeoutMs;
      while (Date.now() < end) {
        if ((await d.findLabels(expected, { exact })).length) return;
        await d.page.waitForTimeout(120);
      }
    }
    throw new Error(`click-expect-failed: ${button} -> ${expected}`);
  };
  try {
    // ---------- S1：暂停并预览 → 等待 5.5s → 确认成功 → 恢复后暂停且有“继续经营” ----------
    await d.loadFixture(seed);
    await d.page.waitForTimeout(700);
    if ((await d.findLabels('同意并继续')).length) await d.clickLabel('同意并继续');
    await d.page.waitForTimeout(300);
    await waitView();
    await d.page.evaluate(injectSource(fixtures.same), { fixture: fixtures.same, findSource: findView.toString(), withLegacy: false, speed: 1, LEGACY_KEY, pending });

    await d.page.evaluate((fn) => eval('(' + fn + ')')().openCloudRestore(), findView.toString());
    await d.waitForLabel('恢复云档前选择时钟状态', { timeoutMs: 5000 });
    d.check('S1-three-actions-visible',
      (await d.findLabels('暂停经营并预览')).length === 1
      && (await d.findLabels('保持经营并预览')).length === 1
      && (await d.findLabels('返回')).length === 1);
    await d.screenshot('S1-pause-choice');

    await clickExpect('暂停经营并预览', '云档列表', { exact: true });
    await clickExpect('恢复此档', '恢复云档', { exact: true });
    const paused = await d.page.evaluate((fn) => {
      const v = eval('(' + fn + ')')();
      return { speed: v.facade.getState().speed, status: v.facade.getPersistenceStatus() };
    }, findView.toString());
    d.check('S1-pause-persisted-before-preview', paused.speed === 0 && paused.status === 'ready', paused);

    await d.page.waitForTimeout(5600);
    await clickExpect('确认整档替换', '经营已暂停', { exact: true });
    const save = await d.readCommittedSave();
    const success = await d.findLabels('已恢复云档；本机广告券与账本保留', { exact: false });
    const resume = await d.findLabels('经营已暂停', { exact: false });
    d.check('S1-restore-succeeds-after-pause-and-5s', success.length > 0 && save.envelope?.payload.company.cashYuan === 777777,
      { success: success.length, cash: save.envelope?.payload.company.cashYuan });
    d.check('S1-restored-state-stays-paused-with-resume', resume.length > 0 && (await d.findLabels('继续经营（1×）')).length === 1);
    await d.screenshot('S1-restored-paused');
    await d.clickLabel('继续经营（1×）');
    await d.page.waitForTimeout(400);
    const resumed = await d.page.evaluate((fn) => eval('(' + fn + ')()').facade.getState().speed, findView.toString());
    d.check('S1-resume-is-explicit-user-action', resumed === 1, { speed: resumed });

    // ---------- S2：保持经营 → 5.5s 后确认被拒 → 暂停并重新预览 → 成功 ----------
    await d.loadFixture(seed);
    await d.page.waitForTimeout(700);
    if ((await d.findLabels('同意并继续')).length) await d.clickLabel('同意并继续');
    await d.page.waitForTimeout(300);
    await waitView();
    await d.page.evaluate(injectSource(fixtures.same), { fixture: fixtures.same, findSource: findView.toString(), withLegacy: false, speed: 1, LEGACY_KEY, pending });
    await d.page.evaluate((fn) => eval('(' + fn + ')')().openCloudRestore(), findView.toString());
    await d.waitForLabel('恢复云档前选择时钟状态');
    await clickExpect('保持经营并预览', '云档列表', { exact: true });
    await clickExpect('恢复此档', '恢复云档', { exact: true });
    await d.page.waitForTimeout(5600);
    await clickExpect('确认整档替换', '请暂停并重新预览', { exact: false });
    const expired = await d.findLabels('请暂停并重新预览', { exact: false });
    d.check('S2-running-base-is-safely-rejected', expired.length > 0);
    await d.screenshot('S2-baseline-expired');
    await clickExpect('暂停并重新预览', '确认整档替换', { exact: true });
    await d.page.waitForTimeout(1600);
    const afterRefresh = await d.page.evaluate((fn) => {
      const v = eval('(' + fn + ')')();
      return { speed: v.facade.getState().speed, status: v.facade.getPersistenceStatus() };
    }, findView.toString());
    d.check('S2-refresh-paused-and-repreviewed', afterRefresh.speed === 0 && afterRefresh.status === 'ready', afterRefresh);
    await d.page.waitForTimeout(5600);
    await clickExpect('确认整档替换', '经营已暂停', { exact: true });
    const save2 = await d.readCommittedSave();
    d.check('S2-confirm-succeeds-after-pause-repreview', save2.envelope?.payload.company.cashYuan === 777777,
      { cash: save2.envelope?.payload.company.cashYuan });
    await d.screenshot('S2-restored');

    // ---------- S3：预览取消 → 保持暂停 + 明确继续入口；选择保持暂停后仍为 0 ----------
    await d.loadFixture(seed);
    await d.page.waitForTimeout(700);
    if ((await d.findLabels('同意并继续')).length) await d.clickLabel('同意并继续');
    await d.page.waitForTimeout(300);
    await waitView();
    await d.page.evaluate(injectSource(fixtures.same), { fixture: fixtures.same, findSource: findView.toString(), withLegacy: false, speed: 1, LEGACY_KEY, pending });
    await d.page.evaluate((fn) => eval('(' + fn + ')')().openCloudRestore(), findView.toString());
    await d.waitForLabel('恢复云档前选择时钟状态');
    await clickExpect('暂停经营并预览', '云档列表', { exact: true });
    await clickExpect('恢复此档', '恢复云档', { exact: true });
    await clickExpect('取消', '经营已暂停', { exact: true });
    d.check('S3-cancel-offers-resume-and-does-not-import',
      (await d.findLabels('继续经营（1×）')).length === 1
      && (await d.readCommittedSave()).envelope?.payload.company.cashYuan === 1000000);
    await d.screenshot('S3-cancel-paused');
    await d.clickLabel('保持暂停');
    await d.page.waitForTimeout(300);
    const stillPaused = await d.page.evaluate((fn) => eval('(' + fn + ')()').facade.getState().speed, findView.toString());
    d.check('S3-keep-paused-stays-zero', stillPaused === 0, { speed: stillPaused });

    // ---------- S4：旧 global pending → 只读核对成功，create=0 ----------
    await d.loadFixture(seed);
    await d.page.waitForTimeout(700);
    if ((await d.findLabels('同意并继续')).length) await d.clickLabel('同意并继续');
    await d.page.waitForTimeout(300);
    await waitView();
    await d.page.evaluate(injectSource(fixtures.same), { fixture: fixtures.same, findSource: findView.toString(), withLegacy: true, speed: 0, LEGACY_KEY, pending });
    await d.page.evaluate((fn) => eval('(' + fn + ')()').openCloudRestore(), findView.toString());
    await d.waitForLabel('旧云上传待核对', { timeoutMs: 5000 });
    d.check('S4-legacy-shows-ids-and-readonly-entry',
      (await d.findLabels('操作编号：op-legacy-r32', { exact: false })).length === 1
      && (await d.findLabels('核对旧备份（只读）')).length === 1);
    await d.screenshot('S4-legacy-pending');
    await clickExpect('核对旧备份（只读）', '已核对，未重发上传', { exact: false });
    const creates1 = await d.page.evaluate(() => window.__creates);
    const legacyGone = await d.page.evaluate((key) => localStorage.getItem(key), LEGACY_KEY);
    d.check('S4-unique-legacy-confirmed-without-create', creates1 === 0 && legacyGone === null, { creates: creates1, legacyGone });
    await d.screenshot('S4-legacy-confirmed');

    // ---------- S5：保留旧未决，另建新备份 → create=1，旧记录保留 ----------
    await d.loadFixture(seed);
    await d.page.waitForTimeout(700);
    if ((await d.findLabels('同意并继续')).length) await d.clickLabel('同意并继续');
    await d.page.waitForTimeout(300);
    await waitView();
    await d.page.evaluate(injectSource(fixtures.same), { fixture: fixtures.same, findSource: findView.toString(), withLegacy: true, speed: 0, LEGACY_KEY, pending });
    await d.page.evaluate((fn) => eval('(' + fn + ')()').openCloudRestore(), findView.toString());
    await d.waitForLabel('旧云上传待核对');
    await clickExpect('保留旧未决，另建新备份', '另建新备份', { exact: true });
    await clickExpect('确认另建新备份', '未重发旧上传', { exact: false });
    const replayed = await d.findLabels('未重发旧上传', { exact: false });
    const creates2 = await d.page.evaluate(() => window.__creates);
    const legacyKept = await d.page.evaluate((key) => localStorage.getItem(key), LEGACY_KEY);
    d.check('S5-explicit-new-backup-creates-independently-and-keeps-legacy',
      creates2 === 1 && legacyKept !== null, { creates: creates2, legacyKept: !!legacyKept });
    d.check('S5-old-intent-is-never-replayed', replayed.length > 0);
    await d.screenshot('S5-new-backup');

    const report = await d.finish('a1-a2-report.json');
    console.log(JSON.stringify({ status: report.status, counts: report.checkCounts, errors: report.browserErrors }));
    if (report.status !== 'PASS') process.exitCode = 1;
  } catch (e) { await d.browser.close(); throw e; }
})().catch((e) => { console.error(e); process.exitCode = 1; });
