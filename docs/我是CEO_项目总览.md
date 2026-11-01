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
| R-013 | P0 | 排行榜：总资产、经营年限，均为虚拟企业 | 无服务器实时玩家排名 |
| R-014 | P0 | 设置 → 关闭公司 → 二次确认 → 本轮全部重置 | TapTap 账号与合规记录不在删档范围 |
| R-015 | P0 | 首次进入有逐步可点击指引；可跳过、回看、断点恢复 | 教程期间时钟暂停，必需的公司/首聘仍要完成 |
| R-016 | P0 | TapTap 普通小游戏可上传 ZIP 并在真机运行 | 备案/认证/提审属外部前置条件 |
| R-017 | P0 | 2D 竖屏、卡片式触摸 UI、不做复杂动画 | 四主 Tab：公司、部门、人才、排行 |
| R-018 | P0 | 连续 3 个年度净利润 > 0 达成目标后仍可继续经营 | 不是最终结局，也不强制重开 |
| R-019 | P1 | 经营诊断：提示当前限制收入的因素 | 只展示可解释原因，不做 AI 对话 |
| R-020 | P1 | 5 类轻度随机事件，每年最多 1 个 | 不做难以恢复的多级事件链 |

### 1.3 明确不做（禁止自行扩展）

跨行业、新增业务线、子公司、母集团、共享服务中心、股权/上市、并购、贷款与利息、真实竞争公司 AI、真实在线排行、广告、内购、多人联机、云存档、复杂生产/库存/税收、员工关系树、技能天赋树、3D 办公室、NPC 步行动画、强制任务关卡、对话式大模型接口、外部动态下发经营参数。

允许为未来扩展预留接口，**不允许实际开发第二阶段玩法**。

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
      platform/    ITapPlatform, MemoryStorage, EditorMockPlatform, TapPlatform(?) — 见实际目录
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
- 编辑器使用 `EditorMockPlatform`，**生产入口不 import Mock**（`packageHygiene.test` 静态约束 + 包体扫描，B16）。
- 平台异常统一转领域错误，禁止原始 `errMsg` 泄漏到玩家界面。
- 生命周期：`onHide` 暂停时钟、提交快照、记水位；`onShow` 先恢复/校验 runId → 结算离线 → 恢复在线时钟。

### 9.3 缓存限制（架构约束）

单 key ≤ 1MB、总 ≤ 10MB，加密时单 key ≈ 0.7MB。因此双槽 + 24 个月账本 + 历史裁剪；每槽 < 500KB。平台可能清理缓存，故不得宣传“永久云保存”。

### 9.4 登录与最小服务端

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

正式包不含密钥/Mock/Node 依赖；登录失败与断网有可解释恢复；存档不以账号信息作展示名；自定义输入严格过滤；无广告/内购入口或空白位；文案不承诺收益；核对适龄、隐私链接、字体素材许可；Android/iOS 各 1 台 + 两种比例 + 断网/权限拒绝/空间不足/升级迁移。

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

> 最后更新 2026-11-01（本次项目整理）。状态词只允许 `TODO / IN_PROGRESS / BLOCKED / READY_FOR_QA / DONE`。

### 11.1 里程碑总览

| 里程碑 | 状态 | 关键结论 |
|---|---|---|
| M0 基础工程 | READY_FOR_QA（核心全绿） | 工程/场景/四 Tab/公司+CEO 创建/首聘 2 人/双槽存档/关闭重开完成；真机项为外部前置 |
| M1 财务经营 | READY_FOR_QA（核心全绿） | 三行业黄金账分毫不差；在线时钟、跨年、扩产、年报完成 |
| M2 员工部门 | READY_FOR_QA（核心全绿） | 招聘/裁员/成长/五支持部门/三方针/自动招聘与管理 UI 完成 |
| M3 发布准备 | 代码与自动化 **可提审候选**；真机与提审 BLOCKED | 离线/事件/危机/双榜/隐私/登录/安全区/包体卫生/E2E 完成；205 用例全绿；Tap 包已产出 |

**自动化基线**：23 个测试文件、`npx vitest run` 全部通过（详见 §11.5 复核命令）；`npm run typecheck`、`npm run lint` 0 错误。

### 11.2 任务清单（M0–M3）

**M0**
| ID | 状态 | 内容 |
|---|---|---|
| M0-01 | DONE | Cocos 3.8.8 工程、Game.scene、四 Tab 壳、主题、竖屏（无头 Chromium 390×844 零 JS 错误验证） |
| M0-02 | DONE | `domain/{errors,result,command,money,types}`、错误码、严格 TS |
| M0-03 | DONE | `ITapPlatform` + `MemoryStorage` + `EditorMockPlatform` + `CocosPlatform`（Mock 不进生产包） |
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
**仓库**：分支 `main`，远端 `github.com/vinkinyyx/i-am-ceo`，最新提交 `0d2fac6`（修复真机卡加载页并完善创建流程交互）。整理类变更（文档合并与清理）尚未提交。
