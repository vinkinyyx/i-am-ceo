const fs = require('fs');
const { CanvasDriver } = require('./canvas-driver.cjs');

(async () => {
  const outDir = process.argv[3] || 'evidence/m3/TASK-M3-09-R33/attempt-01';
  const seed = JSON.parse(fs.readFileSync('evidence/m3/TASK-M3-09-R30/attempt-06/seed-staffed.json', 'utf8'));
  const driver = await CanvasDriver.launch({ url: process.argv[2] || 'http://127.0.0.1:8153/', viewport: { width: 375, height: 812 }, outDir, executablePath: process.env.CHROME_EXE || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
  const original = await driver.loadFixture(seed).then(() => driver.readCommittedSave());
  await driver.page.waitForTimeout(500);
  await driver.waitForLabel('年度报告');
  const clickAt = async (label, pixelOffsetX = 0, pixelOffsetY = 0) => {
    const g = await driver.geometry();
    await driver.page.mouse.click(g.x + label.x * g.scale + pixelOffsetX, g.y + (g.visibleH - label.y) * g.scale + pixelOffsetY);
    await driver.page.waitForTimeout(350);
  };
  let settingsOpened = false;
  for (const [x, y] of [[332, 42], [332, 62], [332, 72], [325, 62], [340, 62]]) {
    await driver.page.mouse.click(x, y);
    await driver.page.waitForTimeout(180);
    if ((await driver.findLabels('总开关（关闭后全静音）')).length) { settingsOpened = true; break; }
  }
  driver.check('R33-settings-panel-opened-by-real-click', settingsOpened, { candidates: 5 });
  if (!settingsOpened) throw new Error('settings-button-unresponsive-in-real-click-candidates');
  await driver.waitForLabel('总开关（关闭后全静音）');
  await driver.screenshot('r33-settings');
  const masterLabel = (await driver.findLabels('总开关（关闭后全静音）'))[0];
  const findToggle = async (wanted, y) => {
    let best = null;
    for (let nth = 0; nth < 12; nth += 1) {
      const c = (await driver.findLabels(wanted, { nth }))[0];
      if (!c) break;
      if (!best || Math.abs(c.y - y) < Math.abs(best.y - y)) best = c;
    }
    return best;
  };
  let toggle = await findToggle('开', masterLabel.y);
  if (!toggle) throw new Error('master-audio-toggle-not-found');
  await clickAt(toggle);
  const storedOff = await driver.page.evaluate(() => JSON.parse(localStorage.getItem('ceo.audio.settings.v1') || 'null'));
  driver.check('R33-audio-setting-persisted', storedOff?.masterEnabled === false, storedOff);
  const afterToggleOff = await driver.readCommittedSave();
  driver.check('R33-audio-setting-does-not-mutate-company', JSON.stringify(original.envelope) === JSON.stringify(afterToggleOff.envelope), { before: original.envelope.revision, after: afterToggleOff.envelope.revision });

  await driver.page.evaluate(() => {
    const originalSet = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (window.__failAudioSettingsWrite && key === 'ceo.audio.settings.v1') throw new Error('injected audio preference write failure');
      return originalSet.call(this, key, value);
    };
    window.__failAudioSettingsWrite = true;
  });
  const offLabel = (await driver.findLabels('总开关（关闭后全静音）'))[0];
  toggle = await findToggle('关', offLabel.y);
  if (!toggle) throw new Error('master-audio-off-toggle-not-found');
  await clickAt(toggle);
  const failedSetting = await driver.page.evaluate(() => JSON.parse(localStorage.getItem('ceo.audio.settings.v1') || 'null'));
  const rejectedToast = await driver.findLabels('声音设置保存失败，已恢复原设置', { exact: true });
  driver.check('R33-audio-write-failure-reverts-and-reports', failedSetting?.masterEnabled === false && rejectedToast.length > 0, { settings: failedSetting, toast: rejectedToast });
  const afterFailedToggle = await driver.readCommittedSave();
  driver.check('R33-audio-write-failure-preserves-save', JSON.stringify(original.envelope) === JSON.stringify(afterFailedToggle.envelope), { before: original.envelope.revision, after: afterFailedToggle.envelope.revision });
  await driver.screenshot('r33-audio-write-failure');

  await driver.clickLabel('重新查看操作指引');
  await driver.waitForLabel('操作指引');
  const afterTutorial = await driver.readCommittedSave();
  driver.check('R33-tutorial-replay-does-not-restart-company', JSON.stringify(original.envelope) === JSON.stringify(afterTutorial.envelope), { beforeRunId: original.envelope.runId, afterRunId: afterTutorial.envelope.runId, beforeRevision: original.envelope.revision, afterRevision: afterTutorial.envelope.revision });
  await driver.screenshot('r33-tutorial-replay');
  const report = await driver.finish();
  console.log(JSON.stringify(report, null, 2));
  if (report.status !== 'PASS') process.exitCode = 1;
})().catch((error) => { console.error(error); process.exit(1); });
