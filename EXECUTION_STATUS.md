# Agent执行状态记�?
> 本文件由各执�?Agent 持续更新；状态只允许 TODO / IN_PROGRESS / BLOCKED / READY_FOR_QA / DONE�?> 项目：《我是CEO》第一阶段 MVP（TapTap 普通小游戏，Cocos Creator 3.8.x + TypeScript�?
## 当前整体状�?
| 里程�?| 状�?| 最后commit | 通过用例 | 未解决问�?|
|---|---|---|---|---|
| M0 | READY_FOR_QA（核心全绿，平台真机�?BLOCKED�?| 128c0ad | 39 单测/集成全过；web-mobile 无头构建+Chromium 运行通过 | TapTap 官方适配扩展/AppID/真机为外部前置（ISSUE-ENV-02�?|
| M1 | READY_FOR_QA（核心全绿，平台真机�?BLOCKED�?| c4a8807 | 78 单测/黄金/集成全过；G001-G003 黄金账分毫不差；web-mobile 无头构建+Chromium 走通在线时�?跨年/扩产/年报 | TapTap 真机、音频真机听感为外部项（ISSUE-ENV-02�?|
| M2 | READY_FOR_QA（核心全绿，平台真机�?BLOCKED�?| 待提�?| 99 单测/黄金/集成全过；G004/G005/G013/G014/G015 部门与裁员黄金用例；web-mobile 无头构建+Chromium 走通建�?招聘/裁员/调岗/方针 | TapTap 真机为外部项（ISSUE-ENV-02�?|
| M3 | TODO | - | - | TapTap 开发者认�?AppID/备案为外部门禁，尚无凭证 |

## 环境核查�?026-11-01�?
| �?| 结果 |
|---|---|
| 仓库性质 | 纯设计包仓库，无任何游戏工程代码（仅 AGENT.md + docs/�?|
| Node / npm | v24.13.0 / 11.6.2 |
| Git | 2.53.0（当前目录尚�?git init�?|
| Python | 3.14.3 |
| 设计基线自检 | `python docs/工具/校验设计基线.py` �?PASS�?4 fixtures；仅证明设计参考自洽） |
| Cocos Creator 编辑�?| **已安�?3.8.8**：`C:\ProgramData\cocos\editors\Creator\3.8.8\CocosCreator.exe`（exe ProductVersion=3.8.8�?026-11-01 复核�?|
| TapTap 适配扩展 | **官方 `taptap-minigame-tools` v1.2.2 已安�?*至项�?`extensions/taptap-minigame-tools`�?026-11-01；官�?zip 比扩展根多一层嵌套目录，扩展管理器报"解压失败"，已手动解压复制）；zip SHA256=`6B8A9A3CC62B6C54CEFAB397097BABB771D9D99F90442CDDFF06310A4C9ED73F`；`editor>=3.8.0` �?3.8.8 兼容；机�?构建微信小游戏→自动�?Tap 小游戏→输出 `build/TapBuild/game.zip`；待编辑器重启后验证加载与出�?|
| TapTap 凭证 | 开发者认�?DONE（个人主体）；小游戏 AppID 已获得（MiniApp ID，仅存本地未入库配置）；Server Secret/Client Token 仅服务端用途、不入库 �?M0-10/M3 剩余阻塞=真机与备�?|
| 设计文档版本 | V1.0；economy-v1.0.0 / golden-cases-v1.0.0 / save schemaVersion=1 |

### TASK-M0-01
- 状态：DONE（编辑器场景/4Tab壳）；真机竖屏以 web-mobile 无头 Chromium 验证
- 执行Agent：自动化
- 输入文档/依赖�?1/07/13；Cocos 3.8.8 官方 scene-2d 模板
- 变更文件：assets/scenes/Game.scene、assets/scripts/Bootstrap.ts、assets/scripts/ui/*
- 测试命令/结果：无�?web-mobile 构建成功；截�?evidence/m0/m0-10/*.png
- 真机/编辑器证据：Chromium 390×844 运行�?JS 错误（仅 favicon 404�?- 阻塞项：�?- QA复核：待
- 下一任务：M1-01

### TASK-M0-02
- 状态：DONE
- 变更文件：assets/core/domain/{errors,result,command,money,types}.ts
- 测试命令/结果：npm run typecheck/lint 通过；tests/unit/smoke.test.ts
- 下一任务：M0-04

### TASK-M0-03
- 状态：DONE
- 变更文件：assets/core/platform/{ITapPlatform,MemoryStorage,EditorMockPlatform}.ts、assets/scripts/platform/CocosPlatform.ts
- 说明：Mock 仅编辑器/测试使用，生产平台入口将独立�?EditorMock
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
- 状态：DONE（TUT-01~05 步骤+指标气泡+可重播入口占位；TUT-06 随首年年结在 M3�?- 变更文件：assets/scripts/ui/AppView.ts（onboarding 状态驱动）

### TASK-M0-09
- 状态：DONE
- 测试命令/结果：tests/integration/resetCompany.test.ts 10 项（A16/A17/A18/A25/B03/B11�?0s token、二次创业注资）
- 变更文件：application/{ResetService,GameStore,GameFacade,MutationContext}.ts

### TASK-M0-10
- 状态：BLOCKED（TapTap 真机部分）；web-mobile 构建 PoC DONE
- 证据：build/web-mobile 可启动；evidence/m0/m0-10/{s01-company,s02-ceo,s03-hiring,s03-hired2,t01-company}.png
- 阻塞项：ISSUE-ENV-02 官方 Tap 小游戏适配扩展、AppID、Android/iOS 真机、备�?- QA复核：待

## M1 财务引擎�?026-11-01�?
### TASK-M1-01
- 状态：DONE
- 内容：economy.v1.json 加载/TS 类型/硬校验（关键数值篡改即�?ConfigValidationError�?- 变更：core/config/EconomyConfig.ts、configLoader.ts；scripts/platform/loadConfig.ts（resources.load�?- 测试：tests/unit/config.test.ts 5 �?
### TASK-M1-02
- 状态：DONE
- 内容：固�?seed mulberry32 + xmur3，独立命名空间随机流（market/event/offer/companyName 互不污染�?- 变更：simulation/{rng,RandomStreams}.ts、domain/{rng,NameGenerator}.ts

### TASK-M1-03
- 状态：DONE
- 内容：年需求复利、获客、月潜在订单年度残差分配（保证全年精确）；技�?协作/CEO/业务资产产能系数，个人年产能取整后前11月trunc�?2月补�?- 变更：simulation/{market,capacity}.ts
- 测试：tests/unit/capacityMarket.test.ts 7 �?
### TASK-M1-04
- 状态：DONE
- 内容：逐月财务结算（比例费�?YTD 累计残差法、固定费12月补差、一次�?pendingEntries 区分现金口径）；**G001 贸易 利润38000/末现338000、G002 软件 35000/335000、G003 服务 43500/343500 黄金账分毫不�?*
- 变更：simulation/{monthly,advanceMonth}.ts
- 测试：tests/golden/goldenYear1.test.ts 6 �?
### TASK-M1-05
- 状态：DONE
- 内容：在线时�?1×(�?5s/�?min)�?×�?×(�?s/�?min)、暂�?speed=0)；累积真实ms、while循环跨多月原子月结、G008
- 变更：simulation/GameClock.ts；GameFacade.setSpeed/advanceRealTime
- 测试：tests/unit/clock.test.ts 8 �?
### TASK-M1-06
- 状态：DONE
- 内容：年结汇总、连续盈利计数（>0累加/否则归零）、三年达�?target3YearsAchieved、CEO 按性格年度成长（封100）、年报入�?- 变更：simulation/annual.ts；GameState.yearOpenCashYuan
- 测试：tests/unit/annualGoal.test.ts 6 �?
### TASK-M1-07
- 状态：DONE
- 内容：扩产现金即时换业务资产�?�?步，产能+1.5%封顶+30%），CAPEX 不计当期利润；次年起年折�?0%（不追溯本年）；G007
- 变更：application/InvestmentService.ts；GameFacade.previewInvest/invest
- 测试：tests/unit/investment.test.ts 7 �?
### TASK-M1-08
- 状态：DONE
- 内容：公司首页实时三指标（现�?本年收入/本年利润，亏红盈绿）、时间速度控制、CEO卡、业务资�?扩产弹窗、连续盈利进度、年度报告弹窗（11项费用分�?净利润+期初期末现金/总资�?员工）；修复 TUTORIAL_DASHBOARD 看板态无「开始经营」入口导致时钟永不启动的缺陷（新�?TUT-04/05 合并引导，确认调 startOperating）；为扩�?年报弹窗补白色卡片底�?- 变更：scripts/ui/AppView.ts；application/RecruitmentService.ts（pushStep 幂等，TUT-04/05 �?startOperating 标记�?- 证据：evidence/m1/m1-08/{m1-company-month1,m1-speed-5x,m1-company-running,m1-after-year1,m1-invest-dialog,m1-annual-empty,m1-annual-report-y1}.png；Chromium 390×844 �?JS 错误；实�?×推进月份、收�?利润实时变化、跨年第2年CEO成长(商业52/管理51/财务51)、连盈计数随亏损归零、年报勾稽（720000−各�?�?9044 该局随机高工资情形）
- QA复核：待

## M2 员工、部门与自动经营�?026-11-01�?
### TASK-M2-01
- 状态：DONE
- 内容：运营期任意部门三候�?offer、分页刷新、A/B/C 倾向比较、人工录用次月生效；HR 已生效员工招聘费折扣（不事后退款）
- 变更：application/RecruitmentService.ts（加 cfg、HR 折扣）、OfferService；GameFacade
- 测试：initialHiring 8 �?+ staffingM2/departmentsM2

### TASK-M2-02
- 状态：DONE
- 内容：年结对在职员工 `delta=max(1,round(potential/30))` 成长、封�?00；潜力不增长、薪资不自动上涨；员工详情卡
- 变更：simulation/annual.ts；scripts/ui/AppView.ts
- 测试：staffingM2�?年成�?封顶�?
### TASK-M2-03
- 状态：DONE
- 内容：裁员预览（任职年数/补偿月数/金额/次年节薪/裁后现金）、补�?月薪×min(3,max(1,ceil(�?2)))�?0s token 二次确认、确认时重算、ACTIVE→PENDING_DISMISSAL→DISMISSED 次月停薪停产能、幂等不重复扣费、现金不足拒绝（G005�?�?000月薪�?6000�?- 变更：application/LayoffService.ts、simulation/monthly.ts、advanceMonth.ts
- 测试：staffingM2 G005/B07/现金不足/token过期

### TASK-M2-04
- 状态：DONE
- 内容�? 支持部门创建、同类去重（B06 只扣一次）、设立费1万立即扣现金计本年损益、默�?LOCKED/target0/不送员工�?员工无效益、AUTO/LOCKED 切换、部门不可删�?- 变更：application/DepartmentService.ts、monthEntry.ts
- 测试：departmentsM2 G013/默认LOCKED

### TASK-M2-05
- 状态：DONE
- 内容：五支持部门量化效益（人数边际表×技能系数，封顶 cap）：采购省可适用直成（G004 160万场景省91200）、客服省售后（G014 35%）、财务省固定费（G015 20%）、市场提升潜在订单、HR 提升业务产能+招聘折扣；每条费用只作用一次、不扣负、不凭空创收
- 变更：simulation/departments.ts、monthly.ts、market.ts、capacity.ts；EconomyConfig 类型修正�?JSON 真实结构
- 测试：departmentsM2 G004/G013/G014/G015

### TASK-M2-06
- 状态：DONE（P1 最小闭环）
- 内容：员工主营↔支持部门调岗、下月生效、无招聘�?赔偿、无双重工资/产能（pendingDepartment + transferFrom）；人才页按部门归属查看
- 变更：application/TransferService.ts、monthEntry.ts、simulation/departments.ts、advanceMonth.ts
- 测试：staffingM2 调岗生效/非法目标

### TASK-M2-07
- 状态：DONE
- 内容：稳�?扩张/利润三方针（ROI 门槛 1.0/0.8/1.2、现金留�?6/6/9 月）、自动招聘候选评分、每月≤1人每年≤3人、只�?AUTO 部门、现金安全线拦截、禁自动裁员/建部/扩产、确定性候选与可解释决策日志；�?GameClock.beforeMonthSettle 钩子在月结前同锁执行
- 变更：application/AutoHireService.ts、simulation/GameClock.ts、GameFacade.setPolicy/getAutomationLogs；types �?autoHireCountByYear/automationLogs
- 测试：staffingM2 LOCKED/安全�?年≤3/方针差异/评分/日志

### TASK-M2-08
- 状态：DONE
- 内容：部门页（方针切换、主�?支持部门卡、在岗人�?月薪合计/AUTO-LOCKED/招聘、未建部门创建入口）、人才页（员工卡、详情、调岗、裁员二次确认）、招聘弹窗（三候选比�?换一�?录用/HR折扣提示）、建部成本预览；所有点击均�?GameFacade 命令层；修复多行 Label 在固定宽度下�?SHRINK 缩成一团的渲染缺陷（改 RESIZE_HEIGHT�?- 变更：scripts/ui/AppView.ts、UiFactory.ts
- 证据：evidence/m2/m2-08/{m2-dept-list,m2-create-dept-dialog,m2-dept-created,m2-hire-dialog,m2-talent-list,m2-employee-detail,m2-layoff-confirm}.png；Chromium 390×844 �?JS 错误
- QA复核：待

## 设计素材收录

- UI（CEO_UI_DevHandoff_B01-B06_v1.5）：67 �?B06 PNG 已入 `assets/resources/ui/{avatars,components,departments,industries,navigation,status,time}`，编辑器已生�?meta。整�?PNG/SVG 仅在 design/ 作参考，不入运行时�?- 音频设计包（design/CEO_Audio_MVP_Design_v1.1）：16 项契约（2 BGM + 3 JNG + 11 SFX�? UI-12 三开关增量规范；该包无图片�?- 音频生产包（项目�?`audio/`，V1.0）：**16 个真�?MP3 已制作并收录入运行时** `assets/resources/audio/{bgm(2),jingles(3),sfx(11)}`，全�?`PASS_static_qa`�?4.1kHz、非静音、BGM 循环接缝�?0、含 SHA256，收录后�?4 个复核哈希一致）。作用映射：BGM_01 创业启程(60s,startup,UI-01~04)、BGM_02 日常经营(96s,operation,UI-05~15)；JNG_01 年度盈利/JNG_02 年度亏损/JNG_03 连续三年盈利；SFX_01~11 依次为按钮点击、卡片选择、确认、返回、非法操作、随机公司名、招聘成功、创建部门、裁员、速度切换、现金警告。配置已更新为生产版 `assets/resources/config/audio/{audio_manifest(18KB,status=produced_original_audio),audio_event_map,audio_settings,audio_asset_manifest}.json`（删除设计期 package_files.json）。WAV 母版(16)、试听合辑、QA_REPORT.csv、原创合成脚本仅留存�?`audio/`�?*不入�?*；版权状�?original_waveforms（本项目 Python 合成、无外部采样），商用前仍需项目侧合规确认。AudioManager + UI-12 三开关（master/music/effects，总开关一票否决、立即静音、持久化、首次触摸解锁、切后台暂停、离线不逐条播）�?M3 实现；真机听�?MP3 无缝循环�?TapTap 真机验证；音频为可选增强，不参与经营逻辑�?
## 错误与遗留事�?
| Issue ID | 关联TASK | 优先级P0-P3 | 复现步骤 | 证据 | 责任 | 状�?|
|---|---|---|---|---|---|---|
| ISSUE-ENV-01 | M0-01 | - | 曾误判编辑器未安装，实际�?C:\ProgramData\cocos\editors\Creator\3.8.8（深�?、系统隐藏目录），此前递归深度不足 | exe ProductVersion=3.8.8 | 环境 | CLOSED�?026-11-01 复核�?|
| ISSUE-ENV-02 | M0-10/M3-07 | P1 | TapTap 官方小游戏适配扩展未确认安�?| 官方 v1.2.2 已手动安装至项目 extensions/，版�?hash 已记录（见环境核查表�?| 环境 | IN_PROGRESS：待编辑器重启确认扩展加载、构建面板出�?转换为Tap小游�?并实际产�?TapBuild/game.zip �?CLOSED |

## 发布控制

- 开发者认证：DONE（个人主体，已认证）
- Tap小游戏AppID：已获得（MiniApp ID，仅存本地未入库配置，不�?git�?- 最终引擎版本与插件版本：Creator 3.8.8 + taptap-minigame-tools 1.2.2（SHA256 已记录）；出包验证待编辑器重启（DEC-026 部分完成�?- Android真机：未测试
- iOS真机：未测试
- 前置备案：IN_PROGRESS（ICP 核准卡在小游戏包体选择，待出包上传后继续；软著申请为长尾项�?- 包体提审：未开�?- 公开发布：未开�?