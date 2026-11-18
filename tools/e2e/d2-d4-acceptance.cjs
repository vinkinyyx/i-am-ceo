// D2–D4 验收：逐页独立美术 + 原生动态数据 + 真实业务链路与失败分支
// 用法：node tools/e2e/d2-d4-acceptance.cjs [url] [outDir]
const fs = require('fs');
const path = require('path');
const { CanvasDriver } = require('./canvas-driver.cjs');

const CHROME = process.env.CHROME_EXE || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SEED = 'tests/fixtures/browser/seed-staffed.json';

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((k) => [k, sortValue(value[k])]));
  }
  return value;
}
function crc32(text) {
  let crc = 0xffffffff;
  for (const byte of Buffer.from(text, 'utf8')) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return ((crc ^ 0xffffffff) >>> 0).toString(16).padStart(8, '0');
}
function checksum(env) {
  const { schemaVersion, gameVersion, configVersion, revision, runId, resetGeneration, payload } = env;
  return crc32(JSON.stringify(sortValue({ schemaVersion, gameVersion, configVersion, revision, runId, resetGeneration, payload })));
}

/** 在真实 seed 存档上做最小改动并重签校验和（不改 schema/字段语义）。 */
function fixtureWith(mutate) {
  const seed = JSON.parse(fs.readFileSync(SEED, 'utf8'));
  const pointer = JSON.parse(seed['ceo/save/active']);
  const slot = pointer.slot;
  const env = JSON.parse(seed[`ceo/save/${slot}`]);
  mutate?.(env, pointer);
  const { checksum: _old, ...rest } = env;
  rest.revision = (rest.revision ?? 0) + 1;
  const sealed = { ...rest, checksum: checksum(rest) };
  return {
    ...seed,
    // 夹具代表「已同意隐私政策」的老玩家：否则重载后隐私弹窗会重新挡住点击。
    'ceo/privacy/consent': JSON.stringify({ accepted: true, policyVersion: 3, acceptedAtMs: Date.now() }),
    [`ceo/save/${slot}`]: JSON.stringify(sealed),
    'ceo/save/active': JSON.stringify({ ...pointer, revision: sealed.revision }),
  };
}

/** 探针：节点存在性 + 子树内已加载 SpriteFrame 数量（验证真实图片已导入并可显示）。 */
async function artProbe(page, names) {
  return page.evaluate((names) => {
    const all = [];
    const walk = (node) => {
      all.push(node);
      node.children.forEach(walk);
    };
    walk(cc.director.getScene());
    const out = {};
    for (const name of names) {
      const matches = all.filter((node) => node.name === name && node.activeInHierarchy);
      let frames = 0;
      for (const match of matches) {
        const stack = [match];
        while (stack.length) {
          const node = stack.pop();
          const sprite = node.getComponent(cc.Sprite);
          if (sprite && sprite.spriteFrame) frames += 1;
          node.children.forEach((child) => stack.push(child));
        }
      }
      out[name] = { count: matches.length, frames };
    }
    return out;
  }, names);
}

async function worldRects(page, names) {
  return page.evaluate((names) => {
    const UITransformType = cc.UITransform || cc.UITransformComponent;
    const all = [];
    const walk = (node) => {
      all.push(node);
      node.children.forEach(walk);
    };
    walk(cc.director.getScene());
    const out = {};
    for (const name of names) {
      const node = all.find((n) => n.name === name && n.activeInHierarchy);
      if (!node) {
        out[name] = null;
        continue;
      }
      const tr = node.getComponent(UITransformType);
      const box = tr?.getBoundingBoxToWorld?.();
      out[name] = box ? { x: box.x, y: box.y, w: box.width, h: box.height } : null;
    }
    return out;
  }, names);
}

function overlap(a, b) {
  if (!a || !b) return false;
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** 只点真实挂在 Button 上的文字：提示 Label 可能包含同样字样，不能当成可点目标。 */
function buttonClick(driver, text, options = {}) {
  return driver.clickLabel(text, { ...options, buttonOnly: true });
}

async function bootFreshCreate(driver) {
  await driver.waitForLabel('同意并继续', { timeoutMs: 25_000 });
  await buttonClick(driver, '同意并继续');
  await driver.waitForLabel('下一步：创建 CEO', { timeoutMs: 25_000 });
  await driver.page.waitForTimeout(900);
}

async function enterCompany(driver) {
  // 「进入公司」在确认支付收尾后立刻出现，弹窗遮罩销毁前的一次点击可能被吞；
  // 这里按真实玩家行为重试点击，并以经营页出现为成功判据（不做固定 sleep 假设）。
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const enter = await driver.findLabels('进入公司', { exact: true, buttonOnly: true });
    const start = await driver.findLabels('开始经营', { exact: false, buttonOnly: true });
    if (enter.length) await buttonClick(driver, '进入公司', { exact: true });
    else if (start.length) await buttonClick(driver, '开始经营', { exact: false });
    try {
      await driver.waitForLabel('当前可用现金', { timeoutMs: 4_000 });
      await driver.page.waitForTimeout(600);
      return;
    } catch {
      await driver.page.waitForTimeout(700);
    }
  }
  await driver.waitForLabel('当前可用现金', { timeoutMs: 10_000 });
  await driver.page.waitForTimeout(600);
}

async function runFullPath(url, outDir) {
  const driver = await CanvasDriver.launch({ url, viewport: { width: 375, height: 812 }, outDir, executablePath: CHROME });
  try {
    await bootFreshCreate(driver);

    // ---- D2 创建公司页：品牌条 / 引导角色 / 行业图标 / 专属场景
    const createArt = await artProbe(driver.page, ['BrandLogo', 'CreateGuide', 'ChoiceIcon', 'CreateCompanyScene']);
    driver.check('D2-create-brand', createArt.BrandLogo.frames > 0, createArt.BrandLogo);
    driver.check('D2-create-guide', createArt.CreateGuide.frames > 0, createArt.CreateGuide);
    driver.check('D2-create-industry-icons', createArt.ChoiceIcon.count === 3 && createArt.ChoiceIcon.frames === 3, createArt.ChoiceIcon);
    driver.check('D2-create-scene-ill-s02', createArt.CreateCompanyScene.frames > 0, createArt.CreateCompanyScene);
    await driver.screenshot('d2-create-company-375');

    // 行业图标三键都真实加载（换选中项不改图标绑定）
    const iconKeys = await driver.page.evaluate(() => {
      const keys = [];
      const walk = (node) => {
        if (node.name === 'ChoiceIcon' && node.activeInHierarchy) {
          const sprite = node.getComponent(cc.Sprite);
          if (sprite && sprite.spriteFrame) keys.push(sprite.spriteFrame._uuid ? 'uuid:' + sprite.spriteFrame._uuid : 'no-uuid');
        }
        node.children.forEach(walk);
      };
      walk(cc.director.getScene());
      return keys;
    });
    driver.check('D2-create-industry-uuid', new Set(iconKeys).size === 3 && iconKeys.every((k) => k.startsWith('uuid:')), iconKeys);

    await buttonClick(driver, '下一步：创建 CEO');
    await driver.waitForLabel('下一步：招聘员工', { timeoutMs: 15_000 });
    await driver.page.waitForTimeout(1000);
    const ceoArt = await artProbe(driver.page, ['CreateCeoScene', 'BannerFigure']);
    driver.check('D2-ceo-scene-ill-s03', ceoArt.CreateCeoScene.frames > 0, ceoArt.CreateCeoScene);
    driver.check('D2-ceo-figure-chr-ceo01', ceoArt.BannerFigure.frames > 0, ceoArt.BannerFigure);
    await driver.screenshot('d2-create-ceo-375');

    await buttonClick(driver, '下一步：招聘员工');
    await driver.waitForLabel('录用 · 支付', { exact: false, timeoutMs: 20_000 });
    await driver.page.waitForTimeout(1000);
    const hireArt = await artProbe(driver.page, ['InitialHireScene', 'BannerFigure']);
    driver.check('D2-hire-scene-ill-s04', hireArt.InitialHireScene.frames > 0, hireArt.InitialHireScene);
    driver.check('D2-hire-figure-chr-hr01', hireArt.BannerFigure.frames > 0, hireArt.BannerFigure);
    await driver.screenshot('d2-initial-hiring-375');

    // ---- D3 金钱正常分支：两次录用真实扣费、次月生效
    const before = await driver.readCommittedSave();
    const cashBefore = before.envelope?.payload?.company?.cashYuan ?? null;
    await buttonClick(driver, '录用 · 支付', { exact: false, timeoutMs: 15_000 });
    await driver.waitForLabel('确认支付', { exact: false, timeoutMs: 10_000 });
    await driver.page.waitForTimeout(1_200);
    const confirmArt = await artProbe(driver.page, ['HireConfirmAvatar', 'DialogIcon']);
    driver.check('D3-hire-confirm-avatar', confirmArt.HireConfirmAvatar.frames > 0, confirmArt.HireConfirmAvatar);
    await buttonClick(driver, '确认支付', { exact: false });
    await driver.page.waitForTimeout(1800);
    await buttonClick(driver, '录用 · 支付', { exact: false, timeoutMs: 15_000 });
    await driver.waitForLabel('确认支付', { exact: false, timeoutMs: 10_000 });
    await buttonClick(driver, '确认支付', { exact: false });
    await driver.waitForLabel('进入公司', { exact: false, timeoutMs: 20_000 });
    const after = await driver.readCommittedSave();
    const cashAfter = after.envelope?.payload?.company?.cashYuan ?? null;
    const headcount = after.envelope?.payload?.employees?.length ?? 0;
    driver.check('D3-first-hire-2-headcount', headcount === 2, { headcount });
    driver.check('D3-first-hire-cash-decreases', cashBefore !== null && cashAfter !== null && cashAfter < cashBefore, { cashBefore, cashAfter });

    // ---- 进入经营（真实时钟）
    await enterCompany(driver);
    await driver.screenshot('d3-company-operating-375');

    const companyArt = await artProbe(driver.page, ['CompanyBanner', 'TimeIcon']);
    driver.check('D2-company-banner', companyArt.CompanyBanner.frames > 0, companyArt.CompanyBanner);
    driver.check('D2-time-icon-ico-k15', companyArt.TimeIcon.frames > 0, companyArt.TimeIcon);

    // ---- D4 公司档案：EX-07 诊断 + EX-09 市场（真实数据）
    await buttonClick(driver, '创业第', { exact: false });
    await driver.waitForLabel('公司档案', { timeoutMs: 10_000 });
    await driver.page.waitForTimeout(1200);
    const detailArt = await artProbe(driver.page, ['DiagnosisRow', 'AdvisorFigure', 'MarketIndustryIcon', 'DialogScene']);
    driver.check('D4-diagnosis-row', detailArt.DiagnosisRow.count > 0, detailArt.DiagnosisRow);
    driver.check('D4-diagnosis-advisor', detailArt.AdvisorFigure.frames > 0, detailArt.AdvisorFigure);
    driver.check('D4-market-ill-s23', detailArt.DialogScene.frames > 0, detailArt.DialogScene);
    driver.check('D4-market-industry-icon', detailArt.MarketIndustryIcon.frames > 0, detailArt.MarketIndustryIcon);
    await driver.screenshot('d4-company-detail-375');
    await buttonClick(driver, '口径说明');
    await driver.waitForLabel('数据口径（只读）', { timeoutMs: 10_000 });
    await driver.page.waitForTimeout(1_000);
    const helpArt = await artProbe(driver.page, ['HelpIcon']);
    driver.check('D4-help-ico-k14', helpArt.HelpIcon.frames > 0, helpArt.HelpIcon);
    await driver.screenshot('d4-company-help-375');
    await buttonClick(driver, '知道了');
    await driver.page.waitForTimeout(400);
    await buttonClick(driver, '关闭');

    // ---- D4 设置页：ICO-K09 + 云档场景/状态 + 删除不可用说明
    await buttonClick(driver, '设置');
    await driver.waitForLabel('云备份', { timeoutMs: 10_000 });
    await driver.page.waitForTimeout(1200);
    const settingsArt = await artProbe(driver.page, ['SettingsHead', 'SettingsIcon', 'DeleteUnavailableIcon', 'DialogScene', 'DialogIcon']);
    driver.check('D4-settings-ico-k09', settingsArt.SettingsIcon.frames > 0, settingsArt.SettingsIcon);
    driver.check('D4-cloud-ill-s20', settingsArt.DialogScene.frames > 0, settingsArt.DialogScene);
    driver.check('D4-cloud-status-sta09-10', settingsArt.DialogIcon.frames > 0, settingsArt.DialogIcon);
    driver.check('D4-cloud-delete-unavailable', settingsArt.DeleteUnavailableIcon.frames > 0, settingsArt.DeleteUnavailableIcon);
    const deleteLabel = await driver.findLabels('删除云档：暂不提供', { exact: false });
    driver.check('D4-cloud-delete-explained', deleteLabel.length === 1, deleteLabel.length);
    await driver.screenshot('d4-settings-cloud-375');
    await buttonClick(driver, '关闭');

    // ---- D4 排行：未配置真实榜时不得伪造在线榜；行详情有只读口径
    await buttonClick(driver, '排行');
    await driver.waitForLabel('本地模拟', { timeoutMs: 10_000 });
    await driver.page.waitForTimeout(1000);
    const rankArt = await artProbe(driver.page, ['RankEntryIcon']);
    driver.check('D4-rank-real-entry-gated', rankArt.RankEntryIcon.count === 0, rankArt.RankEntryIcon);
    const rankRow = await driver.findLabels('年', { exact: false });
    driver.check('D4-rank-local-rows', rankRow.length >= 1, rankRow.length);
    await driver.screenshot('d4-rank-375');
    await buttonClick(driver, '公司');

    // ---- D3 经营→年结（真实 5× 时钟），随后打开真实年报
    await buttonClick(driver, '5×');
    const settleEnd = Date.now() + 120_000;
    let reports = 0;
    while (Date.now() < settleEnd) {
      const save = await driver.readCommittedSave();
      reports = save.envelope?.payload?.annualReports?.length ?? 0;
      if (reports >= 1) break;
      await driver.page.waitForTimeout(2000);
    }
    driver.check('D3-year-end-settled', reports >= 1, { reports, waitedMs: 120_000 - Math.max(0, settleEnd - Date.now()) });
    if (reports >= 1) {
      await buttonClick(driver, '年度报告', { exact: false, timeoutMs: 15_000 });
      await driver.waitForLabel('年财务报告', { exact: false, timeoutMs: 10_000 });
      await driver.page.waitForTimeout(1200);
      const annualArt = await artProbe(driver.page, ['AnnualDeco', 'LedgerIcon']);
      driver.check('D2-annual-deco-ill-s09', annualArt.AnnualDeco.frames > 0, annualArt.AnnualDeco);
      const bridge = await driver.findLabels('现金流', { exact: false });
      driver.check('D3-annual-cash-bridge', bridge.length >= 1, bridge.length);
      const eventTitle = await driver.findLabels('本年已发生事件', { exact: false });
      if (eventTitle.length === 0) driver.record('D4-annual-events', 'SKIP', '本年无随机事件（真实数据为空，不虚构）');
      else driver.record('D4-annual-events', 'PASS', { rows: eventTitle.length });
      await driver.screenshot('d3-annual-report-375');
      await buttonClick(driver, '关闭');
    } else {
      driver.record('D3-annual-cash-bridge', 'FAIL', '未在时限内完成年度结算');
      driver.record('D4-annual-events', 'FAIL', '无年度报告可验');
    }

    // ---- D3 关闭重开：真实清理 + 新 runId
    const runBefore = (await driver.readCommittedSave()).envelope?.runId ?? null;
    await buttonClick(driver, '设置');
    await driver.waitForLabel('关闭公司', { timeoutMs: 10_000 });
    await buttonClick(driver, '关闭公司');
    await driver.waitForLabel('永久清除本局', { timeoutMs: 10_000 });
    await driver.screenshot('d3-close-confirm-375');
    await buttonClick(driver, '永久清除本局');
    await driver.waitForLabel('下一步：创建 CEO', { timeoutMs: 20_000 });
    const runAfter = await driver.page.evaluate(() => {
      const pointer = JSON.parse(localStorage.getItem('ceo/save/active') || 'null');
      if (!pointer) return null;
      const env = JSON.parse(localStorage.getItem(`ceo/save/${pointer.slot}`) || 'null');
      return env ? { runId: env.runId, employees: env.payload?.employees?.length ?? -1 } : null;
    });
    driver.check('D3-close-reopen-new-run', Boolean(runBefore && runAfter && runAfter.runId !== runBefore), { runBefore, runAfter });
    driver.check('D3-close-reopen-empty-headcount', runAfter ? runAfter.employees === 0 : true, runAfter);
  } finally {
    await driver.finish('d2-d4-full-path.json');
  }
  return driver;
}

/** 首聘中断恢复：录用 1 人后刷新，必须回到 1/2 且不重复扣费 */
async function runResume(url, outDir) {
  const driver = await CanvasDriver.launch({ url, viewport: { width: 375, height: 812 }, outDir, executablePath: CHROME });
  try {
    await bootFreshCreate(driver);
    await buttonClick(driver, '软件科技');
    await buttonClick(driver, '下一步：创建 CEO');
    await driver.waitForLabel('下一步：招聘员工', { timeoutMs: 15_000 });
    await buttonClick(driver, '下一步：招聘员工');
    await driver.waitForLabel('录用 · 支付', { exact: false, timeoutMs: 20_000 });
    await buttonClick(driver, '录用 · 支付', { exact: false });
    await driver.waitForLabel('确认支付', { exact: false, timeoutMs: 10_000 });
    await buttonClick(driver, '确认支付', { exact: false });
    await driver.page.waitForTimeout(1800);
    const mid = await driver.readCommittedSave();
    const cashMid = mid.envelope?.payload?.company?.cashYuan ?? null;
    const headMid = mid.envelope?.payload?.employees?.length ?? 0;

    await driver.page.reload({ waitUntil: 'load', timeoutMs: 60_000 });
    await driver.waitForCanvas();
    await driver.waitForLabel('录用 · 支付', { exact: false, timeoutMs: 25_000 });
    const resumed = await driver.findLabels('还差 1 人', { exact: false });
    driver.check('D3-resume-progress-1of2', headMid === 1 && resumed.length === 1, { headMid, resumed: resumed.length });
    const afterReload = await driver.readCommittedSave();
    driver.check('D3-resume-no-double-charge', (afterReload.envelope?.payload?.company?.cashYuan ?? null) === cashMid, {
      cashMid,
      cashAfterReload: afterReload.envelope?.payload?.company?.cashYuan ?? null,
    });
    await driver.screenshot('d3-resume-mid-hire-375');
    await buttonClick(driver, '录用 · 支付', { exact: false });
    await driver.waitForLabel('确认支付', { exact: false, timeoutMs: 10_000 });
    await buttonClick(driver, '确认支付', { exact: false });
    await driver.waitForLabel('进入公司', { exact: false, timeoutMs: 20_000 });
    driver.check('D3-resume-complete-2of2', (await driver.readCommittedSave()).envelope?.payload?.employees?.length === 2, null);
  } finally {
    await driver.finish('d2-d4-resume.json');
  }
  return driver;
}

/** 失败分支：低现金下的招聘/建部门/扩产，以及损坏存档闸门 */
async function runFailureBranches(url, outDir) {
  const driver = await CanvasDriver.launch({ url, viewport: { width: 375, height: 812 }, outDir, executablePath: CHROME });
  try {
    const lowCash = fixtureWith((env) => {
      env.payload.company.cashYuan = 3000;
      env.payload.employees = [];
      // 只保留主营业务部：其余部门以「设立」卡覆盖建部门失败态
      env.payload.departments = (env.payload.departments ?? [])
        .filter((d) => d.type === 'BUSINESS')
        .map((d) => ({ ...d, headcountTarget: 0 }));
    });
    await driver.loadFixture(lowCash);
    await driver.waitForLabel('当前可用现金', { timeoutMs: 25_000 });
    await driver.page.waitForTimeout(800);

    // 部门失败：设立费越线 + 明确说明 + 余额不足按钮
    await buttonClick(driver, '部门');
    await driver.waitForLabel('余额不足', { exact: true, timeoutMs: 10_000 });
    const deptPoor = await driver.page.evaluate(() => {
      let count = 0;
      const walk = (node) => {
        if (!node.activeInHierarchy) return;
        const label = node.getComponent(cc.Label);
        if (label && label.string === '现金不足，无法设立') count += 1;
        node.children.forEach(walk);
      };
      walk(cc.director.getScene());
      return count;
    });
    driver.check('D3-dept-create-insufficient', deptPoor >= 4, deptPoor);
    await driver.screenshot('d3-dept-insufficient-375');

    // 金钱失败：招聘候选人卡片解释「现金不足」，禁用按钮点击不得扣费
    const cashBeforeHire = (await driver.readCommittedSave()).envelope?.payload?.company?.cashYuan ?? null;
    await buttonClick(driver, '招聘', { exact: true });
    await driver.waitForLabel('招聘候选人', { timeoutMs: 10_000 });
    await driver.page.waitForTimeout(700);
    const hirePoor = await driver.findLabels('现金不足', { exact: true });
    driver.check('D3-money-hire-insufficient', hirePoor.length >= 1, hirePoor.length);
    await driver.screenshot('d3-money-hire-insufficient-375');
    await buttonClick(driver, '录用', { exact: true });
    await driver.page.waitForTimeout(800);
    const cashAfterHire = (await driver.readCommittedSave()).envelope?.payload?.company?.cashYuan ?? null;
    const stillOpen = await driver.findLabels('招聘候选人', { exact: true });
    driver.check('D3-money-hire-blocked', cashAfterHire === cashBeforeHire && stillOpen.length >= 1, {
      cashBeforeHire,
      cashAfterHire,
      stillOpen: stillOpen.length,
    });
    await buttonClick(driver, '关闭', { exact: true });
    await driver.page.waitForTimeout(500);

    // 扩产失败：低现金时入口必须禁用，或预览明确提示“现金不足，无法投资”
    await buttonClick(driver, '公司');
    await driver.waitForLabel('扩大产能', { exact: false, timeoutMs: 10_000 });
    const investGate = await driver.page.evaluate(() => {
      const all = [];
      const walk = (node) => {
        all.push(node);
        node.children.forEach(walk);
      };
      walk(cc.director.getScene());
      const label = all.find((n) => {
        const l = n.getComponent(cc.Label);
        return l && l.string.includes('扩大产能');
      });
      if (!label) return { found: false, interactable: null };
      let target = label.parent;
      while (target && !target.getComponent(cc.Button)) target = target.parent;
      return { found: true, interactable: target ? target.getComponent(cc.Button).interactable : null };
    });
    if (investGate.found && investGate.interactable === false) {
      driver.check('D3-invest-insufficient', true, investGate);
    } else {
      await buttonClick(driver, '扩大产能', { exact: false });
      await driver.page.waitForTimeout(1000);
      const investPoor = await driver.findLabels('现金不足，无法投资', { exact: false });
      driver.check('D3-invest-insufficient', investPoor.length >= 1, { investGate, rows: investPoor.length });
    }
    await driver.screenshot('d3-invest-insufficient-375');

    // 存档失败：校验和不匹配必须进入闸门而不是静默新建
    // 校验和必须在封装之后破坏，否则 fixtureWith 会重新签名成合法存档。
    const corrupt = fixtureWith();
    const corruptPointer = JSON.parse(corrupt['ceo/save/active']);
    const corruptKey = `ceo/save/${corruptPointer.slot}`;
    const corruptEnvelope = JSON.parse(corrupt[corruptKey]);
    corruptEnvelope.checksum = 'deadbeef';
    corrupt[corruptKey] = JSON.stringify(corruptEnvelope);
    await driver.loadFixture(corrupt);
    await driver.waitForLabel('本地存档异常', { timeoutMs: 25_000 });
    const gateArt = await artProbe(driver.page, ['SaveGateIcon', 'CardBackdrop']);
    driver.check('D3-save-gate-shown', true, null);
    driver.check('D3-save-gate-sta07', gateArt.SaveGateIcon.frames > 0, gateArt.SaveGateIcon);
    driver.check('D3-save-gate-ill-s19', gateArt.CardBackdrop.frames > 0, gateArt.CardBackdrop);
    await driver.screenshot('d3-save-gate-375');
    await buttonClick(driver, '重试读取');
    await driver.waitForLabel('本地存档异常', { timeoutMs: 10_000 });
    driver.check('D3-save-gate-retry-stays', true, null);
  } finally {
    await driver.finish('d2-d4-failure-branches.json');
  }
  return driver;
}

/** 短屏 360×640：创建页与经营页关键装饰不重叠、场景图仍加载 */
async function runShortScreen(url, outDir) {
  const driver = await CanvasDriver.launch({ url, viewport: { width: 360, height: 640 }, outDir, executablePath: CHROME });
  try {
    await bootFreshCreate(driver);
    const createArt = await artProbe(driver.page, ['CreateGuide', 'ChoiceIcon', 'BrandLogo']);
    driver.check('D2-short-create-art', createArt.ChoiceIcon.count === 3 && createArt.BrandLogo.frames > 0, createArt);
    const createRects = await worldRects(driver.page, ['CreateGuide', 'ChoiceIcon']);
    driver.check('D2-short-create-no-overlap', !overlap(createRects.CreateGuide, createRects.ChoiceIcon), createRects);
    await driver.screenshot('d2-create-company-360x640');

    const staffed = fixtureWith((env) => {
      env.payload.gameYear = 2;
      env.payload.gameMonth = 3;
    });
    await driver.loadFixture(staffed);
    await driver.waitForLabel('当前可用现金', { timeoutMs: 25_000 });
    await driver.page.waitForTimeout(1000);
    const layoutProbe = await driver.page.evaluate(() => {
      const UITransformType = cc.UITransform || cc.UITransformComponent;
      const all = [];
      const walk = (node) => {
        all.push(node);
        node.children.forEach(walk);
      };
      walk(cc.director.getScene());
      const pick = (name) => {
        const node = all.find((n) => n.name === name && n.activeInHierarchy);
        const tr = node?.getComponent(UITransformType);
        const box = tr?.getBoundingBoxToWorld?.();
        return box ? { x: box.x, y: box.y, w: box.width, h: box.height } : null;
      };
      return { banner: pick('CompanyBanner'), cash: pick('CashIcon') };
    });
    driver.check('D2-short-banner-height-96', Boolean(layoutProbe.banner && Math.abs(layoutProbe.banner.h - 96) < 1), layoutProbe.banner);
    driver.check('D2-short-banner-cash-no-overlap', !overlap(layoutProbe.banner, layoutProbe.cash), layoutProbe);
    await driver.screenshot('d2-company-360x640');
  } finally {
    await driver.finish('d2-d4-short-screen.json');
  }
  return driver;
}

async function main() {
  const url = process.argv[2] || 'http://127.0.0.1:8153/';
  const outDir = process.argv[3] || 'build/logs/browser/ui-v2-d2-d4';
  fs.mkdirSync(outDir, { recursive: true });

  const full = await runFullPath(url, outDir);
  const resume = await runResume(url, outDir);
  const failures = await runFailureBranches(url, outDir);
  const short = await runShortScreen(url, outDir);

  const all = [full, resume, failures, short];
  const checks = all.flatMap((driver) => driver.checks);
  const failed = checks.filter((check) => check.status !== 'PASS' && check.status !== 'SKIP');
  const summary = {
    url,
    generatedAt: new Date().toISOString(),
    checkCounts: Object.fromEntries(
      ['PASS', 'FAIL', 'SKIP', 'BLOCKED', 'TIMEOUT'].map((status) => [status, checks.filter((check) => check.status === status).length]),
    ),
    browserErrors: all.flatMap((driver) => driver.errors),
    checks,
    status: failed.length === 0 ? 'PASS' : 'FAIL',
  };
  fs.writeFileSync(path.join(outDir, 'd2-d4-acceptance-summary.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ status: summary.status, checkCounts: summary.checkCounts, failed: failed.map((c) => c.id) }, null, 2));
  process.exitCode = failed.length === 0 ? 0 : 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
