// R30 证据：人才列表 / 筛选 / 详情 / 调岗 / 裁员。
// T01 0/2/10/30/100 员工末项可达；>12 条用 12 张卡片池虚拟化，滚动复用不串员工。
// T02 部门筛选与人数/月薪合计准确，空部门显示空态。
// T03 裁员取消零变更；连点仅一次补偿；次月起停薪（月账工资下降）。
// T04 调岗下月生效，当月仍原部门计薪，次月只计一次（工资总额不变）。
// T05 确认 token 过期、余额不足、员工已变动均被拒绝且状态不变。
// T06 系统从不自动裁员（多月推进后无 PENDING/DISMISSED、无 SEVERANCE 账目）。
const { chromium } = require('playwright-core');
const fs = require('fs');

const url = process.argv[2] || 'http://localhost:8123/';
const baseDir = process.argv[3] || 'evidence/m3/TASK-M3-09-R30/attempt-01';
const dir = `${baseDir}/shots`;
const SEED_FILE = 'evidence/m3/TASK-M3-09-R27/attempt-01/seed-save-375.json';
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

const BUSINESS_DEPT = 'dp_1h6ho9p000000';
const SUPPORT = [
  ['HR', 'dp_hr_0001', '人事员戊', 'emp_hr_1'],
  ['PROCUREMENT', 'dp_proc_0001', '采购员甲', 'emp_proc_1'],
  ['MARKETING', 'dp_mkt_0001', '市场员丙', 'emp_mkt_1'],
  ['CUSTOMER_SERVICE', 'dp_cs_0001', '客服员乙', 'emp_cs_1'],
  ['FINANCE', 'dp_fin_0001', null, null],
];

function emp(id, name, deptId, skill, potential, teamwork, salary, personality = 'STEADY') {
  return {
    employeeId: id,
    name,
    avatarId: 'avatar_02',
    departmentId: deptId,
    skill,
    potential,
    teamwork,
    personality,
    salaryMonthlyYuan: salary,
    hiredAtMonthIndex: 0,
    effectiveFromMonthIndex: 0,
    dismissedAtMonthIndex: null,
    status: 'ACTIVE',
    hireCommandId: `hire_${id}`,
    candidateId: `cand_${id}`,
  };
}

/** 基础档：主营 2 人 + 4 个有人的支持部门 + 财务 0 人（6 人，月薪合计 32,973）。 */
function makeStaffed(cash = 1_000_000) {
  const env = JSON.parse(JSON.stringify(baseEnvelope));
  const p = env.payload;
  p.speed = 0;
  p.progressMsInMonth = 0;
  p.lastWallClockMs = nowMs;
  p.company.cashYuan = cash;
  p.departments = [
    { deptId: BUSINESS_DEPT, type: 'BUSINESS', enabled: true, staffingMode: 'LOCKED', targetCount: 0, createdMonthIndex: 0, setupPaid: true },
    ...SUPPORT.map(([type, deptId]) => ({
      deptId, type, enabled: true, staffingMode: 'LOCKED', targetCount: 0, createdMonthIndex: 0, setupPaid: true,
    })),
  ];
  p.employees = [
    emp('emp_base_1', '梁思远', BUSINESS_DEPT, 87, 60, 81, 7645),
    emp('emp_base_2', '宋刚', BUSINESS_DEPT, 72, 63, 69, 5328),
    emp(SUPPORT[0][3], SUPPORT[0][2], SUPPORT[0][1], 60, 60, 60, 5000),
    emp(SUPPORT[1][3], SUPPORT[1][2], SUPPORT[1][1], 60, 60, 60, 5000),
    emp(SUPPORT[2][3], SUPPORT[2][2], SUPPORT[2][1], 60, 60, 60, 5000),
    emp(SUPPORT[3][3], SUPPORT[3][2], SUPPORT[3][1], 60, 60, 60, 5000),
  ];
  return pack(env);
}

/** 大列表档：n 名主营员工，姓名 员工001…，月薪 4000-10i（工资降序 → 员工001 在列表最前）。 */
function makeSized(n) {
  const env = JSON.parse(JSON.stringify(baseEnvelope));
  const p = env.payload;
  p.speed = 0;
  p.progressMsInMonth = 0;
  p.lastWallClockMs = nowMs;
  p.company.cashYuan = 2_000_000;
  p.departments = [
    { deptId: BUSINESS_DEPT, type: 'BUSINESS', enabled: true, staffingMode: 'LOCKED', targetCount: 0, createdMonthIndex: 0, setupPaid: true },
  ];
  p.employees = [];
  for (let i = 1; i <= n; i += 1) {
    const no = String(i).padStart(3, '0');
    p.employees.push(emp(`emp_size_${no}`, `员工${no}`, BUSINESS_DEPT, 60 + (i % 30), 60, 60, 4000 - i * 10));
  }
  return pack(env);
}

const staffedSeed = makeStaffed();
const poorSeed = makeStaffed(3_000);
const sizedSeeds = Object.fromEntries([0, 2, 10, 30, 100].map((n) => [n, makeSized(n)]));
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(`${baseDir}/seed-staffed.json`, JSON.stringify(staffedSeed, null, 2));
fs.writeFileSync(`${baseDir}/seed-poor.json`, JSON.stringify(poorSeed, null, 2));
for (const n of [0, 2, 10, 30, 100]) {
  fs.writeFileSync(`${baseDir}/seed-size-${n}.json`, JSON.stringify(sizedSeeds[n], null, 2));
}

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
        phase: p.phase,
        gameYear: p.gameYear,
        gameMonth: p.gameMonth,
        policy: p.policy,
        departments: (p.departments || []).map((d) => ({ deptId: d.deptId, type: d.type, enabled: d.enabled })),
        employees: (p.employees || []).map((e) => ({
          id: e.employeeId,
          name: e.name,
          deptId: e.departmentId,
          salary: e.salaryMonthlyYuan,
          status: e.status,
          pending: e.pendingDepartmentId || null,
          pendingFrom: typeof e.transferFromMonthIndex === 'number' ? e.transferFromMonthIndex : null,
          dismissedAt: e.dismissedAtMonthIndex === null ? null : e.dismissedAtMonthIndex,
        })),
        ledgers: (p.monthlyLedgersRolling || []).map((l) => ({
          year: l.year,
          month: l.month,
          payroll: l.payrollYuan,
          severance: l.severanceCostYuan,
          recruitment: l.recruitmentCostYuan,
        })),
        pendingEntries: (p.pendingEntries || []).map((e) => ({ category: e.category, amount: e.amountYuan, refId: e.refId })),
        automationLogs: (p.automationLogs || []).slice(-10),
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

const readTalentCards = (page) =>
  page.evaluate(() => {
    const out = [];
    const walk = (n) => {
      const tr = n.getComponent(cc.UITransformComponent);
      if (tr && Math.abs(tr.height - 108) < 1 && Math.abs(tr.width - 343) < 1 && n.activeInHierarchy) {
        const texts = n.children.map((c) => c.getComponent(cc.Label)?.string).filter(Boolean);
        if (texts.length >= 4) out.push({ labels: texts, wy: Math.round(n.worldPosition.y) });
        return;
      }
      for (const c of n.children) walk(c);
    };
    walk(cc.director.getScene());
    return out;
  });

const readTalentCardGeometry = (page, employeePrefix) =>
  page.evaluate((prefix) => {
    const boxes = (node) => {
      const r = node.getComponent(cc.UITransformComponent).getBoundingBoxToWorld();
      return { left: r.x, right: r.x + r.width, bottom: r.y, top: r.y + r.height };
    };
    let found = null;
    const walk = (node) => {
      if (!node.activeInHierarchy) return;
      const label = node.getComponent(cc.Label);
      if (label?.string?.startsWith(prefix)) {
        const card = node.parent;
        const child = (start) => card.children.find((n) => n.getComponent(cc.Label)?.string?.startsWith(start));
        const meta = child('能力');
        const pay = child('月薪');
        const status = card.children.find((n) => n.getComponent(cc.Label)?.string?.includes('下月调岗'));
        if (meta && pay && status) found = {
          name: { text: label.string, ...boxes(node) },
          meta: { text: meta.getComponent(cc.Label).string, ...boxes(meta) },
          card: boxes(card),
          pay: { text: pay.getComponent(cc.Label).string, ...boxes(pay) },
          status: { text: status.getComponent(cc.Label).string, ...boxes(status) },
        };
      }
      node.children.forEach(walk);
    };
    walk(cc.director.getScene());
    return found;
  }, employeePrefix);

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
  const money = (n) => `${n < 0 ? '-' : ''}¥${Math.abs(n).toLocaleString('en-US')}`;

  const mk = (page, G, tag) => ({
    shot: async (n) => {
      const name = `${tag}-${n}.png`;
      await page.screenshot({ path: `${dir}/${name}` });
      shots.push(name);
    },
    tapText: async (textOpt, opts = {}) => {
      const { nth = 0, wait = 800, minWy = 40 } = opts;
      const ls = await labels(page);
      const matches = ls.filter((l) => (typeof textOpt === 'string' ? l.text === textOpt : textOpt.test(l.text)) && l.wy > minWy && l.wy < G.visibleH - 40);
      if (!matches[nth]) throw new Error(`找不到可点文本：${textOpt}（${matches.length} 个候选）`);
      const p = screenOf(G, matches[nth].wx, matches[nth].wy);
      await page.mouse.click(p.x, p.y);
      await page.waitForTimeout(wait);
      return matches[nth];
    },
    wheel: async (dy = 500, ticks = 6) => {
      await page.mouse.move(G.cx, G.cy);
      for (let i = 0; i < ticks; i += 1) {
        await page.mouse.wheel(0, dy);
        await page.waitForTimeout(160);
      }
      await page.waitForTimeout(500);
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
    openTab: async (index) => {
      const fy = -G.visibleH / 2 + 36;
      const x = -141 + index * 94;
      await page.mouse.click(G.cx + x * G.scale, G.cy - fy * G.scale);
      await page.waitForTimeout(900);
    },
  });

  async function ensureCardVisible(page, G, prefix, minWy = 110) {
    // Larger uniform cards need additional wheel events to traverse 100 rows.
    for (let k = 0; k < 100; k += 1) {
      const cards = await readTalentCards(page);
      const c = cards.find((x) => x.labels[0].startsWith(prefix));
      if (c && c.wy > minWy && c.wy < G.visibleH - 150) return c;
      await page.mouse.move(G.cx, G.cy);
      await page.mouse.wheel(0, !c || c.wy < minWy ? 500 : -500);
      await page.waitForTimeout(220);
    }
    throw new Error(`无法把卡片滚入可点区域：${prefix}`);
  }

  async function clickCardDetail(page, G, cardWy) {
    const ls = await labels(page);
    const btn = ls
      .filter((l) => l.text === '详情' && Math.abs(l.wy - cardWy) < 45)
      .sort((a, b) => Math.abs(a.wy - cardWy) - Math.abs(b.wy - cardWy))[0];
    if (!btn) throw new Error(`卡片 y=${cardWy} 上找不到详情按钮`);
    const p = screenOf(G, btn.wx, btn.wy);
    await page.mouse.click(p.x, p.y);
    await page.waitForTimeout(1000);
  }

  async function openEmployeeDetail(page, G, name) {
    const card = await ensureCardVisible(page, G, `${name}（`);
    await clickCardDetail(page, G, card.wy);
    const ls = await labels(page);
    if (!ls.some((l) => l.text === '员工详情')) throw new Error(`${name} 详情未打开`);
    return ls;
  }

  async function closeAnyDialog(page, G) {
    for (let i = 0; i < 3; i += 1) {
      const ls = await labels(page);
      const text = ['员工详情', '调岗目标', '确认调岗？', '确认裁员？'];
      const open = text.find((t) => ls.some((l) => l.text === t));
      if (!open) return true;
      const target = open === '员工详情' ? '关闭' : open === '调岗目标' ? '取消' : '再想想（取消）';
      const c = ls.find((l) => l.text === target);
      if (!c) break;
      const p = screenOf(G, c.wx, c.wy);
      await page.mouse.click(p.x, p.y);
      await page.waitForTimeout(800);
    }
    return !(await labels(page)).some((l) => ['员工详情', '调岗目标', '确认调岗？', '确认裁员？'].includes(l.text));
  }

  async function advanceMonths(page, G, u, months) {
    await u.openTab(0);
    const before = await readState(page);
    const startIndex = (before.gameYear - 1) * 12 + (before.gameMonth - 1);
    const target = startIndex + months;
    await u.tapText('5×', { wait: 700 });
    const deadline = Date.now() + 40000;
    let current = startIndex;
    let stall = 0;
    let lastSeen = startIndex;
    while (Date.now() < deadline) {
      const s = await readState(page);
      if (s && s.gameYear) {
        current = (s.gameYear - 1) * 12 + (s.gameMonth - 1);
        if (current >= target) break;
      }
      stall = current === lastSeen ? stall + 1 : 0;
      lastSeen = current;
      if (stall >= 6) {
        // 月结后若被自动暂停（风险提示等），重新点 5× 继续推进
        try {
          await u.tapText('5×', { wait: 500 });
        } catch {}
        stall = 0;
      }
      await page.waitForTimeout(700);
    }
    console.log('[advanceMonths]', JSON.stringify({ startIndex, target, current }));
    await u.tapText('暂停', { wait: 900 });
    return { startIndex, endIndex: current };
  }

  const payrollOf = (n) => 4000 * n - (10 * n * (n + 1)) / 2;

  // ============================================================ A：375×812 筛选/详情/调岗
  {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => pageErrors.push(`A:${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error') console.log('[console.error A]', m.text().slice(0, 300));
    });
    await page.goto(url, { waitUntil: 'load', timeout: 60000 });
    const G = await geom(page);
    const u = mk(page, G, '375');
    await u.seed(staffedSeed);
    await u.openTab(2);
    const s0 = await readState(page);
    const l0 = await labels(page);
    await u.shot('01-talent-top');
    check('T02-headcount-and-payroll', l0.some((l) => l.text === '在职 6 人｜月薪合计 ¥32,973'), {
      totalLine: l0.find((l) => l.text.startsWith('在职')).text,
      expected: 7645 + 5328 + 5000 * 4,
    });
    const chips = ['全部 6', '主营业务 2', '人力资源 1', '采购 1', '市场 1', '客服 1', '财务 0'];
    check('T02-filter-chips-accurate', chips.every((c) => l0.some((l) => l.text === c)), {
      missing: chips.filter((c) => !l0.some((l) => l.text === c)),
    });
    const cards0 = await readTalentCards(page);
    check('T01-six-rows-all-active', cards0.length === 6 && cards0.every((c) => c.labels[3] === '在职'), {
      cards: cards0.map((c) => c.labels[0]),
    });

    // 空部门筛选
    await u.tapText('财务 0', { wait: 1000 });
    const lFin = await labels(page);
    await u.shot('02-filter-empty-finance');
    check(
      'T02-empty-department-state',
      lFin.some((l) => l.text === '在职 0 人｜月薪合计 ¥0（全公司 6 人｜¥32,973）') && lFin.some((l) => l.text === '该部门暂无员工'),
      { texts: lFin.filter((l) => l.text.startsWith('在职') || l.text.includes('暂无')).map((l) => l.text) },
    );
    // 采购筛选
    await u.tapText('采购 1', { wait: 1000 });
    const lProc = await labels(page);
    const cardsProc = await readTalentCards(page);
    await u.shot('03-filter-procurement');
    check(
      'T02-filter-scope-accurate',
      lProc.some((l) => l.text === '在职 1 人｜月薪合计 ¥5,000（全公司 6 人｜¥32,973）') &&
        cardsProc.length === 1 &&
        cardsProc[0].labels[0].startsWith('采购员甲'),
      { line: lProc.find((l) => l.text.startsWith('在职')).text, cards: cardsProc.map((c) => c.labels[0]) },
    );
    await u.tapText('全部 6', { wait: 1000 });

    // 员工详情字段
    const lDetail = await openEmployeeDetail(page, G, '宋刚');
    await u.shot('04-employee-detail');
    check(
      'T05-detail-fields-complete',
      lDetail.some((l) => l.text === '主营业务部｜月薪 ¥5,328') &&
        lDetail.some((l) => l.text === '能力 72｜潜力 63｜协作 69') &&
        lDetail.some((l) => l.text === '入职 1 个月（第 1 年 1 月入职）') &&
        lDetail.some((l) => l.text === '状态：在职') &&
        lDetail.some((l) => l.text.startsWith('调岗：下月生效')) &&
        lDetail.some((l) => l.text.startsWith('裁员：仅玩家主动触发')),
      { lines: lDetail.filter((l) => l.text.includes('月薪') || l.text.startsWith('能力') || l.text.startsWith('入职') || l.text.startsWith('状态')).map((l) => l.text) },
    );

    // 调岗预览
    await u.tapText('调岗', { wait: 1000 });
    const lTargets = await labels(page);
    await u.shot('05-transfer-targets');
    check(
      'T04-transfer-targets-and-impact',
      lTargets.some((l) => l.text === '调入 客服部（1→2 人）') &&
        lTargets.some((l) => l.text === '调入 财务部（0→1 人）') &&
        lTargets.some((l) => l.text.includes('下月生效，当月仍按原部门计薪')),
      { targets: lTargets.filter((l) => l.text.startsWith('调入')).map((l) => l.text) },
    );
    await u.tapText('调入 客服部（1→2 人）', { wait: 1000 });
    const lConfirm = await labels(page);
    await u.shot('06-transfer-confirm');
    const expectedPayroll = 32_973;
    check(
      'T04-transfer-confirm-shows-before-after',
      lConfirm.some((l) => l.text.includes('员工：宋刚（月薪 ¥5,328）')) &&
        lConfirm.some((l) => l.text.includes('原部门人数：2 → 1')) &&
        lConfirm.some((l) => l.text.includes('目标部门人数：1 → 2')) &&
        lConfirm.some((l) => l.text.includes('工资总额：¥32,973（同一员工只计一次）')) &&
        lConfirm.some((l) => l.text.includes('生效：第 1 年 2 月')) &&
        lConfirm.some((l) => l.text.includes('主营产能：次月起 -')),
      { message: lConfirm.find((l) => l.text.startsWith('员工：宋刚'))?.text },
    );
    const tBtn = (await labels(page)).find((l) => l.text === '确认调岗（下月生效）');
    const tp = screenOf(G, tBtn.wx, tBtn.wy);
    await page.mouse.click(tp.x, tp.y);
    await page.mouse.click(tp.x, tp.y);
    await page.waitForTimeout(1400);
    const sTransfer = await readState(page);
    const song = sTransfer.employees.find((e) => e.name === '宋刚');
    const csDept = sTransfer.departments.find((d) => d.type === 'CUSTOMER_SERVICE');
    check(
      'T04-transfer-single-command-no-double',
      song.deptId === BUSINESS_DEPT &&
        song.pending === csDept.deptId &&
        song.pendingFrom === 1 &&
        sTransfer.cash === s0.cash &&
        sTransfer.executedCommandCount === s0.executedCommandCount + 1 &&
        sTransfer.employees.filter((e) => e.status === 'ACTIVE').reduce((n, e) => n + e.salary, 0) === expectedPayroll,
      { song, cash: sTransfer.cash, before: s0.cash, commands: [s0.executedCommandCount, sTransfer.executedCommandCount], payroll: expectedPayroll },
    );

    await u.shot('07-after-transfer');
    const lAfter = await labels(page);
    const cardsAfter = await readTalentCards(page);
    check(
      'T04-transfer-row-pending-label',
      cardsAfter.some((c) => c.labels[0].startsWith('宋刚（主营') && c.labels[3] === '下月调岗→客服'),
      { cards: cardsAfter.map((c) => c.labels[0]), states: cardsAfter.map((c) => c.labels[3]) },
    );
    const transferGeometry = await readTalentCardGeometry(page, '宋刚（主营');
    const overlap = transferGeometry
      ? Math.max(0, Math.min(transferGeometry.pay.top, transferGeometry.status.top) -
        Math.max(transferGeometry.pay.bottom, transferGeometry.status.bottom))
      : Infinity;
    const statusInsideCard = !!transferGeometry &&
      transferGeometry.status.bottom >= transferGeometry.card.bottom &&
      transferGeometry.status.top <= transferGeometry.card.top;
    check('T04-transfer-label-no-overlap-or-overflow', overlap === 0 && statusInsideCard, {
      overlap, statusInsideCard, geometry: transferGeometry,
    });
    const textGaps = transferGeometry
      ? Math.min(transferGeometry.name.top - transferGeometry.meta.bottom,
        transferGeometry.meta.top - transferGeometry.pay.bottom,
        transferGeometry.pay.top - transferGeometry.status.bottom)
      : -Infinity;
    check('T04-transfer-card-text-spacing', textGaps >= 8, { textGaps, geometry: transferGeometry });
    check('T02-total-unchanged-after-transfer', lAfter.some((l) => l.text === '在职 6 人｜月薪合计 ¥32,973'), {
      line: lAfter.find((l) => l.text.startsWith('在职')).text,
    });

    // 月结推进：调岗次月生效且工资只计一次
    await advanceMonths(page, G, u, 2);
    const sAfter = await readState(page);
    const song2 = sAfter.employees.find((e) => e.name === '宋刚');
    const l1 = sAfter.ledgers.find((l) => l.year === 1 && l.month === 1);
    const l2 = sAfter.ledgers.find((l) => l.year === 1 && l.month === 2);
    check(
      'T04-transfer-effective-next-month-no-double-pay',
      song2.deptId === csDept.deptId && song2.pending === null && song2.pendingFrom === null &&
        Math.abs(l1?.payroll ?? 0) === 32_973 && Math.abs(l2?.payroll ?? 0) === 32_973,
      { song: song2, months: [l1, l2], cash: sAfter.cash },
    );
    check(
      'T06-no-auto-layoff-during-months',
      sAfter.employees.every((e) => e.status === 'ACTIVE') &&
        sAfter.ledgers.every((l) => Math.abs(l.severance ?? 0) === 0),
      { statuses: sAfter.employees.map((e) => e.status), severance: sAfter.ledgers.map((l) => l.severance) },
    );
    await u.openTab(2);
    await u.shot('08-after-transfer-next-month');
    const lNext = await labels(page);
    const cardsNext = await readTalentCards(page);
    check(
      'T04-transferred-row-back-to-active',
      cardsNext.some((c) => c.labels[0] === '宋刚（客服）' && c.labels[3] === '在职') &&
        lNext.some((l) => l.text === '在职 6 人｜月薪合计 ¥32,973'),
      { cards: cardsNext.map((c) => c.labels[0]), line: lNext.find((l) => l.text.startsWith('在职')).text },
    );
    fs.writeFileSync(`${baseDir}/state-375-transfer.json`, JSON.stringify({ s0, sTransfer, sAfter }, null, 2));
    await ctx.close();
  }

  // ============================================================ B：375×812 裁员
  {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => pageErrors.push(`B:${e.message}`));
    await page.goto(url, { waitUntil: 'load', timeout: 60000 });
    const G = await geom(page);
    const u = mk(page, G, '375-layoff');
    await u.seed(staffedSeed);
    await u.openTab(2);
    const s0 = await readState(page);
    await openEmployeeDetail(page, G, '梁思远');
    await u.tapText('裁员', { wait: 1000 });
    const lPrev = await labels(page);
    await u.shot('09-layoff-preview');
    check(
      'T03-layoff-preview-complete',
      lPrev.some((l) => l.text.includes('员工：梁思远')) &&
        lPrev.some((l) => l.text.includes('月薪：¥7,645')) &&
        lPrev.some((l) => l.text.includes('补偿月数：1 个月')) &&
        lPrev.some((l) => l.text.includes('补偿金额：¥7,645（确认即支付）')) &&
        lPrev.some((l) => l.text.includes('当月主营产能：-')) &&
        lPrev.some((l) => l.text.includes('次年约节约工资：¥91,740')) &&
        lPrev.some((l) => l.text.includes('裁后现金：¥992,355')),
      { message: lPrev.find((l) => l.text.startsWith('员工：梁思远'))?.text },
    );
    await u.tapText('再想想（取消）', { wait: 900 });
    const sCancel = await readState(page);
    const liangCancel = sCancel.employees.find((e) => e.name === '梁思远');
    check(
      'T03-cancel-zero-change',
      sCancel.cash === s0.cash && liangCancel.status === 'ACTIVE' &&
        sCancel.executedCommandCount === s0.executedCommandCount &&
        sCancel.pendingEntries.filter((e) => e.category === 'SEVERANCE').length === 0,
      { cash: sCancel.cash, status: liangCancel.status, commands: sCancel.executedCommandCount },
    );
    await u.shot('10-layoff-cancelled');

    // 连点确认 → 只扣一次
    await openEmployeeDetail(page, G, '梁思远');
    await u.tapText('裁员', { wait: 1000 });
    const cBtn = (await labels(page)).find((l) => l.text === '确认支付补偿 ¥7,645');
    const cp = screenOf(G, cBtn.wx, cBtn.wy);
    await page.mouse.click(cp.x, cp.y);
    await page.mouse.click(cp.x, cp.y);
    await page.waitForTimeout(1500);
    const sLayoff = await readState(page);
    const liang = sLayoff.employees.find((e) => e.name === '梁思远');
    const sev = sLayoff.pendingEntries.filter((e) => e.category === 'SEVERANCE');
    check(
      'T03-double-tap-single-severance',
      sLayoff.cash === s0.cash - 7_645 && liang.status === 'PENDING_DISMISSAL' &&
        liang.dismissedAt === 1 && sev.length === 1 && sLayoff.executedCommandCount === s0.executedCommandCount + 1,
      { cash: sLayoff.cash, expected: s0.cash - 7_645, status: liang.status, severanceEntries: sev },
    );
    await u.shot('11-after-layoff');
    const cardsLayoff = await readTalentCards(page);
    check(
      'T03-pending-row-label',
      cardsLayoff.some((c) => c.labels[0].startsWith('梁思远（') && c.labels[3] === '次月离岗'),
      { cards: cardsLayoff.map((c) => c.labels[0]), states: cardsLayoff.map((c) => c.labels[3]) },
    );

    // 员工已变动：再次裁员被拒
    await openEmployeeDetail(page, G, '梁思远');
    await u.shot('12-pending-employee-detail');
    await u.tapText('裁员', { wait: 900 });
    const lToast = await labels(page);
    const sRepeat = await readState(page);
    check(
      'T05-changed-employee-rejected',
      lToast.some((l) => l.text === '该员工已进入离岗流程，不能重复裁员') &&
        sRepeat.cash === sLayoff.cash &&
        sRepeat.executedCommandCount === sLayoff.executedCommandCount,
      { toast: lToast.find((l) => l.text.includes('离岗流程'))?.text, cash: sRepeat.cash },
    );
    await u.shot('13-repeat-layoff-toast');

    // 次月停薪
    await advanceMonths(page, G, u, 2);
    const sAfter = await readState(page);
    const liang2 = sAfter.employees.find((e) => e.name === '梁思远');
    const l1 = sAfter.ledgers.find((l) => l.year === 1 && l.month === 1);
    const l2 = sAfter.ledgers.find((l) => l.year === 1 && l.month === 2);
    check(
      'T03-next-month-stops-salary',
      liang2.status === 'DISMISSED' && Math.abs(l1?.payroll ?? 0) === 32_973 && Math.abs(l2?.payroll ?? 0) === 25_328,
      { status: liang2.status, months: [l1, l2], expected: 25_328 },
    );
    check(
      'T06-still-no-auto-layoff',
      sAfter.employees.filter((e) => e.status !== 'ACTIVE' && e.name !== '梁思远').length === 0 &&
        sAfter.ledgers.filter((l) => l.month !== 1).every((l) => Math.abs(l.severance ?? 0) === 0) &&
        Math.abs(sAfter.ledgers.find((l) => l.month === 1)?.severance ?? 0) === 7_645,
      { statuses: sAfter.employees.map((e) => `${e.name}:${e.status}`), severance: sAfter.ledgers.map((l) => l.severance) },
    );
    await u.openTab(2);
    await u.shot('14-talent-after-dismissal');
    const lFinal = await labels(page);
    const cardsFinal = await readTalentCards(page);
    check(
      'T03-dismissed-not-listed',
      lFinal.some((l) => l.text === '在职 5 人｜月薪合计 ¥25,328'),
      { line: lFinal.find((l) => l.text.startsWith('在职')).text, cards: cardsFinal.map((c) => c.labels[0]) },
    );
    fs.writeFileSync(`${baseDir}/state-375-layoff.json`, JSON.stringify({ s0, sCancel, sLayoff, sRepeat, sAfter }, null, 2));
    await ctx.close();
  }

  // ============================================================ C：375×812 0/2/10/30 末项可达
  {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => pageErrors.push(`C:${e.message}`));
    await page.goto(url, { waitUntil: 'load', timeout: 60000 });
    const G = await geom(page);
    const u = mk(page, G, '375-size');
    const results = [];
    for (const n of [0, 2, 10, 30]) {
      await u.seed(sizedSeeds[n]);
      await u.openTab(2);
      const l = await labels(page);
      const expected = `在职 ${n} 人｜月薪合计 ${money(payrollOf(n))}`;
      const totalOk = l.some((x) => x.text === expected);
      let lastOk = n === 0;
      let visibleMax = 0;
      if (n > 0) {
        const last = `员工${String(n).padStart(3, '0')}（`;
        await ensureCardVisible(page, G, last);
        const cards = await readTalentCards(page);
        visibleMax = cards.length;
        lastOk = cards.some((c) => c.labels[0].startsWith(last));
      } else {
        lastOk = l.some((x) => x.text === '暂无在职员工');
      }
      results.push({ n, expected, totalOk, lastOk, visibleMax });
      const tag = String(n).padStart(3, '0');
      await u.shot(`15-size-${tag}`);
      check(`T01-size-${n}-totals`, totalOk, { expected, line: l.find((x) => x.text.startsWith('在职'))?.text });
      check(`T01-size-${n}-last-item-reachable`, lastOk, { n, visibleMax });
      if (n > 0) check(`T01-size-${n}-virtualized-pool`, visibleMax <= 12, { n, visibleMax });
    }
    fs.writeFileSync(`${baseDir}/state-sizes.json`, JSON.stringify(results, null, 2));
    await ctx.close();
  }

  // ============================================================ D：360×640 100 人复用不串员工
  {
    const ctx = await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => pageErrors.push(`D:${e.message}`));
    await page.goto(url, { waitUntil: 'load', timeout: 60000 });
    const G = await geom(page);
    const u = mk(page, G, '360-big');
    await u.seed(sizedSeeds[100]);
    await u.openTab(2);
    const l = await labels(page);
    await u.shot('16-100-top');
    check('T02-100-totals', l.some((x) => x.text === `在职 100 人｜月薪合计 ${money(payrollOf(100))}`), {
      line: l.find((x) => x.text.startsWith('在职'))?.text,
      expected: money(payrollOf(100)),
    });
    const cardsTop = await readTalentCards(page);
    check('T01-100-pool-not-all-rendered', cardsTop.length <= 12 && cardsTop.length >= 8, {
      visible: cardsTop.length,
      total: 100,
    });
    await ensureCardVisible(page, G, '员工100（');
    const cardsBottom = await readTalentCards(page);
    await u.shot('17-100-bottom');
    const pairOk = cardsBottom.every((c) => {
      const m = c.labels[0].match(/^员工(\d{3})（/);
      const no = m ? Number(m[1]) : NaN;
      const pay = c.labels[2].match(/月薪 ¥([\d,]+)/);
      const amount = pay ? Number(pay[1].replace(/,/g, '')) : NaN;
      return Number.isFinite(no) && amount === 4000 - no * 10;
    });
    const uniq = new Set(cardsBottom.map((c) => c.labels[0]));
    check(
      'T01-100-last-reachable-and-paired',
      cardsBottom.some((c) => c.labels[0].startsWith('员工100（')) && pairOk && uniq.size === cardsBottom.length,
      { visible: cardsBottom.map((c) => c.labels[0]), paired: pairOk, unique: uniq.size },
    );
    check('T01-100-pool-reused-not-mixed', cardsBottom.length <= 12 && cardsBottom.length >= 8, {
      visible: cardsBottom.length,
      total: 100,
    });
    // 末项详情：复用卡片后点击仍打开对应员工
    const lastCard = cardsBottom.find((c) => c.labels[0].startsWith('员工100（'));
    await clickCardDetail(page, G, lastCard.wy);
    const lDetail = await labels(page);
    await u.shot('18-100-last-detail');
    check(
      'T01-100-last-detail-correct-employee',
      lDetail.some((x) => x.text === '员工详情') &&
        lDetail.some((x) => x.text === '员工100') &&
        lDetail.some((x) => x.text.includes(`月薪 ${money(4000 - 100 * 10)}`)),
      { title: lDetail.filter((x) => x.text.startsWith('员工')) .map((x) => x.text) },
    );
    await closeAnyDialog(page, G);
    // 回到顶部仍是员工001
    await page.mouse.move(G.cx, G.cy);
    for (let i = 0; i < 40; i += 1) {
      await page.mouse.wheel(0, -600);
      await page.waitForTimeout(80);
    }
    await page.waitForTimeout(500);
    const cardsBack = await readTalentCards(page);
    check('T01-100-back-to-top', cardsBack.some((c) => c.labels[0].startsWith('员工001（')), {
      visible: cardsBack.map((c) => c.labels[0]),
    });
    fs.writeFileSync(`${baseDir}/state-360-100.json`, JSON.stringify({ top: cardsTop, bottom: cardsBottom, back: cardsBack }, null, 2));
    await ctx.close();
  }

  // ============================================================ E：390×844 第三尺寸 + 30 人
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => pageErrors.push(`E:${e.message}`));
    await page.goto(url, { waitUntil: 'load', timeout: 60000 });
    const G = await geom(page);
    const u = mk(page, G, '390');
    await u.seed(sizedSeeds[30]);
    await u.openTab(2);
    await u.shot('19-390-top');
    await ensureCardVisible(page, G, '员工030（');
    await u.shot('20-390-bottom');
    const cards = await readTalentCards(page);
    const l = await labels(page);
    check(
      'E-third-viewport-talent-stable',
      l.some((x) => x.text === `在职 30 人｜月薪合计 ${money(payrollOf(30))}`) &&
        cards.some((c) => c.labels[0].startsWith('员工030（')),
      { line: l.find((x) => x.text.startsWith('在职'))?.text, cards: cards.map((c) => c.labels[0]) },
    );
    fs.writeFileSync(`${baseDir}/state-390.json`, JSON.stringify({ cards }, null, 2));
    await ctx.close();
  }

  // ============================================================ F：过期 token / 余额不足
  {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => pageErrors.push(`F:${e.message}`));
    await page.goto(url, { waitUntil: 'load', timeout: 60000 });
    const G = await geom(page);
    const u = mk(page, G, '375-guard');
    await u.seed(staffedSeed);
    await u.openTab(2);
    const s0 = await readState(page);
    await openEmployeeDetail(page, G, '梁思远');
    await u.tapText('裁员', { wait: 1000 });
    const cBtn = (await labels(page)).find((l) => l.text === '确认支付补偿 ¥7,645');
    await u.shot('21-expired-open');
    await page.waitForTimeout(62_000);
    await page.mouse.click(screenOf(G, cBtn.wx, cBtn.wy).x, screenOf(G, cBtn.wx, cBtn.wy).y);
    await page.waitForTimeout(700);
    const lExpired = await labels(page);
    const sExpired = await readState(page);
    const liang = sExpired.employees.find((e) => e.name === '梁思远');
    await u.shot('22-expired-rejected');
    check(
      'T05-expired-token-rejected',
      lExpired.some((l) => l.text === '确认已失效，请重新查看费用后确认。') &&
        sExpired.cash === s0.cash && liang.status === 'ACTIVE' &&
        sExpired.executedCommandCount === s0.executedCommandCount,
      { toast: lExpired.find((l) => l.text.includes('失效'))?.text, cash: sExpired.cash },
    );

    // 余额不足：确认按钮置灰且点击无效果
    await u.seed(poorSeed);
    await u.openTab(2);
    const sp = await readState(page);
    await openEmployeeDetail(page, G, '梁思远');
    await u.tapText('裁员', { wait: 1000 });
    const lPoor = await labels(page);
    await u.shot('23-insufficient-cash');
    const poorBtn = lPoor.find((l) => l.text === '确认支付补偿 ¥7,645');
    check(
      'T05-insufficient-cash-blocks-confirm',
      lPoor.some((l) => l.text.includes('现金不足以支付补偿，请先回笼资金。')) &&
        lPoor.some((l) => l.text.includes('裁后现金：-¥4,645')),
      { message: lPoor.find((l) => l.text.startsWith('员工：梁思远'))?.text },
    );
    await page.mouse.click(screenOf(G, poorBtn.wx, poorBtn.wy).x, screenOf(G, poorBtn.wx, poorBtn.wy).y);
    await page.waitForTimeout(900);
    const sPoorAfter = await readState(page);
    const liangPoor = sPoorAfter.employees.find((e) => e.name === '梁思远');
    await u.shot('24-insufficient-click-no-effect');
    check(
      'T05-insufficient-click-no-change',
      sPoorAfter.cash === sp.cash && liangPoor.status === 'ACTIVE' &&
        sPoorAfter.executedCommandCount === sp.executedCommandCount,
      { cash: sPoorAfter.cash, status: liangPoor.status },
    );
    fs.writeFileSync(`${baseDir}/state-guards.json`, JSON.stringify({ s0, sExpired, sp, sPoorAfter }, null, 2));
    await ctx.close();
  }

  report.screenshots = shots;
  report.errors = pageErrors;
  const failed = report.checks.filter((c) => !c.pass);
  report.ok = failed.length === 0 && pageErrors.length === 0;
  fs.writeFileSync(`${baseDir}/r30-report.json`, JSON.stringify(report, null, 2));
  await browser.close();
  console.log(JSON.stringify({ ok: report.ok, checks: report.checks.length, failed, errors: pageErrors, shots: shots.length }, null, 2));
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
