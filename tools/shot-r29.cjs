// R29 证据：部门页 / 真实贡献与编制操作。
// T01 部门页入口可达，支持部门从 0 建到 5（长列表可滚动）。
// T02 同一部门连点确认只扣一次 1 万（ConfirmGuard + 命令幂等）。
// T03 0 人部门效益严格为 0；建部显示设立费与建后余额。
// T04 采购/客服/财务「当月估算」与月结同一套领域公式（与 G004/G014—G017 口径一致）。
// T05 页面只展示「当月估算」，明确不展示历史“已实现收益”，且不重复加总。
// T06 方针/编制改变不重写旧账（月账逐字节不变）。
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const url = process.argv[2] || 'http://localhost:8123/';
const baseDir = process.argv[3] || 'evidence/m3/TASK-M3-09-R29/attempt-01';
const dir = `${baseDir}/shots`;
const SEED_FILE = 'evidence/m3/TASK-M3-09-R27/attempt-01/seed-save-375.json';
const CFG_FILE = 'assets/resources/config/economy.v1.json';
const CHROME = process.env.CHROME_EXE || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

// ---------------------------------------------------------------- checksum（与领域层同实现）
const TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32String(text) {
  const bytes = Buffer.from(text, 'utf8');
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) crc = TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return ((crc ^ 0xffffffff) >>> 0).toString(16).padStart(8, '0');
}
function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value !== null && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = sortValue(value[key]);
    return out;
  }
  return value;
}
function computeChecksum(env) {
  const { schemaVersion, gameVersion, configVersion, revision, runId, resetGeneration, payload } = env;
  return crc32String(JSON.stringify(sortValue({ schemaVersion, gameVersion, configVersion, revision, runId, resetGeneration, payload })));
}
function seal(env) {
  const { checksum, ...rest } = env;
  return { ...rest, checksum: computeChecksum(rest) };
}

const cfg = JSON.parse(fs.readFileSync(CFG_FILE, 'utf8'));
const ind = cfg.industry.TRADE;
const roundHalfUp = (n) => Math.sign(n) * Math.round(Math.abs(n));

// ---------------------------------------------------------------- 种子
const rawSeed = JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'));
const pointerKey = 'ceo/save/active';
const pointer = JSON.parse(rawSeed[pointerKey]);
const slot = pointer.slot === 'b' ? 'b' : 'a';
const baseEnvelope = JSON.parse(rawSeed[`ceo/save/${slot}`]);
if (computeChecksum(baseEnvelope) !== baseEnvelope.checksum) {
  throw new Error(`checksum 复算失败：${computeChecksum(baseEnvelope)} != ${baseEnvelope.checksum}`);
}

const nowMs = Date.now();
function pack(env) {
  const sealed = seal(env);
  return {
    'ceo/privacy/consent': rawSeed['ceo/privacy/consent'],
    [pointerKey]: JSON.stringify({ ...pointer, revision: sealed.revision }),
    [`ceo/save/${slot}`]: JSON.stringify(sealed),
  };
}

function makeLive() {
  const env = JSON.parse(JSON.stringify(baseEnvelope));
  env.payload.speed = 0;
  env.payload.progressMsInMonth = 0;
  env.payload.lastWallClockMs = nowMs;
  return pack(env);
}

/** 已建 5 个支持部门且各有 1 名员工（用于逐部门估算对账与长列表滚动）。 */
function makeStaffed() {
  const env = JSON.parse(JSON.stringify(baseEnvelope));
  const p = env.payload;
  p.speed = 0;
  p.progressMsInMonth = 0;
  p.lastWallClockMs = nowMs;
  p.company.cashYuan = 237_027;
  const types = [
    ['PROCUREMENT', 'dp_proc_0001', '采购员甲'],
    ['CUSTOMER_SERVICE', 'dp_cs_0001', '客服员乙'],
    ['MARKETING', 'dp_mkt_0001', '市场员丙'],
    ['FINANCE', 'dp_fin_0001', '财务员丁'],
    ['HR', 'dp_hr_0001', '人事员戊'],
  ];
  p.departments = [
    ...p.departments,
    ...types.map(([type, deptId], i) => ({
      deptId,
      type,
      enabled: true,
      staffingMode: 'LOCKED',
      targetCount: 0,
      createdMonthIndex: 0,
      setupPaid: true,
      _order: i,
    })),
  ];
  p.departments.forEach((d) => delete d._order);
  p.employees = [
    ...p.employees,
    ...types.map(([, deptId, name], i) => ({
      employeeId: `emp_seed_support_${i}`,
      name,
      avatarId: 'avatar_02',
      departmentId: deptId,
      skill: 60,
      potential: 60,
      teamwork: 60,
      personality: 'STEADY',
      salaryMonthlyYuan: 5000,
      hiredAtMonthIndex: 0,
      effectiveFromMonthIndex: 0,
      dismissedAtMonthIndex: null,
      status: 'ACTIVE',
      hireCommandId: `hire_seed_support_${i}`,
      candidateId: `cand_seed_support_${i}`,
    })),
  ];
  return pack(env);
}

const liveSeed = makeLive();
const staffedSeed = makeStaffed();
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(`${baseDir}/seed-live.json`, JSON.stringify(liveSeed, null, 2));
fs.writeFileSync(`${baseDir}/seed-staffed.json`, JSON.stringify(staffedSeed, null, 2));
fs.writeFileSync(`${baseDir}/seed-base-crc-verified.json`, JSON.stringify({ ok: true, checksum: baseEnvelope.checksum }, null, 2));

// ---------------------------------------------------------------- 读取器
const readState = (page) =>
  page.evaluate(() => {
    try {
      const active = JSON.parse(localStorage.getItem('ceo/save/active') || 'null');
      const s = active && active.slot === 'b' ? 'b' : 'a';
      const env = JSON.parse(localStorage.getItem(`ceo/save/${s}`) || 'null');
      if (!env) return null;
      const p = env.payload || {};
      const c = p.company || {};
      return {
        runId: env.runId,
        revision: env.revision,
        cash: c.cashYuan,
        policy: p.policy,
        gameYear: p.gameYear,
        gameMonth: p.gameMonth,
        departments: (p.departments || []).map((d) => ({
          deptId: d.deptId,
          type: d.type,
          staffingMode: d.staffingMode,
          targetCount: d.targetCount,
          setupPaid: d.setupPaid,
        })),
        employees: (p.employees || []).map((e) => ({
          id: e.employeeId,
          deptId: e.departmentId,
          salary: e.salaryMonthlyYuan,
          skill: e.skill,
          status: e.status,
        })),
        ledgers: p.monthlyLedgersRolling || [],
        executedCommandCount: (p.executedCommandIds || []).length,
      };
    } catch (e) {
      return { error: String(e) };
    }
  });

const labels = (page) =>
  page.evaluate(() => {
    const out = [];
    const walk = (n) => {
      const label = n.getComponent(cc.Label);
      if (label && label.string && n.activeInHierarchy) {
        const wp = n.worldPosition;
        out.push({ text: label.string, wx: Math.round(wp.x), wy: Math.round(wp.y) });
      }
      for (const c of n.children) walk(c);
    };
    walk(cc.director.getScene());
    return out;
  });

const readScrollY = (page) =>
  page.evaluate(() => {
    try {
      let y = null;
      const walk = (n) => {
        if (n.name === 'BodyContent') {
          y = Math.round(n.position.y);
          return;
        }
        for (const ch of n.children) walk(ch);
      };
      walk(cc.director.getScene());
      return y;
    } catch (e) {
      return null;
    }
  });

// ---------------------------------------------------------------- 主流程
(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
  const report = { url, generatedAt: new Date().toISOString(), checks: [], states: {}, screenshots: [], errors: [] };
  const pageErrors = [];
  const shots = [];

  const geom = async (page) => {
    const g = await page.$$eval('canvas', (els) =>
      els.map((e) => {
        const r = e.getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height };
      }));
    const c = g[0];
    const scale = c.w / 375;
    return { c, scale, visibleH: c.h / scale, cx: c.x + c.w / 2, cy: c.y + c.h / 2 };
  };

  const check = (id, pass, detail) => report.checks.push({ id, pass: !!pass, detail });

  const screenOf = (G, wx, wy) => ({ x: G.c.x + wx * G.scale, y: G.c.y + (G.visibleH - wy) * G.scale });

  const mk = (page, G, tag) => {
    const u = {
      shot: async (n) => {
        const name = `${tag}-${n}.png`;
        await page.screenshot({ path: `${dir}/${name}` });
        shots.push(name);
      },
      tapText: async (textOpt, opts = {}) => {
        const { nth = 0, wait = 800, dy = 0 } = opts;
        const ls = await labels(page);
        const matches = ls.filter((l) => (typeof textOpt === 'string' ? l.text === textOpt : textOpt.test(l.text)) && l.wy > 40 && l.wy < G.visibleH - 60);
        if (!matches[nth]) throw new Error(`找不到可点文本：${textOpt}（${matches.length} 个候选）`);
        const p = screenOf(G, matches[nth].wx, matches[nth].wy + dy);
        await page.mouse.click(p.x, p.y);
        await page.waitForTimeout(wait);
        return matches[nth];
      },
      tapDesign: async (dx, dy, wait = 800) => {
        await page.mouse.click(G.cx + dx * G.scale, G.cy - dy * G.scale);
        await page.waitForTimeout(wait);
      },
      wheel: async (dx, dy, ticks = 6, amount = 600) => {
        await page.mouse.move(G.cx + dx * G.scale, G.cy - dy * G.scale);
        for (let i = 0; i < ticks; i += 1) {
          await page.mouse.wheel(0, amount);
          await page.waitForTimeout(180);
        }
        await page.waitForTimeout(600);
      },
      seed: async (seed) => {
        await page.goto(url, { waitUntil: 'load', timeout: 60000 });
        await page.evaluate((s) => {
          try {
            localStorage.clear();
            for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
          } catch (e) {}
        }, seed);
        await page.reload({ waitUntil: 'load', timeout: 60000 });
        await page.waitForTimeout(4500);
      },
      openDeptTab: async () => {
        const fy = -G.visibleH / 2 + 36;
        await page.mouse.click(G.cx - 47 * G.scale, G.cy - fy * G.scale);
        await page.waitForTimeout(900);
      },
    };
    return u;
  };

  /** 滚动列表，使目标部门名落在可点区域中部。 */
  async function ensureVisible(page, G, name, minWy = 190) {
    for (let k = 0; k < 16; k += 1) {
      const ls = await labels(page);
      const nl = ls.find((l) => l.text === name);
      if (nl && nl.wy > minWy && nl.wy < G.visibleH - 120) return nl;
      await page.mouse.move(G.cx, G.cy);
      await page.mouse.wheel(0, !nl || nl.wy < minWy ? 500 : -500);
      await page.waitForTimeout(300);
    }
    const ls = await labels(page);
    throw new Error(`无法把 ${name} 滚入可点区域：${JSON.stringify(ls.find((l) => l.text === name))}`);
  }

  /** 点击「创建」所在卡（名称 y+28，按钮中心 y）。 */
  async function tapCreateOf(page, G, u, deptName) {
    await ensureVisible(page, G, deptName, 80);
    const ls = await labels(page);
    const nameLabel = ls.find((l) => l.text === deptName);
    if (!nameLabel) throw new Error(`找不到部门名：${deptName}`);
    const p = screenOf(G, 298, nameLabel.wy - 28);
    await page.mouse.click(p.x, p.y);
    await page.waitForTimeout(900);
  }

  async function confirmCreate(page, G) {
    const ls = await labels(page);
    const btn = ls.find((l) => /^支付 .* 创建$/.test(l.text));
    if (!btn) throw new Error(`创建确认弹窗未出现：${JSON.stringify(ls.filter((l) => /支付|取消|创建/.test(l.text)).map((l) => l.text))}`);
    const p = screenOf(G, btn.wx, btn.wy);
    await page.mouse.click(p.x, p.y);
    await page.waitForTimeout(1200);
    return btn;
  }

  /** 打开部门详情：名称 y+54、详情按钮中心 y-52 → 同一卡内偏移 106。 */
  async function openDeptDetail(page, G, deptName) {
    await ensureVisible(page, G, deptName);
    const ls = await labels(page);
    const nameLabel = ls.find((l) => l.text === deptName);
    if (!nameLabel) throw new Error(`找不到部门：${deptName}`);
    const p = screenOf(G, 264, nameLabel.wy - 106);
    await page.mouse.click(p.x, p.y);
    await page.waitForTimeout(1000);
    const ld = await labels(page);
    if (!ld.some((l) => l.text.startsWith('当月估算效益'))) {
      throw new Error(`${deptName} 详情未打开：${JSON.stringify(ld.filter((l) => /详情|关闭|估算/.test(l.text)).map((l) => l.text))}`);
    }
    return ld;
  }

  /** 关闭当前滚动弹窗，并确认已真正关闭（含一次重试）。 */
  async function closeDialog(page, G) {
    for (let i = 0; i < 3; i += 1) {
      const ls = await labels(page);
      if (!ls.some((l) => l.text.startsWith('当月估算效益') || l.text.includes('自动经营预算预览'))) return true;
      const c = ls.find((l) => l.text === '关闭');
      if (!c) break;
      const p = screenOf(G, c.wx, c.wy);
      await page.mouse.click(p.x, p.y);
      await page.waitForTimeout(900);
    }
    return !(await labels(page)).some((l) => l.text.startsWith('当月估算效益'));
  }

  const fmt = (n) => `¥${Math.abs(n).toLocaleString('en-US')}`;
  const compact = (n) => {
    if (Math.abs(n) >= 10_000) return `¥${(n / 10_000).toFixed(1)}万`;
    return `¥${n.toLocaleString('en-US')}`;
  };

  // ============================================================ A：375×812 实时建部流程
  {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => pageErrors.push(`A:${e.message}`));
    await page.goto(url, { waitUntil: 'load', timeout: 60000 });
    const G = await geom(page);
    const u = mk(page, G, '375');
    await u.seed(liveSeed);
    await u.openDeptTab();
    const s0 = await readState(page);
    report.states.liveInitial = s0;
    const l0 = await labels(page);
    await u.shot('01-dept-page-from-zero');
    check(
      'T01-dept-entry-reachable',
      s0.departments.length === 1 && l0.some((l) => l.text === '自动预算｜稳健：ROI≥1.0｜保留 6 个月刚性费用｜可支配 ¥18.5万' || l0.some((x) => x.text.startsWith('自动预算｜'))),
      { deptCount: s0.departments.length, hasAutoBudget: l0.some((l) => l.text.startsWith('自动预算｜')) },
    );
    check('T05-no-fake-history-claim', l0.some((l) => l.text.includes('未按部门留存归因')), {
      text: l0.find((l) => l.text.includes('归因'))?.text,
    });

    // T02：先取消（不扣款）
    await tapCreateOf(page, G, u, '采购部');
    const lConfirm = await labels(page);
    await u.shot('02-create-confirm-cancel');
    check(
      'T03-create-shows-fee-and-balance',
      lConfirm.some((l) => l.text.includes('设立费：¥10,000')) &&
        lConfirm.some((l) => l.text.includes('¥287,027') && l.text.includes('¥277,027')) &&
        lConfirm.some((l) => l.text.includes('0 员工无部门效益')),
      { texts: lConfirm.filter((l) => l.text.includes('设立费') || l.text.includes('现金：')).map((l) => l.text) },
    );
    await u.tapText('再想想（取消）', { wait: 900 });
    const afterCancel = await readState(page);
    check('T02-cancel-no-charge', afterCancel.cash === s0.cash && afterCancel.departments.length === 1, {
      cash: afterCancel.cash,
      depts: afterCancel.departments.length,
    });
    await u.shot('03-cancelled');

    // T02：确认按钮连点两次 → 只扣一次
    await tapCreateOf(page, G, u, '采购部');
    const confirmLabel = (await labels(page)).find((l) => /^支付 .* 创建$/.test(l.text));
    const cp = screenOf(G, confirmLabel.wx, confirmLabel.wy);
    await page.mouse.click(cp.x, cp.y);
    await page.mouse.click(cp.x, cp.y);
    await page.waitForTimeout(1400);
    const afterCreate = await readState(page);
    const procDept = afterCreate.departments.find((d) => d.type === 'PROCUREMENT');
    check(
      'T02-double-tap-charges-once',
      afterCreate.cash === s0.cash - 10_000 && afterCreate.departments.length === 2 && !!procDept,
      { cashBefore: s0.cash, cashAfter: afterCreate.cash, deptCount: afterCreate.departments.length },
    );
    check('T03-new-dept-default-locked-zero-staff', procDept?.staffingMode === 'LOCKED' && afterCreate.employees.length === s0.employees.length, {
      staffingMode: procDept?.staffingMode,
      employees: afterCreate.employees.length,
    });

    // 滚到采购卡，确认 0 人无效益展示
    await u.wheel(0, 0, 2, 500);
    const lZero = await labels(page);
    await u.shot('04-zero-staff-card');
    check(
      'T03-zero-staff-shows-zero',
      lZero.some((l) => l.text === '尚未配置人员：无部门效益') &&
        lZero.some((l) => l.text.includes('估算无效益 ¥0') && l.text.includes('净贡献 ¥0')),
      { texts: lZero.filter((l) => l.text.includes('尚未配置') || l.text.includes('净贡献')).map((l) => l.text) },
    );
    await page.mouse.move(G.cx, G.cy);
    for (let i = 0; i < 8; i += 1) {
      await page.mouse.wheel(0, -600);
      await page.waitForTimeout(150);
    }
    await page.waitForTimeout(600);

    // T01：把剩余 4 个部门建满（0 → 5）
    const created = [];
    for (const name of ['客服部', '市场部', '财务部', '人力资源部']) {
      await tapCreateOf(page, G, u, name);
      await confirmCreate(page, G);
      const s = await readState(page);
      created.push({ name, cash: s.cash, depts: s.departments.length });
    }
    const sAll = await readState(page);
    const supportCount = sAll.departments.filter((d) => d.type !== 'BUSINESS').length;
    check(
      'T01-five-support-depts-created',
      supportCount === 5 && sAll.cash === s0.cash - 50_000 && sAll.departments.every((d) => d.setupPaid),
      { created, cash: sAll.cash, expectedCash: s0.cash - 50_000, supportCount },
    );
    const lAll = await labels(page);
    check('T01-no-uncreated-entries-left', lAll.every((l) => l.text !== '创建' && l.text !== '余额不足'), {
      remaining: lAll.filter((l) => l.text === '创建').length,
    });

    // 长列表：滚到底部截图（财务/客服等 0 人卡可读）
    await u.wheel(0, 0, 10, 600);
    await u.shot('05-long-list-bottom');
    const scrollBottom = await readScrollY(page);
    check('T01-long-list-scrollable', scrollBottom !== null && scrollBottom !== 0, { scrollY: scrollBottom });

    // T06：方针/编制变更不改旧账
    const ledgersBefore = JSON.stringify(sAll.ledgers);
    await page.mouse.move(G.cx, G.cy);
    for (let i = 0; i < 12; i += 1) {
      await page.mouse.wheel(0, -600);
      await page.waitForTimeout(150);
    }
    await page.waitForTimeout(700);
    await u.tapText('利润优先', { wait: 1000 });
    await u.tapText('扩张', { wait: 1000 });
    await u.tapText('稳健', { wait: 1000 });
    // 切财务部编制：打开详情 → 切为自动编制
    const lDetail = await openDeptDetail(page, G, '财务部');
    await u.shot('06-finance-detail-zero');
    check(
      'T02-detail-shows-attribution-limit',
      lDetail.some((l) => l.text.includes('归因限制')) && lDetail.some((l) => l.text.includes('0 人，效益严格为 0')),
      { texts: lDetail.filter((l) => l.text.includes('归因') || l.text.includes('0 人')).map((l) => l.text) },
    );
    // 建议人数 +1：仅记录目标，不扣费
    await u.tapText('＋', { wait: 900 });
    const afterTarget = await readState(page);
    const finDept = afterTarget.departments.find((d) => d.type === 'FINANCE');
    check('T02-target-count-recorded-no-cost', finDept?.targetCount === 1 && afterTarget.cash === sAll.cash, {
      targetCount: finDept?.targetCount,
      cash: afterTarget.cash,
    });
    // 切为自动编制（关闭后回列表）
    await u.tapText('切为自动编制', { wait: 1400 });
    const afterMode = await readState(page);
    const finDept2 = afterMode.departments.find((d) => d.type === 'FINANCE');
    const ledgersAfter = JSON.stringify(afterMode.ledgers);
    check(
      'T06-policy-staffing-does-not-rewrite-ledgers',
      ledgersBefore === ledgersAfter && finDept2?.staffingMode === 'AUTO' && afterMode.cash === sAll.cash,
      { ledgerEqual: ledgersBefore === ledgersAfter, staffingMode: finDept2?.staffingMode, cash: afterMode.cash, modePolicy: afterMode.policy },
    );

    // 自动预算预览（AUTO 部门数 = 主营 + 财务 = 2）
    await page.mouse.move(G.cx, G.cy);
    for (let i = 0; i < 10; i += 1) {
      await page.mouse.wheel(0, -600);
      await page.waitForTimeout(150);
    }
    await page.waitForTimeout(700);
    await u.tapText('预览', { wait: 1200 });
    await u.shot('07-auto-budget-preview');
    const lBudget = await labels(page);
    const payroll = afterMode.employees.filter((e) => e.status === 'ACTIVE').reduce((n, e) => n + e.salary, 0);
    const reserve = Math.round((payroll + ind.fixedManagementAnnualYuan / 12) * 6);
    const spendable = afterMode.cash - reserve;
    check(
      'T01-auto-budget-preview-real-values',
      lBudget.some((l) => l.text.includes('AUTO 编制部门：2 个')) &&
        lBudget.some((l) => l.text.includes(`可支配余量：${fmt(spendable)}`)) &&
        lBudget.some((l) => l.text.includes('不会自动裁员、不会自动建部门、不会自动扩产')),
      {
        reserve,
        spendable,
        budgetLabels: lBudget.filter((l) => l.text.includes('可支配') || l.text.includes('AUTO')).map((l) => l.text),
      },
    );
    await closeDialog(page, G);
    fs.writeFileSync(`${baseDir}/state-375-live.json`, JSON.stringify({ s0, afterCancel, afterCreate, sAll, afterTarget, afterMode }, null, 2));
    report.states.liveCreated = { cash: afterMode.cash, departments: afterMode.departments };
    await ctx.close();
  }

  // ============================================================ B：375×812 有员工档（T04 对账）
  {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => pageErrors.push(`B:${e.message}`));
    await page.goto(url, { waitUntil: 'load', timeout: 60000 });
    const G = await geom(page);
    const u = mk(page, G, '375-staffed');
    await u.seed(staffedSeed);
    await u.openDeptTab();
    const sb = await readState(page);
    report.states.staffed = { cash: sb.cash, departments: sb.departments, employees: sb.employees.length };
    await u.shot('08-staffed-dept-top');
    const lb = await labels(page);
    check(
      'T04-staffed-cards-render',
      lb.some((l) => l.text === '在岗 1 人｜月薪合计 ¥5,000'),
      { headcountTexts: lb.filter((l) => l.text.startsWith('在岗')).map((l) => l.text) },
    );

    // 打开「主营业务部」详情拿精确预计收入 → 与采购/客服/财务估算对账
    const lBiz = await openDeptDetail(page, G, '主营业务部');
    await u.shot('09-business-detail');
    const revLine = lBiz.find((l) => /预计收入 ¥[\d,]+/.test(l.text));
    const revenue = revLine ? Number(revLine.text.match(/预计收入 ¥([\d,]+)/)?.[1]?.replace(/,/g, '')) : NaN;
    check('T04-business-detail-revenue-exact', Number.isFinite(revenue) && revenue > 0, { line: revLine?.text, revenue });
    await closeDialog(page, G);

    // 依次打开支持部门详情，读取精确「当月估算效益」
    const getDetailValue = async (deptName) => {
      const ld = await openDeptDetail(page, G, deptName);
      const line = ld.find((l) => l.text.startsWith('当月估算效益'));
      const m = line?.text.match(/¥([\d,]+)/);
      const value = m ? Number(m[1].replace(/,/g, '')) : NaN;
      const coeff = ld.find((l) => l.text.includes('部门系数'))?.text;
      return { deptName, value, coeff, line: line?.text };
    };

    const proc = await getDetailValue('采购部');
    await u.shot('10-procurement-detail');
    const grossDirect = roundHalfUp((revenue * ind.directCostBps) / 10_000);
    const expectedProc = roundHalfUp((grossDirect * ind.procurementEligibleDirectCostBps * 1000) / 10_000 ** 2);
    check('T04-procurement-matches-monthly-formula', proc.value === expectedProc, { ...proc, expected: expectedProc });
    await closeDialog(page, G);

    const cs = await getDetailValue('客服部');
    await u.shot('11-customer-service-detail');
    const grossAfter = roundHalfUp((revenue * ind.afterSalesCostBps) / 10_000);
    const afterNet = roundHalfUp((grossAfter * (10_000 - 3500)) / 10_000);
    const expectedCs = grossAfter - afterNet;
    check('T04-customer-service-matches-monthly-formula', cs.value === expectedCs, { ...cs, expected: expectedCs });
    await closeDialog(page, G);

    const fin = await getDetailValue('财务部');
    await u.shot('12-finance-detail-staffed');
    const otherGross = roundHalfUp((revenue * ind.otherOperatingCostBps) / 10_000);
    const expectedFin = roundHalfUp(((ind.fixedManagementAnnualYuan / 12 + otherGross) * 2000) / 10_000);
    check('T04-finance-matches-monthly-formula', fin.value === expectedFin, { ...fin, expected: expectedFin });
    await closeDialog(page, G);

    const mkt = await getDetailValue('市场部');
    await u.shot('13-marketing-detail');
    await closeDialog(page, G);
    const hr = await getDetailValue('人力资源部');
    await u.shot('14-hr-detail');
    check(
      'T04-marketing-hr-nonnegative-and-labeled',
      mkt.value >= 0 && hr.value >= 0 && mkt.coeff?.includes('部门系数') && hr.coeff?.includes('部门系数'),
      { marketing: mkt, hr },
    );
    await closeDialog(page, G);

    // 自动预算预览：现金低于安全线 → 冻结提示
    await page.mouse.move(G.cx, G.cy);
    for (let i = 0; i < 8; i += 1) {
      await page.mouse.wheel(0, -600);
      await page.waitForTimeout(150);
    }
    await page.waitForTimeout(600);
    await u.tapText('预览', { wait: 1200 });
    await u.shot('15-auto-budget-frozen');
    const lFrozen = await labels(page);
    check(
      'T01-auto-budget-flags-below-safety-line',
      lFrozen.some((l) => l.text.includes('低于安全线')) &&
        lFrozen.some((l) => l.text.includes('AUTO 编制部门：1 个')),
      { texts: lFrozen.filter((l) => l.text.includes('可支配') || l.text.includes('AUTO')).map((l) => l.text) },
    );

    fs.writeFileSync(`${baseDir}/state-375-staffed.json`, JSON.stringify({ revenue, proc, cs, fin, mkt, hr }, null, 2));
    report.finance = { revenue, procurement: proc.value, customerService: cs.value, finance: fin.value, expected: { procurement: expectedProc, customerService: expectedCs, finance: expectedFin } };
    await ctx.close();
  }

  // ============================================================ C：360×640 小屏长列表 + 弹窗滚动
  {
    const ctx = await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => pageErrors.push(`C:${e.message}`));
    await page.goto(url, { waitUntil: 'load', timeout: 60000 });
    const G = await geom(page);
    const u = mk(page, G, '360');
    await u.seed(staffedSeed);
    await u.openDeptTab();
    await u.shot('16-small-dept-top');
    await u.wheel(0, 0, 12, 600);
    await u.shot('17-small-dept-bottom');
    const smallLabels = await labels(page);
    check('T01-small-screen-list-reaches-hr-or-finance', smallLabels.some((l) => l.text === '人力资源部' || l.text === '财务部'), {
      names: smallLabels.filter((l) => ['主营业务部', '采购部', '客服部', '市场部', '财务部', '人力资源部'].includes(l.text)).map((l) => l.text),
    });
    // 详情弹窗正文可滚动、底部按钮固定
    await openDeptDetail(page, G, '人力资源部');
    await u.shot('18-small-detail-top');
    await u.wheel(0, 0, 3, 300);
    await u.shot('19-small-detail-scrolled');
    await closeDialog(page, G);
    await u.shot('20-small-closed');
    fs.writeFileSync(`${baseDir}/state-360.json`, JSON.stringify({ scrollY: await readScrollY(page) }, null, 2));
    await ctx.close();
  }

  // ============================================================ D：390×844 第三尺寸
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => pageErrors.push(`D:${e.message}`));
    await page.goto(url, { waitUntil: 'load', timeout: 60000 });
    const G = await geom(page);
    const u = mk(page, G, '390');
    await u.seed(staffedSeed);
    await u.openDeptTab();
    await u.shot('21-390-dept-top');
    const l390 = await labels(page);
    await u.tapText('预览', { wait: 1200 });
    await u.shot('22-390-auto-budget');
    const lBudget = await labels(page);
    check('D-third-viewport-dept-stable', l390.some((l) => l.text === '主营业务部') && lBudget.some((l) => l.text.includes('当前方针')), {
      topHasBusiness: l390.some((l) => l.text === '主营业务部'),
      budgetOpen: lBudget.some((l) => l.text.includes('当前方针')),
    });
    await closeDialog(page, G);
    fs.writeFileSync(`${baseDir}/state-390.json`, JSON.stringify({ deptNames: l390.filter((l) => l.text.endsWith('部')).map((l) => l.text) }, null, 2));
    await ctx.close();
  }

  report.screenshots = shots;
  report.errors = pageErrors;
  const failed = report.checks.filter((c) => !c.pass);
  report.ok = failed.length === 0 && pageErrors.length === 0;
  fs.writeFileSync(`${baseDir}/r29-report.json`, JSON.stringify(report, null, 2));
  await browser.close();
  console.log(JSON.stringify({ ok: report.ok, checks: report.checks.length, failed, errors: pageErrors, shots: shots.length }, null, 2));
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
