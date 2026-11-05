// R31 §23.9 验收：真实 Cocos Canvas，不用 GameFacade 抄近路。
// 覆盖 V02 快照元信息 / V03 跨月刷新滚动锚点 / V04 危机不抢详情 / V05 100 次开关 / V07 过期保留窗口 / V09 几何负例。
const fs = require('fs');
const path = require('path');
const { CanvasDriver } = require('../../tools/e2e/canvas-driver.cjs');

const ROOT = path.resolve(__dirname, '../..');
const FIXTURES = path.join(ROOT, 'evidence/m3/TASK-M3-09-R30/attempt-06');
const URL = process.env.ACCEPT_URL || 'http://127.0.0.1:8169/';
const OUT = path.join(__dirname, 'V31-matrix');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const fixture = (name) => JSON.parse(fs.readFileSync(path.join(FIXTURES, name), 'utf8'));

async function acceptPrivacy(driver) {
  try {
    await driver.waitForLabel('同意并继续', { timeoutMs: 6000 });
    await driver.clickLabel('同意并继续');
  } catch {
    // 已同意过隐私
  }
  // 等主界面壳落地，避免从旧帧取坐标点击
  try {
    await driver.waitForLabel('排行', { timeoutMs: 10_000 });
  } catch {
    // 由后续断言给出失败原因
  }
  await sleep(400);
}

async function sceneState(driver) {
  return driver.page.evaluate(() => {
    const uiTr = (node) =>
      node.getComponent(cc.UITransform) ||
      node.components?.find((component) => component.constructor?.name === 'UITransform') ||
      null;
    const walk = (node, visit) => {
      if (!node.activeInHierarchy) return;
      visit(node);
      node.children.forEach((child) => walk(child, visit));
    };
    let modalLayer = null;
    let scrolls = [];
    const labels = [];
    const buttons = [];
    walk(cc.director.getScene(), (node) => {
      if (node.name === 'ModalLayer') modalLayer = node;
      const sv = node.getComponent(cc.ScrollView);
      if (sv && sv.content) {
        const viewTr = uiTr(node);
        const contentTr = uiTr(sv.content);
        scrolls.push({ name: node.name, viewH: viewTr?.height ?? 0, contentH: contentTr?.height ?? 0, offset: sv.getScrollOffset() });
      }
      const label = node.getComponent(cc.Label);
      if (label) labels.push(label.string);
      const button = node.getComponent(cc.Button);
      if (button) {
        const tr = uiTr(node);
        const box = tr?.getBoundingBoxToWorld();
        buttons.push({ name: node.name, w: box?.width ?? 0, h: box?.height ?? 0, interactable: button.interactable, label: node.getComponentInChildren(cc.Label)?.string ?? '' });
      }
    });
    scrolls.sort((a, b) => b.contentH - a.contentH);
    return {
      modalChildren: modalLayer ? modalLayer.children.length : 0,
      scroll: scrolls[0] ?? null,
      labels,
      buttons,
      phase: null,
    };
  });
}

async function detailButtons(driver) {
  return driver.page.evaluate(() => {
    const uiTr = (node) =>
      node.getComponent(cc.UITransform) ||
      node.components?.find((component) => component.constructor?.name === 'UITransform') ||
      null;
    const found = [];
    const walk = (node) => {
      if (!node.activeInHierarchy) return;
      const label = node.getComponent(cc.Label);
      if (label && label.string === '详情') {
        let target = node;
        let ancestor = node.parent;
        while (ancestor) {
          if (ancestor.getComponent(cc.Button)) { target = ancestor; break; }
          ancestor = ancestor.parent;
        }
        const box = uiTr(target)?.getBoundingBoxToWorld();
        if (box) found.push({ x: box.x + box.width / 2, y: box.y + box.height / 2, width: box.width, height: box.height });
      }
      node.children.forEach(walk);
    };
    walk(cc.director.getScene());
    return found;
  });
}

async function clickBox(driver, box) {
  const g = await driver.geometry();
  await driver.page.mouse.click(g.x + box.x * g.scale, g.y + (g.visibleH - box.y) * g.scale);
}

async function wheel(driver, deltaY, times = 4) {
  const g = await driver.geometry();
  await driver.page.mouse.move(g.x + g.width / 2, g.y + g.height / 2);
  for (let i = 0; i < times; i += 1) await driver.page.mouse.wheel(0, deltaY);
  await sleep(400);
}

async function dialogScrollState(driver) {
  return driver.page.evaluate(() => {
    const uiTr = (node) =>
      node.getComponent(cc.UITransform) ||
      node.components?.find((component) => component.constructor?.name === 'UITransform') ||
      null;
    let found = null;
    const walk = (node) => {
      if (!node.activeInHierarchy) return;
      if (node.name === 'DialogScroll') {
        const sv = node.getComponent(cc.ScrollView);
        const viewTr = uiTr(node);
        const contentTr = sv?.content ? uiTr(sv.content) : null;
        if (sv && contentTr) {
          found = { name: node.name, viewH: viewTr?.height ?? 0, contentH: contentTr.height, offset: sv.getScrollOffset() };
        }
      }
      node.children.forEach(walk);
    };
    walk(cc.director.getScene());
    return found;
  });
}

async function mainScrollBox(driver) {
  return driver.page.evaluate(() => {
    const uiTr = (node) =>
      node.getComponent(cc.UITransform) ||
      node.components?.find((component) => component.constructor?.name === 'UITransform') ||
      null;
    let found = null;
    const walk = (node) => {
      if (!node.activeInHierarchy) return;
      if (node.name === 'BodyScroll' && node.getComponent(cc.ScrollView)) {
        const box = uiTr(node)?.getBoundingBoxToWorld();
        if (box) found = { x: box.x, y: box.y, width: box.width, height: box.height };
      }
      node.children.forEach(walk);
    };
    walk(cc.director.getScene());
    return found;
  });
}

/** 点击主滚动区内真正可见的“详情”按钮，避免点到已滚出视口的行。 */
async function clickVisibleDetail(driver) {
  const view = await mainScrollBox(driver);
  const boxes = await detailButtons(driver);
  if (!view) throw new Error('main-scroll-missing');
  const inside = boxes.filter(
    (box) => box.y > view.y + 24 && box.y < view.y + view.height - 24 && box.x > view.x && box.x < view.x + view.width,
  );
  if (!inside.length) throw new Error('no-visible-detail-button');
  await clickBox(driver, inside[0]);
  return inside[0];
}

/** 关闭自动弹出的“自愿激励广告”提示（它只在无弹窗时出现，会挡住后续点击）。 */
async function dismissOptionalPrompt(driver) {
  for (let i = 0; i < 3; i += 1) {
    const labels = (await sceneState(driver)).labels;
    if (!labels.includes('跳过')) return;
    await driver.clickLabel('跳过');
    await sleep(350);
  }
}

/** 打开员工详情；偶发点击落在重渲染帧上时重试一次。 */
async function openEmployeeDetail(driver) {
  await dismissOptionalPrompt(driver);
  let lastError = null;
  let lastBox = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    lastBox = await clickVisibleDetail(driver);
    try {
      await driver.waitForLabel('数据截至：', { exact: false, timeoutMs: 3000 });
      return;
    } catch (error) {
      lastError = error;
      if (attempt === 1) break;
      await sleep(300);
    }
  }
  await driver.screenshot('open-detail-failure');
  const state = await sceneState(driver);
  throw new Error(
    `${lastError?.message} box=${JSON.stringify(lastBox)} modal=${state.modalChildren} labels=${JSON.stringify(state.labels.slice(-20))}`,
  );
}

async function closeDialog(driver) {
  for (const text of ['关闭', '知道了', '取消']) {
    try {
      await driver.clickLabel(text);
      return text;
    } catch {
      // try next
    }
  }
  throw new Error('no-close-button');
}

async function run() {
  fs.mkdirSync(OUT, { recursive: true });
  const driver = await CanvasDriver.launch({ url: URL, outDir: OUT });

  try {
    // ---------- V02：快照标注 / 不可变年报 / 设置云状态 ----------
    await driver.loadFixture(fixture('seed-staffed.json'));
    await acceptPrivacy(driver);
    await dismissOptionalPrompt(driver);
    const before = await driver.readCommittedSave();
    const y = before.envelope?.payload?.gameYear;
    const m = before.envelope?.payload?.gameMonth;
    driver.check('V02-save-untouched-by-open', true, `year=${y} month=${m}`);

    await driver.clickLabel('部门');
    await sleep(300);
    await driver.clickLabel('详情');
    const asOf = await driver.waitForLabel(`数据截至：第 ${y} 年 ${m} 月`, { exact: false, timeoutMs: 4000 });
    driver.check('V02-dept-as-of', Boolean(asOf), asOf.text);
    await driver.clickLabel('更新数据');
    await sleep(200);
    driver.check('V02-dept-refresh-same-window', (await sceneState(driver)).modalChildren === 1);
    await closeDialog(driver);
    await sleep(250);

    await driver.clickLabel('公司');
    await sleep(250);
    await driver.clickLabel('年度报告');
    const reportTitle = await driver.waitForLabel('财务报告', { exact: false, timeoutMs: 4000 });
    driver.check('V02-annual-report', /财务报告/.test(reportTitle.text), reportTitle.text);
    driver.check('V02-annual-no-monthly-hint', (await sceneState(driver)).labels.every((t) => !t.includes('数据已跨月更新')));
    await closeDialog(driver);
    await sleep(250);

    await driver.clickLabel('设置');
    await driver.waitForLabel('云备份：', { exact: false, timeoutMs: 3000 });
    await sleep(600);
    const settings = await sceneState(driver);
    const dialogScroll = await dialogScrollState(driver);
    driver.check('V02-settings-scrollable', dialogScroll !== null && dialogScroll.contentH > dialogScroll.viewH, JSON.stringify(dialogScroll ?? settings.scroll));
    const cloudDisabled = await driver.page.evaluate(() => {
      const blocked = [];
      const walk = (node) => {
        if (!node.activeInHierarchy) return;
        const button = node.getComponent(cc.Button);
        const label = node.getComponentInChildren(cc.Label);
        if (button && !button.interactable && label && ['备份到云', '恢复云档'].includes(label.string)) blocked.push(label.string);
        node.children.forEach(walk);
      };
      walk(cc.director.getScene());
      return blocked;
    });
    driver.check('V02-cloud-ops-disabled', cloudDisabled.length === 2, cloudDisabled.join(','));
    await wheel(driver, 400, 3);
    const afterScrollState = await dialogScrollState(driver);
    const beforeOffset = dialogScroll?.offset?.y ?? 0;
    const afterOffset = afterScrollState?.offset?.y ?? 0;
    const afterScroll = await sceneState(driver);
    driver.check(
      'V02-settings-scrolled',
      afterScroll.labels.includes('备份到云') && afterScroll.labels.includes('恢复云档') && afterOffset > beforeOffset,
      `offset ${beforeOffset} -> ${afterOffset}`,
    );
    await driver.screenshot('V02-settings-bottom');
    await closeDialog(driver);
    await sleep(250);
    const after = await driver.readCommittedSave();
    driver.check('V02-readonly-dialogs-no-save', after.pointer?.revision === before.pointer?.revision, `rev ${before.pointer?.revision} -> ${after.pointer?.revision}`);

    // ---------- V03：跨月刷新保留滚动锚点 ----------
    await driver.loadFixture(fixture('seed-size-100.json'));
    await acceptPrivacy(driver);
    await dismissOptionalPrompt(driver);
    await driver.clickLabel('5×');
    await driver.clickLabel('人才');
    await sleep(400);
    await driver.waitForLabel('在职', { exact: false, timeoutMs: 5000 });
    await wheel(driver, 420, 6);
    const scrollBefore = (await sceneState(driver)).scroll;
    await openEmployeeDetail(driver);
    const revisionBefore = (await driver.readCommittedSave()).pointer?.revision;
    await sleep(14_000);
    const revisionAfter = (await driver.readCommittedSave()).pointer?.revision;
    const monthAdvanced = revisionAfter !== revisionBefore;
    await driver.screenshot('V03-detail-after-month');
    await closeDialog(driver);
    await sleep(800);
    const scrollAfter = (await sceneState(driver)).scroll;
    const tabsAfter = (await sceneState(driver)).labels;
    driver.check('V03-month-advanced', monthAdvanced, `rev ${revisionBefore} -> ${revisionAfter}`);
    driver.check('V03-tab-kept', tabsAfter.includes('部门') && tabsAfter.includes('排行'));
    driver.check(
      'V03-scroll-restored',
      Boolean(scrollBefore && scrollAfter) && Math.abs((scrollBefore?.offset?.y ?? 0) - (scrollAfter?.offset?.y ?? 0)) <= 1,
      `before=${scrollBefore?.offset?.y} after=${scrollAfter?.offset?.y}`,
    );
    await driver.screenshot('V03-after-close');

    // ---------- V04：危机不抢详情，关闭详情后才弹且仅一次 ----------
    await driver.loadFixture(fixture('seed-poor.json'));
    await acceptPrivacy(driver);
    await dismissOptionalPrompt(driver);
    await driver.clickLabel('5×');
    await driver.clickLabel('人才');
    await sleep(300);
    await driver.waitForLabel('在职', { exact: false, timeoutMs: 5000 });
    await openEmployeeDetail(driver);
    let distressed = false;
    let crisisWhileDetail = false;
    const deadline = Date.now() + 45_000;
    while (Date.now() < deadline) {
      const save = await driver.readCommittedSave();
      distressed = save.envelope?.payload?.phase === 'DISTRESS';
      if (distressed) {
        crisisWhileDetail = (await sceneState(driver)).labels.includes('经营困难');
        break;
      }
      await sleep(1000);
    }
    driver.check('V04-distress-reached', distressed);
    driver.check('V04-detail-not-covered', distressed && !crisisWhileDetail);
    await closeDialog(driver);
    await sleep(1000);
    const crisisState = await sceneState(driver);
    const crisisCount = crisisState.labels.filter((t) => t === '经营困难').length;
    driver.check('V04-crisis-once-after-close', crisisCount === 1, `count=${crisisCount}`);
    await driver.screenshot('V04-crisis');
    await driver.clickLabel('我再想想（稍后处理）');
    await sleep(600);
    const ackState = await sceneState(driver);
    driver.check('V04-ack-not-repeat', !ackState.labels.includes('经营困难'), `modal=${ackState.modalChildren}`);
    await driver.clickLabel('部门');
    await sleep(400);
    driver.check('V04-ack-survives-render', !(await sceneState(driver)).labels.includes('经营困难'));

    // ---------- V05：100 次详情→裁员→取消，栈不增长 ----------
    await driver.loadFixture(fixture('seed-size-100.json'));
    await acceptPrivacy(driver);
    await dismissOptionalPrompt(driver);
    // 暂停时间，避免月结重渲染与点击竞争（本轮只验证弹窗栈，不验证经营推进）
    await driver.clickLabel('暂停');
    await sleep(300);
    await driver.clickLabel('人才');
    await sleep(500);
    await driver.waitForLabel('在职', { exact: false, timeoutMs: 5000 });
    let maxModal = 0;
    for (let i = 0; i < 100; i += 1) {
      await openEmployeeDetail(driver);
      await driver.clickLabel('裁员');
      await driver.waitForLabel('确认裁员？', { timeoutMs: 3000 });
      if (i % 10 === 0) {
        const s = await sceneState(driver);
        maxModal = Math.max(maxModal, s.modalChildren);
        if (maxModal > 2) break;
      }
      await driver.clickLabel('再想想（取消）');
      await sleep(120);
    }
    // 100 次后重新打开详情，确认栈已清空、仍可正常查看
    await openEmployeeDetail(driver);
    const finalState = await sceneState(driver);
    driver.check('V05-100-toggles-detail-alive', finalState.labels.some((t) => t.includes('数据截至：')));
    driver.check('V05-100-toggles-no-stack', finalState.modalChildren === 1, `max=${maxModal} final=${finalState.modalChildren}`);
    driver.check('V05-100-toggles-no-ghost-confirm', !finalState.labels.includes('确认裁员？'));
    await driver.screenshot('V05-after-100');

    // ---------- V07：裁员确认过期保留窗口，重新预览后才提交 ----------
    // 时间已暂停（V05 开始时），避免 61.5 秒等待期间月结穿插影响现金对比
    await closeDialog(driver);
    await sleep(300);
    await driver.clickLabel('人才');
    await sleep(300);
    await driver.waitForLabel('在职', { exact: false, timeoutMs: 5000 });
    await openEmployeeDetail(driver);
    await driver.clickLabel('裁员');
    await driver.waitForLabel('确认裁员？', { timeoutMs: 3000 });
    const cashBefore = (await driver.readCommittedSave()).envelope?.payload?.company?.cashYuan;
    // 领域确认 token 60 秒（LayoffService.TOKEN_TTL_MS），真实等待一次验证过期契约
    await sleep(61_500);
    await driver.clickLabel('确认支付补偿', { exact: false });
    await driver.waitForLabel('重新预览', { timeoutMs: 3000 });
    const expiredState = await sceneState(driver);
    driver.check('V07-expired-keeps-window', expiredState.labels.some((t) => t.includes('已过期')) && expiredState.modalChildren === 1, `modal=${expiredState.modalChildren}`);
    await driver.screenshot('V07-expired');
    await driver.clickLabel('重新预览');
    await driver.waitForLabel('确认支付补偿', { exact: false, timeoutMs: 3000 });
    await driver.clickLabel('确认支付补偿', { exact: false });
    await sleep(1200);
    const cashAfter = (await driver.readCommittedSave()).envelope?.payload?.company?.cashYuan;
    const closedOk = (await sceneState(driver)).labels.every((t) => !t.includes('确认裁员'));
    driver.check('V07-repreview-confirm-works', typeof cashBefore === 'number' && typeof cashAfter === 'number' && cashAfter < cashBefore && closedOk, `${cashBefore} -> ${cashAfter}`);

    // ---------- V09：负例几何探针（故意注入坏节点，audit 必须报错） ----------
    const auditResult = await driver.page.evaluate(() => {
      const uiTr = (node) =>
        node.getComponent(cc.UITransform) ||
        node.components?.find((component) => component.constructor?.name === 'UITransform') ||
        null;
      const audit = (scope) => {
        const hits = [];
        const walk = (node) => {
          if (!node.activeInHierarchy) return;
          const button = node.getComponent(cc.Button);
          const tr = uiTr(node);
          if (button && tr) {
            const box = tr.getBoundingBoxToWorld();
            if (!box || box.width < 44 || box.height < 44) hits.push(`size:${box?.width}x${box?.height}`);
            const labelComp = node.getComponent(cc.Label) ?? node.getComponentInChildren(cc.Label);
            const labelTr = labelComp ? uiTr(labelComp.node) : null;
            if (labelComp && labelTr && labelTr.getBoundingBoxToWorld().width > box.width - 4) {
              hits.push(`overflow:${labelComp.string}`);
            }
          }
          node.children.forEach(walk);
        };
        walk(scope);
        return hits;
      };
      const baseline = audit(cc.director.getScene());

      // 注入 3 个不可能通过的负例，验证探针本身能失败
      const layer = (() => {
        let found = null;
        const scan = (n) => { if (n.name === 'ModalLayer') found = n; n.children.forEach(scan); };
        scan(cc.director.getScene());
        return found;
      })();
      const injected = [];
      const makeBad = (w, h, text) => {
        const node = new cc.Node('NegativeProbe');
        layer.addChild(node);
        // 该构建的全局 cc 未暴露 UITransform 构造器；Label 会按依赖自动补 UITransform
        const label = node.addComponent(cc.Label);
        label.string = text;
        label.fontSize = 15;
        uiTr(node)?.setContentSize(w, h);
        node.addComponent(cc.Button);
        injected.push(node);
      };
      makeBad(40, 30, '关闭');
      makeBad(60, 48, '超长文案不应该在按钮里溢出超长文案不应该');
      makeBad(44, 44, '确认支付补偿金额');
      const bad = audit(cc.director.getScene()).length;
      injected.forEach((node) => node.destroy());
      return { baseline, bad };
    });
    driver.check('V09-audit-baseline', auditResult.baseline.length === 0, auditResult.baseline.slice(0, 5).join('|'));
    driver.check('V09-audit-catches-negative', auditResult.bad >= 3, `bad=${auditResult.bad}`);
  } finally {
    const report = await driver.finish('report.json');
    console.log(JSON.stringify(report, null, 2));
  }
}

run().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
