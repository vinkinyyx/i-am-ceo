# Agent执行状态记录

> 本文件由各执行 Agent 持续更新；状态只允许 TODO / IN_PROGRESS / BLOCKED / READY_FOR_QA / DONE。
> 项目：《我是CEO》第一阶段 MVP（TapTap 普通小游戏，Cocos Creator 3.8.x + TypeScript）

## 当前整体状态

| 里程碑 | 状态 | 最后commit | 通过用例 | 未解决问题 |
|---|---|---|---|---|
| M0 | READY_FOR_QA（核心全绿，平台真机项 BLOCKED） | 128c0ad | 39 单测/集成全过；web-mobile 无头构建+Chromium 运行通过 | TapTap 官方适配扩展/AppID/真机为外部前置（ISSUE-ENV-02） |
| M1 | READY_FOR_QA（核心全绿，平台真机项 BLOCKED） | c4a8807 | 78 单测/黄金/集成全过；G001-G003 黄金账分毫不差；web-mobile 无头构建+Chromium 走通在线时钟/跨年/扩产/年报 | TapTap 真机、音频真机听感为外部项（ISSUE-ENV-02） |
| M2 | READY_FOR_QA（核心全绿，平台真机项 BLOCKED） | d0a6a9e | 99 单测/黄金/集成全过；G004/G005/G013/G014/G015 部门与裁员黄金用例；web-mobile 无头构建+Chromium 走通建部/招聘/裁员/调岗/方针 | TapTap 真机为外部项（ISSUE-ENV-02） |
| M3 | READY_FOR_QA→**代码/自动化 QA 通过，真机与提审仍 BLOCKED** | 5b00000 + 发布前补齐轮(未提交) | **204** 测试全过（含离线/事件/危机/榜单/35项Tap平台/安全区/隐私/登录/完整性/历史裁剪/包体卫生/E2E）；900 run 零负现金/零守恒失败；web-mobile 无头 Chromium 走通隐私首启→同意→创建流程零错误；v5.1 Tap 包 4.44MB（4,657,311B / 454 条目 / sha256 `6C204AFB…1415`）自检通过；G016 财务口径已修正；详见 evidence/QA_REPORT_M3_FINAL.md | iOS 真机、包体上传扫码自测、登录服务端真机联调、备案/软著、实机截图/录屏、提审需凭证 |

## 环境核查（2026-11-01）

| 项 | 结果 |
|---|---|
| 仓库性质 | **完整 Cocos Creator 3.8.8 游戏工程**（assets/ + tests/ + tools/ + docs/ + evidence/ + server/ + extensions/），最初仅为设计包，M0—M3 已落地全部代码 |
| Node / npm | v24.13.0 / 11.6.2 |
| Git | 2.53.0（仓库已初始化，分支 main，远端 github.com/vinkinyyx/i-am-ceo） |
| Python | 3.14.3 |
| 设计基线自检 | `python docs/工具/校验设计基线.py` → PASS（14 fixtures；仅证明设计参考自洽） |
| Cocos Creator 编辑器 | **已安装 3.8.8**：`C:\ProgramData\cocos\editors\Creator\3.8.8\CocosCreator.exe`（exe ProductVersion=3.8.8，2026-11-01 复核） |
| TapTap 适配扩展 | **官方 `taptap-minigame-tools` v1.2.2 已安装**至项目 `extensions/taptap-minigame-tools`（2026-11-01；官方 zip 多一层嵌套目录导致扩展管理器报"解压失败"，手动解压复制）；zip SHA256=`6B8A9A3CC62B6C54CEFAB397097BABB771D9D99F90442CDDFF06310A4C9ED73F`；`editor>=3.8.0` 覆盖 3.8.8；机制=构建微信小游戏→11 步转换→`build/TapBuild/game.zip`；CLI 无头构建已实际出包验证 |
| TapTap 凭证 | 开发者认证 DONE（个人主体）；小游戏 AppID=MiniApp ID 已获得（仅存本地未入库配置）；Server Secret/Client Token 仅服务端用途不入库 → M0-10/M3 剩余阻塞=真机自测与备案 |
| 设计文档版本 | V1.0；economy-v1.0.0 / golden-cases-v1.0.0 / save schemaVersion=1 |

### TASK-M0-01
- 状态：DONE（编辑器场景/4Tab壳）；真机竖屏以 web-mobile 无头 Chromium 验证
- 执行Agent：自动化
- 输入文档/依赖：01/07/13；Cocos 3.8.8 官方 scene-2d 模板
- 变更文件：assets/scenes/Game.scene、assets/scripts/Bootstrap.ts、assets/scripts/ui/*
- 测试命令/结果：无头 web-mobile 构建成功；截图 evidence/m0/m0-10/*.png
- 真机/编辑器证据：Chromium 390×844 运行零 JS 错误（仅 favicon 404）
- 阻塞项：无
- QA复核：待
- 下一任务：M1-01

### TASK-M0-02
- 状态：DONE
- 变更文件：assets/core/domain/{errors,result,command,money,types}.ts
- 测试命令/结果：npm run typecheck/lint 通过；tests/unit/smoke.test.ts
- 下一任务：M0-04

### TASK-M0-03
- 状态：DONE
- 变更文件：assets/core/platform/{ITapPlatform,MemoryStorage,EditorMockPlatform}.ts、assets/scripts/platform/CocosPlatform.ts
- 说明：Mock 仅编辑器/测试使用，生产平台入口将独立于 EditorMock
- 下一任务：M0-05

### TASK-M0-04
- 状态：DONE
- 变更文件：assets/core/domain/{types,gameStateFactory,ids}.ts、assets/core/simulation/rng.ts
- 下一任务：M0-06

### TASK-M0-05
- 状态：DONE
- 测试命令/结果：tests/unit/saveRepository.test.ts 9 项（B01/B02、checksum、指针恢复、墓碑阻断）
- 变更文件：assets/core/persistence/{SaveTypes,SaveCodec,SaveMigration,SaveRepository,crc32,canonical}.ts
- 下一任务：M0-07

### TASK-M0-06
- 状态：DONE
- 测试命令/结果：tests/unit/companyCreate.test.ts 8 项（A01、单次注资、幂等、RUN_CHANGED、非法输入）
- 变更文件：assets/core/domain/{companyNames,peopleNames,validation,NameGenerator}.ts、application/{CompanyService,validators}.ts
- 下一任务：M0-09

### TASK-M0-07
- 状态：DONE
- 测试命令/结果：tests/unit/initialHiring.test.ts 8 项（G006/B04/B11、OFFER_EXPIRED、次月生效）
- 变更文件：assets/core/domain/CandidateGenerator.ts、application/{OfferService,RecruitmentService}.ts
- 下一任务：UI

### TASK-M0-08
- 状态：DONE（TUT-01~05 步骤+指标气泡+可重播入口占位；TUT-06 随首年年结在 M3）
- 变更文件：assets/scripts/ui/AppView.ts（onboarding 状态驱动）

### TASK-M0-09
- 状态：DONE
- 测试命令/结果：tests/integration/resetCompany.test.ts 10 项（A16/A17/A18/A25/B03/B11、60s token、二次创业注资）
- 变更文件：application/{ResetService,GameStore,GameFacade,MutationContext}.ts

### TASK-M0-10
- 状态：BLOCKED（真机联调部分）；web-mobile 构建 PoC DONE；**TapTap 打包链路 DONE**（2026-11-01 CLI 出包成功）
- 证据：build/web-mobile 可启动；evidence/m0/m0-10/{s01-company,s02-ceo,s03-hiring,s03-hired2,t01-company}.png；build/TapBuild/game.zip（3.98MB ≤ 20MB 目标，结构/入口/无密钥自检通过）
- 阻塞项：仅剩 上传包体库 + Android/iOS 真机自测（用户后台操作）；扩展/AppID 已解除
- QA复核：待

## M1 财务引擎（2026-11-01）

### TASK-M1-01
- 状态：DONE
- 内容：economy.v1.json 加载/TS 类型/硬校验（关键数值篡改即抛 ConfigValidationError）
- 变更：core/config/EconomyConfig.ts、configLoader.ts；scripts/platform/loadConfig.ts（resources.load）
- 测试：tests/unit/config.test.ts 5 项

### TASK-M1-02
- 状态：DONE
- 内容：固定 seed mulberry32 + xmur3，独立命名空间随机流（market/event/offer/companyName 互不污染）
- 变更：simulation/{rng,RandomStreams}.ts、domain/{rng,NameGenerator}.ts

### TASK-M1-03
- 状态：DONE
- 内容：年需求复利、获客、月潜在订单年度残差分配（保证全年精确）；技能/协作/CEO/业务资产产能系数，个人年产能取整后前11月trunc、12月补差
- 变更：simulation/{market,capacity}.ts
- 测试：tests/unit/capacityMarket.test.ts 7 项

### TASK-M1-04
- 状态：DONE
- 内容：逐月财务结算（比例费用 YTD 累计残差法、固定费12月补差、一次性 pendingEntries 区分现金口径）；**G001 贸易 利润38000/末现338000、G002 软件 35000/335000、G003 服务 43500/343500 黄金账分毫不差**
- 变更：simulation/{monthly,advanceMonth}.ts
- 测试：tests/golden/goldenYear1.test.ts 6 项

### TASK-M1-05
- 状态：DONE
- 内容：在线时钟 1×(月25s/年5min)、2×、5×(月5s/年1min)、暂停(speed=0)；累积真实ms、while循环跨多月原子月结、G008
- 变更：simulation/GameClock.ts；GameFacade.setSpeed/advanceRealTime
- 测试：tests/unit/clock.test.ts 8 项

### TASK-M1-06
- 状态：DONE
- 内容：年结汇总、连续盈利计数（>0累加/否则归零）、三年达标 target3YearsAchieved、CEO 按性格年度成长（封100）、年报入册
- 变更：simulation/annual.ts；GameState.yearOpenCashYuan
- 测试：tests/unit/annualGoal.test.ts 6 项

### TASK-M1-07
- 状态：DONE
- 内容：扩产现金即时换业务资产（1万/步，产能+1.5%封顶+30%），CAPEX 不计当期利润；次年起年折旧10%（不追溯本年）；G007
- 变更：application/InvestmentService.ts；GameFacade.previewInvest/invest
- 测试：tests/unit/investment.test.ts 7 项

### TASK-M1-08
- 状态：DONE
- 内容：公司首页实时三指标（现金/本年收入/本年利润，亏红盈绿）、时间速度控制、CEO卡、业务资产+扩产弹窗、连续盈利进度、年度报告弹窗（11项费用分类+净利润+期初期末现金/总资产/员工）；修复 TUTORIAL_DASHBOARD 看板态无「开始经营」入口导致时钟永不启动的缺陷（新增 TUT-04/05 合并引导，确认调 startOperating）；为扩产/年报弹窗补白色卡片底板
- 变更：scripts/ui/AppView.ts；application/RecruitmentService.ts（pushStep 幂等，TUT-04/05 在 startOperating 标记）
- 证据：evidence/m1/m1-08/{m1-company-month1,m1-speed-5x,m1-company-running,m1-after-year1,m1-invest-dialog,m1-annual-empty,m1-annual-report-y1}.png；Chromium 390×844 零 JS 错误；实测5×推进月份、收入/利润实时变化、跨年第2年CEO成长(商业52/管理51/财务51)、连盈计数随亏损归零、年报勾稽（720000−各项=−19044 该局随机高工资情形）
- QA复核：待

## M2 员工、部门与自动经营（2026-11-01）

### TASK-M2-01
- 状态：DONE
- 内容：运营期任意部门三候选 offer、分页刷新、A/B/C 倾向比较、人工录用次月生效；HR 已生效员工招聘费折扣（不事后退款）
- 变更：application/RecruitmentService.ts（加 cfg、HR 折扣）、OfferService、GameFacade
- 测试：initialHiring 8 项 + departmentsM2/staffingM2

### TASK-M2-02
- 状态：DONE
- 内容：年结对在职员工 `delta=max(1,round(potential/30))` 成长、封顶100；潜力不增长、薪资不自动上涨；员工详情卡
- 变更：simulation/annual.ts；scripts/ui/AppView.ts
- 测试：staffingM2「5年成长/封顶」

### TASK-M2-03
- 状态：DONE
- 内容：裁员预览（任职年数/补偿月数/金额/次年节薪/裁后现金）、补偿=月薪×min(3,max(1,ceil(年/2)))、60s token 二次确认、确认时重算、ACTIVE→PENDING_DISMISSAL→DISMISSED 次月停薪停产能、幂等不重复扣费、现金不足拒绝（G005：3年8000月薪赔16000）
- 变更：application/LayoffService.ts、simulation/monthly.ts、advanceMonth.ts
- 测试：staffingM2 G005/B07/现金不足/token过期

### TASK-M2-04
- 状态：DONE
- 内容：5 支持部门创建、同类去重（B06 只扣一次）、设立费1万立即扣现金计本年损益、默认 LOCKED/target0/不送员工、0员工无效益、AUTO/LOCKED 切换、部门不可删除
- 变更：application/DepartmentService.ts、monthEntry.ts
- 测试：departmentsM2 G013/默认LOCKED

### TASK-M2-05
- 状态：DONE
- 内容：五支持部门量化效益（人数边际表×技能系数，封顶 cap）：采购省可适用直成（G004 160万场景省91200）、客服省售后（G014 35%）、财务省固定费（G015 20%）、市场提升潜在订单、HR 提升业务产能+招聘折扣；每条费用只作用一次、不扣负、不凭空创收
- 变更：simulation/departments.ts、monthly.ts、market.ts、capacity.ts；EconomyConfig 类型修正为 JSON 真实结构
- 测试：departmentsM2 G004/G013/G014/G015

### TASK-M2-06
- 状态：DONE（P1 最小闭环）
- 内容：员工主营↔支持部门调岗、下月生效、无招聘费/赔偿、无双重工资/产能（pendingDepartment + transferFrom）；人才页按部门归属查看
- 变更：application/TransferService.ts、monthEntry.ts、simulation/departments.ts、advanceMonth.ts
- 测试：staffingM2 调岗生效/非法目标

### TASK-M2-07
- 状态：DONE
- 内容：稳健/扩张/利润三方针（ROI 门槛 1.0/0.8/1.2、现金留存 6/6/9 月）、自动招聘候选评分、每月≤1人每年≤3人、只对 AUTO 部门、现金安全线拦截、禁自动裁员/建部/扩产、确定性候选与可解释决策日志；经 GameClock.beforeMonthSettle 钩子在月结前同锁执行
- 变更：application/AutoHireService.ts、simulation/GameClock.ts、GameFacade.setPolicy/getAutomationLogs；types 加 autoHireCountByYear/automationLogs
- 测试：staffingM2 LOCKED/安全线/年≤3/方针差异/评分/日志

### TASK-M2-08
- 状态：DONE
- 内容：部门页（方针切换、主营+支持部门卡、在岗人数/月薪合计/AUTO-LOCKED/招聘、未建部门创建入口）、人才页（员工卡、详情、调岗、裁员二次确认）、招聘弹窗（三候选比较/换一批/录用/HR折扣提示）、建部成本预览；所有点击均走 GameFacade 命令层；修复多行 Label 在固定宽度下被 SHRINK 缩成一团的渲染缺陷（改 RESIZE_HEIGHT）
- 变更：scripts/ui/AppView.ts、UiFactory.ts
- 证据：evidence/m2/m2-08/{m2-dept-list,m2-create-dept-dialog,m2-dept-created,m2-hire-dialog,m2-talent-list,m2-employee-detail,m2-layoff-confirm}.png；Chromium 390×844 零 JS 错误
- QA复核：待

## M3 挂机、事件、风控、排行与发布准备（2026-11-01）

### TASK-M3-01
- 状态：DONE
- 内容：离线每完整40分钟结1月、最多36月、余量 offlineRemainderMs 跨次累积、24h封顶丢弃、暂停(speed=0)不结、设备时间回拨0结算、危机中断不凭空跳月；回前台先结算后恢复在线；离线摘要弹窗
- 变更：simulation/offline.ts；GameFacade.settleOffline；AppView onShow/onHide
- 测试：offlineM3（G009/A09/A10/B08/B09/B10）

### TASK-M3-02
- 状态：DONE
- 内容：5种年度事件（订单增/减、成本上涨、员工意外离职、设备损失），hash(seed,runId,year,'event') 固定、每年≤1、概率25%、首年新手保护恒无；费用事件入 EVENT 成本、需求事件作用当月订单、离职次月无补偿离岗；触发月后不追溯
- 变更：simulation/annualEvent.ts、monthly.ts、advanceMonth.ts、types.ts
- 测试：eventRiskM3（B13 固定/五种类型/离职无补偿/年≤1）

### TASK-M3-03
- 状态：DONE
- 内容：风险分层 NORMAL/WARNING（现金不足6个月刚性支出）/DISTRESS（下月刚性费用不可覆盖，冻结月结）；一次性10万CEO救助（全run仅1次、计实收资本、不计收入利润、重复拒绝）；救助后解除冻结；GameClock.afterMonthSettle 钩子
- 变更：application/RiskService.ts、simulation/GameClock.ts、GameFacade.injectRescueCapital/assessRisk
- 测试：eventRiskM3（G010/G012/B12）

### TASK-M3-04
- 状态：DONE
- 内容：12个确定性本地模拟企业（sharedSeed 派生，重开同种子一致、不继承玩家）；资产榜/年限榜双榜，玩家按现金+业务资产、年限按已入册年报；年结时 bot 同步推进1年（玩家不推进 bot 不凭空增长）
- 变更：simulation/leaderboard.ts、annual.ts；AppView 排行榜页（双榜切换、玩家高亮、排名）
- 测试：eventRiskM3（A14 排序/确定性/玩家资产口径）

### TASK-M3-05
- 状态：DONE
- 内容：帮助重播（设置→重新查看操作指引，不改业务状态）、首次无年度报告空态提示保留、四 Tab 竖屏可达；离线/危机失败恢复弹窗
- 变更：scripts/ui/AppView.ts（replayTutorial/renderDistressDialog/renderOfflineSummary）

### TASK-M3-06
- 状态：DONE
- 内容：三行业黄金保持一致；新增 21 个 M3 单测；百种子×三行业×三策略 5 年批量模拟（900 run）：零负现金、零财务守恒失败、零自动重复救助、单年自动招聘≤3；输出 CSV
- 变更：tests/unit/{offlineM3,eventRiskM3}、tests/simulation/simulate5year、tools/simulate5year.ts
- 证据：evidence/m3/simulate5year.csv（900行）

### TASK-M3-07
- 状态：代码侧 DONE（真机执行仍 BLOCKED，需凭证）
- 说明：真机平台脚手架已接入——core/platform/TapPlatform.ts（封装 globalThis.tap，异常转领域错误不泄漏 errMsg）+ scripts/platform/PlatformFactory.ts（真机 tap 运行时用 TapPlatform、编辑器/预览回落 CocosPlatform；生产入口不 import Mock，避免打进正式包）；AppView 已改用 createPlatform()。35 项 Tap 平台单测全过。剩余：Android/iOS 真机音频/安全区/前后台/包体实测，须取得 TapTap AppID
- 测试：tests/unit/tapPlatform.test.ts（35 项）

### TASK-M3-08
- 状态：DONE（文档/自查）；⚠️ 主体资质项待开发者
- 内容：隐私/数据、内容安全、素材与音频许可、TapTap上架前置（版号/软著/隐私政策）、真机验收清单；明确本地单机不联网不采集、音频程序原创 original_waveforms
- 变更：合规自查内容并入 docs/08_TapTap适配_审核与交付.md（原独立的 docs/发布合规清单.md 内容已过期，随本次仓库清理移除）

### TASK-M3-09
- 状态：BLOCKED（需凭证）
- 说明：版本冻结、提审包、AppID/版号、渠道规则核对依赖开发者主体账号；Release 真机包待 M3-07

### 音频接入（配合 UI-12）
- 状态：DONE
- 内容：AudioManager 三开关（master/music/effects，一票否决、持久化 localStorage、首次触摸解锁、切后台暂停恢复、失败静默降级）；2 BGM 循环 + 3 JNG（年盈/年亏/三连）+ 11 SFX 已接关键动作；设置页三开关
- 变更：scripts/audio/AudioManager.ts；AppView 音频挂载；真机无缝循环听感待 M3-07

- QA复核：待

## 设计素材收录

- UI（CEO_UI_DevHandoff_B01-B06_v1.5）：67 张 B06 PNG 已入 `assets/resources/ui/{avatars,components,departments,industries,navigation,status,time}`，编辑器已生成 meta。整屏 PNG/SVG 仅在 design/ 作参考，不入运行时。
- 音频设计包（design/CEO_Audio_MVP_Design_v1.1）：16 项契约（2 BGM + 3 JNG + 11 SFX）+ UI-12 三开关增量规范；该包无图片。
- 音频生产包（项目根 `audio/`，V1.0）：**16 个真实 MP3 已制作并收录入运行时** `assets/resources/audio/{bgm(2),jingles(3),sfx(11)}`，全部 `PASS_static_qa`（44.1kHz、非静音、BGM 循环接缝差 0、含 SHA256，收录后抽 4 个复核哈希一致）。作用映射：BGM_01 创业启程(60s,startup,UI-01~04)、BGM_02 日常经营(96s,operation,UI-05~15)；JNG_01 年度盈利/JNG_02 年度亏损/JNG_03 连续三年盈利；SFX_01~11 依次为按钮点击、卡片选择、确认、返回、非法操作、随机公司名、招聘成功、创建部门、裁员、速度切换、现金警告。配置已更新为生产版 `assets/resources/config/audio/{audio_manifest(18KB,status=produced_original_audio),audio_event_map,audio_settings,audio_asset_manifest}.json`（删除设计期 package_files.json）。WAV 母版(16)、试听合辑、QA_REPORT.csv、原创合成脚本仅留存根 `audio/`，**不入包**；版权状态 original_waveforms（本项目 Python 合成、无外部采样），商用前仍需项目侧合规确认。AudioManager + UI-12 三开关（master/music/effects，总开关一票否决、立即静音、持久化、首次触摸解锁、切后台暂停、离线不逐条播）在 M3 实现；真机听感/MP3 无缝循环待 TapTap 真机验证；音频为可选增强，不参与经营逻辑。

## 错误与遗留事项

| Issue ID | 关联TASK | 优先级P0-P3 | 复现步骤 | 证据 | 责任 | 状态 |
|---|---|---|---|---|---|---|
| ISSUE-ENV-01 | M0-01 | - | 曾误判编辑器未安装，实际在 C:\ProgramData\cocos\editors\Creator\3.8.8（深度5、系统隐藏目录），此前递归深度不足 | exe ProductVersion=3.8.8 | 环境 | CLOSED（2026-11-01 复核） |
| ISSUE-ENV-02 | M0-10/M3-07 | P1 | TapTap 官方小游戏适配扩展未确认安装 | 官方 v1.2.2 已安装并实际出包：build/TapBuild/game.zip 3.98MB（SHA256=113A05ED6B72AB639A13E4BD464AD19EF55CA35DA24C5E54583EB612527A0FFC，443 项，game.json=portrait/1.0.0，无密钥） | 环境 | CLOSED（2026-11-01；3.8.8 新构建面板未渲染扩展选项，已验证路径=CLI `--build configPath=temp\build-tap.config.json`；tapAppid 选项不被转换器消费，AppID 在上传包体库时绑定） |
| ISSUE-HARMONY-01 | M3-07 | P1 | 华为 nova 15 Ultra（HarmonyOS 7.0.0 / 纯血鸿蒙 NEXT）进入小游戏后长期停留在 Cocos 启动页 | v2/v3/v4 均复现；云端准入测试 5 台安卓机全过（同一包体）；TapTap 官方 SDK 文档环境要求仅列 Android 5.0+/iOS 12+，**未声明 HarmonyOS**；Cocos 3.8.8 原生平台支持 HarmonyOS Next，但小游戏（微信转换式包体）在鸿蒙 ArkWeb 运行时的支持无官方声明 | 平台兼容 | IN_PROGRESS（2026-11-01）。已做：TapPlatform 全回调防挂死（v4）、构建侧注入 CEO-BOOT-DIAG 启动诊断 + 非 iOS 平台分支修正（v5，待实机取证）。**判断：大概率为 TapTap 小游戏容器在鸿蒙的支持限制，非包体逻辑缺陷**（依据：同包安卓全过 + 官方环境要求未列鸿蒙）；ICP 备案/上架主线不依赖此项，可继续 |

## 发布控制

- 开发者认证：DONE（个人主体，已认证）
- Tap小游戏AppID：已获得（MiniApp ID，仅存本地未入库配置，不进 git）
- 最终引擎版本与插件版本：Creator 3.8.8 + taptap-minigame-tools 1.2.2，出包验证 DONE（DEC-026 完成）
- 首个Tap包体：build/TapBuild/game.zip 3.98MB（≤20MB 目标）；v2 含真机平台层（SHA256=6681E5A9…31CD7，2026-11-01 12:55），包内已验证 resolveTapRuntime 存在
- v4 包体（2026-11-01 13:44，SHA256=C84F526E…F0C7B8，273 项）：含 BootTrap 启动自显示诊断 + TapPlatform 全回调防挂死（CallbackGuard：get 超时→按无存档降级、set 超时→SAVE_FAILED、login 10s→AUTH_REQUIRED、getNetworkType→unknown、remove→best-effort）；针对华为 nova 15 Ultra / HarmonyOS 7.0.0 卡启动页（疑似运行时不回存储回调导致启动 Promise 挂起）；156/156 测试绿（新增 6 个 silent 运行时用例）；包内已验证 BOOT TIMEOUT×1、callback timeout×2
- Android真机：云端准入测试 5 机全过（用户自测）
- v5 诊断包（2026-11-01，SHA256=AA6F7017…89AB4E，273 项，4.15MB）：在构建产物 `build/TapBuild/game/game.js` 注入 CEO-BOOT-DIAG（不改工程源码，脚本 `tools/diag-inject.mjs`）：
  - 启动节点打点 10 处（webAdapter/polyfills/systemjs/warmup/splash/loadApplication/loadEngine/engineAdapter/engineInit/appStart）+ require 轨迹 + firstScreen 进度
  - 捕获 console.error / wx.onError / unhandledrejection；错误经 `wx.showModal`/`tap.showModal` 原生弹窗上屏（小游戏无 DOM，覆盖层不可见）
  - 12 秒仍未跑起来（以场景内存在 `AppRoot` 节点为"跑起来"判据）才弹窗，避免正常启动误报
  - 平台分支修正：原模板仅 `platform==='android'` 走 requestAnimationFrame（等第二帧拿正确画布尺寸），鸿蒙/未知平台走同步路径 → 改为"非 iOS 一律走 rAF"
- iOS真机：未测试
- 前置备案：IN_PROGRESS（ICP 核准卡在小游戏包体选择，包体已产出待上传；软著申请为长尾项）
- 包体提审：未开始
- 公开发布：未开始

## 发布前平台补齐轮（2026-11-01，v5.1；自动化 156→204 全绿）

> 针对完结性检查发现的平台/测试缺口一次性补齐；typecheck/lint 0 错误。独立 QA 报告：`evidence/QA_REPORT_M3_FINAL.md`。

### 平台与合规代码（已过测）
- **安全区 A21**：新增纯函数 `core/platform/safeArea.ts`（computeSafeAreaTransform），AppView 内容层 375×812 在安全区内等比缩放居中；编辑器/无安全区恒等。测试 safeArea.test（6）。
- **隐私 A23**：首启隐私告知弹窗（同意前不登录/不联网）、版本化同意记录 `core/platform/privacyConsent.ts`、设置页「隐私政策」入口；真机无 DOM 时展示 URL 不崩。测试 privacyConsent.test（4）。
- **TapTap 登录 DEC-027**：`core/platform/AuthService.ts`（tap.login→POST {endpoint}/v1/auth/taptap/exchange→短期 sessionToken；编辑器 mock 不联网；失败可重试或进单机；会话本地持久化、独立于业务存档）。ITapPlatform 新增 request；TapPlatform 走 tap.request（CallbackGuard 防挂死），CocosPlatform 走 fetch/XHR。测试 authService.test（11）。
- **最小服务端**：`server/auth-server.mjs`（零依赖 Node18；AppID/Server Secret/code2Session URL 仅环境变量；不回传 session_key/openid；/healthz）；`server/selftest.mjs` 8/8 PASS。端点经不入库 `assets/resources/config/runtime.config.json` 注入（当前空=真机明确报未配置，不伪造登录），样例 runtime.config.example.json。
- **DEC-028 已核实**：普通小游戏 WebGL 运行时无加桌面 API（tap-minigame.d.ts 835 行无 shortcut/desktop；桌面快捷方式属 APK TapPlay）；真正必接为 TapTap 登录。已更新 docs/08 §8.5、docs/11 DEC-027/028。

### 财务口径修正
- **G016**：财务部原仅省固定管理费，与设计 09 G016/V1.0 细化决定（合并省"固定管理费+其他可控运营费"）不符。改 monthly.ts：按合并基数算节省、先抵固定再抵其他、不产生负费用；无财务员工时黄金账不变。departmentsM2 改 G015/G016 组合断言+溢出用例。

### 健壮性/卫生（新增测试）
- **B05** 并发命令串行锁；**B14** 新增 `persistence/stateIntegrity.ts`，装载拒绝奇异存档并回退另一槽；**B15** 新增 `persistence/statePrune.ts`，年结裁剪年报(≤100)/月账(≤24)/开盘快照/事件/日志，120 年存档 <500KB；**B16** packageHygiene.test（不打包 Mock、核心不依赖 window/document/localStorage、无硬编码密钥）。测试 robustnessM3.test（11）、packageHygiene.test（6）。

### 验证与包体
- web-mobile 无头 + Chromium 390×844：`tools/verify-v5.cjs` 隐私弹窗渲染→点击同意写 ceo/privacy/consent→重载不再弹，零 JS 错误；截图 evidence/v5/{v5-01..03}.png、v5-headless.json。
- **v5.1 Tap 包**：`build/TapBuild/game.zip` 4.18MB/446 项；SHA256=`0A833DEA46EE4A3DE95FBCA98BEF2E7E46BAB86EBDB86E73058061DED10A5699`；含隐私/登录交换/完整性/安全区/历史裁剪；不含 EditorMock、不含 Secret/Token/session_key/私钥；runtime.config 空端点安全默认。（覆盖此前 v5 诊断包 game.zip）
- 清理误建空壳工程 `我是CEO/我是CEO`（36.3MB，独立 .git、assets 空、uuid 不同、未跟踪）；.gitignore 增加 runtime.config.json/.env 等敏感项。

### 仍 BLOCKED（需用户/真机/凭证）
- iOS 真机；Android 上传后扫码自测；登录服务端真机联调（需官方 code2Session 真实 URL + Server Secret 部署）；runtime.config 填隐私政策 URL/authEndpoint；备案/软著；≥3 实机截图+竖屏实机录屏（动画 CG 不可代替）；后台提审发布。

