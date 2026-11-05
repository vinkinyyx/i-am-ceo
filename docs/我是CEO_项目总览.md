# 《我是CEO》项目总览（需求 · 设计 · 执行进展）

> **本文档是项目唯一权威文档。** 2026-11-01 由原 `docs/00–13`、`docs/README.md`、`docs/原始需求_V0.9_归档参考.md`、`docs/CEO_Test_Release_v1_1/*`、`docs/研发过程记录/*`、根目录 `EXECUTION_STATUS.md` 合并而来，上述文件已删除。
>
> - 项目：《我是CEO》第一阶段 MVP｜目标平台：**TapTap 普通小游戏**（非 H5、非 APK）
> - 引擎：Cocos Creator 3.8.8 + TypeScript｜分辨率：竖屏 375×812（FIXED_WIDTH）
> - 基线版本：`economy-v1.0.0` / `golden-cases-v1.0.0` / 存档 `schemaVersion=1`
> - 维护规则：新增需求/设计变更直接写入本文档对应章节，并更新 §12 决策台账与 §11 进展；不再新建编号文档。
> - 文档优先级：本文档 §1 产品边界 → §12 决策台账（LOCKED 项）→ 各专项章节 → 历史资料。
> - 语言：需求、交接、缺陷与验收用中文；代码标识符、类型与测试名用英文。项目名称只能写 **《我是CEO》**，不得写成《我的CEO》。

---

## 0. 快速索引

| 想了解 | 看哪节 |
|---|---|
| 产品范围、做什么/不做什么 | §1 |
| 代码怎么分层、命令怎么走 | §2 |
| 存档格式、断电恢复、重开 | §3 |
| 月结公式、离线、风控 | §4 |
| 三行业数值、部门效果、排行榜 | §5 |
| CEO/员工/招聘/裁员 | §6 |
| 部门与自动经营 | §7 |
| 页面、交互、新手引导 | §8 |
| TapTap 适配、打包、上架 | §9 |
| 测试策略与黄金用例 | §10 |
| **当前做到哪一步、还有什么没做** | **§11** |
| 已锁定的决策编号 | §12 |
| 目录与资产现状 | §13 |
| **2026-11-02 发布差距、复测证据、详细整改设计与排期** | **§14** |
| **交给其他 Agent：48 项整改任务、依赖、实现契约、验收与状态** | **§15** |
| **可直接复制的连续执行/单任务提示词** | **§16** |
| **需要用户提供的账号信息、设备证据、素材与发行资料** | **§17** |

---

## 1. 产品定义与范围

### 1.1 产品画像

竖屏 2D、以手指点击为主的轻策略公司经营模拟。单局从零创建一家企业，经营**一个初始主营业务**，比较招聘人才，设置支持部门，靠自动经营与年度结算争取连续 3 年净利润为正，并提升总资产与经营年限排名。可挂机、可加速、亏损不立即破产、可主动关闭公司重新开始。

体验目标：1 分钟理解页面；首次创建 + 首聘尽量少于约 2 分钟；短时上线做决策，离线也能获得安全可追溯的进度。

### 1.2 P0 / P1 需求清单

| ID | 级别 | 要求 | 判断依据 / 边界 |
|---|---|---|---|
| R-001 | P0 | 公司名称：3 个趣味随机候选、免费刷新、可自定义 | 内容过滤，禁止空白/超长；可预览 |
| R-002 | P0 | CEO 姓名随机/自定义、性格 3 选 1、商业/管理/财务能力成长 | 初始总 150 点，不做技能树 |
| R-003 | P0 | 贸易 / 软件 / 企业服务三选一；经营期不可换主业 | 统一公式，不增加第二业务 |
| R-004 | P0 | 起始现金 30 万元，首聘 2 人之后才启动时钟 | 首聘逐个选择，允许中途保存 |
| R-005 | P0 | 招聘 3 候选对比：能力、潜力、协作、性格、月薪、一次性招聘费 | 可手动选择，运营期可自动招人 |
| R-006 | P0 | 员工每年成长；裁员按工资与任职期限赔偿 | 裁员须二次确认，系统不得自动裁员 |
| R-007 | P0 | 主营业务部 + HR / 采购 / 市场 / 客服 / 财务 5 类支持部门 | 0 员工部门无收益，创建有费用 |
| R-008 | P0 | 自动经营 + 可手动干预；人员配置支持锁定 | 默认稳健策略，受预算与现金安全线约束 |
| R-009 | P0 | 每经营周期 1 游戏年，内部 12 个月；1×/2×/5× 与暂停 | 非帧率计算，切后台自动存档 |
| R-010 | P0 | 离线可挂机：8 小时折算 1 年，单次最多 3 年 | 不重复结算，资金风险时停止扩张 |
| R-011 | P0 | 年报与历史可查：收入、直接成本、运营费、工资、招聘/裁员、利润、现金、资产 | 资金流、利润、资产三项守恒 |
| R-012 | P0 | 亏损可继续经营；现金危机可恢复 | 无自动清档、无即时破产 |
| R-013 | P0 | 排行榜：保留总资产/经营年限本地模拟榜；用户2026-11-04确认增加真实玩家榜 | 有限异步榜单专项按§21设计，不扩展实时多人；实际接入待开发/平台验收 |
| R-014 | P0 | 设置 → 关闭公司 → 二次确认 → 本轮全部重置 | TapTap 账号与合规记录不在删档范围 |
| R-015 | P0 | 首次进入有逐步可点击指引；可跳过、回看、断点恢复 | 教程期间时钟暂停，必需的公司/首聘仍要完成 |
| R-016 | P0 | TapTap 普通小游戏可上传 ZIP 并在真机运行 | 备案/认证/提审属外部前置条件 |
| R-017 | P0 | 2D 竖屏、卡片式触摸 UI、不做复杂动画 | 四主 Tab：公司、部门、人才、排行 |
| R-018 | P0 | 连续 3 个年度净利润 > 0 达成目标后仍可继续经营 | 不是最终结局，也不强制重开 |
| R-019 | P1 | 经营诊断：提示当前限制收入的因素 | 只展示可解释原因，不做 AI 对话 |
| R-020 | P1 | 5 类轻度随机事件，每年最多 1 个 | 不做难以恢复的多级事件链 |

### 1.3 明确不做（禁止自行扩展）

跨行业、新增业务线、子公司、母集团、共享服务中心、股权/上市、并购、贷款与利息、真实竞争公司 AI、真实在线排行、内购、多人联机、云存档、复杂生产/库存/税收、员工关系树、技能天赋树、3D 办公室、NPC 步行动画、强制任务关卡、对话式大模型接口、外部动态下发经营参数。广告原为DEFERRED，用户2026-11-03明确调整为§18的有限自愿激励视频专项；其余商业化仍不在范围内，旧无广告版本的历史记录保留。

允许为未来扩展预留接口，**不允许实际开发第二阶段玩法**。

2026-11-04用户专项变更：云存档用于玩家自己的备份和跨设备恢复，不做运营后台查询；新增真实玩家榜并保留本地模拟榜。该有限范围依§21设计/实施契约，不再按上段旧延期条款一律排除；不扩展多人、全量运营数据库或内购。

### 1.4 关键术语

- **经营年度**：玩家观察财务与排名的完整周期，内部由 12 个离散月份累加。
- **收入口径**：对外订单在模拟中完成后确认的营业收入，MVP 假设当月全部收现，不做应收账款。
- **利润**：收入扣除当期损益项；不含创业资本注入，资本性扩张投资不直接全额扣利润。
- **现金**：可支付经营费用的余额；不等同于利润。
- **总资产**：现金 + 未折旧业务资产；MVP 无负债模型，不代表企业市值。
- **成本中心**：HR、采购、市场、客服、财务；部门费用必须在财务中单列。
- **手动锁定**：玩家锁定某部门目标人数，自动经营不得擅自增删该部门人员。
- **重开**：永久结束当前本地经营 run，产生新 runId；平台身份不变。

### 1.5 游戏不变量（测试必覆盖）

1. 同一 `(runId, year, month)` 只能结算一次。
2. 同一 `commandId` 的招聘/裁员/建部门/追加资本最多产生一次费用或收益。
3. 本局启动资本仅注资一次；重开是新的 run，每轮一次。
4. 年度利润 = 年收入 − 全部当期损益费用；期末现金 − 期初现金 = 净经营收付 − 资本支出 + 资本注入。
5. 工资只计实际在岗月份；招聘/裁员默认**次月生效**，费用在确认时立即支付并在当年记账。
6. 现金与未折旧资产不得为负；全部金额以整数元存储，仅展示层格式化。
7. 采购/客服/财务的节约从真实对应成本扣除，不虚构收入；每种成本下限为 0。
8. 玩家锁定的人数和年度支出上限不被自动决策修改；**不自动裁员**。
9. 离线结算不得自动执行重大投资、关闭公司、裁员或领取一次性救助金。
10. 关闭公司后，旧 runId 的任务与旧存档回调无权覆盖新档。
11. 存档不可恢复、认证失败、平台接口不可用时，必须给出明确恢复/重试/本地游玩策略，禁止静默清空存档。
12. 所有经营建议可由同一套计算规则推导，不得伪造“预计提升”。

### 1.6 从 V0.9 纠正的实现歧义（历史结论，已生效）

- 候选展示**月薪**，第 1 年入职（时钟启动前）仍计 12 个月工资。
- 保留“总资产含业务资产、投资从次年折旧”，但**不实现贷款/债务**；困境时冻结新支出而不是负现金。
- 单次离线最多 24 小时等效，超出部分当次丢弃；暂停状态不累计离线。
- 年报需区分“当年已审定”与“进行中预估”。
- 前 5 年只是可选指导，不是保底收益曲线；标准首年样例仅用于可复现校验。
- 存档按年保留摘要、月账只留最近 24 个月，不能无限保存每人每月流水。

---

## 2. 技术架构

### 2.1 技术选型

- Cocos Creator **3.8.8** + TypeScript，2D UI（Canvas / Label / Button / ScrollView / Layout / Sprite / EditBox），不做 3D 与物理。
- 核心经营计算为**纯 TypeScript**，不依赖 Cocos / DOM / 平台 SDK，可在 Node 下跑单测与万级模拟。
- 平台层通过 `ITapPlatform` 抽象；编辑器 Mock 与 TapTap 生产实现严格分离，生产入口不 import Mock。
- 存档全部本地（双槽）；外部服务仅承担 TapTap 登录 code 交换，不保存经营数据。
- 配置为本地 JSON（`assets/resources/config/`），带版本号，不由远端动态下发。

### 2.2 分层与数据流

```text
UI（Cocos 组件 / AppView）
  → GameFacade（命令层：commandId 幂等 + expectedRunId 校验）
    → 规则校验 / 领域服务（application/*Service）
      → 纯模拟（simulation/*：月结、年结、离线、事件、排行、RNG）
        → GameState 不可变快照 → Selectors → ViewModel → UI
  → SaveRepository（双槽 + CRC32 + 活动指针）→ ITapPlatform（tap.setStorage）
```

**禁止**：UI 手写利润计算、直接增删现金、绕过命令层创建员工；任何状态变更都必须经命令 + 领域函数 + 持久化提交。

### 2.3 实际工程目录（当前仓库）

```text
我是CEO/
  assets/
    scenes/Game.scene              唯一启动场景（Canvas + Camera + Bootstrap）
    scripts/
      Bootstrap.ts                 启动装配
      ui/AppView.ts                全部页面与弹窗（代码驱动 UI）
      ui/UiFactory.ts              卡片/按钮/文本等复用工厂
      audio/AudioManager.ts        BGM/SFX/JNG，三开关
      platform/                    CocosPlatform / TapPlatform / PlatformFactory / loadConfig
    core/                          ✅ 纯 TS，Node 可直接测试
      domain/      types, errors, result, command, money, companyNames, peopleNames,
                   validation, NameGenerator, CandidateGenerator, gameStateFactory, ids, rng
      simulation/  rng, RandomStreams, market, capacity, monthly, advanceMonth, annual,
                   annualEvent, offline, leaderboard, GameClock, departments
      persistence/ SaveTypes, SaveCodec, SaveMigration, SaveRepository, crc32, canonical,
                   stateIntegrity, statePrune
      platform/    ITapPlatform, TapPlatform — 见实际目录；MemoryStorage/EditorMockPlatform仅位于tests/helpers
      application/ GameFacade, GameStore, MutationContext, CompanyService, RecruitmentService,
                   OfferService, LayoffService, DepartmentService, TransferService,
                   InvestmentService, AutoHireService, RiskService, ResetService
      config/      EconomyConfig, configLoader
    resources/
      config/      economy.v1.json, golden-cases.v1.json, runtime.config(.example).json,
                   audio/{audio_manifest,audio_event_map,audio_settings,audio_asset_manifest}.json
      audio/       bgm(2) + jingles(3) + sfx(11) 共 16 个 MP3（运行时资源）
      ui/          avatars(24) / components(7) / departments(6) / industries(3) /
                   navigation(10) / status(12) / time(5) 共 67 张 PNG
  tests/            23 个 Vitest 文件（单元 / 集成 / 黄金 / 模拟 / 卫生）
  tools/            构建、静态服务、无头截图、包体校验、5 年模拟等脚本
  server/           最小 code2Session 服务（auth-server.mjs + selftest.mjs）
  design/           UI 设计交付包 + 音频设计包（参考用，不入运行时）
  audio/            音频生产包（配置 + WAV 母版历史 → 见 §13）
  evidence/         各里程碑构建/截图/日志证据
  build/            Cocos 构建产物（gitignore，保留 TapBuild/game.zip）
  docs/             本文档 + 配置基线 + 隐私政策
```

### 2.4 命令契约与错误码

```ts
type CommandBase = {
  commandId: string;        // 一次点击唯一；重试复用
  expectedRunId: string;    // 旧 run 的命令一律拒绝
  expectedRevision?: number;
};
type CommandResult<T> =
  | { ok: true; revision: number; runId: string; payload: T }
  | { ok: false; code: GameErrorCode; displayMessage: string; details?: Record<string, unknown> };
```

错误码：`NOT_READY`、`RUN_CHANGED`、`REVISION_CONFLICT`、`INVALID_NAME`、`INVALID_INDUSTRY`、`ONBOARDING_INCOMPLETE`、`OFFER_EXPIRED`、`INSUFFICIENT_CASH`、`DEPT_ALREADY_EXISTS`、`DEPT_NOT_FOUND`、`EMPLOYEE_NOT_FOUND`、`EMPLOYEE_NOT_DISMISSIBLE`、`CONFIRMATION_EXPIRED`、`AUTOMATION_LOCKED`、`MONTH_ALREADY_SETTLED`、`SAVE_FAILED`、`SAVE_CORRUPT`、`RESET_IN_PROGRESS`、`PLATFORM_UNAVAILABLE`、`AUTH_REQUIRED`。每个错误有固定中文文案；日志只记错误码与 runId，不记玩家敏感信息。

错误到界面文案（必须一致）：

- `INSUFFICIENT_CASH` → “当前现金不足，还需要 ¥{gap}。”
- `OFFER_EXPIRED` → “候选人信息已经更新，请重新选择。”
- `MONTH_ALREADY_SETTLED` → 幂等返回旧结果，UI 不提示“第二次领取”。
- `RESET_IN_PROGRESS` → “正在关闭旧公司，暂不能执行其他操作。”
- `SAVE_FAILED` → “保存失败，本次操作未确认保存，请重试。”
- `RUN_CHANGED` → “公司已重新创建，旧操作已取消。”
- `CONFIRMATION_EXPIRED` → “确认已失效，请重新查看费用后确认。”

### 2.5 状态变更时序

1. UI 点击生成唯一 `commandId` → GameFacade 校验（runId、阶段、资金、参数）。
2. 领域函数生成候选新快照与财务分录，校验不变量。
3. SaveRepository 先写非活动槽并回读校验 → 再写活动指针 → 成功后才更新内存态。
4. 持久化失败则回滚到上一个提交快照，禁止显示“已录用但重启消失”。
5. 广播 `GameStateChanged` → Selector 派生 VM → 刷新相关卡片。

### 2.6 质量与构建门禁

- 严格 TS（`strict` + `noUncheckedIndexedAccess`），禁止 `any` 渗透领域层。
- 提交前必须 `npm run typecheck`、`npm run lint`、`npx vitest run` 全绿。
- 提交信息风格：`feat(M1): ...` / `fix: ...` / `docs: ...`。
- 每个里程碑要求：编辑器可进入 + 核心状态可视化 + 可截图/录屏，不能只有 Node 控制台。

---

## 3. 数据模型与存档

### 3.1 顶层类型

```ts
type IndustryId = 'TRADE'|'SOFTWARE'|'SERVICE';
type DeptType   = 'BUSINESS'|'HR'|'PROCUREMENT'|'MARKETING'|'CUSTOMER_SERVICE'|'FINANCE';
type Policy     = 'STEADY'|'GROWTH'|'PROFIT';
type CashRisk   = 'NORMAL'|'WARNING'|'DISTRESS';
type GamePhase  = 'CREATING'|'HIRING_INITIAL'|'TUTORIAL_DASHBOARD'|'RUNNING'|'DISTRESS'|'RESETTING';

interface SaveEnvelope {
  schemaVersion: 1; gameVersion: string; configVersion: string;
  checksum: string;            // 除 checksum 外规范化 JSON 的 CRC32（8 位小写十六进制）
  revision: number; runId: string; resetGeneration: number;
  payload: GameState;
}

interface GameState {
  phase: GamePhase; runId: string; seed: number; rngCounter: number;
  initializedCapital: boolean;
  gameYear: number;               // 创业 = 1
  gameMonth: number;              // 1..12，下一个待结算月
  progressMsInMonth: number;
  speed: 0|1|2|5;
  lastWallClockMs: number;
  lastSettledMonthKey: string|null;   // runId:year:month
  offlineRemainderMs: number;
  onboarding: OnboardingState;
  company: Company|null; ceo: CEO|null;
  employees: Employee[]; departments: Department[]; offers: CandidateOffer[];
  policy: Policy;
  monthlyLedgersRolling: MonthlyLedger[];   // 仅最近 24 个月
  annualReports: AnnualReport[];            // 最多 100 年，之后压缩摘要
  pendingEntries: JournalEntry[];           // 已支付但归属某月的分录
  eventHistory: EventRecord[];
  botCompanies: BotCompany[];
  consecutiveProfitableYears: number;
  target3YearsAchieved: boolean;
  rescueCapitalUsed: boolean;
  executedCommandIds: string[];             // 滚动最近 N 条
}
```

金额一律 `MoneyYuan = number`（整数元，`Number.isSafeInteger` 校验）；比率用整数基点 `bps`（10000 = 100%）；时间归属只由 `gameYear/gameMonth` 决定，不依赖手机本地日期。浮点只在临时计算中出现，入账前统一取整。

### 3.2 实体字段字典（要点）

| 实体 | 关键字段 | 约束 |
|---|---|---|
| Company | `companyId,name,industry,foundedYear` | 名称 ≤ 20 中文字形，过滤空白/控制符/敏感词 |
| Company | `cashYuan` | 整数 ≥ 0，支出不得越界 |
| Company | `initialCapitalYuan=300000` / `paidInCapitalYuan` | 首轮注资一次；救助追加资本计入实收资本，不算收入 |
| Company | `businessAssetBookYuan` / `businessCapacityBonusBps` | 未折旧账面值；扩张产能上限 +30% |
| Company | `marketDemandIndexBps` | 需求累乘，含合理上限 |
| CEO | `name,trait` | 进取 / 稳健 / 亲和 |
| CEO | `businessSkill,managementSkill,financeSkill` | 初始 50/50/50，年结成长，上限 100 |
| Employee | `employeeId,name,departmentId` | 唯一；同时只属于一个部门 |
| Employee | `skill,potential,teamwork` | 0–100 |
| Employee | `salaryMonthlyYuan` | 4000–8000；MVP 不自动调薪 |
| Employee | `hiredAtMonthIndex / effectiveFromMonthIndex` | 运营期入职次月生效；首聘首月生效 |
| Employee | `status` | `ACTIVE → PENDING_DISMISSAL → DISMISSED` |
| Department | `deptId,type,enabled,staffingMode,targetCount` | 每种类型唯一；主营部固定存在 |
| Department | `createdMonthIndex,setupPaid` | 防重复建部/重复扣费 |
| CandidateOffer | `offerId,deptId,generatedForIndex,expiresAtMonthIndex,candidates[3]` | 刷新后旧 Offer 全部失效 |
| JournalEntry | `entryId,monthKey,category,amountYuan,isCash` | 唯一键；区分现金口径与损益口径 |
| MonthlyLedger | `runId,year,month` | 唯一；`revenueYuan/costs/profitYuan/cashDeltaYuan` |
| AnnualReport | `year,revenueYuan,profitYuan,cashOpenYuan,cashCloseYuan,assetCloseYuan` | 12 个月合计，生成后不可改 |
| EventRecord | `eventId,type,effectYuan,month` | 每年最多 1 条 |
| BotCompany | `botId,name,assetsYuan,yearsOperated` | 本地虚拟企业，不接线上 |
| Onboarding | `completedSteps,skipped,lastKnownStep,tutorialVersion` | 断点恢复，重开重置 |

### 3.3 引用完整性

- 每位 `ACTIVE` 员工必须指向存在且启用的部门；主营部在创建后自动存在。
- 不支持删除部门；可把人数降为 0 并关闭自动招聘。
- `BUSINESS` 创建后默认 `staffingMode=AUTO`，但首聘 2 人完成前时钟暂停，自动招聘不触发。
- 进入 `RUNNING` 必须满足：公司非空、CEO 非空、首聘 2 人、主营部存在。
- `monthKey` 含 runId；所有跨 run 的缓存回调一律丢弃。
- 装载时校验业务级完整性（`stateIntegrity.ts`），违规存档拒绝恢复并回退另一槽（B14）。

### 3.4 双槽持久化

平台约束：`tap.setStorage` 单 key 最多 1MB、总 10MB；启用加密时单 key 约 0.7MB。故每槽目标 **< 500KB**，只保留最近 24 个月完整账本。

键：`ceo/save/a`、`ceo/save/b`、`ceo/save/active`、`ceo/reset/tombstone`。

```text
commit(nextState):
  1. validate(nextState) 且 expectedRunId == currentRunId
  2. 生成 SaveEnvelope(revision+1, checksum)
  3. 写非活动槽 → 等待 → 回读校验 checksum
  4. 写活动指针 {slot, revision, runId, resetGeneration} → 等待
  5. 全部成功后才更新内存态并 resolve
```

校验和：对除 `checksum` 外字段做**对象 key 字典序**规范化 JSON，按 UTF-8 字节计算 CRC32。仅用于发现损坏，**不是防作弊签名**。

启动恢复：优先活动指针槽；指针损坏则枚举双槽，找“未被墓碑禁止且校验通过”的最高 `revision`。所有异常都要给出 `SAVE_CORRUPT` 提示与重试入口，禁止无提示覆盖。

### 3.5 关闭公司事务

```text
设置 → 关闭公司 → 预览将失去的数据 → 二次确认（token 有效期 60s）
Service:
  acquire GameMutationLock
  暂停时钟、作废挂起定时器与自动动作
  校验 expectedRunId / confirmationToken
  写 reset tombstone {oldRunId, newResetGeneration, resetAt} 并等待
  清空内存旧 run 与非活动槽引用
  写全新 CREATING 状态（新 runId、新 seed、水位 0、30 万未发放）
  提交并替换活动指针 → 清理旧槽 → 广播 ResetCompleted
```

- 重置失败时 UI 不得显示成功；墓碑存在时重启必须继续清理，**不能加载旧 run**。
- 跨 run 迟到的 `save()` / `settleOffline()` / `hireEmployee()` 在比对 `expectedRunId` 与 `resetGeneration` 后丢弃。
- 关闭公司**不注销 TapTap 账号**，不删除依法必须保留的认证/运营记录。

### 3.6 中途创建与首聘落盘

`CREATING`（收集公司/CEO）→ `HIRING_INITIAL`（0/1/2 人）→ `TUTORIAL_DASHBOARD`（认识现金/利润/速度）→ `RUNNING`。

公司创建即写存档并一次性注入 30 万；两次首聘通过各自命令立即扣招聘费；正式开始经营前时钟暂停。异常退出后继续招聘剩余人数，不重复注资、不重刷已录用候选（B11）。

### 3.7 留存、裁剪与迁移

- 月账只留最近 24 个月；年报最多 100 年，超限把更早年份压缩为 10 年汇总摘要（`statePrune.ts`，B15：120 年存档 < 500KB）。
- 离职人员只留最近 20 条摘要；候选列表只保留当前轮次；长列表虚拟化。
- `schemaVersion` 变更必须实现单向 `migrate(vN→vN+1)`，迁移前校验来源、迁移后校验目标，失败不破坏原档。
- 若未来增加云档：以 `runId/resetGeneration` 决定优先级，新 run 永远不被旧云档覆盖。

### 3.8 作弊边界

单机小游戏允许改时钟/改档，MVP 无服务器反作弊；但必须保证：时钟大幅回拨不产生负离线时长、不产生无限结算；完整性校验是防损坏，不是防外挂；虚拟排行榜不声明公平竞技。

---

## 4. 时间与财务引擎

### 4.1 时间语义

- `gameYear=1, gameMonth=1` 为本轮第 1 年第 1 个待结算月；年份标签固定“创业第 N 年”，不绑真实年份。
- 在线：1 年 = 300,000ms，1 月 = 25,000ms；2×/5× 只缩短真实耗时，不改变结算量。
- 暂停 `speed=0`：在线不累积、离线不结算。
- 离线：每完整 40 分钟 = 1 个游戏月；8 小时 = 12 个月；单次最多 36 个月；不受离开前倍速影响。
- 离线不足 40 分钟的余量记入 `offlineRemainderMs`（24h 封顶后余量清零）；回前台先结算、提交存档，再恢复在线时钟。
- 时间回拨（now < lastWallClockMs）：0 结算，更新水位，提示设备时间异常。

### 4.2 月结顺序（不得调换）

```text
advanceMonth(state, config):
  assert RUNNING/DISTRESS 且 monthKey 未结算
  1. 读取月初已生效员工/部门、策略、现金安全阈值
  2. 依年度市场趋势与当年事件生成本月需求参数
  3. 执行预算内自动招聘（本月付费，下月上岗）
  4. 计算主营交付能力与潜在订单 → 本月营业收入
  5. 计算直接成本 / 其他运营费 / 售后费 / 固定费用
  6. 计算采购 / 客服 / 财务净节约与市场需求增益（同种节约只扣一次）
  7. 计算在岗工资、一次性支出、事件损益
  8. 计算利润、现金净流入、业务资产折旧
  9. 应用已确认的资本性投入/已支付事件项（不重复计款）
 10. 生成唯一 MonthlyLedger，更新期末现金、资产、风险
 11. 若为 12 月：年结报告 + 员工/CEO 年度成长 + 排行榜推进
 12. lastSettledMonthKey 前移、月份 +1、保存快照
```

风险处理：拟支付刚性费用超过可用现金时不得负现金；进入 `DISTRESS`，冻结该月推进，不生成伪利润账。被冻结的月不写 Ledger，防止重试重复冲销。

### 4.3 收入与产能公式

```text
行业潜在年订单 D_y = D_1 × 年度需求指数（含自然增长与事件）
当月基础订单 D_m  = distribute(D_y, 12, month)
获客系数 Acq = clamp(10000 + CEO商业增益 + 市场部增益, 8500, 13500)
可获客订单 A_m = round(D_m × Acq / 10000)
主营产能 C_m = Σ(行业单人年产能/12 × (7000 + skill×50)/10000)
              × 协作系数 × CEO管理系数 × 业务资产系数 × HR产能系数
本月收入 Revenue_m = round(min(A_m, C_m) × completionRateBps / 10000)
```

- 协作系数 `clamp(10000 + (业务员工平均 teamwork − 50) × 20, 9000, 11000)`
- CEO 管理系数 `clamp(10000 + (management − 50) × 20, 9000, 11000)`
- CEO 商业增益 `clamp((business − 50) × 15, −750, 750)`
- 业务资产系数 `10000 + min(3000, floor(投资额/10000) × 150)`（每万元 +1.5%，上限 +30%）
- `completionRateBps` 默认 10000，事件时可降，不得超过 10000

> 基准产能 80 万不是必得营业额：贸易首年需求 72 万、2 名标准员工产能 80 万，因此实际收入 72 万。

### 4.4 费用拆分与“只节省一次”

```text
baseDirect     = round(R × directCostBps / 10000)
baseOtherOps   = round(R × otherOpBps / 10000)
baseAfterSales = round(R × afterSalesBps / 10000)
baseFixed      = distribute(fixedCostAnnualYuan, 12, month)

procurementEligible = round(baseDirect × procurementEligibleBps / 10000)
procurementSaving   = min(procurementEligible, round(procurementEligible × procurementSavingRateBps / 10000))
customerSaving      = min(baseAfterSales, round(baseAfterSales × customerSavingRateBps / 10000))
financeEligible     = baseFixed + baseOtherOps        // 不含工资、直接成本、售后
financeSaving       = min(financeEligible, round(financeEligible × financeSavingRateBps / 10000))
financeFixedAllocated    = min(baseFixed, financeSaving)
financeOtherOpsAllocated = financeSaving − financeFixedAllocated

directPaid    = baseDirect − procurementSaving
operatingPaid = baseOtherOps − financeOtherOpsAllocated + baseAfterSales − customerSaving
fixedPaid     = baseFixed − financeFixedAllocated
payrollPaid   = Σ(当月生效员工月薪)

profit    = R − directPaid − operatingPaid − fixedPaid − payrollPaid
            − hireExpense − severanceExpense − deptSetupExpense − eventExpense − depreciation
cashDelta = R − directPaid − operatingPaid − fixedPaid − payrollPaid
            − hireCash − severanceCash − deptSetupCash − eventCash − capexCash + capitalInjectionCash
```

- 市场部效果体现在 `A_m`，**不得**再追加一笔“市场销售利润奖励”。
- HR 效果体现在“尚未支付的招聘费折扣”与主营产能加成（1 人 +6%，上限 +12%）；只有订单充足才转化为收入。
- 一次性费用（招聘/裁员/设部/投资）在点击时已实际扣现金，必须用 `pendingEntries` 记账并在后续月结聚合，**月结不得再扣一次**。
- 两个必须区分的量：`ledger.cashDeltaYuan`（归属该月的全部现金变化，供年报勾稽）与 `unpaidCashDeltaYuan`（本次月结仍需写入 `company.cashYuan` 的增量，不含 `alreadyPaid` 项）。

### 4.5 取整与对账

- 基点乘除统一 `roundHalfUpNonNegative`；负数先取绝对值再还原符号。
- 比例费用用“YTD 累计残差法”，固定费按 12 月分摊并在末月补差，确保年额精确。
- 断言：`annualRevenue == Σ月收入`、`annualProfit == Σ月利润`、`endCash == 年初期初 + Σ月 cashDelta`、`endAssets == endCash + endBusinessAssetBook`。

### 4.6 业务扩张（单按钮）

- 主营卡“扩大产能”，按 **1 万元为步长**，不得超过现金安全额度。
- 确认后现金即时减少、`businessAssetBook` 与产能投资增加，总资产即时不变，**当期利润不因该资本支出下降**。
- 从下一年开始对本年新增资产按年 10% 折旧（按月累加）。
- 需求不足时 UI 必须提示“新增产能可能闲置”；困难期禁止扩张；绝不自动投资。

### 4.7 年度市场趋势与事件

- 创建时确定市场种子；年度基础自然增长首轮 10%（可调 8%–12%），不得按“每月 10%”叠加。
- 事件池 5 种：订单临时增加、订单临时减少、采购/成本上涨、员工意外离职、一次性设备/售后损失。
- **每年最多 1 次，概率 25%**；由 `hash(seed, runId, year, 'event')` 决定是否发生、类型与月份，与 UI 上的“换一批”无关（B13）。
- 员工意外离职：次月移除岗位，**无裁员赔偿**；不会连锁引发第二事件。
- 影响幅度不超过相关基数的 5%–12%，损失经正经成本项入账并列入年报；已结算月份不追溯。

### 4.8 年报与连续盈利

年末 `totalAnnualProfit = Σ月利润`；> 0 则 `consecutiveProfitableYears += 1`，否则归零；达到 3 置 `target3YearsAchieved=true` 并保留记录，仍可继续经营。亏损不清公司、CEO、资产、员工。年报冻结为快照，不可修改旧年度。

### 4.9 离线结算

```ts
safeGapMs = max(0, nowMs − lastWallClockMs)
eligibleMs = min(safeGapMs, 24h)
credit = eligibleMs + offlineRemainderMs
months = min(36, floor(credit / 40min))
newRemainder = months === 36 ? 0 : credit − months × 40min
逐月原子结算；遇风险中断则停止，不凭空跳月
lastWallClockMs = max(nowMs, lastWallClockMs)
```

中断后不得把全部余量无限保留供反复重试套利。

### 4.10 风控与一次性救助

- `WARNING`：未来 6 个月固定支出覆盖不足（黄色提示）。
- `DISTRESS`：当月必要费用确实无法支付 → 冻结新投资/招聘与无法负担的月结，保留存档。
- 玩家可：手动把部门人数调 0（补偿仍需现金）、切稳健、降预算、等回款，或领取**每 run 仅一次**的 CEO 追加资本 ¥100,000（计入实收资本，不计收入/利润，重复点击拒绝）。
- 不实现破产、贷款、自动裁员；必须保证不存在无法交互的死锁（最差可主动关闭重开）。

### 4.11 必测结算故障

前后台快速切换 10 次、5× 跨年临界、杀进程中断月结、时间回拨 24h、40h 离线封顶、写盘失败、事件单年重复读档、关闭公司与月结竞态。每个用例必须同时给出 Ledger 明细与 State 变动，不能只看页面数字。

---

## 5. 行业、参数与平衡

### 5.1 设计原则

三行业（电商贸易 / 软件科技 / 企业服务）创建后只能经营一种，操作流程完全统一；行业只改变订单基数、单人产能、直接成本率、其他费用率与部门适配。参数集中在 `economy.v1.json`，`configVersion=economy-v1.0.0`；升级迁移不得隐式重算已结算年份。第一阶段**只有默认平衡难度**，不做 A/C 难度切换。

### 5.2 行业配置表（元/经营年，比率 bps）

| 代号 | 中文名 | 首年年需求 | 单人年产能 | 直接成本 | 其他运营 | 售后 | 年固定费 | 参考月薪 |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| TRADE | 电商贸易 | 720,000 | 400,000 | 6000 | 800 | 200 | 48,000 | 5,000 |
| SOFTWARE | 软件科技 | 400,000 | 250,000 | 2500 | 1100 | 100 | 48,000 | 6,500 |
| SERVICE | 企业服务 | 450,000 | 280,000 | 3500 | 850 | 150 | 48,000 | 6,000 |

### 5.3 首年黄金样例（G001–G003）

| 项目 | 贸易 | 软件 | 服务 |
|---|---:|---:|---:|
| 对外收入 | 720,000 | 400,000 | 450,000 |
| 直接成本 | −432,000 | −100,000 | −157,500 |
| 其他运营费 | −57,600 | −44,000 | −38,250 |
| 售后费用 | −14,400 | −4,000 | −6,750 |
| 固定经营费 | −48,000 | −48,000 | −48,000 |
| 两名员工工资（12 月） | −120,000 | −156,000 | −144,000 |
| 两人招聘费（一次性） | −10,000 | −13,000 | −12,000 |
| **净利润** | **38,000** | **35,000** | **43,500** |
| 期末现金 | **338,000** | **335,000** | **343,500** |

首聘招聘费在点击录用时即扣现金并计入第 1 年；月结不得重复支付。测试需把首聘后现金 290,000 / 287,000 / 288,000 与 pending 招聘费一并勾稽。

### 5.4 部门效果参数（1 名 skill=60 员工基准）

| 部门 | 有效基数 | 1 人基准 | 上限 | 额外限制 |
|---|---|---:|---:|---|
| HR | 招聘费 + 主营可交付产能 | 招聘费 −25%；产能 +6% | −40%；+12% | 产能仅在订单充足时转化为营收；折扣只影响未来费用 |
| 采购 | 直接成本中的可采购部分 | −10% | −18% | 可采购比例：贸易 95%、软件 10%、服务 15% |
| 市场 | 基础潜在订单 | 获客 +12% | +25% | 营收不得超过交付产能 |
| 客服 | 售后费用 | −35% | −65% | 售后费已从其他运营费单列 |
| 财务 | 固定管理费 + 其他可控运营费 | −20% | −40% | 不减工资/直接采购/售后；部门工资另计 |

**统一采用查表法**（禁用指数法，避免实现分叉）：

```text
staffCount = 0            => 0
staffCount >= 1           => multiplier ∈ [1.00, 1.40, 1.60, 1.70, 1.75]
avgSkillFactor = clamp(avg(skill)/60, 0.5, 1.5)
effectBps = min(capBps, round(baseBps × multiplier × avgSkillFactor))
```

HR 的两项加成共享同一员工效能倍数，各自受独立上限约束；`staffMultiplierBps` 是唯一来源。

### 5.5 部门收益示例

贸易年营业额 1,600,000，直接成本 960,000，可采购部分 95% → 912,000；1 名 skill=60 采购减 10% → 省 91,200。若月薪 5,000、招聘费 5,000、设部 10,000，则当年该部门净贡献 = 91,200 − 60,000 − 5,000 − 10,000 = **+16,200**。

小规模时可为负：贸易首年 72 万，采购省 41,040，而人员 6 万 + 招聘 0.5 万 + 设部 1 万 = 7.5 万，净贡献 **−33,960**；不得强制玩家建部。

统一预览口径：`当年预计增益 = 可避免费用 + 可实现新增边际销售贡献 − 新增工资 − 招聘费 − 设部费`；营销新增营业额必须受产能限制并乘贡献率，绝不把营业额当利润。

### 5.6 人员与策略影响

- 自动推荐阈值：新增员工未来 12 个月预计贡献利润须超过工资 + 招聘费（STEADY 1.0×、GROWTH 0.8×、PROFIT 1.2×）。
- 三种 CEO 性格只改变成长方向，初期不叠加收入加成（否则首年黄金基准失效）。
- 满意度仅作 UI 简化信息（默认 80），不建复杂满意度离职模型。
- 员工年成长 `max(1, round(potential/30))`，上限 100；工资不自动上涨。

### 5.7 平衡验收目标（非玩家硬指标）

- 标准无事件首年小额盈利：贸易 3.8 万 / 软件 3.5 万 / 服务 4.35 万。
- 首年选错人与部门应能亏损，不是所有开局都赚钱。
- 5 年内至少体验一次“合理建部带来净收益”，但不保证三行业都在第 3 年净赚。
- 高能力 / 高潜力 / 低工资候选各有短期长期差异，三项不等价。
- 只点“招聘”不增加订单；订单受限时扩员只增加成本。

### 5.8 金额边界与批量模拟

单次模拟使用安全整数，超过 `MAX_MONEY_YUAN = 100,000,000,000` 时钳制并输出可识别状态，禁止 `NaN/Infinity`。批量模拟 100 seed × 3 行业 × 3 策略 × 5 年（实际执行 900 run），输出 CSV（`tools/simulate5year.ts`）。

### 5.9 本地模拟排行榜（bot 规则）

- 固定 12 家虚拟企业（sharedSeed 派生，重开同种子一致，不继承玩家历史）。
- 初始总资产 ¥100,000–1,500,000，初始经营年数 0–8 年。
- 玩家“已经营年数” = 已完成年结数，创建时为 0。
- 每完成 1 个经营年，12 家 bot 各自推进 1 年：`newAsset = max(0, round(oldAsset × (10000 + baseGrowthBps + yearJitterBps)/10000))`；年增长 3%–12%，jitter 取 `hash(botId, year)` 的 [−500, +500]。
- 排序：ASSETS 按资产降序 → 年限降序 → 稳定 ID；TENURE 按年限降序 → 资产降序 → 稳定 ID。
- 榜单标注“模拟企业”，不引用真实商标；重开后回到同一初始榜单，玩家数据清零。

---

## 6. CEO、员工、招聘与裁员

### 6.1 随机公司名

`companyNamePrefixes / industrySuffixes / companyNameEndings` 至少 30 个安全趣味前缀（如“今天也盈利”“老板有点忙”“一条咸鱼”“明天上市吗”“亿点点梦想”），避免真实商标、低俗词、误导性“官方/国企”。`rollCompanyNames(industry, 3)` 免费刷新、每次 3 个不同候选、使用**非财务 RNG 流**（刷新不影响市场事件）。

自定义名称：去首尾空白、统一全角空格、建议 2–20 中文字形、禁止全空白/控制字符/敏感词、屏蔽富文本标签，纯 Label 渲染；失败统一 `INVALID_NAME`。当前实现使用 Cocos `EditBox`（真机唤起系统键盘），并在同一弹窗内提供“换一批/使用此名称”。

### 6.2 CEO

姓名自定义或随机 + 性格三选一（进取 / 稳健 / 亲和），三项能力初始 50/50/50。

| 性格 | 每完整年度成长 | 文案 |
|---|---|---|
| 进取 | 商业 +2、管理 +1、财务 +1 | 擅长开发市场 |
| 稳健 | 商业 +1、管理 +1、财务 +2 | 擅长资金管理 |
| 亲和 | 商业 +1、管理 +2、财务 +1 | 擅长团队协作 |

上限 100，只在年结增长；重开清空。

### 6.3 员工字段与候选生成（可复现）

候选由 `hash(runSeed, deptId, offerSequence)` 派生独立 RNG，姓名/性格/属性/工资稳定；刷新 `offerSequence+1` 后旧 Offer 全部失效。

| 档位 | skill | potential | teamwork | 月薪 |
|---|---|---|---|---|
| A 即战力 | 75–90 | 45–75 | 45–85 | 6,200–8,000 |
| B 潜力股 | 50–70 | 80–98 | 50–90 | 5,000–7,200 |
| C 经济型 | 45–72 | 50–85 | 55–90 | 4,000–5,800 |

招聘费基线 = 1 个月工资；HR 折扣只对支付当时已生效的 HR 生效，不事后退款。

### 6.4 招聘状态机

`AVAILABLE_OFFER → PREVIEW → CONFIRMING → HIRED/REJECTED`

1. 部门点“招聘”生成/读取未过期 Offer（3 候选）。
2. 点候选显示：立即支付招聘费、预计年薪、产能/部门贡献预测、余额。
3. 确认时重新校验 `offerId + candidateId + departmentId + runId + revision`、现金 ≥ 招聘费、未被录用。
4. 同 `commandId` 重试返回前次结果不重复扣费；不同命令录用已录用候选报错。
5. 费用点击即扣，登记唯一 `entryId`；在职与工资从**下一个完整月**生效；首聘 2 人为例外（第 1 月生效，费计入第 1 年）。
6. 提交失败保持原 Offer，不假装成功。

所有命令处于同一串行 `GameMutationLock`，避免“同一人月底收两次工资”。

### 6.5 年成长

年末对在职满一个完整年度的员工：`delta = max(1, round(potential/30))`，`skill = min(100, skill + delta)`。潜力不增长、工资不自动上涨、性格不可改；离职员工不无限保留历史；成长只在年结执行一次。

### 6.6 裁员

仅玩家主动触发。预览必须提供：姓名、部门、月薪、任职年数、补偿月数、补偿金额、次年工资节约、产能/部门效益损失、裁后现金。

```text
在职年数 = floor(在职月数 / 12)
补偿月数 = min(3, max(1, ceil(在职年数 / 2)))
补偿金额 = 月薪 × 补偿月数
```

例：任职 3 年、月薪 8,000 → 赔偿 16,000。

确认 token 60 秒有效，确认时重算金额并复核现金；预览与提交不一致须重新确认；现金不足 `INSUFFICIENT_CASH`；状态流转 `ACTIVE → PENDING_DISMISSAL → DISMISSED`，到期月份移除产能与工资；**永不自动裁员**。

### 6.7 自动招聘与手动干预

- 只有 `staffingMode=AUTO` 的部门允许自动招聘；`LOCKED` 守目标人数但不自动补员。
- 自动招聘须保留未来 6 个月刚性费用（PROFIT 为 9 个月）现金。
- 每个内部月最多 **1 人**，每年最多 **3 人**，按预计收益排序。
- 自动不裁员、不解雇新人、不建部门、不投资扩产。
- 手动招聘不受月度自动限制，但受现金约束，需求不足时提示“人手可能闲置”。

### 6.8 关键测试

反复点击录用 10 次只扣一次；旧 candidateId 返回 `OFFER_EXPIRED`；重复裁员/现金不足裁员/跨月裁员/杀进程重试；高潜力员工 5 年后超越低潜员工的部分情形；长文本、emoji、敏感词、空值；多次重开后数据正确清零。

---

## 7. 部门与自动经营

### 7.1 部门边界

一家公司始终且仅有一个 `BUSINESS` 主营部；支持部门 HR / 采购 / 市场 / 客服 / 财务，同类型只能建一次。没有子公司、集团共享或跨行业成本分摊。

### 7.2 部门卡与创建

- 未创建卡：名称、图标、作用、设立费 ¥10,000、适配提示、`创建`。
- 已创建卡：在岗人数、工资、当年实际收益、净贡献、AUTO/LOCKED、`招聘`、员工列表。
- 0 员工显示“尚未配置人员：无部门效益”；创建**不送员工**。
- `createDepartment`：校验非 BUSINESS、未创建、现金 ≥ 1 万 → 扣费 → 记设部费本年损益 → 部门 `enabled=true, staffingMode=LOCKED, targetCount=0`。切 AUTO 前展示预计招聘预算。
- 部门不可删除（避免“建→删→退款”刷钱），只可空置或关自动。

### 7.3 经营影响顺序

1. 先算业务员工产能，市场部影响需求，两者决定营收。
2. 用营收乘直接成本率、其他运营费率、售后费率，再算采购/客服节省。
3. 算固定管理费与财务折扣；HR 提高主营产能但不得突破订单上限。
4. 各部门员工工资各扣一次（每人只属一个部门）。
5. 设部费、招聘费、裁员费、资产投资按实际发生时点计入。
6. 部门净贡献 = 可归因节省/毛利 − 部门工资 − 相关一次性费用，**仅用于解释**，不加进总利润。

### 7.4 人员配置

- 员工只属于一个部门；UI 显示人数、目标人数、本年预算。
- 可切 `LOCKED` / `AUTO`；手动减少目标人数**不等于裁员**，UI 必须写明。
- 手动调岗：主营 ↔ 支持部门，下月生效，无招聘费与赔偿，不得双重计入产能；UI 展示调岗前后产能/成本变化。

### 7.5 三种经营方针

| 方针 | 自动招聘门槛 | 现金安全线 | 文案 |
|---|---|---|---|
| STEADY 稳健 | 12 月预计新增贡献 ≥ 工资 + 招聘费 | 6 个月刚性费用 | 更重视现金和盈利 |
| GROWTH 扩张 | ≥ 0.8 ×（工资 + 招聘费） | 6 个月刚性费用 | 适度提前准备产能 |
| PROFIT 利润优先 | ≥ 1.2 ×（工资 + 招聘费） | 9 个月刚性费用 | 严格控制新增工资 |

方针改变的是自动决策，不给固定收入加成；切换立即生效，不改写历史账目。

### 7.6 自动招聘决策（保守且可解释）

```text
每月：
  phase != RUNNING 或 cashRisk != NORMAL → skip
  年自动招聘 ≥ 3 → skip
  对每个 AUTO 部门按类型判断缺口（主营：需求 > 年化产能 × 1.10；
    支持：可避免成本/额外需求足以覆盖预计人员成本）
  用稳定 RNG 生成 3 候选，取预计净 ROI 最高者
  拒绝：不能解决瓶颈 / 现金不足（含 6 或 9 个月储备）/ 超年度招聘预算
  取最大正分，每月至多 1 人
  commandId = autoHire/runId/year/month/deptType
  记录决策解释与预计收益
```

候选人排序分：`0.45×skill + 0.25×potential + 0.15×teamwork + 0.15×(100 − salaryNormalized)`，**最终录用由 ROI 约束决定，不单看分数**。

### 7.7 部门盈亏解释与诊断

部门卡三项：本年度已节约/新增毛利、部门支出（工资 + 建费 + 对应招聘费）、部门净贡献（用于决策，不二次入账）。负贡献不自动裁员，提示“当前规模尚未覆盖部门工资”。

诊断优先级（一次只显示一条）：
1. 现金不足 → 暂停非必要开支
2. 需求高于产能 10% → 产能不足，考虑招聘/投资
3. 产能高于需求 20% → 人员可能闲置，优先改善获客
4. 某成本部门连续 2 年负贡献 → 暂缓招聘或调整人员
5. 连续 3 年盈利 → 已达成阶段目标，可继续提升资产排名

### 7.8 部门测试要点

0 员工节省严格为 0；重复建部不重复扣费；调岗下月生效且无双重工资/产能；采购只对行业允许的直接成本部分生效；HR 无订单不产生现金；财务优惠不超过“固定费 + 其他可控运营费”；客服不得把售后费扣成负数；三方针自动录用数有差异且都不破现金线；离线同样遵守预算与锁定。

---

## 8. UI、路由与新手引导

### 8.1 统一视觉与交互

- 设计基准 375×812，适配 360×640 / 390×844 / 428×926；Fit Width + 安全区（顶部状态栏、底部手势区）。
- 浅色低对比背景 + 深色文字 + 统一财务强调色；盈亏同时用颜色、正负号与文字表达。
- 正文 14–16、核心财务 22–28、辅助说明 ≥ 12 逻辑像素。
- 触控目标 ≥ 44×44，间距 ≥ 8；长列表 ScrollView，> 30 条虚拟化。
- 不做炫技过场；仅保留按钮按下与弹窗入场（≤ 200ms，可降级）。
- 每页支持 Loading / Empty / Normal / Error / ReadOnly 状态；花钱按钮确认前显示资金变化。
- 名称、金额一律 Cocos Label 运行时渲染，超长截断 + 二级详情；输入用 EditBox，不引用 DOM。

### 8.2 路由清单

| ID | 页面 | 入口 | 核心状态 |
|---|---|---|---|
| S00 | Boot / 平台初始化 | 启动 | 读档、登录、隐私入口、错误恢复 |
| S01 | 公司创建 | 首次/重开 | 随机名、自定义名、行业三选一、预计开局 |
| S02 | CEO 创建 | S01 下一步 | 姓名、性格、属性预览 |
| S03 | 初始招聘 | S02 下一步 | 3 人对比，录用 2 人，时钟未启动 |
| T01 | 公司首页 | 创建完成/底部 | 现金、进行中收入与预计利润、年进度、倍速、风险 |
| T02 | 部门 | 底部 | 主营部 + 支持部门卡、建部、人员模式 |
| T03 | 人才 | 底部 | 员工列表、部门筛选、3 候选招聘、裁员 |
| T04 | 排行 | 底部 | 总资产 / 年限排名，我方高亮 |
| D01 | 年度报告 | 首页/年结 | 费用分类、资产变化、事件、建议 |
| D02 | 员工详情 | 员工卡 | 成长、工资、任期、裁员预览 |
| D03 | 部门详情 | 部门卡 | 人数、净效益、招聘、锁定 |
| D04 | 设置 | 首页右上 | 重看指引、隐私、版本、关闭公司 |
| D05 | 关闭公司确认 | D04 | 风险文案、二次确认 |
| D06 | 离线回归报告 | 冷启动 | 离线月数/年数、收入/利润/现金变化、事件 |
| D07 | 经营危机 | 风控/首页风险卡 | 缺口、暂停操作、一次追加资本 |

只有 T01–T04 是底部 Tab，其余为向导/弹窗/二级页。

### 8.3 核心屏幕规格要点

- **S01**：步骤“1/3”，行业三选一，3 个随机公司名 + `换一批` + `自定义名称`（输入有效则优先采用）；无有效名称/行业时禁用下一步并给出原因。
- **S02**：步骤“2/3”，姓名输入/随机、3 性格卡、三条能力 50；`上一步` 保留公司名；`下一步` 执行创建事务且只注资一次。
- **S03**：步骤“3/3”，`已录用 x/2`；候选卡含头像/姓名/性格/能力/潜力/协作/工资/招聘费；录用前明示“现在支付 ¥X / 下年工资约 ¥Y”；2/2 后出现“进入公司”。
- **T01**：安全区/公司名/设置 → CEO 卡 + 第 N 年 → 资金/营收/利润三列 → 年进度 + 暂停/1×/2×/5× → 业务简报 + 策略 → 诊断/年报入口 → 四 Tab。进行中数据必须标“预计”。
- **T02**：主营部置顶（人数、产能、订单缺口、扩大产能）；支持部门卡；建部确认需写明“0 员工无效益 + 一次性 1 万”。
- **T03**：员工总数/预计年工资、部门筛选、员工卡进详情、右上招聘选部门、裁员确认展示补偿月数/金额/次年节省。
- **T04**：双榜分段、我方固定高亮、标注“本榜由模拟公司组成，非真实在线排名”。
- **D01**：收入、直接成本、其他运营、售后、固定费、全部工资、招聘、裁员、设部、事件、折旧、利润、期初/末现金、资产；0 值可折叠但不改总计；含当年事件与至多 1 条建议；可回看最近 100 年摘要。

### 8.4 新手引导 TUT-01~06

| 步骤 | 触发 | 高亮 | 通过条件 | 跳过时 |
|---|---|---|---|---|
| TUT-01 公司命名 | S01 | 候选名/输入 | 有效名称选中 | 仍需提供名称 |
| TUT-02 CEO 设定 | S02 | 姓名/性格 | 两者完成 | 仍需设置 |
| TUT-03 首聘 | S03 | 对比卡与录用 | 实际录用 2 人 | 仍需录用 2 人 |
| TUT-04 三大指标 | 首次进 T01 | 现金/营业额/利润“?” | 点击一次 | 关闭解释 |
| TUT-05 开始经营 | T01 | 开始经营/倍速 | 时钟开始推进 | 可直接启动 |
| TUT-06 首年报告 | 第 1 年首次年结 | 利润与现金变动 | 点“知道了” | 关闭解说，年报保留 |

文案：①“欢迎成为 CEO，先给公司起个名字。”②“CEO 的性格会影响未来的成长方向。”③“能力强不一定最划算，也要比较潜力和工资。”④“营收是卖出去多少；利润才是扣掉成本后赚的钱。”⑤“公司会自动经营，你可以暂停或加速时间。”⑥“查看今年利润与现金变化，决定明年是否扩张。”退出：“跳过说明 / 稍后在设置里重新查看”。

教程记录 `completedSteps / skipped / lastKnownStep / tutorialVersion`；中断可恢复；重开重置；设置内“重新查看操作指引”只重播，不重建业务状态。

### 8.5 关键弹窗与安全要求

| 场景 | 标题 | 主要操作 | 安全要求 |
|---|---|---|---|
| 招聘确认 | 确认录用？ | 支付 ¥X 并录用 | 防重、余额复核 |
| 裁员确认 | 确认裁员？ | 支付赔偿 ¥X | 危险按钮不默认高亮 |
| 建部门 | 创建 XX 部？ | 支付 ¥10,000 | 提示 0 员工无效益 |
| 扩大产能 | 扩大主营业务规模 | 投资额、预计增量 | 需求不足时明确风险 |
| 关闭公司 | 关闭公司并重来？ | 红色“永久清除本局” | 二次确认、失败不退出 |
| 经营困难 | 公司资金不足 | 看费用 / 一次救助 / 重开 | 不隐性删档 |
| 存档故障 | 保存失败 | 重试 / 保持当前界面 | 不得声称已保存 |

### 8.6 空态与错误恢复

- 无年度报告：“完成第一个经营年度后可在这里回看财务。”
- 候选生成失败：“暂时无法生成候选人，点击重试”，不扣现金。
- 现金不足：“还需 ¥X 才能完成操作”，显示预计余额。
- 部门已存在：“已创建此部门，可进入管理”，不再扣费。
- 平台认证不可用：按 §9 安全降级，本地档不得静默丢失。
- 空间不足：“无法保存，请释放设备空间后重试”；存档不可用时禁止危险操作。
- 横屏：提示竖屏游玩或在安全区内显示，按钮必须可达。

### 8.7 组件复用

`MetricCard`、`OfferCard`、`EmployeeCard`、`DepartmentCard`、`ProfitLossTable`、`ConfirmDialog`、`BusinessBottleneckHint`、`TutorialOverlay`、`BottomTabs`、`RankRow`、`YearProgress`。全部由 ViewModel 驱动，禁止把金额写死在 Prefab；多行 Label 使用 `RESIZE_HEIGHT`（曾因 SHRINK 导致文字挤成一团）。

### 8.8 UI 验收

360 宽小屏 / 异形屏 / 系统缩放下四 Tab 可点、无横向滚动；10+ 汉字与 emoji 不越界；所有财务值带 ¥ 与正负号；录用/裁员/关公司均有二次确认且重复点击不产生重复事务；引导跳过/中断/重播不强制再聘；重开后引导重置；关弹窗不改变经营时间；Android 返回键不误触确认。

---

## 9. TapTap 适配与发布

> 资料核对日期 2026-11-01。以下为设计约束，**不等于已注册、打包、备案或审核通过**。正式提审前须按后台当期规则复核。

### 9.1 平台形态

目标为 **TapTap 普通小游戏（WebGL 运行时 / 小游戏）**，不是 H5 站点、不是 APK SDK。官方适配扩展流程：Cocos 构建“微信小游戏”→ 转换为 Tap 小游戏 → `build/TapBuild/game.zip`。小游戏运行时**不存在 BOM/DOM**，`window / document / localStorage` 不得作为生产依赖（音频开关持久化使用平台存储接口）。

### 9.2 平台抽象

```ts
interface ITapPlatform {
  getEnvironment(): 'TAPTAP'|'EDITOR';
  getWindowInfo(): { width:number; height:number; safeArea?:{top,bottom,left,right} };
  onShow(cb: ()=>void): Unsubscribe;
  onHide(cb: ()=>void): Unsubscribe;
  getStorage<T>(key:string): Promise<T|null>;
  setStorage<T>(key:string, data:T): Promise<void>;
  removeStorage(key:string): Promise<void>;
  login(): Promise<{code:string}|{mock:true}>;
  getNetworkState(): Promise<'online'|'offline'|'unknown'>;
  request(opts): Promise<Response>;   // 登录交换使用
}
```

- 真实实现封装 `globalThis.tap`，全部回调加超时保护（CallbackGuard）：`get` 超时按“无存档”降级、`set` 超时转 `SAVE_FAILED`、`login` 10s 超时转 `AUTH_REQUIRED`、网络检测失败按 `unknown`。
- Cocos/Web运行入口使用 `CocosPlatform`，Tap正式profile使用 `TapPlatform`；`EditorMockPlatform`/`MemoryStorage`只作为 `tests/helpers` 测试夹具，不属于Creator资产。包卫生测试与最终ZIP扫描均约束Mock不得进入生产包。
- 平台异常统一转领域错误，禁止原始 `errMsg` 泄漏到玩家界面。
- 生命周期：`onHide` 暂停时钟、提交快照、记水位；`onShow` 先恢复/校验 runId → 结算离线 → 恢复在线时钟。

### 9.3 缓存限制（架构约束）

单 key ≤ 1MB、总 ≤ 10MB，加密时单 key ≈ 0.7MB。因此双槽 + 24 个月账本 + 历史裁剪；每槽 < 500KB。平台可能清理缓存，故不得宣传“永久云保存”。

### 9.4 登录与最小服务端

> **2026-11-02 校正**：本节以下交换流程是“配置 authEndpoint 时的可选分支”。当前 `AuthService.ts` 在端点为空时调用 `tap.login()` 后保存本地平台态标记，不强制自建后端；见提交 `ce631d6`。其自行设置的 30 天有效期没有替代 `tap.checkSession()` 的证据，须按 §14.6 整改/真机核验。不能将“缺少后端部署”认定为当前加载图卡死根因，也不能把本地标记当成服务端身份令牌。

客户端 `tap.login()` 取一次性 `code` → 可信服务端 `code2Session` → 换项目自有短期 `sessionToken`。**`session_key` 绝不回传客户端，`code` 不可复用。**

```http
POST /v1/auth/taptap/exchange
{"code":"<single-use>"}
200 {"sessionToken":"<opaque>","expiresInSec":3600}
401 {"code":"TAPTAP_CODE_INVALID"}
503 {"code":"TAPTAP_UPSTREAM_UNAVAILABLE"}
```

实现：`server/auth-server.mjs`（零依赖 Node ≥ 18，AppID/Server Secret/code2Session URL 仅环境变量，不回传 `session_key`/`openid`，提供 `/healthz`），`server/selftest.mjs` 8/8 通过。客户端端点由不入库的 `assets/resources/config/runtime.config.json` 注入（当前为空 = 真机明确报未配置，不伪造登录）。

本地经营数据完全本地；断网时已有存档可进入单机玩法，但不伪造登录成功。

### 9.5 权限、适龄与合规

- **“添加桌面快捷方式”属 APK 的 TapPlay 沙箱能力**；官方 `taptap-minigame-tools v1.2.2` 的 `tap-minigame.d.ts` 无 shortcut/desktop 接口，普通小游戏不实现、不调用。真正必接的是 **TapTap 登录**。
- 不申请位置、相机、麦克风、通讯录、相册等无关权限。
- 适龄标记按内容评估并在后台提交；不因画风卡通自行宣称级别。
- 自定义名称仅本地使用，做字数/控制符/敏感词/侵权过滤。
- 隐私：首启告知弹窗（同意前不登录不联网）、版本化同意记录、设置页隐私入口。文档见 `docs/隐私政策_我是CEO.md` / `.html`。

### 9.6 构建流程（已实测）

```powershell
# 1) web-mobile（本地/无头验证）
powershell -ExecutionPolicy Bypass -File tools/build-web.ps1
node tools/static-server.cjs build/web-mobile 8123

# 2) TapTap 小游戏包
powershell -ExecutionPolicy Bypass -File tools/build-tap.ps1 [-GameVersion 1.0.0]
```

`build-tap.ps1` 的实际链路：wechatgame 内联构建 → `patch-splash.cjs`（自有 logo/slogan/整图加载页）→ `convert-tap.cjs`（官方转换器）→ **再次** `patch-splash.cjs` → `repack-tap.cjs` 重新打包 → 产物自检（大小、SHA256、`game.json`、20MB 门禁）。

> 关键教训：转换器会重新生成 `game.js` 并在头部注回 `throw new Error('fetch is not defined')`，而 zip 在转换阶段就已打包。补丁打完**必须重新打包**，否则真机永久卡在加载页。

Cocos CLI 需要用单字符串参数 + `Start-Process -Wait`；编辑器进程驻留会导致 CLI 静默失败（构建前先关闭编辑器）。

### 9.7 资质与提审清单

| 项目 | 必须准备 | 责任 | 证据 |
|---|---|---|---|
| TapTap 开发者认证 | 个人/企业主体入驻 | 用户 | 后台状态截图 — **DONE（个人主体）** |
| 创建普通小游戏 | 形态选“小游戏”，记录 AppID | 用户 | 后台唯一 ID — **已获得（仅存本地）** |
| 小游戏前置备案 | 软著信息、介绍、负责人材料、电子核验 | 用户/运营 | 核准号 — **IN_PROGRESS** |
| 版号 | 无内购当前指引无需提交（以当期规则为准） | 法务/运营 | 规则核对 |
| 防沉迷 | 依托平台，按实际路径核实 | 开发/运营 | 自测确认 |
| 内容审核 | 文案、命名、事件、版权、权限、隐私 | 设计/法务 | 检查记录 |
| 宣传素材 | 横版 1920×1080、方图 1440×1440（≤2MB）、≥3 实机截图、竖屏实机录屏 | 美术/运营 | 文件清单 |
| 提审上线 | 包体 + 备案 + 商店资料 + 版本审核 | 运营 | 后台截图 |

“预约/敬请期待”与“正式上线”要求不同，不能把预约通过当作已可发布。

### 9.8 审核前技术/安全检查

正式包不含密钥/Mock/Node 依赖；登录失败与断网有可解释恢复；存档不以账号信息作展示名；自定义输入严格过滤；原无广告基线不含广告，用户新增广告版另按§18真实接入/隐私/同包验收，始终无内购或空白广告位；文案不承诺收益；核对适龄、隐私链接、字体素材许可；Android/iOS 各 1 台 + 两种比例 + 断网/权限拒绝/空间不足/升级迁移。

### 9.9 官方参考

- 开发指南 <https://developer.taptap.cn/minigameapidoc/quick-start/document-guide/>
- Cocos 适配 <https://developer.taptap.cn/minigameapidoc/dev/engine/Cocos-Laya-Egret/>
- 创建/包体/资质 <https://developer.taptap.cn/minigameapidoc/quick-start/guide/creation-improvement/>
- 登录时序 <https://developer.taptap.cn/minigameapidoc/dev/tutorial/open-capabilities/login-management/>
- 本地存储 <https://developer.taptap.cn/minigameapidoc/dev/api/storage/tap.setStorage/>
- 设备安全区 <https://developer.taptap.cn/minigameapidoc/dev/api/base/system/tap.getWindowInfo/>
- 前置备案 <https://developer.taptap.cn/minigameapidoc/quick-start/guide/pre-filing/>
- 审核规则 <https://developer.taptap.cn/minigameapidoc/tap-operation/operation-standards/review-standards/>
- 适龄规则 <https://developer.taptap.cn/minigameapidoc/tap-operation/operation-standards/age-rating/>

---

## 10. 测试与黄金用例

### 10.1 测试分层与门禁

**U 单元**（纯领域公式）→ **I 集成**（跨模块交易/持久化）→ **E 端到端**（编辑器/无头浏览器交互）→ **P 平台真机**（TapTap 开发包）。金钱类用例必须同时校验营业额、各项成本、利润、现金、资产。

结果标注 `PASS / FAIL / BLOCKED / NOT_RUN`，禁止把“未测”写成“通过”。

### 10.2 黄金用例 G001–G017

| ID | 场景 | 预期 | 实现落点 |
|---|---|---|---|
| G001 | TRADE 首年标准档 | 收入 720,000 / 利润 38,000 / 末现 338,000 | goldenYear1 |
| G002 | SOFTWARE 首年标准档 | 利润 35,000 / 末现 335,000 | goldenYear1 |
| G003 | SERVICE 首年标准档 | 利润 43,500 / 末现 343,500 | goldenYear1 |
| G004 | 贸易收入 160 万 + 采购 1 人 | 省 91,200，部门净贡献 16,200，费用只减一次 | departmentsM2 |
| G005 | 月薪 8,000 任职 3 年裁员 | 赔 16,000 且仅扣一次，次月停薪停产能 | staffingM2 |
| G006 | 首聘两人各 5,000 | 完聘现金 290,000；第 1 年账计 10,000 不再扣现金 | initialHiring |
| G007 | 扩产 10,000 | 现金 −10,000、业务资产 +10,000、总资产不变、当期利润不受影响 | investment |
| G008 | 1× 300,000ms | 恰好 12 个月；2× 150,000ms；5× 60,000ms | clock |
| G009 | 离线 8h / 40h | 12 个月 / 最多 36 个月，不重复领取 | offlineM3 |
| G010 | 亏损 1 万但现金 10 万 | 连盈计数清零，可继续，存档不删 | annualGoal |
| G011 | 连续 3 年各 +1 元 | 达标 true，仍自由经营 | annualGoal |
| G012 | 一次救助 100,000 重复点击 | 首次现金/实收资本各 +100,000，利润不变；后续拒绝 | eventRiskM3 |
| G013 | 采购部不存在 / 0 人 | 节省 0，重复建部拒绝且不扣费 | departmentsM2 |
| G014 | 售后 5,000、客服 35% | 售后降至 3,250，省 1,750，不得再从直接成本扣 | departmentsM2 |
| G015 | 固定费 48,000、其他可控 0、财务 20% | 管理费 38,400，省 9,600 | departmentsM2 |
| G016 | 固定费 48,000、其他可控 152,000、财务 20% | 合并省 40,000（先抵固定再抵其他），各费率只用一次 | departmentsM2（本轮修正口径） |
| G017 | HR 1 人、产能 80 万、订单 100 万 | 交付 +6% 到 84.8 万，不额外创收 | departmentsM2 |

### 10.3 业务验收 A01–A25

覆盖：创建/自定义名/重启只注资一次、录用只扣一次且次月生效、需求不足扩招不增收入、采购 ROI、裁员赔偿与二次确认、三行业首年一致、亏损继续、AUTO/LOCKED 与倍速、离线 8h/40h、扩张资产口径、三年连盈、救助一次、模拟榜排序与重开清零、小屏可达、关闭取消、确认重建清零、关闭后离线不复活、引导跳过/断点/重播、真实包体可玩、安全区异形屏、登录失效断网、隐私与输入过滤、备案资质物料、重开与写盘/年结竞态。

### 10.4 故障与安全 B01–B16

| ID | 场景 | 结论 |
|---|---|---|
| B01/B02 | 写盘/活动指针失败、中途断电 checksum 错 | PASS（saveRepository） |
| B03 | 墓碑写成功但删旧档失败 | PASS（resetCompany） |
| B04 | 同候选连点 10 次 | PASS（initialHiring） |
| B05 | 招聘与月结并发 | PASS（串行锁，本轮新增） |
| B06 | 连点建部只扣一次 | PASS（与 G013 同用例） |
| B07 | 裁员重复提交且现金变化 | PASS（staffingM2） |
| B08/B09/B10 | 时间回拨 / 零散离线累积 / 暂停挂机 | PASS（offlineM3） |
| B11 | 首聘 1/2 强杀恢复 | PASS |
| B12 | 危机→救助→恢复 | PASS（eventRiskM3） |
| B13 | 事件按 seed 固定 | PASS |
| B14 | 奇异存档拒绝恢复 | PASS（stateIntegrity，本轮新增） |
| B15 | 120 年存档 < 500KB 裁剪 | PASS（statePrune，本轮新增） |
| B16 | 包体无 Mock / 无 BOM 依赖 / 无密钥 | PASS（packageHygiene，本轮新增） |

### 10.5 批量模拟与证据规范

- 100 seed × 3 行业 × 3 策略 × 5 年（900 run），输出 `seed/industry/years/profit/cash/assets/hireCount/deptCount/criticalEvents` CSV；关注无限现金、全员自动招聘、重复救助、同年多事件、财务不守恒。
- 每个 TASK 证据放 `evidence/<milestone>/<TASK-ID>/`：录屏（UI 必选）、单测/集成日志、前后状态 JSON、财务 Ledger CSV、设备信息、findings。
- DoD：P0 全过、无未解决 P0/P1、主流程真机可用、黄金值一致、无严重裁切/触摸死角；未拿到备案/审核结果只能称“开发可提审”。

---

## 11. 当前执行进展与任务记录

> 最后更新 2026-11-02（发布差距调研与模拟复测，详见 §11.9、§14）。2026-11-01 的状态和修复描述保留历史语境；与本次实测冲突时以新证据为准。状态词只允许 `TODO / IN_PROGRESS / BLOCKED / READY_FOR_QA / DONE`。

### 11.1 里程碑总览

| 里程碑 | 状态 | 关键结论 |
|---|---|---|
| M0 基础工程 | READY_FOR_QA（核心全绿） | 工程/场景/四 Tab/公司+CEO 创建/首聘 2 人/双槽存档/关闭重开完成；真机项为外部前置 |
| M1 财务经营 | READY_FOR_QA（核心全绿） | 三行业黄金账分毫不差；在线时钟、跨年、扩产、年报完成 |
| M2 员工部门 | READY_FOR_QA（核心全绿） | 招聘/裁员/成长/五支持部门/三方针/自动招聘与管理 UI 完成 |
| M3 发布准备 | **BLOCKED** | 核心 205 用例通过；最新 Android 准入失败、宿主 API 兼容缺口、读档超时风险、UI 与完整 E2E 门禁未收口；不能据领域全绿称“可提审候选”（§14） |

**自动化基线**：23 个测试文件、`npx vitest run` 全部通过（详见 §11.5 复核命令）；`npm run typecheck`、`npm run lint` 0 错误。

### 11.2 任务清单（M0–M3）

**M0**
| ID | 状态 | 内容 |
|---|---|---|
| M0-01 | DONE | Cocos 3.8.8 工程、Game.scene、四 Tab 壳、主题、竖屏（无头 Chromium 390×844 零 JS 错误验证） |
| M0-02 | DONE | `domain/{errors,result,command,money,types}`、错误码、严格 TS |
| M0-03 | DONE | `ITapPlatform` + `CocosPlatform`；`MemoryStorage` + `EditorMockPlatform`仅作测试夹具（`tests/helpers`），不进入Creator资产/生产包 |
| M0-04 | DONE | `GameState`、工厂、id 生成、RNG |
| M0-05 | DONE | 双槽存档、CRC32、信封校验、指针恢复、墓碑阻断（9 用例） |
| M0-06 | DONE | 公司名三选一/自定义、行业、CEO、单次注资（8 用例） |
| M0-07 | DONE | 三候选生成、首聘 2 人、次月生效、OFFER_EXPIRED（8 用例） |
| M0-08 | DONE | 引导 TUT-01~05 + 指标气泡；TUT-06 在 M3 完成 |
| M0-09 | DONE | 关闭公司事务、60s token、墓碑、旧 run 屏蔽（10 用例） |
| M0-10 | DONE（真机项除外） | web-mobile PoC + Tap 打包链路 CLI 实际出包；真机自测待用户 |

**M1**
| ID | 状态 | 内容 |
|---|---|---|
| M1-01 | DONE | `economy.v1.json` 加载/类型/硬校验（篡改即抛 `ConfigValidationError`） |
| M1-02 | DONE | mulberry32 + xmur3 固定 seed，独立随机流（market/event/offer/companyName） |
| M1-03 | DONE | 年需求复利、获客、月订单年度残差分配、产能系数与取整补差 |
| M1-04 | DONE | 逐月结算：比例费 YTD 残差、固定费末月补差、pendingEntries 区分现金口径；G001–G003 精确 |
| M1-05 | DONE | 在线 1×/2×/5×/暂停、真实 ms 累积、跨月原子月结、G008 |
| M1-06 | DONE | 年结汇总、连盈计数、三年达标、CEO 年度成长、年报入册 |
| M1-07 | DONE | 扩产现金↔业务资产、产能上限、次年起 10% 折旧、G007 |
| M1-08 | DONE | 公司首页三指标/时钟/CEO 卡/扩产弹窗/年报表；修复看板态无“开始经营”入口导致时钟不启动 |

**M2**
| ID | 状态 | 内容 |
|---|---|---|
| M2-01 | DONE | 任意部门三候选、分页刷新、A/B/C 倾向比较、次月生效、HR 招聘折扣 |
| M2-02 | DONE | 年结员工成长 `max(1,round(potential/30))`、封顶 100、员工详情卡 |
| M2-03 | DONE | 裁员预览/补偿/60s 二次确认/幂等/现金不足拒绝（G005） |
| M2-04 | DONE | 五支持部门创建、去重、设部费、默认 LOCKED、0 员工无效、不可删除 |
| M2-05 | DONE | 五部门量化效益（查表法）、每种费用只作用一次（G004/G014/G015/G016） |
| M2-06 | DONE | 员工主营↔支持部门调岗，下月生效，无双重工资/产能 |
| M2-07 | DONE | 三方针、ROI 门槛、6/9 月现金留存、月 ≤1 人/年 ≤3 人、确定性决策日志 |
| M2-08 | DONE | 部门页/人才页/招聘弹窗/建部预览全走命令层；修复多行 Label SHRINK 挤压 |

**M3**
| ID | 状态 | 内容 |
|---|---|---|
| M3-01 | DONE | 离线 40 分钟/月、最多 36 月、余量累积、暂停不结算、回拨 0 结算、离线摘要弹窗 |
| M3-02 | DONE | 5 种年度事件、`hash(seed,runId,year,'event')` 固定、年 ≤1、25%、首年保护 |
| M3-03 | DONE | WARNING/DISTRESS、冻结月结、一次性 10 万救助、救助后解除冻结 |
| M3-04 | DONE | 12 家确定性 bot、资产榜/年限榜、年结同步推进、重开不继承 |
| M3-05 | DONE | 帮助重播、年报空态、四 Tab 可达、离线/危机恢复弹窗 |
| M3-06 | DONE | 21 个 M3 单测 + 900 run 批量模拟（零负现金、零守恒失败） |
| M3-07 | 代码 DONE / 真机 BLOCKED | `TapPlatform`（封装 `globalThis.tap`、异常转领域错误）+ `PlatformFactory`；35 项平台单测；真机待测 |
| M3-08 | DONE（文档）/ 资质待办 | 隐私与数据、内容安全、素材音频许可、上架前置清单（并入本文档 §9） |
| M3-09 | BLOCKED | 版本冻结、提审包、AppID/版号/渠道核对依赖开发者主体 |

**音频接入（配合 UI-12）**：DONE。`AudioManager` 三开关（master/music/effects，一票否决、持久化、首次触摸解锁、切后台暂停、失败静默降级）；2 BGM 循环 + 3 JNG（年盈/年亏/三连）+ 11 SFX 已挂关键动作；设置页三开关。真机听感与循环接缝待真机验证。

### 11.3 最近一轮修复（提交 `0d2fac6`）

针对用户反馈的 4 个问题：

| # | 问题 | 处理 |
|---|---|---|
| 1 | “换一批”无效，且不满意时无法自己起公司名 | ① 换一批改为基于递增 nonce 的确定性刷新（每次必出新 3 个，且不污染市场事件随机流）；② 新增自定义公司名弹窗，使用 Cocos `EditBox`（真机唤起系统键盘），支持输入后选择使用，长按/输入法与浅色卡片可见性已修正（EditBox label 默认白色改为深色） |
| 2 | 加载页要换成附件里的整图 | 加载页改为整图 WebGL first-screen（`tools/splash/first-screen.js` 342 行 + `splash.jpg`），同步注入 `build-templates/{web-mobile,wechatgame}` 与 Tap 包 |
| 3 | 进入第二页（CEO 页）点任意按钮都跳回第一页 | 修复 `createStep` 状态在重建视图时被重置的缺陷：页面重建时按 `createStep` 恢复渲染（`AppView.ts` 中 `if (this.createStep === 'CEO') renderCreateCeo()`），返回按钮只在显式点击时重置为 `COMPANY` |
| 4 | 华为 / vivo 真机自测停在加载页 | 根因定位为两条：① Tap 转换器在 `game.js` 头部注回 `throw new Error('fetch is not defined')`，而 zip 在转换阶段已打包 → 增加 `repack-tap.cjs`，**补丁后重新打包**（`build-tap.ps1` 增加 `[2.5/3]` 步骤并校验 `REPACK_OK`）；② 启动模板仅 `platform === 'android'` 走 rAF → 改为“非 iOS 一律走 rAF”，并注入 `CEO-BOOT-DIAG` 启动打点/原生弹窗诊断（`tools/diag-inject.mjs`）。整图加载页同时作为 fail-safe 首屏。 |

证据：`evidence/q3/`（v0-splash、v1-privacy … v9-custom-selected、playtest、splash-bottom 等截图 + `verify-onboarding.cjs`）。

### 11.4 构建与包体现状

| 项 | 值 |
|---|---|
| 引擎 / 插件 | Cocos Creator **3.8.8** / `taptap-minigame-tools` **1.2.2** |
| Tap 包路径 | `build/TapBuild/game.zip` |
| 大小 / 条目 | **5,499,092 B ≈ 5.24 MiB（5.37 MB）** / **472 项** |
| SHA256 | `05E946662B9CE5CE761A0BC751272833FE53A038796E7646F143C15415C43730` |
| game.json | `deviceOrientation=portrait`、`productVersion=1.0.0`、`convertScriptVersion=2.0.4-ts` |
| 门禁 | ≤ 20MB 内部目标（官方“首包 60M+”）；包内无 `EditorMockPlatform`、无 Server Secret / Client Token / `session_key` / 私钥 |
| 生成时间 | 2026-11-01 23:17 |

（`build/` 整体被 gitignore，仅 `build/TapBuild/game.zip` 被跟踪，作为可上传产物。）

### 11.5 质量门禁现状（独立 QA 复核：`evidence/QA_REPORT_M3_FINAL.md`）

| 项 | 命令 | 结果 |
|---|---|---|
| 单元/集成/黄金/模拟 | `npx vitest run` | 23 文件全绿（最新基线 **205** 用例） |
| 类型检查 | `npm run typecheck` | 0 错误 |
| 静态检查 | `npm run lint` | 0 错误 |
| 900 run 5 年模拟 | `tools/simulate5year.ts` | 零负现金、零守恒失败、零重复救助、单年自动招聘 ≤3 |
| 服务端自检 | `node server/selftest.mjs` | 8/8 PASS（不回传 session_key / openid） |
| web-mobile 无头 | `node tools/verify-v5.cjs` | 隐私首启弹窗→同意落盘→重载不再弹，零 JS 错误 |
| 黄金用例 | G001–G017 | 全 PASS（G016 口径本轮修正） |
| 故障/安全 | B01–B16 | 全 PASS |

### 11.6 未完成与阻塞项

> **2026-11-02 更正**：下表为上轮整理记录，最新准入报告 Android 仅 2/5 通过；“5 台全过”“大概率仅鸿蒙支持限制”不再是可用结论。当前真正阻塞与分层状态以 §14.1—§14.3 为准。登录服务端不是当前单机分支的必选依赖，资质进度未在本轮重新登录后台确认。

| 项 | 状态 | 说明 |
|---|---|---|
| Android 真机（华为 nova 15 Ultra / HarmonyOS NEXT） | **IN_PROGRESS** | v2–v4 均停在 Cocos 启动页；云端 5 台 Android 准入测试全过同一包体；官方 SDK 环境要求只列 Android 5.0+/iOS 12+，未声明 HarmonyOS。判断大概率为小游戏容器在鸿蒙的支持限制；v5 起加入启动诊断与“非 iOS 走 rAF”修正，待实机取证 |
| Android 上传后扫码自测 | BLOCKED | 需用户在后台完成 |
| iOS 真机 | BLOCKED | 无设备/凭证 |
| 登录服务端真机联调 | BLOCKED | 需官方 `code2Session` 真实 URL + Server Secret 部署 + `runtime.config.json` 填 `authEndpoint` |
| 隐私政策 URL | BLOCKED | 需可访问的 https 地址，写入 `runtime.config.json` |
| 备案 / 软著 | IN_PROGRESS | ICP 核准备案卡在“小游戏包体选择”，包体已产出待上传；软著为长尾项 |
| 实机截图 ≥3 张 + 竖屏实机录屏 | TODO | 动画 CG 不可代替实机 |
| 提审 / 公测发布 | TODO | 依赖上述项 |

### 11.7 遗留问题台账

| Issue | 优先级 | 描述 | 状态 |
|---|---|---|---|
| ISSUE-ENV-01 | — | 曾误判编辑器未安装（实际在系统隐藏目录深度 5） | CLOSED（2026-11-01） |
| ISSUE-ENV-02 | P1 | Tap 官方适配扩展缺安装确认 → 已安装 v1.2.2 并实际出包；CLI 需 `--build configPath=...` | CLOSED |
| ISSUE-HARMONY-01 | P1 | 鸿蒙真机卡启动页（见 §11.6） | IN_PROGRESS |

### 11.8 本次整理（2026-11-01，项目清理任务）

| 动作 | 内容 |
|---|---|
| 文档合并 | 原 14 份编号设计文档 + README + V0.9 归档 + `CEO_Test_Release_v1_1/*` + `研发过程记录/*` + 根目录 `EXECUTION_STATUS.md` → **本文档**（已删除原件，内容按章节保留） |
| 文档保留 | `docs/配置与测试数据/`（机器可读基线，代码镜像来源）、`docs/隐私政策_我是CEO.md/.html`（提审必需） |
| 资产清理 | 删除 `audio/Masters_WAV`（16 个 WAV，约 28MB，可由 `audio/Tools/generate_original_audio.py` 重新合成）与 `audio/Preview`（试听合辑）；运行时使用的 16 个 MP3 保留在 `assets/resources/audio/` |
| 代码清理 | 删除 `server/leanengine/`（已被 `server/auth-server.mjs` 取代的旧 LeanCloud 方案） |
| 构建产物 | `build/` 为可再生的生成产物（gitignore），本次**保留**当前 `build/web-mobile`（本地预览正在使用）与中间产物；如需瘦身可在关闭编辑器后删除 `build/web-mobile`、`build/wechatgame`、`build/TapBuild/game/`，仅保留 `build/TapBuild/game.zip` |
| 脚本清理 | 删除 `tools/update-plan-xlsx.py`（仅用于已删除的测试计划 xlsx） |
| 保留 | `design/`（UI/音频设计源）、`evidence/`（各里程碑证据）、`CEO_TapTap_*`（商店与宣传物料）、`tests/`、`tools/`、`library/`、`temp/`（Cocos 缓存，随编辑器重建） |
| 规则文档同步 | `AGENT.md` 全部旧文档引用（`docs/00–13`、`EXECUTION_STATUS.md`、`校验设计基线.py`、`配置与测试数据/…` 相对路径）已改为指向本文档章节；`README.md` 重写为仓库导览 |
| 整理后回归 | `npm run typecheck` 0 错误；`npx vitest run` **23 文件 / 205 用例全绿**（清理未影响构建与测试） |
| 清理量 | git 侧共 57 项变更：删除 53 项（14 份编号文档 + 13 份测试包 + README + V0.9 + 2 份模板/脚本 + 16 WAV + 1 MP3 + 3 个 LeanCloud 文件 + 1 个 xlsx 脚本 + `EXECUTION_STATUS.md`）、新增 1 项（本文档）、修改 3 项（`AGENT.md`、根 `README.md`、`server/README.md`） |

---

### 11.9 发布差距调研与模拟复测（2026-11-02）

- 任务：`TASK-M3-09` 发布准备的调研/整改设计阶段；本阶段报告 **READY_FOR_QA**，发布任务整体仍 **BLOCKED**。关联 M3-06 的模拟验收与 M3-07 的平台验收。
- 输入：AGENT.md、README、本文 §1—§12、配置与测试数据、UI 设计包入口、现有实现/测试/构建脚本、当前 game.zip、用户两张准入截图与 OPPO 日志压缩包。附件作为测试资料，不作为授权来源。
- 已完成：复跑类型/lint/205 项测试（含 900 个五年 run）；浏览器真实点击并回读状态/重载存档；宿主 API 缺失与存储超时故障模拟；官方引擎适配、调试、性能与审核文档核对；详细方案落于 §14。
- 本轮只修改本总览和 README，新增可复跑审计脚本、JSON 和截图证据；**未修改游戏业务/经济参数/构建脚本/插件，未重建或替换发布 zip，未提交/推送/上传/提审**。
- 证据目录：`evidence/release-audit-20261102/`。浏览器最终结果以 `browser-report.json` 为准；`vitest.json` 是本次全量核心测试报告；故障模拟的“成功复现”不表示产品行为通过。
- 上轮“fetch 抛错已修复”“非 iOS 帧调度与早期诊断已注入”不能合并称为本次设备故障已解决：当前 zip 已无该 fetch 抛错，但缺少早期诊断和宣称的非 iOS 分支补丁。当前包与截图版本的对应关系尚未建立（§14.2）。

---

### 11.10 执行交接设计细化（2026-11-02）

本轮用户要求详细拆解并交给其他 Agent 执行，同时核对需要用户补充的账号/AppID、图片、音频等资料。交付为 §15—§17：48 项子任务、共享契约、可复制提示词与资料清单；同步更新 AGENT.md/README 入口。**本轮仍只维护文档，未实施整改、未重跑游戏测试或构建、未修改包体。** §15 初始状态全部 TODO；§14 的历史复测不自动算作整改验收。用户已授权细化方案，不等于已授权未来上传/提审或对外发工单。

---

### 11.11 独立复核（2026-11-03）：尚未完成，R12/R30 退回整改

本次为检查请求，只复核实现、运行测试并维护状态，未修复生产源码、未提交或发布。执行 Agent 原台账为 18 DONE / 11 READY_FOR_QA / 19 TODO；独立复现以下两项失败后，将 R12、R30 退回 TODO，现为 **16 DONE / 11 READY_FOR_QA / 21 TODO**。此前通过证据保留，但不能覆盖新增失败。

**实际通过**：`npm run typecheck`、`npm run typecheck:ui`、`npm run lint`；完整 Vitest 49 文件 / 412 测试通过；用独立本地服务重新执行 `tools/shot-r30.cjs`，43 项断言 / 27 张截图 / 0 pageerror 通过，报告在 `evidence/recheck-20261103/r30/r30-report.json`。这些断言覆盖既有用例，不证明未知提交后的连续命令安全或文字布局正确。

| 复核编号 | 级别/任务 | 已复现失败、根因及整改验收 |
|---|---|---|
| REVIEW-20261103-01 | P0 / R12，回归关联 R38 | 存储实际写入活动指针后回调报错，真实投资命令返回 SAVE_UNAVAILABLE；磁盘 revision=12、现金 277,027、资产 10,000，内存仍 revision=11、现金 287,027、资产 0。未重启直接修改经营策略，下一命令成功，却以 revision=12 覆盖磁盘，投资与幂等记录消失；重新读档仍为资产 0。GameStore 从旧内存生成 draft；SaveRepository 随后 reconcile 成功却未把已提交状态/版本同步回 Store，也未拒绝旧基线。必须在恢复状态与版本前阻止新写入，或恢复后重新校验并执行命令；回归同时覆盖实际写成功后报错/写入前失败、同命令重试/不同命令连续操作、不重启及重启。复现脚本 `evidence/recheck-20261103/review-transaction.cjs`；实际结果 `transaction-review.json`。仅注入内存存储故障，未修改真实玩家存档。 |
| REVIEW-20261103-02 | P1 / R30，回归关联 R39 | 375×812 实际 UI 调岗后，“调岗下月生效→客服部（当月仍按原部门计薪）”自动换行，与薪资行重叠约 13.92 逻辑单位，并超出固定 76 高卡片约 12.21 单位。AppView 的固定卡片高度/行距未随 RESIZE_HEIGHT 文本增长调整。应重新安排状态展示与卡片布局，并验证虚拟列表的高度/定位一致；不能只检查字符串存在。独立截图 `evidence/recheck-20261103/talent-transfer-overlap.png`；几何读回 `ui-layout-review.json`；复现脚本 `review-ui.cjs`。 |

**发布仍未验证**：现有 `build/TapBuild/game.zip` 仍为原包（5,499,092 字节，SHA256 `05E946662B9CE5CE761A0BC751272833FE53A038796E7646F143C15415C43730`），本次没有生成新 Tap 包，没有重跑平台云测或 Android/iOS 真机。不能据 Web 结果认定原兼容性失败已解决。R08/R09、R31—R47 尚未完成；排行榜、历史年报、全流程/视觉/性能/设备验收等继续以 §15.2 为准。

建议交接顺序：先修复 R12 数据覆盖问题，再修复 R30 布局并补对应断言；随后继续 R31 等任务及平台门禁。完整独立复核证据位于 `evidence/recheck-20261103/`，不能以 412 测试全绿替代本节已复现的 FAIL。

---

### 11.12 未完成工作详细设计交付（2026-11-03）

本轮用户要求为执行Agent定制详细实施设计、判断重新打包条件并给出提示词。已基于当前源码、构建脚本、§11.11复现与当日官方文档补充§15.11（10个专项小节）、§16.5完整提示词、§17.5分层条件表，并同步README入口。细化了R12恢复前禁止旧draft写回、R30等高布局与复用、11项QA补验、R31—R40产品/验证、真实构建负例与manifest、设备/云测/资料/授权条件；覆盖全部未完成/待QA工作，不新增第二套任务编号。

本轮仅修改方案文档与README，核对UTF-8、章节、任务计数、引用路径及当前可打开官方链接；没有修改生产源码、重跑业务测试、构建新包或进行上传/提审。当前16 DONE / 11 READY_FOR_QA / 21 TODO不变。后续实施优先使用§16.5，不因方案写完把任何任务自动标DONE。源码发现的排行榜读取副作用/100年裁剪计数、构建脚本检查不足等列为专项核查，尚未在本轮宣称修复或关闭。

### 11.13 发布整改实施进度（2026-11-03，用户要求暂停时）

本轮按 §15.11.2 先处理数据安全和人才布局，再验证本地构建链、专项 UI、性能和财务模拟。用户要求暂停后未继续排查最终 ZIP 校验问题；没有上传、云测、提审、上线、Git提交/推送或生产数据操作。以下结论替代此前“R12/R30仍失败”的**当前状态**；§11.11 保留独立复核发生时的历史事实，不改写当时失败记录。

| 范围 | 当前已验证事实 | 当前缺口/状态 |
|---|---|---|
| R12 / P0 | 在活动指针写入成功、写回调随后报错后，不重启直接发另一条经营命令：先恢复磁盘已提交状态，再执行新命令；投资¥10,000与资产保留、revision 从12增至13、方针GROWTH保存，journal清除，重载一致。正式集成回归覆盖同commandId重试和槽写前失败。复现后 `lostCommittedInvestment=false`、`revisionReused=false`。证据 `evidence/recheck-20261103/transaction-review.json`、`evidence/m3/TASK-M3-09-R12/attempt-02/`。 | 独立复核指定缺陷已关闭；R12-N04—N10、迟到底层写、未决时关司/结算/时钟等需在R38/R41继续。当前R12保持IN_PROGRESS，不把局部回归说成完整故障矩阵。 |
| R30 / P1 | 当前Web构建复跑45项/0失败/0页面错误/27截图，包含375×812、360×640、390×844；几何读回调岗状态与薪资相交0、状态在卡片内；实际点击调岗/裁员/确认/取消；员工100末屏和详情姓名/月薪匹配，12卡虚拟池循环、回顶无串号；真实等待62秒后过期token拒绝，余额不足点击不改状态。已打开查看关键截图。证据 `evidence/m3/TASK-M3-09-R30/attempt-07/`。 | 独立复核布局失败已关闭；设备字体与触控仍待U05/U06/U10。 |
| R31/R32 | 最新可用Web构建实操5项通过、0浏览器错误：年限榜/我方详情/只读revision、旧年现金流缺失提示、年报导航只读；report fixtures已标明为密封测试年报。现金桥领域/Facade集成回归检查活动指针、信封、ledger、年报、journal和新Facade重载。证据 `evidence/m3/TASK-M3-09-R31-R32/attempt-11/` 与集成测试。 | UI夹具不是完整领域边界；100年以上、所有tie-break、更多旧档与现金流组合仍待验，R31/R32保持IN_PROGRESS。 |
| R33 | 设置面板真实点击、音频开关落盘、音频存储失败回滚并显示提示、公司revision不变、教程重播不改run/revision：6项通过，0浏览器错误，截图已开查看。证据 `evidence/m3/TASK-M3-09-R33/attempt-09/`。 | 离线摘要与实际救助UI、前后台音频恢复及单资源解码失败尚未实测，保持IN_PROGRESS。 |
| R34 | Chrome/WebGL 375×812、6员工、每档20秒：1×/2×/5×各180次存档键写入/分钟，暂停0；帧p95约16.8ms，无>50ms帧；节点62；首次可交互2630ms。证据 `evidence/m3/TASK-M3-09-R34/attempt-03/`。 | 仅浏览器诊断，无30分钟soak、Tap进程帧率/内存或U04同机对照；PARTIAL。 |
| R35 / E2E | `CanvasDriver`用于R31—R34实际点击和几何，驱动器单测验证故意失败、pageerror与非favicon请求失败会被记录。 | 通用状态报告/强制未完成项非零、故意遮挡/禁用/资源破坏/布局重叠检测及正式构建无开发写状态入口未完整闭环，IN_PROGRESS。 |
| R40 | 100 seeds × 3行业 × 3策略共900次、每次完整60月；现金守恒/月差/年桥错误均0、不完整0、救助0、月自动招聘上限1、年上限实测最大2。修复首月自动招聘已付款基线重复计入导致年桥差额的根因。JSON/CSV证据 `evidence/m3/TASK-M3-09-R40/attempt-01/`。 | 120年/100份年报裁剪、整数边界及极值长跑仍未覆盖，PARTIAL。 |
| R19/R20 | `m3-20261103-diag-e/01`使用Cocos Creator 3.8.8实际构建：进程退出码36、build Task完成标记、唯一新鲜`game.json`；Tap转换0退出码；补丁required锚点各命中1次且PATCH_OK；最终重打包REPACK_OK。实际CLI stdout/stderr、CLI结果、转换/补丁/重打包日志均保存在 `evidence/m3/build/m3-20261103-diag-e/01/`。 | 仅完成诊断流水线阶段，正式身份未核；并非产品测试候选。 |
| R21 / 包体 | 对本次最终ZIP逐条读取校验后实际FAIL：缺`application.js`；`game.js -> application.js`引用缺失；`assets/main/index.a4e34.js`含`EditorMockPlatform`。包大小5,152,130字节，SHA256 `63e0a348340c4313b3c40913438574f7fe535f619b35889931455b23f22c3094`。机器报告在 `evidence/m3/build/m3-20261103-diag-e/01/manifest.json`，失败详情在`verify-package.log`。 | 此SHA仅标识**校验失败的诊断ZIP**，不能作为候选包使用。流水线未进入增强manifest步骤；包不得交给真机/云测。必须定位转换入口与生产profile/Mock残留，再用全新releaseId重建。 |

全量本地门禁在最新业务源码（AppView音频失败回滚与1秒持久化tick调整后）运行：`npm run check` 结果51个测试文件通过、420 passed、1个opt-in证据导出测试跳过；R40导出用例单独启用后1 passed。发布流水线Node子进程日志捕获与真实GUI Creator CLI等待方式另做语法核验；在`diag-e`运行实际验证链发现R21失败，因此当前完整候选门禁为**FAIL**，测试总数不能覆盖此失败。`diag-e`源码目录与失败ZIP、旧的diag尝试均保留，不清理、不复用。

**本次暂停时分层判断**：本地专项：R12指定复现与R30指定复核通过，全部L0仍未完成（R33/R35及R36—R39等未完）；包体：新鲜真实构建成功但静态包体验证失败，无可用候选；真机：未测；云测：未测；可提审：不具备（L0/R21、官方身份与资料不足）；已上传或发布：否。

**恢复后首项**：分析`verify-package.log`指出的production Mock残留和Cocos/转换器双入口不匹配，补正式FAIL回归；通过后用新releaseId从Creator重建并验证每个资源引用、正式profile、禁开发hook、CRC/路径、最终ZIP SHA与manifest。随后继续R35、R31—R40缺项，再完成R36—R39和L1总门禁，不跳到R31以后的编号来绕过前序失败。物理设备并非本地工作的前提。

**外部待补按 §17.5 编号**：U01正式小游戏ID/字段来源，U02旧失败包与当前版本对应；U03 Redmi/vivo日志，U04两项性能指标/阈值/机型；U05/U06测试机型、OS/Tap版本与调试配合；U07公开隐私信息/政策地址，U08主体/备案等后台状态，U09资源授权来源，U10目标设备范围，U11候选对应真实游戏的实机截图/录屏，U12上传/提审/发布授权。此前明确未授权的外部操作继续保持禁止。

### 11.14 发布整改继续记录（2026-11-03，R21本地闭环）

恢复执行后先沿R21失败证据修复构建验证链，未覆盖或删除`diag-e`失败包。根因是Cocos入口文件名带哈希而校验器只接受`application.js`，且测试平台Mock作为`assets`模块被Creator打入主脚本。现在校验器从`game.js`解析真实应用入口与直接相对引用；`EditorMockPlatform`/`MemoryStorage`及meta已移至`tests/helpers/`，并增加包卫生测试。

正式回归：`npx vitest run tests/tools/releasePipeline.test.mjs tests/unit/packageHygiene.test.ts` 为16/16通过，覆盖哈希应用入口正例和嵌套Mock包体负例；`npm run check` 为51个文件通过、423 passed、1 skipped。负例日志中的`PATCH_FAIL`/`VERIFY_FAIL`/`REPACK_FAIL`是预期注入并由测试断言，不代表流水线失败。

新流水线使用Creator 3.8.8真实执行，命令`npm run release-build -- -ReleaseId m3-20261103-diag-f -GameVersion 1.0.0 -Attempt 01 -Purpose diagnostic`，没有跳过构建。Creator退出码36并有完成标记/新鲜产物；转换0、补丁/重打包/包体验证/manifest增强均成功。最终ZIP：`build/release/m3-20261103-diag-f/01/game.zip`，5,150,854字节，452项，SHA256 `16e0685d51defa34f76f35eb6441849468c8c716d1f7d9cff977e0a3fd425c38`；再次独立读ZIP及CRC/长度、profile、入口引用、禁用Mock/开发写hook后结果一致。manifest为`evidence/m3/build/m3-20261103-diag-f/01/manifest.json`，记录Creator/插件版本、源码摘要、配置摘要、步骤状态和日志。

`m3-20261103-diag-f`的purpose明确为`diagnostic`。R21本地静态包体验证关闭；它不是可上传产品测试候选：R33/R35/R36—R39及完整L0仍未完成，U01/U02正式身份与版本对应未核实。未运行真机/云测，未上传、提审或发布。继续执行§15.11.2后续本地批次；本节不把历史`diag-e`失败改写为通过。

本次继续执行R35/R33：CanvasDriver现在报告PASS/FAIL/SKIP/BLOCKED/TIMEOUT计数，任一非PASS都使验收状态FAIL、exitCode=1，非法状态直接报错。`npx vitest run tests/tools/canvasDriver.test.mjs` 6/6通过，覆盖FAIL、pageerror/HTTP错误、SKIP/BLOCKED/TIMEOUT和非法状态。以本机Web构建做真实Canvas交互回归，R33设置/音频/教程6项通过、浏览器错误0，检查了音频写失败截图；明细见`evidence/m3/TASK-M3-09-R33/attempt-10/`。该变化尚未证明R35完整完成：故意遮挡/禁用/缺资源/重叠侦测和生产hook隔离仍需实测。

驱动器改动后重新执行`npm run check`：typecheck、typecheck:ui、lint均通过；51个测试文件通过、1个opt-in证据导出测试跳过；427 passed、1 skipped。`PATCH_FAIL`、`REPACK_FAIL`、`VERIFY_FAIL`来自包流水线负例夹具，均被对应断言捕获。该结果验证当前源码回归，不替代R35尚缺的检测能力，也未触发新构建。

---

### 11.15 本轮验收、素材接入与广告设计交接（2026-11-03）

本次验收工作已完成，**上一轮全部整改不予总体验收通过**：427测试/1跳过，R30现有45项、R31/R32的5项、R33的6项专项浏览器复跑通过；原未知投资覆盖及状态压薪资两项指定复现已修复；但另发现R30首卡与第二行筛选热区重叠8单位（实际几何与截图），R30退回IN_PROGRESS。R34/R40的PARTIAL按项目合法状态收敛为IN_PROGRESS，不改变其局部通过事实；R21标DONE但证据范围仍仅为本地诊断包静态验证。原48项现为19 DONE / 8 READY_FOR_QA / 8 IN_PROGRESS / 13 TODO，具体以§15.2为准。没有新的真机/云测/提审/发布结论。

用户新增9:20素材49PNG/37SVG已清点，49PNG逐一解码与CSV哈希匹配；仅将无字通用背景按原字节复制到resources/backgrounds并真实接入UI，保持动态控件。新Web构建成功，四视口16断言及故障fallback补验通过，关键截图已查看；素材改动后再跑完整门禁仍427通过/1跳过。烘焙78%的启动稿与整屏UI稿未盲目覆盖，原因和下一步处理见§18.2—18.4。旧diag-f ZIP不包含本次新资源，不冒充新候选。

用户已确认广告限定规则，作为DEC-040/041记录并同步AGENT范围例外；§18形成统一验收、资源、广告API/场景/状态机/日额度/招聘事务/隐私/测试/缺资料设计及12项专项任务，执行提示词在§18.10。广告本轮仅设计，尚未实现或启用，公开广告配置/真实位/后台资料仍需核实。证据入口 `evidence/acceptance-assets-ads-20261103/acceptance-summary.json`。

本次只修改必要背景接入源码/资源与文档、运行本地验收/Web构建；未修改经营/广告业务源码，未提交推送、未上传、提审或发布。后续从R30新布局失败、原任务剩余缺口开始，再按§18.9推进广告与同包验证。

#### 本轮续行记录（2026-11-03）

已修复R30第二排筛选与首卡108单位卡片相交8单位：`listTop`从实际筛选行数、44单位热区、8单位间隔与卡高计算，不再写死170。当前Web构建的完整R30 E2E为45项通过、27截图、0失败、0页面错误；覆盖375×812、360×640、390×844、0/2/10/30/100人、筛选、详情、调岗、裁员、过期/不足额与虚拟列表复用。独立几何复核在375×812和375×834均为交叠0、间距8；375×834实际打开详情并检查截图。证据：`evidence/m3/TASK-M3-09-R30/attempt-08/`、`attempt-09/`、`attempt-10/`。R30本地Web状态已完成；R39完整视觉矩阵与真机字体/触控仍未完成。

本轮`npm run check`通过：51个测试文件通过、427 passed、1 skipped（导出证据测试按设计跳过），包含R12相关故障回归及900组合×5年月模拟。此结果不关闭R12 N04—N10及迟到底层写/强杀恢复，也不代表R31—R40全流程、30分钟性能或R39视觉验收已完成。新版无字背景保留，烘焙78%启动稿未接入。

广告范围仅完成规则与依赖盘点，**广告Provider、会话/券存档事务、Facade发券/用券及UI均未实施**；生产广告保持disabled/不存在，不得表述为接通。U14真实普通小游戏广告联盟能力/广告位、U15联调方式与后台主体状态、U16联盟政策及广告版隐私资料待核；隐私正文暂未虚构SDK数据处理内容。M3-10-07—11继续TODO，M3-10-05为IN_PROGRESS（R30局部修复通过，R39全矩阵未完成）。

本轮最后以全新releaseId完成诊断构建并做ZIP/manifest静态核验；由于R12/R31—R40及广告本地事务缺口，purpose保持`diagnostic`，不是产品测试候选。releaseId `m3-20261103-r30fix-diag`，version `1.0.0`，ZIP `build/release/m3-20261103-r30fix-diag/01/game.zip`，5,153,557 bytes / 457 entries，SHA256 `8a97692b220ccc1c70423f8279a248ad7a037498814349c3edd9599bdc5fea23`。manifest `evidence/m3/build/m3-20261103-r30fix-diag/01/manifest.json`；Cocos Creator 3.8.8构建exitCode 36（该项目记录的成功码），转换/补丁/重包/ZIP校验/manifest均exitCode 0，`VERIFY_OK`。逐步日志在同目录。此构建不修改旧`m3-20261103-diag-f`。未执行真机、云测、上传、提审或发布。

---

### 11.16 R30修复及新诊断包独立验收（2026-11-03）

本次为用户要求的成果验收，未修改生产源码、未重新构建或上传。结论：**本轮声称完成的R30筛选/首卡布局修复、无字背景入包与诊断ZIP静态交付通过；“整改补验＋素材＋广告”整体仍未完成。**执行报告主动列明的未完成事项与当前仓库相符，不能改称全部开发完成。

- 独立执行 `npm run check`：类型/表现层类型/lint通过；51文件通过、1文件跳过，427测试通过、1 opt-in导出测试跳过。不是428全通过。日志 `evidence/reaccept-r30-20261103/check.log`。
- 独立重跑当前 `tools/shot-r30.cjs`：45断言/27截图/0失败/0 pageerror，包含真实62秒令牌过期路径，报告 `evidence/reaccept-r30-20261103/r30/r30-report.json`。
- 专用几何及点击复验375×812、375×834、360×640、390×844：第二排筛选下边缘至首卡上边缘均为8逻辑单位，无相交；各尺寸实际点详情显示正确员工，revision不变，背景已加载，0浏览器错误；关键截图已打开查看。报告 `layout-report.json`。本次指定REVIEW-20261103-03关闭，R30维持本地DONE；R39全页视觉矩阵及真机触控仍未关闭。
- 从最终ZIP独立校验CRC、条目、入口、profile、资源引用等，`VERIFY_OK`；字节数5153557、457条目、SHA256 `8a97692b220ccc1c70423f8279a248ad7a037498814349c3edd9599bdc5fea23` 与交付manifest一致。实际找到与源图SHA一致的无字背景，且编译后的 `assets/main/index.c35d1.js` 含按筛选行数计算首卡位置的公式。本地变量经Creator重命名，不能用原变量名文本搜索缺失判为功能没入包；已查看编译函数。证据 `package-content.json` / `compiled-ui-snippet.txt` / `package/`。
- 包路径 `build/release/m3-20261103-r30fix-diag/01/game.zip`，purpose为diagnostic，version1.0.0。本次只审已有Creator构建结果与最终包，不把Web测试当Tap运行验收。旧diag-f未被本轮覆盖；无真机/云测/上传/提审/发布证据。

当前原48项状态为20 DONE / 8 READY_FOR_QA / 7 IN_PROGRESS / 13 TODO。R12完整N04—N10及迟到底层写/重开仍缺；R31—R40完整流程、视觉、30分钟性能及长期边界仍有未完成；含78%的启动稿未接入；源码尚无广告Provider、完成会话/券奖励事务或广告UI。真实广告位U14—U16缺失仅阻塞真实广告联调与启用，不阻塞依§18先完成默认disabled实现、开发Fake故障与财务回归。下一步应继续已授权执行会话的这些代码和验证任务，不能因诊断包生成而转入产品候选放行。

机器汇总 `evidence/reaccept-r30-20261103/acceptance-result.json`。§11.15/§18.1保留当时失败的历史事实，最新指定缺陷状态以本节与§15.2为准；未因本轮专项通过升级其它任务。

**按§19执行进度更新（2026-11-03）**：A恢复统一入口的局部修复已实现，关闭公司与普通命令共用恢复闸门、expected-base冲突不重放、原生迟到写fence及显式状态/重试API已有回归；R12 A-01—10完整矩阵仍未完成，不能升级DONE。B—E本地已有默认disabled配置、同意后加载Provider、持久化session协调、完成回调发券、共享日额度、免一次招聘费同Store事务及可跳过提示/招聘入口。Fake/状态/招聘专项14项与恢复专项56项通过；完整`npm run check`为55文件通过、1文件skip，442 passed/1 skipped。证据在`evidence/m3/TASK-M3-09-R12/attempt-03/`及`evidence/m3/TASK-M3-10-07/attempt-01/`至`M3-10-09/attempt-01/`。

全新本地构建`m3-20261103-adlocal-final-r3/01`：`buildExitCode=36`并有Creator完成标志，转换/补丁/打包/校验/manifest步骤均退出0，ZIP `build/release/m3-20261103-adlocal-final-r3/01/game.zip`，5,160,461字节，SHA256 `5b535767431ebd1772ae0716883f03264d214a06196fa9111ecb4a801f2eae55`，458条目，manifest `evidence/m3/build/m3-20261103-adlocal-final-r3/01/manifest.json`，purpose=diagnostic。资源UUID读回确认无字背景及ads.config进入包；默认配置enabled=false、privacyReviewed=false、deviceVerified=false、adUnitId为空。此包只证明本地构建包体，未设备/云测。

本轮广告真实接通/启用为BLOCKED：U14真实广告位及联盟能力、U15后台联调/主体状态、U16SDK政策与广告版隐私材料均未核；未改写隐私正文以避免捏造实际处理信息。U05/U06/U10真机、R31—R40完整E2E/视觉/30分钟性能/120年长期测试以及无假78%启动稿处理仍未完成。没有上传、提审、发布。

---

### 11.17 剩余工作操作手册交付（2026-11-03）

用户要求详细到可直接执行，已在§19将§18设计继续细化为A—J操作顺序、现有/新增文件、恢复闸门与native写fence、广告Provider类型与Fake、会话/券状态、Facade命令、同事务招聘、跨日/重开、隐私与前后台、R31—R40补验、启动艺术采样、实际与待实现命令、包体和外部门禁，并提供§19.15执行提示词。原R30指定修复仍视为已通过，不要求执行者从头重复。

本轮读取当前源码与官方激励视频/审核文档，发现并在手册中明确：关闭公司走独立Store入口需要恢复闸门、clockTick失败水位处理待完善；排行榜基本只读/年限和现金桥字段已有，应补验而非重复新建；模拟导出硬编码旧attempt需先参数化避免覆盖。上述为后续实施点，未在本轮修改生产代码。只修改总览/README入口并核路径、章节、状态及编码，未重跑业务测试/构建、未上传/提审/发布。原48项20 DONE / 8 READY_FOR_QA / 7 IN_PROGRESS / 13 TODO不变。

---

### 11.18 §19剩余整改与广告本地执行（2026-11-03）

本次继续按§19 A→J，保留历史失败证据与R30指定修复通过状态。恢复闸门/关闭公司共用入口、expected-base冲突、未决原生写入fence、时钟结算持久化边界及广告默认disabled实现已有新源码与回归；最新完整`npm run check`为56个测试文件通过、1个skip，456 passed / 1 skipped，日志`evidence/m3/TASK-M3-10-12/attempt-03/npm-check.log`。R40新增120年/1440月存档读回、保留最近100年报和财务桥测试通过，证据`evidence/m3/TASK-M3-09-R40/attempt-05/longrun120.log`；原900-run×60月仍通过。R31/R32最新Web流程5/5通过，R30不重做。R34固定100员工/6部门30分钟浏览器压测正在执行，实时证据位于`evidence/m3/TASK-M3-09-R34/attempt-04/soak-output/`，完成前不判PASS。

已接入不含烘焙“78%”的无字启动艺术层，旧素材留存，实际进度单独绘制；新Web构建首屏截图与脚本校验0浏览器错误，截图见`evidence/m3/TASK-M3-09-R35/attempt-04/splash/`。真实Tap广告仍默认关闭。关闭企业、重试恢复、日共享额度、唯一完成回调、同draft免一次招聘费的实现均不代表完整AppView故障/生命周期或设备验收通过。R12 A-01—10、R38完整故障矩阵、R33最新设置E2E、R39四尺寸全页/长文视觉、R34完成的30分钟压测仍有未验项；没有改黄金预期或删除断言。

**本地Web/代码测试**：`npm run check` PASS（56 files; 456 passed, 1 skipped）。R31/R32 5/5最新浏览器E2E PASS；R33当前版本未复跑；R30指定布局不重验。Web首屏已查看干净艺术层截图。Cocos Creator web-mobile实际构建退出码36且完成标志为真，静态服务和当前R31/R32 E2E证据`evidence/m3/TASK-M3-09-R35/attempt-04/`。R34仍运行中，未有内存稳定性或Tap生命周期结论。

### 分层结论（截至本节记录时）

- 本地功能/数据：PARTIAL；全量代码门禁通过，R12/R30/R31—R40组合验收未全关。
- 包体：待新releaseId最终构建；先前r4是旧诊断包且仍含旧`splash.jpg`，禁止作为本轮交付候选。
- 真实广告/设备/云测：BLOCKED / NOT_RUN。U14—U16广告位、主体后台、真实SDK/政策仍缺；U05/U06/U10设备条件和云测均未执行。
- 可提审：BLOCKED；没有上传、提审、审核或发布。

M3-10-04现为本地干净艺术层和Web首屏验证完成、Tap首屏仍待验（IN_PROGRESS）；M3-10-06继续IN_PROGRESS；07—09本地实现与局部回归完成但全矩阵/视觉验收未完（IN_PROGRESS）；10受U14—U16阻塞（BLOCKED）；11本地部分通过、R34及其他完整矩阵未完成（IN_PROGRESS）；12待生成全新包，且仅可诊断交付（BLOCKED）。详见§19.16及任务表。旧diag-f、r3、r4均不含本轮最终代码/图片组合，不作新候选。

### 11.19 R33/R34续验结果（2026-11-03）

R33当前Web设置流程实际运行`tools/e2e/r33-settings.cjs`，6/6 PASS、浏览器错误0；含设置面板实际点击、音频偏好写入与失败回滚、公司revision不变、教程重播不重置run，截图已打开检查。报告`evidence/m3/TASK-M3-09-R33/attempt-02/e2e-report.json`，本次命令`attempt-02-run.log`。此项补齐旧快照“当前版本未复跑”。

R34浏览器长跑脚本跑满30分（测量1802690ms，180×10s样本），固定100员工/6部门夹具加载及结束存档回读均PASS，错误0，存档revision 161；节点数63—71，监听器0，按样本帧时延p95约16.85ms，6个>50ms帧，Chrome堆26—60MB范围且末值约55MB。完整数据`evidence/m3/TASK-M3-09-R34/attempt-04/soak-output/soak-performance-report.json`。这是单次Chromium/Web固定夹具长跑；没有前后优化基准、对象分配统计或Tap native内存/FPS/后台生命周期验证，R34与R41仍IN_PROGRESS。

### 11.20 全新r6诊断包、包内素材负例与本地最新结论（2026-11-03）

全新`m3-20261103-adlocal-final-r5`在首次包后读回时发现转换器把旧烘焙进度图改名保留为`splash.d49ca.jpg`；静态负例退出码1及证据`evidence/m3/build/m3-20261103-adlocal-final-r5/01/postbuild-legacy-splash-negative.log`留存，不交付r5。`tools/patch-release.cjs`现按旧图SHA剔除转换器哈希名产物；`tools/verify-package.cjs`也拒绝相同字节的改名图。流水线测试新增两条回归，10/10通过；最新全量`npm run check`为56文件、457 passed、1 skipped，日志`evidence/m3/TASK-M3-10-12/attempt-04/npm-check.log`。

中间本地诊断包`m3-20261103-adlocal-final-r6`的ZIP静态校验PASS，游戏版本`1.0.0`，Creator`3.8.8`、Tap插件`1.2.2`，ZIP 4,603,533 bytes/458条目，SHA256 `94cacb9c4b942c96907d24f4578307eb19800fca2397f76b62f1d5cdd2f541a5`。包内无字艺术层，字节检查无旧烘焙进度图，广告配置disabled/ID空。后续清单读回发现Git默认转义Unicode路径，导致r6 manifest遗漏权威文档哈希；该缺陷证据`evidence/m3/build/m3-20261103-adlocal-final-r6/01/unicode-manifest-readback-fail.log`保留。r6不作为最终交付，必须用NUL原始路径修正后的工具和新releaseId重建。

### 11.21 Unicode manifest路径修正与最终重建（2026-11-03）

新增`tools/lib/git-dirty-paths.cjs`改用Git `-z`原始UTF-8路径，`tools/enrich-manifest.cjs`已切换该解析。覆盖中文已跟踪修改与未跟踪文件的回归通过，流水线专项11/11 PASS；全量`npm run check`为56个测试文件、458 passed/1 skipped，日志`evidence/m3/TASK-M3-10-12/attempt-05/npm-check.log`。r6的Manifest Unicode遗漏保留于失败证据，不覆盖。

最终诊断包`m3-20261103-adlocal-final-r7`已用全新releaseId真实构建。version`1.0.0`，Creator`3.8.8`/Tap插件`1.2.2`；Creator exitCode36+doneMarker，转换、补丁、重打包、校验、manifest均退出0。ZIP `build/release/m3-20261103-adlocal-final-r7/01/game.zip`，4,603,532 bytes/458 entries，SHA256 `f577f15ac362b2b6daffea8a99729421797f1b7b8a5e9da31468be7789798428`；manifest `evidence/m3/build/m3-20261103-adlocal-final-r7/01/manifest.json`，`VERIFY_OK`且missing/forbidden/refs均空。读回确认`dirtySourceSha256`含`docs/我是CEO_项目总览.md`且当前哈希匹配；无旧烘焙JPG（补丁日志删除`splash.d49ca.jpg`），包中有`splash-art.png`与真实进度脚本。广告config为disabled、adUnitId空、privacyReviewed/deviceVerified=false。purpose=`diagnostic`，不能作为产品候选。

**最新分层结论**：本地代码门禁PASS；R33当前Web 6/6 PASS，R31/R32 Web 5/5 PASS，R34单次30分钟浏览器固定夹具运行PASS，R40 120年边界PASS，Web启动图已目视检查；R12完整故障矩阵与R39四尺寸全页面/长文视觉仍未关闭，综合本地验收PARTIAL。包体生成与静态校验PASS（仅disabled诊断包）。真实广告联调、U05/U06/U10设备与云测BLOCKED/NOT_RUN；U14—U16未提供，隐私广告政策未能按实际SDK更新。可提审BLOCKED；未上传、未提交审核、未上线。

### 11.22 项目skill复核与广告/上传包收口设计（2026-11-04）

用户本轮要求结合`skills`检查进度并交其他agent开发。本轮读取`taptap-mini-game-publisher`及对应参考、广告/存档/招聘/UI/发布工具源码，重查官方广告/API/上传/审核资料，新增§20详细执行契约及§20.13完整提示词。未修改生产实现、未重新构建、未上传或提审。

独立`npm run check`为56 files PASS/1 skipped、459 tests PASS/1 skipped；r7复验4,603,532bytes/458entries/hash匹配，skill预检3 PASS/0 FAIL/1物料WARN。最新R39 attempt-04四视口均已FAIL（从排行页找设置），并目视发现360×640排行金额被详情按钮遮挡。源码探针复现只读查询修改旧档、日期回拨可额外领券、未加载show失败后栅栏不释放。其余Provider/首启60秒/生命周期/隐私/跨run券与完整故障矩阵缺口见§20.3。证据写`evidence/planning-release-20261104/`，不覆盖r7原manifest或历史失败。R30指定布局及其它既有专项保留，未冒称本轮全部重验；生产广告启用、平台设备/云测、可提审仍BLOCKED/NOT_RUN。

### 11.23 玩家备份/跨设备与真实玩家榜设计交接（2026-11-04）

用户明确确认只需玩家自己的备份/跨设备恢复、不做运营后台查询，并确认增加真实玩家榜、保留本地模拟榜。已新增§21完整设计、TASK-M3-11-01—14（均TODO）、DEC-042—044及AGENT有限范围例外。读取实际本地存档/登录/可选server骨架/平台类型，调用TapTap MCP云/榜指南及应用/环境查询；当前未授权/未选游戏，实际账号云/榜能力及配额待核。官方云API可用文档已核，教程失效链接/删除详细签名等缺口明确标VERIFY。§21.17列本人后台操作，§21.18给完整执行提示词。本轮只修改文档/范围规则并保存文档验证结果，不实现生产云/榜、不部署服务器、不创建/删除远端资源、不重新打包、不上传/提审；前一轮测试结果不作为本轮新功能验收。

### 11.24 UI布局及详情生命周期分析与合并交接（2026-11-05）

用户补充按钮大小/对齐/遮字及详情3—5秒自动关闭，要求与云/榜合并设计。读取最新AppView/UiFactory/dialogs和§21.20已有实现，应用ui-ux-pro-max规则并在最新现存Web预览复现：5×员工详情3802ms消失，同时第1月→第2月/revision13→17、浏览器无错；证据`evidence/planning-ui-20261105/attempt-02/`。根因是月结render经clearRoot销毁包含modal的全部root子节点；布局还存在固定坐标与RESIZE_HEIGHT/工厂修正尺寸不一致。新增§22完整方案、10项M3-12任务、DEC-045/046和§22.16合并提示词。只分析/复现/写文档，未改生产UI/业务源码或新打包；不把本次FAIL复现当修复通过。本人外部操作仍按§21.17。

### 11.25 项目目录清理与可恢复归档（2026-11-05）

**任务 `TASK-MAINT-CLEAN-20261105`：DONE。** 用户要求先清理整个工程，再实施既有方案；本次只整理文件和文档，不实施§22生产整改，不重建、不上传、不提审。

- **清理范围**：旧release批次、最新批次01—04中间尝试、旧Web/Tap输出和重复预览、`library/`导入缓存、`temp/`下调试截图/日志/构建临时物/解包目录、空`.screenshots/`和测试缓存。共49个目标、15,164个文件、598,669,501字节（570.94 MiB）移出项目。
- **恢复归档**：`D:\Workspace\TapTap\_archives\我是CEO\cleanup-20261105-073714\`。其中`manifest.json`逐文件记录原路径、归档路径、大小和SHA256；`protected-inputs-before.json`记录6,424个受保护文件。归档后逐项哈希校验通过，保护范围文件在清理前后未改变。未永久删除历史内容；只是降低工作区占用，不是释放同磁盘的总占用。两次未发生移动的清理预检记录收在归档`preflight/`。
- **保留内容**：源码及其未提交/未跟踪实现、tests/tools、依赖、Cocos扩展/设置/profiles、最新49PNG/37SVG及其它独有设计/音频/宣传源、唯一总览及隐私/平台参考文档、全部历史验收证据及脚本依赖的存档种子。保留`temp/declarations/`与`temp/tsconfig.cocos.json`，避免误删声明依赖。未以是否被Git跟踪判断文件是否可删。
- **保留包体**：只保留`build/release/m3-20261104-cloud-rank-r1/05/`及其Tap/Web预览输出。原有被Git跟踪的旧`build/TapBuild/game.zip`也移入归档，工作区会出现该路径的预期删除；未提交这一变更。最新包独立静态复验`VERIFY_OK`，version`1.0.2`，4,617,974字节、462条目，SHA256`ee8466375391acc91197e5e8805e9e8403952eb803149aab5917e6706bec6183`，与既有manifest一致。原manifest的候选purpose不覆盖§22待修缺陷；仍不得将其当作UI整改完成或可提审证明。
- **文档整理**：README删去重复且互相覆盖的历史快照，只保留当前入口、目录、常用命令、保留包和清理说明；旧README原文在归档`README-before.md`。本总览历史章节及全部设计任务保留，§22.16仍是最新统一执行提示词，§21.17仍是用户本人操作清单。专项参考保留原核验日期，不把旧平台资料改称最新规范。
- **验证**：`npm run check`退出0，包含core/UI类型检查、lint、Vitest；62测试文件通过、1文件跳过，477 tests passed、1 skipped。未删除测试或降低断言。未重新运行浏览器/真机/云测，未修复详情自动关闭或按钮遮字。日志及包体复验见`evidence/cleanup-20261105/`。
- **归档后的路径规则**：历史记录中的旧构建路径可能已不在工程内；按`归档根目录 + 原项目相对路径`查找即可，不将历史证据原文改写成新构建路径。默认`build/web-mobile/`已归档，使用`npm run web-build`重新生成后再启动默认预览；当前保留预览可用`node tools/static-server.cjs build/release/m3-20261104-cloud-rank-r1/05/web-preview/web-mobile 8123`。重新打开Creator会重建缓存，首次导入较慢属于预期。
- **恢复原则**：先查manifest，只恢复需要的目标；若工作区同名位置已有新内容，不整体覆盖。源码、账号配置及最新方案无需从归档恢复。本次没有Git提交/推送或外部操作。

### 11.26 三层UI局部提交独立验收及后续设计（2026-11-05）

**结论：局部通过，UI/云榜广告及发布专项未整体验收。** 对象为本地提交`6e85b08`（父`e4500a9`），两文件+65/-16与报告一致。本轮不改生产源码、不提交/推送、不上传/提审/发布。

1. **代码门禁PASS**：独立`npm run check`退出0，core/UI类型、lint及完整Vitest通过，477 passed/1 skipped、62 test files passed/1 skipped。报告所述9项baseline失败本机未复现，不能将其设为豁免。依赖与忽略配置在干净检出的可复现问题有具体设计，见§23.3。
2. **真实引擎构建PASS**：调用现有`run-cocos-build.cjs`，Creator3.8.8，22:23:28—22:28:00，exit36且doneMarker=true。Creator实际输出新`build/web-mobile`，没有采用所传相对buildPath；核对新index时间后转存到`build/review-ui-20261105/01/web-mobile/`，再以8167端口启动预览。未用旧候选冒充新代码。原始命令/日志见`evidence/acceptance-ui-20261105/cocos-web-result.json`及日志。
3. **普通月结保持PASS**：沿用现CanvasDriver，在新源码Web中使用100员工夹具，以重新封装CRC的1亿元现金隔离危机。31次存在采样，最后采样52,772ms，详情节点始终同UUID且parent为ModalLayer；关闭前真实存档累计跨11个月，用户点关闭后才消失，浏览器错误0。结果`evidence/acceptance-ui-20261105/rich-attempt-02/detail-review.json`，截图已打开核看；未把经营暂停来保窗。
4. **现金危机交叉FAIL**：先运行未加现金的原100人/200万元夹具。30,976ms采样中，存档第1月→第6月，员工详情UUID保留，但进入经营困难后新overlay遮住原详情，点击原关闭按钮无效；截图实际看到双层。原始失败报告`evidence/acceptance-ui-20261105/detail-review.json`保留，不被后续隔离PASS覆盖。故不能据节点还存在声称所有阅读体验通过。
5. **源码缺口确认**：disposeApplication无实际业务调用、外毁未清dialogStack、危机重复render风险、Button无parent时Label未挂载、动态disabled闭包、设置固定高、setError正文宽度、TTL过期自动关开仍需处理。员工详情前两footer按钮宽96、中心相距100，仅4逻辑单位间距，未达§22的8；没有完成同级48高/分区布局。
6. **设计交接**：新增§23共13节，约1.3万字；逐文件/分批列出环境、上下文/幂等、快照/预览、工厂/逐页迁移、云榜广告接线、真实几何/负例、门禁/新包、本人操作与完整提示词。原M3-12表以§23.10的新状态续做；§21.20原有PARTIAL不改写为DONE，最新提示词为§23.12。
7. **边界**：本轮没有完整四视口/平板/真机/云测/云榜广告真实接入验收，没有生成新的普通Tap ZIP。所建Web仅独立审查产物。保留旧候选不视为覆盖这次修复；后续代码整改完成需新releaseId打包。

### 11.27 R31 整改与验收结果（2026-11-06）

**结论：本地代码/流程层与静态包层通过；真实平台设备层、可提审层未通过（缺平台条件与授权）。** 未提交、未推送、未上传、未改后台、未提审、未发布。

1. **代码门禁 PASS**：`npm run check` 退出 0，core/UI 类型、lint、全量 Vitest 均通过（493 passed，62 文件）；日志 `evidence/acceptance-ui-20261105/check-final.log`。
2. **真实引擎 Web 构建 PASS**：Creator 3.8.8 实际出包；Creator 忽略相对 `buildPath`，实际输出仍为 `build/web-mobile`（以产物时间核对，不假设目录名生效）。日志/结果 `evidence/acceptance-ui-20261105/cocos-web-final5.log`、`cocos-web-final5.result.json`。
3. **§23.9 矩阵 PASS**：对上述新包（`http://127.0.0.1:8172/`，静态服务 `tools/static-server.cjs`）跑 `evidence/acceptance-ui-20261105/r31-matrix.cjs`，24/24 PASS、browserErrors 0，明细 `evidence/acceptance-ui-20261105/V31-matrix/report.json`。关键数值：部门详情“数据截至：第 1 年 1 月（月结快照）”、更新数据同窗口（modal=1）、设置正文 673.72 > 视口 430 且可滚到 260.55、只读弹窗 revision 11→11；人才滚动锚点 1260→1260、5× 真实跨月 revision 14→28；危机在详情打开期间不覆盖、详情关闭后仅 1 个、忽略后不重复；100 次详情→裁员→取消 max=1 final=1 无幽灵确认；确认 TTL 60 秒过期后原框保留（modal=1），重新预览后现金 2,000,000→1,996,010；几何基线 0 违规，注入 4 个坏布局全部被检出。
4. **四视口视觉矩阵 PASS**：375×812、360×640、375×834、390×844 各 7 项、共 28 PASS，browserErrors 0；截图已逐张打开核对（公司/部门/人才/排行/设置），产物 `evidence/acceptance-ui-20261105/V31-visual-3/`。CSS 测试尺寸不映射真实机型。
5. **本轮修复的实证缺陷**：① 确认框过期/旧上下文提示被 `runConfirm` 的兜底文案覆盖（新增 `handled` 结论标记）；② 过期文案写“30 秒”而领域 TTL 为 60 秒；③ 人才卡“详情”按钮仍 44 高；④ 排行页真实榜状态两行仅折 1 字并压住我方摘要、我方摘要被拆词；⑤ CanvasDriver 依赖 `cc.UITransform` 全局构造器，该构建未暴露时退化为 1×1 假几何（改为组件列表回退，并保留负例自检）。
6. **普通 Tap 候选（未上传）**：`m4-20261106-r31` / 1.0.0 / attempt 01 / product-test-candidate；ZIP `build/release/m4-20261106-r31/01/game.zip`，4,627,082 bytes，462 entries，SHA256 `8637011aa8f57220ad3aff2d0cc9b4413f7483bce91f942b73b65e257c1ebb26`；入口 `game.js`/`game.json` 存在，0 个反斜杠路径，无 `*.pem/*.key/*.env/凭据` 文件与私钥字样。
7. **平台前置条件（BLOCKED/NOT_RUN）**：真机 TapTap 登录与 `profileId`、平台云存档读写与跨设备恢复、真实榜 App 榜 ID 与白名单、激励广告位/配额与真机播放、公开隐私政策 URL、备案/版号材料、后台绑定与提审发布。页面据实显示“未启用/待账号绑定”，云按钮禁用，不以本地模拟榜冒充真实榜。
8. **边界**：以上 Web、几何、ZIP 只能证明本地与静态包；不能据此声称真机广告/云榜通过或“可提审”。外部写操作本轮未获授权，未执行。

## 12. 决策台账

状态含义：**LOCKED** = 玩家已确认不可自行改；**BASELINE** = 首轮测试值，可调但须同步配置/黄金/测试；**VERIFY** = 必须在真实环境核实；**DEFERRED** = 第二阶段不做。

| 编号 | 内容 | 状态 | 当前决定 | 变更原则 |
|---|---|---|---|---|
| DEC-001 | 游戏名称 | LOCKED | 《我是CEO》 | 禁止写《我的CEO》 |
| DEC-002 | 产品形态 | LOCKED | TapTap 普通小游戏、竖屏 2D、触摸卡片 | 平台不支持须汇报差异 |
| DEC-003 | 核心玩法 | LOCKED | 单公司、单初始业务、部门、人才、盈利、排名、挂机 | 不加第二业务 |
| DEC-004 | 经营周期 | LOCKED | 一年为周期，内部 12 月，可加速 | 不改按月为玩家周期 |
| DEC-005 | 管理模式 | LOCKED | 自动经营可手工干预；不得自动裁员 | 手动锁定优先 |
| DEC-006 | 公司关闭 | LOCKED | 玩家主动关闭、二次确认、一切本轮重置 | 不删 TapTap 账号 |
| DEC-007 | 新手指引 | LOCKED | 首次可点击引导、可跳过、可回看 | 首聘 2 人不可跳过 |
| DEC-008 | 行业 | LOCKED | 贸易/软件/企业服务三选一、统一引擎 | 不新增行业 |
| DEC-009 | 人才 | LOCKED | 3 选 1、能力/潜力/性格/工资、招聘与裁员赔偿 | 不做技能树 |
| DEC-010 | 部门 | LOCKED | 主营 + HR/采购/市场/客服/财务 | IT/法务延后 |
| DEC-011 | 排行 | LOCKED | 总资产 + 经营年限本地模拟企业榜 | 不做在线排行 |
| DEC-012 | 亏损 | LOCKED | 不立即破产，允许恢复 | 不强制清档 |
| DEC-013 | 初始资本 | BASELINE | ¥300,000 | 平衡测试后可调 |
| DEC-014 | 时间 | BASELINE | 1× 5 分钟/年、2× 2.5 分钟、5× 1 分钟 | 手感测试后可调 |
| DEC-015 | 离线 | BASELINE | 8 小时/年、上限 3 年、每 40 分钟 1 月 | 防重复结算 |
| DEC-016 | 经营难度 | LOCKED | 单一默认 B 平衡 | 不做 A/C 选择 |
| DEC-017 | 候选工资 | BASELINE | ¥4,000–8,000/月，招聘费 1 月工资 | 平衡测试 |
| DEC-018 | 裁员费 | BASELINE | 月薪 ×1–3 月，按在职年数 | 仅游戏机制，不声称法律依据 |
| DEC-019 | 新设部门 | BASELINE | ¥10,000，0 人无收益 | 不送免费员工 |
| DEC-020 | 事件 | BASELINE | 5 类轻事件、每年 25%、最多一次 | 不做事件链 |
| DEC-021 | 阶段目标 | LOCKED | 连续 3 年利润 > 0 后可继续经营 | 不强制结局 |
| DEC-022 | 救助金 | BASELINE | 每 run 一次 ¥100,000，不计利润 | 调优需复审 |
| DEC-023 | 存档 | BASELINE | 双槽本地、整数元、<500KB/槽 | 改方案需同级可靠性证明 |
| DEC-024 | 部门收益模型 | BASELINE | 员工数边际递减**查表法** | 禁止指数法分叉 |
| DEC-025 | 采购计算 | BASELINE | 贸易可采购 95%，1 名标准员工省 10% | 替代 V0.9 旧 8% 全额口径 |
| DEC-026 | 引擎/插件 | VERIFY→已验证 | Cocos Creator 3.8.8 + taptap-minigame-tools 1.2.2，实际出包 | 换版本须重新出包验证 |
| DEC-027 | Tap 登录 | VERIFY→代码已接入，真机待联调 | `tap.login` → 最小服务端 `POST /v1/auth/taptap/exchange` → 短期 sessionToken；编辑器 mock；失败不阻断单机 | 真机按当期官方文档校准 |
| DEC-028 | 加桌面能力 | VERIFY→已核实 | 普通小游戏无该 API（属 APK TapPlay）；必接项为 TapTap 登录 | 未来发 APK 再评估 |
| DEC-029 | 备案/版号 | VERIFY | 普通小游戏前置备案；无内购当前指引无需版号 | 以后台当期为准 |
| DEC-030 | 包体大小 | VERIFY | 官方“首包 60M+”，内部目标 ≤20MB | 依后台实测 |
| DEC-031 | 交互形态 | LOCKED | 点击/列表/弹窗，不做华丽动画；热区 ≥44 | 不改核心操作方式 |
| DEC-032 | 跨行业/子公司/集团 | DEFERRED | 仅未来想法，不在 MVP | 第一阶段不实现 |
| DEC-033 | 员工调岗 | BASELINE | 已实现（M2-06），非核心依赖 | 若不足可先降级 |
| DEC-034 | 成本部门真实贡献 | BASELINE | 直接减真实基数；HR/财务不得伪造收益 | 需长期验证可选价值 |
| DEC-035 | 发布状态与最新准入证据 | VERIFY | 2026-11-02 以最新报告 Android 2/5 通过为依据；既有“Android 全过/仅鸿蒙失败/完整 E2E 已完成”不能作当前结论 | 修复后须绑定同一 zip SHA256 重验，见 §14 |
| DEC-036 | 包体大小口径校正 | VERIFY | 本轮官方审核规范 §5.2.2 写明 20MB 以下；废止“60M+ 可作为上传上限”的旧判断 | 实施保守字节门禁并复核后台实际口径，不以旧宣传介绍代替审核规则 |
| DEC-037 | 登录实现与文档差异 | VERIFY | 现有无端点分支为 tap.login + 本地标记；服务端交换为可选。30 天本地 TTL、checkSession、正式包错误降级须补验 | 不擅自新增账号体系、云存档或强制后端；以平台验收校准 |
| DEC-038 | 发布整改任务与技术契约 | BASELINE | §15 作为 §14 的执行细化；用 R00—R47 子任务追踪，不覆盖历史 M0—M3 记录 | 保留存档 schemaVersion=1 与经济基线；必要新增持久化元数据须兼容旧档并有崩溃测试 |
| DEC-039 | 素材和账号补充边界 | VERIFY | 现有运行时 UI/音频优先复用；只索取 §17 明确需要的非秘密信息，密码/Secret/token 不进聊天或报告 | 新素材版权、真实设备与最终包体平台结果仍须各自核验 |
| DEC-040 | 用户授权的广告范围变更 | LOCKED | 2026-11-03用户确认：每日广告提示一次，可跳过继续；完整观看仅免一次性招聘费，员工照付月薪、次月生效、首聘两人不参与 | 按§18设计；不强制观看或退出，不扩展内购/Banner/插屏；次数等未明确参数为BASELINE |
| DEC-041 | 新版全屏素材的部署边界 | BASELINE | 49PNG/37SVG按用途区分：无字通用背景可部署，整屏UI/概念图仅参考，烘焙78%启动稿不能直接显示为真实进度 | 保持动态UI、安全区与热区；9:20图片不要求把所有手机或逻辑画布强制改为9:20 |
| DEC-042 | 玩家云备份范围 | LOCKED（需求）/待实施 | 用户2026-11-04确认只需玩家备份和跨设备恢复，不需要运营后台查询玩家；优先平台云存档+本地双槽 | 按§21设计；不采集所有玩家到自建后台，不把设计写成已接通 |
| DEC-043 | 真实玩家榜与本地榜 | LOCKED（范围）/BASELINE（细则） | 用户2026-11-04确认增加真实玩家榜并保留本地模拟榜；当前公司资产/完成年限为拟定口径，latest/重开归零/测试隔离按§21 | 不扩展实时多人、好友权限或现金奖励；平台能力未核不伪造API |
| DEC-044 | 跨设备同步与平台能力边界 | BASELINE / VERIFY | 云端分支不按现金或设备时间自动覆盖；优先不可变检查点，配额/删除能力/账户隔离必须真机核对 | 不假设SDK提供CAS/分布式锁；同时离线双设备不保证自动合并 |
| DEC-045 | 详情页关闭控制 | LOCKED（用户2026-11-05） | 普通详情页持续显示，由用户点关闭/返回等主动结束；月结/年结/数据刷新/同步/计时不得自动关 | §22；提交事务与账号/run安全失效单独处理，不能把详情当toast |
| DEC-046 | UI布局与组件一致性 | BASELINE（落实用户要求） | 同级按钮统一尺寸、对齐和间距；文字/金额与按钮热区分区，不遮挡；统一组件而非个别坐标修补 | §22；实测四视口和连续经营阅读，不能用缩字或假几何制造PASS |

**需持续复核的技术风险**：① 成本部门 ROI 在小公司可能为负（属设计预期，禁止“送利润”掩盖）；② 首聘费只能计一次；③ 时钟可被玩家改系统时间影响（无服务器反作弊）；④ 关闭公司≠法定个人信息删除，也≠账号注销；⑤ 平台适配不可假定，无凭证只能证明本地构建。


---

## 13. 目录与资产现状（整理后）

| 目录 / 文件 | 作用 | 是否入 Git |
|---|---|---|
| `assets/` | Cocos 工程（脚本 + 场景 + resources 资源） | 是 |
| `tests/` | 23 个 Vitest 文件（单元/集成/黄金/模拟/卫生） | 是 |
| `tools/` | 构建（`build-web.ps1`、`build-tap.ps1`）、静态服务、无头截图/校验、加载页注入、5 年模拟 | 是 |
| `server/` | 最小登录交换服务（`auth-server.mjs` + `selftest.mjs` + README） | 是 |
| `docs/` | 本文档、`配置与测试数据/`、隐私政策 md/html | 是 |
| `design/` | UI 设计交付包（B01–B06，含 67 张设计稿/规格）+ 音频设计包 v1.1 | 是（参考） |
| `evidence/` | 各里程碑构建日志、截图、包体校验、QA 报告 | 是 |
| `audio/` | 音频生产包（`Config/` 映射、`Tools/` 原创合成脚本、README/QA） | 是（WAV 母版与试听合辑已删除，可用脚本重建） |
| `CEO_TapTap_Animated_Promo_v1/` | 竖屏 9:16 宣传视频 + 生成脚本 + 分镜 | 是（宣传物料） |
| `CEO_TapTap_Store_Batch02_v2.0/` | 商店图标/封面/宣传图/截图概念 | 是（宣传物料） |
| `build/TapBuild/game.zip` | 可上传 Tap 包 | 是（其余 build 产物 gitignore） |
| `library/` `temp/` `profiles/` `.screenshots/` | Cocos 编辑器缓存/配置 | 否（gitignore） |

**常用命令**

```bash
npm install
npm run typecheck        # 严格 TS
npm run lint             # ESLint
npx vitest run           # 全部单测/集成/黄金
node tools/static-server.cjs build/web-mobile 8123   # 本地预览
node server/selftest.mjs # 服务端自检
```

```powershell
powershell -ExecutionPolicy Bypass -File tools/build-web.ps1    # 本地/无头 web 包
powershell -ExecutionPolicy Bypass -File tools/build-tap.ps1    # Tap 小游戏包
```

**环境**：Windows / Node v24.13.0 / npm 11.6.2 / Python 3.14.3 / Git 2.53.0 / Cocos Creator 3.8.8（`C:\ProgramData\cocos\editors\Creator\3.8.8`）。
**仓库**：2026-11-02 调研时分支 `main`，最新提交 `0a68286`（已合并设计文档）；本轮调研文档与证据尚未提交。发布 zip 不因文档更新而改变。

---

## 14. 发布差距调研与详细整改设计（2026-11-02）

> 本章是本轮交付的方案，尚未实施的设计均为建议。产品 LOCKED 边界、三行业经济参数、双槽存档格式与既有黄金预期保持原契约；不以改经营难度换取测试通过。

### 14.1 结论：核心能跑，距离发布仍有五道门禁

游戏已具备完整的单公司经营核心，不需要重写整个项目。当前欠缺的是“不同宿主上可靠启动、异常时保护存档、手机上可读可点、完整流程可回归、最终发行包可追溯”的闭环。不能用一个完成百分比概括，也不能用 205 项核心测试通过替代这五道门禁。

| 门禁 | 当前证据 | 当前结论 | 关闭条件 |
|---|---|---|---|
| GATE-BOOT 包体启动兼容 | 最新截图 Android 2/5；OPPO 日志停加载；华为/vivo 自测失败为用户反馈 | **FAIL / 发布阻断** | 失败机型同一修复包冷启动可交互，阶段日志闭环，云端准入满足当期标准 |
| GATE-DATA 存档与宿主能力 | 读档回调超时可误入新建并切换活动档；缺失 TextEncoder / structuredClone 可导致失败 | **FAIL / 发布阻断** | 缺能力可兼容或明确报错；读失败不当空档、不覆盖旧档；故障恢复可验 |
| GATE-UI 文字与操作 | 390/360/428 浏览器截图；大量小字、拥挤按钮、整屏缩小、列表无滚动 | **FAIL / 发布阻断** | 固定最小字号、可测间距、有效触控尺寸、长列表与弹窗小屏验收通过 |
| GATE-E2E 完整可玩性 | 205 核心测试通过；本轮主流程 15 个断言通过，但全异常矩阵/三行业 UI/真机未完成 | **部分 PASS，整体未通过** | A/B 用例逐项绑定测试层级与证据；正常与故障流程均回读真实业务状态 |
| GATE-RELEASE 发行材料与留档 | zip 可生成，但后台版本与本地版本未对应；隐私草稿有占位，资质/物料未核后台 | **BLOCKED** | 候选包、设备证据、平台报告、隐私/资质/物料均绑定最终版本；后台正式审核通过后才称上架 |

调研范围：深入检查启动/转换/重打包、UI 工厂和主要页面、平台/认证、存档/命令、现有测试；领域财务通过现有黄金与批量模拟复验。未穷举每个源文件、未改数值、未安装/升级引擎、未操作开发者后台。源码复核基于 `0a68286`；浏览器运行的是现有 2026-11-01 web-mobile，**没有本轮重新构建**，不能将其截图当成当前源码重新构建的 Tap 包证据。

### 14.2 审核截图、日志和包体的逐项判读

**报告含义**：截图是包体准入运行/性能测试结果，不是内容审核拒绝原因。运行异常率 60%；Android 2 通过/3 失败；iOS 1 通过/0 失败。失败品牌为 OPPO、Redmi、vivo；两台 HONOR 通过。不能把品牌 HONOR、系统显示 harmony/unknown 的通过设备简单归为“所有华为可用”或“鸿蒙必不支持”。平均启动 3.25 秒不代表失败设备成功进入游戏；两项性能问题没有明细，当前不能推断具体 FPS、内存或耗时根因。

**OPPO 日志提供的事实**：

1. 压缩包包含 logcat.txt、log.log、autotest.json 和两张设备图，仅覆盖 OPPO PCEM00 / Android 11。没有另外两台失败设备的日志，不能把一个机型的系统日志归因推广到所有设备。
2. 设备本地约 23:26:58 找到小游戏 Activity；23:27:03 测试器记录容器加载阶段成功。
3. 随后四次 OCR 均识别“加载中”和 vConsole；约 23:28:06 记录 `minigame_loading_failed`。前面的 loading_success 不是业务场景已可交互。
4. logcat 有 EGL、系统库、TapDB 等日志，但没有可直接锚定本游戏源文件的首个 JS 堆栈；这些系统错误不能单独确认为根因。日志出现 WebView 83，不等于已证明游戏脚本就在该 WebView 执行。
5. 测试脚本曾报网络异常，后记录网络恢复并进入游戏；只能作为网络条件记录，不能据此认定一分钟卡加载全由网络造成。

**当前本地上传候选核查**（`package-audit.json`）：

| 项目 | 实测 |
|---|---|
| 路径 | `build/TapBuild/game.zip` |
| 大小/条目 | 5,499,092 字节，约 5.24 MiB；472 项，未发现反斜杠条目名 |
| SHA256 | `05E946662B9CE5CE761A0BC751272833FE53A038796E7646F143C15415C43730` |
| game.json | portrait；productVersion=1.0.0；convertScriptVersion=2.0.4-ts |
| 旧 fetch 抛错 | 当前入口已无 `throw new Error('fetch is not defined')` |
| 早期诊断 | 包内无 `CEO-BOOT-DIAG`；build-tap.ps1 未调用 diag-inject.mjs |
| 帧调度 | 当前补丁仍仅 android 走 rAF；没有文档声称的非 iOS 统一分支 |
| 宿主能力 | main 脚本引用 TextEncoder、structuredClone；包内未找到相应兼容实现 |
| 构建残留 | 包内有 6 个 main/index 哈希版本及多个 config 版本，需通过新目录构建与引用核查消除历史残留；不据此断言资源必然损坏 |

**版本对应缺口**：截图标示上传版本 1.1.0，本地 game.json 是 1.0.0，且没有后台所用 zip 的 SHA256。因此，本轮可以评估当前候选与日志现象，**不能证明这份 zip 就是截图中接受测试的那一份包**。修复前须保留原候选；后续所有结果绑定 releaseId/zip SHA256/平台包记录，而非“最新版”文件名。

### 14.3 问题台账与根因置信度

优先级口径：P0=阻断启动/可能误替换存档，P1=影响正常可玩、可读或发行验收，P2=体验/维护改进。下表的“已复现”是测试现象成立，不表示已经修复。

| ID | 级别/证据 | 问题与影响 | 处理落点 |
|---|---|---|---|
| REL-01 | P0，平台已证实失败，根因未闭环 | 多款 Android 卡加载；不能继续归因“仅鸿蒙限制” | 启动分段诊断、最小包差分、设备堆栈；§14.4 |
| REL-02 | P0，条件故障已复现 | crc32.ts 顶层 `new TextEncoder()`；宿主缺能力时模块导入失败，AppView/BootTrap 尚未启动，浏览器模拟黑屏 | 领域层内置 UTF-8 编码实现或经校验的兼容层；不得改 checksum 算法结果 |
| REL-03 | P0，条件故障已复现 | GameStore.mutate 的 structuredClone 在 try 前执行；缺能力时创建返回 NOT_READY，锁可能不释放 | JSON 兼容状态深拷贝助手，快照创建纳入 try/finally；故障后仍可重试 |
| REL-04 | P0，真实 TS 模块故障模拟复现 | TapPlatform.get 超时 resolve(null)，无法区分空档与 IO 不可用；重新创建后活动档切到新 run | 存储结果区分 MISSING/UNAVAILABLE/CORRUPT；加载失败禁止创建与写入；§14.5 |
| REL-05 | P1，包体/脚本证实 | 引擎前诊断未纳入标准构建；旧 diag 脚本匹配固定 hash、AppRoot 查找层级不对，且另走 Windows ZipFile 重打包 | 单一启动入口模板、哈希自适应、正确 ready 标记、统一 archiver 打包 |
| REL-06 | P1，源码与截图证实 | Label 默认高度与 fontSize 相同，lineHeight 却更大；有 width 且无显式换行就用 SHRINK，缩成难读小字；多行自动增高又不推开相邻绝对坐标 | 显式文字样式、布局测量、纵向流式卡片；§14.7 |
| REL-07 | P1，源码证实 | 设置/录用/编制/创建按钮仅 34–38 高，相邻编制与招聘按钮中心距等于宽度，几乎无间隔，招聘按钮越过卡片右侧 | 最小热区与间距、独立操作行 |
| REL-08 | P1，截图/源码证实 | 小屏通过整屏缩小适配；部门/员工无 ScrollView；热调整尺寸后旧 root 可能裁切导航 | 安全区分 Header/Body/Footer，Body 滚动，resize 重排 |
| REL-09 | P1，实际点击证实 | 首聘录用按钮直接扣款；普通招聘源码也直接提交，未落实设计规定的费用预览与确认 | 共用 HireConfirmDialog 与稳定 commandId、忙碌态 |
| REL-10 | P1，检查范围证实 | typecheck 和 lint 仅覆盖 core/tests 等，未覆盖 assets/scripts；B16 是源码抽样正则，不是真 zip 执行验收 | 增加 Cocos 表现层检查、解包断言与启动契约测试 |
| REL-11 | P1，构建脚本证实 | 构建只检查旧文件是否存在；仍使用固定输出目录；补丁部分失败不阻断；参数默认版本与上传版不一致 | 干净独立目录、关键步骤失败即停止、manifest 与版本单一来源 |
| REL-12 | P1，源码/政策草稿证实 | 平台缺任一方法可降级 EDITOR；登录本地 TTL 替代 checkSession；隐私有占位且首启缺拒绝操作 | 正式包平台检测失败显式错误，登录态真机校验，政策与 UI 一致 |
| REL-13 | P1，发行证据不足 | 未取失败设备 JS 堆栈/性能两项详情、最终同包 iOS 证据/资质/实机素材 | 设备矩阵与后台材料，§14.9 |
| REL-14 | P1，设计/源码/页面对照 | 当前 CEO 页只有随机姓名；年报始终取最近一年；部门卡缺收益/净贡献；人才页缺部门筛选。实现存在不等于设计交互已全部落地 | 纳入 R4/R5 的功能补齐与验收，仍在既有 MVP 范围内 |

**不得混淆的候选根因**：TextEncoder 缺失、rAF 只注册不回调、首屏 WebGL 状态污染、引擎/适配器能力差异、资源读取路径失败均需按阶段验证。当前缺真实异常堆栈，不能把任一候选标记为“已定位 OPPO/华为/vivo 的最终根因”。structuredClone 更可能在首次写命令暴露，不能拿它单独解释尚未进入业务页面的所有卡死。

### 14.4 启动整改设计：可定位、可恢复、可对照

**顺序与职责**：

```text
game.js 最前面安装原生错误监听/有界诊断缓冲
  → 宿主能力探测与必要兼容
  → web-adapter
  → polyfills / SystemJS
  → import application / engine-adapter
  → engine init
  → scene loaded / Bootstrap
  → config validated
  → save loaded
  → business UI / privacy dialog 可交互
```

每阶段记录开始/结束时间、releaseId、成功/失败、首个错误码；保留最多 30 条、每条限长，屏蔽账号、授权 code 和存档内容。调试版通过 console、tap.onError/onUnhandledRejection 和平台允许的原生提示输出；如需本地落日志，仅在平台存储可用后写入有界诊断键，不影响业务存档。诊断默认不联网；若后续采用 tap.reportScene 须先核实隐私和 API 能力。

1. 诊断必须在 import 业务模块之前安装，不能只依靠 AppView.start 里的 BootTrap。正式版错误页给出“启动失败、错误编号、重试/退出”；详细堆栈留在调试记录。
2. ready 必须由“页面已建好且可以响应点击”的显式标记确认。AppRoot 实际在 Canvas 下；旧诊断查 scene.getChildByName('AppRoot') 不可靠。用专门 bootState，而不是通过某个节点是否存在猜测成功。
3. initApp 只允许执行一次。对 rAF 与短定时器设置可控竞速兜底和 once guard，保留必要的画布初始化顺序；用“rAF 不回调/两者均回调/尺寸延迟到达”测试避免永久等待、重复初始化。平台分支修正需实机验证，不能只改字符串。
4. 首屏图不能承担成功信号；启动失败不能仅 `firstScreen.end()` 后留下黑屏。每个必要异步阶段有超时和错误路径；超时不等于忽略失败继续启动。
5. 对照包在独立目录生成，不覆盖现有 zip：A=官方转换最小场景（不加自定义首屏和业务），B=A+真实资源/业务模块，C=B+自定义首屏。另可用平台原生小例子验证容器基础能力。先比较同一失败机型，再推广。
6. A 失败：优先检查官方插件/容器/引擎组合并准备平台工单；A 成功 B 失败：按首次失败阶段检查业务能力与资源；B 成功 C 失败：聚焦自定义 WebGL 首屏状态与上下文交接；UI 已出现但命令失败：转向存储/clone/平台适配。
7. 对 TextEncoder 兼容实现验证中文、ASCII、emoji、孤立代理项与标准编码字节一致；现有存档 checksum 必须仍能校验，禁止简单按 UTF-16 charCode 替代 UTF-8。
8. 状态是纯 JSON 契约，可采用受校验的 cloneGameState（当前数据不含 Date/Map/循环引用）。保持事务回滚语义；不应直接全局覆写一个行为不完整的 structuredClone 冒充原生实现。

**验收**：缺 API、不回调、模块加载拒绝、配置损坏等能产生阶段/错误码；失败不落成功标记、不自动新建公司；同设备 A/B/C 差异可解释。设备日志必须能证明故障在哪个阶段，而非只提供一张加载图。

### 14.5 存档整改设计：读失败不能代表没玩过

保留双槽/checksum/墓碑协议，先改变存储读取的错误语义，再调整上层启动状态。

```ts
// 契约示意，不是本轮已实现 API
type StorageRead<T> =
  | { kind: 'found'; value: T }
  | { kind: 'missing' }
  | { kind: 'unavailable'; reason: 'timeout' | 'io' };
```

- 只有平台明确报告 key 不存在才能返回 missing；超时、权限/IO 错误必须保留 unavailable。若暂不改接口，最小方案是超时抛 SAVE_UNAVAILABLE 并在启动层接住，禁止转换成 null。
- SaveRepository 的槽位异常不能一概 catch 后作无档；区分损坏可回退、暂不可读应阻断写入。只在“所有相关键明确 missing，或墓碑明确要求创建新 run”时展示首建入口。
- save load 状态为 LOADING / READY / RECOVERED / UNAVAILABLE / CORRUPT。UNAVAILABLE 提供重试和退出；如已有内存状态可保留只读查看，但禁止继续经营后声称已保存。暂不引入可写访客档或新备份体系。
- 双槽中一槽暂不可读不立刻修指针并覆盖；先重试确认可恢复的已提交版本，保证无法读取的更新档不被较旧档覆盖。明确指针/版本/墓碑检查顺序。
- GameStore.mutate 无论快照、业务、写盘何处失败都释放锁。失败不改变 revision/现金/员工；如果持久化结果未知，进入待回读核对态，不能直接重放收费命令。
- UI 保存提示来自持久化成功结果，不在 onHide 无条件 toast“已自动保存”。前后台记录实际时间水位，统一在线/离线结算；不要用固定 200ms 回调次数冒充真实经过时间。
- 故障用例：超时→重试恢复原 run；已有公司→所有读取不回调→禁止创建；一槽损坏另一槽可恢复；读回失败、指针失败、磁盘满、重开后旧回调均不覆盖另一有效档。检查旧 runId、revision、checksum、现金与员工，而不只看弹窗。

本轮复现证据 `storage-timeout-report.json`：旧公司已保存→读回调全部不响应→phase=CREATING 且 runId 改变→恢复读写后创建替代公司成功→重载选中替代档。未声称旧槽已被物理删除；问题是活动经营档被误替换，并存在继续写入覆盖的风险。

### 14.6 平台、登录与发行管线设计

**平台与登录**：正式 Tap 构建明确指定平台标识；无 tap 或缺必需方法时显示 PLATFORM_UNAVAILABLE，不能静默进入 CocosPlatform 并得到 mock 会话。可选方法按能力降级，必需能力失败明确可重试。已有存档可按已确认的离线规则进入本地玩法，但不得显示虚假的平台认证成功。

无账号业务时保留当前“不强制自建服务端”的轻方案，首次 tap.login 及恢复 checkSession 走真实平台校验；本地 30 天标记仅作缓存信息，不证明平台态仍有效。需要服务端身份时才启用已有交换服务，并更新政策、部署与服务端自检。当前文档与源码冲突必须先统一，不能两种方案同时作为必接要求。

**构建产物契约**：

1. 从固定源码 commit/工作区摘要、锁定的 Cocos/插件版本、economy 配置哈希出发，以 releaseId 建立全新的构建目录。旧包保留可回退；无须删除用户现有 build/。
2. 构建开始记录 startTime；进程错误、编辑器锁、旧输出、补丁未命中、重打包 warning/error 均按明确策略判失败。文件存在不是新构建成功证据。
3. 官方转换→兼容层/诊断/首屏（有配置开关）→断言最终入口→一次标准 archiver 重打包。diag-inject 不再有单独压缩分支；不在多个脚本各自改写相同文件。
4. 精确校验入口 require/System import/config 路径与大小写；扫描未引用历史 index/config，并从干净构建消除。自动匹配实际 hash，不写死 application.e1d19.js 等旧文件名。
5. **从最终 zip 解包检查**，而非只查 build/TapBuild/game 目录：根目录 game.js/game.json、资源引用、路径分隔符、版本、诊断开关、平台实现、密钥/测试设施、包大小和条目清单。
6. manifest 至少包括 releaseId、commit/dirty摘要、Cocos/插件版本、productVersion、配置哈希、构建时间、zip SHA256/字节数、测试报告路径。后台上传记录补平台版本号和测试报告编号。截图的 1.1.0 与本地 1.0.0 问题通过此契约消除。
7. 官方审核页本轮明确为 **20MB 以下**；工程可先采用 `<20,000,000 bytes` 的保守门禁，最终与后台口径核对。当前约 5.24MiB，没有证据表明此次拒绝源于包体过大。历史“60M+”不能用于放宽门禁。
8. package.json 现无 build、UI typecheck、E2E 脚本，整改时新增明确入口并指向真实实现；Cocos 表现层按 Creator 生成类型配置检查，避免拿 core typecheck 结果覆盖全工程。不能把手动截图脚本命名为完整验收套件。

**验收**：旧文件/错误版本/漏补丁/错误路径任一出现都不能生成“成功可上传”结论；重新构建的候选有唯一身份，能把本地、扫码、云端和提审证据对应到同一包。

### 14.7 UI 详细设计：用布局保留阅读空间

保留现有浅色、蓝色主操作与四 Tab 风格。改的是信息分组、字号、间距和操作可达性，不要求重做美术或把设计整屏 PNG 当运行 UI。

**通用规格（建议落到 theme.ts / Typography / Spacing）**：

| 项目 | 建议规格 | 验证方式 |
|---|---|---|
| 页面边距/组间距 | 左右 16；组间 24；卡片间 12；卡片内边距 16 | 引擎节点矩形与真机截图测量 |
| 文字与控件 | 字段名到选择框 8；标题到说明 8；说明到操作行 12–16 | 不能出现文字边缘贴按钮/卡片 |
| 字体 | 页标题 22–24；卡片标题 16–18；正文 14–16；辅助说明至少 12；主金额 24–28 | 检查最终有效字号，不只检查 fontSize 参数 |
| 行高 | 正文约字号 1.4–1.6；单行容器至少容纳 lineHeight | 不因短容器触发全局 SHRINK |
| 主/次按钮 | 主操作 48 高，普通操作不低于 44；按钮间距至少 8 | 换算到实际逻辑屏幕后热区仍 ≥44×44 |
| 卡片 | 同组统一内边距；文本按内容自适应高；操作行另占 44–48 高 | 长名/金额不侵入按钮区 |
| 弹窗 | 宽度=安全区宽−32（最大 343）；高度不超安全区高−32 | 标题/底部按钮固定，中间正文滚动 |
| 排版 | 说明用自动换行/RESIZE_HEIGHT；单行标题 CLAMP+详情；金额使用明确短格式+详情 | 不把所有溢出都交给 SHRINK |
| 盈亏 | 金额显示 ¥、必要正负号，配文字语义；不得只靠红绿 | 大额/负值/零值核验 |

**布局算法**：由安全区计算四边 inset，转换为统一的 Cocos 设计单位；Header 与 BottomTabs 锚定可用区域，Body 高度=可用高−Header−Tabs−间距，Body 用 ScrollView。保持可读字号与热区，不把整个 812 高内容缩到 640 高。360 宽时按有效逻辑像素校验，必要时提高设计字号/按钮尺寸；横屏提示竖屏或使用可滚动安全内容。窗口变化监听后重新计算，不仅在 start 构建一次。

**组件改造边界**：UiFactory 增加显式 TextStyle、overflow、anchor、padding 和 minHeight 契约；RESIZE_HEIGHT 使用顶部锚点并由 Layout 更新父卡片尺寸。新增/提取 PageShell、FormSection、ChoiceCard、CandidateCard、DepartmentCard、EmployeeCard、ConfirmDialog、MoneyRow、BottomTabs。AppView 保留路由/命令编排，按页面逐步提取，不一次重写整份 2,000 多行文件。图形背景随最终内容尺寸重绘，避免 Layout 已拉高但 Graphics 仍是旧尺寸。

**逐页面规格与验收**：

| 页面 | 结构与修改 | 必验 |
|---|---|---|
| S00 启动/错误 | 品牌图、真实阶段；错误后显示重试/退出 | 无无限加载、无黑屏、重试不清档 |
| S01 公司创建 | 标题/步骤；行业标题+说明；三行业选项；名称组；换批/自定义；底部下一步 | 标题与选择框留 8+；选项间 8+；长公司名不缩成小字 |
| S02 CEO | 姓名输入/随机；性格卡标题与说明分行；初始属性分三项；底部上一步/下一步 | 说明正文可读；恢复上一页不丢输入；自定义姓名与需求对齐 |
| S03 首聘 | 现金/已聘进度；可滚动三候选；姓名、能力组、薪资/费、独立录用行；完成按钮固定 | 候选比较不靠微小字体；录用先预览扣费/余额；仅 2 人完成后继续 |
| T01 公司 | 顶部公司/设置；现金主卡；营收/利润双卡；时间；CEO/团队；产能/报告；盈利目标 | 累计值与预计值语义准确；长名/大额不遮设置；暂停/倍速可点 |
| T02 部门 | 标题；方针分段按钮；滚动部门卡；卡内人数/成本/效益，另设操作行 | 满 6 部门可滚到底；编制/招聘间隔 ≥8，卡片内不溢出 |
| T03 人才 | 人数/工资汇总；部门筛选；滚动员工卡；详情与招聘入口 | 0/2/10/30/100 员工，末项可达；>30 使用复用/虚拟列表 |
| T04 排行 | 标题+双榜切换；我方固定摘要；模拟榜滚动；明确本地模拟提示 | 排序/指标正确；公司名与金额列不重叠 |
| D01 年报 | 年份切换；收入/成本分组；可折叠 0 项；利润汇总；现金桥/资产；固定关闭 | 所有项目能查看；最近 100 年可切换；逐项和账本一致 |
| D02 员工 | 姓名/部门；能力与工资；任期/成长；底部调岗/裁员+关闭 | 赔偿预览、取消无变更、次月结果可回读 |
| D03 部门/招聘 | 只读效果说明/人数/工资/净贡献；编制和招聘入口；三候选可滚动 | 空部门明确无收益；HR 后显示真实折后招聘费 |
| D04 设置/隐私 | 分组音频、教程、政策、版本、危险区；独立取消 | 政策全文或平台允许的可访问入口；版本与 manifest 一致 |
| D05 关闭确认 | 公司/员工/现金/年度摘要；明确不可恢复；取消与最终清除分层 | 二次确认、超时 token、取消/失败不离开；无误点默认确认 |
| D06 离线报告 | 实际结算月数/封顶说明、现金前后、收入/成本/利润和事件摘要 | 0/8h/40h、暂停、回拨、重复回前台均对账 |
| D07 危机 | 现金缺口与费用解释；查看费用/一次救助/主动重开 | 救助是否已用、到账与利润口径正确、没有强制删档 |

招聘/裁员/建部/投资使用同一确认模式：预览费用→说明何时生效→显示操作后余额→确认提交→忙碌禁重→持久化成功再反馈。稳定 commandId 跨同一次确认重试复用，不能每次点击生成新的收费事务标识。

UI 性能优化先取样：当前 clearRoot.destroyAllChildren 后重建整页且大量 Graphics/动态 Label，可能增渲染/GC 压力；这是待测假设。落地时复用可见组件、按月份/事件更新变化字段、避免无变化重建，比较节点数/draw call/帧时间/内存。最终选择 30 或 60FPS 依据平台报告，不用限帧掩盖卡顿。

### 14.8 端到端测试设计与本轮结果

**本轮实际执行**：

| 层级/命令 | 结果 | 能证明什么 / 不能证明什么 |
|---|---|---|
| `npm run typecheck` | PASS，退出码 0 | core/tests/tools TS；不包含 Cocos 表现层 |
| `npm run lint` | PASS，退出码 0 | 当前脚本范围；不代表全部 UI 通过 |
| `npm test -- --reporter=json --outputFile=evidence/release-audit-20261102/vitest.json` | PASS，23 文件/205 项 | 含黄金/集成及 100 seed×3行业×3策略×5年；不等于 900 次 UI 游玩 |
| `node evidence/release-audit-20261102/browser-audit.cjs` | PASS，15 个断言；25 个截图/对应状态快照 | 真实浏览器点击、读状态、持久化重载；测试了 360×640、390×844、428×926；不是 Tap 容器 |
| `node evidence/release-audit-20261102/runtime-feature-audit.cjs` | 完成故障模拟，产品在缺能力场景 **FAIL** | TextEncoder 缺失→模块导入错误/黑屏；structuredClone 缺失→创建 NOT_READY；未证明失败手机实际缺该 API |
| `node evidence/release-audit-20261102/storage-timeout-audit.cjs` | 完成故障模拟，数据保护预期 **FAIL** | 真实 TS 模块+注入回调超时重现误入新建/活动档切换；不是物理设备 |
| 最终 zip 静态检查 | 已执行 | 哈希/版本/入口/兼容层/条目；没有执行真实 Tap 运行 |
| 新版本 Cocos 构建 / server/selftest | NOT_RUN | 本轮没有实施或启用后端分支；没有声称这些新结果通过 |
| Android/iOS/Harmony 真机与平台复验 | BLOCKED | 未连接手机、未访问开发者后台；用户截图只证明对应历史上传版 |

浏览器 15 个断言：隐私同意落盘；首聘扣费等于对应月薪；首聘一人后重载恢复；第二人完成且两人招聘费合计准确；点击引导开始进入 RUNNING；设部扣费一万元且状态/重载保留；命令层推进 60 秒×5 倍完成全年并核对年报逐项收支/利润/现金；暂停超过一个 5× 月份所需时长后月份不变；**点击 5× 并真实等待 61 秒完成一年**；360/428 冷启动部门页可进入；跨年后重载保留；取消关闭保持 run；确认关闭清空本轮；再次重载旧 run 不复活。进入人才/员工详情/排行/设置/空年报/年报均留图，未把“留图”额外算成业务通过断言。脚本读取 Cocos 场景内状态作为 oracle，未通过直接改现金/员工/存档伪造结果。

现有批量模拟有边界：财务守恒主要检查年利润=月利润和，自动招聘校验主要是五年总数≤15；不能据此推导每个月费用/资产/逐年上限全部穷举通过。整改应增加逐年/逐月对账、事件唯一性、暂停/危机提前终止等分项统计，不修改黄金预期。

**待建回归矩阵**（沿用 A/B/G，不另造一份“全通过”表）：

| 测试组 | 必测流程与业务断言 | 现状 |
|---|---|---|
| E01 首启创建 | 三行业分别走完整 UI；自定义公司/CEO、换批、前后页、输入校验；首聘钱/人数/时钟 | 部分 PASS；三行业逐页 UI 和输入边界待补 |
| E02 管理命令 | 招聘确认/取消/连点；裁员预览/取消/确认；调岗；建全 5 支持部门；策略/锁定/费用 | 核心已有单测；UI 全链未覆盖 |
| E03 时间/财务 | 1×/2×/5×/暂停，年报逐项与 ledger 对账，扩产现金转资产、跨年折旧、达标继续 | 5×实时与核心公式 PASS；1×/2×实时、UI全部对账待补 |
| E04 保存/生命周期 | 首聘中断、每关键命令重载、前后台/冷启动、8h/40h离线、回拨、暂停离线 | 首聘/跨年/重开重载 PASS；真实生命周期待补 |
| E05 危机与错误 | 资金不足、救助一次、写盘失败、超时、损坏档、配置缺失、认证拒绝/断网 | 核心部分 PASS；新故障明确 FAIL；UI异常待补 |
| E06 UI边界 | 各尺寸、缺口安全区、键盘、长名/emoji/大额、六部门/百员工、所有弹窗 | 已有截图和问题；完整验收 FAIL/待补 |
| E07 包体验收 | 解包→宿主契约→失败设备冷启/后台恢复→真实经营/保存→云端准入 | 当前平台 FAIL；修复包尚未构建 |

**测试设施**：优先沿用现有 playwright-core + Chrome，做可复跑 Node runner；CLI 在本轮 `--no-install` 尝试未找到可执行入口，已采用仓库既有脚本方式，未新增依赖。Canvas 页面使用稳定节点/业务 actionId 和实际屏幕坐标点击；每一步断言 phase、runId、revision、现金/员工/部门/报表，并验证存档。所有“按钮打开了”后必须进一步断言真实结果。

调试读取钩子只在测试/开发构建开启，不将任意改状态入口加入正式包。测试结束输出 PASS/FAIL/BLOCKED/NOT_RUN 和截图/前后状态；关键场景可录屏。故障测试应成为回归中的失败预期检测，修复后再转为“故障已被安全处理”的通过断言。失败脚本只报告第一处定位信息，不因零 pageerror、HTTP 200 或 toast 就算整条流程成功。

### 14.9 真机与平台验收操作设计

1. **先保全失败证据**：为截图上传版本导出平台包记录、版本/哈希（后台若支持）、设备 OS/TapTap/运行库版本、两项性能指标明细。现有 OPPO 压缩包不代替 Redmi/vivo 堆栈。
2. **失败机型优先**：OPPO PCEM00、vivo V2024A、Redmi 23113RKC6C，加用户自己的华为与 vivo；同包回归两台原成功 HONOR。随后补 iPhone/iOS。设备借用/云真机/平台支持均可，须记录实际覆盖，未拿到设备不补写 PASS。
3. Android 按官方调试入口开启日志/调试，必要时 adb 与 Chrome inspect；官方也提供 TapTap MiniGame Debugger。HarmonyOS NEXT 若不具备 Android adb 路径，采用平台实际支持的日志工具/原生阶段提示，不能照搬 Android 命令假定可用。
4. 每台先冷启到隐私/创建页并点击，再走首聘/开始/暂停/5×跨年/部门/存档/杀进程恢复/关闭重开。每台至少 10 次冷启和 10 次恢复用于内部稳定性采样，记录每次结果；这不是官方抽样标准。
5. 记录从入口到可交互耗时（p50/p95）、帧率分布、长帧、内存与后台恢复，性能目标先以当期后台标准为硬门禁。内部可先定可交互 p95≤8秒、无连续停滞、稳定画面≥30FPS、运行 30 分钟内存无持续增长；均是建议验收目标而非当前实测或官方统一阈值。
6. 只对 **最终候选同 SHA256** 重跑云端准入。目标为已知失败机型零加载失败、平台异常率/性能合格；截图中 Android 标准80%不应成为放过已知失败机型的理由。修包、改版本或改资源后重新绑定测试，不沿用上一包证据。
7. 资格/商店材料并行准备：统一游戏名、适龄与主体，隐私政策清除占位并确认实际行为、政策可访问，截图和录屏来自可玩的最终实机版本，版权许可可查。备案/软著/版号适用条件以当期官方/后台核验，不把文档历史断言当作法律结论。

### 14.10 实施顺序、工作量、替代方案

**推荐保留 Cocos 3.8.8 + 当前官方插件路线**。官方仍给出 Cocos 3.8.x 的微信构建→Tap 转换→zip 流程，符合既有投入；现阶段换技术栈会同时重做渲染、输入、音频和平台验收，不能解释当前根因。参照对象采用“官方转换最小工程”和“官方原生小游戏示例”，用于分离引擎/容器/业务故障；本次无需用两个商业经营游戏的技术栈作投票，也未开展社区/商业竞品付费调研。

| 顺序/关联任务 | 工作内容 | 产出与门禁 | 估算（单人有效人日） |
|---|---|---|---|
| R0 / M3-09 | 校正版本与基线、冻结原失败候选、建立 manifest、归集平台明细 | 能指出“哪包在哪台机器失败” | 0.5–1 |
| R1 / M3-07 | 早期诊断、能力兼容、A/B/C差分、失败设备首个堆栈 | GATE-BOOT 根因可复现；修复后失败机型可交互 | 2–4，设备/平台阻塞另计 |
| R2 / M3-06 | 读档错误语义、保存锁/回滚、失败后重试与UI错误态 | 新故障用例通过，原档不被误替换 | 1–2 |
| R3 / M3-09 | 独立构建目录、补丁契约、统一打包、zip检查与manifest | 新包可追溯、拒绝陈旧构建 | 1–2 |
| R4 / M3-05 | 文字工厂/PageShell/卡片/列表/弹窗逐页适配 | GATE-UI，每页截图/点击/长列表通过 | 3–5 |
| R5 / M3-06 | 三行业UI E2E、收费/异常/生命周期/财务回归、Cocos类型门禁 | GATE-E2E；每个A/B分层标注 | 2–4 |
| R6 / M3-07、09 | 同包设备矩阵/性能/云端复验，发行物料与资料核验 | GATE-RELEASE，随后才可提审 | 1–2，审核/资质等待另计 |

合计约 **10.5–20 个有效人日**，单人可理解为约 2–4 周研发与验证工作量，**不是上架日期承诺**。设备可得性、适配器缺陷、平台答复、备案和审核耗时不在其中；首次真机差分证据出来后重估。若 R1 发现引擎/容器缺陷无法项目内修复，应明确阻塞并提交最小复现给平台，不能继续以大量 UI 工作掩盖启动未解决。

备选 A：只有最小官方包同样失败，才评估更换官方明确支持的引擎/插件组合；优点是借官方修复，代价是重新构建与全量回归。备选 B：确认 Cocos 长期无法满足已锁定普通小游戏目标后，才考虑原生 Canvas 轻渲染并保留领域逻辑；代价是整套 UI/输入/音频重新实现。H5/APK 不是当前 LOCKED 平台的等价替代，不擅自切换。

**何时推翻当前建议**：最小官方工程在目标设备稳定失败且平台无法给兼容路径，或证据证明目标设备容器不支持而业务又必须覆盖，或需求改为原生 APK/云存档/多人时，需要重估技术方案。反之，若 A/B/C 直接定位单一兼容缺陷，就收敛修复，不为显得完整而改引擎。

### 14.11 外部依据与证据入口

以下官方页面于 **2026-11-02** 检索；仅支持对应平台机制/组件行为，不证明当前包已通过。与旧文档冲突之处已记录 DEC-035—037。

- [TapTap Cocos 引擎适配](https://developer.taptap.cn/minigameapidoc/dev/engine/Cocos-Laya-Egret/)：当前公开插件/转换路径、宿主与浏览器环境差异；不能据版本在列表中就认定本包无兼容问题。
- [TapTap 开发示例](https://developer.taptap.cn/minigameapidoc/quick-start/guide/dev/)：原生小游戏入口/Canvas 基础对照；只用于隔离容器能力，不代表应改写经营游戏。
- [TapTap 真机调试](https://developer.taptap.cn/minigameapidoc/dev/dev-support/debugging/)：设备日志与调试路径；实操需设备、测试权限和适配环境。
- [TapTap 性能测试](https://developer.taptap.cn/minigameapidoc/dev/tutorial/performance/performance-test/)及[启动优化](https://developer.taptap.cn/minigameapidoc/dev/tutorial/performance/launch/launch-guide/)：性能取证入口；当前报告缺少两项问题的详细数据。
- [TapTap 登录态管理](https://developer.taptap.cn/minigameapidoc/dev/tutorial/open-capabilities/login-management/)：平台态检查机制与会话边界；不支持用本地固定 TTL 证明平台态一直有效。
- [Cocos 3.8 文字排版](https://docs.cocos.com/creator/3.8/manual/zh/ui-system/components/engine/label-layout.html)：SHRINK/RESIZE_HEIGHT、行高、锚点与滚动布局；支持本轮文字组件整改。
- [TapTap 审核规范](https://developer.taptap.cn/minigameapidoc/tap-operation/operation-standards/review-standards/)：包体大小、登录及真实物料要求；资质适用与最终审核以后台核验为准。

本地证据：`evidence/release-audit-20261102/{vitest.json,browser-report.json,package-audit.json,runtime-feature-report.json,storage-timeout-report.json}`，以及同目录页面 PNG/JSON。`platform-loading-failure.jpg` 来自用户原始 OPPO 压缩包，仅为故障取证。复跑三个 audit.cjs 需要现有 web-mobile、playwright-core、本机 Chrome；storage-timeout-audit 使用真实 TS 模块和注入回调宿主。证据不包含密钥或原始认证响应。

---

## 15. 发布整改执行规格与任务分解（交给执行 Agent）

### 15.1 使用方法、状态和范围

本章将 §14 的方案拆成 **48 项** `TASK-M3-09-R00`—`TASK-M3-09-R47`。下文简称 R00 等，完整 ID 始终以此为准。它们是 M3-09 发布收口子任务，分别关联原 M3-05/06/07，**不将已完成领域模块整体重做**。本章细化技术契约与验收，产品规则仍由 §1/§12 决定。新文件名为建议；若现有模块更合适可等价落地并记录实际路径。

领取前先读 §1、§2、§11.9—11.10、§12、§14.3 和本任务卡；之后只读取本任务引用的专项章节及实现。单个 Agent 默认串行执行；多个独立聊天同时做时，先分配互斥文件范围。任务表的 owner/证据/状态由执行者回填，不能只凭另一个聊天说完成就覆盖状态。

任务状态沿用 TODO / IN_PROGRESS / READY_FOR_QA / DONE / BLOCKED；**测试结果另用 PASS / FAIL / BLOCKED / NOT_RUN**。依赖未完成时保持 TODO；实际尝试后缺设备/资料等外部条件才记 BLOCKED 并写缺少哪项。代码任务可先 READY_FOR_QA，但其必需的本地验收通过前不得 DONE。真机任务未测就是未完成，不能用 Mock 关闭。

本轮只做执行设计；下表全部为 TODO，不代表已有修复。§14 的 205 项/15 项是旧基线；新增回归应保留原测试并增加针对根因的断言，不能规定“测试数必须仍为205”。

### 15.2 唯一任务账本与依赖

| 子任务 | 工作单元 | 前置子任务 | 当前状态 | owner / 新证据 |
|---|---|---|---|---|
| R00 | 工作区与修复基线登记 | 无 | DONE | 本地执行 Agent / `evidence/m3/TASK-M3-09-R00/attempt-01/`（baseline.json、task-result.json） |
| R01 | 平台版本/包体对应及资料缺口 | R00 | DONE | 本地执行 Agent / `evidence/m3/TASK-M3-09-R01/attempt-01/`（package-device-map.json）；云端 1.1.0↔本地 1.0.0 对应 unknown，缺 U01—U06 |
| R02 | 故障夹具与回归入口 | R00 | DONE | 本地执行 Agent / `tests/helpers/{faults,ControlledClock,freshModule}.ts`、`tests/integration/{releaseFaults,faultFixtures}.test.ts`、`evidence/m3/TASK-M3-09-R02/attempt-01/`；218/218 PASS |
| R03 | 引擎前诊断与启动状态机 | R02 | READY_FOR_QA | 本地执行 Agent / `core/platform/bootDiagnostics.ts`+`scripts/boot/cocosBootHost.ts`+AppView 打点/错误页、7 单测、`evidence/m3/TASK-M3-09-R03/attempt-01/`；引擎前物理注入待 R20/最终包，真机首错待 R09 |
| R04 | UTF-8 / CRC32 宿主兼容 | R02 | DONE | 本地执行 Agent / `assets/core/persistence/{utf8,crc32}.ts`、`tests/unit/utf8crc.test.ts`（19 例）、`evidence/m3/TASK-M3-09-R04/attempt-01/`；237/237 PASS，REL-02 关闭 |
| R05 | 状态快照兼容与锁释放 | R02 | DONE | 本地执行 Agent / `assets/core/persistence/cloneGameState.ts`、GameStore try/finally、MemoryStorage、`tests/unit/cloneLock.test.ts`（9 例）、`evidence/m3/TASK-M3-09-R05/attempt-01/`；246/246 PASS，REL-03 关闭 |
| R06 | initApp 帧调度与单次启动 | R03 | READY_FOR_QA | 本地执行 Agent / `core/platform/onceInit.ts`（rAF/兜底 once、能力分流）、6 单测、`evidence/m3/TASK-M3-09-R06/attempt-01/`；转换后入口接入待 R20，真机待 R09 |
| R07 | 模块/配置加载超时与失败呈现 | R03、R04 | READY_FOR_QA | 本地执行 Agent / `core/platform/loadGuard.ts`+两个 loadConfig 守卫+启动错误页、8 单测、`evidence/m3/TASK-M3-09-R07/attempt-01/`；web E2E 截图待 R35 |
| R08 | 官方最小包与 A/B/C 对照包 | R04—R07、R19—R21 | TODO | — |
| R09 | 首批失败真机取证与根因闭环 | R01、R08 | TODO | — |
| R10 | 平台读写错误语义 | R02 | DONE | 本地执行 Agent / 新增 SAVE_UNAVAILABLE，TapPlatform.get 超时/IO reject、仅 missing 返回 null、乱序一次 settle；`evidence/m3/TASK-M3-09-R10/attempt-01/`；247/247 PASS；REL-04 契约层关闭，装载闸门待 R11/R13 |
| R11 | 双槽加载/恢复决策 | R04、R10 | DONE | 本地执行 Agent / SaveRepository 四分法+完整元组+UTF-8 字节预算+journal 识别、`tests/unit/saveRecovery.test.ts`（14 例）、`evidence/m3/TASK-M3-09-R11/attempt-01/`；261/261 PASS |
| R12 | 事务提交与未知写入结果 | R05、R11 | IN_PROGRESS | 除指定复现外，本轮新增 `tests/integration/transactionRecoveryMatrix.test.ts`：恢复闸门、预期基线冲突、关闭公司恢复、Store状态/重试；`tapPlatform`延迟原生写fence。A相关56项通过，`evidence/m3/TASK-M3-09-R12/attempt-03/a-green-final.log`，实现前失败证据`a-red-before-fix.json`。A-01—10财务/故障全矩阵、墓碑后失败重启及R15时钟区间验收仍缺，不升级DONE。 |
| R13 | 读档失败重试与启动错误页 | R07、R11、R12 | READY_FOR_QA | 本地执行 Agent / GameStore.inspectForBootstrap+Facade.bootstrapWithStatus 五态闸门+AppView 存档闸门页、`tests/integration/bootstrapGate.test.ts`（5 例）、`evidence/m3/TASK-M3-09-R13/attempt-01/`；296 PASS；浏览器/真机复核待 R35/R39/R09 |
| R14 | 关闭公司故障恢复与旧 run 隔离 | R12、R13 | DONE | 本地执行 Agent / GameStore.replaceWithNewRun 墓碑先行+回读、SaveRepository.commitReplaceRun(journal)、`tests/integration/resetRecovery.test.ts`（5 例）、`evidence/m3/TASK-M3-09-R14/attempt-01/`；301/301 PASS |
| R15 | 在线真实时间/前后台/离线去重 | R12、R14 | READY_FOR_QA | 本地执行 Agent / `core/platform/foregroundClock.ts`、AppView 真实帧 dt+单 attempt 结算+去除无条件保存 toast、`tests/unit/foregroundClock.test.ts`（7 例）、`evidence/m3/TASK-M3-09-R15/attempt-01/`；308 PASS；浏览器/真机复核待 R38/R41 |
| R16 | 正式包平台选择与能力边界 | R03、R10 | READY_FOR_QA | 本地执行 Agent / `core/platform/platformSelection.ts`+buildProfile+PlatformFactory 严格化、4 单测、`evidence/m3/TASK-M3-09-R16/attempt-01/`；构建注入待 R20、zip 断言待 R21 |
| R17 | 登录态检测/失败/离线恢复 | R16 | READY_FOR_QA | 本地执行 Agent / AuthService.checkSession 四态+错误脱敏、`tests/unit/authCheckSession.test.ts`（4 例）、`evidence/m3/TASK-M3-09-R17/attempt-01/`；316 PASS；AppView 接入与真机待 R38/R41 |
| R18 | 隐私内容与首启交互一致 | R17、R25 | READY_FOR_QA | 本地执行 Agent / 政策定稿+`privacyPolicyText.ts` 全文同源+ScrollView 弹窗+拒绝退出+同意先落盘、4 单测、`evidence/m3/TASK-M3-09-R18/attempt-01/`；320 PASS；小屏/真机交互待 R25/R38/R39 |
| R19 | 独立构建目录与真实成功判定 | R00 | DONE | `m3-20261103-diag-e/01` 真实 Cocos Creator 3.8.8 构建，退出码36、完成标志和唯一新鲜 `game.json` 均核实；完整 stdout/stderr、命令/时间戳、result 位于 `evidence/m3/build/m3-20261103-diag-e/01/`。purpose 为诊断包，不代表产品候选 |
| R20 | 统一补丁与一次重打包 | R03、R06、R19 | DONE | 同一 `m3-20261103-diag-e/01` 转换/补丁/单次最终重打包均实际成功；required 补丁锚点各命中1次，`REPACK_OK`；详见 §11.13 与该 release 日志 |
| R21 | 最终 zip 验证/manifest | R20 | DONE | 修复哈希应用入口识别、`game.js` 相对入口解析，并将测试 Mock/MemoryStorage 移出 `assets`；正式回归含哈希入口正例及嵌套 Mock 负例。新鲜 Creator 构建 `m3-20261103-diag-f/01` 的 ZIP 逐项验证通过、增强 manifest 已生成。此包为 `diagnostic`，不满足产品测试候选放行；证据见 §11.14。 |
| R22 | 表现层类型/lint/命令门禁 | R00 | DONE | 本地执行 Agent / `tsconfig.ui.json`（引擎 d.ts 严格检查）+lint 覆盖 scripts+npm check/release-build、修复全部表现层类型错误、`evidence/m3/TASK-M3-09-R22/attempt-01/`；325/325 PASS |
| R23 | 字体/行高/间距/热区基础组件 | R22 | DONE | 本地执行 Agent / `ui/textTokens.ts`（TEXT/SPACE/TOUCH 令牌+ensureTouchSize）+UiFactory（字号下限12、行高1.45、移除默认SHRINK、44×44热区、ScrollView content修复）、`tests/unit/textTokens.test.mjs`（3 例）、`evidence/m3/TASK-M3-09-R23/attempt-01/` |
| R24 | PageShell 安全区与可滚动主体 | R23 | DONE | 本地执行 Agent / `ui/shellLayout.ts`（computeShellLayout 纯函数：逻辑像素→设计单位换算、inset、三尺寸几何）+ITapPlatform.onWindowResize（EditorMock/Tap 实现）+AppView 移除整屏缩放、Body ScrollView 化+Footer 锚底抬升、热 resize 只重算几何保滚动/输入、遮罩 BlockInputEvents 防穿透、`tests/unit/shellLayout.test.mjs`（9 例）、三尺寸+热 resize 截图 `evidence/m3/TASK-M3-09-R24/attempt-01/`；342/342 PASS；真机录屏归 R35—R39（U05），创建三页短屏滚动归 R27 |
| R25 | 可滚动弹窗/输入/确认通用件 | R24 | DONE | 本地执行 Agent / `ui/dialogModel.ts`（ConfirmGuard 状态机 IDLE→SUBMITTING→FAILED/UNCERTAIN→CLOSED、computeDialogGeometry 小屏压缩、computeInputCardY 键盘避让、字数/基础校验）+`ui/dialogs.ts`（Scrollable/Confirm/Input 三通用件：固定标题+底部、正文 ScrollView、遮罩 BlockInputEvents、连点单意图、忙碌/未知不可关闭、ESC/返回键只取消、关闭解绑）+AppView 替换隐私/自定义名/录用/裁员/年报/关司 6 处旧弹窗、`tests/unit/dialogModel.test.mjs`（16 例）、状态图+375×812/360×640 截图 `evidence/m3/TASK-M3-09-R25/attempt-01/`；358/358 PASS；真机键盘遮挡验收归 R35—R39（U05）；未改现金/费用公式/平台登录 |
| R26 | 招聘预览与收费确认事务 | R12、R25 | DONE | 本地执行 Agent / RecruitmentService.previewHire（真实HR折扣/现金前后/生效时点）+GameFacade 只读查询+AppView 首聘与招聘弹窗 preview→confirm→submitting→committed（同意图一commandId幂等/取消零变更/OFFER_EXPIRED重开）、`tests/unit/hirePreview.test.ts`（5 例）、`evidence/m3/TASK-M3-09-R26/attempt-01/`；333/333 PASS；先于 R25 落地（复用裁员确认结构），通用件已于 R25 收敛；真机点击验收待 R37/R41 |
| R27 | 公司/CEO/首聘三步页面 | R04、R05、R26 | DONE | 本地执行 Agent / `ui/createFlow.ts`（姓名/公司名校验、FNV-1a 随机名、CreateSubmitGuard、首聘视图与候选行）+`ui/shellLayout.ts`（computePaneLayout/computeScrollBody 纯函数）+AppView 三步页重写（固定头尾+滚动主体、整卡可点行业/名称、真实 EditBox 保手填、页脚禁用与连点拦截、1/2 重载保持、2/2 完成态「进入公司」）、`tests/unit/createFlow.test.mjs`（15 例）+`tests/integration/createFlowFacade.test.ts`（创建/首聘事务：随机流不推进、单次 30 万注资、幂等、重载恢复、费用勾稽）、三视口逐步截图+状态 `evidence/m3/TASK-M3-09-R27/attempt-01/`；377/377 PASS；真机键盘/安全区验收归 R35—R39（U05） |
| R28 | 公司首页与时间/经营操作 | R15、R24、R25 | DONE | 本地执行 Agent / `core/application/CompanyOverviewService.ts`（首页只读 VM：现金/已结算 YTD 收支/业务资产/产能加成/当月产能与需求/闲置风险/现金风险/三年目标，全部领域同口径）+`InvestmentService`（previewInvest 真实产能·需求·闲置 + commandId 幂等重放）+AppView 首页重写（长名 CLAMP+透明热区、设置独立热区、现金主卡、独立时间区就地重绘不重建、扩产可滚动预览→二次确认→单命令落账、年报入口、目标/风险卡）+只读公司档案弹窗；修复 AutoHireService/annualEvent 可选字段写 undefined 导致月结后 cloneGameState 抛错、所有命令 NOT_READY 的缺陷（重载才恢复），`tests/unit/companyOverview.test.ts`（6 例）+`tests/integration/companyDashboardFacade.test.ts`（5 例，含月结后命令回归）、三视口 25 张截图+G007/G008 证据+财务前后 diff+VM 字段表 `evidence/m3/TASK-M3-09-R28/attempt-01/`；388/388 PASS；真机录屏/触点验收归 R35—R39（U05） |
| R29 | 部门页/贡献/编制/建部 | R24—R26 | DONE | 本地执行 Agent / `core/application/DepartmentOverviewService.ts`（只读部门 VM：人数/月薪/系数/当月估算效益与净贡献、未建部门设立费与建后余额、AUTO 预算；显式 `historicalAttribution:'UNAVAILABLE'`+`valueBasis:'CURRENT_MONTH_ESTIMATE'`，采购/客服/财务/市场/HR 全部复用月结公式，0 员工严格 0）+`GameFacade.getDepartmentOverview`（只读不改状态）+AppView 部门页重写（方针分组、自动预算入口与预览弹窗、已建/未建长列表滚动、卡片操作行编制/招聘/详情、详情弹窗含归因限制/建议人数±/编制切换、建部改为通用确认弹窗且连点单扣）+`tests/unit/departmentOverview.test.ts`（15 例：与 settleMonth 逐元对账、建部幂等/余额不足、切方针/编制不改旧账），`evidence/m3/TASK-M3-09-R29/attempt-01/`（23 项检查全过、22 张截图、三视口 375×812/360×640/390×844、建部 0→5 与连点仅扣 1 万、0 人无效益、采购¥3,830/客服¥470/财务¥1,875 与公式精确一致、方针/编制变更月账逐字节不变）；403/403 PASS；招聘/裁员流程属 R30，真机触点验收归 R35—R39（U05） |
| R30 | 人才列表/筛选/详情/调岗/裁员 | R26、R29 | DONE | 本轮新增筛选/卡片重叠8单位已修：`listTop`由实际筛选行数、44热区、8间距及卡高108计算；新构建375×812/375×834几何交叠0、间距8，375×834点击详情成功；新完整R30浏览器回归45项/27截图/0失败/0页面错误，覆盖375×812、360×640、390×844、0/2/10/30/100人、调岗/裁员/取消/过期/不足额与虚拟复用。证据 `evidence/m3/TASK-M3-09-R30/attempt-09/`、`attempt-08/`、`attempt-10/`。截图已打开检查。R39全页视觉矩阵及设备字体/触控仍未完成；真机待U05/U06/U10。 |
| R31 | 双排行榜与我方摘要 | R24 | IN_PROGRESS | 最新Web双榜/我方摘要流程5/5通过，浏览器错误0；报告与运行日志 `evidence/m3/TASK-M3-09-R31-R32/attempt-12/e2e-report.json`、`evidence/m3/TASK-M3-09-R35/attempt-04/r31-r32-run.log`；100年以上/完整 tie-break 边界及完整领域矩阵仍待补验 |
| R32 | 历史年报/明细/现金资产勾稽 | R25、R28 | IN_PROGRESS | 最新Web年报/历史只读流程与R31共5项检查通过；真实Facade年结投资账桥和重载回归通过；更多旧档/100年边界及全费用场景待补验，证据同R31-R32 attempt-12及 `evidence/m3/TASK-M3-09-R40/attempt-05/longrun120.log` |
| R33 | 离线/危机/教程/设置/音频 | R14、R15、R18、R25、R28、R32 | IN_PROGRESS | 当前Web设置流程6/6通过：设置实际点击、音频偏好读回、公司revision不变、注入写失败后的回滚提示/状态读回、教程重播不改run/revision；错误0，截图已打开检查。证据 `evidence/m3/TASK-M3-09-R33/attempt-02/`。离线摘要/危机救助真实UI、hide/show及资源解码失败仍未验证 |
| R34 | 页面更新/滚动/渲染性能 | R27—R33 | IN_PROGRESS | 固定100员工/6部门Chromium/Web 30分钟长跑180样本PASS；页/倍率动作14次，错误0，节点63—71、listener 0、样本帧p95最大约16.85ms、6帧>50ms、Chrome heap约26—60MB，结束存档revision161/100人可读。完整证据 `evidence/m3/TASK-M3-09-R34/attempt-04/soak-output/`。缺优化前对照、对象分配及Tap设备性能/生命周期验收，仍不DONE |
| R35 | Canvas E2E 驱动/观测/隔离 | R21、R22、R24、R46 | IN_PROGRESS | 驱动器记录PASS/FAIL/SKIP/BLOCKED/TIMEOUT并使非PASS整体exitCode=1，六项驱动器单测通过；R31/R32当前Canvas流程5/5、R33设置流程6/6实跑通过。证据 `tests/tools/canvasDriver.test.mjs`、`evidence/m3/TASK-M3-09-R35/attempt-04/`、`evidence/m3/TASK-M3-09-R33/attempt-02/`。遮挡/禁用/资源破坏/重叠自动侦测及生产hook隔离仍未闭环 |
| R36 | 三行业创建与首年 E2E | R27、R28、R32、R35 | TODO | — |
| R37 | 收费命令/管理流程 E2E | R26、R29、R30、R35 | TODO | — |
| R38 | 持久化/离线/异常 E2E | R13—R18、R33、R35 | TODO | — |
| R39 | 尺寸/长文本/列表视觉验收 | R27—R35 | TODO | — |
| R40 | 经济模拟逐项守恒与长期验证 | R12、R15 | IN_PROGRESS | 900组×60月模拟及120年/1440月存档读回、最近100份年报裁剪/财务桥边界均有通过证据（`evidence/m3/TASK-M3-09-R40/attempt-01/`、`attempt-05/longrun120.log`）；极值输入与R12完整故障矩阵仍未验 |
| R41 | 最终候选真机/性能/音频矩阵 | R09、R34、R36—R40 | TODO | — |
| R42 | 账号资料/素材/版权/商店材料 | R01；成品录屏需 R41 | TODO | — |
| R43 | 同包云端准入与失败回归 | R21、R41；上传需授权 | TODO | — |
| R44 | 版本冻结与发布候选总验收 | R18、R21、R36—R43、R46 | TODO | — |
| R45 | 获授权后提审/发布及状态核验 | R44；明确外部动作授权 | TODO | — |
| R46 | 需求/缺陷/测试证据追踪矩阵 | R00 | TODO | — |
| R47 | 交接、状态回填与剩余事项 | 已执行子任务证据；最终交接需 R44/R45 状态 | TODO | — |

R08、R35 等依赖较大编号任务，这是依赖图而非按表机械排队。**默认策略**：先做最早的可执行本地任务；遇到 R09/R41/R43/R45 的外部条件缺失，登记阻塞后继续其他已满足依赖的本地任务。R47 可随批次维护，不据“交接已写好”声称发布已完成。需要人工复核的证据可 READY_FOR_QA，未满足发布门禁不得闭合 R44。

### 15.3 所有任务共用的实现契约

#### 15.3.1 错误与存档读取

优先保留 `IStorageBackend.get<T>(): Promise<T|null>` 以减少调用面改动：**null 仅代表已确认 key 不存在；timeout/IO/权限失败 reject**。在 `errors.ts` 增加或复用可区分的错误码（建议 SAVE_UNAVAILABLE，details.reason=timeout/io/permission）；不得继续把超时映射 null。§14.5 的 StorageRead 联合类型是概念示意，本轮执行采用此最小接口策略，除非实现者提出更小等价方案并同步契约。

槽位内部检查需返回 FOUND / MISSING / CORRUPT / UNAVAILABLE 四类，CORRUPT 含可诊断原因但不泄漏正文。一个槽临时不可读与一个槽 checksum 已坏不可互换。启动结果显式区分 new-game / loaded / recovered / unavailable / corrupt / reset-pending；是否可写由装载结果控制，不由当前屏幕是否显示决定。

| 条件 | 装载决定 | 允许新建/写入？ |
|---|---|---|
| 相关键均明确 missing，且无未完成事务/墓碑 | 新游戏 | 是 |
| 指针与对应槽的 runId/revision/resetGeneration/checksum 均匹配 | 已提交档 | 是，仍核墓碑 |
| 指针对应槽已证实损坏，另一有效槽且无事务歧义 | 恢复可用旧档，明确提示 | 修复元数据成功后才可写 |
| 墓碑/指针/被选择槽读取超时，或需枚举的槽暂不可读 | unavailable | 否；保留所有槽，重试 |
| 所有已存在槽均确认损坏 | corrupt | 否；不自动覆盖或清空 |
| 墓碑已提交但新档未完成 | reset-pending | 只允许恢复已确认的重开事务，不恢复被关闭旧局 |
| 写回结果未知，不能确认活动指针 | pending-reconcile | 否；先核对，不重扣费用 |

#### 15.3.2 提交确认与有限元数据

`GameStore.current` 只展示已提交状态；mutation 在隔离 draft 上执行，保存确认成功后一次发布。若沿用失败回滚实现，也必须证明 await 期间的公开读取不会看见未提交现金/员工，且异常总会释放锁。

指针必须比对完整 `(slot, runId, revision, resetGeneration)` 与目标信封 checksum；不能仅核 runId。callback fail/timeout 不足以证明底层未写入。为处理断电与结果未知，允许在 SaveTypes 增加 **一个有界可选事务日志键**（建议 `ceo/save/transaction`），内容仅为 protocolVersion、transactionId、kind、basePointer、targetPointer、targetChecksum；不另存整份业务状态。schemaVersion=1 的旧信封、旧 key 与 CRC32 输出保持可读。实现 R12 时落实这项契约和旧档兼容测试，不在三处各造一份 journal。

建议顺序：写并确认 journal → 写非活动槽/回读并验证 → 写指针 → 回读确认目标 → 发布内存结果 → 清理 journal。若最后清理失败，后续通过“目标已匹配”识别已提交，不能重做收费。若指针仍为 base，事务尚未提交；保留旧档并明确失败/回滚候选。若指针不明确或不属于 base/target，停止写入并重试。无 journal 的旧档继续沿用经验证的恢复规则；有未完成 journal 时禁止盲选“最高 revision”。

journal 自身写入结果未知也要回读核对；无法读回不得开始覆盖槽位。恢复过程幂等，清理只针对已确认属于本事务的候选/元数据，不删除其他 run 的档。墓碑后故障必须遵守 §3.5：旧局不能复活；所需新 runId/seed 等恢复元数据可作为向后兼容的墓碑可选字段，需验证旧墓碑缺字段的恢复行为。不能通过“清库再来”消除事务不确定性。正式客户端降级写入 pending journal 的风险在发布兼容说明中列明。

#### 15.3.3 启动、超时与并发

- Boot 阶段从 entry 到 interactive，阶段名见 §14.4；engine-ready、scene-ready、interactive 是不同状态。最前安装诊断，最晚由可点击页面确认 interactive。
- 超时是产生可恢复错误，不是伪成功。每个 callback guard 只有一次 settle；迟到 success/fail 不得改变已取消尝试。
- 每次重试有 attemptId；每个经营回调带 runId；恢复/重开时旧 attempt/run 的资源、月结、保存和弹窗回调全部作废。
- initApp 的 rAF/定时器兜底共用 once；不能因两回调都到而初始化两次。显示超时也不能在后台继续写档后又宣称失败。
- 8秒/12秒等诊断看门狗值只作工程可配置阈值；不能拿它当平台统一规定。需要加载的经营配置必须成功；可选配置回落必须有记录且不伪造登录/隐私内容。

#### 15.3.4 UI 与 ViewModel

统一 ViewModel 只读派生自 GameFacade/Selectors；不把收入/现金/部门节省在 UI 重算一套。新增只读查询可落 `assets/core/application/`，不引入第二财务引擎。当前阶段无 Selector 文件可直接复用时，小范围新增并给出纯函数测试。

文字工厂显式区分 heading/body/caption/money/single-line。默认禁止自动缩字掩盖空间不足；辅助文字有效字号≥12，正文14–16，按钮实际热区≥44×44。采用顶部锚点+内容自适应高+父布局更新；不同屏幕保持正文与热区，不整体缩小整页。间距/组件规格以 §14.7 为默认值。暂不更换品牌、字体或引入收费素材。

确认流程统一 `preview → confirm → submitting → committed/error/unknown`。preview 带当前 run/revision、费用、余额、生效时点；确认重验，变化需重新确认。一个确认意图生成一个 commandId，重复点击/网络重试复用；未知提交先核对结果。成功后仅一次反馈；取消不产生业务命令。危险操作不默认获得确认焦点。

#### 15.3.5 每项任务的证据与完成条件

每项在 `evidence/m3/TASK-M3-09-Rnn/<attempt>/` 输出真实证据，至少包括 task-result.json（完整任务 ID、源码基线/dirty摘要、命令/退出码、用例 ID、结果、时间和路径）；修改 UI 另留前后截图/交互视频，涉及金额另留脱敏 state/ledger diff。单纯文档类任务只需内容/路径核对，不强制跑业务测试。

任务卡中的 `T01/T02` 完整用例名为 `Rnn-T01/Rnn-T02`。新测试最终放 tests/ 或正式 tools/ 入口，旧 evidence 中的审计脚本是定位资料，不直接变成生产依赖。没有工具/设备/账号时写明确缺口，不制造空 JSON 或图片占位。

DONE 的最小条件：实现契约落地 + 对应验收实际通过 + 相关回归通过 + 任务表和追踪矩阵回填。UI/存档/包体/真机各取对应证据，互不替代；不因为任务被拆得很细就对每项机械重复全部 900-run。完成相关业务批次/发布候选时再跑全量门禁。

### 15.4 基线、启动和平台兼容任务卡

#### TASK-M3-09-R00｜登记可重现工作基线

- 前置：无。输入：AGENT、README、§11/§14、现有证据；范围：文档账本与本任务证据，不改业务。
- 步骤：①记录 git 分支/HEAD/status，识别本轮之前的文档和 evidence 改动；②记录实际 Node/npm/Creator/插件版本与可执行位置；③登记现有 zip 的大小、哈希、game.json、现有 web 构建时间；④确认 package scripts 与依赖可用；⑤登记本轮 releaseId 命名和证据目录规则。
- T01：重复采样未改动 zip 得到同一 SHA256；T02：其他聊天/用户改动仍完整存在；T03：账本能区分源码 HEAD、未提交内容、旧 web 与旧 zip，未用一个“版本号”混称。
- 交付：baseline.json + 当前工作区摘要；无凭据值。后续任务引用这个基线，重读并发变动，不以旧摘要覆盖新修改。

#### TASK-M3-09-R01｜建立后台包与本地包对应、收集缺口

- 前置：R00；输入：用户截图/日志、§17。范围：包记录/资料索引，后台只在已授权权限内读取。
- 步骤：①登记 screenshot 的 1.1.0 与本地 productVersion=1.0.0；②索引平台包记录、上传时间、zip 哈希/原始文件（能取得的项）；③按设备列测试结果及日志是否齐全；④将缺少的两项性能详情、Redmi/vivo日志、用户设备规格列为待补；⑤按 §17 标记字段必需阶段，不索取密码。
- T01：不能建立身份对应时显式 unknown，禁止猜同包；T02：一个机型日志不冒充三机型；T03：资料清单有来源/时间/缺失项，其他本地任务可继续。
- 交付：package-device-map.json 和 §17 状态更新。DONE 指“对应关系与未知项登记准确”，不代表所有外部资料已收到。

#### TASK-M3-09-R02｜把已复现缺陷变成有判定的回归夹具

- 前置：R00。范围：现有 tests、正式测试 helpers；参考三个 audit.cjs，不复制其中固定浏览器坐标作长久业务契约。
- 步骤：①保存旧代码在 TextEncoder/structuredClone 缺失、tap.getStorage 不回调时的结果；②提供受控时钟/回调宿主，能安排迟到/重复/不回调；③构造旧档、损坏槽、未完成事务与跨 run 夹具；④新回归断言期望安全行为，先确认在旧实现上失败，修复后转绿；⑤清理测试副作用，不向生产注入全局 hook。
- T01：故障关闭时原有流程通过；T02：故障打开可稳定重现对应问题，输出 reason；T03：每个 test 独立存储/seed；T04：无固定 sleep 冒充已完成 callback。
- 交付：复现日志、夹具入口、失败/成功判定说明；后续 R04/R05/R10/R12 共用，不各自实现不同假平台。

#### TASK-M3-09-R03｜安装引擎前诊断和启动状态机

- 前置：R02。范围：tools 启动模板、BootTrap、Bootstrap、AppView.start；不直接手工改当前发布 zip。
- 步骤：①从 game.js 最早位置安装有界错误缓冲/平台错误监听；②记录 entry/adapter/module/engine/scene/config/save/interactive；③为重试分配 attemptId；④AppView 完成 UI/事件绑定后发 interactive；⑤调试输出阶段与首错，正式版只呈现错误编号和恢复入口；⑥去除通过 scene 直接找 AppRoot 的误判。
- T01：业务模块导入前 throw 仍可留下首错；T02：仅 engine init 成功不能置 interactive；T03：启动正常看门狗失效，无迟到误报；T04：日志有上限且不含 code/token/存档正文。
- 交付：阶段事件样本、失败/正常用例；原 BootTrap 若保留只作引擎后补充，不承担早期捕获。

#### TASK-M3-09-R04｜消除 CRC32 对宿主 TextEncoder 的硬依赖

- 前置：R02。范围：`persistence/crc32.ts`、建议 utf8.ts、相关单测；不修改 canonical 序列化/CRC32 多项式/黄金账。
- 步骤：①实现可在无 DOM/无 TextEncoder 的纯 TS UTF-8 编码；②孤立代理项按标准替换语义处理；③crc32String 复用；④用旧真实信封样本验证 checksum 不变；⑤回跑缺能力启动探针。
- T01：ASCII/中文/emoji/组合字符/空串/孤立高低代理项字节与标准 encoder 一致；T02：固定 CRC32 已知向量与旧档全部一致；T03：删宿主 TextEncoder 仍能导入核心、校验旧档与写新档；T04：存档预算按 UTF-8 字节计。
- 交付：输入→字节/CRC 对照与旧档兼容报告。不能改 checksum 预期来容忍编码错误。

#### TASK-M3-09-R05｜状态深拷贝与异常锁释放

- 前置：R02。范围：GameStore 与有限 cloneGameState helper；测试侧 MemoryStorage 可复用同契约。
- 步骤：①明确 GameState 为可序列化 JSON 数据，不含 Map/Date/循环；②提供无 structuredClone 的确定深拷贝并检查非法数据；③把获取锁后的所有可能异常纳入 try/finally；④错误后内存/revision 恢复；⑤为 R12 隔离 draft 留接口，不提前重做提交算法。
- T01：无 structuredClone 仍创建/招聘成功；T02：复制后嵌套员工/数组互不引用；T03：模拟快照抛错，第二个有效命令仍可执行；T04：没有把 undefined/NaN/Infinity 等错误数据悄悄转成不同业务值。
- 交付：兼容与锁释放回归；不安装行为不全的全局 structuredClone 假实现。

#### TASK-M3-09-R06｜确保 initApp 能启动且只启动一次

- 前置：R03。范围：入口模板/patch 启动片段，不在多个转换后文件各写不同分支。
- 步骤：①确认当前官方入口与画布尺寸读取顺序；②以 once 包装 init；③rAF 可用时等待必要帧，并配置定时兜底；④rAF 缺失/不回调/两路都到时均有明确行为；⑤失败不重复初始化；⑥按实际平台而非品牌文字分流。
- T01：rAF 缺失仍进入一次 init；T02：rAF 仅注册不回调时兜底生效；T03：两回调均到 initCount=1；T04：画布尺寸延迟后正确，iOS/Android/未知 platform 的分支有记录；T05：init throw 被 R03 捕获。
- 交付：帧调度契约测试。模型通过不关闭真机任务 R09。

#### TASK-M3-09-R07｜资源和配置加载可超时、可重试

- 前置：R03、R04。范围：loadConfig/loadRuntimeConfig、模块加载链、AppView 启动错误呈现。
- 步骤：①必需 economy 配置加载/校验失败阻断业务；②可选 runtime 缺失与内容非法分别记录；③每阶段 callback/Promise 有限时并取消旧 attempt；④资源路径/错误码进诊断，敏感值不入日志；⑤失败页仍能点击重试/退出，不能仅结束首屏留下黑屏。
- T01：资源404/回调丢失/无效JSON/经济配置校验失败均到对应错误页；T02：重试成功只建一套 UI/时钟；T03：失败尝试迟到不能再打开旧弹窗/写档；T04：有配置URL不代表已成功登录/隐私已确认。
- 交付：阶段失败截图与回调断言；如无法在引擎前呈现 Cocos UI，采用平台可用提示渠道，不依赖真实 DOM。

#### TASK-M3-09-R08｜创建 A/B/C 对照包并保留差异

- 前置：R04—R07、R19—R21。范围：独立 diagnostic 构建配置/最小场景和证据，原 Game.scene 与旧 zip 保留。
- 步骤：①A 官方转换最小场景不带业务/自定义首屏；②B 加入真实领域/配置/业务入口；③C 再加自定义首屏；④每包单独 releaseId/manifest/哈希，差异清单明确；⑤每包有同样的阶段诊断；⑥只在实际依赖需要时导入真实模块，不把B做成空壳伪通过。
- T01：三包入口与版本/差异可解包复核；T02：使用同引擎/插件与目标配置；T03：构建失败不回退复用上一个 A/B/C 包；T04：本地可运行与真机结果分列。
- 交付：三包与比较表；没有手机时状态 READY_FOR_QA/对应真机 NOT_RUN，不虚构成功。

#### TASK-M3-09-R09｜在失败设备取得首个失败阶段并修复

- 前置：R01、R08；外部：§17 的设备、测试权限、日志/调试能力。范围：按首错定向修复，不先升级全部依赖。
- 步骤：①同一失败机型顺序跑 A/B/C；②取首错堆栈、阶段、API能力、容器版本与资源路径；③依 §14.4 分支定位宿主/适配器/业务/首屏；④最小修复并复跑相同机型相同流程；⑤补根因回归，记录证据能覆盖的设备。
- T01：至少一台原失败设备从失败到可交互有前后证据；T02：修复不是隐藏异常或删除加载文案骗OCR；T03：最小包也失败则产出可供平台工单的本地材料，不擅自发送；T04：其他失败机型尚未测仍列未测。
- 交付：根因说明（证实/排除/未知）、补丁与设备日志。无设备时 BLOCKED，列明资料编号并继续其他本地任务；不能将候选 API 缺失当作已证实设备原因。

### 15.5 存档、生命周期与身份任务卡

#### TASK-M3-09-R10｜平台读取错误不再冒充 key 不存在

- 前置：R02。范围：TapPlatform、错误码/文案及平台单测，契约见 §15.3.1。
- 步骤：①识别官方明确 missing 响应；②timeout/IO/权限失败保留类型；③success 数据结构非法按错误，不任意判空；④get/set/remove 回调限时且一次 settle；⑤更新受影响调用者，不改变隐私/认证错误为经营首建。
- T01：missing→null；timeout/IO→拒绝；T02：success/fail/complete乱序或重复仅一次结果；T03：超时后迟到结果不发起写入；T04：既有成功读写保持兼容。
- 交付：接口行为表和回归；仅添加日志、保留 resolve(null) 不满足验收。

#### TASK-M3-09-R11｜双槽加载与恢复遵守已提交事实

- 前置：R04、R10。范围：SaveRepository/SaveTypes/stateIntegrity及saveRepository测试。
- 步骤：①槽读取四分法；②校验指针元组/信封/墓碑代际；③仅证实损坏时回退，暂不可读先重试；④记录恢复原因，修指针失败不开放可写业务；⑤加入 R12 所需 journal 识别接口；⑥大小预算改为真实 UTF-8 字节，旧档字段不变。
- T01：全missing才能新建；T02：坏指针/一槽坏另一槽好可恢复；T03：被选择槽或墓碑超时不按空档；T04：相同run但revision/generation不匹配不能直接信任；T05：中文/emoji档接近500KB按字节准确判定；T06：旧v1档可加载。
- 交付：完整恢复决策测试。对“最高revision恢复”的旧测试只在补充事务证据后细化场景，不删除原有恢复能力。

#### TASK-M3-09-R12｜提交结果未知时核对、隔离 draft

- 前置：R05、R11。范围：GameStore、SaveRepository/SaveTypes、错误状态；遵守 §15.3.2，新增有界元数据只在此任务定义。
- 步骤：①draft执行而不污染公开current；②journal准备/确认；③目标槽写入+完整回读校验；④指针写入+回读确认；⑤成功才发布state/revision；⑥未知结果冻结写入，reconcile后决定成功/失败；⑦清journal失败可下次幂等清理；⑧旧无journal档兼容。
- T01：await写盘时UI只能读已提交值；T02：指针实际写成但回调fail→核对后只一次成功；T03：目标槽写成但指针未切→不把未提交收费复活；T04：断在每个await后重启结果确定或明确待核对；T05：journal读写失败不覆盖其他有效槽；T06：再点击同command不重复收费。
- 交付：逐断点状态/指针/journal对照及事务测试。未知结果不能简单catch回滚后立即再扣一次。

#### TASK-M3-09-R13｜读档错误 UI、重试与写入闸门

- 前置：R07、R11、R12。范围：GameFacade.bootstrap、AppView启动编排、错误/恢复页。
- 步骤：①显式装载结果映射页面；②unavailable/corrupt/pending时不创建可写facade或开启时钟；③提供重试/退出，恢复旧档显示原因；④重试仅一个attempt；⑤只在confirmed-new-game展示创建公司；⑥提示与实际状态一致。
- T01：原有公司→所有读取不回调→无新公司入口/无写入→恢复回调→原run/现金/员工恢复；T02：连续点重试不叠加bootstrap；T03：损坏档不自动清空；T04：窗口关闭或回后台后旧attempt不能复活。
- 交付：修复后的 storage-timeout 探针结果+失败/恢复录像。原“phase=CREATING且run变了”的结果必须消失。

#### TASK-M3-09-R14｜重开事务在任意失败点可恢复

- 前置：R12、R13。范围：ResetService、GameStore.replaceWithNewRun、墓碑与关闭UI；不删平台账号/认证记录。
- 步骤：①服务器式确认token不是当前目标，先落实本地preview与提交一致/60秒失效；②生成一次新run/seed，必要元数据随墓碑可恢复；③墓碑前失败旧局不变；④墓碑后禁止旧局复活，新局未提交时展示恢复中；⑤清旧槽失败可重试，不能误删新槽；⑥清空本轮UI临时状态和应重置设置。
- T01：取消无任何业务写入；T02：墓碑/新槽/指针/清旧槽各失败后重载安全；T03：关闭与月结/招聘并发不产生混合run；T04：旧回调无法覆盖新run；T05：旧墓碑无新增可选字段仍安全恢复；T06：Tap账号状态不被当作经营数据删除。
- 交付：B03/A25扩展证据与状态转移表。墓碑已成功后不能显示“重开取消成功”并继续旧局。

#### TASK-M3-09-R15｜真实时间、切后台与离线只结算一次

- 前置：R12、R14。范围：AppView.clockTick/onHide/onShow、GameFacade、GameClock/offline；经济时间参数不变。
- 步骤：①用注入时间源计算前台真实elapsed，禁止始终传200ms；②记录前后台边界，后台时停止在线推进；③前台先离线结算/持久化，再恢复在线水位；④重复onShow合并并去重；⑤保存提示跟随真实提交结果；⑥测量持久化频率，优化不得丢月或改变暂停语义。
- T01：回调阻塞后elapsed正确且月份不重结；T02：1×/2×/5×/暂停及切档进度符合既有规则；T03：后台8h/40h封顶、时间回拨、零散余量与暂停离线均一致；T04：快速切换10次只一次离线领取；T05：写失败不toast已保存；T06：新run不消费旧水位。
- 交付：可控时钟测试与前后台状态/ledger diff。改变倍速进度储存语义须先查 §4 既有契约，不为方便擅自调整。

#### TASK-M3-09-R16｜正式包平台探测失败不能进入 EDITOR

- 前置：R03、R10。范围：PlatformFactory、TapPlatform、构建标识与平台能力声明。
- 步骤：①构建时注入正式平台kind；②生产Tap缺必需能力明确报错；③可选能力单独探测，不能“少一个可选方法即降级整个平台”；④Editor/Web预览仍可使用CocosPlatform；⑤日志记录能力布尔值，不记录设备身份值；⑥启动阶段连接R03。
- T01：正式包缺tap/缺存储能力→PLATFORM_UNAVAILABLE；T02：正式包不会返回mock会话；T03：预览仍可运行；T04：缺可选网络探测只降为unknown；T05：正式zip不存在测试替代平台入口。
- 交付：平台选择矩阵+最终包静态验证用例。

#### TASK-M3-09-R17｜真实平台登录态与离线失败路径

- 前置：R16。范围：ITapPlatform、TapPlatform、AuthService和登录UI；默认不部署新后端。
- 步骤：①核对官方checkSession回调并加超时guard；②隐私同意后再登录；③平台态复用前校验，不靠本地30天TTL；④过期重新login，拒绝/断网给重试；⑤已有有效本地档可本地玩法但不标认证成功；⑥有明确authEndpoint时保留现有交换分支，标记独立测试。
- T01：checkSession有效/过期/无回调/失败分别处理；T02：无端点不外发code、不保存身份令牌；T03：授权拒绝不丢档；T04：预览mock不复用到正式环境；T05：日志不含code/session/Secret；T06：断网后恢复在线可重试。
- 交付：单测、登录状态UI、真机待验清单；平台checkSession不支持时显式能力错误并走可解释重登路径，不伪造成功。

#### TASK-M3-09-R18｜隐私政策、拒绝入口与版本化同意

- 前置：R17、R25；外部：§17 的政策公开信息/URL。范围：隐私md/html、首启弹窗、设置政策入口、runtime配置。
- 步骤：①全文清除正文占位并核对真实登录/存储/第三方行为；②首启可阅读完整政策、同意、拒绝退出；③同意落盘成功前不调用登录/外发；④已同意版本恢复不再弹，policyVersion改变重新告知；⑤设置可访问政策；⑥正式配置不再由包卫生测试强制等于空串，改验合法配置与无密钥。
- T01：拒绝后无登录/业务新建/外发；T02：同意写入失败明确重试；T03：旧版本同意不覆盖新版要求；T04：长政策小屏可滚动、操作可点；T05：政策URL缺失时内部可完整阅读，不以复制空URL作完成。
- 交付：政策核对清单、隐私交互证据。未确认开发者公开信息/域名时本地UI可先做好，发布状态仍阻塞，不代填虚构联系方式。

### 15.6 构建与检查管线任务卡

#### TASK-M3-09-R19｜在独立目录构建并拒绝旧产物

- 前置：R00。范围：build-web.ps1/build-tap.ps1、必要构建配置，不清理用户整个build或关闭其他人的进程。
- 步骤：①统一releaseId、显式GameVersion与输出目录参数；②每次创建新工作目录；③检查Creator路径/版本/单实例锁，冲突明确失败；④记录构建起止时间、实际命令、退出码、日志；⑤按本机已验证的Creator退出规则和新产物共同判定；⑥Windows Start-Process使用隐藏窗口；⑦保留原zip，不原地覆盖上传候选。
- T01：故意填错误Creator路径/配置立即失败；T02：旧game.json存在但新构建失败不能成功；T03：重复releaseId被拒或创建显式新attempt，不混入旧文件；T04：路径含中文/空格可执行；T05：任何清理只针对已核对的本任务绝对路径。
- 交付：成功/失败构建日志、产物目录树。未经授权不终止编辑器进程、不安装另一版本引擎作为“修复”。

#### TASK-M3-09-R20｜转换、补丁、诊断、首屏只有一条流水线

- 前置：R03、R06、R19。范围：convert-tap、patch-splash、diag-inject、repack-tap与模板；插件源码原则上不改。
- 步骤：①明确官方转换生成文件→兼容补丁→可选诊断/首屏→验证→最终打包；②补丁读取本次实际hash引用，不硬编码旧文件；③每个必要补丁断言命中数与目标形态；④兼容补丁重复应用结果一致；⑤diag不单独调用Windows ZipFile；⑥本任务目录外产物不受影响。
- T01：漏命中/多命中/已不适用三种情况可区分，不静默继续；T02：两次补丁输出字节一致；T03：正式包关闭调试弹窗但保留必要错误恢复；T04：诊断版含早期阶段与正确ready；T05：所有zip只经同一打包器生成。
- 交付：补丁报告（文件/版本/命中/前后hash）与流水线回归。生成包里实际内容比对，不只检查日志CONVERT_OK。

#### TASK-M3-09-R21｜解最终 zip 校验并生成 manifest

- 前置：R20。范围：新增正式包校验工具、manifest、包体卫生测试；不借机公开AppID/Secret配置。
- 步骤：①对zip本体解包至本次证据目录；②检查根文件、重复/绝对/..路径、分隔符、大小写与引用存在；③核gameVersion/平台/配置版本；④识别历史main/config残留与不可达资源，先报告再从构建源消除；⑤检查无Mock/测试写入口/密钥；⑥包体字节门禁；⑦生成§14.6字段完整的manifest，zip与目录可对应。
- T01：故意漏资源/错版本/反斜杠/重复条目/错误引用均失败；T02：篡改zip一字节hash变化并使旧报告失效；T03：正式包不含测试改状态hook；T04：manifest不把ZIP内含manifest的自引用hash算成死循环（zip哈希写外部manifest）；T05：最终解包结果与补丁契约一致。
- 交付：manifest.json、package-check.json、entry-list及测试结果；未运行真机时不输出“兼容验收通过”。

#### TASK-M3-09-R22｜把 Cocos 表现层纳入真实检查

- 前置：R00。范围：package.json、tsconfig、ESLint、CI（若已有），不得覆盖Creator生成目录手工伪造cc声明。
- 步骤：①确认Creator导出的类型配置/cc声明实际路径；②保留core独立检查；③增UI检查入口包含assets/scripts及引擎类型；④增相应lint范围；⑤新增真实build/package/E2E scripts逐条指向实现；⑥文档区分已存在命令和待实现入口，缺依赖显式报错。
- T01：UI里放临时类型错误可被UI检查捕获后恢复；T02：core检查不依赖Creator运行；T03：无Creator类型时给环境错误，不靠any stub通过；T04：新脚本在Windows中文路径可跑；T05：现有合法核心测试保持通过。
- 交付：脚本列表/实际输出与检查范围说明；只改script名称不执行检查不算完成。

### 15.7 UI 基础与逐页落地任务卡

每张页面卡至少输出 360×640、390×844、428×926 三组截图，另测安全区与键盘（涉及输入时）。测试在新构建上执行；旧web截图只作前态参考。视觉检查按“实际有效字号/热区/间距”评估，不能只读设计常量。

#### TASK-M3-09-R23｜文字、间距和触控基础规范

- 前置：R22。范围：theme.ts/UiFactory.ts、最小组件演示场景或开发测试页。
- 步骤：①把字号/行高/间距/颜色/按钮尺寸变成语义token；②createLabel新增明确overflow、maxLines/clip策略和顶部锚点支持；③单行高度至少容纳行高，多行测量后撑父容器；④普通文字不默认SHRINK；⑤按钮视觉与热区可分但不可互相覆盖；⑥旧调用逐步迁移并标记待处理项。
- T01：12/14/16字号长短文本无隐性缩字；T02：中文/emoji/负金额/长数字不压邻居；T03：按钮有效热区≥44且间隔≥8；T04：内容变高后Graphics背景和点击区同步；T05：不因改默认值让旧页按钮文本消失。
- 交付：组件对照图、几何报告、迁移调用清单。正文最低字号必须按截图和引擎测量共同确认。

#### TASK-M3-09-R24｜固定头尾、滚动主体与安全区

- 前置：R23。范围：PageShell/SafeArea、AppView.buildRoot/fullPanel/renderMainShell；不更改领域时间/财务。
- 步骤：①统一平台逻辑像素→设计单位换算；②Header/Footer按真实安全区锚定；③Body取剩余高并ScrollView；④不再把812高整页缩成640；⑤窗口/横竖屏/安全区变化时重新布局；⑥保留当前Tab、滚动位置与输入，不重启业务；⑦注销布局监听。
- T01：三尺寸头尾/内容均可达；T02：顶部缺口/底部手势区/横向inset不压按钮；T03：热resize后导航仍可点；T04：拖动Body不触发底层按钮；T05：弹窗打开时正文滚动与页面滚动不串。
- 交付：安全区变换测试、三尺寸和热resize录屏；不能只证明节点存在而未证明屏幕内可点。

#### TASK-M3-09-R25｜弹窗、输入与确认操作通用件

- 前置：R24。范围：ConfirmDialog/ScrollableDialog/InputDialog，替换AppView相关工厂调用。
- 步骤：①遮罩阻止穿透；②标题/底部操作固定，正文内容自适应并可滚动；③输入框有标签/校验/字数，键盘弹出后滚动可见；④confirm忙碌态/禁重/取消/错误/结果未知统一；⑤关闭时解绑监听，避免旧run回调重开；⑥Android返回键按平台能力处理，不能触发危险确认。
- T01：最长政策/赔偿/关闭摘要小屏滚动且确认取消可达；T02：点击遮罩不误确认/穿透；T03：快速点确认只发一个意图；T04：提交中/未知状态不能通过关闭弹窗悄悄重试收费；T05：输入法结束后内容和按钮保留。
- 交付：通用状态图、长内容/键盘/连点证据。组件不自行修改现金或调用平台登录。

#### TASK-M3-09-R26｜招聘预览→确认→持久化→反馈

- 前置：R12、R25。范围：首聘/运营招聘UI、招聘查询/命令接口、候选展示。
- 步骤：①从领域读取真实HR折扣费用/候选/岗位/生效时点；②预览显示立即扣费、未来工资、余额和必要影响；③确认时复核run/revision/offer/candidate/余额；④一个意图一个commandId，失败重试复用；⑤结果未知走reconcile；⑥成功反馈一次并刷新offer，取消不落业务写入。
- T01：点击录用仅开预览，取消现金/员工不变；T02：确认准确扣一次费用并保存；T03：10次连点/重试/迟到回调不重复录用；T04：预览期间现金或offer变化要求重看；T05：首聘第1月生效、后续次月生效，HR折后费用与预览一致。
- 交付：G006/B04及正常招聘UI状态/账本证据；禁止预览用UI自己猜费用，提交用另一套公式。

#### TASK-M3-09-R27｜公司、CEO、首聘三步页面

- 前置：R04、R05、R26。范围：S01—S03相关AppView片段/可提取页面、现有命名验证。
- 步骤：①公司行业选项、说明、随机名称、自定义与操作分组，间距按§14.7；②CEO增加真实EditBox自定义姓名，随机/性格状态返回仍保存；③初始能力三项分列/换行；④首聘候选可滚动，属性/工资/招聘费按行展示；⑤已聘/现金与底部继续固定；⑥本轮创建命令只在既有正确步骤发出一次。
- T01：行业切换/换批/公司自定义不污染市场随机流；T02：空值/空白/控制符/超长/emoji按既有规则处理；T03：CEO随机与手填可选择、上一步不丢；T04：1/2首聘强杀重载保持，仅2/2可继续；T05：三行业UI均能完成且初始资本只一次。
- 交付：三尺寸逐步截图、输入与恢复录像、run/资本/首聘费用记录。不得通过缩短所有公司名绕开排版。

#### TASK-M3-09-R28｜公司首页、时间与经营操作

- 前置：R15、R24、R25。范围：T01、扩产/指标说明、只读首页VM。
- 步骤：①长公司名给完整详情，设置独立热区；②现金主指标、营收/利润附指标，明确累计/预计语义；③时间控件单独区域；④CEO与团队、业务资产/产能、报告入口分组；⑤盈利目标/风险提示可读；⑥扩产预览走真实查询，显示闲置风险与余额；⑦暂停/倍速反馈更新不能重置滚动或重建整页遮挡。
- T01：大额/负利润/长名不压设置；T02：1×/2×/5×/暂停实际生效并保存；T03：扩产前取消不扣，确认现金−投资、资产+投资，总资产当时不变；T04：需求不足显示风险；T05：达三年盈利后可继续经营。
- 交付：VM字段表、G007/G008/UI录像和财务前后diff。主金额不能用截断值回写。

#### TASK-M3-09-R29｜部门页、真实贡献与编制操作

- 前置：R24—R26。范围：T02/部门详情、DepartmentService相关只读预览；当前收益不足字段先核领域可用数据。
- 步骤：①方针按钮与说明分组；②六部门列表滚动；③每卡显示人数、工资、已实现节约/新增边际贡献、支出与净贡献；④成本解释复用领域计算/账本归因，不重复加到总利润；⑤操作行放编制/招聘/详情，有间隔且不越卡；⑥建部显示费/余额/0人无收益；⑦开启AUTO预览预算，手动锁定不自动裁员。
- T01：从0到5支持部门所有入口可达；T02：创建同部连点只扣一万一次；T03：0人效果0；T04：采购/客服/财务归因与G004/G014—G017一致；T05：无足够归因数据的历史不能捏造“实际收益”，明确不可用或只显示已有可核项；T06：方针/编制改变不重写旧账。
- 交付：部门VM/费用来源映射、长列表与收费证据。归因需要新增派生数据时保持旧档读取兼容，不回填伪历史。

#### TASK-M3-09-R30｜人才列表、筛选、详情、调岗和裁员

- 前置：R26、R29。范围：T03/D02/调岗裁员弹窗，LayoffService/TransferService查询。
- 步骤：①显示在职数/预计工资，支持部门筛选和明确招聘入口；②员工卡信息分层、列表可滚；③>30条按项目要求做复用/虚拟化；④详情展示能力/潜力/协作/性格/工资/任期；⑤调岗预览前后影响与次月生效；⑥裁员预览补偿月数/金额/产能变化/余额，确认按token和费用复核；⑦正确处理空列表/筛选无结果。
- T01：0/2/10/30/100员工末项可达、复用不串员工；T02：部门筛选和总数/工资准确；T03：裁员取消零变更，确认仅一次赔偿，下月停薪；T04：调岗下月生效无双重工资/产能；T05：确认过期/不足余额/员工已变动均拒绝；T06：系统从不自动裁员。
- 交付：G005/B07及长列表/筛选/跨月状态证据。测试大列表通过专用开发夹具构造，不能在正式包留任意造员工入口。

#### TASK-M3-09-R31｜双排行榜可读且含义正确

- 前置：R24。范围：T04与现有排行榜查询；不接真实服务器排名。
- 步骤：①双榜切换；②我方摘要固定、列表滚动；③名称和金额列预留宽度，完整名称可查看；④“本地模拟企业”提示保持可见；⑤已完成年数与资产口径来自既有查询；⑥重开清除我方旧成绩。
- T01：两种排序和tie-break与领域结果一致；T02：资产=现金+未折旧业务资产，非累计收入；T03：长名/大额/我方不在首屏仍可定位；T04：切榜不改变任何经营状态；T05：重开不继承旧局我方成绩。
- 交付：双榜截图/查询值比对；不用页面硬编码假名次作验收。

#### TASK-M3-09-R32｜历史年报、费用明细与现金桥

- 前置：R25、R28。范围：D01、报表VM/查询；annualReports仍是不可改历史快照。
- 步骤：①明确年份选择，默认最近完成年度，可访问最近100年；②收入/经营成本/工资/一次性费用/事件/折旧分组；③零项可折叠但总计不变；④利润、期初末现金、资本性投资/注资、资产勾稽；⑤空态/亏损/无归因历史分别展示；⑥正文滚动、关闭固定，金额不缩成微字。
- T01：100份历史可选而非始终years[0]；T02：每年展示值与冻结报告一致；T03：费用逐项之和与利润、现金桥与期末现金、资产构成相符；T04：资本投入不作营业收入，折旧不重复扣现金；T05：小屏展开全部项目仍可关闭；T06：看旧年报不触发新奖励或再结算。
- 交付：报告字段来源与会计等式对照、亏盈/长历史截图；缺历史明细不得从当前员工工资反推旧账冒充真实。

#### TASK-M3-09-R33｜离线、危机、教程、设置和音频闭环

- 前置：R14、R15、R18、R25、R28、R32。范围：D04—D07、教程/AudioManager现有开关；复用现有16个音频。
- 步骤：①离线摘要显示实际月数/上限/现金/利润/事件，重复打开不结算；②危机展示缺口和费用入口，救助一次/不计利润；③教程可跳过/断点/重播且不再首聘；④设置分组，版本来自构建信息；⑤音频总/音乐/音效状态按既有契约持久化，重开策略读音频基线；⑥后台停止/前台恢复、同BGM切页不重启，1×/2×/5×不改音调；⑦隐私入口接R18。
- T01：离线8h/40h、暂停/回拨/余量准确；T02：救助连点只+10万资本、利润不变；T03：教程重播不创建公司/不扣费；T04：总开关关闭立即全静音，重启状态保持；T05：无音频或解码失败可静音经营而非阻塞启动；T06：关闭公司按约定重置本轮教程/音频偏好且不注销账号。
- 交付：交互状态与离线/救助账本、浏览器音频状态证据；真机听感/接缝由R41验证，不提前标通过。

#### TASK-M3-09-R34｜减少重建与长列表渲染开销

- 前置：R27—R33。范围：UI订阅/渲染更新、列表复用、Graphics/Label；不改变自动经营频率或经济结果。
- 步骤：①先采集稳定页/滚动/跨年/切页的帧时间、节点/绘制、内存、对象分配与保存频率；②保留当前Tab/选择/滚动位置；③只更新变化字段，不月结整屏销毁；④列表回收/事件解绑；⑤启动首屏释放WebGL对象且无循环残留；⑥同条件比较优化前后。
- T01：30分钟运行节点/监听/内存不持续增长；T02：快速切页/反复开关弹窗无幽灵点击；T03：百员工滚动无明显卡死且业务结果不变；T04：用固定seed回归年报/费用一致；T05：性能改动未降低字号、删功能或靠隐藏统计伪通过。
- 交付：基准前后数据与已知设备限制；浏览器优化有效不等于平台两项性能异常已关闭。

### 15.8 自动化、真机和发行收口任务卡

#### TASK-M3-09-R35｜建立稳定 Canvas E2E 驱动

- 前置：R21、R22、R24、R46。范围：正式tools/e2e runner、开发观测接口、测试夹具；复用现有playwright-core，未声明存在@playwright/test依赖。
- 步骤：①测试启动明确新web构建/manifest；②浏览器上下文隔离存档；③以稳定页面/节点/actionId识别目标再算实际屏幕坐标点击；④提供只读状态/可控测试时钟/受控故障注入的开发入口；⑤每步等待可观测phase或命令完成；⑥截图/console/pageerror/资源错误/前后状态/录像失败留档；⑦测试出口汇总并返回非零失败码。
- T01：同seed重跑结果稳定，测试间不共享存档；T02：故意把按钮禁用或遮挡应FAIL，而不是直接调facade绕过；T03：命令层直接推进与真实UI操作在结果中分栏；T04：正式包不含写状态/造钱hook；T05：favicon噪音可精确过滤，其余资源错误不一概忽略。
- 交付：使用帮助、一个正常与一个故意失败示例、机器可读报告。坐标适配来自实时布局，不照抄旧375×812绝对屏幕点。

#### TASK-M3-09-R36｜三行业完整创建与首年经营 E2E

- 前置：R27、R28、R32、R35。范围：创建/首聘/时间/年报测试；用固定seed与真实候选工资算预期。
- 步骤：①每行业全新上下文，实际填写公司/CEO并选择性格；②换批/返回/重新输入/取消；③首聘1人重载，再聘第2人，验证资本/费用；④教程开始或跳过，时钟状态符合契约；⑤完成首年，报告逐项对账；⑥重载继续第二年；⑦分别保留1×/2×/5×实时路径与加速模拟结果。
- T01：首聘现金=30万−实际两人费用，不套用各5000样例到随机候选；T02：第1年工资按实际员工和月份，招聘费不再扣；T03：年报利润/现金/资产全部核对；T04：实时1×/2×/5×分别约300/150/60秒完成一年并记录容差原因；T05：中断恢复不重注资。
- 交付：三行业结果表、seed/候选/ledger/state、录像。G001—G003另以标准夹具复核，不能把随机UI开局强行等同黄金样例。

#### TASK-M3-09-R37｜管理命令与重复点击 E2E

- 前置：R26、R29、R30、R35。范围：招聘、裁员、调岗、建部、方针锁定、投资/救助的真实界面流程。
- 步骤：①每个收费动作先取消并对比零变更；②确认、连点、失败重试、预览过期各跑；③跨月检查员工有效状态/工资/产能；④建齐支持部门验证0人无收益，再配置人员核对效果；⑤锁定后自动决策不擅改；⑥投资/救助以资本口径对账。
- T01：同意图只一笔费用/一个员工/一个部门；T02：候选过期或余额不足不会产生半成功；T03：赔偿与实际任期相符、调岗无重复工资；T04：折后招聘费用/部门节省只计一次；T05：不自动裁员/投资/救助；T06：命令run变更时UI停止提交。
- 交付：操作→预览→提交→月结→重载五阶段证据；只有toast截图不能关闭此任务。

#### TASK-M3-09-R38｜存档、离线与异常路径 E2E

- 前置：R13—R18、R33、R35。范围：真实UI+可控故障宿主，生命周期观察，与B01—B15交叉映射。
- 步骤：①存档读取超时/一槽损坏/双槽损坏/写满/回读失败/指针未知；②关键await强制中断再启动；③8h/40h离线、暂停/回拨/余量/快速前后台；④登录拒绝/过期/断网、隐私拒绝/同意写失败；⑤关闭与月结/收费并发；⑥恢复后再发正常命令验证未死锁。
- T01：错误页面可读可重试且旧档受保护；T02：无静默new run；T03：未知提交恢复只有一次结果；T04：同月/事件/救助/离线收益不重复；T05：暂停无离线收益；T06：重开旧run永不恢复；T07：没有无依据“已保存”提示。
- 交付：故障注入时间表、每阶段run/revision/pointer/journal/checksum与UI证据。模型生命周期与物理设备强杀恢复必须分栏，不能互相替代。

#### TASK-M3-09-R39｜全页面可读性与边界可达性验收

- 前置：R27—R35。范围：§14.7所有S/T/D页、普通/长文本/异常状态。
- 步骤：①三基准尺寸逐页截图+点击；②安全区/热resize/横屏提示/键盘；③最长合法公司和姓名、emoji、大额/负额/零额；④0/2/30/100员工、6部门、100年报；⑤自动记录文本矩形、实际字号、热区和相交；⑥人工打开截图确认，没有把自动几何通过当作视觉通过。
- T01：正文≥14/辅助≥12，无未说明SHRINK；T02：文本与按钮不交叠，规定间距达标；T03：确认/取消/末项始终可达；T04：滚动无穿透/无错误员工复用；T05：所有金额可查看完整值；T06：未完成资源/错误/空态也纳入。
- 交付：页面×尺寸×状态矩阵，失败附具体截图/节点/复现点。不要对低影响颜色微调写镜像实现的单测，优先真实视觉和交互证据。

#### TASK-M3-09-R40｜强化900-run与长期财务不变量

- 前置：R12、R15。范围：simulate5year、黄金/模拟/边界测试；经济配置与黄金值不擅改。
- 步骤：①保留100seed×3行业×3策略×60月目标；②逐月检查收入/各费/一次性已付现金/资产/招聘人数/事件唯一性；③逐年检查自动聘≤3且每月≤1、连续盈利计数；④风险提前停止记录真实结束原因，不算跑完5年；⑤固定输入重复模拟哈希对比；⑥120年/金额上限/存档裁剪验证。
- T01：17个黄金口径不变；T02：每个run均输出实际years/months与risk，财务误差为0；T03：费用节省不超过对应基数、工资每员工只一次；T04：无NaN/Infinity/越界负现金；T05：每年限制逐年断言，非总数≤15替代；T06：500KB按真实UTF-8字节。
- 交付：CSV+汇总+失败最小seed/输入；不能调低候选薪资或改黄金值来“修好模拟”。

#### TASK-M3-09-R41｜最终候选真机、性能和音频验收

- 前置：R09、R34、R36—R40；外部：设备/测试权限。范围：同一个候选zip，至少原失败设备和原通过设备/iOS按§14.9矩阵。
- 步骤：①记录每台型号/OS/TapTap/容器及包hash；②冷启/恢复各10次，首次可交互需实际点击；③首聘/5×跨年/部门/存档/强杀恢复/重开；④断网/授权拒绝/空间不足按可用工具测试；⑤采集FPS/长帧/启动p50p95/30分钟内存；⑥耳机/扬声器检查音量、循环接缝、三开关、后台恢复与速度不影响音调。
- T01：已知失败设备无同类加载失败；T02：至少每目标系统真机证据齐全，未测不算通过；T03：性能按当期平台明细门禁，建议阈值与官方阈值分开；T04：音频失败不阻塞经营；T05：测试中改包后原hash证据不挪到新包。
- 交付：device-matrix、逐次结果、性能与音频问题单、录屏。无设备/权限时BLOCKED并标§17具体项，不重复要求用户发密码。

#### TASK-M3-09-R42｜账号、素材、版权与商店资料核验

- 前置：R01；录屏成品依赖R41。范围：§17清单、现有UI/音频/商店素材、隐私与资格材料索引，不擅自上传。
- 步骤：①区分Tap小游戏ID/AppID、SDK ClientID、微信构建占位appid；②核对后台测试权限/包记录所需非秘密字段；③16音频/67UI图按清单路径/hash/引擎导入/实际引用核查；④确认图片/字体/音频来源与商用使用证明；⑤已有商店候选核尺寸/内容/版权，概念图不作实机截图；⑥最终实机截图/录屏替换概念资料；⑦资料只存脱敏状态/引用，身份证件/密钥不入仓。
- T01：资源缺失能指出具体assetId/路径/尺寸/触发，不笼统要求用户重做美术；T02：有文件不等于许可已核；T03：主标题/主体/适龄/隐私/版本一致；T04：当前无后端路线不索取Server Secret；T05：未完成资质按后台实际状态记录。
- 交付：asset-check、license-check、store-check及§17更新；不能自动把本次16个hash一致当作真机音质通过。

#### TASK-M3-09-R43｜同包云端准入与失败设备回归

- 前置：R21、R41；外部：明确上传授权、后台可访问。范围：候选包上传与平台运行/性能测试，不默认提交正式发布。
- 步骤：①上传前复核zip/hash/版本/测试权限；②记录后台包ID/上传时间；③运行准入/性能测试并下载每台失败日志与明细；④把本地失败修复与平台结果逐项对应；⑤任何FAIL回到相应根因任务，不绕过检查；⑥新包需新报告，旧报告保持只读可查。
- T01：平台记录与最终manifest可对应；T02：满足当前准入标准且原已知失败机型回归成功；T03：两项性能异常有实际详情及通过/未关闭状态；T04：审核未完成/排队不算通过；T05：未获上传授权时只准备材料，不执行外部写入。
- 交付：平台报告/日志/同包追踪。若平台报告不含某原失败机型，另需真机回归，不以“本次未抽中”当关闭。

#### TASK-M3-09-R44｜冻结可提审候选并总验收

- 前置：R18、R21、R36—R43、R46。范围：版本/证据/资料冻结，不发布。
- 步骤：①核最后源码/dirty摘要与构建manifest；②跑受影响最终门禁，汇总核心/UI/E2E/故障/真机/平台五层；③P0/P1逐项关闭且证据当前有效；④核政策、资质、素材与版本字段；⑤冻结zip/hash/物料，出候选说明；⑥冻结后任何代码/资源/配置变化标记需重验范围。
- T01：没有未解释的FAIL/BLOCKED被归总为PASS；T02：所有发行证据指向最终hash或有可审查的等价性说明；T03：缺真机/资质/准入任一必要项不能DONE；T04：仅生成候选资料不等于已提审；T05：回退路径保留旧包但不覆盖玩家新协议未决事务。
- 交付：release-readiness.json/冻结清单与仍需用户操作。R44通过仅表示“可提审”，R45另管后台动作。

#### TASK-M3-09-R45｜获授权后提审与发布状态核验

- 前置：R44、用户明确授权的外部动作范围。范围：按授权上传/提审/发布，三种动作分别记录。
- 步骤：①核用户允许的是上传测试、提交版本审核还是审核后发布；②准备可供用户核对的包/资料；③通过已授权工具或由用户完成后台操作；④读取真实结果/回执，记录排队/审核中/驳回/通过/已发布；⑤驳回回到问题清单，不伪称上架；⑥需要平台工单/外部消息时另有明确发送授权才发送。
- T01：工具或后台有提交回执才称已提审；T02：审核通过与正式可玩状态分别确认；T03：不把预约/敬请期待当正式上线；T04：无授权时停在准备完成，不偷偷扩权；T05：不在提示词中预置“无论如何发布成功”。
- 交付：脱敏后台状态索引和最终交接；账号密码/Secret/证件不复制到任务报告。

#### TASK-M3-09-R46｜建立需求—缺陷—测试—包体追踪矩阵

- 前置：R00。范围：本总览内验收映射及任务证据索引；机器报表允许存evidence，不建第二份独立权威进展文档。
- 步骤：①按R-001—R-020/G001—G017/B01—B16列条目；②查现有测试中真实A编号及原QA记录，补A类独立定义；③每条区分domain/integration/web/tap-device/cloud层结果；④关联REL-01—14和本章子任务；⑤每次验证登记源码/ziphash/配置/seed/证据；⑥统计未测、失败和阻塞，不仅统计通过数。
- T01：例如safeArea纯函数PASS不能自动填A21真机PASS；T02：已有A12/A14/A16—18/A20—25意义不被新编号覆盖；T03：找不到某A编号原始定义则标定义缺口，用R-xxx与具体用例说明覆盖，不能编造“原来如此”；T04：任何P0/P1均可追到测试与负责任务；T05：旧包证据不自动迁给新包。
- 交付：覆盖矩阵及未覆盖清单；后续R35等依此输出，最终R44从这里汇总。

#### TASK-M3-09-R47｜按批次交接并保持文档一致

- 前置：已执行子任务证据；最终阶段结合R44/R45真实状态。范围：§11/§12/§15/§17与README相关摘要、必要AGENT入口。
- 步骤：①任务表填owner/状态/新证据路径；②写已完成/未完成/阻塞与下一可执行任务；③新增决策标技术/业务/待真机核实，冲突引用来源；④README与正文不再出现“Android已全过”“E2E全过”等过时断言；⑤保护并发改动，合并前重读段落；⑥本地修改/提交/推送/上传/审核/发布各写实际状态。
- T01：另一个Agent只读入口+任务卡能定位待做项与测试命令；T02：没有缺证据的DONE；T03：报告文件路径存在且不含密钥；T04：任务阻塞时下一项仍可执行任务明确；T05：本地批次交接完成不改变发布整体BLOCKED。
- 交付：按AGENT §9交接。不得为凑“全部完成”把R09/R41/R43/R45删掉或标不适用。

### 15.9 缺陷覆盖与批次验收要求

| 原缺陷 | 主要整改任务 | 必须取得的关闭证据 |
|---|---|---|
| REL-01 多机型卡加载 | R03—R09、R41、R43 | 首错/阶段定位、原失败机型前后对照、同包平台结果 |
| REL-02 TextEncoder | R02、R04、R07 | 无API启动、UTF-8标准字节、旧档checksum一致 |
| REL-03 structuredClone/锁 | R02、R05、R12 | 无API写命令、复制抛错后可重试、隔离draft |
| REL-04 读超时误新建 | R10—R14、R38 | 超时不写/不新建、重试恢复同run、未知提交不重扣 |
| REL-05 诊断未打包 | R03、R06、R20、R21 | 从最终zip提取诊断/补丁及interactive标记验证 |
| REL-06 文字过小 | R23—R25、R27—R33、R39 | 各页有效字号/间距、人工视觉与实际点击 |
| REL-07 按钮过小/贴邻 | R23、R25、R26、R29、R39 | 屏幕有效热区≥44、间隔≥8、无相交 |
| REL-08 无滚动/整屏缩放 | R24、R29、R30、R32、R39 | 小屏、六部门/百员工/百年报、热resize可达 |
| REL-09 招聘无确认 | R26、R27、R37 | 点击仅预览、取消零改、确认一次扣费与重载 |
| REL-10 检查范围不足 | R21、R22、R35—R40、R46 | UI检查、最终zip断言、分层覆盖矩阵 |
| REL-11 旧产物/版本混淆 | R00、R01、R19—R21、R43 | 新目录/失败即停、manifest与后台记录对应 |
| REL-12 平台/登录/隐私 | R16—R18、R33、R38、R41 | 正式包不进mock、平台态/拒绝/断网/政策证据 |
| REL-13 外部证据不足 | R01、R09、R41—R45、§17 | 设备/性能/资格/同包审核与真实回执 |
| REL-14 需求交互缺口 | R27、R29、R30、R32、R36—R39 | CEO输入/历史年份/部门贡献/人才筛选可用且数值正确 |

批次门禁：①R04/05/10—14为核心数据安全批次，完成后运行core类型/lint/全部既有单测和新故障回归；②R23—33逐页只验证受影响组件/操作，批次末统一新web构建与全页E2E；③R19—21每次产包对最终zip验证；④R36—40运行完整本地验收并记录新基线数量；⑤R41—44绑定最终hash完成外部门禁。前序修复改变后序假设时，把具体受影响项标为需重验；不机械重测无关模块，也不只跑一个最容易过的case。

### 15.10 命令、测试和执行状态的约束

2026-11-03核对：package.json 已有 typecheck、typecheck:ui、lint、test:unit、test:integration、test:golden、test、check、web-build、release-build 等真实入口，包校验工具也已添加；R35统一E2E、ABC对照和真实Tap构建验收仍待执行。工具存在不等于实现完整或验收通过，详见§15.11。审计目录cjs是定位资料，正式回归应进入tests或正式tools入口。执行者必须先检查实际package.json/帮助，不能直接把建议名当作已存在命令。

建议最终暴露独立命令职责：core-check、ui-check、core-tests、fault-tests、web-build、tap-build、package-check、e2e-web、simulation、release-check；名称可按现有风格统一，职责不可混淆。没有生成引擎类型/Chrome/Creator时明确环境缺口，不用跳过检查的exit0占位。纯文档变更只核内容/引用/编码，不要求重跑全部经营测试。

---

### 15.11 2026-11-03 未完成工作专项详细设计与执行顺序

#### 15.11.1 适用基线、目标和交付分层

本节是用户本轮授权编写的**后续实施设计**，不表示已经实施或批准上传。与 §15 原任务卡配套使用；对本次新增复现与执行顺序，以本节细化为准；业务 LOCKED 规则仍以 §1/§12 为准。不得另开第二份权威进度文档。当前 16 DONE / 11 READY_FOR_QA / 21 TODO；412 测试与 R30 的 43 浏览器断言均通过，但两项独立复现 FAIL 仍有效（§11.11）。每次接手须核最新源码、状态及证据，数字是本次快照，不是未来固定通过数量。

本轮目标分四层，报告必须分别给结论：

| 层级 | 含义 | 允许仍缺的条件 | 不允许的说法 |
|---|---|---|---|
| L0 本地实现与验收完成 | 当前可执行代码、Web 功能/故障/视觉与领域回归通过 | 物理手机、平台后台可以待配合 | “所以 Tap 兼容已通过” |
| L1 测试候选包生成并静态验证 | 最新源码真实重建、转换、补丁、最终 ZIP 检查、manifest 齐全 | 真机/云测/正式资质可未完成，但逐项列缺口 | “生成 ZIP 就能正式上线” |
| L2 同包设备及平台验收通过 | 候选 hash 对应真机、原失败机型、性能与云测有效证据 | 可待最终提审授权或资料补充 | “旧包报告覆盖新包” |
| L3 可提审/实际发布 | R44 收口且授权范围满足；R45 有真实后台回执与状态 | 不用“预期通过”替代结果 | “上传测试”等于“正式发布” |

推荐保持现有 Cocos Creator 3.8.8、TypeScript、平台抽象与本地经营架构，串行修补；无需重写引擎、换框架或增加服务器。替代方案是整体重做 UI/持久化框架，可能更统一，但迁移和回归范围明显扩大，不适合本次发布整改。仅当后续证据证明当前引擎/转换器无法在官方最小包上运行时，才重新评估引擎或适配器版本，先做 R08 对照，不直接推翻业务实现。本次不采购服务、不引入新收费依赖，不做同类产品泛化比较；依据是本仓库复现与官方接入流程。

#### 15.11.2 批次安排与依赖解释

| 批次 | 子任务与工作 | 开始/结束条件 |
|---|---|---|
| B0 | 刷新 R00 基线；先做 R46 的现有需求/缺陷/用例索引；登记 U01—U12 缺口 | 保护未提交改动；R46 可先完成索引框架并持续回填，不等最终发布才做 |
| B1 | **R12 数据安全修复**；针对上游变化回归 R11/R13/R14/R15/R25/R26 | 新增独立缺陷回归先在原实现 FAIL，修复后 PASS；未知结果未恢复前不可继续写 |
| B2 | **R30 布局修复**；关联 R23/R24/R25 复核 | 几何、实图、点击与 100 人复用都通过；不重做已通过的全部人才业务 |
| B3 | R03/R06/R07/R16/R19/R20/R21 的构建链接入复核；制作工程诊断候选，准备 R08 A/B/C | 这是测试基础设施候选，不是最终产品候选；为 R35 提供真实新构建/manifest，避免“所有 E2E 未完成所以永不构建”的假循环 |
| B4 | R35 稳定 E2E 驱动；R31 排行 → R32 年报 → R33 其余流程；同步复核 R17/R18/R15 | UI 任务先做专项验证，R35 稳定后整合；缺 R09 设备不阻塞这些本地工作 |
| B5 | R34 性能优化；R36/R37/R38/R39 全流程/管理/故障/视觉；R40 财务长期验证 | 优化后重跑受影响流程；最后统一全门禁，不每次颜色调整都跑 900-run |
| B6 | R19—R21 再从最终源码构建**产品测试候选**；R42 本地素材与资料检查 | L0 无未解决 P0/P1；真实最终 ZIP+hash+完整日志；任何旧构建均不能复用为本轮候选 |
| B7 | 有设备/权限后 R08 对照实测与 R09 根因闭环；R41 真机；获测试上传授权后 R43 云测 | 对照实验可尽早进行；最终验收必须指向 B6 同包。失败修复后新 releaseId、新包、新受影响证据 |
| B8 | R42 外部材料补齐 → R44 冻结 → 明确授权后 R45；R47 全程回填 | 缺必要外部项时整体保持 BLOCKED；本地候选照常交付，不能伪造发布完成 |

R35 原前置 R21 指“打包验证器与当前测试构建可用”，不要求 R44 最终包先完成。R08/R09 可在 B3 后提前开展，R41 最终同包验证仍放在功能稳定后。READY_FOR_QA 需要实际补足其记录中的缺口；上游修复不自动使全部下游 DONE 失效，但必须跑受影响回归并记录结果。R47 是持续交接，不能因一份交接报告就闭合发布。

#### 15.11.3 R12：未知提交后的状态恢复、版本同步与继续经营

**精确复现**：`evidence/recheck-20261103/review-transaction.cjs` 使用真实 GameFacade/GameStore/SaveRepository，只替换存储后端。初始 revision=11、现金287027、资产0；投资10000写入活动指针后回调失败；磁盘已 revision=12、现金277027、资产10000，内存未更新。此时直接修改方针会用旧 draft 覆盖投资，并复用 revision=12。旧测试只覆盖重启加载或失败前未写入，没有覆盖这个连续操作。

**涉及文件**：`GameStore.ts`、`SaveRepository.ts`、`SaveTypes.ts`、`errors.ts`、Facade 的结果处理；必要时更新确认弹窗与时钟错误反馈。纯定位脚本留在 evidence，正式回归进 `tests/unit/transactionCommit.test.ts` 或相邻 integration；不要让生产依赖 evidence。

建议状态机：`READY → COMMITTING → READY / RECOVERY_REQUIRED → RECOVERING → READY / RECOVERY_REQUIRED`，与瞬时互斥锁分离。`finally` 可以释放互斥锁，但不能清除尚未恢复的业务闸门。

1. 每次进入 mutating command，先在锁内核对恢复闸门与仓库未决事务，**恢复结束后才 clone 当前状态并执行业务 fn**。禁止先执行 fn 再 reconcile。
2. 恢复结果至少区分 committed / retained-base / unavailable-or-undecidable，并返回已验证状态、信封 revision、runId、resetGeneration 和事务结果所需元数据；仅返回字符串结论不足以同步 Store。类型名称可遵循现有风格，不要求照抄。
3. committed：发布目标快照与目标版本；若原 commandId 已执行，按幂等语义返回原结果，不重扣。retained-base：装载已确认基线，原命令只有在业务预览/令牌仍有效时才可重试。undecidable：保留 journal 与证据、阻止写入、显示“正在核对上次操作，请重试恢复”，不得创建新局、清档或宣称撤销成功。
4. 对下一条不同命令，推荐先完成恢复并提示刷新预览，再由玩家重新确认涉及费用/破坏性的意图；普通只读照常使用最后明确状态。若实现恢复后自动继续非危险命令，必须基于恢复后的 draft 重新校验，不能沿用旧费用预览。付费命令不由恢复器暗中重放。
5. commit 增加基线一致性检查：已读 pointer 的 run/revision/generation/checksum 与传入 base 一致才写；同 run 成功版本严格递增。正常例子：投资已落 revision12，后续修改方针应 revision13 且保留资产10000。不要通过“总取最高 revision”跨 run/墓碑恢复。
6. 超时并不等于底层写入取消。对仍可能发生的迟到物理写，必须证明闸门保持到该写已确认完成、平台保证取消，或由存储协议隔离。仅忽略迟到 Promise 回调不足以避免旧指针被写回；该宿主语义无法确认时保持恢复受限，并列为 R09/R38/R41 待验。
7. journal 清理失败不应把已确认提交当未发生；保留可幂等再清理的元数据。任何恢复异常不吞错，不把 current/revision/resetGeneration 发布成混合状态。
8. 替换 run、月结、离线、首聘、建部、投资、裁员共用闸门。未决经营事务不能与关闭公司并发绕过；墓碑优先级和旧 run 回调隔离仍遵守 R14。
9. `clockTick` 不得无限吞掉 NOT_READY/SAVE_UNAVAILABLE：进入明确可恢复状态，停止新月结写入，记录有界错误阶段；重试成功后如何处理暂停期间时间按 R15 既有真实时间/离线契约只算一次，不悄悄丢失或重复补算。纯页面预览和取消不能触发写档。

**必测矩阵**（每例检查内存、双槽、活动指针、journal、run/revision、现金/资产、命令幂等记录，并在必要阶段重启）：

| 用例 | 故障/操作 | 安全预期 |
|---|---|---|
| R12-N01 | 指针实际成功，回调失败；不重启发不同命令 | 保留投资；新命令用恢复后 revision 或明确阻止，不能成功覆盖 |
| R12-N02 | 同故障，不重启重试同 commandId | 只一笔投资、一笔费用；不可新建第二个意图绕过 |
| R12-N03 | journal/目标槽/指针写前失败，分别注入 | 保留可判定基线；不可半扣款；重试结果唯一 |
| R12-N04 | 目标/指针读回超时、读取恢复后重试 | 不可读时阻断；恢复后内存和磁盘收敛一致 |
| R12-N05 | journal 清理失败 | 已提交仍保持提交；下次恢复不会重复业务 |
| R12-N06 | 回调重复/迟到；底层真实迟到写 | once 处理且无较旧指针覆盖；不能只测回调被忽略 |
| R12-N07 | 未决提交时触发月结、招聘、关闭公司 | 一致阻断或串行恢复，无并发混合代际 |
| R12-N08 | 恢复后预览过期/余额变化/员工状态变化 | 重新预览；拒绝失效确认，收费不部分成功 |
| R12-N09 | committed/retained 状态分别强杀重启 | 两种路径各只有一个确定结果，旧 run 不复活 |
| R12-N10 | 恢复后继续两个月，再发正常命令和重载 | 状态可克隆可保存，无永久锁/静默停钟 |

验收不能只让原复现脚本退出0——该脚本当前退出0是“复现成功”，不是产品通过；需转为断言 `lostCommittedInvestment === false`、版本不复用、命令结果安全。允许保持未决并拒绝后续命令；但恢复后必须有可继续经营路径。若存储适配层没有原子 CAS 能力，基线校验不能宣传成跨进程原子事务；本项目先保证单实例串行与已知迟到写安全，不引入云同步。

#### 15.11.4 R30：固定卡片布局修复与虚拟列表验收

**根因与方案选择**：卡片76高，薪资 y=-15，状态 y=-31；宽210的状态自动变两行后高38.42，与薪资重叠13.92并越卡12.21。建议保留等高虚拟列表，卡片用约108—120逻辑单位作为起始设计，再由字体/行高测量确认；在职/次月离岗/调岗待生效各最多一行短状态，长规则完整放详情和确认页。短状态如“调岗待生效 · 下月转入客服部”；员工卡标题长名可截断但必须能打开完整详情，金额不能靠缩字掩盖。若最长目标部门导致状态两行，则统一增加所有卡高度，不能固定步距而只让个别卡长高。

替代是按实际内容变高卡片；仅确实需要完整规则常驻列表时采用。必须使用前缀高度/偏移查找、精确 content 总高和重算池定位，不能继续 `index * 84`。当前规模100人，等高方案成本更低、行为更稳定。最终高度不是新的业务 LOCKED 值，以真实三视口和最大合法文本通过为准。

布局要求：卡片上下内边距≥12、不同信息块间≥8、正文≥14/辅助≥12、按钮热区≥44；筛选 chips 与员工详情底部按钮间距应满足既定8单位基线，四列不足时改三列/增加筛选区高度，不能把按钮压小。listTop 必须由筛选实际行数/高度计算，不能写死而与第三行重叠。详情补齐现有 VM 已有的性格字段，并核“招聘入口”在空态/筛选态可见且能到既定部门招聘流程，不另造直接加员工功能。

实现时把 cardHeight、rowGap、poolSize、listTop、contentBottom 收敛为同一布局数据；池数量至少覆盖可视区+缓冲，底部 clamp 到有效起点，重绑定同步更新 employeeId/标题/薪资/状态/点击目标。筛选切换滚动归顶；月结更新应保留合理锚点，已离岗条目消失时不留下错误回调。复用事件只绑定一次，点击从当前绑定 employeeId 取值，不捕获旧员工。

新增 R30-N01 普通在职、N02 调岗待生效、N03 次月离岗、N04 长姓名+最长部门、N05 0/2/10/30/100人与筛选切换、N06 末项详情与返回首屏。每例测375×812、360×640、390×844；安全区与热resize另按R39。用节点自身 UITransform 的矩形计算卡片范围，不能用“包含所有子节点”的包围盒掩盖越界；检查文本-文本、文本-按钮相交与卡片包含关系，容差仅用于像素舍入且不得容忍本次约14单位重叠。再打开截图人工确认并实际点击，截图读取失败意味着视觉 NOT_RUN，需要换可用方式继续，不可直接写通过。

#### 15.11.5 11项 READY_FOR_QA 的补验清单

| 任务 | 必须补足的真实证据 | 主要联动/失败处理 |
|---|---|---|
| R03 | 最终转换入口在模块导入前安装诊断；构造模块首错也能留下阶段/releaseId/attemptId；真实点击才 interactive | 不能仅看到标记字符串；阶段正常结束后无迟到看门狗误报 |
| R06 | 转换后 initApp 无rAF、rAF先到、timer先到、二者都到各只启动一次 | Fake宿主执行+R08/Tap设备；不把单测等同真机 |
| R07 | 真正模块/必要配置加载失败、超时、重试成功与迟到回调 | 页面可恢复，旧尝试不写状态，不静默回落成伪经营配置 |
| R13 | 无档/可恢复/暂不可读/全损坏/重置未决各实际错误页与重试 | 无档才允许新建；R12恢复前不能绕过写入 |
| R15 | 在线计时、hide/show、暂停、回拨、8h/40h、失败重试的时间/账本核对 | 故障后没有重复补算或静默停钟；物理强杀另归真机 |
| R16 | 正式profile注入早于平台工厂执行；无Tap能力时报错而非EditorMock | 合法引擎Adapter内部兼容不与业务使用DOM混为一谈；扫描和执行都要做 |
| R17 | AppView真实接入未登录/成功/拒绝/过期/断网恢复 | 不伪造成功，不因认证重试重新注资；本轮不强制搭认证后端 |
| R18 | 内置政策全文同源、无占位、同意先落盘，失败不进入游戏；拒绝/重试/再次启动 | 真机滚动/关闭/小屏可达，公开资料待U07确认 |
| R19 | 当前Creator真实构建，准确CLI输出目录、进程退出码、成功标识、必要产物与时间戳 | 不再仅凭game.json存在；不得复用旧产物宣称新构建 |
| R20 | 每个补丁实际锚点数量与幂等、诊断/profile注入、转换产物可启动 | required锚点多命中须失败或由确定结构证明合法；不能只warning后盲替换 |
| R21 | 从最终ZIP读入检查路径/入口/资源引用/构建信息/禁测入口/版本/hash；负例确实FAIL | 当前代码的注释不等于检查已实现；补真实断言与坏包用例 |

R14/R26 等 DONE 依赖 R12，至少补收费/重开回归；R23/R24/R25 依赖基础布局，至少复核这次具体间距与弹窗案例。只重跑受影响部分并登记，不无依据把所有已完成项整体撤销，也不无依据升级 READY_FOR_QA。

#### 15.11.6 R31—R33 剩余产品功能设计

**R31 双排行榜**

- 复用 `assets/core/simulation/leaderboard.ts`，先读现有排序/tie-break契约，不在UI另写排序或随意改同分名次。只读 VM 返回榜类型、排序条目、我方所在位置/资产/完成年数、完整名称和展示名称；未创建公司单独空态。
- PageShell 中榜切换和“本地模拟企业，非真实联网排名”说明常驻；我方摘要位于滚动列表外，显示当前名次及口径，可提供“定位我方”滚动动作。列表列宽明确，姓名占弹性宽度，名次与金额/年数预留独立列。完整名称点击查看，金额格式缩写时详情可见精确整数。
- 切榜仅更新UI与选择，不写存档、不推进随机数、不刷新机器人经营；重载结果按现有确定性规则，重开删除旧局我方记录。名次并列与显示序号按已有领域定义，不擅自改成另一排名法。
- 现有查询内部 `ensureBots` 可能初始化state，不能原样把有副作用查询宣称只读；将必要初始化放入既有创建/加载命令阶段，或在隔离只读快照派生，保持相同确定性结果。`playerYears` 当前用保留的年报数计数，100份裁剪后可能不再反映真实已完成年数；R31/R40须核已结算年份/经营时钟的可靠计数，修复保留上限造成的错误，旧档兼容与重开归零都要验证，不能把保留份数冒充总经营年限。
- 夹具覆盖空数据、同资产/同年数、多重tie-break、长合法名、大金额、我方榜外、0完成年、100年以上、重开前后。UI值与领域逐项比对；资产必须现金+未折旧业务资产，不读收入累计字段。

**R32 历史年报与现金桥**

- 新增小范围只读报告VM/查询（命名自选），输入year，输出冻结AnnualReport字段、存在性、费用分组、可用现金桥项及缺失原因。年份列表从真实 `annualReports` 取，默认最近完成年；上一年/下一年与可滚动年份选择器，最多按既有100年保留规则访问，不硬生成不存在年度。
- 报告标题固定，年份选择可达，正文分经营结果/费用/现金变化/期末资产；关闭固定。当前未完成年只走首页YTD，不能冒充已完成冻结年报。亏损用符号和文字，不只用红色；零项可折叠，展开后金额仍精确。
- 符号统一：先确认原字段是已带正负的账本数还是正数费用，VM仅转换展示符号；禁止把负工资再重复减一遍。利润来自原报告，不从当前员工反算。投资支出是资本现金流，不把全部投资再扣经营利润；折旧回加现金桥时仅在利润已计折旧前提下使用。
- **历史字段现实限制**：当前AnnualReport无年度投资/注资/非现金资产损失完整分项，rolling月账也不能覆盖100年。必须按年结时真实数据生成新的可选年度现金桥快照，并向后兼容旧档；财务算法仍复用领域。新年数据可以逐项勾稽；旧年缺项标“历史现金流明细未记录”，展示期初/期末与可核项目及未归因差额，不能把差额武断标成投资、不能据当前状态回填伪历史。严禁为了做现金桥重写旧年利润。
- 标准等式：年度利润=领域收入与各费用带符号合计；期末现金=期初现金+已记录全部现金流；期末总资产=期末现金+未折旧业务资产。字段齐全时差额必须0；缺历史时明确partial、不把未验证记PASS。新可选快照纳入schema校验、UTF-8大小预算和100年裁剪，旧信封checksum保持原校验流程。
- 验收覆盖100年份首中尾、无年报、利润负/0/正、有投资/救助/一次性已付招聘/折旧/资产损失、旧档无新字段、年结后重载与只读不改存档。测试原17黄金等式不变。

**R33 离线、危机、教程、设置与音频**

- 离线结算由Facade/时钟单一入口执行，弹窗只展示已生成结果；包含实际结算月数、上限、未使用余量、现金/利润变化、事件。重复打开/关闭不再结算；hide/show乱序、暂停、回拨按R15契约测试。
- 危机弹窗解释缺口和月固定开支，入口到人才/部门查看成本；救助显示仅本局一次、+100000资本、利润不变，二次确认同commandId单次执行；不能自动裁员、自动救助、自动清局。取消/余额风险/已使用都有明确状态。
- 教程状态与首聘状态分离；可跳过、继续、重播，重播只是引导高亮不再创建公司/注资/录用/扣费。重开规则沿既有基线，不随意把账号隐私同意当经营存档一起删除。
- 设置分组：音频、玩法说明、隐私、关于/版本、关闭公司。版本/releaseId来自真实构建信息，不写死“1.0.0”。危险操作独立区域并用R25确认，不与普通开关挤同排。
- AudioManager区分总开关、音乐、音效，状态持久化失败显示真实结果；进入后台停/暂停，前台按偏好恢复；同BGM切页不重头；游戏倍率不影响音调。16个现有MP3先复用，单个解码失败只禁该资源并可静音继续；音频不能阻塞启动。真机听感与循环接缝归R41。
- 隐私延用R18已实现的全文，公开信息/URL由U07核；官方平台“添加到桌面”等当前接入项先在R42列匹配核查，若目标后台确需而源码未接，记录具体差距并在既有平台/设置范围最小接入，不扩展广告、支付、云存档或联网排名。

#### 15.11.7 R34—R40 自动化、性能与独立验收设计

**R35 驱动优先稳定**：复用现有playwright-core与实际可用浏览器；包装现有 `shot-r*.cjs` 的通用能力，不复制大量固定坐标。稳定actionId/employeeId/year可在开发构建中观测，从实时节点矩形算点击点，执行实际mouse/touch事件。只读观测、受控时钟和故障后端由开发profile启用；生产编译剔除写状态/造钱/任意Facade调用入口。正常、失败、skip、blocked、timeout均有报告；任一FAIL或不满足要求的未执行项必须使验收命令非零退出。故意遮挡按钮/禁用按钮/损坏资源/制造布局重叠各应被识别，证明测试有检测能力。

测试准备可以直接装载专用种子，但报告要标“夹具构造”；业务关键步骤必须实际UI执行。通过测试时钟推进月份应标“加速模型”，1×/2×/5×真实耗时另列。等待以页面状态/命令完成/存档版本为准；遇到进度卡住就失败并留证据，不循环点5×掩盖停钟。token真实到期已有62秒证据，日常回归可用可控时钟；最终保留至少一次真实等待证据并核新包对应性。

**R36/R37/R38覆盖表**：

| 组 | 最少场景 | 必须读回 |
|---|---|---|
| 创建/首年 | 3行业×首聘中断恢复；名称输入/返回/换批；1×/2×/5×；首年+重载第二年 | 实际两人费用、30万仅一次、各月工资、冻结年报、run与revision；随机候选不硬套5000 |
| 管理 | 招聘/建部/投资/裁员/救助的取消、单击、连点、失败重试、过期；调岗跨月；AUTO/LOCKED | 命令幂等、现金/资产/费用分项、员工生效月、部门效果上限、重载后仍一致 |
| 存档 | missing与timeout区别、一槽坏/双槽坏、写满、每个journal步骤中断、指针未知 | error页/恢复入口、旧档保护、无静默new run、已提交结果不丢失 |
| 连续操作 | 未知投资后换方针/招聘/月结/关闭；恢复后再命令与重载 | R12-N01—N10安全预期；绝不只测重启后恢复 |
| 生命周期 | 8h/40h、暂停/回拨、余量、快速hide/show、登录拒绝/失效/断网 | 时间只消费一次、月结/事件唯一、失败恢复后无永久锁 |
| 隐私/重开 | 拒绝、同意写失败、重试、未决写时重开、旧run迟到回调 | 不提前进入经营；墓碑/代际/新局隔离；账号凭据不入证据 |

**R39视觉矩阵**：三尺寸×创建3页/公司/部门/人才/排行×对应弹窗（详情、预览、确认、年报、离线、危机、设置、隐私、错误）。每页至少普通与最长合法文本；名单覆盖0/2/30/100、部门6、年报100，金额0/负/大数，pending/dismissal/empty/error等状态。自动测字号、文本/按钮/卡片几何、热区、footer遮挡；再逐张打开关键截图、点击末项和确认/取消。先按R30新复现回归，其他间距发现按实际影响记录，不拿“文本节点存在”当可读。

**R34性能**：在变更前后用同seed/员工数/视口/倍率/构建profile采样，记录初次可交互、稳定帧p50/p95、长帧>50ms次数、峰值节点/监听器/内存、每分钟保存次数、30分钟趋势。50ms只是项目诊断统计界线，不是平台统一通过阈值。先解决月结整屏销毁、列表事件重复绑定、无关VM重算/保存、后台音频/渲染残留；保持选择与滚动。不得降低经济结算频率或漏存收费命令来提高FPS。浏览器heap与Tap进程内存不混用；帧/内存缺可用测量接口时标NOT_RUN而非估值。

**R40模拟**：改进 `tools/simulate5year.ts` 和测试，900组合=100seed×3行业×3策略；每个输出seed/config/hash、实际结束年月、是否完整60月、停止原因、逐月/年不变量。现测试“5份年报”实际断言≥4及总自动聘≤15不能证明每年≤3，必须改为按真实年度逐项检查。风险提前停止是允许业务结果，单列not-completed-with-reason，不能谎报全部60月，也不能为了全部跑完注资/改工资。无异常/财务误差0与盈利率是两回事，不以亏损为测试失败而改黄金。

每月检查工资每员工一次、招聘/赔偿/部门费“已付现金”只记一次、费用节省不超过适用基数、现金变化与现金流、资产滚存及折旧、业务利润等式、事件/救助唯一性；每年检查自动聘≤3/每月≤1、连续盈利计数、年度冻结。补120年/100份年报裁剪/金额安全整数/NaN与Infinity/UTF-8每槽预算；同seed重复结果确定。保留最小失败seed和状态，报告CSV+JSON，不能只给“900/900”。

#### 15.11.8 R19—R21 真实重新打包设计与门禁

结论：**可以并且需要重新打包，但先修复 P0、补齐实际构建链验收；新包先定性为测试候选。**不要求先拿齐备案/版权证明才能在本地生成ZIP；这些会阻塞上线/提审。正式AppID与版本身份未核清前只生成明确标记的内部诊断包，不猜填生产身份、不称可上传成品。

本地已确认Creator路径 `C:\ProgramData\cocos\editors\Creator\3.8.8\CocosCreator.exe` 存在，项目插件package版本1.2.2；只说明文件可用，不代表编辑器授权、CLI构建或插件实际启用已验。执行者需读取当前进程/工具帮助/构建设置核实，不擅自杀用户编辑器；确有单实例冲突时说明应关闭哪个实例并继续其他任务。

构建前必须完善现有入口，不能照注释当作已完成：

1. `build-tap-v2.ps1`：读取Cocos子进程真实退出码并结合当前版本CLI成功语义判断；某版本非0有特殊含义时按官方/可复现日志明确定义，不简单“一律忽略”。使用当前attempt空输出目录、开始时间和成功日志+必需产物+引用清单判定，禁止旧game.json冒充成功。
2. releaseId、attempt路径限定安全字符，解析绝对路径必须在本项目 `build/release` / evidence范围；已存在同attempt拒绝覆盖。`-SkipBuild`仅联调工具，不得用于正式本轮候选；不能复制旧 `build/wechatgame` 伪称新源码包。
3. 防止插件自动转换与脚本再次转换重复执行：确认本次采用单一转换负责人，记录输入输出路径及实际插件版本。转换→统一补丁→一次打ZIP→最终ZIP校验。后续改任一文件必须新打包重验hash。
4. `patch-release.cjs`：required锚点预期唯一则0/>1均失败；可选兼容锚点说明是否适用，不用全局替换掩盖版本差异。补丁幂等不仅检查注释存在，还验证内容/releaseId/profile/版本与本次一致。诊断宿主错误监听优先使用实际Tap错误API/可用能力，不能假定浏览器addEventListener存在。
5. `verify-package.cjs`：补齐其当前注释承诺但未实现的资源引用、测试hook、生产profile等检查；必需入口实际执行/解析，标记存在不等于init-once运行。动态hash资源引用按构建产物真实清单验证，不硬编码上一轮hash；生产业务/调试入口和适配器内部兼容代码分开判断，禁止无差别全文DOM匹配把合法Adapter误杀。
6. 负包验证至少包括：缺入口/配置、缺被引用资源、坏ZIP/CRC或篡改、反斜杠/绝对/..路径、重复条目、版本或releaseId不一致、生产Mock回落、开发写状态hook残留、required补丁错误、超项目预算。任一应非0，不靠人工看日志。
7. 当前校验器20MiB作为项目上限保留；是否符合当期平台包体/分包/库版本限制需R42按官方后台另核，不宣传20MiB就是平台统一规则。资源 hash、67 UI图/16音频与引擎导入/引用一起核，文件在仓库不等于在最终包。

候选manifest至少记录：releaseId/attempt/purpose（diagnostic或product-test-candidate）、源码HEAD与dirty文件内容摘要（含未跟踪实际源码，排除密钥）、源配置/资源hash、实际Node/Creator/插件版本、运行profile、公开游戏ID字段来源、gameVersion、schema/configVersion、构建开始结束与各步骤退出码/日志、关键入口与补丁结果、ZIP相对路径/字节数/entryCount/SHA256、校验报告路径、关联Web证据构建hash。不要把HEAD当作包含未提交源码的完整版本标识。

先核实际参数后可用命令（版本值由U01/U02和后台记录核定，示例不能原样当版本决策）：

```powershell
npm run check
# ReleaseId 必须全新；将 <...> 替换为实际值后再执行，不使用 -SkipBuild
npm run release-build -- -ReleaseId <新releaseId> -GameVersion <已核定版本> -Attempt 01
```

默认预期产物为 `build/release/<releaseId>/game.zip`，实际目录须以本次CLI/工具输出核实；日志/manifest在 `evidence/m3/build/<releaseId>/`。原 `build/TapBuild/game.zip` 及旧报告只读保留，不覆盖旧失败证据。最终交付分开写“构建成功/静态校验成功/真机通过/云测通过/可提审”，不只打印PIPELINE_OK。

**L1产品测试候选放行**：R12/R30新增FAIL已关闭，R31—R34实现及R36—R40本地验收完成，R35驱动可信、R03/R06/R07/R13/R15—R21在可本地层级补验，`npm run check`与包体负例/正例通过，无未解决本地P0/P1；正式身份不足则降为内部诊断包。设备待验证必须列为未决风险，但不阻止交付用于设备验证的候选——不能要求先用不存在的最终包通过真机才允许构建它。

#### 15.11.9 R08/R09/R41—R45 外部条件与闭环

**启动A/B/C对照**：A为官方最小引擎可点击场景（无经营存档/业务），B加入正式Adapter/启动诊断及配置加载，C完整经营包；保持Creator/插件版本、打包配置、设备/Tap版本尽可能一致，每包独立purpose/hash。A失败优先查平台/引擎接入，A过B失败查Adapter/入口/必要配置，B过C失败再按save/scene/UI阶段定位。各结论以首错/阶段日志为准，不凭“黑屏”归因鸿蒙。可复用原OPPO日志；Redmi/vivo缺失时索取对应文件，不要求全部重传。

**同包矩阵**：至少覆盖原失败OPPO/Redmi/vivo、用户华为（区分Android兼容鸿蒙与HarmonyOS NEXT）、原通过对照机、项目目标iOS；后台抽测没抽到原失败型号不能视为关闭。每台记录型号/OS/Tap版本/容器或库版本/网络/包ID/hash、冷启与恢复各10次结果；成功以实际按钮响应及状态变化判定。关键路径包含首聘、5×跨年、部门/人才、存档强杀恢复、关闭重开；运行30分钟性能与音频开关/循环。无对应设备只能BLOCKED，不能用Chrome设备模拟替代。

**两项性能异常**：先取得U04的具体指标、阈值、设备与日期；本地建立同条件基线，平台复测后逐项写通过/未关闭。若U04暂缺，执行R34测量和优化仍可进行，只不能关闭那两项原平台异常。

**资质与资料**：U01正式游戏ID/字段，U02旧失败版本对应关系，U03额外机型日志，U04性能明细，U05/06设备与权限，U07公开政策信息/可访问地址，U08当期后台主体/备案等必需项状态，U09素材商用来源，U10发行范围，U11最终实机素材，U12授权动作。当前不要求重做67张UI图或16个MP3；只对实测缺失/解码失败/明确版权缺口提出具体assetId替换。无需先建后端或提供Secret。

R42核对当期官方文档和后台实际要求，涉及主体/备案/审核材料只记状态与安全引用，不在设计中假造统一资质清单。平台入口现将添加到桌面列在必接能力，源码检索未见相关调用；须核目标要求与平台差异，必要时在ITapPlatform/设置最小接入并测试失败降级，不在未核实前擅称已经符合。扫码自测不能验证的线上能力明确列待上线阶段确认，不把它当本地构建阻塞。

R43只在明确“允许上传测试包”后执行上传测试；记录后台包ID与对应SHA256，下载报告、失败日志和性能明细。R44收口检查每条需求/缺陷在domain/integration/web/tap-device/cloud不同层的实际结果，全部必要P0/P1关闭且材料齐全才可提审。R45须核清审核通过后是否按设置自动上线：上传、提审、定时/立即发布权限不能混称；提审前准备真实资料让用户确认该动作及预期上线时间。未授权时交付已备好的候选和资料即可。

本次查阅官方来源（2026-11-03，后续执行时复核更新）：[引擎适配](https://developer.taptap.cn/minigameapidoc/dev/engine/Cocos-Laya-Egret/) 支持当前Cocos3.8.x+与1.2.2插件路线；[真机调试](https://developer.taptap.cn/minigameapidoc/dev/dev-support/debugging/) 说明游戏ID、测试账号权限、扫码与Android/iOS调试条件；[文档指引](https://developer.taptap.cn/minigameapidoc/quick-start/document-guide/) 区分开发、自测、上线流程；[桌面能力](https://developer.taptap.cn/minigameapidoc/dev/tutorial/open-capabilities/desktop-folder/) 有平台差异和线上验证限制；[版本提审](https://developer.taptap.cn/minigameapidoc/quick-start/guide/game-publish/version/) 要注意审核通过后的上线时间设置。官方存在旧入口404，本节引用当前可打开地址，不据坏链接推断能力不存在。

#### 15.11.10 每批次执行与最终接收条件

执行者每批次输出实际任务ID、改动文件、回归用例与结果、证据路径、依赖影响、已关闭与仍未关闭的问题。task-result可新增 `implementation / domain / integration / webFunctional / webVisual / tapDevice / cloud / package` 分层字段；每层用PASS/FAIL/BLOCKED/NOT_RUN/确实不适用并说明，不用单一ok=true覆盖缺测。正式生产包不得带开发故障开关。

本轮文档设计完成的验收：两项新增缺陷有实现/失败/恢复/回归路径；21TODO与11待QA均有归属和顺序；构建条件与设备/上线条件分层；缺资料具体到U编号；执行提示可直接定位源码和证据。它不改变当前任务完成计数。本节不要求现在重新跑业务测试，因为本次只维护方案；执行阶段按以上门禁实跑。

最终交付至少包含：更新的本总览/README、各任务task-result、R12前后复现、R30前后截图与几何、E2E正常/故意失败示例及运行报告、900-run与长期报告、候选ZIP+manifest+包校验+构建日志、设备/平台报告或准确缺口、可提审判断及授权状态。不能只给一句“全部完成，下一步发包”。

---

## 16. 交给执行 Agent 的提示词

2026-11-03新增广告与素材专项后，详细实施优先使用**§19.15**，其设计依据为§18；§18.10保留前一版统一提示词。本节模板保留为此前无广告发布整改的交接历史，不能用其“禁止广告”覆盖用户已明确确认的§18有限范围。非广告遗留整改仍遵守§15.11。

### 16.1 连续推进本地整改（推荐直接复制）

以下提示词适用于后续明确要求实施的聊天；复制它才是在该聊天授权本地代码修改/测试/构建。当前文档完善任务本身不因此变成实施或发布授权。若项目已移动，只需替换第一行项目目录。无需把全部设计文档正文粘入提示词。

```text
请进入项目 D:\Workspace\TapTap\我是CEO，执行《我是CEO》TapTap 普通小游戏的发布整改。

这次是实施请求：请实际修改代码、补回归、运行必要测试和本地构建，持续推进到可验证结果，不要只给计划。先阅读 AGENT.md、README.md，以及 docs/我是CEO_项目总览.md 的 §1、§2、§11.9—11.10、§12、§14.3、§15、§17；其他专项内容按当前任务读取。以 §15 的任务卡和共享契约作为实施依据；§14 的历史模拟通过不代表整改完成。

按以下方式执行：
1. 先检查 git status/当前源码与实际 package scripts，保护已有未提交修改。登记 R00，再按 §15.2 依赖领取最早可执行的 TASK-M3-09-Rnn；先报本任务目标、拟改文件、验收和已知阻塞，再动手。已有 DONE 必须有当前有效证据，不重复重做。
2. 每次只推进一个可追踪子任务，完成其实现与验收后回填 §15.2，再自动领取下一项；本次已授权连续推进本地整改，无需反复询问是否继续。默认串行；未经明确分配不启动多个会修改共享文件的 Agent。
3. 优先复现并修复启动/宿主兼容、存档超时误新建、未知写入重复扣费等根因；落实 R04/R05/R10—R14 的数据安全契约。经济配置、黄金预期、单公司/单行业/四Tab等 LOCKED 规则不改。不要加入云存档、内购、广告或强制后端。
4. UI 按 R23—R33 逐页落实字号、行高、间距、有效热区、滚动、安全区、确认流程与既定功能缺口。不能靠缩小字体、压缩整屏、删说明或缩短所有名称解决排版。界面只发命令/读VM，不直接改现金员工。
5. 验证按任务风险进行。金额/存档要核状态、ledger、指针/事务结果及重载；UI要实际点击、截图并打开检查；构建要新目录出包并从最终zip校验。命令必须来自实际配置；新入口先实现再执行。不能把HTTP200、toast、零console错误、文件存在或核心205项全绿当完整E2E/Tap真机通过。
6. 每项新证据放 evidence/m3/完整任务ID/本次attempt/，记录源码/配置/seed/命令/退出码/结果和包SHA256。按 PASS/FAIL/BLOCKED/NOT_RUN 如实分层记录；不得删测试、改黄金、隐藏异常或造占位报告。
7. 缺设备/后台资料时，按 §17 指出具体编号、原因和可替代的证据来源，登记对应任务 BLOCKED；继续其他前置满足的本地任务，不拿Mock关闭真机项。保持 §11/§12/§15/§17 和README一致，不另建平行进展或设计文档。
8. 本次授权包含本地修复、测试和构建；不包含提交/推送、向外发送工单、上传平台、正式提审、发布、生产数据删除或权限变更。涉及这些动作时，先准备好可核对的包/资料并核实现有明确授权，再执行。密码、Secret、token、证件原件不要索取到聊天或写入仓库。

本次目标：完成所有当前可执行的本地整改与验证，准备有manifest的候选包；R09/R41/R43/R45等外部门禁依真实条件处理。不要因一个外部项阻塞而停止其余本地工作，也不要把发布整体标为DONE。

每批次交接请说明：已完成子任务/修改文件、真实测试及证据、仍失败或未测项、需要我补充的§17资料、下一可执行子任务、候选包路径/版本/SHA256，以及Git/上传/审核/发布的实际状态。
```

### 16.2 只分配一个任务给独立 Agent

将下列任务ID和上游证据替换为真实值，适用于多人协作时明确文件责任。若需要其继续下一项，须在提示中明确授权；本模板默认只做指定项。

```text
项目：D:\Workspace\TapTap\我是CEO。
请实施子任务 TASK-M3-09-R12（此处替换为目标ID），以 AGENT.md 和 docs/我是CEO_项目总览.md §15 对应任务卡/共享契约为准。
请先读取 §1/§2/§11.9—11.10/§12、当前任务依赖和相关源码，核对上游证据：[填实际路径]。
本次写入范围：[填明确文件/目录]。共享文件负责人：[如有则填]。不要重做其他任务或覆盖其他聊天改动。
按任务卡完成实现、失败路径和验收；证据写入 evidence/m3/TASK-M3-09-R12/本次attempt/。完成后回填 §15.2 对应行和追踪关系，报告已完成、实际验证、失败/未测、风险及交接。
缺上游契约或外部条件时写明缺口；只做不依赖缺口的部分，不伪造通过。仅授权本地修改/测试/必要本地构建；不提交推送、不上传提审发布、不发送工单、不改外部权限。
```

### 16.3 多 Agent 分工时的最小协调要求

只有用户明确要求多Agent并行时再按下列范围分配；当前文档没有自动启动子Agent。

| 可分配工作 | 主要写入范围 | 必须先稳定的共享契约 |
|---|---|---|
| 启动/打包 | tools、build-templates、boot/Bootstrap | R03/R06与R20入口契约；避免双方改同一模板 |
| 存档/平台 | core/persistence、GameStore、platform | R10/R11/R12错误/事务类型；一次只由一个负责人改 |
| UI | ui、页面组件、只读VM | R23—R26基础件及命令预览契约稳定后按页面分配 |
| QA/发行核对 | tests、E2E工具、证据、资料核对 | 用稳定接口与构建manifest，不在被测代码中偷偷修业务 |

AppView.ts、package.json、AGENT.md、本总览和公共类型属于共享文件，指定一个整合者或串行修改。测试Agent可提缺陷，修复由责任任务落实；不同时修改同一个失败点。并发重读并合并当前内容，不用整文件覆盖。独立执行任务无需为了“多Agent”重构所有页面。

### 16.4 恢复已有整改聊天的短提示词

```text
继续《我是CEO》发布整改。先核对最新 git status 和项目总览 §15.2 的任务/证据，再继续最早前置已满足的未完成本地任务；不要重做已有有效证据的DONE，不把旧包测试沿用给新包。按 §15 共享契约和任务卡实际实施、验证、回填，缺外部条件按 §17 报具体项并继续可做部分。授权边界沿用本聊天，未授权上传/提审/发布不自行执行。交接给出当前任务、证据、剩余阻塞和下一项。
```

---

### 16.5 本次独立复核后的完整实施提示词（2026-11-03，优先使用）

下方可直接复制给执行Agent。它明确授权该执行会话的本地实施和重新打包；本次编写方案的会话不据此自动开始修改生产代码。§16.1/16.4旧模板仍可参考，但任务起点必须使用§11.11/§15.11最新复核，不能直接从R31跳过退回缺陷。

```text
请进入 D:\Workspace\TapTap\我是CEO，实施《我是CEO》尚未完成的发布整改，并在本地条件满足后重新构建可追溯的TapTap普通小游戏测试候选包。

本次是实施请求，已授权本地代码/测试/文档修改、必要本地依赖准备、Web验证、Cocos构建和重新打包。请持续完成当前可执行工作，无需每做完一个任务询问是否继续。未授权Git提交/推送、平台上传、对外发消息/工单、正式提审、上线、生产数据删除或外部权限变更。不要擅自结束在“建议这样做”。

先阅读 AGENT.md、README.md，以及唯一权威文档 docs/我是CEO_项目总览.md 的 §1、§2、§11.11、§12、§15.2/15.3、§15.11、§17.5；相关原任务卡按需读取。§15.11是本次详细设计与执行顺序，不另建第二份进度/设计文档。先核git status、当前源码、真实package scripts和工具参数，保护其他聊天的大量未提交修改，不reset/clean/整文件覆盖。默认串行，不自行启动子Agent。

当前基线：16 DONE / 11 READY_FOR_QA / 21 TODO；typecheck/typecheck:ui/lint及49文件412测试通过，R30原脚本43断言/27截图通过，但两项独立缺陷已复现，不能用这些通过记录覆盖FAIL：
1) R12/P0：指针实际写成功但回调报错后，磁盘投资10000已保存，内存仍旧；不重启直接修改方针，会把已保存投资及命令记录覆盖，且重复使用revision12。先读 evidence/recheck-20261103/review-transaction.cjs、transaction-review.json，再把缺陷转成正式回归并修复。
2) R30/P1：调岗待生效长状态与薪资重叠约13.92逻辑单位，且越出76高卡片。先看 talent-transfer-overlap.png、ui-layout-review.json和review-ui.cjs；原UI检查只验证字符串/业务结果，没验证布局。

执行批次按§15.11.2：刷新基线与R46追踪索引 → R12修复/关联回归 → R30布局修复 → 构建链R03/R06/R07/R16/R19—R21接入与诊断候选/R08准备 → R35驱动 → R31排行/R32历史年报/R33其余流程与R13/R15/R17/R18补验 → R34性能及R36—R40完整验证 → 最新源码产品候选包 → 条件具备后R09/R41—R45；R47持续回填。遇到一个设备/资料阻塞，列明U编号并继续其他可做任务。已有有效DONE不机械重做；上游变更跑受影响回归。

R12遵守：恢复闸门和瞬时锁分离；在生成新draft前恢复并同步已验证状态/revision/run/generation；undecidable时禁止新写入、保留journal并可重试；commit拒绝旧基线。覆盖同命令重试/不同命令连续操作/写前失败/实际写成功后报错/回读失败/清理失败/迟到真实写/月结和重开/恢复后继续两个月。付费意图不得在旧预览下悄悄自动重放；不能靠清档或忽略回调掩盖未知结果。clockTick不再静默吞掉持续保存失败。

R30优先采用等高且足够高的卡片、简洁状态+详情完整说明，统一cardHeight/step/listTop/contentBottom/池绑定；如变高必须同步虚拟列表索引算法。测三视口、最长合法文本、所有员工状态、0/2/10/30/100人数、筛选与首尾复用。自动测矩形相交与越卡，再打开截图人工检查并实际点击；图片无法读取不能算视觉PASS。补齐性格与明确招聘入口。不得缩小字体或删掉必要规则来凑通过。

R31—R33按§15.11.6实现，复用既有领域规则：排行榜只读/本地模拟/我方摘要；历史年报真正选年份，旧年缺现金桥字段明示不可用，不从当前员工伪造历史；新可选年结快照保持旧档兼容；离线摘要只展示已结算结果，教程重播不重新首聘，救助仅一次资本且不计利润，音频失败不阻塞经营。经济配置/黄金值/单公司单行业/不自动裁员等LOCKED规则不改，不扩展云存档/广告/内购/强制后端。

验证使用真实UI+状态/ledger/存档回读，不能只看toast或HTTP200。E2E复用playwright-core，使用实际布局坐标/actionId，不靠直接调Facade绕过按钮。开发故障/时钟hook不得进生产包；验收任一FAIL必须非零退出，故意遮挡/禁用/缺资源/文字重叠应被检测。900-run按实际结束月数、逐月守恒和逐年招聘限额验证，不能以总聘人数≤15替代每年≤3，不能改黄金值或伪造全部跑满60月。实时1×/2×/5×与测试时钟结果分栏。

构建前修实R19—R21：核Cocos退出码+日志+新产物，拒绝旧目录/同releaseId覆盖；required补丁锚点不允许盲多命中；检查最终ZIP资源引用、profile、测试hook、版本及hash；输出包含dirty源码摘要/配置/资源/工具版本/日志/步骤结果的manifest。正式候选不能使用-SkipBuild或复制旧wechatgame。先读当前脚本帮助，再使用实际参数执行 npm run check 和 npm run release-build -- -ReleaseId <全新ID> -GameVersion <已核定版本> -Attempt 01，不原样使用尖括号占位值。正式身份/版本不明只出明确标记的内部诊断包，不能猜成可上传正式包。旧build/TapBuild/game.zip及旧报告保留只读。

不要把真机/备案当本地生成测试ZIP的前置，也不要把ZIP生成当可以上架。详细放行按§15.11.8/17.5：先交L0本地结果与L1测试候选，设备/平台/资料不足列BLOCKED；L2同包真机云测通过、材料齐全再判断L3可提审。真机必须覆盖原失败机型、华为系统形态和项目目标iOS；Mock不替代。核当前官方能力/后台要求，源码未见的“添加到桌面”按R42核实并必要时最小接入。平台上传/提审/上线需要各自已有明确授权，尤其注意提审后按设定时间自动上线的语义。

每项证据写 evidence/m3/完整TASK-ID/新attempt/，记录真实用例、源码/配置/seed、命令/退出码/结果；UI附打开检查过的前后截图，金额附state/ledger/pointer/journal回读。回填§15.2与R46追踪，区分domain/integration/web功能/web视觉/Tap设备/云测/包体的PASS、FAIL、BLOCKED、NOT_RUN；只读报告ok=true不能覆盖未测层级。恢复已有源码修改时先重读再合并。

最终交接：完成任务与实际证据、仍失败/未测/外部阻塞、需我补充的U编号与最小内容、候选ZIP绝对路径/版本/releaseId/SHA256/manifest/构建日志，以及“本地可玩/测试包已生成/真机通过/云测通过/可提审/已上传/已提审/已发布”各自真实状态。若当前无法出包，给出具体失败步骤和已完成的准备，不把旧包当新包。先从R12复现和正式回归开始。
```

---

## 17. 需要用户补充的信息、素材与提供方式

### 17.1 本轮已经能确认的内容

资料核对日期：2026-11-02。此节仅清点现有本地文件和公开配置字段是否填写，未登录TapTap账号，不推定后台主体/权限/备案最新状态。

| 类别 | 仓库现状 | 是否需要用户重新提供 |
|---|---|---|
| 运行时UI图片 | `assets/resources/ui/` 共67个PNG；设计asset_registry也有67项；已核文件头/清单路径与尺寸 | **目前不需要重做基础UI素材**；仍需引擎实际导入/引用与手机视觉验收 |
| 背景音乐/提示音 | `assets/resources/audio/` 共16个MP3：2BGM+3短乐+11音效；16项文件存在，SHA256均与audio_manifest一致 | **目前不需要补齐音频文件**；需确认使用现有版本及商用来源，真机听感/接缝待验 |
| 启动图 | tools/splash 内logo.png、slogan.png、splash.jpg均存在且非空 | 无需重发；如要改品牌样式再提供新版本 |
| 设计参考 | 现有UI交付包、tokens、页面registry、图标和角色图片 | 优先复用，无需先找新设计师才能修间距 |
| 商店素材候选 | 512图标、横/竖封面、1920×1080与1440×1440宣传候选存在 | 需选择/确认最终使用，执行者核当前后台规格与内容规范 |
| 概念截图/宣传动画 | 有NotGameplay标注的概念图和26秒动画宣传片 | **不能替代最终可玩版本的实机截图/录屏**；技术可玩后再采集 |
| 音频WAV母版/试听合辑 | 前轮清理已删除，运行MP3仍在，原创合成脚本存在 | 非运行缺失，不阻塞本地修复；仅需要重新母带/无缝格式时再重生或提供 |
| 运行配置 | runtime.config.json存在，authEndpoint和privacyPolicyUrl目前为空 | 空authEndpoint符合当前无强制后端路线；政策URL/内置全文要落实 |
| AppID配置 | 当前构建产物project.config.json的appid字段非空 | 无法据此判断它是微信占位还是正式Tap目标；仍需核后台字段含义和对应关系 |
| 资质/版权 | 有草稿与历史说明，非本轮后台核验或法律/版权证明 | 提审前需确认真实状态与所用素材来源 |

上述“文件齐全”只证明文件清单/基础校验，不等于图片美术质量、MP3解码/音质、版权许可或Tap实际加载通过。核对元数据见 `evidence/release-handoff-20261102/asset-inventory.json`；本轮未重新执行游戏或音频播放测试。

### 17.2 按阶段提供的资料清单

阶段：**现在**=帮助定位现有失败，未收到时仍可修本地兼容/存档/UI；**真机前**=实际手机联调需要；**提审前**=发行资料核验需要；**可选**=不阻塞当前默认路线。完成资料交付不自动等于授权平台写入。

| 编号 | 资料/确认 | 时机与影响任务 | 最少需要什么 | 当前状态 |
|---|---|---|---|---|
| U01 | 正式Tap小游戏身份 | 现在，R01/R16/R42 | 后台“小游戏基本信息”中的小游戏ID/AppID、字段名、游戏名称、普通小游戏形态；可脱敏截图或复制非秘密标识 | 待用户确认；产物appid非空不能代替 |
| U02 | 失败上传包身份 | 现在，R01/R09/R43 | 截图1.1.0对应的实际zip/本地路径，或后台包ID、上传时间、版本及可取得的hash | 待补；当前本地zip内版本1.0.0 |
| U03 | 另外失败设备日志 | 现在，R09 | Redmi、vivo各自完整平台日志压缩包；已有OPPO包无需重发 | 待补 |
| U04 | 两项性能异常明细 | 现在，R34/R41/R43 | 性能测试页的指标名、实际值/阈值、设备、测试时间、截图/导出报告 | 待补；只有“2项”汇总不足以定位 |
| U05 | 用户自测设备与失败现象 | 现在/真机前，R09/R41 | 华为和vivo具体型号、系统版本（区分HarmonyOS NEXT/兼容Android）、TapTap版本；停图/黑屏/闪退/弹窗、持续多久、能否开日志及一段录屏 | 仅已有品牌反馈，规格/过程待补 |
| U06 | 可用于真机联调的设备/权限 | 真机前，R09/R41 | 是否可USB/同局域网调试或按步骤扫码；测试TapTap账号是否已有该游戏自测权限；iPhone/iOS是否可用 | 待确认；不需提供账号密码 |
| U07 | 隐私公开信息与政策地址 | 提审前，R18/R42 | 确认现有草稿开发者名称/联系邮箱是否正式公开；可访问HTTPS政策URL及是否已有可用域名/托管 | 草稿部分填值但正文仍有占位；URL未配 |
| U08 | 当前后台资质状态 | 提审前，R42/R44 | 开发者主体已认证否、小游戏备案/软著/其他后台要求的状态和待补项；可只给状态与脱敏截图 | 历史记录非最新核验；待确认 |
| U09 | 图片/字体/音频商用来源 | 提审前，R42 | 所用图标/头像/启动图/宣传图/字体/音乐是否用户自制、生成、委托或授权；保留来源/许可证明路径；有替换需求明确assetId | 音频有原创生成说明；全素材证明待确认 |
| U10 | 发行目标设备范围 | 真机前，R41 | 保持Android+iOS及现有华为/vivo覆盖，或指出平台后台确实允许且用户希望的范围；未经明确变更仍按既有目标 | 默认沿用项目目标，不擅自取消失败设备 |
| U11 | 最终商店素材选择/实机采集 | 提审前，R42 | 现有图标/封面/宣传候选是否继续使用；至少满足后台实际要求的最终实机截图和录屏，或安排用现有设备采集 | 候选已有；最终实机素材尚缺 |
| U12 | 平台动作授权 | R43/R45执行前 | 明确允许“上传测试包”“提交版本审核”“审核通过后正式发布”中的哪些动作；工具可用时再执行 | 本轮仅要求完善方案，未授权这些外部动作 |
| U13 | 服务端认证资料 | 可选，仅明确启用后端交换时 | 可用authEndpoint、部署环境归属与安全配置方式；Secret由用户在可信服务端环境注入 | 默认不需要；不为解决加载问题先要求建服务器 |

**不要求提供到聊天或仓库**：TapTap密码、验证码、App Secret/Server Secret、Client Token、session_key、访问令牌、私钥、身份证件原图。普通游戏ID/AppID用于配置定位，不等同于Secret；发送截图前遮掉Secret/token栏。需要操作后台时优先用户已登录的受控会话/正式角色授权或用户自行操作回传结果，不传原始凭据。

### 17.3 建议用户先回复的最小一批

先提供 U01—U05 即可明显提高启动问题定位效率；U06在真机联调前确认。若暂时找不到全部资料，可以按下面格式回复“不清楚/暂时没有”，本地修复无需因此暂停。

```text
1. Tap小游戏ID/AppID（注明后台字段名）：
2. 失败版本1.1.0的zip位置或后台包记录/上传时间：
3. Redmi/vivo日志位置（已有OPPO无需重发）：
4. 两项性能异常的明细截图/报告位置：
5. 华为：型号 / 系统版本 / TapTap版本 / 失败现象：
   vivo：型号 / 系统版本 / TapTap版本 / 失败现象：
6. 可配合的真机：Android/华为/vivo/iPhone；能否扫码/USB调试：
7. 隐私公开信息/URL、现有图片音频继续使用及来源证明：现在确认或后续提供。
```

### 17.4 给执行 Agent 的资料处理规则

- 收到资料后只更新此节状态/安全索引和对应任务证据；不要重复询问仓库已经有的67图/16音频、已有OPPO日志或已有AppID。
- 当前环境可读的本地文件先核查；需要新设备或平台日志时只索取缺少的那个机型/版本，不笼统要求“再发全部资料”。
- 如果发现一张确实缺失的图片，报告resourceKey、目标页面、所需尺寸/透明度/格式与现有替代；如果音频缺失，报告audioId、触发场景、时长/循环要求与清单差异。不得因为UI排版不好就认定必须新增插画。
- 版权来源不明确时先保留内部开发使用状态并列发行待核，不虚构授权；需要用户裁决的替换才提出具体选项。公开政策/主体信息可确认现有草稿，避免重复索取已有个人信息。
- 缺资料不妨碍无依赖的本地任务；依赖设备/后台的结果保持BLOCKED/NOT_RUN。能准备的候选包、复现脚本、采集步骤先准备齐，再请求用户配合。

### 17.5 本次重新打包是否可行、还缺什么（2026-11-03）

**可以在本地整改验收后重新打包，交付用于真机/平台自测的候选ZIP。现在不能据412测试通过直接宣布可上架。**本次只交付设计，未运行新构建；§17.1—17.3是前次资料盘点，不能忽略本次R18源码已提供内置全文等后续变化。外部真实状态尚未核实的项仍保持待确认，不因本地代码填了值就认为获用户确认。

| 条件 | 本次可确认事实/尚缺内容 | 阻塞本地编写/测试吗 | 阻塞哪一层 |
|---|---|---|---|
| R12/R30新增失败 | 有可重现证据，未修复 | 不阻塞开始修复 | 阻塞合格产品候选放行；诊断构建可明确标记后用于定位 |
| R31—R40与11项QA | 具体实施/验收见§15.11 | 可自主推进 | 阻塞L0完整验收；不把少数专项通过当全部完成 |
| Creator/插件/依赖 | Creator3.8.8可执行文件存在，插件package1.2.2；实际CLI/插件启用/输出仍待验 | 可先核本地，不需先找用户发账号 | 工具确实不可用才阻塞L1；说明具体错误，不泛称缺环境 |
| 正式小游戏ID与版本 | U01后台字段来源、U02旧1.1.0与本地1.0.0对应未确认 | 不阻塞领域/Web修复 | 可先内部诊断构建；正式配置候选/平台测试前必须核清，不能猜版本 |
| 测试设备与自测权限 | U05/06：具体机型/OS/Tap版本、扫码或USB配合、目标游戏测试权限 | 不阻塞L0/L1 | 阻塞R09/R41真机结论；iOS深度调试按官方可需macOS，基础扫码和日志采集与深度调试分开安排 |
| 原失败机型日志 | U03的Redmi/vivo日志仍缺，OPPO已有 | 不阻塞通用兼容修复 | 原故障根因闭环不足；可用新包同型号复测补证，不伪称历史已知 |
| 两项性能异常 | U04具体指标/阈值/机型/时间仍缺 | 不阻塞采集本地性能基线 | 阻塞宣称两项平台异常关闭 |
| 隐私信息与URL | R18内置全文已有实现；U07需确认开发者/联系信息公开口径、正式政策地址及后台要求 | 可本地使用内置全文验证 | 最终公开材料一致性与提审门禁；地址未落实不等于本地弹窗不存在 |
| 主体/备案等材料 | U08须按当期后台必需项确认状态 | 不阻塞内部测试ZIP | 阻塞必要发行资质/提审，不虚构具体证书已齐 |
| 图片/字体/音频许可 | U09：现有资源基本齐全，商用来源与证明待确认 | 不需为修排版重做67图/16音频 | 阻塞未核资源的对外发行；实测坏资源才要求具体替换 |
| 商店成品素材 | U11：候选已有，最终可玩版本实机图/录屏未齐 | 可先修复和构建 | R42/R44商店材料；概念片不能替代实机录屏 |
| 上传/提审/上线授权 | U12必须分别明确，准备包不等于授权上传 | 不阻塞本地工作/准备交付 | 对应外部操作前置；不把本提示词扩大为发布授权 |
| 后端/Secret | 当前无强制后端路线，U13默认不需要 | 不阻塞 | 不为解决卡加载先建服务器；确有新业务决策再评估 |

建议用户可分批提供：**第一批**U01正式游戏ID及字段名、预期测试版本/旧失败包身份（U02）；**第二批**U05/06设备规格与测试配合，U03额外日志/U04性能详情能找到多少给多少；**第三批**U07—U11发行材料与公开信息确认。已有材料先核仓库/当前授权可见后台，不反复要求重发。任何密码、验证码、Secret、token、证件原图不进聊天或仓库。

重新打包后的推荐交付方式：执行Agent给出候选ZIP、manifest、校验与未测清单；用户确认只允许“上传测试包”后再做自测/云测。若用户自行上传，提供hash/版本核对步骤并收回包ID/报告；不要求转交密码。待R41/R43同包结果和资料齐全，再单独确认提审及审核后上线时间。最终是否可上线只能由真实平台回执与可玩状态证明。

---

## 18. 本轮统一交接：整改验收、9:20素材与TapTap激励广告（2026-11-03）

### 18.1 用户范围、验收结论与证据基线

用户本轮要求三件事：验收上一轮整改；参考 `design/00_ALL_49_PNG_37_SVG` 并替换合适图片；设计TapTap广告场景、技术接入和执行提示词。已进一步确认两条产品规则：**每日提示一次，可跳过继续经营；完整观看免一次性招聘费，月薪照付、次月生效、首聘两人不参与。**本轮实施限合适的背景资源接入，广告仅完成设计、未接入或启用。未上传/提审/发布，未提交或推送。

验收结论：**指定旧缺陷修复有效，但上一轮整体工作未完成，不能总验收通过。**当前记录本身仍有未完成项；不能把用户转述“已完成”或一份全绿测试结果作为最终事实。

| 范围 | 本轮独立验证 | 结论及限度 |
|---|---|---|
| 代码门禁 | `npm run check`：类型/表现层类型/lint通过，51文件通过、1文件跳过；427测试通过、1 opt-in导出测试跳过 | PASS；跳过项为NOT_RUN，不写成428通过。日志 `evidence/acceptance-assets-ads-20261103/check.log` |
| R12指定未知提交缺陷 | 真实Facade/Store/Repo注入“活动指针实际写成功后回调失败”，不重启直接切方针；投资资产10000保留，revision12→13；重载一致 | 指定复现PASS，`lostCommittedInvestment=false`、`revisionReused=false`；不等于N04—N10及迟到底层写/重开已全验 |
| R30业务与原文字重叠 | 实际浏览器重跑现有脚本45断言、27截图、0 pageerror；查看调岗截图，短状态与薪资不再重叠 | 原指定问题PASS；仍有下述新发现，R30不能保持完整DONE |
| R31/R32专项 | 实际Canvas重跑5项，榜切换/我方详情/只读、年份切换及旧年现金桥不可用提示通过 | PASS仅限专项；UI夹具中的年报不是领域自动生成的完整财务边界，不能代替100年/所有等式验收 |
| R33专项 | 设置/音频开关落盘、写失败回滚、教程重播等6项，0浏览器错误 | PASS仅限专项；离线/救助完整UI、音频生命周期和单资源故障仍待验 |
| 新Tap诊断ZIP | 独立重新读ZIP/CRC/入口/profile/Mock/hook校验通过；5150854字节、452项、SHA256 `16e0685d51defa34f76f35eb6441849468c8c716d1f7d9cff977e0a3fd425c38` | 路径 `build/release/m3-20261103-diag-f/01/game.zip`，purpose=diagnostic；不是完整产品候选。未真机/云测，且本轮换图后的源码不在该旧ZIP内 |
| R40现有证据 | 查阅900×60月JSON/CSV及对应门禁；实测五年矩阵已有 | 没有新增120年/整数边界证据；不能把局部导出中的status=DONE覆盖总览长期缺口 |

**新发现 REVIEW-20261103-03（P1，R30/R39）**：卡片由76增至108后，`listTop=170`仍写死，第二排筛选中心238、热区44；首卡上边界224与筛选下边界216在authored坐标重叠8单位。独立实际UI读回：首卡y=522..630，市场/客服/财务按钮y=622..666，重叠8。`filter-layout-review.json`与`r30-filter-card-overlap.png`保存在本轮证据目录，旧Web与新背景Web均可见。这是布局回归，不是图片拉伸导致。R30退回IN_PROGRESS，原状态文字修复记录保留。

整改：筛选区域高度从实际行数/按钮高/行距计算，列表首卡中心必须满足 `firstCardTop <= lastFilterBottom - gap`（坐标向上时），gap按既定至少8单位；本例若仍用108高，listTop至少从170下移到154或更低，再统一更新虚拟列表与末项空间。不要只移动渲染卡片而忘content/pool公式。按钮间4单位间隔也要按原8单位基线修复；不能缩按钮热区。

验收脚本先前等待仅“标签存在”时可能点击到尚未消失的Web首屏遮罩，出现未切页；本轮定位后等待已知首屏阶段再复现。R35应改为可观测遮罩移除/实际可交互状态，不能一直增加固定sleep或重试点击掩盖问题。

### 18.2 新素材清点与部署判定

本轮实际解码49PNG，全部1080×2400；逐个SHA256与 `Asset_List_49.csv` 一致；37SVG存在。原始交付目录保持不动。不要因目录名含“背景”或“正式UI”就把所有图拷进运行包。

| 类别 | 数量 | 本轮处理 | 原因 |
|---|---:|---|---|
| 无字浅蓝通用背景 | 1 | **已接入** `assets/resources/backgrounds/CEO_BG_SoftBlue_UI_9x20.png` | 真正装饰背景，无模拟按钮、财务数字或状态；39606字节，与用户源图字节一致 |
| 新启动插画 | 1 | 暂不覆盖现有 `tools/splash/splash.jpg` | 烘焙“正在启动游戏/78%/进度条/提示”，完整贴图会伪造进度并与真实条双重显示；需独立无加载控件版本或可审查运行时分层方案 |
| 01_OfficialUI_PNG整屏UI稿 | 37 | 布局/色彩/安全区参考，不作为真实页面贴图部署 | 含固定公司名/员工/现金/按钮；贴图无法完成输入、滚动、无障碍与状态变化，不能覆盖实际控件 |
| 02_OfficialUI_SVG | 37 | 保留可编辑参考源，提取纯装饰层时另列映射 | 不能把文字图层一起当背景；原样打进resources会造成包/纹理冗余 |
| 03_ConceptReference_PNG | 10 | 仅参考，不进入运行包/不冒充实机截图 | 交付说明也明确是历史概念稿 |

现有运行时 `assets/resources/ui` 多为图标/头像/组件；实际AppView此前主要用Graphics/Label/Button，并未拿这些整屏稿绘制界面。因此不能用“替换49张图”解决文字、间距或热区问题，也不能为了匹配新设计稿一刀切把全项目375×812改成375×833.33。

### 18.3 本轮已完成的资源替换、适配与验证

**实际改动**：增加无字背景PNG及Creator生成的meta；UiFactory新增 `attachCoverBackground`，AppView在持久Backdrop上加载一次背景，并将FullPanel装饰填色改透明，让底图可见；白卡片/导航/文字/按钮与业务状态不改。异步资源没加载时保留原主题色，失败继续经营；回调检查节点仍有效。背景不加BlockInputEvents，不参与ScrollView内容高度，不随Tab重建，不占用交互热区。

适配策略：保持原图长宽比，`scale=max(viewportW/imageW, viewportH/imageH)`作cover；居中裁切仅裁无字底图。UI仍按安全区锚定，正文滚动，不整体缩小字体/按钮。尺寸变化只重算图片显示尺寸，支持热resize。以实际Canvas逻辑尺寸计算，不能混用物理像素、DPR、safeArea和设计单位。

新Web真实构建：`build/asset-review-20261103/web-mobile/`，Creator退出码36且有 `build Task (web-mobile) Finished` 标记与本次新鲜入口；日志在本轮证据目录。构建对旧参数mainBundleCompressionType及字符串布尔参数有告警并使用默认值，已记录，不能称完全无告警。未改写旧diag-f ZIP。背景改动后表现层类型与lint通过。

实际四视口375×812、360×640、390×844、375×834：16项断言通过，0浏览器错误；图片ratio=1080/2400、覆盖父层、主题色fallback加载后关闭、实际点击“人才”且revision不变、热resize后仍可用。截图已打开查看；`background-report.json`、各viewport截图与 `asset-replacement.json` 可回查。报告里的最终viewport是缩短60px后的resize结果，目录/初始geometry明确原测试尺寸；不得混称只测了752/580/784/774高。

另在新Web构建中拦截背景PNG请求模拟失败：资源未加载时原主题Graphics保持开启、公司UI可用、0 pageerror，故障测试PASS（`background-failure-report.json`与截图）。该预期请求失败与未预期资源故障分开记录。

尚未覆盖：真机低端GPU/纹理上限、图片加载失败实机表现、不同屏幕色彩。1080×2400 RGBA解码约10,368,000字节（9.89MiB），文件小不等于显存小；不能把49张整屏图全部常驻。后续需核设备MAX_TEXTURE_SIZE及Creator导入/纹理压缩；若不支持2400高，用保留母版的构建导出或平台可用纹理尺寸降采样，不拉伸、不在业务代码修改原设计稿。该风险不改变本轮Web已通过事实，也不提前写真机通过。

### 18.4 启动图下一步的可执行处理

新版启动图不是漏拷贝，而是不能把示意78%作为真实加载进度上线。旧图941×1672与新图1080×2400都不得靠硬编码旧坐标混用。

推荐从设计源另导出 `CEO_Splash_ArtworkOnly_9x20.png`：保留Logo/人物/办公室，去掉加载文字、百分数、进度条和可变提示；这属于装饰层导出，不要求重做37页。可由用户提供分层源，也可在明确图像编辑流程中生成干净衍生版本，原图只读保留。无可用干净稿时维持旧首屏并把该任务BLOCKED于具体一张资源，不能阻塞其余背景或广告工作。

替代可审查方案：保留原文件，在运行时只采样不含示意进度的艺术区域，并把真实进度放独立区域；需证明不同屏幕裁切均不显示78%且主要Logo/人物不被切坏。不得未经验证用实色块粗暴盖住有文字背景，或把图片中的78%当成真实加载状态。

实施范围：`tools/splash/first-screen.js`、`patch-release.cjs`、实际使用的Web首屏模板/patch-splash入口；图片尺寸从资源实际数据读出或对应配置同源，cover要同时考虑宽高（旧“只按高度铺满”在宽屏会留白）。背景图失败/WebGL失败仍允许引擎继续；真正模块/存档失败继续交给R03/R13错误页，不能首屏宣称100%后卡死。动画/纹理/程序/缓冲在引擎接管时释放，只有一个rAF循环。

验收：新资源hash、构建后最终ZIP包含正确图片、首屏0/50/100%来自真实进度、图片/进度条不相叠；360×640/375×812/390×844/9:20、刘海与底部手势区、冷启/失败降级各截图和点击。不能用更换图片代替原OPPO/Redmi/vivo启动根因回归。

### 18.5 广告产品规则：用户已确认与建议基线

**已确认LOCKED**：每日只提示一次；“暂不观看，继续经营”始终有效；不看不退出、不自动播放；完整观看免一次性招聘费，员工月薪照常、次月生效；不参与首聘两人。用户最初提出的“观看或退出”已由后续明确回复替换，不再作为备选实现。

推荐首版只做激励视频，两个入口共享一个奖励池；不做Banner/插屏/强制开屏，不把原本免费的功能改成广告必经路，不改经营黄金基线。以下次数/有效期是建议BASELINE，执行者按文档实现，若用户另行调整需同步配置和测试。

| 场景 | 玩家体验与奖励 | 限制与回退 | 首版 |
|---|---|---|---|
| A 每日创业支持 | 当日进入稳定经营页后提示一次：“观看完整广告，领取1张招聘费减免券；员工月薪照付”。按钮“观看广告领券”“暂不观看，继续经营”同等可达 | 当日成功发券最多1张；背包最多1张有效券，已有券时不诱导继续看；无广告/断网/拒绝直接经营 | 实施 |
| B 招聘时费用减免 | 普通日常招聘确认同时展示“正常支付¥X招聘”和“观看广告领取减免券”；拿到券后玩家再次确认“使用券，招聘费¥0，月薪¥Y，下月生效” | 与A共享每日1次，不额外叠加；已有券直接使用，不再看；取消招聘保留券，候选过期不吞券 | 实施 |
| C 额外人才推荐批次 | 自愿完整观看后取得1次额外换批权，不保证稀有/高能力；保留原免费换批规则 | 独立次数和随机流需评估，不偷改既有免费功能；先标DEFERRED，经济与频控评估后另开 | 不默认启用 |

不推荐首版做“离线收益翻倍/广告无限救助/免费建部/广告后永久免工资”，这些直接改现金/生存与财务口径、需要更大经济再平衡；也不以真实广告收益给游戏公司记“营业收入”。开发者广告结算是真实平台收入，和游戏内整数元账本严格分离。

每日提示时机：privacy已同意、save已装载、首聘两人完成、没有错误/危机/收费/年报覆盖层、没有未决存档、首启至少60秒实际体验后；广告组件预载也在隐私同意后。用户未满足时只延后一次，不在首聘/进度页/存档错误页打断。只展示自愿奖励说明，不直接调用show。拒绝后当日不再自动弹；玩家仍可主动从招聘入口查看。后台恢复不等于再次登录，不重复弹。

频控BASELINE：北京时间自然日00:00换日；A/B共享成功领奖上限1/日，每次成功仅1张券，有效期7自然日、只用于当前公司；广告请求失败最多手动重试3次/日，相邻尝试至少120秒，禁止自动无限重载。失败/未看完不消耗成功名额，但每日自动提示已出现就记一次；不需要玩家看多次才能拿同一份奖励。未支持平台不展示空白广告位或永远灰按钮，正常付费招聘始终保留。

日期使用 `(epochMs+8h)` 的UTC日键明确计算，不读取宿主随意切换的时区。记录lastSeenDay/highWaterTimestamp，时钟回拨不重置额度；大幅异常前跳/回拨时暂停广告奖励并允许正常经营。纯本地存档无法彻底防改时间/清应用数据/改文件，不声称服务端级反作弊；若后续要高价值奖励/跨设备限额/可靠服务端验证，须单独评估后端，不在本轮强行搭建。

### 18.6 TapTap接口、广告平台与能力边界

本项目是Cocos普通Tap小游戏。官方通用AI接入指南明确其快捷流程适用于星火/H5/TapTap制造，普通Tap小游戏应走Dirichlet广告联盟；不能照抄H5场景专属SDK或把APK原生SDK接入当本项目方案。本项目JS广告API按当前官方 `tap.createRewardedVideoAd` 系列落地，adUnitId由对应普通小游戏/OS/广告样式的实际后台生成并核实。

| 接口/事件 | 已核官方语义 | 本项目要求 |
|---|---|---|
| `tap.createRewardedVideoAd({adUnitId})` | 默认单例，部分API文档提供multiton参数 | 首版仍采用单实例+全局互斥，不依赖多例；检测函数是否真实存在 |
| `load()` / `onLoad` | 拉取素材，创建后可能自动加载；关闭后可自动预载下一条 | 保存READY状态，错误不无限重试，下一次展示仍需新玩家意图 |
| `show()` Promise | 只表示显示操作成功/失败，不是看完 | `.then()`绝不能发券或加员工；load后重试show最多一次且仍绑定同一意图 |
| `onClose(res)` | `isEnded`表示是否完整观看后关闭 | 仅 `res && res.isEnded === true` 可形成完成凭据；false/undefined均不给奖励 |
| `onError({errCode,errMsg})` | 1000—1008中有网络/参数/无效广告位/无填充/审核/封禁/关闭等 | 1004正常无填充，提示稍后；1001/1002等记配置错误；所有情况允许经营 |
| `offClose/offError/offLoad`、`destroy()` | 移除监听与销毁实例 | 使用相同函数引用解绑；不在每次切Tab重建；没有hide能力，不能假定可主动隐藏原生广告 |

新增独立广告平台服务/接口，例如 `IRewardedAdProvider`、`TapRewardedAdProvider`；业务层不得访问全局tap或SDK实例。`ITapPlatform`可暴露工厂/能力查询或组合Provider，避免把几十个广告回调塞进GameFacade。CocosPlatform/真实TapAdapter按现有平台选择实现；开发Fake只在tests/开发构建，正式包无Fake自动completed降级。

公开配置建议 `enabled:false` 默认、placement `daily_recruit_support`/`hire_fee_waiver`、真实adUnitId、policyVersion、每日额度/券有效期/冷却、支持平台。首版两个placement可复用一个实际广告位，若后台要求分位则分别配置但仍共用业务额度；不为缺ID生成假生产ID。对外放行enabled=true前必须通过能力/身份/隐私/真实广告验收；内部真实位联调按§19.9准备可播放的非公开测试构建，不要求先验证一个尚不能播放的disabled包。“配置了enabled”不能视为后台广告已开通。

服务返回语义建议 completed / skipped / unavailable / failed / uncertain，并带有界reason/sessionId，不携带原始平台用户标识。SDK/函数不存在返回unavailable，禁用可选奖励入口、正常经营。业务UI不展示SDK原始堆栈，不记录code、token、完整存档或设备标识。不要在没有实际政策/服务端回调资料时杜撰SSV签名字段与验证接口。

### 18.7 广告会话、发券、招聘事务与存档恢复

架构：`UI → AdRewardCoordinator → Provider + GameFacade广告命令 → GameStore/SaveRepository`。Provider只证明当前进程观察到完整播放，不能直接改钱/员工。业务奖励和费用减免必须走与R12同一事务和幂等系统。

会话状态：`IDLE → RESERVING → LOADING → READY → SHOWING → COMPLETED/CLOSED_EARLY/FAILED → GRANTING → GRANTED/RECOVERY_REQUIRED`。session在show之前持久化并绑定runId、dayKey、placement、rewardKind、policyVersion；一个时间只允许一个session，按钮防连点；日额度检查与预留也在锁内。加载取消/超时会话作废，迟到load不能自动show；同一close/error回调只处理一次。

完整观看后用确定commandId（例如`ad-grant:<sessionId>`）调用发券命令；命令重新校验run/session/额度/完成事实，不凭UI参数直接允许任意发券。`show`成功、页面onShow、播放器计时到了、callback缺参都不是完成凭据。正常路径完整观看必发券；写结果未知时进入R12恢复状态并只重试同一发券意图，不要求再看视频。

建议在GameState增加向后兼容的可选 `adRewards` 元数据（精简有界），包含版本、最近日期/当日提示与成功次数、会话摘要、券id/状态/有效期/绑定run、已确认grantId。新档初始化，旧档缺字段用明确默认；checksum验证必须在迁移/补默认前完成，不重封旧坏档。券上限1、最近交易/会话有界，500KB预算纳入测试。

**关闭公司例外**：保持广告日额度/当日提示元数据跨重开，当前公司券作废；否则玩家可以反复关闭公司刷每日奖励。该日额度是新增的本机商业化元数据，不是保留旧公司员工/现金；在新run构建时从**已恢复并验证的旧状态**复制必要小字段，并与新run同一替换事务提交，不并行写另一份钱包造成跨key原子性问题。不把旧run会话或未消费券转入新公司；关闭确认明确说明当前公司券作废。此规则为§18新增BASELINE，范围内不影响隐私同意或Tap账号。

招聘使用：先正常Offer预览，展示原招聘费/券抵扣额/实付招聘费0/每月工资/生效月/裁员仍有补偿；玩家确认后同一命令验证券有效、未使用、绑定run、候选未录用/未过期、部门存在、首聘已完成及其它原业务约束。**员工创建、券已使用标记、commandId、费用0及状态生效日一次提交**；失败不吞券，不允许先扣券后另一次事务加员工。原年度自动招聘限制不被券入口改变，券仅玩家主动使用；候选属性和月薪不因广告加强。

财务：没有发生的招聘费不记费用/现金流；保留名义招聘费、优惠来源及couponId作为非金额归因元数据，实付recruitmentCostYuan=0，现金不扣也不虚增广告收入；工资每月正常一次，次月生效及后续赔偿按原规则。不能先照常扣钱再用现金奖励冲回，以免年报/救助/投资口径混乱。取消确认、候选过期均保留券直到有效期/重开规则自然失效；确认过期要重预览。

边界：广告观看期间不允许新的收费/关司命令；旧run回调不得给新run发奖励。完成后崩溃但发券未持久化，且平台没有可验证的恢复凭据时，不能从“曾开始播放”推定看完；标uncertain与可反馈入口，不伪称一定能恢复。纯客户端无法保证任意强杀点“完成事实永不丢失”，这是需要真机/平台能力核验的限制；持久化已确认的券必须可恢复且只一次。

生命周期：广告是原生层，通常在Cocos层之上。通过临时pause reason暂停经营tick/音频，保留玩家原speed和音频偏好；关闭后原speed=0仍保持暂停，原关闭声音不自动开启。广告引发hide/show不得再当离线补算一遍；首版约定观看时长不推进经营、也不发离线收益，按R15消耗该时间区间一次。展示失败释放暂停；真正播放中的“超时”不能直接假设已关闭/销毁原生视频，需按close/回前台可观测状态收敛，不无限锁住经营或误发券。

### 18.8 隐私、广告审核、频控与验收矩阵

官方广告规范要求用户主动选择、事先明确奖励，首次启动60秒内/首关不展示广告；审核规范要求关闭激励视频后能正常返回界面。首版因此不实现强制每日观看/拒绝退出，不自动拉起视频。每日提醒和实际show是两件事，不能用“可以关闭游戏”冒充可拒绝。

当前隐私全文的“无广告SDK/无数据外发”等描述只适用于现有无广告版本。上线广告前须核实际SDK/联盟及数据处理、用途、第三方政策/权限/标识，更新源码全文、resources JSON、docs隐私正文和外部URL同源版本；必要时重新征求同意。不要凭想象列具体SDK采集字段，也不能保留已不真实的“绝无外发”。无后端广告不代表SDK没有网络请求。主体/结算资料由用户在可信后台填，不写银行卡/证件/Secret到任务证据。

| 类别 | 必测场景 | 核对结果 |
|---|---|---|
| 自愿与首启 | 首启0—60秒、首聘未完、提示拒绝/遮罩关闭、回前台多次、跨日 | 不自动show、不挡经营、一天提示一次、无强制退出 |
| SDK | 不支持、无ID、无填充1004、审核中/关闭/封禁、load/show失败与迟到/重复回调 | 不发奖励、不吞quota、不死锁；手动有界重试，错误脱敏 |
| 完成判断 | show resolve但没close、close false、undefined、true、重复true、error与close乱序 | 只true发1券；其他0券；同session最多1次 |
| 发券故障 | journal/槽/指针前后失败、写后回调失败、重复claim、重启 | R12恢复后券/日额度一致，无双发，无旧draft覆盖 |
| 免费招聘 | 首聘拒绝用券、正常候选、过期/重复候选、取消、券过期、run变更、连点/重载 | 现金不扣招聘费、工资照付一次、次月生效、失败不吞券 |
| 生命周期 | 0/1×/2×/5×、静音、广告hide/show、强杀、回滚时钟、跨午夜 | 正确恢复原偏好、无经营/离线重复、日键无重复领奖 |
| 重开与本机限制 | 先领券后关司、展示中关司、旧回调到达新run、反复重开 | 券不跨公司、日额度不重置、无广告刷员工 |
| 财务与包体 | 无广告模式原17黄金/900run；有券固定seed跨月年报；生产扫描 | 原基线不变；零招聘费用、真实工资；无Fake完成/造券hook/Secret |
| 真机广告 | 支持的Android/iOS、测试位/正式位、弱网、实际完整/中断、冷启动 | 记录SDK/OS/Tap版本、广告位状态、包hash，Mock不能关闭真实广告任务 |

不对广告填充率/收益做承诺。投放后台权限、SDK支持平台/版本、具体广告位审核状态和测试方式必须真实确认；假测试位成功不意味着正式位可投放。

### 18.9 统一实施任务、依赖与交付

新专项使用 `TASK-M3-10-01`—`12`，不冒充原48项全部完成；原发布整改继续按R编号补齐。两表进度分别统计。

| ID | 工作与责任文件 | 前置/实现验收 | 本轮状态 |
|---|---|---|---|
| M3-10-01 | 本轮独立验收，证据与§18.1 | 原缺陷复测、427测试、45/5/6浏览器、ZIP hash、新布局FAIL逐项记录 | DONE（验收工作完成，产品不通过） |
| M3-10-02 | 新49PNG/37SVG清点与source映射 | 解码、尺寸、CSV hash、用途分组与原目录保护 | DONE |
| M3-10-03 | 通用背景真实接入：resources/backgrounds、UiFactory、AppView | cover/fallback/四视口/resize/点击及不改revision；本地构建与截图 | DONE（Web）；真机归R41 |
| M3-10-04 | 干净启动稿与首屏链：tools/splash、统一补丁 | 取得无烘焙进度艺术层或验证裁切方案；不假78%；失败不阻塞引擎 | IN_PROGRESS（无字艺术层/独立进度及Web首屏已验；Tap包/设备首屏待验） |
| M3-10-05 | R30/R39新布局缺陷与素材适配回归 | 修首卡8单位重叠、间距与content；四尺寸和长文本矩阵 | IN_PROGRESS（R30新缺陷已修且回归通过；R39完整视觉矩阵未验） |
| M3-10-06 | 关闭原R12/R31—R40剩余本地缺口 | 以§15.11与§18.1为准；先存档闸门，再E2E与长跑；不依旧专项全绿跳过 | IN_PROGRESS；R12 A-01—10、R33/R39和R34完整验收仍缺；R40 120年边界已局部通过 |
| M3-10-07 | 广告Provider与公开配置、能力降级 | §18.6接口、只在同意后、单实例/互斥/解绑；Fake仅测试 | IN_PROGRESS（本地Provider/config/loader及Fail-closed测试）；U14真实位BLOCKED |
| M3-10-08 | AdRewardCoordinator/日额度/券/原子招聘 | R12完整恢复契约；optional state/schema/迁移/重开元数据；只true奖励 | IN_PROGRESS（同事务招聘及Fake完成/跳过测试）；完整恢复/迁移矩阵未完成 |
| M3-10-09 | 每日提示与普通招聘双入口 | 07/08；本机一天一次可跳过；共享奖励池；0费用/月薪/生效月明确 | IN_PROGRESS（UI与生命周期代码已接，未做设备/视觉验收） |
| M3-10-10 | 隐私与后台广告能力/主体资料核对 | 实际联盟SDK及政策；全文同源与重新同意；不代填敏感结算信息 | BLOCKED；U14—U16未核，privacyReviewed/deviceVerified保持false |
| M3-10-11 | 广告/财务/故障/UI/生命周期完整验收 | 07—10；§18.8矩阵，正常及故意失败，真实广告与Fake分层 | IN_PROGRESS（本地单测/集成与全量check通过；完整矩阵未跑） |
| M3-10-12 | 新版产品测试候选与同包设备/云测 | 04—11及原本地门禁；新releaseId包含换图/广告；R41/R43/R44闭环 | BLOCKED（r7 disabled诊断包静态PASS；本地视觉/故障总验、设备/云测及上传未做） |

顺序：先按验收修原本地缺口与R30新布局；并行仅指无共享写入的资料清点，不自动启用多Agent。广告Provider可在Fake条件下开发，但发券必须等R12契约稳定。先开发默认disabled，后台没开通可继续其它本地任务；广告版准备启用时必须更新隐私和真机验证。正式候选必须包含这次素材/配置/广告代码重新构建，不修改diag-f或复用它的旧hash。广告新增后，原设备/性能/隐私证据需要按影响范围重验。

新增资料编号：**U14** 普通Tap小游戏对应Dirichlet广告能力是否开通、所属游戏ID、支持Android/iOS、广告样式与测试/正式adUnitId及审核状态；**U15** 测试账号/设备与广告联调方式、结算主体是否已由用户在后台完善（只确认状态，不传银行卡等原件）；**U16** 实际广告SDK/联盟政策链接、当前隐私公开资料与用户是否同意广告版政策更新。缺U14不写假ID、不声称接通；不向聊天索取密码/Secret/token/财务证件。

### 18.10 可直接复制给执行Agent的统一提示词

```text
请进入 D:\Workspace\TapTap\我是CEO，执行本轮“整改补验＋9:20素材接入＋TapTap自愿激励广告”专项。

先读AGENT.md、README、唯一权威文档docs/我是CEO_项目总览.md的§1/§2/§11最新记录/§12/§15.2与15.11/§17/§18，重点§18.1验收、§18.9任务和§18.5—18.8广告契约。本次是本地实施请求，持续完成当前可执行项；不只给计划，不逐项问是否继续。不授权提交/推送、平台上传、工单/消息、提审/上线、生产数据删除或外部权限变更。

先核git status和最新源码，保护已有未提交修改，默认串行、不自行启动子Agent。原48项整改未全部完成：R12指定未知投资复现已修，R30原状态文字重叠已修；但本次真实UI发现首张108高员工卡与第二排筛选重叠8单位，证据evidence/acceptance-assets-ads-20261103/filter-layout-review.json与r30-filter-card-overlap.png。427测试与45/5/6专项浏览器通过不能覆盖这个FAIL或未做的完整故障/视觉/长期/设备验收。

原图在design/00_ALL_49_PNG_37_SVG：49PNG全1080×2400/37SVG；只把合适装饰层接入。通用无字背景已复制到assets/resources/backgrounds并接入UiFactory/AppView，四视口与resize已过，保留实现并按新改动回归，不重复重做。37整屏UI、10概念稿仅参考；不能贴整屏假按钮/数字，也不能为9:20强改全局逻辑高度。新启动插画含烘焙78%，需干净艺术层或经过验证的运行裁切，真实进度独立；暂缺该资源只阻塞M3-10-04，不阻塞其余工作。

先修R30/R39新的筛选-列表布局，统一筛选高度/listTop/cardHeight/content/pool公式，再补R12 N04—N10、R31—R40仍缺的验收，按§15.11执行。页面实际点击、状态/ledger/存档回读、截图必须打开检查，不能只看toast/标签存在。UI标签存在不代表Web首屏遮罩已消失，E2E应等真正可交互。失败命令必须非零，不弱化断言、不改黄金预期制造通过。

广告是用户明确新增范围：每日提示一次，可跳过继续经营；完整观看免一次性招聘费，月薪照付，次月生效，首聘两人不参与。不看不能强退，不自动show，不接Banner/插屏/内购。按§18.5首版A每日领券与B招聘入口共享一天1张券额度；其它频控/有效期按BASELINE配置。正常付费招聘保留，取消或候选过期不吞券。

普通Tap小游戏广告走真实对应联盟后台与tap.createRewardedVideoAd API，不能照抄仅适用星火/H5的快捷SDK。先复核当期官方来源与实际平台类型；用Provider隔离load/show/onLoad/onError/onClose/off*/destroy。默认单例、全局互斥、同session一次；show Promise成功不奖励，只有res.isEnded===true才可发券。无广告/无能力/断网/拒绝/提前关闭全部允许经营，禁止Fake完成进生产。

发券/日额度/免费招聘走Facade与GameStore事务：同session/commandId幂等，奖励写未知先恢复；领券、使用券与员工创建按§18.7原子处理，费用0而非先扣再退款；真实月薪不变，不给游戏公司记开发者广告收入。旧档optional字段兼容，日额度跨关闭公司保留、券绑定当前run，旧广告回调不得给新局奖励。广告引起hide/show不重复计算在线/离线，音频与玩家原speed按原偏好恢复。所有强杀点“看完事实”无法恢复时诚实列uncertain，不从show或计时推断完成。

新增广告会使当前“无广告SDK/无外发”的隐私文案失真，必须按实际SDK数据处理更新源码/JSON/docs/URL同源政策和同意版本，再启用enabled。广告位未开通/缺ID/审核未过时按U14—U16记录，不写假生产ID；可先完成Fake测试和disabled实现，继续无依赖工作。首次启动60秒/首聘流程不展示广告，预载也在隐私同意后。

按M3-10-01—12与原R任务分别回填，证据写新attempt，不覆盖历史。完成功能后跑§18.8的SDK完成/未完成/重复/迟到/故障/日期/重开/财务/生命周期矩阵与原完整门禁。最后用新releaseId真实构建和验证最终ZIP，输出dirty源码/配置/资源/工具版本/步骤退出码/hash/manifest，旧diag-f只保留诊断用途，不能当含新素材/广告的包。真机广告和同包云测缺权限就BLOCKED，不冒充通过；上传/提审/发布各需已有明确授权。

最终交付：原整改通过/未通过结论、图片已替换/未替换及原因、广告实现与真实接通状态、实际测试/失败/跳过/未测、U编号缺口、产品候选路径/版本/SHA256/manifest、Git及上传/审核/发布实际状态。先从§18.1新增布局失败和原任务剩余缺口开始。
```

### 18.11 官方依据、适用性与未核条件

查阅日期2026-11-03；本节只用官方技术/审核文档，不以搜索摘要或其它小游戏平台行为推断Tap接口。当前有些旧中文链接404，使用下列可访问新路径：

- [普通小游戏广告与联盟入口](https://developer.taptap.cn/minigameapidoc/dev/tutorial/open-capabilities/ad/ad/)：广告位、联盟及接入流程；[快捷接入适用范围](https://developer.taptap.cn/minigameapidoc/quick-start/mcp-guide/ad-integration-guide/)：普通Tap小游戏与星火/H5流程需区分。
- [激励视频教程](https://developer.taptap.cn/minigameapidoc/dev/tutorial/open-capabilities/ad/rewarded-video-ad/) 与 [创建API](https://developer.taptap.cn/minigameapidoc/dev/api/ad/tap.createRewardedVideoAd/)：默认单例、加载/展示、关闭与完整观看判断。
- [load](https://developer.taptap.cn/minigameapidoc/dev/api/ad/RewardedVideoAd.load/)、[show](https://developer.taptap.cn/minigameapidoc/dev/api/ad/RewardedVideoAd.show/)、[onClose](https://developer.taptap.cn/minigameapidoc/dev/api/ad/RewardedVideoAd.onClose/)、[onError](https://developer.taptap.cn/minigameapidoc/dev/api/ad/RewardedVideoAd.onError/)：事件/Promise区别与错误码。
- [广告审核规范](https://developer.taptap.cn/minigameapidoc/tap-operation/operation-standards/minigame-ad-policy/)：主动选择、明确奖励、首次启动体验；[小游戏审核规范](https://developer.taptap.cn/minigameapidoc/tap-operation/operation-standards/review-standards/)：广告关闭与返回、展示边界。

官方页面不证明本游戏后台已开广告、不证明所有目标OS可投放或任何收益/填充率，也不提供本项目已接入SSV的证据。真实平台身份、广告位、SDK数据处理和同包真机/审核仍需U14—U16。方案以小额本地游戏权益为范围，不替代后台财务或法律资质确认。

---

## 19. 剩余工作逐步执行手册（2026-11-03）

### 19.1 使用方法、当前事实与不能停下的条件

本节是§15.11/§18的操作级细化，用户要求“拿文档即可执行”。本轮只编写手册，不代表代码已经实现。执行者按下面顺序修改、验证、回填，沿用R任务和M3-10编号，不另建权威状态文档。接口名和新增文件在本节标“新增”即尚不存在，必须先实现再运行对应新命令；现有命令可直接执行。技术命名可做等价调整，但输入输出、事务、安全与验收条件不可省略。

当前可靠基线：R30指定首卡重叠已修，四尺寸间距8且详情可点，45项专项通过；全量427通过/1跳过。旧诊断ZIP为 `m3-20261103-r30fix-diag/01`，SHA256见§11.16；不得反复只修已验收的R30或只再生成一个诊断ZIP当作完成本轮任务。广告代码尚未实现；排行榜只读与经营年数的基本修复、年报cashBridge可选字段已存在，重点补缺口，不按早期计划再重复新增同名系统。

**本次执行顺序固定为**：A存档/时钟闸门 → B广告配置与Provider → C奖励状态/日额度/券 → D免招聘费事务 → E每日/招聘UI与生命周期 → F隐私同源与真实位准备 → G剩余原功能及完整验收 → H启动艺术层 → I全量门禁/产品候选 → J设备/云测/提审条件。G中无共享写入的只读资料可提前准备；不得为了字母顺序等待U14而停止本地B—F开发。

执行前操作：

1. 读取`AGENT.md`、README、§11.16、§12、§15.2/15.3、§18与本节；用`git status --short`登记已有修改，不reset/clean、不覆盖未跟踪文件。
2. 新建本次attempt证据目录；先记录Node/npm/Creator/插件版本、源码HEAD及dirty文件内容hash、原ZIPhash、当前配置hash。不得把私密配置值或用户存档正文放进报告。
3. 读取真实`package.json`和相应脚本参数；先运行一次`npm run check`建立自己的失败/跳过基线，不把测试数量当固定应达到427的目标。
4. 领取A，不先询问广告位；更新R46追踪索引使每个下方用例有任务/层级/输入/预期/证据位置。完成一块再做下一块，默认单Agent串行。
5. 外部资料缺失写具体U编号与影响阶段；广告代码保持disabled、Provider用测试后端完成本地验证。缺adUnitId只阻塞真实展示，不阻塞接口、状态机、UI、财务、故障测试和disabled包。

### 19.2 文件责任、需要新增的入口与最小提交单元

| 批次 | 现有主要文件 | 新增文件建议（执行者创建） | 完成后可评审内容 |
|---|---|---|---|
| A/R12/R15/R38 | GameStore、SaveRepository、SaveTypes、TapPlatform、AppView.clockTick、tests/helpers/faults | `tests/integration/transactionRecoveryMatrix.test.ts`、必要存储fence测试 | 恢复统一入口、未决写闸门、关闭公司恢复、逐故障结果 |
| B/M3-10-07 | runtimeConfig/loadRuntimeConfig、PlatformFactory/CocosPlatform/ITapPlatform | `core/platform/IRewardedAdProvider.ts`、`core/platform/TapRewardedAdProvider.ts`、`tests/helpers/FakeRewardedAdProvider.ts` | 真Provider可用性降级、Fake只在测试、配置默认关闭 |
| C/M3-10-08 | domain/types/errors、gameStateFactory、SaveMigration/stateIntegrity/SaveCodec | `core/application/AdRewardService.ts`、`scripts/ads/AdRewardCoordinator.ts`、`tests/unit/adRewardState.test.ts` | 有界奖励状态、日额度、完成发券、恢复和迁移 |
| D/M3-10-08 | RecruitmentService、GameFacade、相关类型 | `tests/integration/adRecruitment.test.ts` | 正常/券招聘共用校验、同事务消费、重试结果稳定 |
| E/M3-10-09 | AppView、foregroundClock、AudioManager、dialogs | `tests/unit/adLifecycle.test.ts`、`tests/integration/adCoordinator.test.ts` | 自愿双入口、提示状态、原生广告暂停/恢复 |
| F/M3-10-10 | privacyPolicyText、resources/config/privacy-policy.json、docs隐私正文、公开配置 | U14—U16的脱敏核对证据 | 已核政策与SDK一致，真实广告位状态明确 |
| G/R31—R40 | leaderboard、annual、simulate5year、tools/e2e、相关tests | `tests/unit/leaderboardBoundary.test.ts`、`tests/integration/annualReportBoundary.test.ts`、`tests/simulation/longRun120.test.ts`、`tools/e2e/run-suite.cjs`等 | 所有剩余边界与真实UI、长期/性能矩阵 |
| H/M3-10-04 | tools/splash、patch-release、实际Web首屏模板 | 干净艺术图或明确裁切配置/首屏验证用例 | 无假78%、按真实进度、多个尺寸可读 |
| I/J | build-tap-v2、verify-package、manifest、总览/README | 同包device/cloud/readiness证据 | 测试候选可追溯、外部门禁如实记录 |

路径表省略前缀时，`core`为`assets/core`、`scripts`为`assets/scripts`。不引入新Web框架、云存档、内购、广告SDK之外的统计服务或强制认证后端。小范围共享函数可以提取；不为本轮把整个AppView拆成另一套框架。

### 19.3 A：把R12补到所有写入口，先解决未决提交

**当前缺口**：`GameStore.mutate`在commit失败后设`commitOutcomeUnknown`，下次普通mutate前load；`replaceWithNewRun`独立执行，尚未统一该恢复过程。`SaveRepository.commit`内部可能reconcile journal，但业务draft已先生成，缺少显式基线约束。`clockTick`还在命令失败时推进时间水位并吞异常；不能让广告发券建立在这些未决语义之上。

**A1 实现统一恢复方法**：在GameStore锁内新增私有`recoverBeforeWrite(expectedRunId)`，给普通mutate和关闭公司共用。输入是调用者期望run，不是旧draft。流程如下，先落正式故障测试再改实现：

```text
acquire store mutation lock
  if native write fence unresolved -> SAVE_RECOVERY_REQUIRED (no new writes)
  if store marks unknown, repository has unresolved transaction,
     or initial load says reset-pending:
    load/reconcile -> verify envelope/checksum/integrity/tombstone
    if unavailable/undecidable -> keep recoveryRequired; no fn/draft/tombstone
    if confirmed -> atomically publish state + revision + generation
  validate expectedRunId against recovered state
  only now create draft or construct a replacement run
finally release short-lived mutex, keep recoveryRequired if unresolved
```

区分互斥`mutationInProgress`和跨调用恢复闸门；释放互斥不等于可以继续写。load返回null但曾有未知事务，仍须阻断，不能自动创建初始局。恢复成功后同步全部元组，不能只同步company字段。

**A2 关闭公司重构**：`GameFacade.confirmCloseCompany`当前先在旧current上构造newState，再调用Store替换；改为在Store已恢复、加锁的上下文中重新验证token/旧run/有效期，再构造新run。可给`replaceWithNewRun`传安全的factory回调而不是预构造旧快照，或新增专门Store命令；不在锁外从旧状态复制广告日额度。墓碑确认后失败属于reset-pending，所有普通经营写入继续阻断；恢复只能进入新代际，不能回到旧公司。关闭确认的经营年数复用当前`playerYears`口径，而非100份被裁剪年报数量。

**A3 仓库增加预期基线**：现有`commit(state,{revision,resetGeneration})`增加显式`expectedBase`（`null`表示已确认无活动档，否则至少含runId/revision/resetGeneration）。Store只传已验证的基线。Repository在可能恢复journal后发现基线变化时返回`REVISION_CONFLICT`并停止写新槽；不能在仓库悄悄恢复后继续提交先前旧draft。冲突交Store重新装载，涉及付费/破坏性确认要重预览，不能隐式重复执行已经运行过的fn。正常成功版本=base.revision+1；新run按重置协议另计。所有直接commit测试也显式声明基线，不保留生产绕过入口。

**A4 真正迟到物理写**：扩展tests/helpers/faults的受控后端，使“实际apply到Map的时刻”和“调用方Promise settle”可分别控制。TapPlatform在包装超时后保留native写请求的未结束fence；超时不能直接清fence。后续写/重开必须等native结束并reconcile，或继续显示恢复受限。不能只用attemptId忽略回调，却允许旧native操作晚些覆盖指针。底层永久不回调时给玩家可理解的恢复/重新进入提示，维持写闸门；不要用固定等待5秒推定写已取消。真实宿主在容器重启后的物理写取消/完成保证仍需R41核验，单实例软件测试不宣传为跨进程原子CAS。

**A5 时钟与UI**：Facade提供只读`getPersistenceStatus()`及显式`retryPersistenceRecovery()`（建议新接口）；pending或恢复失败时停新tick/收费/重开，保留只读页面和恢复入口。`clockTick`只在advanceRealTime确认成功后推进`noteOnlineProgress`；未知结果先恢复并检查已提交`lastWallClockMs/progressMsInMonth/月结key`，不能盲目重放原dt或立即丢弃整段时间。临时故障暂停区间如何补算沿R15离线/在线水位计算一次，恢复后以新的成功水位重设lastFrameMs。瞬时锁冲突不每秒toast；持续故障显示一次可恢复状态，并留有界脱敏日志，取消`.catch(()=>undefined)`的静默永久停钟行为。

**A6 必须按表逐条通过**：每例保存内存、两个slot信封、pointer/journal/tombstone、run/revision/generation、commandIds和钱/员工差异；测试后重启新Facade再发一个正常命令。

| 用例 | 操作顺序 | 预期 |
|---|---|---|
| A-01 | 正常投资10000；指针实际成功后报错；直接改方针 | 现金只-10000、资产只+10000；新方针保留；revision严格递增 |
| A-02 | 同上，同commandId重试，再不同命令 | 同意图只扣一次；不能因恢复而多一个员工/投资 |
| A-03 | journal写前/写后、slot写前/写后、pointer写前/写后分别失败 | 已确认base或target唯一；不可读时不猜；每种路径可重载 |
| A-04 | 目标槽get超时；下一次付费/关司；恢复get后重试 | 超时时业务fn未执行、无新墓碑；恢复后再校验 |
| A-05 | 清journal失败；反复加载/再命令 | 已提交事实不回滚、不重复费用，清理幂等 |
| A-06 | 挂起旧pointer实际写；调用方超时；发新命令；再释放旧写 | 新写在fence结束前被拒；最终pointer不能倒退 |
| A-07 | 未决投资时关司；墓碑确认后新slot失败；重启 | 不绕过恢复；新代际可恢复且旧run不复活 |
| A-08 | 写未知时tick、hide/show、恢复点击同时到达 | 串行一次；同月、离线、事件不重复；无额外收费 |
| A-09 | 恢复后原确认token已过期/费用变化 | 失败并要求新预览，券/现金/员工不半变更 |
| A-10 | 恢复后推进两个月、跨年、再招聘/重载 | 可克隆可保存，经营继续，无永久锁或NOT_READY循环 |

完成标准：A-01—10都有正式测试和实际结果；保留旧指定回归通过；R14重开回归与R15时间回归无退化；尚缺物理强杀/宿主保证单列R41，不把它当无需做本地A-06的理由。

### 19.4 B：广告接口与配置，先在没有真实广告位时做完

新增广告配置作为**独立可选资源** `assets/resources/config/ads.config.json`（新增），避免把广告字段混进现有私密runtime.config。类型与解析器可放`assets/scripts/ads/adConfig.ts`，通过R07相同guard加载；缺文件/非法值降级disabled，经营不受影响。建议内容：

```json
{
  "schemaVersion": 1,
  "enabled": false,
  "policyVersion": 1,
  "rewardedAdUnitId": "",
  "dailyGrantLimit": 1,
  "couponTtlDays": 7,
  "requestLimitPerDay": 3,
  "retryCooldownMs": 120000,
  "firstExperienceMs": 60000
}
```

`enabled`必须布尔；次数/时长为有限安全整数且符合首版上限；不得允许配成负数或Infinity。首版只1个激励视频位，daily/recruit是业务placement，不为它们各自创建互不知情的SDK单例。ID空/SDK无能力/配置未启用返回unavailable，不生成假ID；build生产永远不能选择Fake。公开adUnitId不是Secret，但所属游戏/样式/OS与审核状态要核实。

接口建议（新增；这是Provider应用抽象，不是SDK原始签名）：

```ts
type AdPlacement = 'DAILY_RECRUIT_SUPPORT' | 'HIRE_FEE_WAIVER';
type AdPlaybackResult =
  | { kind: 'completed'; attemptId: string }
  | { kind: 'skipped'; attemptId: string; reason: 'user_closed' | 'cancelled_before_show' }
  | { kind: 'unavailable'; attemptId: string; reason: string }
  | { kind: 'failed'; attemptId: string; reason: string }
  | { kind: 'uncertain'; attemptId: string; reason: string };
interface IRewardedAdProvider {
  isSupported(): boolean;
  play(input: { attemptId: string; placement: AdPlacement }): Promise<AdPlaybackResult>;
  dispose(): void;
}
```

先用单元测试Fake驱动接口，再实现TapProvider。Fake在`tests/helpers`，只提供预设complete/early-close/no-fill/error/hang/duplicate/late等事件脚本，禁止自动“每次完成”；生产PlatformFactory只构造真实Provider或UnavailableProvider。测试UI构建的Fake由编译profile剔除，不能由任意query参数在生产启用。

### 19.5 B：TapProvider的逐步实现与错误边界

1. 从CocosPlatform或现有Tap适配层注入受限SDK对象，只在Provider内部访问`tap.createRewardedVideoAd`，领域层不访问globalThis。先检查真实函数存在，再创建默认单例。
2. 用同一组具名函数注册onLoad/onError/onClose；保存实例和引用，dispose按相同引用off。切Tab不dispose正在播放的实例，也不重复注册监听。
3. `play`先检查全局activeAttempt，不允许两次同时show；设置attemptId并建立once结束函数。onLoad仅更新ready；onError分类；show的then只表示已显示，不发奖励。
4. 资源未ready时load等待成功，最多一次load后show；开发可用15秒load工程超时，不把该数字当平台标准。超时返回failed/取消本attempt，迟到load不得自动show。用户取消等待后也不能show。
5. 真正show后，只在对应activeAttempt的`onClose(res)`且`res?.isEnded === true`返回completed；false/undefined返回skipped。重复close、close后error、旧attempt迟到close不能给新attempt奖励。未确认旧播放器已结束前不开放下一次广告，避免全局onClose被归到新会话。
6. 原生SDK没有应用主动hide语义，不能在showing时用“超时销毁”假装用户关闭。应用回前台若广告状态仍不确定，给恢复提示、继续核对；不得用onShow当completed。超时后的正常经营恢复、是否允许下一次广告，依可观测原生close/宿主状态处理，写入测试与真机限制。
7. 1004为正常无填充；1001/1002视配置错误；审核中/被拒/禁用禁连环重试；网络失败提示稍后。SDK原始内容脱敏，只存errCode/阶段/attemptId/不含标识的摘要。
8. 返回结果后释放activeAttempt，但仅释放有已确认终态的原生播放；unknown保留单独fence。普通业务入口始终可用；可选广告操作不能把整个游戏永久锁住。

验证`tests/unit/rewardedAdProvider.test.ts`（新增）：complete、early close、undefined close、show resolve未close、load失败、show失败、无填充、重复close、close/error乱序、迟到load、dispose解绑、重入12类。特别断言show成功后奖励次数仍0，close true后变1。该接口语义依据已复核官方激励视频教程，具体SDK声明以项目插件d.ts与当期官方为准，不把微信示例当Tap保证。

注意SDK的onClose并不带本项目sessionId：attemptId只标识应用意图，不能被宣传为平台签名或事件唯一ID。测试应分别模拟“旧listener的迟到调用”和“全局SDK事件到达当前listener”；旧原生播放尚未确认结束时禁止新播放。若实测SDK会把旧播放终态送给新播放且无法辨认，保持可选广告受限并记录平台待核，不能靠给回调硬塞当前sessionId伪造关联。

### 19.6 C：奖励数据模型、日期与会话命令

在GameState增加可选`adRewards?: AdRewardState`，实体建议放`core/domain/adRewards.ts`（新增），由AdRewardService处理。**不要新增一份独立localStorage钱包**，否则券、员工、日额度会跨key半提交。以下是首版实现契约，字段可等价命名：

```ts
interface AdRewardState {
  version: 1;
  maxObservedDayIndex: number;
  lastObservedWallClockMs: number;
  days: Array<{
    dayIndex: number; prompted: boolean; grantCount: number;
    requestCount: number; lastRequestAtMs: number;
  }>;
  activeSession: null | {
    sessionId: string; runId: string; placement: AdPlacement;
    reservedDayIndex: number; createdAtMs: number;
    status: 'RESERVED' | 'SHOWING' | 'UNCERTAIN';
  };
  coupon: null | {
    couponId: string; issuedBySessionId: string; runId: string;
    grantedDayIndex: number; expiresBeforeDayIndex: number;
    status: 'AVAILABLE' | 'USED' | 'EXPIRED';
    usedByCommandId?: string;
  };
  recentFinalizations: Array<{
    sessionId: string; runId: string;
    result: 'GRANTED' | 'SKIPPED' | 'FAILED' | 'ABANDONED';
    couponId?: string;
  }>;
}
```

`days`保留最近8天（不得裁掉仍activeSession的reserved day）；recentFinalizations最多32条；券最多1条；可选字段用delete或省略，禁止赋undefined破坏clone。先verify旧信封checksum，再在兼容读取层提供缺字段默认；只读getRewardOverview不得写默认、改revision或顺便清过期券。真正归一化/清理只在已授权命令draft里发生。integrity/schema同步校验枚举、有限整数、合法run引用与上限，500000字节预算仍有效。

日期纯函数：`dayIndex = floor((wallClockMs + 8*3600000)/86400000)`；coupon在`currentDayIndex >= expiresBeforeDayIndex`时不可用，发券时expiresBeforeDayIndex=grantedDayIndex+7。例：11月3日发，11月10日00:00北京时间起失效。预约23:59观看、00:00关闭，计入**预约日**额度，不改归属到新一天；当日日期异常回拨不增加额度。设备时间前跳后回拨只暂禁可选奖励，不限制普通经营。纯本地不能防玩家改存档/清数据，不许宣称防刷绝对可靠。

新增Facade入口建议：

| 接口 | 事务/职责 |
|---|---|
| `getAdRewardOverview(nowMs)` | 只读，返回可提示/可看、原因、券状态、剩余额度，不初始化状态 |
| `markDailyAdPromptShown(nowMs,ctx)` | 当日prompted原子设true，显示前成功提交；写失败不弹反复催看 |
| `beginRewardedAdSession(placement,nowMs,ctx)` | 校验首聘完成/经营阶段/额度/冷却/钱包/无未决写；计requestCount、占activeSession，返回sessionId |
| `finalizeRewardedAdSession(evidence,nowMs,ctx)` | 仅Coordinator持有当前Provider完成证据；same session幂等，原子发券+grantCount+清activeSession+记录终态 |
| `cancelRewardedAdSession(sessionId,reason,nowMs,ctx)` | 加载失败/提前关闭等收敛，清预约，不增加grantCount；不能凭取消把confirmed completion撤销 |

Facade方法遵循现有CommandResult返回；补`AD_UNAVAILABLE/AD_BUSY/AD_LIMIT_REACHED/AD_SESSION_INVALID/AD_REWARD_UNCERTAIN/COUPON_INVALID`等必要稳定错误码与中文映射，不抛裸SDK对象。`SAVE_RECOVERY_REQUIRED`复用A的保存闸门，已有REVISION_CONFLICT勿另造同义码。

**发券实现顺序**：在锁内先判断该session已GRANTED，若是返回原couponId；再校验expectedRunId、activeSession匹配、预约日额度、完成证据与policyVersion。构造确定券ID如`coupon:<runId>:<sessionId>`；保存coupon、day.grantCount=1和终态记录，清activeSession；经一次mutate commit成功后UI显示到账。grant commandId固定`ad-grant:<sessionId>`，网络/存储重试复用，不每次nextCommandId。已USED的同一券重放发券也返回“该奖励已领取/使用”而不是再创建AVAILABLE券。

完成证据由Coordinator对自己本次Provider返回completed生成，UI不能传`isEnded:true`调用发奖。TypeScript品牌类型/私有引用只防误用，不是密码学防篡改；生产不得暴露window造券hook。记录session已开始不等于完成，进程强杀丢失onClose证据时不能自动补券；能恢复的必须是已确认持久化的结果，未确定显示uncertain/反馈，不谎称一定可找回。

**重开处理**：在A2已恢复并加锁的newState factory里复制有限`days/maxObservedDayIndex/lastObservedWallClockMs`，不复制当前公司coupon或旧activeSession；发券中或原生广告展示中禁止主动关司，恢复未决先完成A流程。确认页说明“本公司未使用的招聘券会失效”；新run不能重新领当天第2张。旧run callback返回RUN_CHANGED，不跨公司补发。days作为新增本机商业化限额元数据保留，不保留旧现金/员工/公司成绩。

### 19.7 D：优惠券招聘，不重写员工生成算法

当前`RecruitmentService.previewHire/hireEmployee`已有Offer/部门/候选/HR折扣/首聘/幂等/次月生效逻辑，必须沿用。不要做一个`addFreeEmployee`或UI直接push员工。

实施步骤：

1. 给`HireInput`新增`couponId?: string`；正常UI不传，与旧行为完全相同。给`HirePreview`新增可选或明确字段`nominalFeeYuan/discountYuan/paymentKind/couponId`；保留现有`feeYuan`表示**实付招聘费**，不要改变其含义让旧UI误扣。
2. 共用候选/部门/阶段校验与当前HR折扣费用计算；先算nominalFee，再验证券得到payableFee。只有RUNNING/DISTRESS且首聘两人完成才可用券；HIRING_INITIAL直接ONBOARDING_INCOMPLETE。券有效、AVAILABLE、绑定run且未过期，payableFee=0；没有券仍按原fee。
3. affordable按实付算，不能因为cash小于名义费就拒绝有效券，也不能跳过其它经营状态校验。UI明确“招聘费¥0（原¥X），月薪¥Y，下月生效，辞退仍按规则赔偿”，不是“永久免费员工”。
4. 同一mutate draft内：校验ctx/run、处理已成功commandId重放、重验候选与券、构造与原函数相同Employee、现金减payableFee、记录真实实付招聘费用、员工push、券标USED、recordCommand。不能调用一次已扣名义费的原函数后再返现金。
5. 0招聘费可不写无意义金额entry，但结果/收据必须可知实付为0。建议Employee增加可选`hireReceipt:{nominalFeeYuan,feePaidYuan,couponId?}`，用于月账裁剪后幂等重放仍返回真实费用；只存摘要，不存整Offer。原收费录用的新员工也记录实际收据，旧员工无字段按已有可核记录返回，不伪造历史。
6. 幂等检查先于“券已用/候选已被录用”拒绝：同commandId+同意图返回原员工/fee0；不同commandId复用同券必须拒绝。收费预览携带的revision发生变化时重新确认，未知保存恢复后的重放不能再扣券。
7. 候选过期/取消/部门删除/新run/写失败：员工数、钱与券不能半变更。广告完成只给券，不自动选人；回到普通招聘让玩家再次选候选确认。

数值验收夹具：锁定编制、防自动招聘/事件干扰；先创建正常公司并完成首聘，记录C现金/E人数/R版本；准备月薪6000、无HR折扣的有效日常候选、AVAILABLE券。预览应nominalFee6000/discount6000/fee0/cashAfter=C；确认后现金C、人数E+1、券USED；同月工资/产能不计新员工，下一月工资只多6000。相同commandId重放与重载均仍一人/0招聘费；另一个commandId或候选不能再用此券。再做HR折扣夹具，抵扣额应为折后真实招聘费，不叠加虚构补贴或广告收入。

新增测试`adRecruitment.test.ts`至少覆盖上述数值、首聘拒绝、余额低于名义费、有券/无券、过期、候选过期、取消零变更、不同命令复用、指针写后失败与重载、月账裁剪后重试11类。原黄金和招聘测试不改预期；新增广告功能enabled=false时原财务轨迹必须相同。

### 19.8 E：每日提示、招聘双入口与广告生命周期

新增Coordinator由AppView/Bootstrap在当前platform与Facade已就绪后创建一次；构造时不自动create广告实例，先等privacy/首体验条件。保留实例跨Tab，onDestroy解绑事件并dispose，旧run/session回调作废。

**每日提示**：等privacy当前版本同意、正式/开发能力判断、RUNNING/DISTRESS、首聘完成、首体验累计≥60000ms、没有其它modal/保存未决、当日未提示且没有效券。先提交`markDailyAdPromptShown`，成功后弹滚动奖励说明；按钮“观看广告领券”“暂不观看，继续经营”，均≥44，间距≥8；返回键/遮罩按取消。取消当天不再自动提示，但招聘入口可由玩家主动点。正常进入不默认高亮广告，也不把拒绝入口藏到滚动末尾。

**招聘入口**：正常招聘确认优先保留“支付¥X招聘”；有有效券时提供“使用招聘券（招聘费¥0）”；没券且广告当前可用时提供“观看广告领券”，没有能力/额度/无填充不出现空白广告槽，显示正常付费方案。观看成功回来只刷新券与预览，不直接提交hire；当前Offer过期则提示刷新，券仍可用于有效期内的其它候选。

**暂停与恢复**：新增应用级PauseReason集合（至少AD、PERSISTENCE_RECOVERY，按现有结构最小接入），不把临时暂停写成玩家speed=0。show之前停止tick和BGM，保存原speed/声音偏好；finish后删除AD reason，若还有保存恢复/其它阻塞仍不恢复tick。玩家原暂停继续暂停、静音继续静音；原2×恢复2×，不重建公司和不改变音调。

广告触发hide/show时，先由Coordinator/生命周期状态标识“广告区间”，不进入普通离线settle；close后将这段被排除的真实时间推进水位一次并重设lastFrameMs，不发经营/离线收益。真实系统切后台、广告前已存在的离线区间需按时间切段，不能把整段后台时间都当广告排除。测试：离线1小时后回前台先按原规则处理1小时，再自愿看30秒广告，30秒不追加离线。show失败恢复不丢失原先未处理的后台时间。

未领券但广告确认完成、发券写未知时先进入A恢复；不再show，不提示“再看一次领取”。SDK native状态不明与存储状态不明分开呈现；任何一种失败都不隐式发放。JS异常/断网/重载都要在R38与广告集成矩阵验证，不以Toast为状态真值。

### 19.9 F：隐私、后台资料和开关放行

此部分和B—E开发同步准备，不能等资料才开始写代码。执行顺序：

1. 用U14核普通Tap小游戏真实身份、Dirichlet开通状态、广告位样式/支持OS、测试/正式位、审核状态；用U15核可扫码测试的账号/设备及结算主体“已完善/待完善”状态；U16索引实际SDK/联盟隐私政策。报告仅公开游戏ID/adUnitId及脱敏状态，不保存证件、银行账号、Secret或token。
2. 广告adapter到位后列实际调用的SDK/接口、网络和可能数据处理，依据官方/后台资料更新政策，而不是填“本应用完全零外发”。源码`privacyPolicyText.ts`、resources JSON、`docs/隐私政策_我是CEO.md`及公开URL正文同版本；联系/主体沿用户已确认公开内容，不能猜新的名称/邮箱。
3. 从现有政策版本实际读取并+1；不要假设所有环境都是version1。广告版进入前显示新版告知，拒绝不创建SDK、不预载、不请求广告，仍按已确认产品的经营/隐私基本流程处理；没有当前必要政策同意不得初始化广告。公开URL暂不可达不把内置正文清空，列发行资料阻塞。
4. B—E开发期间生产ads.config.enabled=false。开发测试用显式development profile和Fake；生产选择器不接受URL/存档字符串切Fake。测试真正TapSDK时换真实测试位，不能拿Fake视频截图当真实广告。
5. 区分内部联调和对外放行：本地奖励/故障/财务通过、新版政策及U14真实测试位核实后，可制作非公开诊断/测试构建令enabled=true并实际播放；这仅允许在已授权测试范围操作，不是对外启用。对外放行还要同包真机完整观看和中断/无填充至少各一次，正式位后台可投放、目标OS支持明确。缺资料时正常交付disabled实现并写“真实联调BLOCKED”；不要因对外门禁未过而禁止准备内部可播放包。若从测试位换正式位导致配置/hash变化，必须新包并补实际正式位验证，不能转移旧hash证据。

首次体验≥60秒在Coordinator用前台活跃时长累计；为减少额外跨启动状态，首版可保守设为**每次冷启动都先体验60秒**，同进程hide/show不重置，每日提示已出现不重弹。不能把离线8小时算作已体验60秒。此限制比只限制首次启动更严格，不违反可跳过规则。配置解析不得将firstExperienceMs降到官方首启保护时间以下。共享`AdPlacement`类型放domain，Provider/coordinator仅import type，避免domain反向依赖Cocos或Provider实现。

### 19.10 G1：R31/R32/R33剩余功能逐项关闭

**R31，优先补真实边界而不是重写已修代码**：

1. 当前`playerYears=Math.max(0,gameYear-1)`与无副作用assemble已实现，先为它们补120年/旧档/空bot测试。`ResetService.closeCompanyPreview`仍用年报length，应改为同一playerYears查询，防关闭确认显示100年而榜上120年。
2. 新增测试`leaderboardBoundary.test.ts`：设置12机器人（符合当前cfg count），其中A资产100/年数3，B100/3，C200/1，其余9个0/0；玩家现金80+业务账面20，gameYear4。资产榜C在前，A/B/玩家资产相同；年限榜A/B/玩家在C前。同完全相同时保留原assemble顺序，不擅自改为dense排名/按名字排序。必要时显式用原index作最后tie-break，使跨宿主结果一致。
3. 全状态快照deep-freeze后调用两榜，比较调用前后state、rngCounter、Offer、pointer/revision均不变。无bot旧档返回确定性派生结果但不写回；年结初始化通过原命令，不在点排行时保存。
4. UI真实切两榜、我方不在首屏时定位/详情、完整长名/精确大金额；120年时只保留100报告仍显示120，重开后回0。保存截图和领域查询比对；不只数“年”字标签。

**R32，年报与现金桥**：

1. 当前AnnualReport已含可选cashBridge，GameState有cashFlowsByYear/cashFlowTrackingStartYear，不再另起重复字段。阅读annual.ts和现有集成回归，按现有字段补完整性/迁移测试。
2. 用实际Facade命令/时钟生成至少2份年报，包含招聘、投资、建部、裁员、救助、事件/折旧的可适用组合；每种组合单独固定seed/锁编制，不能用手填两份年报证明会计正确。UI手填夹具只证明导航/展示，报告明确区分。
3. 对每年检查带符号收入/费用合计=profit；12张月账合计=冻结年报相应项目；`cashOpen + monthlyLedgerNetCashDelta + investmentCashFlow + rescueCapital + unattributed = cashClose`；attributionComplete时unattributed必须0。期末资产与该报表**生成同一时刻**的现金/账面相加，不能拿之后`depreciateAfterAnnual`已改变的下一年state去比旧期末值。
4. 独立现金流数值夹具：cashOpen100000、月账净现金12000、投资现金流-10000、救助资本100000，则cashClose应202000，残差0。该纯现金桥算术用例只检查符号和显示，不替代上一步真实领域回归。
5. 老档无cashBridge/无追踪起始年，显示“历史明细未记录”，不得从差额反推投资。跨升级的混合年明细不完整时明确partial，不自动attributionComplete=true。只读查看/切年份不补写旧报告，不重封checksum。
6. 测100年份首/中/尾、无报告、亏损/零利润/大额、字段缺省、加载后重载；一次性已支付费用不再次扣现金；年结后重新进入首屏的报表显示不被当前员工工资污染。新增`annualReportBoundary.test.ts`和E2E真实年结用例。

**R33，离线/危机/教程/音频**：

| 用例 | 具体操作 | 核对 |
|---|---|---|
| G33-01 | 暂停后模拟离线8h，重载进入 | 不结算经营收益，不注资，不弹虚假收益 |
| G33-02 | 非暂停离线8h，再打开摘要两次 | 按现配置8h/年即12月；收益仅一次，弹窗只读 |
| G33-03 | 离线40h | 按既有上限最多3年/36月；超额按既有余量规则处理并显示实际月份，不能凭40h直接算5年 |
| G33-04 | 快速hide/show10次、系统时间回拨 | 同区间只结算一次；回拨无负elapsed/多收益 |
| G33-05 | 固定低现金进入危机，救助取消、再连点确认 | 取消0变更；仅+100000资本，rescueUsed=true，利润不增加；第二次拒绝 |
| G33-06 | 教程跳过/重播/中断恢复 | 不重新创建、首聘、注资或扣费；run与员工不变 |
| G33-07 | 三音频开关、后台/前台、原静音、倍速切换 | 开关持久化/失败回滚，后台停音，前台原偏好恢复，倍速不改音调 |
| G33-08 | 单个MP3加载/解码失败 | 只该资源失效，静音经营仍可操作；错误有界，不阻塞boot |

离线结果先从Facade实际状态与月账算，再比UI摘要；不能只查“离线”标签。救助真UI必须走确认，不能让测试直接调用injectRescueCapital而称UI通过。真实60秒token等待保留一次作为定时契约，其余使用受控时钟提高效率并标明模型测试。

### 19.11 G2：建立能发现错误的E2E，再跑R36—R39

**现有入口保留**：`tools/e2e/canvas-driver.cjs`、`r31-r32-ui.cjs`、`r33-settings.cjs`、`r34-browser-performance.cjs`、`tools/shot-r30.cjs`。当前统一runner尚不存在，先创建再加入package.json，禁止照本手册的建议命令名直接声称执行成功。

新增`tools/e2e/run-suite.cjs`契约：`node tools/e2e/run-suite.cjs --url <URL> --suite <negative|creation|management|recovery|visual|ads|all> --out <新目录>`；每suite独立context/seed，收集taskId/buildId/sourceHash/configHash、动作、前后状态、日志/资源错误、截图、PASS/FAIL/BLOCKED/NOT_RUN/TIMEOUT与退出码。必要用例缺失/跳过要使整体验收非PASS，不能把实际未跑计为0失败。R30旧脚本可被runner包装，但需读取其JSON判断，不只看process退出码。

驱动改造步骤：

1. 给开发观测接口提供page/actionId、employeeId/year等目标、active modal、boot/interactive、未决命令和只读快照；正常交互仍靠真实mouse/touch。生产编译去掉可控时钟/Fake/写状态hook，静态包反向验证。
2. `waitUntilInteractive`必须确认当前Web首屏覆盖层已移除/不可拦截，以及Cocos事件绑定已完成；只能找到标签不算可点。具体DOM遮罩ID从当前首屏模板读取，或新增自己维护的只读ready标记，不能猜一个不存在的ID。
3. 点目标前取当前节点矩形、safe area、canvas CSS scale/DPR与滚动位置，点后等可观察页面变化/命令结果。找不到目标、未切页、错误详情一律失败，不连续乱点附近5个坐标当作稳定测试。
4. 创建4个negative control（仅dev）：按钮disabled、上方BlockInputEvents遮罩、缺被请求资源、故意让card/status重叠。应分别产生action-disabled/action-blocked/resource-missing/layout-intersection，正常对照通过。修被测代码与修驱动原因分开记录。
5. 几何取各节点自身UITransform+worldScale/position，不用包含子节点的包围盒扩大卡片掩盖溢出；按同一裁切/可见规则计算。长名若允许截断，必须详情可查看；所有金额有精确值入口。

正式suite范围：

- `creation`（R36）：TRADE/SOFTWARE/SERVICE各全新上下文；创建公司/CEO/性格/实际首聘两人、1人时重载、教程、首年12月、年度报告、重载第二年。开局现金=300000-实际两人招聘费；不硬套每人5000。至少三档1×/2×/5×各保留一条真实在线耗时路径约300/150/60秒/年，记录机器调度误差；测试时钟路径另外标模型加速。
- `management`（R37）：招聘/建部/投资/裁员/救助取消0变更、单击/连点/令牌过期/不足额/写失败恢复；调岗/录用生效月、0人支持部门效果0、AUTO/LOCKED不擅自裁员/投资/救助；新广告券免费招聘纳入但不替代正常付费分支。
- `recovery`（R38）：A-01—10、missing/一槽坏/双槽坏/IO timeout、满空间、每个关键await后中断重载；隐私拒绝/同意写失败、登录失败/断网/过期；新旧run并发与onShow乱序；恢复后再做正常命令，证明不永久锁住。
- `visual`（R39）：375×812、360×640、390×844、375×834；创建3页/4Tab/设置/隐私/年报/详情/确认/离线/危机/错误态；普通/最大合法名、emoji、大额/负/0、0/2/30/100员工、6部门、100年报；热resize与键盘/安全区。软件可模拟安全区，真机键盘另列。截图必须打开检查，失败不能写“图片服务不可用所以PASS”。
- `ads`：B—F的SDK/奖励/招聘/跨日/重开/写故障/生命周期矩阵，Fake与真实广告两列。开发Fake场景通过不把真实广告列记PASS。

### 19.12 G3：30分钟性能与120年/整数边界

**R34性能脚本**：新增 `tools/e2e/soak-performance.cjs --url <URL> --minutes 30 --out <新目录>`。脚本创建固定seed/100员工/6部门测试夹具，先热身2分钟，随后记录完整30分钟；30分钟不可用“20秒×90外推”。每10秒采样节点/监听/Label数、heap（接口可用时）、保存键调用次数；每帧记录frameTime，汇总p50/p95、>50ms长帧。50ms是诊断线，不当官方阈值。

动作计划：0—5分钟静止公司页1×；5—10分钟2×与切4Tab；10—15分钟5×跨年/年报开关；15—20分钟100人滚动首尾与详情/返回；20—25分钟重复开关设置/确认但取消；25—30分钟前后台/音频切换与返回公司。记录每动作时间点，所有业务预期保持同seed对照，不能为FPS降低结算/漏存收费命令。

本地BASELINE预算：每批弹窗关闭后节点/监听回到基线且不按循环累计；热身后的后10分钟heap中位数相对前10分钟增量不超过max(5MiB,10%)，超过先定位保留引用/纹理/监听而不是改阈值。GC锯齿用窗口统计，不拿单一峰值判漏。没有heap接口则该项NOT_RUN并给可用Chrome诊断方案；Tap进程内存与浏览器heap不混称。当前180次存储key写/分钟先作基线，优化普通进度保存要保持月结/付费立即提交与重载水位，不能只优化统计数字。

**R40长跑**：新增 `tests/simulation/longRun120.test.ts`，用专用高现金/锁定编制、已首聘的合法测试夹具连续推进1440月，标明这是边界夹具而非自然开局盈利证明。生产economy与黄金不改；若自然种子提前危机应记录真实停止原因，不能把未跑完当120年。每年核已完年数、年报最多100、月账rolling上限、事件唯一、各年自动聘≤3/各月≤1（另开AUTO夹具），每月检查整数/NaN/Inf与现金/资产/工资守恒。

第120年年结后应gameYear121、经营年数120；年报若完整生成应保留21—120共100份。用Codec实际编码后量UTF-8字节≤500000，再通过SaveRepository保存/重新load/正常发命令，不能只JSON.stringify长度。旧档缺cashBridge/adRewards与新档都做；不对超过Number.MAX_SAFE_INTEGER的金额做不可靠舍入，输入校验拒绝且不写状态；接近边界的合法输入检查所有乘加中间结果安全，不能产生Infinity后再clamp成0。

**900-run导出修正**：现`tests/simulation/exportEvidence.test.mjs`输出硬编码attempt-01，会覆盖旧证据。先增加环境变量`CEO_EVIDENCE_OUT`并对已存在目标拒绝覆盖，再启用导出。该变化不改模拟预期，只使证据不可混淆。新导出用例传输出路径，JSON/CSV实际900行及60月/停止原因逐条校验，不删旧数据。

### 19.13 H：启动艺术层无需重做全部UI

按§18.4优先取得干净艺术层；若源分层暂时拿不到，可以先完成**运行时采样矩形方案**，避免无限等待一张图而停其它开发：

1. 原 `CEO_Splash_NewArtwork_9x20.png` 保持只读；建立独立首屏配置，sourceSize=1080×2400，试验艺术采样框`x=0,y=0,width=1080,height=1900`。这只是初始候选，须打开原图核对其完全位于烘焙“正在启动/78%/提示”上方；不能未经图片检查视为可靠最终值。
2. 将采样艺术区域按contain放在屏幕上方约78%区域，保持Logo/人物完整，余区用相容底色与真实进度；若某比例裁坏主体，改艺术区域/布局，不能拉伸图像。纹理UV必须按实际上传是否FLIP_Y换算；不直接照抄旧941×1672坐标。
3. 独立绘制真实track/fill，数值来自实际Cocos加载回调，不用setInterval假跑到78/99；setProgress Promise原兜底保留，但真实boot失败由错误阶段显示，不把超时当interactive。
4. 超过设备纹理上限时用Creator导入/构建导出降采样或干净艺术层尺寸方案，母版不改；最大2400高和约9.89MiB解码成本在报告中注明。背景失败保持主题色/Logo和可恢复流程，不阻塞引擎。
5. 修改唯一首屏源与统一补丁，使Web和Tap最终包都引用本轮资源；旧patch-splash入口若保留，要能从同配置读资源，不能两套图名/坐标各自硬编码。新增bad/missing image与双rAF/定时器回调测试，end后动画/GL对象释放。
6. 检查四尺寸进度0/50/100三阶段，均不见烘焙78%，无双进度条；正常可点击进入游戏、图片/WebGL失败仍可继续、真实模块失败可恢复。将通过方案截图交付，不把概念稿作实机宣传图。

该裁切方案会牺牲原稿底部示意面板，但能保留主体且不伪造进度；如果必须完整显示全部原稿，唯一正确方向是拿到/导出无可变控件版本，不能完整贴假百分比。任务只在这一视觉目标确实未满足时BLOCKED，广告/存档/本地测试照常推进。

### 19.14 I/J：可复制的命令顺序、产物与外部门禁

以下路径为已知仓库根目录，PowerShell执行。**第1组现有命令可以立即用；第2组新文件/参数必须按本手册先创建并通过帮助/负例后才能用。**任一步失败先定位，不能用后面的成功覆盖前面的FAIL。PowerShell的ErrorActionPreference并不保证原生命令非0自动停止；每条native命令后立即检查`$LASTEXITCODE`，例如`if ($LASTEXITCODE -ne 0) { throw '本步骤失败，停止后续流程' }`。下面是逐步操作清单，不是忽略中间失败的一键成功脚本。

第1组，建立/回归原基线：

```powershell
Set-Location -LiteralPath 'D:\Workspace\TapTap\我是CEO'
git status --short
npm run check
npx vitest run tests/integration/transactionRecovery.test.ts tests/unit/transactionCommit.test.ts tests/integration/resetRecovery.test.ts tests/unit/foregroundClock.test.ts
npx vitest run tests/tools/canvasDriver.test.mjs tests/tools/releasePipeline.test.mjs tests/unit/packageHygiene.test.ts
```

第2组，先创建上述新测试/runner并实现参数，随后运行：

```powershell
npx vitest run tests/integration/transactionRecoveryMatrix.test.ts tests/unit/rewardedAdProvider.test.ts tests/unit/adRewardState.test.ts tests/integration/adRecruitment.test.ts tests/integration/adCoordinator.test.ts tests/unit/adLifecycle.test.ts
npx vitest run tests/unit/leaderboardBoundary.test.ts tests/integration/annualReportBoundary.test.ts tests/simulation/longRun120.test.ts
# 仅在exportEvidence支持新输出路径后启用；使用不存在的新attempt
$env:CEO_EXPORT_SIMULATION_EVIDENCE = '1'
$env:CEO_EVIDENCE_OUT = 'evidence/m3/TASK-M3-09-R40/attempt-next'
npx vitest run tests/simulation/exportEvidence.test.mjs
Remove-Item Env:CEO_EXPORT_SIMULATION_EVIDENCE
Remove-Item Env:CEO_EVIDENCE_OUT
```

Web构建优先核当前`npm run web-build`的真实输出/日志和mtime，不能凭旧index存在判成功；原脚本有固定日志目录，需先参数化本次输出避免覆盖历史。有用户编辑器实例时不要擅杀进程，确认单实例构建条件并继续可做测试。新Web构建只作为Web证据，单独启动静态server，端口占用时换空闲端口并记录：

```powershell
npm run web-build
node tools/static-server.cjs build/web-mobile 8150
# 另一终端；以下runner/soak先按G2/G3实现
node tools/e2e/run-suite.cjs --url http://127.0.0.1:8150/ --suite negative --out evidence/m3/TASK-M3-09-R35/attempt-next
node tools/e2e/run-suite.cjs --url http://127.0.0.1:8150/ --suite all --out evidence/m3/e2e-complete/attempt-next
node tools/e2e/soak-performance.cjs --url http://127.0.0.1:8150/ --minutes 30 --out evidence/m3/TASK-M3-09-R34/attempt-next
npm run check
```

`attempt-next`是示例名称：先核不存在，已存在就改成新的唯一attempt；不要原样反复覆盖。正式runner须按`--help`展示创建后实际参数。端口8150是示例，不能停掉不属于自己的server。只有自己启动的进程在测试完成后关闭。

**本地候选放行清单**（逐项填PASS/FAIL/NOT_RUN/BLOCKED并链接真实结果）：A矩阵完成且收费/重开无数据丢失；B—F默认disabled/Fake与安全奖励事务全部通过；G原功能/全流程/负例/视觉/长期/30分钟本地门禁通过；H无假78%新首屏可验；所有生产资源/代码可追溯。当前427只是历史数量，新增测试后自然变化；不能要求“还是427”而不加回归。

真实ID/版本已核且本地门禁满足后，用新releaseId构建测试候选：

```powershell
# 必须先把游戏版本和全新releaseId替换为已核值；示例不代表用户批准某版本上线
npm run release-build -- -ReleaseId <全新ID> -GameVersion <已核版本> -Attempt 01 -Purpose product-test-candidate
```

不得使用-SkipBuild。产物预期 `build/release/<ID>/01/game.zip` 与 `evidence/m3/build/<ID>/01/manifest.json`，按真实输出为准。核Creator完成语义、每步骤退出码、最终ZIP入口/profile/资源/无Mock/无写hook/hash，证明新券/广告配置与新首屏确实进入最终包。任何后续改代码/资源/配置用新releaseId重建并声明需重验范围，不手改已冻结ZIP。

若真实广告资料缺，允许交付**ads.enabled=false的联调构建**及本地广告实现/测试报告，但广告真实接入状态BLOCKED，不能把“广告版全完成”或“广告收益可用”写进交付。最终广告启用候选要走真实位与新版政策验收；需要为临时disabled联调构建保持diagnostic purpose，而非用purpose字段绕过功能门禁。

**J外部步骤**：U01/02核游戏ID/版本，U14—16核联盟广告开通/真实位/SDK资料，U05/06/10核设备/账号权限，U03/04核原失败日志/性能，U07—11核隐私/资质/素材。取得明确测试上传授权后才R43上传；用户自行传包时提供hash核对步骤并收回包ID/报告即可，不索密码。真机使用同一hash，原失败OPPO/Redmi/vivo、华为系统形态、项目目标iOS以及对照机；冷启/恢复各10次、真实广告完整/提前关/无填充、30分钟性能音频与强杀。云测未抽中原失败机型不能算关闭，另补实机。

R08/R09启动对照按下列小步骤准备，不需要等用户补齐所有材料才做本地部分：在独立临时Creator工程或隔离源码快照制作A=官方最小可点击场景（无经营逻辑/存档）、B=A+本项目Adapter/诊断/必要配置、C=完整游戏；三者Creator/插件/打包选项相同，分配不同purpose/releaseId/hash，不能改主工程启动场景再遗忘恢复，也不清理当前dirty工作区。分别验证最早entry、adapter、module、engine、scene、config、save、interactive阶段。拿到设备后同机测试A/B/C：A失败优先平台/引擎；A过B失败查接入/配置；B过C失败查save/业务/UI首错。每项保存首错与真实可点击结果，不拿黑屏截图猜根因。任意本地缺工具步骤明确报告具体错误，已有官方最小包不是凭空构造的PASS。

R44收口要求每个P0/P1与必要设备/政策/资质有证据，物理强杀与模型测试分栏。R45提审/上线需分别核用户授权及审核通过后计划上线时间；本手册不授权任何上传、工单、提审、发布或生产操作。缺外部项精确列BLOCKED，但已能完成的本地代码/测试/disabled构建先交付。

### 19.15 执行停点、交付格式与直接启动提示词

每批次必须交付：任务ID/改动文件与原因、测试入口/退出码、用例逐项结果、源码/配置/seed/包hash、实际截图/状态/ledger、失败与未测、下一可执行项。正式证据进对应R/M3-10的新attempt。不要只改总览的DONE，没有可点击证据；不要把一份截图当所有尺寸都通过。

可以停止等待用户的情形仅限：所有当前可执行本地工作已完成，或特定步骤确实缺外部资料/设备/明确授权；同时继续其它不依赖它的步骤。不能以“没有adUnitId”为理由不做B—E，不能只做小布局再打诊断包就结束。安全语义冲突或不可确定的原生写结果要列具体边界，不通过清档/放宽断言制造完成。

最终交接按四层给结论：①本地功能/数据/视觉/故障通过否；②测试候选ZIP生成及静态校验通过否；③同包真实广告/设备/云测通过否；④是否可提审及实际上传/审核/发布状态。每层分别PASS/FAIL/BLOCKED/NOT_RUN，不能一个ok=true覆盖全部。

可直接复制：

```text
进入 D:\Workspace\TapTap\我是CEO，按 docs/我是CEO_项目总览.md §19 逐步执行剩余整改和广告实现。先读AGENT/README、§11.16最新验收、§12、§15.2、§18及§19；§19是本次操作级手册，新接口/文件先实现再执行命令。

本次授权本地代码/资源/测试/文档修改、必要本地构建，持续推进A→J；不授权Git提交推送、外部上传/工单/提审/发布、生产数据删除或权限变更。保护已有未提交修改，默认串行，不自行启动子Agent。

R30当前指定布局已通过，不重复只修它。先做A的恢复统一入口、关闭公司闸门、预期基线、迟到物理写fence及A-01—10；再按B—F创建真实广告Provider和默认disabled配置、会话/额度/券、免招聘费同事务、每日/招聘UI、生命周期及隐私。没有真实广告位照常做本地实现和Fake测试，缺口只阻塞真实联调，不阻塞开发。

用户广告规则不可改：每日提示一次可跳过继续经营；只有完整观看可发券；免一次性招聘费、照付月薪、次月生效，首聘两人不参与；不做强制退出/Banner/插屏/内购。show成功不等于看完，只有isEnded===true可形成当前session完成证据。发券/用券/员工创建走Facade与同一GameStore事务及幂等恢复，重开不刷新日额度，旧run回调不发新局奖励。

按G补R31—R40真实边界、E2E故意失败、四尺寸视觉、120年和完整30分钟性能；H处理无假78%的首屏；所有新脚本先创建/help/负例验证，不能声称不存在的命令已执行。真实UI和直接领域推进、Fake与真实SDK、模型与物理强杀分栏；不能改黄金/删除断言/清档骗通过。

满足I清单后全新releaseId真实构建，核最终ZIP与manifest；缺真实ID/广告资料时交disabled诊断联调包并列BLOCKED，不伪称广告产品候选。J缺设备/后台授权继续其它工作，明确列U编号，外部动作有明确授权才执行。

按R与M3-10任务回填唯一权威文档，证据写新attempt不覆盖历史。最终给已实现文件、逐用例结果/截图/财务与存档读回、剩余失败/未测/外部缺口，以及候选路径/版本/SHA256/manifest/构建日志和四层真实验收结论。先开始A的正式故障回归，不要只回复计划或再次询问是否继续。
```

本手册已核现有源码与命令，接口/测试/参数的新增建议明确标识；广告关键语义与首次体验规则再次查阅官方§18.11来源（2026-11-03）。编写本手册没有执行上述开发/测试/构建，不改变当前任务状态或宣称剩余工作已完成。

### 19.16 本轮执行记录（2026-11-03，早期快照；当前状态见§19.17）

**A/R12（部分完成，A-01—10未全部验收）**：新增正式回归`tests/integration/transactionRecoveryMatrix.test.ts`。实现前失败记录在`evidence/m3/TASK-M3-09-R12/attempt-03/a-red-before-fix.json`；当前恢复相关4文件56项通过，日志`evidence/m3/TASK-M3-09-R12/attempt-03/a-green-final.log`。覆盖journal读取失败禁止墓碑、恢复指针后关司、预期基线冲突不重放、迟到原生pointer写fence、恢复后关司工厂基于已提交状态，以及Store持久化状态/显式重试入口。A-01—10完整财务/逐await故障矩阵、A-07墓碑后新槽失败重启、R14/R15综合时钟区间验收未完成；AppView已有单次持续故障恢复重试入口并停掉新tick；未知区间精确补算与A-08并发矩阵仍缺，不标R12 DONE。

**B—E/M3-10-07—09（本地实现部分完成）**：新增独立默认关闭的`ads.config.json`及loader；TapTap Provider懒初始化且单实例，只有`onClose.isEnded===true`为completed，有超时/错误/隐藏取消降级。`GameState.adRewards` optional兼容旧档；Facade/GameStore事务保存每日提示、共享日领取额度、持久化活动session、完成session幂等、发券/取消。招聘预览/招聘在同一draft事务中消费券并建员工，券免一次招聘费、月薪不变、次月生效，初始两聘不使用。AppView仅在隐私同意且公开配置三项门控（非空ID、privacyReviewed、deviceVerified）皆满足后加载Provider，接有可跳过每日提示、招聘入口和onHide取消。Fake/状态/招聘测试14项通过，日志`evidence/m3/TASK-M3-10-08/attempt-01/ads-focused-final.log`。这些UI代码本轮未通过真实浏览器/设备操作验收，真实广告从未启用。

**全量本地门禁**：最新`npm run check`通过：55个文件通过、1个既有skip，442 passed / 1 skipped；日志`evidence/m3/TASK-M3-10-08/attempt-01/check-final-after-lifecycle.log`。恢复相关聚焦测试56项通过。未运行R30复测（按要求保留既有PASS），R31—R40完整E2E/视觉/30分钟性能/120年长期验收未完成；含78%的启动稿未处理。

**新诊断包（不作候选）**：releaseId`m3-20261103-adlocal-final-r3`，version`1.0.0`，Creator`3.8.8`、插件`1.2.2`。Cocos构建退出码36且有完成标志；转换、补丁、打包、最终校验、manifest步骤均退出0。ZIP`build/release/m3-20261103-adlocal-final-r3/01/game.zip`，5,160,461 bytes，458条目，SHA256`5b535767431ebd1772ae0716883f03264d214a06196fa9111ecb4a801f2eae55`；`VERIFY_OK`。manifest及逐步日志在`evidence/m3/build/m3-20261103-adlocal-final-r3/01/`。按UUID读回无字背景及ads.config均入包；配置仍disabled，三项启用条件未满足。

**外部门禁**：真实广告U14（联盟能力/广告位）、U15（后台联调/主体状态）、U16（SDK政策/隐私资料）未核，广告版隐私正文未更新以免虚构SDK处理。设备U05/U06/U10、云测与真实广告测试未执行；因此广告真实接通、同包设备/云测及可提审状态均非PASS。未上传、未提审、未发布。

**M3-10状态**：06 IN_PROGRESS；07—09 IN_PROGRESS（本地实现及局部测试完成、完整验收未完成）；10 BLOCKED（U14—U16）；11 IN_PROGRESS（局部测试通过、§18.8全矩阵未跑）；12 BLOCKED（仅diagnostic包，非产品候选）。R12保持IN_PROGRESS。细项及可点击证据分别见上方M3-10任务表、R12任务台账及各attempt目录。

### 19.17 §19续行记录（2026-11-03）

**A/R12**：保留指定未知投资覆盖修复；恢复闸门、关闭公司统一入口、expected-base冲突、原生迟到写fence、Store持久化状态/显式重试以及前后台结算只在成功保存后消费水位已实现。恢复专项56项通过，含实现前FAIL证据的目录为`evidence/m3/TASK-M3-09-R12/attempt-03/`。A-01—10逐await故障/财务全矩阵、A-07墓碑后新槽失败重启、A-08并发与完整R14/R15综合生命周期验收仍未完成，R12继续IN_PROGRESS。

**B—F/M3-10广告**：默认disabled、adUnitId空、未设置privacyReviewed/deviceVerified；仅完整`isEnded===true`回调可完成。迟到回调有session fence。提示、共享日额度、session、幂等发券和免一次招聘费与员工创建同Store draft事务；薪资照付、次月生效、首聘不参与。Fake/广告状态/招聘测试14项和时钟/恢复/provider聚焦20项通过；AppView实际交互、恢复/迁移全矩阵和设备生命周期仍未验收。广告从未接通或启用。

**H/R35**：启动层已使用独立无字背景`tools/splash/splash-art.png`，真实进度单独绘制；带烘焙78%的旧图只保留原处、不进入新启动层。Web首屏5个采样截图脚本报告0浏览器错误且已目视检查。证据`evidence/m3/TASK-M3-09-R35/attempt-04/splash/`。Tap首屏仍需最终包/设备检查。

**最新本地门禁**：`npm run check` PASS，56个测试文件、456 passed/1 skipped，日志`evidence/m3/TASK-M3-10-12/attempt-03/npm-check.log`；首次重定向未启动的路径错误保留`npm-check-start-error.log`。R40 120年/1440月和100年报保留/存档读回测试通过，`evidence/m3/TASK-M3-09-R40/attempt-05/longrun120.log`。R31/R32 Web流程5/5通过，当前证据`evidence/m3/TASK-M3-09-R35/attempt-04/r31-r32-run.log`；R33当前版本设置E2E、R39四尺寸全页长文本视觉和R12全故障矩阵未完成。R30指定8单位修复保留既有PASS，不重复回归。R34固定100员工/6部门30分钟浏览器性能采样尚在运行，`evidence/m3/TASK-M3-09-R34/attempt-04/soak-output/`仅能在最终完成读回后判断；浏览器样本不代表Tap进程内存或设备生命周期。

**包体与外部条件**：r4早于最新`splash.jpg`剔除脚本，禁止当本轮包。全量本地门禁及文档更新后，须以新releaseId重新构建、核ZIP/版本/SHA256/manifest并回填。真实广告U14广告位/联盟权限、U15后台联调/主体状态、U16真实SDK政策与隐私资料未提供；U05/U06/U10真机及云测未执行。无上传/工单/提审/发布/Git提交推送。分层：本地功能PARTIAL；全新disabled诊断包待构建/校验；真实广告、设备、云测BLOCKED或NOT_RUN；可提审BLOCKED。

**M3-10状态更新**：04 IN_PROGRESS（干净艺术层/Web首屏完成，Tap验收待定）；06 IN_PROGRESS；07—09 IN_PROGRESS（本地实现/聚焦回归有证据，完整矩阵未完）；10 BLOCKED（U14—U16）；11 IN_PROGRESS（全量代码门禁过，R34及其它QA未全）；12 BLOCKED（新包待构建，且当前只能诊断用途）。R12仍IN_PROGRESS。

### 19.18 R33/R34及最终包收口（2026-11-03）

R33本地Web当前版本6/6 PASS，错误0；六项含设置实际点击、声音偏好写入、业务revision不变、故意写入失败后状态回滚、教程重播不重置公司。截图`evidence/m3/TASK-M3-09-R33/attempt-02/`已打开检查，报告`evidence/m3/TASK-M3-09-R33/attempt-02/e2e-report.json`、命令日志`evidence/m3/TASK-M3-09-R33/attempt-02-run.log`。

R34 30分钟浏览器长跑PASS：测量1802690ms/180 samples，固定100员工、6部门；首尾存档可读，末revision 161、员工100、部门6；页面动作14次；浏览器错误0；每10秒节点63—71，listener为0；帧时间样本p95最大约16.85ms，6帧超过50ms；Chrome堆约26.3—60.1MB、末55.1MB。详见`evidence/m3/TASK-M3-09-R34/attempt-04/soak-output/soak-performance-report.json`、`actions.json`。此结果不证明Tap设备性能，无内存优化前基准/对象分配测量；native onHide/onShow和冷启动仍NOT_RUN，R34不整体DONE。

r5包体读回确认含旧烘焙素材且负例退出码1；保留r5和证据`evidence/m3/build/m3-20261103-adlocal-final-r5/01/postbuild-legacy-splash-negative.log`，不交付。哈希名识别/剔除及最终ZIP扫描已实现并以10项发布流水线测试验证；全量门禁56 files、457 passed/1 skipped，日志`evidence/m3/TASK-M3-10-12/attempt-04/npm-check.log`。新r6已执行真实Cocos Creator→Tap转换→统一补丁→ZIP→verify→manifest完整流水线。

| 最终本地诊断包 | 结果 |
|---|---|
| releaseId / version / purpose | `m3-20261103-adlocal-final-r6` / `1.0.0` / `diagnostic` |
| ZIP / size / SHA256 | `build/release/m3-20261103-adlocal-final-r6/01/game.zip` / 4,603,533 bytes / `94cacb9c4b942c96907d24f4578307eb19800fca2397f76b62f1d5cdd2f541a5` |
| manifest / verifier | `evidence/m3/build/m3-20261103-adlocal-final-r6/01/manifest.json` / `VERIFY_OK`, 458 entries, missing/forbidden/resource refs均为空 |
| 构建步骤 | Creator 3.8.8 exitCode36+doneMarker；转换/补丁/重打包/校验/manifest均0；Tap插件1.2.2 |
| 包内回读 | `splash-art.png`无字艺术层及真实进度代码存在；旧烘焙图按字节SHA清除；广告enabled=false、adUnitId空、privacyReviewed/deviceVerified=false |

**分层与任务状态**：本地代码门禁PASS；R31/R32 Web 5/5、R33 Web 6/6、R34单次30分钟Web固定夹具、R40 120年边界PASS；R12完整故障矩阵和R39四视口全页/长文视觉仍未关闭，综合本地验收PARTIAL。包体静态校验PASS但purpose仅诊断，不是产品候选。M3-10-12维持BLOCKED；U14—U16真实广告位/后台/政策资料和U05/U06/U10真机/云测均未完成，广告未启用、隐私广告政策未按实际SDK更新；可提审BLOCKED。未上传、未提审/上线、未提交/推送。

### 19.19 最终manifest与交付分层（2026-11-03）

修复Git Unicode路径后，用新releaseId重新构建的r7替代r6。全量门禁为56 files、458 passed、1 skipped；证据`evidence/m3/TASK-M3-10-12/attempt-05/npm-check.log`。发布流水线UTF-8路径回归11/11通过；r5旧图哈希负例与r6 manifest遗漏证据均保留。

| 最终包字段 | 值 |
|---|---|
| releaseId / 游戏版本 / 用途 | `m3-20261103-adlocal-final-r7` / `1.0.0` / `diagnostic` |
| ZIP | `build/release/m3-20261103-adlocal-final-r7/01/game.zip`，4,603,532 bytes，458 entries |
| SHA256 | `f577f15ac362b2b6daffea8a99729421797f1b7b8a5e9da31468be7789798428` |
| manifest | `evidence/m3/build/m3-20261103-adlocal-final-r7/01/manifest.json`；dirty source表含Unicode权威文档路径且哈希回读匹配 |
| 包校验 | `VERIFY_OK`；缺失/禁用/资源引用问题为0；旧`splash.jpg`内容哈希在包内命中0 |
| 构建链 | Creator 3.8.8 exitCode36 + doneMarker；转换、补丁、重打包、校验、manifest均退出0；Tap插件1.2.2 |

广告配置包内为enabled=false、adUnitId空、dailyGrantLimit=1、privacyReviewed/deviceVerified=false；新无字艺术层及分离后的真实进度脚本在包。此为禁用广告诊断包，不作产品测试候选。

**最终分层**：①本地门禁PASS、综合故障/视觉验收PARTIAL（R12 A-01—10与R39全矩阵仍缺）；②r7 ZIP静态验证PASS、purpose=diagnostic；③真实广告U14—U16和U05/U06/U10真机/云测BLOCKED或NOT_RUN；④可提审BLOCKED。没有上传、工单、提审、发布、Git提交或推送。

## 20. 广告与上传包收口设计及执行契约（2026-11-04）

本节对应用户“结合项目skills检查广告、打包、剩余工作，提供给其他agent执行”的请求。**本轮是独立检查与设计交接，不实施下面的生产整改、不重新构建、不上传或提审。** 本节以实际读取的源码、复跑结果和当日官方资料为基础，作为§19的续行收口契约；§19仍保留架构背景，出现实现步骤差异时按本节执行，不改变§12 LOCKED经营规则。唯一权威设计和状态仍在本总览，不另建平行PRD。

### 20.1 本次独立复核、当前事实与交付定义

采用的本地skill：`skills/taptap-mini-game-publisher/SKILL.md`及其references/03、04、05、06、09；skill是二次整理，不是平台授予的资格。已重新访问官方广告、API、创建小游戏、审核、物料、版本提审和Dirichlet小游戏指南，链接见§20.14。

| 核查项 | 本轮实际结果 | 证据或界限 |
|---|---|---|
| 当前源码全量门禁 | PASS：56 files passed / 1 skipped；459 tests passed / 1 skipped | `evidence/planning-release-20261104/npm-check.log`；不沿用用户摘要458，也不把新增1项归因为本轮修改 |
| r7独立ZIP校验 | PASS：4,603,532 bytes、458 entries、SHA256与交接一致 | `evidence/planning-release-20261104/r7-verify/package-check.json`；只验现有包，没有重新构建 |
| skill预检 | PASS=3、FAIL=0、WARN=1 | `evidence/planning-release-20261104/skill-preflight.json`；WARN是未提供宣传物料manifest，非广告或真机PASS |
| R39最近一次四视口结果 | **FAIL，已经结束，不再是“运行中待读取”** | `evidence/m3/TASK-M3-09-R39/attempt-04/matrix/visual-matrix-report.json`：4视口均`control-not-found:设置`，每视口只有4个主Tab断言通过 |
| R39截图实际检查 | 360×640排行金额右侧被详情按钮遮挡；不是只有脚本定位问题 | 已打开该attempt下`360x640/360x640-leaderboard.png`；其余页面不能由这一张推断通过 |
| 广告源码探针 | 复现3项：旧档只读查询创建adRewards；日期回拨可多领；未加载show失败后Provider不再可用，直到收到关闭事件 | `evidence/planning-release-20261104/ad-source-probe.cjs`及`.json`；这是Node源码探针，不是真广告 |
| R31/R32 5/5、R33 6/6、R34 30分钟、R40 120年 | 保留既有专项证据，不宣称本轮重跑 | 仍需与最终源码/配置/包体关联；R34为Web固定夹具，不能替代Tap设备性能 |
| R30指定布局 | 保留已验收8单位间距，不重复重做 | 修改公共Shell/字体/卡片时再做受影响回归，不能借此跳过R39全矩阵 |
| 真实广告、资质、设备/云测 | BLOCKED / NOT_RUN | 未访问真实账号后台，U14—U16、U05/U06/U10无新核实证据 |

现有r7路径：`build/release/m3-20261103-adlocal-final-r7/01/game.zip`；releaseId=`m3-20261103-adlocal-final-r7`，version=`1.0.0`，purpose=`diagnostic`，SHA256=`f577f15ac362b2b6daffea8a99729421797f1b7b8a5e9da31468be7789798428`。不修改旧ZIP或旧manifest来“升级用途”。当前源码测试通过不证明r7包含其后源码，须以源码指纹比较。

区分四个交付阶段，避免“先真机PASS才能生成用于真机的包”的循环：

1. **诊断包**：用于定位问题，可含生产实现但广告关闭；本地静态PASS，允许明确标注缺陷。
2. **可上传开发自测的候选包**：本地必需门禁PASS、真实身份/配置及对应隐私核对完成、全新构建静态PASS；它正是随后上传开发版本并扫码验证的对象，尚不能写“平台验证通过”。有真实测试位时可以是广告开启的内部联调包。
3. **同包平台验证通过**：上述同一SHA256包已完成上传解析、登录、原生广告、设备生命周期、必要云测；换正式位、换配置、改一行运行代码都会产生新包，相关验证重新关联。
4. **READY_TO_REVIEW**：同包平台验证通过，资质/隐私/物料/版本唯一性等后台条件均满足。提交审核与上线仍是独立授权动作；审核通过也不自动等于已上线。

本轮不生成第2阶段新包，原因是用户明确将文档交其他agent开发；当前结论是“已有第1阶段静态PASS，距离第2—4阶段仍有下面工作”。缺后台资料不会阻止本地代码和测试继续。

### 20.2 未关闭任务、执行顺序与复用范围

保持M3-10原12项编号，不另造一套完成统计。01—03沿用已完成；04—09未完全验收、10阻塞、11未完成、12阻塞，共9项未关闭。下表是实施计划，不是把任务提前标DONE。

| 顺序 | 对应任务 | 本轮定位/要求 | 可独立推进到什么程度 |
|---|---|---|---|
| S1 | 06 / R12 | 补A-01—A-10完整映射，验证物理迟到写、关闭重开、时钟恢复 | 全部本地故障测试可做；真实强杀/生命周期留平台证据 |
| S2 | 07 | 重做Provider加载状态、错误分类、单实例和未决原生会话处理 | 无ID可用SDK行为Fake验；不能拿普通浏览器广告不可用算成功 |
| S3 | 08 | UTC+8日额度防回拨、过期与run绑定、旧档迁移、幂等奖励/用券 | 本地可完成；不扩建账户后端或声称服务端防作弊 |
| S4 | 09 | 60秒、首聘排除、每日提示调度、广告暂停原因、音频/前后台 | Fake端到端和生命周期重放可完成；真实hide语义需设备证据 |
| S5 | 05 / R39 | 修测试导航并修排行列宽；完成四视口全状态矩阵 | 本地可完成；安全区/软键盘仍补真实设备 |
| S6 | 04 | 保留新无字首屏，核Web/Tap启动进度、失败/恢复/旋转 | 源码、资源、Web可完成；Tap渲染实际读回待同包设备 |
| S7 | 10 | U14—U16及广告隐私资料；登录、资质与物料清单同步核 | 外部资料可先收集，不阻塞S1—S6；无资料不得开启生产广告 |
| S8 | 11 | 合并广告/财务/故障/UI/生命周期验收，补负例、覆盖清单 | 分层输出本地PASS与平台待测，不用单测总数代替完整验收 |
| S9 | 12 | 新releaseId构建→两套静态预检→开发自测候选→同包验证 | 没有真实位可交disabled候选/诊断；不能称已完成含广告提审包 |

生产代码最小修改位置：`assets/core/platform/TapRewardedAdProvider.ts`、`IRewardedAdProvider.ts`；`assets/scripts/ads/AdRewardCoordinator.ts`、`adConfig.ts`、`loadAdsConfig.ts`；`assets/core/application/AdRewardService.ts`、`GameFacade.ts`、`RecruitmentService.ts`；`domain/types.ts`、迁移/完整性校验；`AppView.ts`、`foregroundClock.ts`、`AudioManager.ts`；R39脚本/排行布局；隐私三份同源；构建/校验/manifest工具。新文件只在明确需要时建立，优先复用现有实现。

### 20.3 发现项与优先级：不能直接开启广告的原因

以下源码问题大多因`enabled=false`尚不影响现有玩家，但**是广告启用前阻断项**。P0为存档/金额/核心时钟安全，P1为真实广告正确性和规范，P2为交付可靠性。静态审查未执行的平台现象明确标“待验证”。

| ID / 级别 | 具体证据、触发与影响 | 修复出口 |
|---|---|---|
| AD-01 P1 | Provider接口没有onLoad/load；`createRewardedVideoAd`后直接show。官方说明素材未加载会reject。现代码reject后只settle，保留activeAttempt；如果只是未加载且根本没展示，通常没有close来清栅栏，后续一直unavailable。源码探针已复现栅栏 | §20.4加载状态机和加载失败恢复 |
| AD-02 P1 | `AppView.setupAdsAfterConsent`通过配置即可提示/创建Provider；begin/session与招聘入口没有首启60秒门禁。不能靠教程“通常超过60秒”代替明确限制 | §20.6统一资格闸门 |
| AD-03 P1 | onHide无条件`adCoordinator.cancelActive()`，会使晚到isEnded=true也不发券。广告播放是否触发本游戏onHide尚未真机核实，因此“观看完整却被取消”的风险待设备验证 | §20.6区分真实后台与广告覆盖；hide本身不判失败 |
| AD-04 P0/P1 | 广告请求没有经营/离线/音频独立暂停原因；onReturnForeground仍走普通离线结算。广告期间可能推进经营或被补成离线收益，源码路径风险 | §20.6统一时间边界与AD暂停原因，Fake及真机验证 |
| AD-05 P1 | dayKey依赖设备时区；任意日期变化就grantsUsed归0。领取并用券后调到下一天再调回前一天，可在前一天再次领取；探针复现。无券TTL/请求冷却/次数上限 | §20.5状态v2与UTC+8最高已见日 |
| AD-06 P1 | `adQuotaForDay`经stateOf直接给旧档state写adRewards；Facade canRequest是查询，却改变当前状态且不走保存。探针复现 | 只读归一化返回值；只在命令draft中初始化/迁移 |
| AD-07 P1 | confirmCloseCompany复制整个adRewards，仅清active字段，券跨run保留；与§19“限额保留、旧局券及会话失效”不符 | reset事务只复制最小跨局频控字段，清券/会话 |
| AD-08 P1 | Coordinator把请求开始nowMs用于完成；grant失败立即清内存active，界面统称广告暂不可用，未决“已看完但写盘未知”没有显式恢复/核对入口 | §20.5发券结果未决恢复；完成时取实际时刻、额度按预留日计 |
| AD-09 P1 | `parseAdsConfig`要求deviceVerified=true才能enabled=true，内部联调前就需要“已设备验证”，容易循环或诱使虚填true；policyVersion只是整数未绑定实际已同意版本 | §20.7分包用途门禁与真实同意版本核对 |
| AD-10 P1 | 当前隐私正文仍声明“无广告SDK/无广告/传输为零”；启用广告后失真。现disabled不能当广告版隐私完成 | §20.7实际SDK资料→正文版本→同意→启用 |
| AD-11 P1 | 招聘弹窗仅在`this.adCoordinator`存在时读取已有couponIds；平台临时无广告API、配置关闭或初始化失败会让已领券在UI里不可用 | 已领券使用资格只依赖合法钱包/招聘领域规则，不依赖Provider当前可展示；关闭广告只关闭新领取 |
| UI-01 P1 | R39四视口最终FAIL；脚本从排行页直接找设置，当前设置在公司页；不是平台设备不支持 | §20.8先返回公司再点击设置，保留失败证据 |
| UI-02 P1 | 已读360×640截图多行资产值与详情按钮重叠，长名和备注也需检查 | §20.8独立列宽和几何断言，打开截图复核 |
| PKG-01 P2 | build-tap-v2版本regex允许预发布/+后缀，官方上传版本为整数x.y.z；验证器未强制广告配置/政策/包用途一致 | §20.10增加严格校验与负例 |
| PKG-02 P2 | verify-package固定20MiB硬失败，skill把20MiB描述为保守提示；官网创建/审核页大小口径有差异。当前4.39MiB不受影响 | 保留项目20MiB预算时明确“项目门槛”，平台上限独立取证；不以放宽校验解决实际超标 |

Provider目前还调用不带参数的offClose/offError，会移除共享实例的所有监听。改为仅移除自己注册的函数；整个小游戏一个Provider拥有该单例，禁止每次隐私同意/场景重建叠加实例。错误码保留官方errCode及脱敏阶段，不把1002/1005—1008都笼统吞成“暂无广告”。

### 20.4 Provider接入实现：加载、展示、关闭和未知结果

普通小游戏使用平台提供的`tap.createRewardedVideoAd({adUnitId})`，不往Cocos工程导入H5广告桥、APK原生SDK、第三方脚本标签。插件1.2.2的存在不证明广告已经开通或所有OS均支持。先做feature detection，API不存在正常降级。

在`TapRewardedAdProvider`补充load/onLoad/offLoad，保留onClose/offClose、onError/offError、show。使用当前安装平台类型与官方文档核签名，不自己虚构曝光ID、奖励签名或服务端校验参数。

推荐状态：`disabled → idle → loading → ready → showing → awaiting-close → idle/loading`；异常分`load-failed`（确认未开始展示）、`display-outcome-unknown`（不能证明原生已结束）、`disposed`。以下时限为本项目工程值，不是平台要求：加载15秒、展示回调观察120秒；后者到时仅显示未决，不能伪造关闭或自动发奖。

处理顺序：

1. 初始化前校验配置与当前隐私同意，不调用创建API预取广告；通过后只创建一次，立即注册自己持有的load/error/close引用。
2. 创建会自动拉取；等待onLoad。若进入此过程后用户取消，记录attempt失效，后来onLoad不能自动弹广告。用户主动点击时才允许请求展示；每日提示弹出不等于同意播放。
3. 已ready且用户仍在前台、run和session仍有效、资格仍满足，才调用show；show resolve只意味着展示成功，绝不发券。
4. show在**明确尚未展示**的加载失败分支reject：清本次等待、允许稍后显式重试；必要时调用load一次，不递归load/show。若reject与真实显示/原生状态矛盾，则进入unknown，不武断释放原生栅栏。
5. close严格`result?.isEnded === true`才返回completed；false、undefined、缺字段均无奖。complete最终由协调器持久化成功后才能给“已领取”反馈。
6. close后官方会自动拉下一条；清ready状态等待下个onLoad，不再额外每次重复创建。多个close/error同时到来时同一次attempt最多settle一次。
7. 1004视为正常无填充，告知“暂无广告，可继续经营”；1001/1002报告配置/参数问题；1005—1008报告审核/停用状态待后台处理；1000/1003允许后续用户主动重试，不轮询轰炸。
8. 真正showing时不调用主动hide/destroy强关原生播放器。超时或app隐藏本身不能证明关闭，不把旧close重新绑定成新session；未决期间其他广告入口disabled，普通经营可在确认已回游戏且时间边界核清后恢复。
9. dispose只清自己的监听和定时器，并遵守平台原生生命周期；onDestroy后禁止更新已销毁UI。后台SDK是否保活及onShow/onClose顺序以真机日志补齐，不凭浏览器推断。

最少Fake接口事件集：延迟load、创建即load、load失败、show成功、加载未就绪reject、成功show后reject、close真假/undefined、重复close、error后close、超时后close、旧session回调、无回调、取消后load。Fake只在tests/helpers，生产ZIP必须扫描不到Fake入口或测试写状态hook。

### 20.5 奖励数据、迁移、幂等与招聘事务

继承§19设计而非重新发明经营规则：每日可跳过提醒一次；两个入口共享每日最多1次成功发券；只免1次招聘费，员工仍按原月薪、次月到岗；教程首聘两人不参与。不增加直接发员工、免工资、现金、复活、翻倍收益等其它奖励。

**v2数据建议**（字段名可按现有类型一致命名，语义不能省）：

```ts
interface AdRewardStateV2 {
  version: 2;
  maxObservedDayIndex: number; // UTC+8日，不使用设备本地时区
  lastObservedWallClockMs: number;
  days: Array<{ dayIndex: number; promptShown: boolean; grants: number;
    requests: number; lastRequestAtMs: number | null }>; // 保留最近8日
  activeSession: null | { id: string; runId: string;
    placement: 'daily' | 'recruitment'; reservedDayIndex: number;
    startedAtMs: number; status: 'reserved' | 'showing' | 'uncertain' };
  coupon: null | { id: string; runId: string; sessionId: string;
    createdAtMs: number; expiresAtMs: number; status: 'available' | 'used';
    usedByCommandId: string | null };
  recentFinalizations: Array<{ sessionId: string; runId: string;
    couponId: string | null; result: 'granted' | 'canceled' }>;
}
```

1. `dayIndex=floor((nowMs+8*3600000)/86400000)`；有效now必须有限整数。更新时持久化最高已见日；时钟回拨不重新开额度，保留提示且报告非阻塞“设备时间异常”。不改变经营模拟时钟的既有口径。纯离线客户端不能防卸载改档等作弊，不声称有SSV。
2. 沿§19工程参数：每日成功1次、每日请求最多3次、请求间隔120秒、最多1张未消费券、7个自然日有效。7天指领取日D到D+7当天00:00 UTC+8失效；UI必须说明。未成功展示/未完成不扣成功额度，但计已发起请求以限制重试。无可用API/配置时不预占请求。参数属于既定设计基线，不可为通过测试随意改动。
3. begin/session在一个Store事务里检查run、phase、当前合法placement、教程排除、首启门禁的可信上下文、日额度、冷却和券状态，写入reserved session。按钮置灰只是体验，不能代替领域校验。初始phase不能从Facade直接领券，即使绕过UI也拒绝。
4. 完成时使用真实完成时间记录券创建/到期；额度计入session预留日，跨零点不重复。Coordinator捕获开始时的expectedRunId和session，完成/取消都传回，Facade不能悄悄改用回调时的新runId。
5. 幂等发券命令ID固定如`ad-grant:<sessionId>`。在同一draft原子写coupon、日额度、终态、命令记录；重复close、异步重试、重启恢复均返回同一结果，不再发新券。超过有界回执窗口的旧回调也不得凭空重新通过，必须匹配活跃session或已有终态。
6. 已完整观看但commit未知：保留`grant-pending/uncertain`协调状态，进入已有存档恢复闸门；不提示“再看一次”。恢复后读权威存档：已落盘则展示原券；未落盘且完成证据仍在当前进程可信内存，则用相同commandId提交；进程被杀且平台无可靠完成凭证，不能凭一个reserved标志自动发奖，应按无证据未决清理并记录。不要把本地sessionId当SDK签名证明。
7. 首次加载旧档的只读查询返回缺省view，不改Store.current。v1有couponIds但没有创建时间/run元数据，迁移时以当前旧run绑定、当前迁移日作为首次记录给7天期限，保留至多一张已有券以避免删除已承诺权益；其余异常数据报告并采用确定性规则。迁移本身通过保存事务一次落盘，重启不得刷新期限。旧active会话无可信回调，不迁成已完成。
8. stateIntegrity新增v2字段类型/上界/时间整数、coupon与run一致、终态唯一、计数范围、session互斥校验；旧v1合法读取，非法扩展不能无声整局重置。SaveCodec/迁移/schema文档同步，限制days≤8、recentFinalizations≤32，配合整槽500KB预算。
9. 关闭公司时保留跨局频控日记录/最高时间/必要终态防重，**清除旧局券与活跃会话**；新局首聘不使用旧券。展示/发券处理中禁止关闭重开，给可理解提示；旧回调run不匹配拒绝。上述复制必须在现有replaceWithNewRun已恢复后的锁内factory完成，不能另写localStorage。

招聘执行点：保留`RecruitmentService`正常录用算法。抽取共享的preview/command资格与费用计算，输出`nominalFeeYuan`、`feeYuan`实际费、`couponEligible`、`couponExpiresAtMs`、正常月薪和生效月。指定无效/过期/他run券时预览与执行一致拒绝，不一边显示原价一边执行ALREADY_USED；不偷偷退回付费招聘。

已合法领取且未过期的本局券，在平台暂无广告、Provider初始化失败或后续包关闭新广告时仍可使用；钱包读取和用券不能依赖adCoordinator是否创建成功。旧券权益的安全迁移与新广告隐私同意是两件事：未获新版广告同意不创建/加载广告，但不能据此吞掉既有本地券。

同一Store事务内：校验expectedRun/offer/candidate/部门/券→实际费（券=0）及现金校验→consume券→创建唯一员工→实际招聘费现金/账分录→写command/结果回执。任一步保存失败不发布部分状态。保留员工`hireReceipt`或等效有界可追溯记录，使同command重试不依赖已裁剪pendingEntries而错误返回费Paid=0。不同command重复同候选拒绝、同券不同候选也拒绝。现金足以支付0但不足原价时允许券招聘；普通招聘口径不变。

财务样例：正常招聘费6000、月薪6000、当前现金C和员工E；券招聘成功→现金仍C，员工E+1，coupon不可再用，实际招聘费用0，不增加虚构广告收入/资本；当月仍未到岗，下月工资增加6000且能力只算一次。取消/广告失败/offer过期→C/E/券消费状态保持。后续真实广告商业收入属于开发者平台结算，不计入游戏公司模拟现金。

### 20.6 UI与生命周期：60秒、每日提示、暂停和恢复

新增统一`AdEligibility`查询/协调上下文，两个入口共用：广告配置合法、平台API存在、**当前广告版政策已同意**、phase=RUNNING、首聘及教程完成、首次启动有效前台交互时长≥60000ms、没有其它互斥确认/存档恢复/原生会话、未用完额度且无券。60秒不受1×/2×/5×影响；不计后台、离线、初始化等待和广告时间。可采取每个冷启动都等待60秒的保守实现，同一进程hide/show不能刷新或跳过计时；该实现比官方首次启动最低要求严格，属于工程选择。

每日提示必须在资格首次满足时调度，而非仅setupAdsAfterConsent时调用一次：教程→RUNNING、60秒到时、下一自然日、回前台均重新检查；同一天只真正展示一次，已有券不提示。先确认当前路由能安全展示再持久化promptShown，禁止在其它必需弹窗下标“已提示”却玩家没看到。后台定时器到时不弹，返回后再检查。

提示文案：标题“自愿激励广告”；正文“完整观看可领1张免招聘费券，仅免一次招聘费，月薪照常支付，下月到岗；每天最多领取1次，7天内使用”。按钮“看视频领取”/“跳过继续经营”；在招聘弹窗显示同样规则和剩余额度，领券成功后重读当前run/offer和部门，不能用播放前已过期offer直接恢复录用。持券时显式“使用招聘券”及0元实际费，取消录用不消券。无广告不显示空广告框。

时间与音频用原因集合（例如`USER_PAUSE/APP_BACKGROUND/AD/PERSISTENCE`），不要临时把持久化speed改0再猜原值恢复。请求起点刷新在线水位，进入AD暂停；showing时暂停经营和游戏音频；完整close或明确加载失败时释放AD原因；原来玩家暂停、音量总关、存档恢复等其它原因继续生效。第三方播放器声音由平台管理，不伪称游戏音量能控制广告。

`onHide`处理：loading阶段用户真退后台可取消待展示；showing阶段仅记录覆盖/可见状态，不直接取消完整观看资格。`onShow`不能独立发奖，不自动重播，不先普通离线结算再处理广告。用可信native terminal事件和本地时间区间剔除AD占用区间，真正后台离线仍按原规则计算；先保护入广告前真实离线水位，避免整个后台时段都被误删。事件可乱序重复，应以幂等状态机处理，不用固定sleep假设顺序。

必须测试三种时间线：①正常广告覆盖30秒，经营/离线都不增加这30秒；②先真实后台10分钟再回前台看广告30秒，10分钟离线仍结算；③广告后用户又真后台10分钟，广告30秒剔除、后10分钟结算。加上onShow先于close、close先于onShow、双hide/show、强杀再进、写盘unknown组合。真实平台是否触发onHide需日志验证，不能把Fake事件顺序定为SDK保证。

### 20.7 配置、真实联调、隐私、登录和后台资料

当前`ads.config.json`保持安全默认。建议把**本地能力配置**和**外部测试证据**分离：资源记录schemaVersion、enabled、environment（disabled/test/production）、policyVersion、rewardedAdUnitId、dailyGrantLimit、TTL/冷却等；设备验证结论写release验收清单，不能以一个手填deviceVerified布尔量当证明。

内部联调允许：真实已核测试位+广告版隐私已核/已同意+本地必需门禁通过→新diagnostic包可开启广告供已授权设备测试，device尚未PASS不阻止这一步。生产候选：真实正式位、媒体/位审核及支持OS明确+政策匹配+源码门禁PASS→生成待上传自测候选；最后可提审门禁由**该包实际设备结果**控制，而非构建前假填true。若继续保留旧字段，只能按用途校验并在manifest标真实来源，禁止用任意true绕过验收。关闭广告包也不能注入测试位、Fake或静默开启。

U14—U16最小脱敏交接表（用户/具备授权的后台操作者填写）：

| 字段 | 提供什么 | 不需要什么 |
|---|---|---|
| U14：普通小游戏/媒体关系 | 游戏ID；Dirichlet媒体类型为小游戏、媒体/广告位审核状态；激励视频测试及正式adUnitId；实际支持OS/测试白名单要求；查询时间及截图/工单引用 | Secret、session_key、账号密码 |
| U15：联调条件 | 可测试TapTap客户端版本、设备型号/OS、测试账号可访问状态；结算主体已完善/待完善状态 | 银行卡、证件、收款账号原文 |
| U16：SDK与政策 | 实际宿主广告模块/联盟名称与版本来源、官方隐私链接/合规说明、数据类别/目的/传输对象、隐私公开URL、广告版政策确认状态 | 猜测“肯定不采集设备信息”或直接复制APK SDK清单 |
| 版本与资格 | 当前线上/审核中版本、目标地区/OS、主体认证、普通小游戏前置备案及权属要求状态 | 只凭“个人开发者/无内购”推断全部豁免 |

隐私更新按`privacyPolicyText.ts`→`resources/config/privacy-policy.json`→`docs/隐私政策_我是CEO.md`→真实公开URL同源生成/核对。将“无广告/无广告SDK/传输为零”等绝对声明改成符合实际实现的描述，区分游戏经营数据本地与平台广告数据处理；披露第三方名称、用途、实际数据、政策链接、选择/撤回方式、未成年人处理。不了解SDK数据时记录待核，不能代填；允许用户跳过广告继续经营。新版policyVersion必须触发现有同意记录重新告知，未同意不创建或加载广告组件；不将广告授权藏在默认勾选项。

登录也要作为上传必要能力单列：确认当前`TapPlatform/AuthService`真实tap.login/checkSession成功、失效重登、拒绝/断网时可理解反馈。不要把本地存档可玩等同平台登录完成。若项目真实需求仅保留平台登录成功状态，记录与平台当前要求核对的证据；若必须换取openid或自有身份，则使用现有最小server完成code2Session，凭据仅在服务端，不向客户端/ZIP写Secret/session_key。未获要求时不自行扩建账户、云存档、联网排行榜。

### 20.8 R39视觉与R12故障补验：具体操作与判据

**先修可复现的失败，再扩矩阵。** `tools/e2e/visual-viewports.cjs`在排行截图后直接clickTopControl('设置')；改为先clickBottomTab('公司')，等待公司页锚点/首屏overlay退出，再真实点击设置并等待设置弹窗。不改为“找到不到就跳过”、不只截屏而无动作。R39 attempt-04保留FAIL，另开新attempt。不把“设置不在排行页”报成游戏设置功能缺失。

排行榜在`AppView`现有排行渲染函数中改为明确列：卡片可用宽343减左右padding、名次列、名称列、金额列、详情按钮和列间距；以逻辑单位计算各列边界。详情按钮触区至少44，金额right边必须≤按钮left边-8，不能通过缩短真实金额/删除详情按钮隐藏问题。长公司名只在名称列换行，行高按实际内容增大；金额可使用项目统一紧凑格式，详情完整显示整数，不能把缩略展示回写数值。小屏、13行及本方定位都测试，列表底部不得被Tab遮挡。

四视口：360×640、375×812、375×834、390×844。每视口至少覆盖以下状态，每条独立PASS/FAIL并打开最终图检查：

| 状态组 | 输入/动作 | 实际断言 |
|---|---|---|
| 启动/隐私 | 冷启、旧版同意、新版政策重告知、资源加载失败/重试 | 真进度不是烘焙数；正文可滚到末尾，按钮可触；失败不假新建 |
| 创建/教程 | 长公司名、CEO名、三行业、首聘中途退出恢复 | 软键盘不遮确认；首聘无广告；创建/工资/员工结果真实 |
| 公司/部门 | 缺省、六部门、预算/投资/创建确认/零员工 | 文本/金额/触区不交叠；取消零变更，确认只执行一次 |
| 人才 | 0/2/30/100员工、2行筛选、pending标签、末项详情 | 保留R30间距8；卡池复用不串人；主标签/按钮不遮挡 |
| 排行/年报 | 13条、并列、长名、大金额、本方定位、100报告 | 金额不被详情遮；报告可滚底；只读不推进revision |
| 设置/离线/危机 | 返回公司开设置、音乐总关、离线长文、100000救助确认 | 操作可达且持久化；救助计资本不虚增利润；离线次数幂等 |
| 广告UI | daily/recruitment提示、skip、loading、nofill、完整/提前关闭、grant-pending | 奖励规则明确；失败能继续；0/1券与账实一致 |
| 故障/恢复 | 未决保存、双槽坏、读超时、重开中断 | 入口不穿透；不覆盖档、不静默新局；可重试/退出 |

几何断言：仅对同层有效可见区域做矩形交叠/边界检测，区分故意背景叠层和文字遮挡；记录Label实际行数、content size、按钮hitbox；44触区不能因为透明扩大而侵入邻近控件。自动规则不能替代打开截图，不可仅因PNG存在就PASS。若文本宽度取值为0/未布局，等到排版完成再测，不写宽松阈值忽略。

R12故障矩阵以§19 A-01—A-10为主清单，现有`transactionRecoveryMatrix.test.ts`已覆盖部分，逐条映射实际test名称与注入阶段，不能只写“存档回归56项”。必含：

| A项 | 需注入/真实复现 | 成功判据 |
|---|---|---|
| A-01 | 指针实际写成功但回调报错；同command重试 | 重读确认只执行一次，revision不重复，金额/券/员工不重复 |
| A-02 | 同样未知结果后发不同付费命令 | 先恢复新基线再应用后命令；前次资产不丢、无旧draft覆盖 |
| A-03 | journal/目标槽/指针写前失败、写后未知，各自独立 | 最终只能合法旧态或合法新态，无现金已扣员工未建等中间态 |
| A-04 | journal/目标槽/指针读超时、读取失败 | 不可判缺失，不准新建；恢复前不执行业务draft/墓碑 |
| A-05 | journal清理失败、重复load/reconcile | 幂等恢复，无重复奖励/扣款/重复月结 |
| A-06 | 真实存储写入晚于JS超时；迟到success/fail | 物理写未定前native fence阻新写；结束后重读，旧写不覆盖新run |
| A-07 | 关闭公司时先前提交未知；墓碑后新槽失败/强杀 | 锁内恢复后构建新状态；旧公司不复活；新局频控保留券清零 |
| A-08 | 广告/招聘/投资预览后状态变化、关闭重开、迟到回调 | stale preview/oldrun明确拒绝，金额及新局不变 |
| A-09 | online tick保存未知+hide/show/离线恢复 | 未提交不推进已结算水位；实际已提交可恢复且时间不重复补 |
| A-10 | 广告grant/use-coupon存档故障并继续两个月 | 最多一券/一员工；工资、产能只算一次，时钟持续可写 |

每项留注入脚本、初态、调用序列、实际物理操作日志、内存与存储run/revision/generation、C现金/资产/E员工/券、重启读回结果。普通Error替代不等于强杀测试；真正强杀/平台异步API迟到列为设备待测。已存在回归按缺项补，不重复重做所有服务。

### 20.9 广告专项验收清单与证据格式

给现有`rewardedAdProvider.test.ts`、`adRewardState.test.ts`、`adCoordinator.test.ts`增补，用业务结果而非固定总数验收。另需广告生命周期和招聘事务集成测试；文件尚未存在时先创建再运行，不能把设计中的文件写成已执行。

| 组 | 最少必须覆盖 |
|---|---|
| P加载/回调 | 首次load成功再show；未加载reject后可重试；1004/1002；show resolve无奖；close true/false/undefined；重复/乱序/超时后关闭；旧close不归新会话；监听不累计/不误删他人 |
| Q额度/日期 | 两入口共享1次；提示skip后当天不重弹；请求上限/冷却；UTC+8零点；改系统时区不重置；回拨探针改为不能第三次领；跨午夜按预留日；TTL边界；旧档迁移不延长券 |
| T事务 | begin保存失败不show；grant写前/写后未知；恢复后发同一券；同券不同command拒绝；offer失效不消券；0现金券可招；招聘重复/重启/账本裁剪后结果稳定 |
| L生命周期 | 首次59.9秒不展示/60秒后可选；首聘与非RUNNING拒绝；skip继续；load后退后台不自动show；showing hide不误取消完成；AD/用户暂停/存档暂停组合；音频总关仍静音 |
| R重开 | 展示/领奖未决不能重开；重开保留日额度、清券；旧run回调和旧券拒绝；新局首聘不免；存档坏时不因广告创建新档 |
| F财务 | HR折扣名义费准确；实付0；当月未到岗；次月工资/产能一份；不会把开发者广告收入写入公司账；取消无变更 |
| D真机 | 真实位完整1次/提前关1次/断网或无填充/后台恢复/强杀/音频；每个声明支持OS至少验证；不可用OS能正常经营 |

报告至少包含`taskId/attemptId/sourceFingerprint/configHash/buildId/packageSha256/environment/fixture/expected/actual/status/evidencePaths`；Fake标`environment=node-fake`，浏览器标`web-chromium`，原生标`tap-client + version + deviceOS`。日志记录errCode、state转移、脱敏session/run关联、权益变化和保存结果；不得含登录code、session_key或用户敏感信息。不同环境不能互相替代结论。

### 20.10 构建/校验工具整改与最终包内容要求

保留现有可靠链：Creator3.8.8→wechatgame→Tap官方插件1.2.2转换→统一补丁→单一打包器→ZIP验证→manifest。没有必要先换引擎/插件；如果官方兼容要求或真实故障证据要求更新，再做独立兼容实验，不全量盲升级。

工具变更：

1. `build-tap-v2.ps1`、convert/verify统一严格整数三段版本`^\d+\.\d+\.\d+$`；项目字段用1.0.0，后台展示按Vx.y.z组件要求填。不能仅换releaseId而重复提交已上线/审核中版本。package.json的npm版本0.1.0不自动作为游戏版本，manifest/game.json/构建profile统一实际游戏版本。
2. 新增独立release门禁文件（建议`evidence/m3/build/<releaseId>/<attempt>/release-readiness.json`，结构化证据，不是第二份需求文档）：用途、广告模式、政策版本、必需本地结果、外部待测。构建工具读取真实配置并验证用途一致，不能仅从参数purpose赋名就算产品候选。
3. ZIP验证在现有CRC/路径/重复/入口/版本/profile/旧图hash/Mock与密钥扫描基础上，解析Cocos实际资源索引定位**包内**ads config、隐私资源和代码policyVersion，检查enabled/environment/ID/政策一致；禁止测试位误入生产声明包、禁止Fake和开发写状态入口、禁止localhost调试依赖。仅扫描原始源码文件不能证明最终ZIP正确。
4. 资源引用至少核game.js直接require/System.import、实际hash application、启动图、bundle manifest到import/native资源；运行动态资源仍需真实启动和页面测试。不要声称现有直接引用检查已覆盖所有动态资源。
5. 版本、用途和ID不匹配、缺资源、含旧烘焙78%图、含Fake、修改包后hash不符必须返回非0。补测试到`tests/tools/releasePipeline.test.mjs`，保留现有UTF-8路径和重复补丁回归。单纯扩大异常白名单不可接受。
6. 20MiB若继续作为本项目预算，报告为`projectSizeBudget`，而非假称当期统一官方最大值。增加`platformLimitEvidence`存后台日期/来源，当前包远低两种口径，无需为了本次交付改大上限。
7. manifest记录真实Creator/插件、sourceHead、dirty文件路径及hash、所有构建输入资源/配置和工具hash、各步骤退出码、Creator完成标志、版本、purpose、广告environment、政策版本、ZIP大小/条目/SHA。把构建输入快照和后续验收报告分开，最终manifest不自包含自身hash形成循环。
8. `builtAt`应区分实际构建开始/结束与验证时间；现verify脚本builtAt是验证时刻，应改`verifiedAt`或由enrich补真实构建时间。事后重新verify不要覆盖原正式manifest，写新的recheck输出。本轮已采用独立r7-verify目录。
9. 构建前冻结运行输入；构建期间若源码/资源/配置/工具变更，比较前后fingerprint，不一致即该candidate作废重建。工作区脏不是必须git clean的理由，指纹能完整追溯；禁止提交/push/清理他人文件来达成“干净”。

合格上传候选至少包含：根game.js/game.json与实际引用application、平台适配文件、bundle与native资源、无字splash-art及真实progress、正确portrait/gameVersion/平台profile、真实有效的配置；无文件夹多套一层、Windows反斜杠、路径穿越、重复条目、密钥、开发Mock。可生成README/验收清单放在**ZIP旁边**，不要把证据和私有资料打进游戏ZIP。

### 20.11 执行命令、顺序、日志与失败处理

所有命令PowerShell执行，从仓库根目录开始。下面第一组均已存在；每次使用**未存在的输出目录/attempt**。先确认命令和工具help，外部程序失败立即检查`$LASTEXITCODE`，不以ErrorActionPreference代替。不要照抄尚未核实的真实ID或版本。

```powershell
Set-Location -LiteralPath 'D:\Workspace\TapTap\我是CEO'
$ErrorActionPreference = 'Stop'
git status --short
Get-Content -LiteralPath 'skills/taptap-mini-game-publisher/SKILL.md'

# 完成对应修复后先跑聚焦项，再跑全量；日志写新attempt，以下为实际存在的测试路径。
npx vitest run tests/unit/rewardedAdProvider.test.ts tests/unit/adRewardState.test.ts tests/integration/adCoordinator.test.ts tests/integration/transactionRecoveryMatrix.test.ts tests/tools/releasePipeline.test.mjs
if ($LASTEXITCODE -ne 0) { throw 'Focused tests failed' }
npm run check
if ($LASTEXITCODE -ne 0) { throw 'Full check failed' }

# Web构建后以其真实输出目录启动static-server；不能把旧构建当本次源码。
# 当前visual脚本已有，先修导航及补矩阵，再用未存在的输出目录运行：
node tools/e2e/visual-viewports.cjs --help
if ($LASTEXITCODE -ne 0) { throw 'Visual runner help failed' }
# 例：node tools/e2e/visual-viewports.cjs --url http://127.0.0.1:8150/ --out evidence/m3/TASK-M3-09-R39/attempt-NEW/matrix
```

R31/R32、R33已有通过可保留；若公共布局/领域改动触及对应行为，用`tools/e2e/r31-r32-ui.cjs`、`r33-settings.cjs`先看help和真实参数再跑。R34已有一次30分钟Web长跑不因改文档重跑；改Provider监听/暂停/界面池后，需要增补广告循环监听/节点泄漏试验，必要时重跑soak，计时不足30分钟不改标签充数。R40已有120年1440月及100年报保留，奖励v2加入后补合法adRewards数据的SaveCodec尺寸/迁移读回，900×5年模拟不能代替120年持久化。

最终构建命令（在确定未重复的真实游戏版本/新releaseId后运行；例中的时间/版本是示意，不自动代表后台可用）：

```powershell
# 将下一行示意值改为后台核对过的版本及本次唯一releaseId；不加 -SkipBuild。
$releaseKey = 'm3-20261104-ad-rc-01'
$gameVer = '1.0.1'
powershell -ExecutionPolicy Bypass -File tools/build-tap-v2.ps1 -ReleaseId $releaseKey -GameVersion $gameVer -Attempt 01 -Purpose product-test-candidate
if ($LASTEXITCODE -ne 0) { throw 'Release build failed' }
$zipFile = Join-Path $PWD "build/release/$releaseKey/01/game.zip"
Get-FileHash -LiteralPath $zipFile -Algorithm SHA256

# 工程验证器已在流水线执行；二次核对要写新目录，不能覆盖原enrich manifest。
node tools/verify-package.cjs $zipFile $releaseKey $gameVer "evidence/m3/build/$releaseKey/01/recheck"
if ($LASTEXITCODE -ne 0) { throw 'Final zip verifier failed' }
python -X utf8 skills/taptap-mini-game-publisher/scripts/preflight.py --project . --target tap-mini --package $zipFile --version "V$gameVer" --json "evidence/m3/build/$releaseKey/01/skill-preflight.json"
if ($LASTEXITCODE -ne 0) { throw 'Skill preflight failed' }
```

只有实现§20.10用途/配置门禁并完成本地所需验收后才用product-test-candidate。内部广告测试用diagnostic并标test环境；真实位/政策未核则disabled，不把diagnostic强改名为产品候选。本地可上传候选的静态PASS不意味着可提审；上传测试在后一步用于补平台门禁。

构建失败先读日志定位首次错误，禁止沿用旧ZIP。Creator本机成功可能exit36，仍需真实doneMarker和新产物时间戳；不把任意36都白名单。`PIPELINE_OK`必须回读最终ZIP/hash/manifest并确认每一步0或明确解释的Creator结果后才算静态PASS。已有输出被拒绝时换新releaseId/attempt，不删除旧证据。

### 20.12 上传自测、设备、云测与可提审条件

**用户本次要求生成上传所需包体和方案，不等于授权替用户提交审核/上线。** 本轮只设计；接手agent可准备包与材料，上传、提审、发布必须按已有授权范围分别执行，未授权则交用户自己上传。不要因此在本地开发途中反复申请确认。

| 阶段 | 操作 | 验证/回执 |
|---|---|---|
| 0：后台资料核对 | 用户登录正确游戏，核主体、普通小游戏ID、版本历史、测试入口、Dirichlet位、SDK/隐私和资质状态 | 脱敏U表；实际截图时间/对应游戏，不收密码/Secret |
| 1：上传开发版本 | 后台商店→小游戏管理→包体管理；选择最终game.zip，填核对版本，上传解析 | 上传前后本地SHA一致；记录后台包ID、解析结果、版本；解析失败留原文诊断，不重复瞎传 |
| 2：扫码自测 | 对应开发版本二维码，验证显示releaseId/版本确属此包 | 冷启、平台登录、首聘、月年结、重启存档、音频、弱网/断网、关闭重开、长文本 |
| 3：真实广告 | 测试位完整/提前关闭/无填充，确认只发1券、用券免真实费工资不变；前后台/返回事件顺序与时间核对 | SDK回调脱敏日志+券/现金/工资/保存读回；不是toast或仅show成功 |
| 4：目标设备/云测 | 原失败OPPO/Redmi/vivo重点，按真实目标增加华为系统形态与iOS；客户端版本/机型/OS明确 | 同hash冷启/恢复各10次、强杀存档、30分钟运行性能；云测有报告ID/机型覆盖，不把Web heap当原生进程内存 |
| 5：正式位候选 | 若从测试位换正式位，新releaseId构建，重跑包校验及正式位实际完整/中断验证 | 不能拿测试位旧hash报告直接签正式位新hash |
| 6：审前资料检查 | 游戏主体/备案/权属要求/防沉迷/地区/隐私检测/素材/商店版本与包一致 | 均有真实状态；缺一条强制项→BLOCKED，不写READY_TO_REVIEW |
| 7：提审与发布 | 获明确授权后按后台当前流程操作；通过后核实际上线时间和状态 | 操作回执、平台审核结论；未操作分别写NOT_RUN |

若原有R08兼容故障仍复现，按§19的A官方最小包/B适配诊断/C完整包在同失败设备对照，收第一条错误/资源请求/纹理能力/音频与生命周期。不要反复全局换FPS或写fetch假成功掩盖；本地r7解析成功也不关闭R08。

公开素材按当前官方物料页准备：横1920×1080和方1440×1440各1张、单张2MB以内；至少3张真实实机截图（按后台分辨率要求）；竖屏实机视频9:16、至少720×1280、MP4 H.264/HEVC且≤500MB。UI运行9:20不意味着宣传录屏可直接用9:20；通过真实合适视口/安全留白录制，不拉伸/裁掉操作。不把49张设计PNG当实际游戏截图，不把PNG放大称高分辨率实机。图标按当前后台组件，不臆定统一512。

资格核对保留skill冲突台账：普通小游戏前置备案、当前主体与权属/软著要求、无内购路径、防沉迷平台托管责任及目标OS均以真实后台与必要工单为准。无内购不等于全资质豁免。隐私URL不得用论坛帖承载。具体个人资质未知时写NEEDS_VERIFICATION，不凭文档推定已获许可。

### 20.13 每步交付、停止条件与执行agent提示词

按S1—S9顺序可持续推进，不等待U14而停掉可做的本地任务。每项交付必须写任务ID、修改文件、真实命令、结果、证据、遗留。P0/P1未关或矩阵缺项不得宣布专项完成；当真正缺外部资料时完成所有独立本地工作后一次列出缺什么/影响哪层/下一操作，不循环生成多个“final诊断包”假装收口。

最终目录建议（在当前构建输出旁补证据，不复制多个不同ZIP混淆）：

```text
build/release/<releaseId>/<attempt>/game.zip
evidence/m3/build/<releaseId>/<attempt>/manifest.json
evidence/m3/build/<releaseId>/<attempt>/package-check.json
evidence/m3/build/<releaseId>/<attempt>/skill-preflight.json
evidence/m3/build/<releaseId>/<attempt>/release-readiness.json
evidence/m3/build/<releaseId>/<attempt>/logs/或现有逐步骤日志
evidence/m3/<TASK-ID>/<new-attempt>/各专项报告、截图和脱敏平台回执
```

`release-readiness`分别列`localQuality/packageStatic/platformRuntime/reviewReadiness`；值用PASS/FAIL/BLOCKED/NOT_RUN并带原因，不能把缺凭据笼统写全部失败。输出唯一推荐ZIP的绝对路径、版本、releaseId、SHA、size、广告环境、用途；即使blocked也明确当前能交付的层次。未知/待测不能写true。旧r7保留为诊断历史。

**可直接复制给执行agent的完整提示词：**

```text
你接手 D:\Workspace\TapTap\我是CEO，目标是在现有实现上完成普通Tap小游戏广告与发布收口，最终交付可上传开发自测的真实ZIP及分层验收，不重做已通过的模块。

先读 AGENT.md、skills/taptap-mini-game-publisher/SKILL.md 及该skill相关references，重点读 docs/我是CEO_项目总览.md §20全文；§19提供详细背景，§20是2026-11-04针对当前源码的续行执行契约。唯一权威文档仍是总览，不新建平行PRD。核git status保护全部未提交/未跟踪改动。默认简体中文。

当前基线：本轮独立check为459 passed/1 skipped，56测试文件通过/1 skipped；r7 ZIP 4,603,532bytes/458entries，SHA f577f15ac362b2b6daffea8a99729421797f1b7b8a5e9da31468be7789798428，仅disabled diagnostic。R39 attempt-04四视口已全部FAIL（从排行直接找设置）；360x640截图另有金额被详情遮挡。证据在 evidence/planning-release-20261104 与对应R39目录。不要继续写“视觉脚本运行中”或复用旧r7作为新候选。

按§20 S1—S9连续实施，常规可逆选择自行推进：
1) 完成R12 A-01—A-10注入/物理迟到写/重开/时钟恢复映射；保护已提交状态、不重复扣款/奖励，不以普通Promise失败冒充强杀。
2) 修TapRewardedAdProvider的onLoad/load/ready/show/close状态；素材未加载show reject不能永久锁死；仅isEnded===true奖励，show resolve无奖；不主动关原生激励视频、不off掉他人监听、不把迟到旧close绑定新session。
3) 奖励v2：只读不写档、UTC+8/最高已见日防回拨、共享1次日额度、3次请求/120秒冷却、单券7天、run绑定、旧档迁移/有界回执、grant未知先恢复不再看一次；reset保留频控清旧券/会话。
4) 招聘预览/执行共用校验；只免一次招聘费、月薪照付、次月到岗、首聘排除；coupon+员工+账+command同事务，重试结果稳定，非法券不偷偷转付费。
5) 补60秒首启门禁和资格到时调度，每日提示可跳过；AD暂停原因与经营/离线/音频统一；showing的onHide不武断取消资格，真实前后台事件以真机证据确认。
6) 修R39测试导航和排行列宽，完成四视口全页面/弹窗/长文本/错误状态矩阵，打开截图核查。保留R30既有8单位间距，公共布局改动补受影响回归。
7) 复核官方当期普通小游戏/Dirichlet接口，不套H5 MCP广告或APK SDK。U14—U16缺失不阻塞本地实现；只向用户要脱敏ID/状态/政策及设备条件，不要密码、Secret、银行原件。按实际SDK更新三处同源隐私和公开URL/同意版本。内部真实测试可先启用测试位并标diagnostic，不伪填deviceVerified来解锁；生产提审门禁由同包真机证据控制。
8) 按§20.9补广告/金额/生命周期/故障负例，复用既有R31/R32/R33/R34/R40证据并按影响补验；门禁全绿不能替代矩阵。新增脚本先实现再调用，不猜命令。
9) 按§20.10改构建/校验门禁：严格三段版本、最终ZIP内ads/隐私/用途一致、Fake/旧图/密钥禁入、输入指纹冻结、manifest构建时间与校验时间分离，补负例。全新releaseId真实Creator构建，禁用SkipBuild，执行工程verify与skill preflight，回读唯一ZIP/hash/manifest。候选包用于后续上传自测，不能要求先该包真机通过才允许生成它；但可提审必须同hash实际设备/登录/真实广告/云测和资质全满足。

产品规则已授权：每日一次提醒可跳过继续经营；完整观看领免一次招聘费券，不免月薪；两入口共享日额度；首聘不参与。不要增加强制观看/拒绝就退出、Banner/插屏、付费、联网榜或云存档。不得删除测试、改黄金值、放宽安全门禁来造通过；不覆盖历史attempt和旧ZIP。

每完成一项回填总览真实证据与状态。无授权不提交/push，不对外上传/提审/发布；如缺上传授权，完成本地包后给用户按hash自行上传的步骤。存在外部阻塞时继续做不依赖它的工作，再一次报告缺项。

最后交付：修改摘要；每任务PASS/FAIL/BLOCKED/NOT_RUN；真实测试日志/截图；唯一推荐ZIP绝对路径+version+releaseId+用途+广告environment+size+SHA256+manifest；区分本地质量、静态包、平台运行、可提审四层结论。没有完成真实广告、设备或后台资格，绝不写“合格可提审/已经上线”。
```

### 20.14 本轮实时官方依据与适用边界

核查日期2026-11-04；仅表示当日文档可访问并支持对应设计，不表示本游戏账号/广告位/资质已通过。平台或宿主版本变化时接手agent在联调/提审前再次核对。

| 主题 | 官方来源 | 本项目如何使用 |
|---|---|---|
| 普通小游戏广告流程 | [广告总览](https://developer.taptap.cn/minigameapidoc/dev/tutorial/open-capabilities/ad/ad/) / [Dirichlet小游戏指南](https://ssp.dirichlet.cn/docs/mini-program-guide/) | 真实媒体/位、tap广告API；财务结算走对应联盟平台 |
| 防混用形态 | [广告接入指南适用范围](https://developer.taptap.cn/minigameapidoc/quick-start/mcp-guide/ad-integration-guide/) | H5/制造/星火指引不套普通小游戏；不承诺特定收入 |
| 生命周期/奖励 | [激励视频教程](https://developer.taptap.cn/minigameapidoc/dev/tutorial/open-capabilities/ad/rewarded-video-ad/) / [onLoad](https://developer.taptap.cn/minigameapidoc/dev/api/ad/RewardedVideoAd.onLoad/) / [onClose](https://developer.taptap.cn/minigameapidoc/dev/api/ad/RewardedVideoAd.onClose/) / [show](https://developer.taptap.cn/minigameapidoc/dev/api/ad/RewardedVideoAd.show/) | 加载完成才展示；close完整观看才领奖；不能主动关原生视频 |
| 错误处理 | [onError](https://developer.taptap.cn/minigameapidoc/dev/api/ad/RewardedVideoAd.onError/) | 保留1000—1008分类，1004无填充正常降级 |
| 广告体验 | [广告审核规范](https://developer.taptap.cn/minigameapidoc/tap-operation/operation-standards/minigame-ad-policy/) | 自愿、奖励清楚、首次启动60秒；不用广告卡住正常经营 |
| 上传/版本/资质 | [创建小游戏](https://developer.taptap.cn/minigameapidoc/quick-start/guide/creation-improvement/) / [审核规范](https://developer.taptap.cn/minigameapidoc/tap-operation/operation-standards/review-standards/) | 指定ZIP、登录、版本唯一/递增、资料与前置备案；大小冲突按后台核对 |
| 平台登录 | [小游戏登录态](https://developer.taptap.cn/minigameapidoc/dev/tutorial/open-capabilities/login-management/) | 真登录测试；需要换身份时服务端code2Session，密钥不入客户端 |
| 商店交付 | [物料要求](https://developer.taptap.cn/minigameapidoc/quick-start/guide/game-publish/material/) / [版本提审](https://developer.taptap.cn/minigameapidoc/quick-start/guide/game-publish/version/) | 真截图/录屏，开发包自测与提交审核/发布分别记录 |

**§20.13执行续记（2026-11-04）**：以下结果取代§20.14之前的“本轮最终结论”；保留此前设计记录和失败attempt作为历史证据。源码整改与新包构建已执行，平台验证仍未执行。

### 20.15 广告与上传包收口执行结果

| S | 状态 | 本轮结果与证据 | 未覆盖/阻塞 |
|---|---|---|---|
| S1 故障矩阵 | PARTIAL_PASS | R12 attempt-05 两个集成文件19/19通过，按§20.9行为映射A-01—A-10见`evidence/m3/TASK-M3-09-R12/attempt-05/fault-matrix.json`；A-01—A-07覆盖较完整，A-08—A-10部分覆盖 | A-06仅模拟延迟写；A-08缺广告/投资预览及关闭重开组合；A-09未模拟hide/show并发；A-10未覆盖用券写故障的完整财务链；OS强杀和平台异步未执行 |
| S2 广告Provider生命周期 | PASS（本地） | 全量测试中Provider用例通过；等待onLoad、失败重试、close完整观看、超时/迟到close隔离 | 原生Tap SDK真机加载、错误码和回调时序未验证 |
| S3 奖励事务与券 | PARTIAL_PASS | UTC+8与回拨防重逻辑、run绑定、成功发奖幂等和招聘消费事务已实现；广告隐私策略同为v2 | 3次请求/120秒冷却、旧券迁移/过期、未知发奖的用户恢复仍缺完整回归/闭环；详见代码与单测 |
| S4 生命周期和提示 | PARTIAL_PASS | 首次前台60秒门控、可跳过的提示与广告显示期间保留会话处理已实现 | OS后台时间、音频恢复、广告结束与退出竞态需真机验证 |
| S5 四视口视觉 | PARTIAL_PASS | R39 attempt-14，360×640、375×812、375×834、390×844；公司/部门/人才/排行/设置，28项检查全过并留截图 | 只覆盖主标签与设置，不含完整弹窗、长文本、错误态、安全区及原生设备矩阵 |
| S6 启动进度检查 | PASS（静态构建） | 新Creator Tap构建执行并生成本轮唯一包，启动资源门禁及包内引用校验通过 | 首屏进度与启动表现未在Tap设备运行核验 |
| S7 外部广告/隐私/登录/资格 | BLOCKED | 隐私版本2已与广告配置同源；广告environment为disabled、广告位ID留空 | 缺U14—U16、真实广告位、公开隐私URL/最终SDK披露、账号登录与资质/后台状态 |
| S8 整合故障/广告/财务/生命周期测试 | PARTIAL_PASS | `npm run check`：56文件通过、1跳过；464通过、1跳过；故障矩阵19/19通过 | 无真实广告、平台登录、设备生命周期或云测证据；S1/A-08缺口见上 |
| S9 最终构建与静态验收 | PASS（本地静态） | `m3-20261104-ad-final-r2` / `1.0.1` / diagnostic；ZIP 4,605,080字节、458项；SHA256 `13d355812caac237b41fd56ed0847c1aad809d532762a581639c42246baebda6`；Creator 3.8.8 doneMarker=true（exit36）；独立复核和skill preflight无FAIL | 版本后台唯一性、同包平台运行、提审条件未验证。不能标记READY_TO_REVIEW |

全量日志：`evidence/m3/build/m3-20261104-ad-final-r2/01/npm-check.log`。构建manifest、工程复核、skill preflight和分层门禁在同目录。唯一推荐包：`build/release/m3-20261104-ad-final-r2/01/game.zip`，只作为广告关闭的diagnostic开发自测包；不得将本地PASS解释为平台兼容或提审通过。ZIP内广告ID为空且环境disabled；不伪造广告位或广告验证结果。`platformRuntime=NOT_RUN`，`reviewReadiness=BLOCKED`，完整记录见`release-readiness.json`。

R39视觉矩阵是浏览器四视口的有限范围验收，不等同于Tap小游戏原生视口/安全区验收。A-06尚无物理强杀，A-08—A-10行为矩阵不完整。旧配置不一致包与全部失败attempt均保留，不得复用为推荐包。本次没有Git提交、上传、提审或发布。用户可在核实后台`1.0.1`版本唯一后自行上传上述同一SHA包做开发自测；后续平台验证必须继续记录同一SHA。只有同包平台验证与后台条件齐备后才能重新判定可提审。

### 20.16 本轮实现独立验收及TapTap MCP实查（2026-11-04）

用户要求验收§20开发成果，并说明正式上线、广告、排名与H5/Lua路线。本轮只检查/重放/记录，不修改生产实现、不重建、不上传。继续应用项目`skills/taptap-mini-game-publisher/SKILL.md`；实际调用新接入的TapTap MCP而非仅判断配置文件存在。

**已实际复跑：** `npm run check`得到56 files passed/1 skipped、464 tests passed/1 skipped；日志`evidence/acceptance-20261104-mcp/npm-check.log`。工程ZIP验证器返回`VERIFY_OK`：r2版本1.0.1、4,605,080bytes、458entries，SHA256=`13d355812caac237b41fd56ed0847c1aad809d532762a581639c42246baebda6`，与交接一致；复验写`package-recheck/`，未覆盖原manifest。skill preflight 3PASS/0FAIL/1WARN，WARN仍为未提供商店物料manifest。保留其diagnostic/广告disabled用途。

**浏览器独立重放：** `tools/e2e/visual-viewports.cjs`对现存`build/release-preview-20261104/web-mobile-final/web-mobile`产物四视口28检查PASS、0浏览器错误，报告`evidence/acceptance-20261104-mcp/visual-correct-root/visual-matrix-report.json`。已打开360×640排行图，旧金额/详情遮挡得到修复。主Tab和设置通过不意味着完整R39弹窗/错误态/键盘/原生安全区通过，更不证明Tap ZIP运行。第一次重放错把父目录`web-mobile-final`作为根而非其嵌套`web-mobile`，无index.html导致超时；失败报告保存在`visual/`，是本轮服务根目录错误，不归为产品启动缺陷；核实实际index后才换目录重试。测试服务已停止。

**本轮不予整体完成验收。** 通过项可接受，但源码审查和新探针确认以下启用前缺陷仍在。探针使用实际领域源码和从AppView抽取的原方法，不接真实广告/设备，脚本及结果：`evidence/acceptance-20261104-mcp/ad-review-probe.cjs`、`ad-review-probe.json`。

| ID / 优先级 | 触发与实际结果 | 最小修复与回归要求 |
|---|---|---|
| RV-01 P1（启用前阻断） | 60秒只限制`tickAdEligibility`的每日弹窗；招聘入口条件及`requestAdCoupon`未共享此门禁。新启动打开招聘可立即发请求。抽取原方法，未满60秒仍调用coordinator1次 | 建统一eligibility查询；每日/招聘/请求前都校验有效前台60秒。59.9秒调用不发SDK请求，60秒后主动点击才允许。教程/后台时长不计入 |
| RV-02 P1（启用前阻断） | `clockTick`没有activeAd暂停判断；coordinator活跃时仍调用advanceRealTime，原方法探针计1次。onShow特殊分支不足以让播放期间暂停经营；音频也缺统一广告原因 | 实现AD原因集合，在线/离线/音频统一；播前用户暂停不被恢复，广告区间不补成离线经营；按§20.6三条时间线及两种close/show顺序测试 |
| RV-03 P1 | begin存activeSession但无reservedDay，grant使用实际完成日viewFor。UTC+8 11月3日23:59开始、4日00:01完成/用券后，4日00:04仍不能领取4日额度；预留日计数未实现 | 持久化预留日，完成只增加该日grants；当日请求计数/冷却仍各自正确。修正dayKey：当前index转ISO前减8小时会把localDay字符串显示为前一天，虽v2主要依maxObservedDayIndex，迁移/审计不能错日期 |
| RV-04 P1 | v1券缺created元数据时永久available；注释说首次事务写稳定时间，但实际无迁移写入。探针一年后仍可用。现v2为领取后168小时，而§20要求D+7日00:00 UTC+8过期，边界也不一致 | 实现一次落盘、重启不延长的迁移，既有合法券不随意删除；统一自然日到期与UI规则，补边界。不要只改注释 |
| RV-05 P2 | 40次领用后couponCreatedAtMsById和couponRunIdById仍各40条，只有completedSessionIds裁成32；字典无清理，会持续增长 | 将活跃券元数据及必要回执一起有界裁剪，补120年档尺寸与反复领用读回；不能删除仍需幂等的有效结果 |
| RV-06 P1 | grant保存失败时coordinator保留activeSessionId，但没有用户侧核对后读取/重试finalize的完整恢复路径，requestAdCoupon只提示广告暂不可用。可能一直阻止新请求/重开；进程重启后持久化activeSession同样缺明确收尾 | 依§20.5保留同命令结果、进入存档核对并恢复原券；已确认有奖不能再看一次；无可信完成凭据的reserved不能凭空发券。补实际用券写故障后连续两月财务链 |
| RV-07 P1 | AppView onHide已取消旧的“立即取消整个会话”，但也没有连接Provider的loading取消。Provider单测直接cancelActive通过，不证明真实AppView退后台会调用；慢加载后仍可能在非前台show | 加载阶段取消/前台校验，showing不武断判失败；回前台不自动重播。测试必须经过AppView/平台事件链，不能只直调Provider |

已改善且本轮认可的范围：Provider等待onLoad、只移除自己的监听、明确isEnded发奖；只读查询不再创建adRewards；UTC+8最高已见日防一般回拨；run绑定/重开清券；持券使用不再依赖Provider可用；广告配置schema2且移除deviceVerified循环；隐私v2现在诚实说明disabled，**仍不是已核真实SDK的广告版政策**。这些不抵消上表未完成路径。Provider加载/展示异常与原生终态栅栏仍需真实SDK验证，不能单凭Fake保证时序。

R12本轮读回attempt-05清单，A-06真实强杀、A-08—A-10复合场景仍PARTIAL；没有因为19/19或464/464就改为整体DONE。R39全矩阵仍未关闭。结论维持：本地代码门禁PASS、有限Web流程PASS、诊断ZIP静态PASS；广告专项/全故障与视觉PARTIAL；平台运行NOT_RUN；可提审BLOCKED。

### 20.17 MCP授权、广告入口及上线前用户需准备的内容

本轮实际调用：`get_ads_integration_workflow`、`get_current_app_info`、`check_environment`。返回：MCP可用，production环境，本项目workspace路径正确；**MAC Token未配置、尚未选应用**。只查询连接状态，没有创建游戏、修改后台或索取token。未调用有“已选应用”前提的check_ads_status，因此本轮无法判断该游戏广告已开通/未开通，更不能取得真实可用广告位。

后续流程：用户在官方扫码页面完成OAuth→工具确认授权→list_developers_and_apps→展示列表请用户确认《我是CEO》及正确主体/应用→select_app→get_current_app_info复核。安装MCP不等于授权；不能把环境里受保护的签名器ClientSecret当成游戏已登录。

**有一处工具/官网范围差异须保留：** 当前MCP广告工具描述“小游戏/H5”，但当日[官方MCP安装指南](https://developer.taptap.cn/minigameapidoc/quick-start/mcp-guide/mcp-setup/)仍明确仅H5，普通引擎小游戏支持开发中；`prepare_h5_upload`本身要求含index.html的H5输出目录。本项目正式包为game.js/game.json普通Tap小游戏，不使用upload_h5_game上传game.zip，不因安装MCP而迁移发行类型。可用MCP做只读账号查询与适用范围确认；真实普通小游戏接入仍以对应官方API/Dirichlet与后台能力为准。不能用MCP的H5位替换普通小游戏位而不核归属。

适用MCP广告流程确认后：先check_ads_status；status=1且本次当前选中应用返回有效space_id，才get_ad_integration_guide。0按返回链接开通，完成后由用户明确要求刷新一次；2停止接入。**这条MCP路径的广告位只从当前实时查询获得，不向用户索要手抄ID、不给示例ID、不复用其他应用ID。** 旧§20.7“提供测试/正式ID”的交接描述在适用此MCP工作流时改为“提供授权与选应用确认，由工具读取”，不再要求用户贴ID。若平台类型不兼容，则记NEEDS_VERIFICATION并走普通小游戏官方后台/工单确认，不伪称MCP已解决。

用户实际需要准备：

| 项目 | 用户要做/提供 | 可由agent继续完成 |
|---|---|---|
| 官方账号授权与游戏选择 | 官方页面扫码；确认正确开发者主体与游戏，不发送密码/token | 授权后读取应用/状态、核接口适用范围 |
| 普通小游戏后台状态 | 现游戏形态、当前版本/审核中版本、前置备案/主体/权属审核状态（脱敏截图或已授权只读查询） | 形成差异清单；不能自己认定资质豁免 |
| 广告开通 | 在正确普通小游戏对应渠道完成媒体/激励位审核及结算主体；提供“已完善/待审核”等状态 | 兼容的MCP读取状态/位；源码修复、配置、失败兜底、本地验收 |
| 隐私资料 | 正式公开政策URL、实际广告模块/联盟的数据处理资料、主体/联系方式确认 | 同源生成正文、递增版本、重新同意；资料缺失保持disabled |
| 设备与测试入口 | 至少一台可扫码TapTap设备、客户端/OS/机型、测试账号可访问权限；原失败机型/目标OS条件 | 同hash登录/广告/存档/生命周期操作和脱敏证据；缺设备如实NOT_RUN |
| 商店与资格资料 | 图标、横/方宣传图、至少3真截图和1真录屏、简介、版权/权属及后台要求材料 | 清单/尺寸/内容核验，不能把概念图当实机图 |
| 上线动作 | 最后确认待提审版本、地区/目标OS及操作范围 | 在已有明确授权内执行对应操作并读回回执；本次没有上传/提审/发布 |

最短路径是先修RV-01—RV-07及R12/R39缺项，同时由用户完成授权/后台资料；再核版本唯一→新候选包→上传开发版本扫码→同hash真广告/登录/存档/生命周期与设备云测→资质/隐私/物料齐备→授权提审/上线。普通小游戏前置备案见[官方办理流程](https://developer.taptap.cn/minigameapidoc/quick-start/guide/pre-filing/)，按后台真实判断依据提供材料，不在聊天索取证件/银行卡原件。

### 20.18 排名是否联网、H5/Lua是什么以及本项目推荐路线

**当前排行榜无需联网。** 实现位于`assets/core/simulation/leaderboard.ts`：固定配置种子生成12家模拟企业，和玩家一起计算资产/经营年限排名，年结时本地推进。没有为这个榜上传玩家分数，也没有获取其他真实玩家；UI标“本地模拟排行，非真实联网排名”，须保持诚实。平台登录、下载首次资源和看广告依赖网络，是其它独立需求，不应因此宣称整个游戏永远无网络。

如将来明确要求真实玩家榜：增加平台身份、榜单配置/ID、提交与查询、断网缓存/重试、隐私披露和异常分数规则；读取真实榜和提交分数需要联网，但不需要把经营过程改成实时多人游戏，也不必因此自建实时联机服务器。若需强防作弊/高价值奖励，纯客户端分数不可靠，需要另设可信校验策略。云存档也不是“有榜单必接”。[官方排行榜指南](https://developer.taptap.cn/minigameapidoc/dev/tutorial/open-capabilities/leaderboard-tutorial/)提供相应提交/查询能力。本轮未授权改需求，保留本地榜，不创建平台排行榜。

当前路线由源码和产物确定：**Cocos Creator3.8.8 + TypeScript，编译JavaScript，经Tap适配插件生成普通Tap小游戏ZIP**；根入口game.js/game.json。另有web-mobile/index.html用于浏览器预览测试，但当前正式交付路线不是平台托管H5包。没有Lua业务工程。H5是Web运行/发行形态，Lua是编程语言，两者不是同一层级的二选一“包格式”。

| 路线 | 对本游戏的含义 | 建议 |
|---|---|---|
| 当前Cocos普通Tap小游戏 | 复用现有经营/财务/存档/测试与官方3.8插件转换链；平台宿主运行 | **继续采用，完成验收和平台适配** |
| 平台托管H5 | 可以研究Cocos Web输出或重做Web UI，但需另验存储、登录/广告桥、音频/生命周期、移动布局与上传方式 | 适合另行做浏览器分发试验；不能把已有game.zip改名当H5包；本轮不迁移 |
| Lua/UrhoX（若指TapTap制造） | 另一套引擎、脚本和发布流程，现有TS代码/界面/适配层需要迁移或重写 | 不为使用制造MCP而迁移现有成熟工程；除非重新立项明确选择制造生态 |

这是基于本项目已完成工程的迁移成本和验收风险给出的建议，不是宣称H5或Lua不能做经营游戏。两个路线都能表达经营玩法；现在影响上线的是功能/故障/合规/真机闭环，不是更换语言。官方[Cocos引擎适配](https://developer.taptap.cn/minigameapidoc/dev/engine/Cocos-Laya-Egret/)明确该普通小游戏JavaScript环境与浏览器不同；[官方形态划分](https://developer.taptap.cn/agents/)区分Tap小游戏/H5/制造，[制造skill站](https://maker.taptap.cn/skills/)中的Lua/UrhoX属于另一生态。

## 21. 玩家云备份、跨设备恢复与真实玩家榜专项设计（2026-11-04）

本节是用户最新范围变更的完整设计交接，不是功能完成报告。本轮已读取现有存档、登录、平台类型、服务端骨架及排行榜源码，调用TapTap MCP的云存档/排行榜指南和当前应用/环境查询，并核对官方API。未实现下面的生产模块，未创建远端榜单/云档，未上传或部署服务。

### 21.1 需求确认与推荐结论

用户明确回答两项：① **只需玩家备份和跨设备恢复进度，不需要运营后台查询每位玩家**；② **增加真实玩家榜，并保留本地模拟榜**。本节对应DEC-042—044，覆盖旧版“一期不做云存档、真实联网榜”的限定；其它经营规则不变。

结论：建议将云备份加入本次正式发布的产品范围。原因是本游戏经营周期长，本地存档不能覆盖换手机、清缓存或重装后的恢复需求；不是因为“有排行就一定要云存档”。真实榜只需要玩家身份与少量分数，不负责保存完整游戏进度；云备份保存该玩家自己的完整恢复快照，不需要一个供运营查看所有玩家的数据库。

| 数据层 | 保存内容 | 保存位置/访问方 | 当前状态 |
|---|---|---|---|
| 本地经营状态 | 公司、CEO、员工、部门、财务、年月、RNG、幂等命令等 | 现有GameStore+SaveRepository双槽，本机 | 已实现，R12仍有补验项 |
| 玩家云备份 | 可完整恢复的已提交快照及同步关系元数据 | TapTap当前玩家的云存档空间，平台负责对应账号访问 | 待实现/待平台核验 |
| 真实榜 | 当前公司可排名资产、完成经营年数 | TapTap榜单服务；公开范围只含平台榜单必要展示 | 待实现/待创建榜单 |
| 本地模拟榜 | 12家模拟企业与本玩家比较 | 本机纯算法 | 保留，不能伪装成真实玩家 |
| 运营全量玩家后台 | 不建设、不上传各玩家全量快照到自建后台 | 不适用 | 明确不在本轮范围 |

首版策略：**本地先可靠落盘，玩家开启后异步云备份；断网可继续经营；换设备先读云档再创建新公司；发现分叉由玩家选择整份进度，不合并现金/员工；真实榜异步更新，不以实时在线竞争承诺。** 推荐先单设备经营、退出前确认已备份，再在另一台继续；同时离线玩两台不能自动无损合成一份进度。

### 21.2 平台依据、已核能力与必须补核的缺口

本轮MCP返回未授权、未选应用；指南可读，账号能力/配额不可据此判定已开通。工程是Cocos3.8.8普通Tap小游戏，继续使用宿主`tap`全局，不安装H5/APK广告或云SDK npm包。MCP中有H5上传工具并不意味着可上传普通game.zip。

官方云API已核：`tap.getCloudSaveManager()`、`tap.getFileSystemManager()`；`createArchive/updateArchive/getArchiveList/getArchiveData`，由本地`tapfile://`文件上传，返回`uuid/fileId`，更新后uuid不变、fileId变化。create与update合并限制一分钟最多一次，单档上限10MB；项目仍保持业务槽500000bytes，不使用10MB上限放纵存档膨胀。name≤60bytes、不为空且不含汉字；summary≤500bytes，extra≤1000bytes；playtime为实际游戏时长秒，不是当前epoch秒。

本地插件d.ts只提供部分字段，缺删除接口/部分返回详情；允许在项目适配器里补**已由官方核实的窄类型**，不直接修改引擎插件或用any掩盖差异。官方教程部分API链接404，本轮已从正确`dev/api/open-api/cloudsave/.../`路径核实create/update/list/data；delete入口在当前可读教程/指南存在，但详细页面读取失败，删除方法参数和实际可用性必须补核。不要编造SDK参数。

| 缺口 | 放行前取得什么 | 缺失时怎么做 |
|---|---|---|
| 普通小游戏基础库/云服务权限 | 当前目标客户端API可用、创建/列表/下载/删除实测；create页面注明基础库2.0.0起支持 | feature detection降级本地，真实云功能标BLOCKED |
| 云档数量/总空间/测试隔离 | 当前游戏当前玩家的可用数量、是否至少4个槽位、是否有沙箱/测试白名单 | 不假定无限；空间不足不删未知/冲突档，暂停上传并保留本地 |
| 账户隔离/切换 | 同设备A/B账号、两设备同账号实际读取范围，是否有可信稳定账号标识或账户变化事件 | 未核不自动绑定本机旧档到空的新账号；按§21.6显式确认 |
| 云端并发条件写 | 是否有官方明确CAS/etag/服务器版本前置条件 | 现已读API无expectedFileId条件写；不能把fileId比较伪称原子CAS |
| 真实榜latest/0分/范围 | SDK及后台是否支持latest、降分覆盖/0值、数值精度、测试隔离、公开展示方式 | 不支持就暂停该榜，不能偷偷改成best导致重开无法清零 |
| 身份/登录 | 平台管理器是否直接按Tap账号鉴权；必要登录条件/会话恢复 | 当前30天本地标记不视为稳定用户ID；不要用sessionToken作为云档owner |

### 21.3 现有工程需要调整的模块与边界

以下新增路径均为**待实现设计**，不能在交接中冒称已存在。结构可按现有组织微调，职责必须保留。

| 模块 | 现有入口 | 变更/新增建议 | 验收重点 |
|---|---|---|---|
| 云适配 | `ITapPlatform.ts`、`TapPlatform.ts`、`CocosPlatform.ts` | `core/platform/ICloudSaveProvider.ts`、`TapCloudSaveProvider.ts`，窄类型封装文件与云API | 领域不直接调用tap；无API/断网/限流降级 |
| 同步模型 | `SaveTypes/SaveCodec/SaveMigration/stateIntegrity` | `core/persistence/CloudSaveTypes.ts`、`CloudSaveCodec.ts` | 独立云协议版本、完整校验、旧档兼容、大小限制 |
| 同步协调 | GameFacade/GameStore持久化流程 | `core/application/CloudSyncService.ts`、`scripts/cloud/CloudSyncCoordinator.ts` | 只备份成功提交快照；单飞、限频、分叉/未知结果恢复 |
| 导入事务 | GameStore/SaveRepository journal与墓碑 | 受控`importCloudCheckpoint`命令、必要journal扩展及回归 | 下载不等于直接覆盖内存；成功落盘才换状态 |
| 登录/绑定 | AuthService、现有本地AuthSession | `AccountBindingService.ts`或等价模块 | 稳定账号归属与session凭据分离，不能跨账号自动外发 |
| 平台榜 | 现有本地`simulation/leaderboard.ts` | `ILeaderboardProvider.ts`、`TapLeaderboardProvider.ts`、`LeaderboardSyncService.ts` | 不改本地榜算法；分数来自同一已提交状态 |
| UI | AppView设置、排行和启动路由 | 云备份状态/操作、恢复选择、冲突面板；排行内切“本地模拟/真实玩家” | 四主Tab不增加，等待不锁死经营，危险操作确认 |
| 配置 | resources/config/runtime、ads配置 | `cloud.config.json`、`leaderboards.config.json`及loader | 缺配置默认关闭，ID/环境/政策版本匹配 |
| 隐私/构建 | policyText/JSON/docs、verify/enrich工具 | 实际外发描述、重新同意、包内配置门禁及能力清单 | 不再声明所有经营数据永远只存本机 |
| 测试 | 原R12/广告/排行测试 | FakeCloud/FakeLeaderboard、账户/同步/冲突/重开/离线集成、双设备验收 | 旧门禁不删，新测试有独立结果 |

复用当前最小server的原则：用户不需要运营后台，本专项**默认不部署经营数据服务器**。平台云存档和平台榜足够满足目标时不买数据库/对象存储。当前`server/auth-server.mjs`只是可选code2Session骨架，URL/header仍待官方联调，不可直接当生产认证服务。只有平台能力实测证明必须自有身份服务时，再提出范围最小的身份交换方案；不在本次设计授权下自动购买/部署服务。

### 21.4 保存范围、数据最小化和协议

云端应保存“足以恢复经营”的状态，不是每秒事件日志。直接复用最新**已确认提交的**SaveEnvelope及现有校验/迁移，绝不从UI文本反推现金、从当前员工伪造历史年报。

必须包含：runId、resetGeneration、phase、seed/RNG、initializedCapital、公司/CEO/员工/部门/策略/offer、年度和月进度、现金/资产/财务账及保留年报、目标/教程、幂等command、离线结算水位和余量、已经确定的广告券/额度/消费回执。缺任何影响下一次结算或扣款的数据都可能造成重复注资、重复招聘或重复离线收益。

不上传：OAuth/MCP凭据、平台login code/session_key、AuthService的token、账号密码、设备通讯录/定位、诊断堆栈中的敏感内容、音频资源、本机文件路径。音量/画面偏好默认留在设备，不强制跨设备覆盖；若onboarding属于游戏进度可同步，不把政策同意记录当作已在另一台完成本机告知。原生广告正在播放/显示/尚无确定结果的session不作为可恢复奖励，先按§20恢复闸门解决再备份。

建议云传输协议：

```ts
interface CloudCheckpointV1 {
  protocolVersion: 1;
  appId: string;                  // 公开游戏ID，须与当前构建一致
  environment: 'test' | 'production';
  cloudProfileId: string;         // 本游戏逻辑进度ID，不是平台账号凭证
  checkpointId: string;           // 安全随机UUID/足够唯一ID
  parentCheckpointIds: string[];  // 通常1个；冲突解决后最多2个
  resetEpoch: { id: string; parentId: string | null; closedRunId: string | null };
  deviceInstanceId: string;       // 应用随机安装ID，不读取硬件指纹
  localRevision: number;          // 只作本设备诊断，不能跨设备比较大小
  capturedAtMs: number;           // 设备时间，仅供展示/排查
  snapshot: SaveEnvelope;         // 现有纯业务已提交信封
  summary: { industry: string | null; phase: string; year: number; month: number;
    cashYuan: number; assetsYuan: number; employeeCount: number };
  checksum: string;               // 规范序列化校验；不是服务器签名
}
```

checkpointId与归属不能由现金/时间生成；parent数≤2、协议字符串/ID长度/整数均校验。summary从snapshot生成再比对，不能只信平台extra里的摘要。metadata name用`ceo_<32位ID>`，ASCII且<60bytes；summary建议只写“第X年X月、员工N人”，不默认把CEO姓名/完整公司名写进平台列表；extra可放protocol/checkpoint/parent/resetEpoch的短索引，不放完整存档/令牌。summary等平台字段长度按UTF-8字节检查。

CloudSaveCodec先检查下载大小/JSON层数与类型→app/environment/protocol→checksum→snapshot信封checksum→schema迁移→stateIntegrity/金额安全整数/phase/引用一致→summary重算。CRC只防意外损坏，不证明防篡改；不把有checksum的客户端状态当服务器认证资产。业务snapshot保持500000bytes门槛，云元数据建议≤16KiB，整个传输包建议≤550000bytes，平台10MB是硬上限不是目标。

版本注意：当前`SaveCodec.ts`的GAME_VERSION仍是0.1.0，包游戏版本已1.0.1。先分开定义saveSchemaVersion、cloudProtocolVersion、economy configVersion与release gameVersion，后者从真实构建profile注入或显式传入；不能因为显示版本不一致拒绝全部旧存档。云协议新版本不要求粗暴把所有本地schema升到2；可选sync元数据向后兼容，必须有测试。未来schema高于当前客户端时提示升级，不自动新建/覆盖云档。

### 21.5 同步模式：本地先提交、限频、不可变检查点

官方API已读参数没有云端CAS，不设计“读fileId相同后update就绝不会冲突”的假保证。首选**新建不可变检查点**而非反复update同一个文件：每次同步create一个新checkpoint，不覆盖另一设备的checkpoint；下载/恢复使用固定uuid+fileId。首版不承诺并行多设备实时合并，优先保证冲突发生后两份仍可选。

这是项目工程方案，不是平台要求。必须先通过实际账号验证数量配额与delete能力。基线保留同一进度最近3个已验证检查点及所有未解决分支，上传时需至少1个可用位置；**至少4位置是本方案能力前置**，不是声称平台保证4槽。若不足，停在能力评审，提出“单设备手动备份的受限模式”或最小协调服务备选，不能擅自改为无保护覆盖同一云档并宣称等价安全。

同步触发与限频：

1. 本地关键命令/月结/年结成功commit后标dirty，上传的是该提交的不可变副本，不hold本地写锁等待网络。
2. 自动备份基线每120秒最多调度一次有变化快照，且所有create/update尝试至少间隔65000ms；实际后台限流返回后退避更久。120/65秒为工程参数，官方每分钟1次是外部限制；手动“立即备份”也不能绕过。
3. 首次开启备份、年结、关闭重开、重要招聘/投资只提升队列优先级，不新增并发请求。队列最多“正在上传1份+待传最新1份”，合并中间dirty，不积累每秒档。
4. onHide先确保已有本地提交，若系统给机会且限频允许可以开始上传，但绝不承诺后台一定完成；退出前显示“本地已保存/云端待同步”，用户换设备前可等“云端备份已确认”。
5. 手动备份若本地无变化且云已确认，显示无需备份，不浪费配额。读取列表/下载也经单一云请求串行器，处理400007，不能与create互相抢。
6. 遇网络/100级初始化/400001等失败，不清dirty、不改本地已保存事实、不toast“已上云”；下一次联网/前台/用户操作按退避重试。不能读取失败就当云不存在。

上传算法：检查已同意/启用/账户归属已确认/Store ready/无AD或reset/import冲突→从已确认提交导出snapshot与父checkpoint→本地文件写到`tap.env.USER_DATA_PATH`专用目录→回读校验字节和checksum→读取云列表检查父/分支/容量→createArchive→读取该uuid/fileId并下载校验checkpointId和内容→最后记录“云已确认”。上传过程中本地又前进，只ack已上传版本，dirty保持，后续备份最新。

create超时或回调未知：保留opId/checkpointId和原文件，不生成新ID盲目重传；下次list按checkpointId/extra找本次结果并下载核验。找到则ack原操作；列表暂不可读保持unknown，不假装不存在。若重复同checkpoint多条，校验相同才去重，多条内容不同视冲突。固定加载超时不等于原生写已结束，旧回调带session/account/run epoch后才能作用。

回收：只删除本应用、本环境、本逻辑进度、已经校验且明确被后代替代的旧祖先，至少保留当前与上一份有效备份；不删未合并head/不认识的档/更高协议档/仍在使用的uuid。删除前再次list，确认目标不是新head；在平台不支持条件删除的情况下，仅删除不可变旧uuid，不能按名字删“当前槽”。配额满而无安全可删项时停止上传、提示冲突/空间问题，保留本地；不要为“成功同步”删掉唯一可恢复副本。首次启用自动保留/清理规则要明确告知用户，当前设计文档不授权本轮实际删除远端数据。

### 21.6 玩家身份、账号隔离、第一次绑定

平台云空间预期按当前平台账号隔离，但必须用真实A/B账号验证。`cloudProfileId`是本游戏进度标识，不能当鉴权身份；`tap.login`返回的一次性code和现有`tap-platform-session`标记都不能作为玩家主键。不得读取硬件IMEI/IDFA、不得要求昵称头像权限来凑身份。

优先使用平台提供并已核实的最小不透明稳定账号/作用域标识（若有）。目前工程未确认有无需额外身份服务即可获得的该字段，不能猜一个`getCurrentUserId()`。若云管理器自己按账号鉴权，云存储恢复可直接使用平台权限，不为此自行部署经营数据库。

无稳定标识时采取保守绑定流程：每次冷启/回前台需要同步时重新核平台会话和云列表；本机进度有cloudProfileId且云空间找到同profile，只能说明其进度匹配，仍以平台作用域为访问边界。当前云空间为空但本机有旧绑定，不自动把旧玩家进度上传到当前账户，显示“当前账号没有匹配的云备份；继续本地/确认将本机进度绑定当前账号/切换账号后重试”，绑定需二次确认。云里有另一profile则展示选择，不把它自动覆盖为本机profile。

同设备账号切换：先停云队列/榜单队列，递增accountSessionEpoch并取消可取消读取；在途写回调按旧epoch丢弃UI/ack，随后查询真实远端结果。未解决旧原生写时不得立刻以同Provider新账号发写。按验证后的绑定键隔离本地云控制元数据；旧本地业务快照保留但不外发，新账号不得默默继承旧券/公司。没有可靠账号变化检测时每次前台采用保守重新确认/匹配策略，并在设备矩阵验证；**账户隔离未验证是云自动上传启用阻断项**。

第一次开启：解释上传数据/恢复用途，用户选择开启→当前政策同意→平台登录→list。空云+本地合法档→确认绑定并create；云有档+本地未创建公司→优先显示恢复摘要，别先自动注入30万创建一份可上传新局；本地已有进度+云有进度→关系判定/冲突选择。对“空云”和“查询失败/登录失败/没有权限”使用不同状态。读失败可以继续本地，但禁止初始化云档覆盖。

### 21.7 下载恢复与本地事务：禁止直接替换current

推荐Provider自定义接口（不是官方API签名）：`capabilities/list/download/create/delete`；每个调用返回明确`ok/missing/unavailable/unknown/unsupported`类别及脱敏错误。详细官方callback→Promise包装只在适配层，完成一次、超时/迟到事件有epoch保护。

恢复步骤：

1. 用户选定或根据无歧义关系确定checkpoint，下载到与上传文件不同的临时路径；绝不直接写`ceo/save/a/b/active`。
2. 完成§21.4全校验、账户/环境检查、关闭公司墓碑屏障检查。保存导入前**最后确认的本地档**作为本地恢复点；空间不足则不导入，不先删原档。
3. 暂停经营/广告请求/新确认命令，进入CLOUD_IMPORT原因；拿Store变更锁后重新校验expectedRunId、expectedLocalRevision、accountEpoch、选中云checkpoint/fileId未变及尚无未决物理写。变化则退出并重新展示，不复用旧确认。
4. 新增受控`GameStore.importCloudCheckpoint`及Facade命令；沿现有journal/双槽/指针回读提交，成功才发布内存和UI。导入同run与不同run都允许经明确定义路径，但**不使用关闭公司factory假装导入**，也不把远端localRevision直接当成本机下一revision。
5. 本机revision保持本机协议连续，远端revision仅留在同步来源元数据。导入checkpointId、父关系和防重复导入标识须与业务snapshot在同一个本地事务记录；可新增optional `syncLineage`到GameState并兼容旧档，或扩展journal绑定sidecar。不能“业务已换、同步来源还在旧态”而无恢复机制。
6. 远端上传ack/本地同步时间等纯控制字段不能导致无穷“ack写盘→又dirty上传”；提交事件标source=`gameplay/cloud-import/cloud-ack`，dirty摘要排除纯ack字段。reset/导入改变实际业务需要标dirty。
7. 成功导入后只执行一次既有离线结算，使用导入snapshot.lastWallClockMs及offlineRemainderMs，不替换成下载开始时间，也不先结本地再将收益加进云。保存结果确认成功再消费水位；恢复后两月仍可继续写，防再现调岗undefined卡时钟。
8. 崩溃恢复重读journal与lastImportedCheckpointId，不重复注资、招聘、消券或离线收益。失败保留原档并显示可重试；更高版本/损坏云档不自动新局覆盖。

本地可选syncLineage仅含profile/checkpoint/branch/resetEpoch等非凭据；导出云包时剔除本机文件路径、account token及设备专有ack。云import必须与现有R12未知提交闸门共用互斥，不另开第二套写状态通道。

### 21.8 冲突判定：整份选择与两设备离线

不比较“现金更高/年份更大/设备时间更新/localRevision更大”来自动取胜：投资会降低现金，重开会降低年份，设备会改时钟，两个设备的revision互不连续。

定义head为没有已知有效后继的checkpoint；从parentCheckpointIds判断同一分支的已知前后关系。已删祖先/超出保留链导致关系无法证明时，按冲突处理，不猜。

| 关系 | 处理 |
|---|---|
| 本地未创建公司，只有一个合法云head | 显示恢复摘要，用户确认后导入；不先创建新公司 |
| 本地和云都无档且查询明确成功 | 用户正常创建公司；完成后可首次备份 |
| 相同checkpoint且本地业务无修改 | 无需导入，继续本地；不要重复离线补偿 |
| 本地从云head派生且只有本机后续修改、远端未变化 | 上传本地新checkpoint，parent=原云head |
| 云head是本地基线已知后代，本地无未同步业务修改 | 可提示有新备份并导入；自动恢复需用户已选择此偏好且账户明确 |
| 本地和云都从同基线继续经营 | 真冲突，两份整档摘要，玩家选择；不合并员工、现金、RNG或账本 |
| 多个云head/不同profile/不同reset分支 | 冲突面板或账号绑定面板；未选前不上传覆盖、不提交真实榜 |
| 云query超时/损坏/高版本 | 保留本地，云状态未知/需更新；禁止按“空云”首次上传 |

冲突面板显示“本机进度/云端进度”、公司行业、年月、现金/资产/员工、设备匿名标签、上次备份时间、是否有未同步修改；时间只供参考。选择前明确“将以这一份继续，另一份保留为恢复备份；不同设备进度不能合并”。取消可离线继续，但标为冲突未解并停止自动云写/榜单提交。选择后在同一决议checkpoint记录两个parent（当有两份已确认云分支时），本地选择也需先形成可恢复快照，不伪造远端不存在的parent。

不可变create避免两台设备覆盖彼此的文件，但不提供强一致单主锁。两台同时从共同head创建会产生两个head：保留两份、下次查询发现冲突、停止继续自动上传直至决议。不能声称“同步前再查一次就绝无竞态”；没有CAS/协调服务，不能保证两台同时离线经营完全无分叉。产品提示“换设备前确认云备份成功”，不因此强制玩家全程联网。

### 21.9 关闭公司、清除云备份、旧设备与旧run复活

**关闭公司仍是清除本轮经营并重新创业，不是账号注销。** 需要在原二次确认中补一句“开启云备份时，该重开状态将在联网后同步；另一设备在同步前可能仍显示旧备份”。不保留已关闭公司作为一键恢复的可选当前进度。

在现有本地reset事务中建立新的resetEpoch随机ID，并记录parent epoch和closedRunId；它与本机resetGeneration并存，后者不能跨设备当全局时间。优先上传新epoch的creating/新局检查点；只有确认云端新epoch后才清理安全旧祖先。新检查点持续携带当前epoch与必要关闭屏障，避免GC把唯一墓碑删掉。不同设备同一epoch各自重开会产生兄弟epoch，必须冲突处理，不能按两边恰好都是generation=1判相同。

旧设备返回时，先查询云head/reset屏障。云端明确已关闭当前旧run则阻止该旧run自动写回，提示恢复新的创业进度；不能只因旧设备localRevision更高就复活。关系链超出已保留信息时标待选择，不自动以未知旧run覆盖。SDKcreate未决与新reset交错时，不发新上传，先查询结果再判断哪个epoch合法。

离线重开不能立即修改云，UI必须区分“本机已重开，云端待同步”；若玩家清缓存/卸载前未传新epoch，新设备可能只看到旧云档，这在无网络情况下无法凭空避免，不能承诺离线全局删档即刻生效。用户重新联网后优先同步reset，再提交真实榜0分，旧run队列丢弃。

另设“删除云备份”而非混用“关闭公司”：需要本人主动二次确认，说明只删云端是否保留本地；默认保留本地并**同时关闭自动备份**，否则下一次tick又上传等于没删。先列出当前账号本应用允许删除范围，不删其它应用/环境；成功回读列表确认，失败/未知不写“已删除”。清除本地+云端必须单独更强确认，不在本轮后台代操作。平台允许的删除/保留期限与隐私承诺一致；未来账号注销按平台法定流程处理，不拿重开冒充。

### 21.10 真实玩家榜：榜单定义、隐私与同步顺序

保留原本地模拟资产/年限算法和入口，在排行Tab内部增加“本地模拟 / 真实玩家”切换，不加第五个主Tab。默认先显示可用的本地榜，首次打开真实榜说明联网与公开分数；纯离线/未同意公开提交时仍可玩和看模拟榜。

以下为**首版BASELINE**，实现者必须在文案、配置、测试和后台设置一致执行；这次用户确认了真实榜范围，未逐项确认榜周期/历史最高等细则，不得宣传未经确认的额外奖励：

| 榜 | 分数 | 后台建议 | 重开/恢复 |
|---|---|---|---|
| 当前公司资产榜 | 现金+业务资产账面，整数元；为兼容非负数值榜拟按max(0,实际总资产)提交，UI说明负资产按0排名，详情仍显示真实值 | numeric、desc、always、**latest** | 关闭公司提交0；新局按当前资产更新；恢复较旧档可下降，不保留旧公司最高值 |
| 当前公司经营年限榜 | max(0,gameYear-1)，即完成年度，不能用已裁剪annualReports.length | numeric、desc、always、**latest** | 重开提交0；不把生命周期累计年数冒充当前公司经营年限 |

latest是项目选择，不能照抄官方教程的“推荐best”。若后台/SDK实际不支持latest/降分覆盖/0值，阻断当前公司榜正式启用并提出差异方案，不能偷偷换历史最高榜。平台同分次序由平台决定，首版不承诺与本地榜的稳定tie次序相同；不要把多字段塞成大整数分数以免溢出。若后续决定历史最佳榜，必须作为新的明确规则，与“关闭公司清本轮排名”区分，不能由agent自行替换。

真实榜只上传boardId与分数，不上传现金明细、员工名单、CEO姓名或公司全档；公开展示优先平台标准UI与平台允许的昵称/头像，不要求额外获取朋友关系，不做好友榜。自定义公司名称作为用户输入如要公开展示，需要另做内容审核/投诉处理，此次不上传它。不能用12个bot灌进真实榜伪装活跃用户。

Provider先feature detect `tap.getLeaderboardManager()`，适配submitScores/openLeaderboard/loadCurrentPlayerLeaderboardScore及必要list。平台原生UI优先降低自绘头像/分页和身份权限成本；读取数据的返回类型以官方实际结构，不能从名字猜字段。MCP指南中的创建例子用旧数字枚举，而工具schema可能是`calc_type:'latest'`等字符串；外部操作使用当前工具schema，不能照抄过时例子。

提交协调：

1. 仅已同意公开提交、已确认当前平台账号、当前profile无冲突、Store ready时可入队；只读看榜不修改本地经营revision/RNG。
2. 从同一已提交snapshot计算两个score；基线在该snapshot云备份确认后再提交，避免“榜上进度存在但玩家无法恢复”。云备份不启用的玩家仍可本地经营，但当前正式真实榜参与需明确开启进度备份，以保证换设备源一致；这是本项目一致性设计BASELINE，不是TapTap强制要求，也不是收费门槛。未同意外发仍可使用全部既有本地经营与模拟榜。
3. 成功云确认/年结/月结/关闭公司标记待更新，合并队列只保留本账号当前run最新目标。工程发送最短间隔60秒；平台实际限额更严则按平台执行，不把60秒说成官方榜单限流值。
4. 提交携带本地调度epoch/accountBinding/runId/checkpointId以识别响应（这些不是随意新增SDK参数）；回调旧run/旧账号不得更新UI、重发旧分。平台未支持条件写，不能防已经被服务端接收的旧请求晚生效；新目标再次核对并最终收敛，强一致需另立服务端方案。
5. 两榜批量提交不假定原子；记录每榜成功/失败，读取我方分数核对，部分失败只重试未确认目标。超时未知先查询本人榜记录，不立即把相同增量反复sum。必须用latest，而非sum反复累加资产。
6. 关闭公司先可靠提交本地reset，优先备份新epoch，再发0；离线期间平台旧值可能仍显示，提示“排名更新待联网”，不能声称已从远端删除。0值归零不等于物理删除平台账号/历史缓存，不能宣传成彻底删掉平台排名记录。若平台不接受0且无删除分数能力，或产品要求无记录但平台无法提供，属于阻断项；不臆造deleteScore API。
7. 页面显示“上次更新/待同步/无法联网”，远端榜非实时；5分钟缓存为工程基线，用户手动刷新走节流，断网可显示明确标注的旧榜。500001等错误按配置检查，不反复创建新榜。

### 21.11 广告券、离线挂机与云恢复的交叉规则

本节不能让云档变成广告套利/重复离线收益通道。先关闭§20.16 RV-01—RV-07，再将广告状态纳入云传输；同一run的已确认券/消费command/日额度和最高已见日需要一起备份。

1. 上传/导入过程中不播放广告，不导入active原生session，也不凭云里reserved状态补发奖励。grant未知先按R12恢复真实提交，再生成可上传checkpoint。
2. 云恢复不重置“今日已提示/已领取”；当前设备已有更高的日水位/已消费回执不能因旧云档回退而降低。允许对**已确认不可逆广告权益记录**做保守去重/并集或max水位；这不是合并两份经济快照，不相加grants造成误扣，也不把没有可信完成的会话当成功。
3. 恢复旧档后禁止把已在本机确认消费的同券再次置为available；单command录用和消费仍原子。一旦有未同步的另一设备分支，选择进度前保留其消费证据，UI说明以保守权益记录防重复。
4. 两台完全离线、各有同券副本的同时消费，用纯客户端云备份**不能强保证全局至多一次**；首版只允许小额本地招聘费权益、无现金/可交易物/真实奖品。若以后要求严格跨设备全局发券/消费一致，需可信服务端账本或已核平台验证/条件更新能力，不能声称当前SDK天然解决。
5. 导入云档后离线月结只用snapshot原水位结一次，不叠加本地另一分支收益。广告占用区间剔除规则先修复，云同步上传耗时不当作退出挂机；导入/冲突等待的经营暂停与玩家主动暂停分别处理。
6. 更新元数据不得写`undefined`自有字段破坏现有cloneGameState，optional删除字段用delete/合法null；恢复后跨月/跨年、调岗、关闭重开均需持续可写测试。

### 21.12 UI状态机与用户文案

设置增加“进度备份”分组，显示当前`本机已保存/云端状态/最近成功备份时间`、自动备份开关、立即备份、从云端恢复、云备份管理。首次默认尚未开启，用户看清数据和用途后开启，不在旧政策同意前上传；开关关闭只停止后续上传，不自动删除已有云档，旁边明确删除入口。

云协调状态建议：`disabled/consent-required/auth-required/binding-required/idle-local-only/checking/pending/uploading/verifying/synced/downloaded-needs-choice/conflict/importing/unknown-result/rate-limited/error/unsupported`。不要用一个loading覆盖所有错误。UI文案例如：

- “本机进度已保存，云备份等待联网。”本地持久化成功才显示前半句。
- “云备份已确认：第3年4月。”须上传后回读内容验证，不凭create回调toast。
- “另一台设备也修改过进度，请选择继续哪一份；不会自动合并资金或员工。”
- “此备份由更高版本创建，请更新游戏后恢复。”禁止因此写空云档。
- “已关闭自动备份；云端已有备份仍保留。”
- “关闭公司已在本机完成，云端重开状态等待同步；换设备前请确认备份成功。”

账号绑定/恢复/冲突/删除采用现有scrollable dialog，四视口正文可滚到底、确认/取消固定可触、触区≥44。恢复选择期间暂停经营以免摘要过时，超过阈值/本地revision变化重新确认；等待网络时可以取消并回本地，取消不是删除云档。错误页不抢覆盖存档修复弹窗。

排行内部两层切换：本地模拟/真实玩家；每层资产/年限。真实层展示“来自TapTap玩家的异步排名”、本人当前已同步分数与时间、刷新/同步状态，未启用/没网用明确空态，不能退回显示bot却不改标题。平台原生面板若接管，可在打开前给规则说明；返回时不重置公司或音乐偏好。

### 21.13 隐私、权限、数据删除与公开材料

现政策v2只描述经营数据在本机且广告关闭。新增云备份和真实榜必须在生产启用前同源更新：`privacyPolicyText.ts`、`resources/config/privacy-policy.json`、`docs/隐私政策_我是CEO.md`和公开URL；递增至下一版本（若无并发变更可为3），不能把数字3当用户已同意。

需要准确披露：玩家开启备份后公司/CEO/员工（均游戏内角色）、经营账、年月和随机进度、必要权益等存于TapTap当前账号云空间，用于备份/跨设备恢复；真实榜提交资产/年限分数以及平台榜单必要身份展示；不建设运营全量玩家数据库。游戏内角色自定义姓名也可能包含玩家输入的个人信息，应提醒不要填写身份证/手机号等敏感信息，不把“角色名”视为绝对无个人信息。

区分游戏开发者、平台云服务、广告服务各自处理；不要杜撰云数据存放地区/加密算法/保存期限或“开发者绝对无法访问”，以平台实际协议为准。云备份设置关闭、删除已有云档、退出公开榜参与分别说明；SDK若不支持清除已发布分数，要在启用前解决或明确产品差异，不能许诺立即删除做不到。

MCP/开发者账号授权只给开发工具查询/管理平台项目，不是玩家游戏内隐私同意。用户给MCP扫码也不等于所有玩家已同意外发。登录code/Secret/session_key只留可信所需位置，不写JSON资源/ZIP/报告；若平台能力不要求自有身份，不额外建后端采集openid。相关SDK政策/备案内容、游戏服务说明、商店联网能力和广告说明一并核实更新，不能继续用“本游戏所有数据绝不出设备”。

### 21.14 配置、开关与发布门禁

建议独立公开配置，避免改广告开关时顺手打开云/真实榜：

```json
{
  "schemaVersion": 1,
  "enabled": false,
  "environment": "disabled",
  "appId": "",
  "policyVersion": 0,
  "minUploadIntervalMs": 65000,
  "autoBackupIntervalMs": 120000,
  "retainedCheckpoints": 3
}
```

这是cloud配置示意，policyVersion=0表示尚未配置，loader应安全关闭，不给玩家放行。真实榜另配enabled/environment/appId/policyVersion、assetsBoardId/yearsBoardId、calculation=`latest`、分数口径版本。ID为空/环境错/政策不匹配/非法整数皆关闭对应能力并记录诊断，不误关本地经营。真实ID只从当前已确认应用的官方后台/MCP读取；不拿示例ID当正式值。

Provider不可用不阻断本地存档。测试Fake只进tests/helpers；生产ZIP扫描cloud/leaderboard配置、当前政策和BuildProfile.appId一致，无测试白名单开关绕过/调试注入、无密钥。manifest增加cloud协议/开关/环境、榜ID的公开或脱敏指纹、policyVersion、source/config/resource hash及专项报告引用。运营服务限额/官方能力不作为任意客户端布尔值“已验证”。

发布分层：本地单元/故障/浏览器PASS→真实测试位和云/榜能力准备→全新releaseId候选包→同SHA两设备同账号恢复/两账号隔离/真实榜更新→完整设备与隐私/资质→可提审。配置改测试到正式、换榜ID、改政策等产生新包，需要对应验证，不能转用旧diagnostic的静态PASS当新版云功能已上线。

### 21.15 实施任务、依赖与文件交付

新增有限专项`TASK-M3-11-01`—`14`，本轮全部是TODO（设计完成不等于实现完成），不修改原R任务的真实状态。可由用户将§21.18提示词交执行agent后按依赖推进；没有授权的后台创建/删除/上线单独停在具体操作前，独立本地任务继续。

| TASK | 任务与必须交付 | 依赖 | 完成标准 |
|---|---|---|---|
| 01 | 源码/接口/平台能力基线、配置与当前功能差异表 | 无 | 明确普通小游戏、当前MCP/SDK差异、真实API/配额/账号条件；未知写VERIFY |
| 02 | Cloud/Leaderboard Provider及最小Fake | 01 | feature detection、callback单次完成、错误/超时/迟到epoch、文件路径/字节限制 |
| 03 | CloudCheckpoint codec、summary、版本兼容、optional lineage | 01 | 完整校验、旧档、坏档、高版本、500KB预算，无credentials |
| 04 | 账户绑定/切账号隔离和隐私开关 | 02/03 | A/B账号不串档；空云与不可读分离；不静默上传旧账号档 |
| 05 | 已提交事件、队列/限频、create未知恢复和回读ack | 02/03/04；先补R12 | 本地先提交、65秒频控、仅最新待传、不丢dirty、不重复创建 |
| 06 | 云导入本地事务与离线月结幂等 | 03/04；R12 | expectedRun/revision/account检查，崩溃可恢复，两月持续运行 |
| 07 | 分支DAG、冲突选择、有限历史及安全回收 | 05/06 | 双设备分叉不互覆；未知分支不删；配额满正常降级 |
| 08 | resetEpoch、旧run屏障、删除备份语义 | 05—07 | 重开不复活，离线重开明确待同步，删除不会自动重传 |
| 09 | 真实榜口径/配置、平台适配、提交/读回 | 02/04/05 | latest/0分/精度实测，2榜结果和snapshot一致，取消参与可本地玩 |
| 10 | 设置/排行/恢复/冲突UI四视口 | 04—09 | 44触区、长文、取消/错误态、bot与真实榜不混淆 |
| 11 | 广告券/离线/恢复/公开榜整合 | RV-01—07整改、05—10 | 不重复领/用/算工资；同时离线边界诚实，未决原生不还原成功 |
| 12 | 隐私三份同源/公开URL、版本告知与材料 | 04、09、真实政策 | 政策/SDK/实际数据一致，拒绝不外发 |
| 13 | 全量测试与两账号两设备专项 | 01—12 | §21.16覆盖，Fake/Web/真机分别报告，不以测试总数代替业务 |
| 14 | 唯一候选包、同包验证与交付 | 13、本地/外部门禁 | 新releaseId、完整manifest/hash/包配置回读；可提审与上传自测分层 |

需要并行补齐的原项：R12 A-08—10、真实迟到写/强杀；R39全弹窗/长文本/错误态；§20.16广告门禁与暂停等7缺陷；R08/R41等设备兼容/生命周期；真实广告与政策资料。不要只接云/榜就宣布原问题全关闭。

### 21.16 验收矩阵、测试样例与命令约束

新增测试建议（尚未创建）：`tests/unit/cloudSaveCodec.test.ts`、`cloudConflict.test.ts`、`cloudUploadQueue.test.ts`、`cloudAccountBinding.test.ts`、`onlineLeaderboardScores.test.ts`；`tests/integration/cloudRestore.test.ts`、`cloudResetRecovery.test.ts`、`cloudAdsOffline.test.ts`、`leaderboardSync.test.ts`；Provider行为Fake在tests/helpers，浏览器脚本在tools/e2e按真实Canvas模式增加。只有文件实际实现后才调用，不给不存在命令编造PASS。

| ID组 | 最少用例与业务结果 |
|---|---|
| C01—04 存档 | 无云明确空/查询失败/坏档/高协议四分；坏档不覆盖；old local迁移无重复注资；120年/100年报云导出读回<预算 |
| C05—08 队列 | 100次本地commit合并、限频、400001、断网重连、create已成功但回调未知、上传中本地又前进；dirty和ack正确 |
| C09—12 恢复 | A备份B恢复→snapshot关键字段一致；同checkpoint重复导入→现金/员工/月结无变；导入指针写后未知→重启只一次；错app/environment拒绝 |
| C13—16 账号 | A/B同机隔离、无稳定账号字段保守绑定、游客绑定、原账号迟到云回调；B空云不自动上传A档 |
| C17—20 冲突 | 共同基线两设备各修改；现金更大不自动赢；取消不删任一份；选一整份并创建决议；缺祖先/双重reset判冲突 |
| C21—24 重开/删除 | reset已云确认旧设备不复活；离线重开待传；删除云后关闭自动备份；删除/创建超时unknown不瞎重试 |
| C25—28 权益/离线 | 已用券旧档不复活、云active session不领奖；广告30秒剔除；真正10分钟离线保留；两月工资/调岗/年结持续可写 |
| L01—04 榜分 | 现金80+资产20→提交100；gameYear121→提交120不是年报数100；无公司0；负资产按配置0且详情不改真实账 |
| L05—08 榜同步 | 200降到100应变100（latest）；重开0；两榜部分失败不重复sum；旧run请求不得重新覆盖新目标，未知结果读回 |
| L09—12 榜体验 | 公开提交未同意不发；断网展示标记缓存/本地榜；平台same-score次序不伪造；本地榜不创建网络请求/不改revision |
| N01—04 环境 | API不存在、Tap基础库不支持、SDK100级错误、配额/存储满都继续本地；测试/生产档和榜互不污染 |

财务贯穿样例：同一snapshot现金100000、投资账面20000、员工工资6000；恢复→总资产120000、员工/工资不变；一次券录用现金不扣招聘费、当月不计新员工、下月工资增加6000；重新下载同云档不能再获得另一份员工或另一段离线收益。跨两设备本地不同分支不做相加。测试包含未决投资已实际提交后同步/恢复，确保旧draft不抹掉投资。

真机最低矩阵：设备A/B（优先Android+iOS若目标确支持）、账号P/Q（两个测试账号）；P在A创建并备份，P在B恢复→继续月结备份→A恢复；断网分别经营产生冲突；A切Q不出现P的私有档；P关闭公司→B不恢复旧run；真实榜从白名单测试分数上升/下降/清0；云档/榜/广告并发触发；强杀不同存档阶段。记录同一package SHA、设备/客户端版本、account匿名标签、archive uuid/fileId/checkpointId、分数、实际现金/工资/券、错误及恢复过程，令牌和完整私有数据不输出到公开报告。

命令纪律：完成各小项后跑实际存在的聚焦测试；最后`npm run check`（逐条检查退出码）和相关UI/构建/平台门禁。当前有464 passed/1 skipped只是上一轮基线，不要求硬凑某个数字。设计/规则文档本轮仅做链接/编码/一致性验证，**不冒称新测试、云API或榜创建已执行**。

```powershell
Set-Location -LiteralPath 'D:\Workspace\TapTap\我是CEO'
git status --short
# 新测试真实创建后，按实际文件路径跑聚焦测试；随后：
npm run check
if ($LASTEXITCODE -ne 0) { throw 'Local quality gate failed' }
# 最终release-build命令沿§20.11，用核实过的版本、新releaseId、真实构建，不用SkipBuild。
# tools/e2e新增云/榜脚本必须先实现/help确认，不凭设计给不存在的脚本造执行记录。
```

报告字段继续使用任务ID、输入版本、source/configHash、环境、expected/actual/status、日志/图/视频、package SHA。真正平台未知是BLOCKED/NOT_RUN而非Fake PASS；不要覆盖r2/旧attempt，所有新证据新建目录。

### 21.17 用户本人要提供什么、去哪里、什么时候操作

**现在不需要购买经营数据库、对象存储或实时游戏服务器，也不需要把所有玩家资料交给开发者。** 下表分为你本人在官方页面操作和agent可完成内容，避免让你去寻找不存在的“必须开通按钮”。

| 步骤 | 去哪里/做什么 | 你提供的非秘密结果 | 先后与说明 |
|---|---|---|---|
| U-C01 账号与项目 | 在本聊天/执行聊天要求“开始TapTap官方账号授权”，由MCP给官方扫码链接；用本人TapTap App确认 | 完成授权后确认正确开发者主体和《我是CEO》应用 | 当前MCP未授权/未选应用；不发送token或密码。MCP授权是工具权限，不是玩家登录 |
| U-C02 平台形态/版本 | [TapTap开发者中心](https://developer.taptap.cn/)→正确游戏→商店/小游戏管理；核为普通小游戏及当前线上/审核版本 | 游戏公开ID、主体状态、目标地区/OS、版本历史的脱敏结果 | 不误选制造/H5项目；现普通game.zip不走H5上传 |
| U-C03 云能力 | 授权后让agent按当前游戏读取可用能力/官方资料；有对应“游戏服务/云存档”入口时核权限/配额；没有入口先按SDK诊断/官方工单确认 | API/配额/支持基础库/账户隔离测试结果或工单答复 | 官方当前教程未列必须购买bucket或手工建槽；不要盲目找“申请云存档”或因此买服务器 |
| U-C04 测试账号与设备 | 准备可扫码的两台设备和两套测试Tap账号，加入该游戏开发测试允许范围 | 机型/OS/Tap客户端版本、可测试时间、账号匿名标签/必要白名单ID | 不提供密码；真机A/B恢复与同机换账号是上线前必测 |
| U-L01 创建测试榜 | 开发者中心→正确游戏→**游戏服务→游戏排行**（文档路径`/{developer_id}/app/{app_id}/rank_v4`） | 按§21.10创建资产/年限两榜；numeric/desc/always/latest，先测试白名单；确认支持0与降分 | agent可在明确授权后通过适用MCP创建，也可你手工创建；不要复制MCP旧数字枚举。未核支持则不要改best凑成功 |
| U-L02 榜ID/测试隔离 | 在同一榜管理页核名称、ID、计算方式、可见范围 | 官方后台/MCP读取的两榜ID和脱敏配置截图；测试账号白名单 | 使用真实当前项目；测试榜不污染正式榜。当前rank平台管理能力需账号授权 |
| U-P01 隐私网址与资料 | 提供现有公开隐私页面地址；若没有，选择自己可维护的合法公开页面托管，按实际平台/地区核要求 | URL、主体/联系信息、平台云/榜/广告SDK政策及数据处理资料确认 | agent生成同源正文；发布前由本人确认真实性。论坛帖不能充当隐私政策；不因云SDK就假设必须有自购服务器 |
| U-A01 广告 | 原§20.17的正确广告渠道与MCP工作流 | 开通/审核/主体状态，兼容MCP时由工具自动读当前位 | 不手抄示例ID，不把H5位用于普通小游戏；云/榜开发可先进行 |
| U-Q01 资质 | 开发者中心→商店→小游戏管理→小游戏资质/前置备案 | 已通过/审核中/待补材料；权属/软件著作权人等按真实页面填写 | 身份/银行卡等原件只在官方页面，不发聊天；账号认证不等于备案过审 |
| U-M01 商店素材 | 游戏商店资料/物料上传组件 | 图标、横1920×1080/方1440×1440、至少3真截图、9:16真录屏和简介/版权确认 | 规格发布前复核；设计PNG不是实机图。agent可以整理验收，不伪造素材 |
| U-R01 开发自测/提审 | 核实版本唯一后上传新候选game.zip到包体管理，扫码；或明确授权agent做该步骤 | 后台包ID/版本/解析结果/二维码、设备和云测报告引用 | 上传开发版≠提审；提审≠上线；最终同hash结果齐备再决定提交 |

可并行：本人先做U-C01/02/04和隐私URL/资质查询，agent同时修原RV缺陷并做Provider/Fake/codec/冲突测试，不等待后台而停工。榜创建建议等口径确认与测试白名单准备后一次建对；云和榜的原生验证需真实候选包生成后完成。

如果平台实际强制要求自有认证端点或严格全局权益校验，agent应提交最小方案及域名/HTTPS/托管/身份密钥存储的具体清单和成本依据，再由本人决定；不能以本次“备份”需求默认让你买云数据库。你不需要给出“所有玩家当前状态Excel”、玩家真实姓名或设备标识。

### 21.18 交给执行agent的完整提示词

2026-11-05补充：下方保留原云/榜交接背景，**最新合并执行提示词改用§22.16**，包含按钮布局及详情持续显示前置；接手前先核§21.20已有模块，不从头重建。

```text
你接手 D:\Workspace\TapTap\我是CEO。本次目标是在原发布/广告整改基础上加入玩家自己的云备份/跨设备恢复与真实玩家榜，保留本地模拟榜，不建设运营全量玩家后台。

先读 AGENT.md、skills/taptap-mini-game-publisher/SKILL.md，以及 docs/我是CEO_项目总览.md §20.16—20.18、§21全文。§21是2026-11-04用户新确认的有限范围变更，DEC-042—044已记录；不要被旧“一期不做云存档/真实榜”条款挡住，也不得因此扩展多人、内购、后台改经济数值或玩家管理后台。

用户已确认：只需玩家备份和跨设备恢复；增加真实玩家榜并保留本地模拟榜。继续Cocos3.8.8+TypeScript普通Tap小游戏，不迁移H5/Lua，不用H5上传工具提交普通game.zip。先核git status，保护大量已有改动、旧ZIP和证据。当前已有诊断r2不代表云/榜已实现。

按 TASK-M3-11-01—14逐项推进并回填证据：
1. 先核现有源码和当期普通小游戏cloud/leaderboard API、基础库、账户范围、配额及真实工具schema；可调用MCP指南，不需要npm安装Tap SDK。当前MCP未授权/未选游戏时说明需本人扫码，不猜应用，不创建远端资源。官方接口404则寻找正确官方路径/安装类型并记录VERIFY，不编造API。
2. 先修§20.16 RV-01—07和R12阻断项：60秒统一资格、AD时钟/音频、跨日/券/未知奖励/后台加载；云不能放大重复收益/消券问题。其余独立本地云设计可并行准备。
3. 做窄Provider+Fake、CloudCheckpoint codec、旧档兼容与账户绑定。本地双槽仍是写入入口；云只备份已提交快照，不上传token/Secret/硬件指纹，不用平台登录标记冒充稳定用户ID。
4. 按§21.5不可变checkpoint与限频队列实现：一分内最多一次外部上传限制，工程65秒底线/120秒自动备份；未知create查原op结果，不新ID盲重试；至少3备份+上传位置所需配额必须实测。配额或delete能力不足时安全阻断/提出差异，不能悄悄无条件覆盖唯一云档。
5. 实现受控导入事务、已提交来源/父关系、离线结算幂等、双设备分支整份选择；不能按现金大/时间晚/localRevision大选胜，不能合并员工或资金。未解决分支不删，已关闭run不得因旧设备回写复活。没有CAS不要声称强一致双设备同时离线合并。
6. 真实榜用§21.10当前公司资产/完成经营年限baseline：numeric/desc/always/latest、重开0；先核SDK支持降分/0及安全整数，不支持则报告差异，不擅自best/sum。默认平台UI，不上传员工/CEO名/完整公司档，不创建好友权限。只从同一已提交且云确认snapshot提交，两榜部分失败独立恢复，断网不影响本地经营。
7. 设置/排行内部增加云状态、恢复/冲突/删除与真实/本地切换，保留四主Tab。关闭备份不删云；删云需本人确认且关闭自动重传。用户拒绝外发仍可本地玩。
8. 按实际云/榜/广告数据更新三处同源隐私、公开URL和同意版本；MCP授权不等于玩家同意。真实配置/账号/政策缺失时功能disabled但继续Fake/本地验收，不假装已接通。
9. 补§21.16的C/L/N全矩阵，尤其账户A/B、设备A/B、导入写后unknown、reset旧run、已用券恢复、离线水位、120年尺寸、榜分升降/0/部分失败；保留既有黄金财务值，不以修改期望造通过。新脚本/测试先创建再运行，不编执行记录。
10. 本地与配置门禁通过后全新releaseId真实构建、verify+skill preflight、包内cloud/board/policy/profile回读、manifest和唯一SHA；后台创建/删除、部署、上传、提审、发布按真实已有授权分别执行。可上传候选用于后续真机，真机结果不能用Fake替代；最终报告四层：本地质量/包静态/平台运行/可提审。

本人需做的操作按§21.17一次性列清：官方OAuth扫码和正确应用、普通小游戏版本/资格、云能力/配额、两账号两设备、游戏服务→游戏排行的两个测试榜及白名单、政策URL/SDK资料、广告状态和最终上传自测。不要索密码、token、Secret、身份证/银行卡原件，也不要默认要求购买数据库/经营服务器。

常规可逆选择自主完成，发现外部缺失继续独立本地工作。只在真正改变玩家规则/不可逆数据/对外操作范围时提问；提交具体可审结果再申请必要授权。每项记录PASS/FAIL/BLOCKED/NOT_RUN和证据，不把设计或测试数量当上线通过。最终交付修改清单、任务状态、真实测试、唯一ZIP绝对路径/版本/releaseId/广告云榜环境/size/SHA/manifest及本人下一步操作。
```

### 21.19 来源、需要复核的事项与本轮文档验收

当日使用项目publisher skill和已连接TapTap MCP：get_cloud_save_integration_guide/get_leaderboard_integration_guide/get_current_app_info/check_environment。当前未授权/未选应用，**没有调用create_leaderboard或任何云写入/删除**。MCP文档示例与真实工具schema不一致时以前提确认后的当前schema及官方API为准，工具输出不是账号服务已开通证明。

官方来源：

- [云存档概览与限频](https://developer.taptap.cn/minigameapidoc/dev/tutorial/open-capabilities/cloud-save-tutorial/)
- [createArchive参数、大小、频率及基础库](https://developer.taptap.cn/minigameapidoc/dev/api/open-api/cloudsave/CloudSaveManager.createArchive/)
- [updateArchive及uuid/fileId语义](https://developer.taptap.cn/minigameapidoc/dev/api/open-api/cloudsave/CloudSaveManager.updateArchive/)
- [getArchiveList返回元信息](https://developer.taptap.cn/minigameapidoc/dev/api/open-api/cloudsave/CloudSaveManager.getArchiveList/)
- [getArchiveData下载](https://developer.taptap.cn/minigameapidoc/dev/api/open-api/cloudsave/CloudSaveManager.getArchiveData/)
- [真实排行榜及后台入口](https://developer.taptap.cn/minigameapidoc/dev/tutorial/open-capabilities/leaderboard-tutorial/)
- [登录态与密钥边界](https://developer.taptap.cn/minigameapidoc/dev/tutorial/open-capabilities/login-management/)
- [普通小游戏引擎适配](https://developer.taptap.cn/minigameapidoc/dev/engine/Cocos-Laya-Egret/)、[MCP当前形态范围](https://developer.taptap.cn/minigameapidoc/quick-start/mcp-guide/mcp-setup/)
- [前置备案](https://developer.taptap.cn/minigameapidoc/quick-start/guide/pre-filing/)、[物料](https://developer.taptap.cn/minigameapidoc/quick-start/guide/game-publish/material/)、[版本提审](https://developer.taptap.cn/minigameapidoc/quick-start/guide/game-publish/version/)

未从当前文档确认：每玩家云档数/总配额、严格跨设备原子条件写、稳定最小账号标识、delete详细实际签名、当前项目云/榜权限/同账号不同OS互通、平台latest/0值实际行为、平台数据存放/保留条款。以上写入TASK-01/13的VERIFY条件，不填猜测值。

本轮交付为需求/架构/接口/状态机/事务/测试/任务/本人操作/执行提示词文档及范围规则更新；只验证文档一致性/链接路径/编码，不运行不存在的云业务测试，不把前一轮464 PASS当本轮新增功能已通过。生产源码、后台配置和包体未在本轮改变。

### 21.20 TASK-M3-11-01—14 本地实现记录（2026-11-04）

本节记录当前源码和本次候选包真实状态；“本地 Fake 通过”不等于 TapTap 云/榜开放或双设备验收。保持 §21.18 的范围：只做玩家备份/恢复，不做运营玩家后台；本地模拟榜保留；不创建或删除远端资源、不上传、不提审、不发布。

| 项 | 状态 | 本地实现与证据 | 未完成/限制 |
|---|---|---|---|
| TASK-M3-11-01 | DONE | Cocos/Tap 适配基线、当前 SDK 可用性与配置边界已核；`evidence/acceptance-20261104-mcp/` 为只读能力核查 | MCP 无 MAC Token、未选 App；不代表项目后台已开通 |
| 02 | DONE（本地） | 窄云/榜接口、Tap adapter、FakeCloud/FakeLeaderboard 集成用例；`tests/integration/cloudSync.test.ts`、`leaderboardSync.test.ts` | Fake 不证明 SDK 回调结构、账号作用域或平台配额 |
| 03 | DONE（本地） | 版本化 checkpoint、Envelope/CRC/结构/大小/app/environment/summary/closed-run 校验；`tests/unit/cloudSaveCodec.test.ts` | CRC 用于损坏检测，不是服务端签名或防作弊 |
| 04 | PARTIAL | 云档按本地 profile metadata 隔离；绑定切换会阻止另一 profile 的未决 create | Tap runtime 未提供可核稳定玩家标识；没有同机 A/B 真实账号隔离验收，云功能保持 disabled |
| 05 | DONE（本地） | create 前持久化意图；unknown 后先 list/按 checkpointId 对账，不盲目重建；Fake 覆盖 | create 超时后的真实列表一致性未在平台验证 |
| 06 | DONE（本地） | Store 锁内校验run/revision、journal写入、保留本机广告账本、清离线结算水位；同run恢复及干净设备首次导入测试 | 活跃设备不同run仅通过显式重开/冲突流程处理，尚无冲突UI |
| 07 | PARTIAL | 只用父链判定same/ancestor/branch/unknown，不按现金、时间、revision选胜 | 云历史分支留存、配额GC和玩家整档选择界面未接通；不自动删远端档 |
| 08 | PARTIAL | checkpoint拒绝复活其resetEpoch声明已关闭的run；本地SaveRepository墓碑仍挡旧run | 云 resetEpoch 的跨设备推进/确认/删除语义待双设备实测 |
| 09 | PARTIAL | 资产/经营年限安全整数映射、两项独立提交、同checkpoint限频、账号代际栅栏；配置默认关闭 | 最新值降分/0语义待真实榜配置；同步服务尚未挂入已确认云备份UI/流程 |
| 10 | PARTIAL | 本地模拟排行保留；设置有公开榜单独立同意/云备份可用性状态，配置启用后可打开平台榜 | 云备份/恢复/分支冲突操作UI未接入；真实榜按钮因ID和配置缺失默认不可见 |
| 11 | PARTIAL | 修正UTC+8日期键、按广告开始日预留、D+7日边界、奖励元数据上限、重启取消无回执会话、loading隐藏取消、广告期间在线tick/音频暂停；云导入不带远端券/完成ID且不结离线收益 | 广告SDK真机close/hide顺序、广告覆盖期间夹真实后台的离线区间仍需验证；完整奖励/回调故障矩阵未齐 |
| 12 | DONE（本地文案） | 同意/运行时/资源JSON/公开政策V3改为说明可选云备份与公开榜单；广告仍关闭 | 可公开访问的政策URL、TapTap当前数据处理资料与平台删除方式待本人补齐 |
| 13 | PARTIAL | `npm run check` 通过；新增 Fake/事务测试与四视口证据 | §21.16 C01—28、L01—12、N01—04完整矩阵与双真机全未完成 |
| 14 | DONE（静态候选） | 唯一候选见下及构建manifest | 可供本人上传开发自测；未上传、未做平台运行或提审验收 |

#### S1—S9 执行状态

| 步骤 | 状态 | 结果 |
|---|---|---|
| S1 规则/范围/现状 | DONE | 本地 Cocos 普通 Tap 小游戏；玩家云恢复+公开玩家榜；不建运营后台；平台工具只读且无当前授权 |
| S2 缺陷盘点/实施 | PARTIAL | 云Codec/Provider/同步服务/恢复事务、真实榜适配/同意开关、广告及V3隐私已实现；平台绑定、云操作UI和分支UX仍缺 |
| S3 故障矩阵 | PARTIAL | 新增测试见全量测试；未覆盖§21.16全部交叉故障与真机写后unknown |
| S4 广告事务/lifecycle | PARTIAL | 本地每日配额、session幂等、coupon边界/有界、隐藏loading fence、恢复不重发券；真机广告时间线未完整证明 |
| S5 云备份/导入 | PARTIAL | Fake覆盖profile过滤、unknown create防重放、same-run/干净设备事务导入、广告/离线不重复 |
| S6 榜单 | PARTIAL | 本地榜保留；Fake验证分数和同步闸门；真实榜不可读写验证、最新值降分与清零待平台 |
| S7 隐私/外发 | PARTIAL | V3文案对齐且云/榜/广告配置默认关闭；公开URL和真实SDK接收方资料缺失 |
| S8 四视口视觉 | PASS（本地Web） | `evidence/m3/TASK-M3-11-14/visual-05/visual-matrix-report.json`：4视口×5界面、28 checks PASS、浏览器错误0；真实榜因默认关闭未展示 |
| S9 唯一候选构建 | PASS（静态） | attempt-05通过Cocos wechatgame构建、Tap转换、ZIP静态校验及前后源码指纹一致；未平台运行 |

#### 分层验收与交付包

- 本地质量：`npm run check` 退出码0；62 test files、477 passed、1 skipped。日志 `evidence/m3/TASK-M3-11-14/npm-check-final-03.log`；skip为既有 `tests/simulation/exportEvidence.test.mjs`，不表示云榜/广告平台通过。负向release verifier打印 `VERIFY_FAIL` 是测试断言拒绝坏包，测试本身通过。
- 静态包：Cocos Creator 3.8.8构建标记完成、exitCode 36（此项目流水线记录为Creator成功码）；Tap转换与 `verify-package` PASS；ZIP 4,617,974 bytes；manifest无缺项、重复项、路径问题或release配置错误。manifest sourceFingerprint 与构建后复核相同，ZIP SHA256与manifest相同。
- 平台运行：BLOCKED/NOT_RUN。无已选真实App、云档/榜ID、两账号两设备；未做任何远端创建/删除、上传、提审或发布。
- 可提审：NOT_READY。该ZIP是本地静态合格的开发自测候选；需补齐同包平台运行、后台云/榜/隐私/资格条件后，才能重新判定。

唯一推荐候选：版本 `1.0.2`；releaseId `m3-20261104-cloud-rank-r1`；用途 `product-test-candidate`；广告环境 `disabled`（adUnitId空，未运行广告验证）；云存档与真实榜配置均 `disabled`；ZIP绝对路径 `D:\Workspace\TapTap\我是CEO\build\release\m3-20261104-cloud-rank-r1\05\game.zip`；SHA256 `ee8466375391acc91197e5e8805e9e8403952eb803149aab5917e6706bec6183`；manifest `evidence/m3/build/m3-20261104-cloud-rank-r1/05/manifest.json`。attempt-01源码指纹变化失败证据及attempt-02/03/04历史包均保留，不作推荐。

#### 按 §21.17 需本人完成的操作

1. 在 TapTap 开发者中心完成官方OAuth授权，确认正确开发者主体与《我是CEO》普通小游戏 App；只在本聊天确认，不发送Token/密码。
2. 核实普通小游戏线上版本、地区/OS、主体资质与支持基础库；提供脱敏 App ID、版本历史/状态。不要选成H5或TapTap制造项目。
3. 在官方支持下核对云存档权限、配额、账号隔离/删除/保留及客户端API；确认后提供非秘密能力结论。
4. 准备两台设备、两个测试账号并加入测试范围；提供匿名标签、机型/OS/Tap客户端版本和可测试时段。本人执行跨设备恢复、同设备换账号隔离、分支、reset与强杀。
5. 在正确游戏“游戏服务→游戏排行”建立测试资产榜/年限榜并准备测试白名单；确认numeric/desc/latest、降分和0值语义后再启用。
6. 提供可公开访问的V3隐私政策URL、Tap云/榜实际数据类别和平台删除渠道；确认玩家同意流程及资格要求。
7. 核实广告审核/实名/资格和真实广告位信息。未完成政策、资格、同包真机闭环前保持广告disabled；不得用Fake或占位ID验证。
8. 本人使用以上唯一候选ZIP上传开发测试并记录同一SHA、平台版本与设备结果；开发自测上传不等于提审。平台/后台条件齐备后再评估提审；本次无远端操作执行。

本节只追加执行事实，不重写§21.18提示词或早期历史记录；attempt-01/02/03/04/05、Web预览和四视口截图均独立保留。

## 22. UI一致性与详情页持续显示整改，合并云/榜实施（2026-11-05）

本节回应用户新增两项问题：按钮大小不一/排列不齐/遮挡文字，以及详情打开3—5秒后自行关闭。用户要求先分析、完整设计并交执行agent，**本轮做源码分析、浏览器复现、文档与规则更新，不实施生产修复**。本节与§21一起执行，新增UI基础整改是云备份、冲突恢复和真实榜UI的前置，不另建平行PRD。

### 22.1 本轮事实、复现证据与结论

已应用`ui-ux-pro-max` skill的触控、间距、文字重排、状态保持和可预测关闭规则，按Cocos现有单位/组件实现，不把CSS/React方案搬进游戏。技能位置：`C:/Users/vinki/.agents/skills/ui-ux-pro-max/SKILL.md`。项目UI约70处createButton调用，现有textTokens、dialogs、dialogModel、shellLayout可复用，不另起一套前端框架。

读取时源码已有§21新增的CloudSyncService、云/榜Provider和AppView设置等部分接线；§21.20记录477 tests/62 files及静态候选，这是**执行agent既有报告**，本轮未重跑全量/未验收云功能。不能让下一agent把已有云/榜模块重新造一遍，应先核§21.20缺项再续做。当前UI缺陷仍可复现，不因为旧28项主Tab导航PASS而免验。

**真实浏览器复现**：使用现存`build/release/m3-20261104-cloud-rank-r1/05/web-preview/web-mobile`，375×812、100员工夹具，玩家依次点5×→人才→详情，此后无关闭/返回/遮罩动作。attempt-02中员工详情于约**3802ms**消失，存档从第1年1月/revision13推进到第1年2月/revision17，浏览器错误0。脚本/采样与开关前后截图在：

- `evidence/planning-ui-20261105/detail-lifetime-probe.cjs`
- `evidence/planning-ui-20261105/attempt-02/detail-lifetime-probe.json`
- 同目录`detail-opened.png`、`detail-after-wait.png`

首次探针也在3688ms观察到消失，但该次存档读取与UI查询跨过提交帧，因此单次sample仍显示上月；第二次增加关闭后的读回，明确月结关联，原结果保留不覆盖。该复现是Web产物，不代表Tap真机已测。

**结论：自动消失已定位到全页重建销毁弹窗，不是合理的“详情自动关闭”设计。** 配置1×全年300000ms、12个月，5×每月5000ms；详情在月内任意时刻打开，到下一次月结可能只有3—5秒，正好对应用户描述。源码闭环：`clockTick → monthsAdvanced>0 → this.render() → clearRoot() → this.root.destroyAllChildren()`，而`modalOverlay()`也把遮罩挂在同一root下。年结、命令成功、离线摘要后的render等也能触发同类销毁。

**按钮问题是布局机制缺陷与规范未落实叠加：** 有字号/热区token不代表页面布局已正确。固定坐标与自动增高文字共存，控件实际尺寸由工厂修正却未反馈给父布局，各页独立width/height没有统一同级规格。不能只改几处76→80或加大按钮后照旧摆坐标。

### 22.2 根因清单与影响范围

| ID / 优先级 | 源码事实或可复现路径 | 影响/修复方向 |
|---|---|---|
| UI-A01 P1 | AppView.clearRoot销毁AppRoot全部子节点；modalOverlay与页面同父；月结render清根 | 全局详情被动消失；分离稳定ModalLayer与PageLayer |
| UI-A02 P1 | 局部rebuildSettings只解决设置切换，但没有解决所有来源的render | 不继续复制“销毁再打开某弹窗”补丁；用统一DialogManager保留实例/状态 |
| UI-A03 P1 | createLabel有width时RESIZE_HEIGHT自动增高；调用方仍用固定y+32/+12/-8等间隔 | 长公司名、待离岗/调岗、金额和说明多行后压邻行；布局高度必须来自内容/明确槽位 |
| UI-A04 P1 | createButton把宽/高至少修成44，但调用方以原height36/38/40排版；label却仍用opts.width-16 | 视觉/热区/标签宽和父布局不一致；先resolve实际metrics再布局 |
| UI-A05 P1 | 按钮Label直接复用正文createLabel、TOP+自动增高；没有按钮专属单行居中/溢出策略 | 同高按钮文字位置/长文换行不一致；按钮文字独立style，不用正文自动撑高规则 |
| UI-A06 P1 | 多处卡片把文本与操作放在同一个父层，靠各自setPosition避让 | 缺文字列/动作列/操作行边界，金额及长状态可能侵入按钮；结构化分区 |
| UI-A07 P1 | dialogStack仅在handle.finish时注销，外部destroyAllChildren不经过finish | 句柄closed=false但节点已毁，返回栈/监听/晚回调可能残留；生命周期强制dispose需幂等 |
| UI-A08 P1 | setError用卡片宽作为正文错误Label宽，而正文比卡片窄且有padding | 长错误信息越出正文；以body实际可用宽计算 |
| UI-A09 P1 | 现CanvasDriver取cc.UITransform，缺组件时回退1×1；旧报告可见按钮width=1/height=1且仅检查>0就PASS | 几何测量缺失不能冒充合格热区；修测量能力并加入负例 |
| UI-A10 P1 | 新云状态/榜回调将持续增加“数据变化→更新UI”的路径 | 若照旧render，云冲突/恢复/删除确认也会自动消失，必须先修基础层 |

toast确有2.2秒销毁，但它是独立反馈，不是本次员工详情约3.8秒消失的根因。保留短暂toast合理性；禁止把详情延迟从3秒改30秒当修复。也不通过停止月结或全程暂停经营掩盖消失。

### 22.3 用户体验契约与禁止退化

1. 只读详情（员工/部门/排行/年报/预算解释/规则/隐私正文）持续存在，直到用户关闭/返回/主动导航或安全上下文明确失效；不设阅读倒计时。不能因浏览器tab暂时后台、云同步完成、下一月到来而主动关闭。
2. 同一视觉层级、同一操作组的按钮统一高度、字体、圆角、内边距、对齐、间距及状态。不同职责可用有限变体，不是把“详情”和整屏主操作都强制同宽；同组不能一个94另一个76且无布局理由。
3. 按钮含**真实热区**都不得覆盖正文/金额/相邻按钮；文字必须在自己的区域完整显示或有明确可访问的完整详情，不以缩字到不可读或无提示截断解决。
4. 经营时钟与详情显示解耦。只读详情默认不改变玩家speed/暂停选择；月结继续，详情展示其打开时的快照/截至年月。若因特定数据操作需要短暂导入暂停，使用已有原因集合，不把所有modal都持久化speed=0。
5. 阅读时的滚动位置、当前员工/部门/年报、输入草稿与操作状态稳定。禁止被刷新跳回顶部、换成下一位员工或自动切Tab。
6. 金额确认、删除、重开等仍守同commandId幂等、提交中/未知结果保护；“用户自己关闭详情”不等于允许关掉未决事务并重新收费。
7. 现四Tab、本地账本、行业/工资/年限/黄金预期不因视觉整改变化。原R30首卡8单位安全间距作为**至少8**继续满足；若增为规范12，记录设计调整，不要求为保留精确8强行压回去。

### 22.4 统一按钮规格：尺寸、排版与状态

复用现有theme/textTokens，增加`UI_METRICS/BUTTON_TOKENS`，推荐放`assets/scripts/ui/uiMetrics.ts`。以下为逻辑单位，375为设计宽；当前360宽缩放下48逻辑约46.1CSS像素，可守44有效触控底线。若更小屏或特殊缩放，resolve时按实际scale检查`hitSize>=44/scale`，父布局必须使用最终尺寸。

| 变体 | 视觉/布局高度 | 宽度规则 | 字体/内容 |
|---|---|---|---|
| primary/secondary/danger | 48 | 同组等宽；单个主/关闭按钮通常填满内容宽 | 15/22，单行水平/垂直居中 |
| row-action（详情/招聘等） | 48 | 默认80；同一列表全部相同，长动作改独立操作行 | 14/20或15/22，页面统一 |
| segment/filter | 48 | 同一行等宽；不够则整行改2/3列或换行 | 14/20；数量另有稳定槽，避免100人换行挤高 |
| icon-close/stepper | 48×48 | 固定方形；减/加同行等大且间距8 | 可读符号及稳定语义；保持现有文字风格不强加新图标 |
| multiline-action（极少） | 至少64，按2行及padding计算 | 整行全宽，不与48高按钮硬拼同行 | 15/22，最多2行；优先将费用移到正文，按钮缩短为“确认支付” |

统一间距：页面左右安全内边距16；卡片内部12—16；按钮间至少8；卡片间12；信息与操作区至少12；分组间16。不要把8用在所有方向导致视觉拥挤。边框/按压/禁用改变颜色/透明度，不改变布局尺寸。加载“处理中…”与错误后“重试”仍保留同一按钮框，不突然变窄。

建议工厂契约（示意，不是新SDK）：

```ts
type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'row-action' | 'filter' | 'icon';
interface ResolvedButtonMetrics {
  width: number; height: number;
  hitWidth: number; hitHeight: number;
  contentWidth: number; contentHeight: number;
  fontSize: number; lineHeight: number;
}
// 先计算Resolved metrics，父容器用它分配区域，然后创建组件。
// createActionRow / layoutActionGroup统一决定列数、等宽和换行，业务页不分别猜x。
```

Button Label不得再直接采用正文RESIZE_HEIGHT+TOP。创建专属Label，固定为最终content box、CENTER/CENTER，显式单行；超出时由布局决策扩宽/换操作行/缩短按钮文案并把完整金额放正文，**不能默默clip后判PASS**。只有明确multiline变体可2行，行高和外框同步增长；绝不默认SHRINK。label宽按最终resolved width算，不用未修正opts.width。

旧`createButton({width,height})`短期可作兼容包装，但不得继续让新增业务随意height36/38/40/42。逐页迁移，开发期对非规范尺寸/文本超框输出可定位警告；生产包不留可写测试hook。禁用逻辑须读取当前Button状态/状态对象，不让创建时`opts.disabled`闭包与后来setEnabled冲突；视觉启用不等于能提交，业务仍在Facade验证。

### 22.5 页面、卡片与操作组布局方式

**先分区再放内容**：卡片使用`Header / Body / Actions`子节点；正文只占TextSlot，操作只占ActionSlot。不能把所有文字与按钮平铺在大父节点下再靠y试凑。优先用现有Layout/UITransform实现，必要纯函数计算列框；测量和布置分两阶段，等待字体/Label排版完成后更新高度，别每帧全树扫描。

动作组规则：给定可用W、gap8、n个按钮，同行等宽`(W-(n-1)*gap)/n`；每个按钮需满足自身最小宽及文案空间。任一不满足就整个组变为下一种排法（3列→2列/单列），不单独压缩其中一个。操作区域高度据行数计算并计入card/content高度。两按钮内宽288时各140；三按钮若长文不够，改两行，不能再用固定x=-100/0/100而只调各自宽。

筛选chip建议采用一致的部门简称（如“主营/人力”）＋独立数量槽，完整名在筛选标题/详情显示；100人时也保持单行。若确需全名2行，则整组统一增高为明确变体，首卡位置按实际行高计算，不能只有“主营业务100”一个chip临时变高。给按钮/对话注册稳定语义actionId或Node.name供真实几何点击定位，避免依赖“第几个详情”与固定偏移；这是只读UI标识，不是生产写状态测试hook。

| 页面/组件 | 调整方式 | 明确不能做 |
|---|---|---|
| 公司关键数字/速度 | 数字卡独立label/value区；暂停/1×/2×/5×同高等宽；设置固定入口；扩产/报告各在操作组 | 按钮浮在金额上、为了长值随意缩到10号 |
| 已建部门卡 | 标题/人数/效益/净贡献动态正文，编制/招聘/详情统一操作行或2行 | 固定166高度包不下长效益说明仍照旧往下画 |
| 未建部门卡 | 名称/费用说明上方，创建按钮右侧独立80以上slot或全宽底行 | 以标题y直接猜创建按钮中心导致覆字 |
| 人才卡/100人虚拟列表 | 统一文字列+80动作列，或纯文字上部+底行操作；预留长名2行、能力/薪资/状态槽 | 只让一个Label长高却不增rowHeight/step |
| 排行 | rank/name/value/action四列；数值右对齐，name可换行；同列所有行一致 | 金额靠padding猜，按钮盖住金额；把bot当真实玩家 |
| 招聘3候选 | 卡片文字区与录用80slot，工资/招聘费独立稳定行；换批/关闭同组 | 原308宽卡中210文字区再塞按钮却不检验碰撞 |
| 详情/年报/隐私 | 固定标题/滚动正文/固定footer；所有行按实际内容高度推进 | 正文换行后仍每22单位往下排、底按钮挡正文 |
| 云备份/冲突/恢复 | 分组摘要卡、状态行、每份“选择此进度”按钮；恢复/取消统一footer | 将两份长档比较与三四个按钮挤一行 |

人才虚拟列表优先保持统一rowHeight以复用现池：例如长名2行44、能力18、工资20、状态18、间距12、padding24共136，可选144高、step156；这些是测量起点，最终以最长状态/金额测试决定。如果正文允许更多行，须改可变高度前缀和offset映射，不能沿用`index*旧step`。名单排序、employeeId绑定与业务不变，卡池点击始终读当前记录ID；scroll最后一行和点击详情都重验。

长金额在列表可使用统一compactMoney显示，但全文详情保留精确整数，单位规则清楚。正文/确认费用不能任意省略；特别是补偿、投资、云档冲突现金不能只显示“很大”。文本没有必要所有处都加大到16，但正文建议14/21、辅助≥12/18，同一role一致；缩到12不能作为控件遮挡的补丁。

### 22.6 稳定页面层与弹窗层：解决自动关闭的根本结构

目标节点树（示意）：

```text
Canvas
  Backdrop                  已有无字背景，常驻
  AppRoot                   生命周期内常驻
    PageLayer               当前Tab/创建页/经营页面
    ModalLayer              常驻容器，弹窗由DialogManager管理
    ToastLayer              短反馈，不接管详情生命周期
```

把`clearRoot`拆为`clearPageContent`与仅销毁应用/明确重建时的`disposeApplication`。普通render/刷新只清PageLayer，不能destroyAllChildren(AppRoot)。fullPanel/创建壳等挂PageLayer；modalOverlay挂ModalLayer；toast挂ToastLayer。不要仅把一类员工详情移走而隐私/预算/云冲突仍留旧层。

最小落地次序：先建立稳定容器并迁移工厂入口→确认每个页面最上层parent→普通render只清页面→月结观察详情保留→再做增量刷新减少重建。无需先把整个AppView重构成另一架构，但应引入明确刷新原因：`state-refresh / user-navigation / account-change / cloud-import / app-dispose`，分别处理页面与弹窗。

普通月结可以重画底页，必须保留上层dialog实例、滚动、文字选择与状态；底页保存activeTab/筛选/顶部可见记录锚点/scroll offset，避免关详情后回到列表第一项。若近期选择在打开详情时暂缓**页面绘制**，只能延后visual refresh并标dirty，不能延后GameClock/SaveRepository业务提交；这只是过渡，不代替稳定层。

底页render执行DISTRESS等展示逻辑也须由manager按语义key去重和排队，不能在一个详情下方重复创建多个风险窗。现`maybeShowDailyRewardPrompt`等检查`root.children`里ModalOverlay的逻辑，分层后必须改用`dialogManager.hasBlockingModal()`，否则会认为没有弹窗而叠加广告/离线/危机。页面resize不仅调shell，还应通知manager对所有存活弹窗重排，不能靠重开弹窗适配。

`renderOfflineSummary(); this.render();`这类“刚开摘要下一行就销毁”的调用顺序改为先更新底页后入队摘要，或稳定层后正常更新；不能每次render自动重放已经读过的摘要。

### 22.7 DialogManager：打开、关闭、嵌套和销毁语义

复用现dialogs/ConfirmGuard，新增`DialogManager`及必要纯逻辑`dialogSessionModel.ts`，不是重写所有弹窗。每个dialog需要可定位ID/类型/实体/上下文，只有manager负责注册与移出栈。

```ts
interface DialogSession {
  id: string;
  kind: 'detail' | 'form' | 'confirm' | 'blocking-recovery' | 'notice';
  semanticKey: string;       // 例如 employee:<id>、annual:<year>
  ownerRunId: string | null;
  ownerAccountEpoch: number;
  sourceRevision: number | null;
  entityId?: string;
  policy: 'manual' | 'submit-result' | 'recovery';
}
type CloseReason = 'user-close' | 'user-back' | 'user-navigation'
  | 'user-submit-success' | 'context-invalidated' | 'app-dispose';
```

1. 普通detail只能`user-close/user-back/user-navigation`主动关；默认点遮罩只拦穿透，不关闭。原生返回/ESC关闭最上层，不能顺便确认、提交或关掉两层。
2. 详情上的调岗/裁员等是用户主动进入下一步，可用push确认层，底详情保留；取消返回同一详情/滚动位置。确认成功可在用户触发操作的完成结果里关闭该确认层并更新/标记底详情，不能把全部层清掉。
3. 纯只读内容无SUBMITTING锁，关闭随时可用。确认窗提交中和UNCERTAIN继续守现有安全规则；其关闭按钮显示忙碌/待核原因，给已有恢复路径，不能无限无反馈。关闭展示层不等于撤销已经提交的业务，若将来允许收起处理必须有持久化事务中心，不能本次直接放宽ConfirmGuard。
4. 句柄finish/dispose幂等：栈注销、onClose/订阅/resize/input/定时器解绑只执行一次；组件onDestroy也触发强制清理，以防父层销毁留下幽灵句柄。强制dispose只释放UI资源，不伪造业务成功/取消/退款。
5. 所有旧async回调更新UI前核dialogId/closed/节点有效、ownerRun/accountEpoch、操作ID；用户已关闭则可更新真实业务状态/同步状态，但不得重开旧详情或写已销毁Label。用户关闭后10秒SDK才回来的情况也要测。
6. 同一semanticKey重复点只聚焦已有详情，不叠10层；另一员工详情明确替换/导航，仍由用户发起。返回栈只保留可恢复的有效实例，不能月结后stack里一堆closed=false死节点。
7. 真正上下文失效（本人确认重开/选择另一云进度/切账号/注销平台会话需保护隐私/应用销毁）允许reason=context-invalidated强制结束旧上下文；必须有明确说明或对应用户动作，不能把普通revision递增当失效。安全规则不能让A账号详情留在B账号屏幕上。

### 22.8 读详情时数据变化：快照、更新提示和过期确认

本项目数据每月变更，**默认详情显示打开时快照**，标“截至第X年Y月”；只读阅读不用全局暂停经营。年报本来是固定年度快照，不随当前年月变化重新指向最新年。员工/部门详情绑定ID，不绑定列表index，月份刷新后仍是同一员工/部门。

若后台有新数据：在不抢滚动的预留状态区显示“数据已更新，可手动刷新”，用户点“更新数据”才重取VM，在同一弹窗更新内容并尽量保持锚点；不能整个overlay销毁再打开。快照模式不是隐瞒实时值，标题/说明明确时间。若选择对少量数字实时更新，也必须在预留尺寸内、保留滚动与实体且有完整回归，首版不建议扩大范围。

用户阅读期间员工被调岗生效/离岗、候选offer失效、现金变化：详情仍可读原快照，操作按钮变为“状态已变化，请更新后操作”等明确状态。点击裁员/调岗/招聘等命令前从Facade重取**当前**资格和费用；不得直接用阅读快照执行扣费。

现确认token到期（如60秒）只影响确认能力，不能让详情页倒计时关闭。确认窗标“报价已失效，请更新费用”，保留输入与正文，按钮“重新核对”生成新的预览/明确展示新金额，用户重新确认；不静默刷新token后自动支付。已发起的同意图commandId重试仍幂等，不能因UI重绘换ID重复收费。

未知保存/广告发券进入恢复时，可在顶层显示必要恢复状态，但保留底层阅读上下文；结果核对后用户继续原详情，不自动重播广告。云导入/切run确属安全上下文变化则按上节处理，用户已主动确认导入的动作不能被一个旧detail阻止事务收口。

### 22.9 弹窗布局、标题/正文/操作区与安全区

沿现scrollable scaffold统一，全部包含可用安全矩形，不按烘焙背景9:20把手机固定成812高。可用宽`min(推荐宽, safeContentWidth-2*margin)`，可用高为viewport-safeInsets-上下margin。标题/正文/footer高度分别量取，body仅占剩余空间，最小可读高不足时改为更接近全屏sheet而非把正文塞到footer后。

标题最多2行，副标题单独槽，实际变高则titleHeight随之增加；不要固定56却放长员工名/云冲突说明。footer先按按钮组计算48高+间隔+padding，再算body；两行按钮需要相应高度，不让第二行掉出卡片。只有关闭的只读详情可用单个全宽48高按钮；员工详情的调岗/裁员放正文独立操作组或足够宽的footer组，所有组遵守同尺寸规则。

正文为独立ScrollView，文字按Layout纵向流；error提示宽=body有效宽-padding，不是card.width。busyText/error状态改变后重测可读区域，正文滚到末尾与底部固定按钮至少留12间距；标题/页脚区域不可被正文滚动盖住。

键盘显示时只缩/移当前form卡片可视区域，不重建dialog或丢输入；关闭键盘不是关闭详情。safe-area/resize只relayout稳定节点，保留当前dialogId、输入、选项、滚动锚点。不要全Canvas统一缩小来“让所有东西塞进去”。

### 22.10 与云备份、冲突、真实榜和广告的合并实施要求

§21已有部分实现，续作时先读取§21.20和实际源文件，不照旧提示词重做Provider。此次两个UI问题是其UI接线与验收的基础前置：

| 前一专项 | 本节必须提供的保障 | 交叉验收 |
|---|---|---|
| 云上传状态 | uploading→verifying→synced只更新状态控件，不全页清modal | 员工详情打开期间完成上传/失败重试，详情不关 |
| 冲突整档选择 | 长摘要卡、选择操作区、manual保持 | 两份存档各长名/大金额，月结/后台回前台不丢选择；摘要过期仅要求重新核对 |
| 云恢复/删除确认 | 48高规范按钮、可取消阅读、事务不可重复 | 读取超时/删除未知不自动关重开；用户选定新run后明确结束旧详情 |
| 真实榜异步刷新 | 本地/真实层、资产/年限层各同宽同高；晚回调不改当前detail实体 | 查询完成/更新分数不清排行详情；本人数据变化不跳回公司页 |
| 广告/发券 | loading/busy文案不溢框，原生返回不重建层 | 用户主动看广告的层栈可恢复；广告/云回调不得在已手动关闭后重开招聘 |
| 旧R12存档恢复 | 页面保护层与业务锁分离 | 月结未知提交时详情保留、保护提示正确；重复点击不多扣/多券 |

整合顺序：先完成稳定Layer/DialogManager与基础尺寸，建立回归→再把§21剩余云操作/冲突/真实榜接在新组件上→补广告和导入交叉测试→最后统一四视口/长时间阅读/包体验证。本人后台授权/设备/隐私资料可依§21.17同时准备，不等待UI文档而停工。

### 22.11 自动化检查必须修正：真实几何与负例

当前CanvasDriver在拿不到UITransform时用1×1回退，原断言width>0就可通过；这只能用于定位近似点，不能充当布局/触区验收。新增专用geometryProbe：先确认当前Cocos导出的组件类型（本项目构建可能是`cc.UITransformComponent`而非`cc.UITransform`），必要时用已核组件访问方式；拿不到真实bounds返回`GEOMETRY_UNAVAILABLE`并FAIL/BLOCKED，绝不返回1×1算PASS。

测量至少包括：button实际框/点击框、对应Label文本框/行数、card textSlot/actionSlot、content/Mask裁切区、安全矩形、节点active/opacity。坐标统一转到Canvas逻辑单位并另算CSS/屏幕有效大小，避免把逻辑宽与屏幕宽混比。忽略故意属于按钮内部的Label/背景层，但不能忽略跨slot文字。

几何规则：

- 同操作组height相同、baseline/centerY对齐（允许误差1逻辑单位），同列左右边界对齐。
- 所有参与点击的button hitbox有效至少44×44屏幕CSS等效，且与相邻hitbox间距≥8逻辑单位；字体/背景不为零，不被上层截走。
- 文本保留框与ActionSlot不相交；footer不和body可见区域相交；卡片所有非装饰内容在有效边界内。
- 单行按钮Label不超过contentWidth/height；标题/正文长文有可达末尾，不靠SHRINK掩盖。
- 包括Mask实际可见矩形：离屏虚拟卡不当作屏内重叠错误，但进入视口后必须正确；无效测量不跳过算PASS。

必要负例至少4个：故意按钮覆盖金额、故意实际hitbox变成1×1、长按钮文案超框、标题增高但body未移；均应让测试失败并产出定位JSON+截图。负例在测试夹具/隔离构建，不把写状态hook留生产包，不通过改宽松阈值让坏布局绿。

当前28项主Tab和设置导航依旧有价值，但未覆盖“打开详情等待一个月”，也未证明按钮无重叠。R39必须补此维度，不能再拿导航PASS作为全UI合格证据。

### 22.12 详情生命周期与布局专项验收矩阵

新增测试建议（待实现/复用）：`tests/unit/uiMetrics.test.ts`、`actionRowLayout.test.ts`、`dialogSessionModel.test.ts`；现`dialogModel`测试保留；`tools/e2e/detail-lifetime.cjs`、`ui-geometry-matrix.cjs`。已有文件先核实再新增，不照抄不存在命令。复现脚本在evidence仅用于本次问题证明，不能把它错误地视为修复后的PASS用例。

| 用例 | 输入/动作 | 放行断言 |
|---|---|---|
| D01 | 5×打开员工详情至少30秒，跨≥3次月结 | dialogId/实体不变、可读/可滚/可关闭；后台存档月份确实前进，不是暂停clock假通过 |
| D02 | 部门详情、排行详情、历史年报各保持≥15秒；其中一个跨年 | 持续显示，无destroy/reopen；年报仍所选年度 |
| D03 | 暂停/1×/2×/5×分别打开同详情；保持/关闭再开 | 用户speed选择不被详情改，慢速不必每项等整年但有真实提交刷新注入/观察 |
| D04 | 详情正文滚到中间→月结→resize→云状态回调 | 滚动锚点/选中实体不丢，无回顶部/文字被footer挡 |
| D05 | 打开员工详情→裁员确认→取消→关闭详情 | 返回正确同员工同位置；取消零现金/员工/券变化 |
| D06 | 确认窗停留超预览TTL | 不自动关闭；确认无效，重核金额后须用户重新点击 |
| D07 | 100次打开/关闭、10次返回键、重复close | stack/listener/node数量回基线，不一次返回清两层、不开幽灵窗 |
| D08 | 用户关详情后异步响应；旧run/换账号后晚回调 | 不重开/不写坏节点；不得跨账号显示私有进度 |
| D09 | 云导入/本人确认重开 | 仅在明确上下文变更处关闭旧详情，清理reason可追溯；不阻事务、不复活旧run |
| G01 | 四视口375×812/360×640/375×834/390×844 | 页面/主要弹窗真实几何合规、无1×1伪测量 |
| G02 | 最长公司名/员工名、2行标题、大金额、长错误/busy | 同级按钮一致，文字可见可达，无跨slot交叠 |
| G03 | 0/2/30/100员工、所有部门、100年报末项 | pool行高/offset正确，底项按钮不被Tab挡、点击不串实体 |
| G04 | 设置/招聘/投资/补偿/云冲突/备份/删除/隐私完整操作 | footer同组规范、交互有效、取消无副作用，费用/数据不误变 |
| G05 | 四种故意坏布局负例 | 全部FAIL；实际正常矩阵PASS |
| X01 | 在线经营+详情+云上传/榜查询同时完成 | 数据成功更新但详情保持；关闭后底页为最新状态 |
| X02 | 广告返回/恢复未决保存/真实后台恢复 | 普通详情仍存活，必要保护层可用，事务只一次 |

证据不要只在time=0截图：每类详情至少t=0/5/15/30的存在采样，记录opened/closed reason、run/account epoch、month/revision、selectedEntity、scrollAnchor、dialog节点UUID、stack长度。真机补Tap原生返回、前后台、键盘、安全区和相同包SHA；Web模拟不等于平台支持。

### 22.13 逐文件实施清单与新增任务

本表保留任务设计；初始登记均TODO。2026-11-05提交`6e85b08`已局部实施02/03，最新独立复核和逐任务状态见§23，不能继续把这两项描述为完全未开始，也不能将局部改动计为整个专项DONE。与M3-11合并按依赖执行，初期不需要新素材。

| TASK | 实施内容/文件 | 依赖 | 验收 |
|---|---|---|---|
| 01 | 复核本节复现、70处按钮/原始overlay清单；记录当前源指纹/已有云接线 | 无 | 明确哪些受root重绘、哪些timer/SDK导致；每项有入口与截图 |
| 02 | uiMetrics/textTokens、Button专属Label、ActionRow布局纯函数/组件 | 01 | 同级48高、等宽/换行、真实hitbox/Label一致；负例可检出 |
| 03 | AppRoot稳定Page/Modal/Toast层，clearPage与dispose拆分 | 01 | D01先通过；经营仍前进；overlay检查不再root子节点猜测 |
| 04 | dialogs/DialogManager、stack/事件/外毁dispose、close reason | 03 | 读详情manual、确认幂等不松绑；D05—D09无监听泄漏 |
| 05 | employee/department/rank/annual等快照详情与更新提示 | 04 | 不跳实体/年度/滚动，过期只失效操作而不关窗 |
| 06 | 公司/部门/人才/排行/招聘/设置的分区与按钮组迁移 | 02/03 | 动态文字/长金额/虚拟卡高度正确，保留R30安全间距 |
| 07 | §21现有cloud/榜模块接线迁入新UI；完成其冲突/恢复剩余UI | 02—06；M3-11对应前置 | 所有云/榜晚回调不销毁详情；不重造已存在Provider |
| 08 | 修geometryProbe/CanvasDriver能力，补四个负例与全矩阵 | 02—07 | 无1×1回退假PASS；G/X矩阵及持续阅读通过 |
| 09 | 全量类型/代码/单元、受影响财务/存档回归与长跑 | 08 | 原黄金值不改；详情30秒多月、100次开关、节点监听稳定 |
| 10 | 新Web/普通Tap候选构建、截图/录像及文档交付 | 09/§21外部条件 | 新releaseId/版本/hash/manifest，UI+云榜广告分层状态准确 |

预期修改入口：`AppView.ts`、`UiFactory.ts`、`textTokens.ts`、`dialogs.ts`、`dialogModel.ts`、`shellLayout.ts`，新增必要`uiMetrics/ActionRow/DialogManager/dialogSessionModel`；现云/榜协调的UI回调、测试driver。只改变UI不得顺手改经济/离线倍率或平台API；发现§21其它实际业务缺陷按原任务修并单独证据。

### 22.14 执行顺序、命令和前后质量门禁

推荐批次：①稳定弹窗生命周期（03/04）先阻断最明显丢页；②规格/布局和逐页迁移（02/05/06）；③云/榜/广告现有及剩余接线（07和M3-11未完）；④几何负例/持续阅读/完整UI/财务存档（08/09）；⑤新包/同包平台验证（10）。01始终先做，02和03可顺序独立准备；不要求盲目一次大改全AppView。

```powershell
Set-Location -LiteralPath 'D:\Workspace\TapTap\我是CEO'
git status --short
# 先读取实际脚本/新增测试，完成实现后跑对应聚焦项；再：
npm run check
if ($LASTEXITCODE -ne 0) { throw 'Code gates failed' }
# 新detail-lifetime/geometry脚本先实现并核help，显式传本次Web URL与新输出目录。
# 不用5秒截图代替30秒采样，不自动setSpeed(0)来使详情不关闭。
# 最终构建沿§20.11：新releaseId/核实版本/真实Creator构建/verify/manifest，无SkipBuild。
```

每一批次复读当前源码，防云/榜执行agent已修改同文件时覆盖。证据放新attempt，不覆盖本节FAIL复现或上一轮候选。Web构建使用实际index所在目录，已有嵌套web-preview/web-mobile需明确，避免把404误判游戏白屏。停止自己启动的测试服务，不清理他人进程。

最终通过标准：**全量代码门禁+真实几何检查+故意坏布局负例+至少一详情30秒且后台多月前进+全页/全详情四视口图像复核+业务/存档无回归**。Tap真机未测分开NOT_RUN；仅静态包PASS、28项主Tab导航或无pageerror都不能关闭本节。若纯只读详情还会自动消失或金额仍被按钮挡，阻断产品候选验收，不以“文字游戏先将就”降级。

### 22.15 与本人操作清单的关系

这两项整改不需要本人额外提供素材、账号密码或服务器，也不必等真实广告/云权限才能在本地修复。复用当前颜色/字体/背景即可。需要本人提供的仍是§21.17的官方授权/正确游戏、云/榜能力、两个测试账号两台设备、隐私URL/平台资料、广告状态、资质及素材。

开发完成后本人主要验收：5×打开员工/部门/年报详情，停留30秒不点关闭，观察仍可阅读/滚动；自己点关闭才回底页；在常用手机核按钮大小/对齐/长文字/底部安全区；有云配置后同时触发同步，详情不关。此手动体验不能替代agent的自动化与账本测试，但能验证最直接的用户感受。用户原先报告已足够定位，本轮不再要求你先录屏才能开展。

### 22.16 合并前一专项的完整执行提示词（最新入口）

```text
你接手 D:\Workspace\TapTap\我是CEO。目标是完成原发布/广告整改、玩家云备份/跨设备恢复+真实玩家榜，并首先修复用户新增的UI不整齐/遮字和详情3—5秒自动关闭。按现有实现续做，不从头重写。

先读 AGENT.md、skills/taptap-mini-game-publisher/SKILL.md、总览§20.16—20.18、§21（含21.20执行事实）及§22全文。唯一权威文档是 docs/我是CEO_项目总览.md，不新建平行PRD。参考ui-ux-pro-max的触控/间距/状态保留要求，落实为Cocos组件，不引入React/CSS框架。读取git status和最新源码，保护大量未提交/未跟踪改动及历史ZIP/失败证据；相关云/榜Provider/服务/部分设置已存在，要核缺项后复用。

已确认用户规则：云存档只用于玩家自己的备份/跨设备，不做运营后台；增加真实玩家榜并保留本地模拟榜；普通只读详情由用户自己关闭，不能因时间/月结/云刷新关闭；同级按钮统一且不得遮文字；广告每日可跳过，只免一次招聘费、工资照付、首聘排除。继续Cocos普通Tap小游戏，不改H5/Lua、不扩展多人/内购/后台经济控制。

本轮真实复现位于 evidence/planning-ui-20261105/attempt-02：5×打开员工详情后约3802ms被关闭，1月→2月/revision13→17；没有点关闭且无浏览器错误。根因链是clockTick月结调用render→clearRoot.destroyAllChildren，而ModalOverlay也在root下。别把详情当toast，别把倒计时延长或把时钟暂停当修复。

按 TASK-M3-12-01—10与M3-11未完成项合并推进：
1. 先盘点全部页面/弹窗、按钮和异步render路径，记录当前源指纹。把AppRoot分成稳定PageLayer/ModalLayer/ToastLayer；普通刷新只清/更新页面，真正应用销毁/明确上下文变化才dispose。月结/年结必须继续真实经营并保存，不得用全局if(modalOpen)return跳过业务时钟。
2. 复用dialogs/ConfirmGuard增加统一DialogManager、semantic key、ownerRun/account epoch、close reason和幂等清理。普通详情manual；返回键只关最上层；提交/unknown保持事务安全。旧回调不能重开已关窗，外部销毁不能留下dialogStack死节点。
3. 详情按打开时快照标截至年月，更新时保留dialogId/实体/滚动；月结只提示可更新。操作前重取当前资格/费用，确认到期仅失效按钮并要求重新核对，不自动关窗/自动支付。用户明确重开/导入另一进度/切账号可按context-invalidated清旧上下文，普通revision变化不算失效。
4. 按§22.4建立有限按钮规格和ActionRow：同级通常48逻辑高、同行等宽、间距至少8、文字/动作分区；实际hitbox与父布局使用同一resolved metrics。按钮Label专属单行CENTER/CENTER，长文改行/改布局，不靠SHRINK/clip。卡片按正文实际高度增长；虚拟列表同步改rowHeight/step，不串员工。
5. 迁移公司/部门/人才/排行/招聘/设置/全部详情；云冲突/恢复/备份/删除UI用相同组件。保证长名、大金额、长错误、busy文案、safe-area/键盘/resize，不能只修一页几处坐标。modal存在检查改为manager，不再猜root.children。
6. 接着完成§21.20尚未完成的云操作UI/分支选择/账户绑定/旧run屏障、真实榜latest/0值、隐私/SDK与两设备验收；复用已有模块。云上传/榜查询回调只更新状态，不全页清模态层。先修§20实际仍存的广告/存档缺陷，避免云恢复重复券/离线收益。
7. 修测试几何读取：无真实UITransform/bounds不能回退1×1当PASS。加入覆盖金额/1×1热区/长按钮/标题挤正文4种负例必须FAIL。补四视口全页+详情+长文/错误/键盘/云冲突，不把28项导航PASS当完整视觉合格。
8. 按§22.12跑持续阅读：至少一详情5×停30秒、跨≥3月，后台年月/revision真前进、dialog实体/滚动不变；部门/排行/年报各15秒，跨年/resize/云回调；100次开关栈/节点监听回基线，确认取消零副作用。再跑全量npm run check和受影响账本/存档/广告/云导入回归，不改黄金值造通过。
9. 本地门禁齐备后新releaseId真实Creator构建、最终ZIP配置/资源/版本/指纹verify、skill preflight、唯一SHA/manifest。普通game.zip不走H5上传。真实广告/云/榜/设备未核时保持相应disabled和BLOCKED，不假填ID或验证字段。上传开发版、远端创建/删除、部署、提审/发布按已有明确授权执行，缺授权交付具体候选包和本人步骤。

独立本地修复不等后台资料；本人事项仍§21.17，无需为UI额外购买服务或提供密码/Secret/token。不要反复要求用户录屏证明已复现的问题。每批按依赖完成可验证结果、回填总览和新attempt，不覆盖旧证据，不清理/提交/push他人工作。

最后报告：两个用户问题各自根因/修改/真实验证/剩余缺口；M3-12和M3-11逐项PASS/FAIL/BLOCKED/NOT_RUN；运行30秒详情与后台月结证据、四视口截图与几何负例、全量测试；唯一ZIP绝对路径/version/releaseId/用途/云榜广告环境/size/SHA/manifest；本地质量、静态包、平台运行、可提审四层结论及本人下一操作。只要详情仍自行消失或控件遮住金额，不宣布UI验收完成。
```

### 22.17 本轮交付与文档验证边界

本轮已完成实际源码分析、skill规则检索和浏览器FAIL复现，并追加本节、DEC-045/046与AGENT规则。最新既有云/榜代码和§21.20作为续做基线，未为方便写方案而退回旧版。新增的尺寸/DialogManager/测试脚本是设计交接，不是已实现。

本轮没有修改生产UI/领域源码，没有新包/后台写操作/提交或发布。文档校验包括章节/任务计数、编码、围栏、引用文件存在及git diff --check；复现结果证明bug存在，不标成修复PASS。最终由执行agent按§22.16合并实施，§21.17的本人准备工作可同时推进。


## 23. 三层UI局部改动验收与下一阶段执行设计（2026-11-05）

本节复核执行agent所报“两文件+65/-16”，补充下一阶段的实施契约，不重做§21/22已经正确的部分。当前事实、任务状态与推进顺序以本节为准；用户确认的经营规则不变。最新执行提示词改用§23.12；§22.16保留历史原文。

### 23.1 验收对象与结论口径

- 本地提交6e85b08，父提交e4500a9；实际修改AppView.ts、UiFactory.ts，+65/-16。提交存在可核，不据此推断远端推送、平台上传或发布已完成；本轮不执行此类动作。
- 三层PageLayer/ModalLayer/ToastLayer实际存在，render改为clearPageContent；页面、弹窗、toast父层已迁移，每日广告提示互斥检查改查ModalLayer。方向正确，继续保留。
- ButtonLabel采用touch.width-16和水平/垂直居中、单行。该补丁只解决文字定位的一部分，没有完成同级按钮统一尺寸、长文案适配、文字与操作区隔离及全页迁移。
- 本机重新运行npm run check退出0：core/UI类型检查、lint和完整Vitest通过，477 passed、1 skipped，62 files passed、1 skipped。日志evidence/acceptance-ui-20261105/npm-check.log。坏包负向测试打印VERIFY_FAIL是预期拒绝，不是测试失败。所报“全量9失败”在当前环境没有复现，不能据此建立“工具/包体卫生失败可忽略”的规则。
- 真实Cocos Web从当前源码重建通过，证据evidence/acceptance-ui-20261105/。充足现金夹具保持详情52.8秒、关闭前跨11个月并能手动关闭；原低现金夹具30秒进入危机后被新层遮挡、原关闭点击无效。前者是核心保持路径PASS，后者是交叉场景FAIL，两者均保留。§11.26记录细节；不能用旧cloud-rank候选验证本次提交。
- 总体验收口径：局部通过、专项未完成。保留正确分层，不把尚缺的会话清理、截至年月、分区布局、云操作接线及平台验证算作完成。

### 23.2 发现清单：已确认的代码缺口与运行风险分开记录

| 编号/级别 | 当前事实 | 必须完成的处理 |
|---|---|---|
| V23-01 / P1 | disposeApplication仅被旧clearRoot别名引用，而clearRoot无实际调用点 | 关司、替换世界的云导入、账号切换和应用重启应真正触发旧上下文失效，不是只新增一个方法 |
| V23-02 / P1 | 新源码30秒实测：第1→6月原员工详情同UUID，但经营困难覆盖它，原关闭按钮点击无效；截图已查看。render在DISTRESS仍无条件创建危机overlay | 同run/同危机语义去重；普通刷新不叠层，不抢占读详情；忽略后不立即再弹 |
| V23-03 / P1 | dialogStack仅在正常finish移除；overlay被外部destroy时未统一清理 | 最小增量注册/注销、外毁通知、幂等释放；不能等玩家遇到栈泄漏后才做 |
| V23-04 / P1 | clearPageContent仍销毁整页ScrollView | 保存并恢复Tab/filter/实体滚动锚点和必要输入草稿，详情关闭后不回首项 |
| V23-05 / P1 | createButton仅在opts.parent存在时才把Label挂到Button | Label必须无条件挂新Button；支持先创建、后挂载，无外层parent不能没有文字 |
| V23-06 / P1 | Overflow.NONE禁止换行但未测量长文案；lineHeight等于按钮高；员工footer前两按钮宽96、中心相距100，仅4逻辑单位间隔 | 文字使用语义字号/行高，按真实渲染宽度排按钮组；NONE不等于不会溢出 |
| V23-07 / P1 | 点击闭包判断初始opts.disabled，句柄会动态启禁Button | 使用当前运行态；初始禁用后启用必须可点，忙碌时必须零命令，不能只改透明度 |
| V23-08 / P1 | 详情Label实际上已由打开时查询结果生成静态字符串，但缺截至年月/版本提示 | 复用现有展示，补明确小型DTO和metadata；无需克隆整份GameState |
| V23-09 / P1 | 关司token过期路径先succeed再自动开新确认 | 保留原框、提示过期并禁用确认；用户手动重新预览才生成新token |
| V23-10 / P1 | setError用card总宽而非body内容宽；relayout不更新现存对话框 | 错误以实际内宽排版，resize同实例重排，长错误不盖footer |
| V23-11 / P1 | §21.20的04/07/08/09/10/11/13仍为PARTIAL | 继续账号隔离、冲突UI、重开、榜同步和广告交叉，不能概括“云榜已完成” |
| V23-12 / P2 | 恢复toast可能发生在buildRoot之前；启动重试可再次buildRoot；onDestroy仅解绑resize | 提示等Layer就绪；重试不叠AppRoot/时钟/平台监听；区分内容清理与组件销毁 |

V23-02的覆盖/点击受阻有本轮实际证据；重复叠层仍属于由代码确定需补验的风险。本表其它项是源码确认的缺口或风险，不伪称每项已有用户失败录像。无parent按钮、危机叠层等通过下一批最小负例验证；不能把风险预判写成已经实测FAIL。

### 23.3 批次A：环境与工具门禁可复现

目标是新执行agent干净检出后能跑检查，不靠当前机器碰巧存在的忽略文件。不得以baseline标签豁免发布门禁。

1. 沿用根package-lock.json、Creator3.8.8、插件1.2.2及插件独立package-lock.json。根执行npm ci，扩展执行npm ci --prefix extensions/taptap-minigame-tools。现repack-release.cjs从插件node_modules/archiver加载，本机实际5.3.2；不是“缺npm zip”，不安装不相关zip库，也不无故重写打包器。
2. 修packageHygiene.test.ts环境耦合：可提交example检查字段契约与无凭据；解析器使用临时/内存夹具验证缺失→安全空配置、合法值、非法值→明确回退。不能要求每台机器必须有被gitignore的runtime.config.json，也不能强制用户真实URL为空。最终生产ZIP的安全/隐私/广告配置由发布校验继续严格检查。
3. 初始化如需生成本地runtime文件，只在不存在时写空authEndpoint/privacyPolicyUrl；已有文件不覆盖、不打印内容。example的.example.com是示例，不作为可用登录或政策地址，不复制后声称已联通。
4. 复用现setup文档/入口写清根依赖、扩展依赖和Creator路径；Node/npm记录实际版本与lock兼容性，不猜版本。不改变原配置安全边界。
5. 在独立临时工作区验证干净检出初始化，不清空当前node_modules、不删除用户配置、不reset工作区。构建工具单测的临时输出不依赖旧build。

完成条件：无私密runtime文件也能运行相关测试；根与插件按lock安装；npm run check和release工具正负例全绿。优先调整现有夹具，避免重复测试。

### 23.4 批次B：稳定三层的上下文、栈与幂等销毁

保留三层。以现DialogHandleImpl/ConfirmGuard为中心增量实现最小registry；可以先放dialogs.ts，达到职责边界后再决定是否拆文件，不为框架形式重写所有弹窗。

建议记录owner：
~~~ts
type DialogOwner = {
  runId: string;
  accountEpoch: string;
  contextEpoch: number;
  entityId?: string;
};
type CloseReason = 'user-close' | 'user-back' | 'submit-success'
  | 'context-invalidated' | 'application-dispose';
~~~

contextEpoch是UI运行期上下文代际，不用普通存档revision代替；月份变化不让所有弹窗过期。

- registry负责register、unregisterOnce、top、hasSemanticKey、invalidateOwner。每个会话记录UUID、类型、semanticKey、owner、关闭回调。现原始settings、危机、广告提示、离线摘要、隐私overlay也需最薄注册适配，不能只管ScrollableDialog。
- finish(reason)顺序：标closed→移栈→解绑自己的事件/调度→执行一次onClose→销毁自己拥有的overlay。重复close/cancel/onDestroy不重复提交或取消。回调抛错时仍在finally完成资源释放，报告错误，不无声中断后续清理。
- 给overlay挂最小onDestroy生命周期组件，或复用经过验证的引擎通知。不要假设destroy当帧立即完成，也不要编造Node不存在的销毁事件。外部销毁只清UI，不模拟用户取消，不回滚已提交事务。
- 普通详情手动关闭，遮罩不关闭；返回键只处理有效栈顶。busy/uncertain保留ConfirmGuard禁止关闭/重提。上下文失效时先隔离回调，按已有事务核对/恢复闸门处理，不能force-close掩盖未知扣费。
- 关司/云导入成功落盘后，才推进contextEpoch并失效旧owner，再渲染新世界。失败不清当前世界，unknown保持恢复闸门。账号切换推进accountEpoch，旧回调不能操作新账号。真实组件销毁才释放全部调度/平台订阅；换run不能永久停掉新run所需唯一时钟。
- async请求捕获owner/sessionId，回调先检查仍存活且同上下文，再改UI或开子窗。业务现有runId/commandId/idempotency不删除，UI栅栏不能代替业务栅栏。
- 危机改为ensureDistressNotice语义：同run同事件只入队一次，读详情时先留详情与非抢占提醒，用户关闭后处理危机；暂时忽略不每次render又弹。真正存档损坏/恢复闸门可覆盖最上层，但不暗中删除底层详情。
- 父详情开子确认，父会话与滚动仍在；取消子框回原父详情。动作成功可按明确交互关闭子框并标记父数据过期，不因取消生成另一员工。

验收：真实月结继续；关司/云导入/账号失效真实触发；旧回调不能复活；100次开关stack/自有监听回基线；busy/unknown仍拒绝重提。

### 23.5 批次C：详情快照、手动更新与动作重新预览

现详情字符串已是打开时取值，不为“快照”复制整份存档。各入口复用现查询，产生只包含展示字段的DTO，同时同步记录runId、entityId、asOfYear、asOfMonth、sourceRevision；领域计算留在原服务。

1. 标题仍简短“员工详情”，独立metadata行显示“数据截至：第1年2月”。游戏年月不能冒充真实公历YYYY-MM；云同步真实时间另标“最近备份时间”。历史年报固定第N年，不随下一年变成新报告。
2. 同run月结只通知“已有新数据”，显示一次刷新入口；不每月弹确认，不自动替正文、不自动关窗、不叠提示。不可变历史年报不必每月提示。
3. 用户手动刷新保持UUID、entityId和正文滚动锚点；重查同一实体，找不到时提示已离岗/不可操作，不跳到下一个员工。内容长短改变按首个可见字段ID恢复，缺失时夹到最近合法offset。
4. 点招聘/调岗/裁员/建部/扩产重新核对当前合法性、现金、费用和目标，生成新确认预览，不能把3个月前DTO中的裁后现金直接用于扣费。
5. TTL过期保留框和旧费用，加“已过期”说明，禁用提交；用户点“重新预览”才创建新token/意图。取消零扣费；失败显示原因；unknown按现事务核对，不解锁重复提交。
6. 页render前保存Tab/filter/rankMode和各列表scrollAnchor，布局完成后恢复。同集合优先entityId锚点，不用纯index绑定虚拟卡；输入草稿归会话持有，不因每月重建变默认值。
7. 页面刷新和详情刷新各有边界：后台更新底页可显示最新数据，仍在读的详情保持其打开时快照并清楚标记；两者不同步不是错误，也不能混用月份。

验收：30秒跨月同窗/同员工/同滚动；截至月份正确；新数据单次提示；手动刷新与同次查询一致；过期框不自行关开。

### 23.6 批次D1：按钮、操作行与卡片测量

继续§22.4/22.5，不把居中补丁当整个02完成。当前代码生成Cocos UI可以直接调整，不强迫改Prefab或只允许编辑器操作，也不做4200行AppView全面拆分。

- 工厂：Label无条件挂Button；布局前可取得实际resolved尺寸；字体/行高按角色，不用rectHeight当lineHeight。任意Overflow模式都以渲染后的文字bbox不超分配区为准，不能只断言enableWrapText=false。
- 长文案优先缩短动作名、金额/说明移正文；必要时整组换行或两行64高，不裁字、不SHRINK缩字号。临时隐藏溢出文字不是修复。
- 常规按钮48高、同组等高等宽；row-action推荐80宽；icon48方形；真实可点击至少44×44，热区gap至少8；文本与操作区间距至少12。同级一致不等于全游戏所有按钮同宽。
- ActionRow：父内宽W、n按钮、gap8，每按钮(W-(n-1)*8)/n。先测文本所需宽度（含左右padding），再决定一行/两行/单列；工厂撑宽后不得仍按旧宽排。让布局与几何测试共享resolvedRects，避免各猜一次尺寸。
- Label行高用现15/21等令牌，布局需要时统一升级到15/22；保持现正文下限，不靠11px缩字挤进按钮。所有动态Label测量完成后再排下一块区域。
- setError从body实际width减padding计算；标题/副标题/metadata独立测量，不能永远titleY-24。长错误在正文滚动，不盖footer。
- setEnabled、初始disabled、interactable与事件判断读同一当前状态；禁用视觉与交互一起更新，业务入口仍检查guard。测试“初始禁用→启用可点”和“启用→busy不可点”，避免闭包卡死。

### 23.7 批次D2：逐页面分区迁移清单

| 页面 | 具体实现 | 完成条件 |
|---|---|---|
| 公司 | 倍速成组；财务值区与详情/投资区分开；底部动作按实际宽高定位 | 长公司名、负利润、大金额不遮；倍速仍实际推进 |
| 部门 | 名称/人数/工资/效益分区，创建/详情独立操作列；编制+-与模式成组 | 6部门、0员工、已满/不足现金；建部单扣、取消零变更 |
| 人才 | 筛选组统一行高，首卡依据实际行数；名字/能力/薪资/状态留位；动作独立 | 0/2/30/100人、调岗与离岗长状态；pool按employeeId不串；尾项可达，筛选与首卡gap≥8 |
| 本地/真实榜 | 名次/名称/资产独立列；榜类型与公开榜入口分行 | 并列、大金额无盖字；断网本地榜可玩；disabled不冒充在线 |
| 招聘/投资/裁员/关司 | 影响/报价正文，确认取消等宽，独立过期/失败/unknown状态 | 现金变化、已离职、旧run、连点、TTL、取消真实正确 |
| 设置/隐私/帮助 | 固定560高settings改为滚动正文+固定footer，开关与说明分行；开关就地更新 | 360×640能读到最后与关闭；长政策/错误不覆盖，不销毁重开 |
| 年报/财务/企业详情 | metadata/主体/现金桥/操作分区，长说明撑高 | 100历史报表、老档缺现金桥诚实提示、负值与持续阅读 |
| 启动/离线/危机/恢复 | 统一会话注册、Layer就绪后toast、离线摘要与render共存、危机去重 | 重试不叠root/时钟；摘要不立即消失；保护层有效、旧回调不复活 |
| 云备份/整档恢复/冲突 | 复用通用分区，summary/时间/分支/操作分行 | 取消、断网、unknown、失败不清本机档；成功才换上下文 |

逐页迁移逐页验收；已有renderCompanyTab等继续使用。“分区迁移”指文字和动作职责清楚，不等于必须拆成大量文件或编辑器重做。

### 23.8 批次E：云备份、真实榜与广告接线

沿§21.20既有Provider/Codec/Store补缺，不重新实现已经通过的纯服务。

1. 能力/账号闸门：真实能力未确认保持disabled；Fake仅本地并明确标识。缺稳定最小账号标识不能以昵称/设备号猜身份，不能自动把旧档绑定新账号。切账号推进accountEpoch，隔离未决请求。
2. 设置入口：云状态至少未启用、待授权、本地未同步、同步中、已同步、失败、结果待核。手动备份调用现CloudSyncService；unknown复用意图、先对账，不盲目再create。回调只改本会话Label，不render全应用。
3. 云档列表/对比：先list/codec验证，展示游戏截至年月、真实备份时间、schema/版本及分支关系；不同账号/损坏/不兼容不能导入。选列表是只读，不改现金/员工/离线水位。
4. 整档恢复：明确替换当前经营，先保留本机档；确认走已有Store事务，成功才更新contextEpoch、失效旧UI、渲染新世界。取消零变更，失败回旧档，unknown保持闸门；保留本机广告券/完成账本口径，不导入远端券再领一次，不重复结离线。
5. 分支与重开：多设备只允许明确整档选择，不合并现金/员工；不按revision/现金/设备时间强行选胜。云resetEpoch跨设备确认、quota/GC按§21待核条件处理，不擅自删除远端档。
6. 榜同步：现LeaderboardSyncService挂到已提交且云确认的checkpoint后，公开同意独立；两榜部分失败分别恢复。当前资产/完成年限不变；latest/降分/0未核不能改best/sum绕过；打开榜不触发自动同意或全档上传。
7. 广告交叉：沿现日额度与reward session；看完只免招聘费、工资照付、次月生效、首聘排除。补loading取消、SDK hide/close顺序、跨日/D+7、云恢复/旧run回调矩阵。普通详情不暂停经营；广告展示的既有在线/离线隔离规则不扩展到所有弹窗。
8. 政策与平台：按§21.17准备主体/App、两账号两设备、云权限/配额、榜ID/白名单、广告和真实隐私资料。缺外部条件只阻塞对应真实验收，本地UI/Fake故障流程继续。布局不需要购买服务器或经营数据库。

### 23.9 验收矩阵：实际行为、实际几何、故意坏布局

复用§22.12和现CanvasDriver，不新增一套只测导航的“全绿”来替代。

| ID | 场景 | 必须核对 |
|---|---|---|
| V01 | 375×812/100人/5×员工详情30秒 | 同UUID/employeeId，存档真实跨≥3月且revision前进，手动关闭才消失 |
| V02 | 部门/财务/年报/设置/离线摘要，含年结 | 同实例、正确截至年月；历史年报不跳年度；普通详情不阻月结 |
| V03 | 长列表中部开详情，跨月关闭 | Tab/filter/首个可见实体及相对offset保留，不回首卡 |
| V04 | 同危机反复render | 同semanticKey最多1，忽略后不立即再弹，不抹普通详情 |
| V05 | 父详情→子确认→取消，连续开关100次 | 父窗口保留，onClose最多一次，stack/节点/自有监听回基线 |
| V06 | 关司/云导入成功/换账号，旧请求迟到 | owner失效；不能改新档或重开旧窗；操作失败不清当前UI |
| V07 | TTL到期/费用与员工状态变化 | 原框仍在，旧token不能用，手动重新预览才更新；取消零扣费 |
| V08 | Button无parent后挂载，disabled↔enabled/busy | 文字存在，禁用零命令，恢复后一次命令，不被闭包锁死 |
| V09 | 四视口及坏布局 | hitbox≥44，同组一致、gap≥8；按钮不盖字；四种负例必须FAIL |
| V10 | resize/后台恢复/云榜查询结束 | UUID/实体/草稿/滚动保持；回调不关详情 |
| V11 | 干净检出无私密runtime，按lock初始化 | 所有必要检查和release正负例通过，不依赖隐藏本机文件 |
| V12 | 当前源码普通Tap新候选 | 指纹前后一致，ZIP校验、无Fake/写状态hook/凭据，不能用旧包代替 |

四视口沿用375×812、360×640、375×834、390×844，它们是CSS测试尺寸，不把某尺寸直接称作某真机型号。若产品确实支持平板，再增加768×1024等，不用大屏替代360小屏。

几何驱动取实际可用cc.UITransform或cc.UITransformComponent；缺能力FAIL/UNSUPPORTED，不回退1×1假PASS。测实际Button和渲染文字bbox，换算canvas scale，不只看声明width。四种负例：超长标题侵入正文、极窄按钮长文案、按钮盖金额、缺UITransform能力产生伪1×1。正常布局必须PASS，所有故意坏布局必须被检出FAIL。

证据记录t=0/5/15/30、owner/context、entity、UUID、年月/revision、滚动锚点、closeReason与stack；截图实际打开。金额/存档恢复/广告奖励需另查持久化状态，不能靠toast。探针可在隔离Web夹具检查scene，不把可写hook打入正式包。

### 23.10 原M3-12任务状态与推进顺序

| 原任务 | 当前状态 | 续做 |
|---|---|---|
| 01 | IN_PROGRESS | 原复现与本次diff已有，补overlay/页面清单 |
| 02 | IN_PROGRESS | 文字定位局部实现；补§23.6、V08/V09 |
| 03 | IN_PROGRESS | 三层已实现；单场景跨月及context/启动边界分别验收 |
| 04 | TODO | 最小registry/幂等清理/外毁/owner，不直接延期 |
| 05 | TODO | 复用静态显示，补截至年月/提示/刷新/过期 |
| 06 | TODO | 按§23.7逐页分区，不强制改Prefab |
| 07 | TODO | 补§21剩余云操作/冲突/账号/榜同步接线 |
| 08 | TODO | 实际几何、负例、全矩阵与callback交叉 |
| 09 | IN_PROGRESS | 当前477+1通过，最终变更后跑受影响专项与门禁 |
| 10 | TODO | 本轮Web是审查产物；整改完成再出普通Tap候选 |

顺序：A环境→B工厂明确缺口/稳定层上下文→C最小Dialog协调/快照→D逐页分区/几何→E云榜广告交叉→F必要门禁与新包。本地不等平台条件；每批验证后再往下推进。已绿模块只在受影响时复测，不无差别多轮重跑30分钟与900-run。

### 23.11 构建与本人操作

1. 从当前源码重建；本机已有Creator3.8.8、Chrome和可运行CanvasDriver，不能再笼统称“只有Node环境、无法引擎验证”。先查本项目Creator进程，按tools/run-cocos-build.cjs真实帮助和流水线参数，独立输出、真实日志。exit36必须结合doneMarker和新产物判断；若Creator忽略相对buildPath，核对实际新输出后转存隔离路径并记录，不假设目录名生效。
2. 本地整改通过后，调用tools/build-tap-v2.ps1实际参数ReleaseId/GameVersion/Attempt/Purpose，新的releaseId与按后台要求确定的版本；不覆盖cloud-rank-r1/05或旧ZIP。
3. 交付真实指纹、引擎/插件/版本、ZIP绝对路径、bytes、entries、SHA256、manifest和云榜广告环境。未完成平台验证保持disabled；Fake只在测试夹具，静态合格不证明真机广告或跨设备可用。
4. 四层分别写本地代码/流程、静态包、真实平台设备、可提审。必需门禁失败保留FAIL，不能改名baseline后出“合格包”。
5. 本人仍按§21.17提供官方授权/正确App、两账号两设备、云权限/配额/隔离/删除方式、榜配置与白名单、广告状态、公开隐私URL和资料。只需脱敏ID/状态/机型等；不发送密码/Token/Cookie/Secret。无需额外提供新UI素材。
6. 本轮为审查和方案，没有新增推送、上传、后台配置、提审、发布授权。先完成本地可验证部分，具体外部写操作按届时真实授权范围执行；此前报告发生过Git推送不等于本轮继续推送授权。

### 23.12 交给执行agent的完整提示词（最新）

~~~text
接手 D:\Workspace\TapTap\我是CEO，按AGENT.md、总览§21.20、§22及最新§23推进。§23是提交6e85b08的独立验收差异与下一阶段契约。保留已正确的Page/Modal/Toast分层和Button居中，不回滚、不重做现有云Provider/Codec/Store。先读git status及相关代码，保护其他修改；不要顺手提交/推送。

当前独立全量477 passed/1 skipped，core/UI类型与lint通过；报告9项baseline失败本机未复现。按§23.3补干净检出初始化，使用根/扩展lock与现archiver，不装不相关zip库；测试不依赖私密runtime，不覆盖用户配置，不删测试/改黄金值，不豁免包体卫生。

按§23.10顺序完成本地剩余：Button无parent Label挂载、当前disabled状态、长文案测量；三层真实context失效调用点及启动重试生命周期；复用DialogHandle/ConfirmGuard做最小registry、owner、semanticKey、幂等finish和外毁清理，修危机叠层、旧回调与stack泄漏。无需另造大框架。普通详情manual，busy/unknown仍受事务保护。

按§23.5复用现详情静态快照，加数据截至第N年M月、新数据单次提示和手动刷新，保持UUID/实体/滚动；月结不失效owner也不暂停经营。动作取当前合法性/费用重新预览；TTL过期保留原框，手动重预览才更新，不自动关开。页面重建保留filter/scroll/entity/input。

按§23.6/23.7与§22.4统一同级48高/等宽/gap≥8，先resolved尺寸再排位置；分离文字和动作，保留R30首卡间距，人才卡高度/step/ID一致。设置改滚动正文固定操作，长错误按body实际宽，resize保持现窗。沿现Cocos代码UI，不强迫Prefab重做或全面拆4200行文件。

按§23.8续做§21账号闸门、云备份状态/列表/整档恢复/分支与重开、云确认后榜同步、广告与云导入交叉。范围：只玩家备份跨设备，不建运营后台；真实榜保留本地榜；每日广告可跳过，只免招聘费、照付工资、次月生效、首聘排除。未知平台能力保持disabled，Fake不入生产，不猜账号/广告位/配额，不合并现金员工，不改latest为best。

实际跑§23.9：新源码5×详情30秒、存档跨≥3月，核UUID/实体/滚动/月份/revision和手动关闭；再测年结、旧上下文、父子取消、TTL、100次开关、危机去重、四视口与四个故意坏布局。修CanvasDriver的UITransform判断，禁止1×1假PASS；截图打开检查，金额/恢复/广告核对存档。复用测试，通过后不无故重复长跑。

最后跑必要门禁，生成新releaseId普通Tap候选，记录真实指纹/版本/大小/SHA/manifest/环境；没有后台和设备条件不能声称真实云榜广告通过或可提审。外部写入包括推送/上传/广告配置/提审/发布未获本轮授权。按§21.17列本人事项，但继续所有不依赖外部条件的本地工作。

所有事实与M3-12/M3-11逐项状态回填唯一总览§11/§23，不新建平行状态/需求文档。报告本地、静态包、平台设备、可提审四层结果与FAIL/BLOCKED/NOT_RUN，不把代码存在、toast、HTTP200或旧包通过当本轮完成。
~~~

### 23.13 本轮边界

本轮只做独立检查、当前源码的必要本地Web验证及设计交接；未改生产UI/业务源码、未产新的正式Tap候选、未提交/推送、未执行平台写入。Web实测结论见§11.26及evidence/acceptance-ui-20261105最终产物。未运行的完整四视口/真机/云测不得沿用旧证据冒充本轮通过。

### 23.14 R31 实施与门禁结果（2026-11-06）

本节记录§23任务书按§23.12执行后的实际状态；详细数值、路径与四层结论见§11.27。

| 原任务 | 状态 | 本轮实际完成 / 证据 |
|---|---|---|
| 01 页面/遮罩清单 | DONE（本地） | 单场景 PageLayer/ModalLayer/ToastLayer 保留；弹窗统一走 `dialogs.ts` 会话登记，`dialogDebugSnapshot` 可查 kind/owner/semanticKey |
| 02 按钮/文字几何 | DONE（本地） | `uiMetrics.ts` 基线 48/44/8/12；公司/部门/人才/排行/设置逐页迁移；人才卡“详情”44→48；排行页重排后状态单行、我方摘要两行不压列表；四视口 28/28 PASS |
| 03 三层与上下文失效 | DONE（本地） | `contextEpoch`/`authEpoch`/owner 代际；`invalidateDialogs`、`blockSubmit`；启动重试先 `exitApplicationContext` 再重建；危机/详情/旧回调均不再改新档 |
| 04 弹窗 registry/幂等 | DONE（本地） | `DialogSessionModel` 去重、幂等 `finish`、外毁补注销、`pruneDialogs`；100 次开关 max=1；危机同 key 仅 1 个 |
| 05 快照/更新/过期 | DONE（本地） | 部门/员工详情“数据截至”、跨月单次提示、手动“更新数据”同窗口；TTL 60 秒过期保留原框 + “重新预览”后才提交；修复兜底文案覆盖结论的缺陷 |
| 06 逐页分区 | DONE（本地） | 设置改滚动正文+固定 footer；云按钮按 `cloudProfileBound` 禁用；年报/离线摘要/隐私/引导统一 48 高按钮与安全区 |
| 07 云/榜/广告接线 | PARTIAL | 代码路径与状态文案就绪；`profileId` 为空、榜 ID/白名单与广告位未配置，真实请求 NOT_RUN；页面不得显示“已启用” |
| 08 矩阵与负例 | DONE（本地） | `r31-matrix.cjs` 24/24 PASS（含 4 个注入坏布局全部 FAIL）；CanvasDriver 修复 UITransform 回退，避免 1×1 假 PASS |
| 09 全量门禁 | DONE | `npm run check` 退出 0：类型/lint/Vitest 493 passed |
| 10 新 Tap 候选 | DONE（静态包层） | `m4-20261106-r31`/1.0.0/01：4,627,082 bytes、462 entries、SHA256 `8637011a…1c1ebb26`；未上传未提审 |

**未完成/平台前置**：真机登录与账号绑定、平台云存档跨设备、真实榜后台 ID 与白名单、激励广告真机与配额、公开隐私 URL、备案/版号、后台提审发布。以上均为 BLOCKED/NOT_RUN，不因本地矩阵通过而改称完成。
