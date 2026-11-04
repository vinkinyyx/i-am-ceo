const fs = require('fs');
const path = require('path');
const { CanvasDriver } = require('../../tools/e2e/canvas-driver.cjs');
const root = path.resolve(__dirname, '../..');
const seed = JSON.parse(fs.readFileSync(path.join(root, 'evidence/m3/TASK-M3-09-R30/attempt-06/seed-staffed.json'), 'utf8'));
(async () => {
  const results = [];
  for (const viewport of [{ width: 375, height: 812 }, { width: 360, height: 640 }, { width: 390, height: 844 }, { width: 375, height: 834 }]) {
    const driver = await CanvasDriver.launch({ url: 'http://127.0.0.1:8148/', viewport, outDir: path.join(__dirname, `background-${viewport.width}-${viewport.height}`), executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
    try {
      await driver.loadFixture(seed);
      await driver.page.waitForFunction(() => {
        const canvas = cc.director.getScene().getChildByName('Canvas');
        const node = canvas?.getChildByName('Backdrop')?.getChildByName('BackgroundImage');
        return !!node?.getComponent(cc.Sprite)?.spriteFrame;
      }, null, { timeout: 20000 });
      const geometry = await driver.page.evaluate(() => {
        const canvas = cc.director.getScene().getChildByName('Canvas');
        const background = canvas.getChildByName('Backdrop');
        const image = background.getChildByName('BackgroundImage');
        const target = background.getComponent(cc.UITransformComponent);
        const actual = image.getComponent(cc.UITransformComponent);
        const sprite = image.getComponent(cc.Sprite);
        return { target: { width: target.width, height: target.height }, image: { width: actual.width, height: actual.height }, source: { width: sprite.spriteFrame.originalSize.width, height: sprite.spriteFrame.originalSize.height }, fallbackEnabled: background.getComponent(cc.Graphics).enabled };
      });
      const ratio = geometry.image.width / geometry.image.height;
      driver.check('background-loaded-with-original-ratio', Math.abs(ratio - 1080 / 2400) < 0.00001, geometry);
      driver.check('covers-viewport-no-distortion', geometry.image.width + 0.1 >= geometry.target.width && geometry.image.height + 0.1 >= geometry.target.height && !geometry.fallbackEnabled, geometry);
      const before = await driver.readCommittedSave();
      await driver.clickLabel('人才');
      await driver.waitForLabel('员工');
      const after = await driver.readCommittedSave();
      driver.check('real-navigation-works-without-save-change', before.pointer.revision === after.pointer.revision, { before: before.pointer.revision, after: after.pointer.revision });
      await driver.screenshot('talent-background');
      await driver.page.setViewportSize({ width: viewport.width, height: viewport.height - 60 });
      await driver.page.waitForTimeout(500);
      driver.check('background-stays-ready-after-resize', await driver.page.evaluate(() => !!cc.director.getScene().getChildByName('Canvas').getChildByName('Backdrop').getChildByName('BackgroundImage').getComponent(cc.Sprite).spriteFrame));
      results.push(await driver.finish());
    } catch (error) {
      await driver.browser.close();
      throw error;
    }
  }
  fs.writeFileSync(path.join(__dirname, 'background-report.json'), JSON.stringify(results, null, 2));
  if (results.some((r) => r.status !== 'PASS')) process.exitCode = 1;
  console.log(JSON.stringify(results.map((r) => ({ viewport: r.viewport, status: r.status, counts: r.checkCounts, errors: r.browserErrors }))));
})().catch((error) => { console.error(error); process.exitCode = 1; });
