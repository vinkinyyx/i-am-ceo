// DEV-07 F族：启动持久化的真实 Web 集成（release minified 构建）。
// F01a 清理后启动：fixture 注入 → 正常进入经营、持久化 ready；
// F01b 退出重进：reload 后存档不空白（同 runId/现金/revision 不回退）；
// F01c 失败恢复：损坏活动槽 checksum → SAVE_CORRUPT 闸门（不静默清空、不自动新建公司），
//   重试仍闸门；恢复 fixture 后可正常启动。
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

(async () => {
  const d = await CanvasDriver.launch({
    url: 'http://127.0.0.1:8193/', viewport: { width: 390, height: 844 }, outDir,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  });
  const waitView = async () => {
    await d.page.waitForFunction((src) => { try { return !!eval('(' + src + ')')(); } catch (e) { return false; } },
      findView.toString(), { timeout: 45000 });
  };
  // reload 期间场景销毁/重建，findLabels 可能撞空节点；统一安全包装
  const findSafe = async (text) => {
    try { return await d.findLabels(text, { exact: false }); } catch { return []; }
  };
  const consentIfShown = async () => {
    await d.page.waitForTimeout(600);
    for (let i = 0; i < 3; i++) {
      if (!(await findSafe('同意并继续')).length) return;
      try { await d.clickLabel('同意并继续'); } catch { /* 场景切换中 */ }
      await d.page.waitForTimeout(400);
    }
  };
  // reload 期间场景销毁/重建，findLabels 可能撞空节点；容错轮询
  const waitLabelSafe = async (text, timeoutMs = 30000) => {
    const end = Date.now() + timeoutMs;
    while (Date.now() < end) {
      if ((await findSafe(text)).length) return;
      await d.page.waitForTimeout(250);
    }
    throw new Error('wait-timeout-safe: ' + text);
  };
  const snapshot = () => d.page.evaluate((src) => {
    const v = eval('(' + src + ')')();
    const s = v.facade.getState();
    return { runId: s.runId, cash: s.company.cashYuan, revision: v.facade.getRevision(), phase: s.phase,
      employees: s.employees.length, persistence: v.facade.getPersistenceStatus() };
  }, findView.toString());

  try {
    // ---------- F01a：清理后启动 ----------
    await d.loadFixture(seed);
    await d.page.waitForTimeout(700);
    await d.waitForLabel('同意并继续', { exact: false, timeoutMs: 30000 });
    await consentIfShown();
    await waitView();
    const a = await snapshot();
    d.check('F01-clean-boot-running-ready', a.phase === 'RUNNING' && a.persistence === 'ready' && a.employees >= 2, a);
    await d.screenshot('F01a-clean-boot');

    // ---------- F01b：退出重进 → 档不空白、同 run 不回退 ----------
    await d.page.reload({ waitUntil: 'domcontentloaded' });
    await d.page.waitForTimeout(900);
    await consentIfShown();
    await waitView();
    const b = await snapshot();
    d.check('F01-reenter-same-run-no-regression',
      b.runId === a.runId && b.cash === a.cash && b.revision >= a.revision && b.phase === 'RUNNING' && b.employees === a.employees,
      { before: a, after: b });
    await d.screenshot('F01b-reenter');

    // ---------- F01c：双槽全损坏 → SAVE_CORRUPT 闸门，不静默清空、不自动新建 ----------
    // 注：只坏活动槽时仓库会从另一槽恢复（双槽设计，F01d 覆盖恢复路径）；闸门需两槽同坏才确定性触发
    const corrupted = await d.page.evaluate(() => {
      const out = { ok: true, markers: {} };
      for (const slot of ['a', 'b']) {
        const key = 'ceo/save/' + slot;
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const env = JSON.parse(raw);
        env.payload.company.cashYuan = (env.payload.company.cashYuan || 0) + 12345; // 改业务字段不动 checksum → 校验必败
        localStorage.setItem(key, JSON.stringify(env));
        out.markers[slot] = env.payload.company.cashYuan;
      }
      if (!out.markers.a) return { ok: false, reason: 'slot-a-missing' };
      return out;
    });
    if (!corrupted.ok) throw new Error('corrupt-inject-failed: ' + corrupted.reason);
    await d.page.reload({ waitUntil: 'domcontentloaded' });
    await d.page.waitForTimeout(1500);
    await waitLabelSafe('本地存档异常');
    const gateText = {
      corrupt: (await findSafe('SAVE_CORRUPT')).length,
      noOverwrite: (await findSafe('暂不创建新公司')).length,
      retry: (await findSafe('重试读取')).length,
      createPage: (await findSafe('创建公司')).length,
    };
    d.check('F01-corrupt-gate-blocks-no-auto-new-company',
      gateText.corrupt >= 1 && gateText.noOverwrite >= 1 && gateText.retry >= 1 && gateText.createPage === 0, gateText);
    // 不静默清空：损坏字节仍在本地
    const kept = await d.page.evaluate((marker) => {
      const raw = localStorage.getItem('ceo/save/a');
      if (!raw) return { kept: false };
      try { return { kept: JSON.parse(raw).payload.company.cashYuan === marker }; } catch { return { kept: false }; }
    }, corrupted.markers.a);
    d.check('F01-corrupt-bytes-preserved-not-wiped', kept.kept === true, { ...kept, marker: corrupted.markers.a });
    await d.screenshot('F01c-corrupt-gate');
    // 闸门重试：存档仍损坏 → 仍闸门，不进入经营
    await d.clickLabel('重试读取');
    await d.page.waitForTimeout(1500);
    const gateAgain = (await findSafe('本地存档异常')).length >= 1;
    d.check('F01-gate-retry-still-blocked-while-corrupt', gateAgain === true, { gateAgain });

    // ---------- F01d：只坏活动槽 → 双槽恢复（先跨月提交确保 B 槽存在） ----------
    await d.loadFixture(seed);
    await d.page.waitForTimeout(700);
    await consentIfShown();
    await waitView();
    // 强制跨月推进触发真实提交（写非活动槽 B），确保恢复源存在
    await d.page.evaluate((src) => {
      const v = eval('(' + src + ')')();
      const s = v.facade.getState();
      return v.facade.advanceRealTime(40000, s.runId, Date.now());
    }, findView.toString());
    await d.page.waitForTimeout(600);
    const slots = await d.page.evaluate(() => ({ a: !!localStorage.getItem('ceo/save/a'), b: !!localStorage.getItem('ceo/save/b') }));
    if (!slots.a || !slots.b) throw new Error('dual-slot-not-materialized: ' + JSON.stringify(slots));
    const d0 = await snapshot();
    await d.page.evaluate(() => {
      const raw = localStorage.getItem('ceo/save/a');
      const env = JSON.parse(raw);
      env.payload.company.cashYuan = (env.payload.company.cashYuan || 0) + 9999;
      localStorage.setItem('ceo/save/a', JSON.stringify(env));
    });
    await d.page.reload({ waitUntil: 'domcontentloaded' });
    await d.page.waitForTimeout(1500);
    await consentIfShown();
    await waitView();
    const d1 = await snapshot();
    d.check('F01-single-slot-corrupt-recovers-from-backup',
      d1.phase === 'RUNNING' && d1.runId === d0.runId && d1.employees === d0.employees, { before: d0, after: d1 });
    await d.screenshot('F01d-recovered');

    // 恢复 fixture → 正常启动（恢复路径完整性）
    await d.loadFixture(seed);
    await d.page.waitForTimeout(700);
    await consentIfShown();
    await waitView();
    const c = await snapshot();
    d.check('F01-after-fixture-restore-boots-clean', c.phase === 'RUNNING' && c.runId === a.runId && c.persistence === 'ready', c);

    const report = await d.finish('f-web-report.json');
    console.log(JSON.stringify({ status: report.status, counts: report.checkCounts, errors: report.browserErrors }));
    process.exit(report.exitCode);
  } catch (error) {
    console.error('F-WEB-FATAL', error);
    try { await d.screenshot('f-web-fatal'); } catch { /* ignore */ }
    await d.finish('f-web-report.json');
    process.exit(1);
  }
})();
