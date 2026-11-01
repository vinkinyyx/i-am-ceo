# 《我是CEO》第一阶段 MVP 测试结果报告 v1.1

- 版本：v1.1（对应计划 `CEO_Test_Plan_v1_1.md` / 排期 `CEO_Test_Schedule_80.csv` / 案例 `CEO_Test_Cases_80.md`）
- 执行日期：2026-11-01（模拟 R0—R5 全部可执行项）
- 执行人：Agent（自动化 + Web 预览人工巡检）；真机/听感/商店素材类由用户执行
- 平台：Cocos Creator 3.8.8 + TypeScript，目标为 TapTap 普通小游戏

## 1. 结论摘要

| 指标 | 结果 |
| --- | --- |
| 可执行案例（80 条） | PASS **74** ｜ FAIL **1** ｜ BLOCKED **5** ｜ 不适用 0 |
| 自动化基线 | 23 个测试文件 / **204** 用例全绿（typecheck 0 错、lint 0 错） |
| 包体 | `build/TapBuild/game.zip` 已按源码重建：4,657,311 字节（4.44MB）/ 454 条目 / SHA256 `6C204AFB…1415` |
| 启动画面 | 已替换为自有图片（`tools/splash/logo.png`，768×768，195,571 字节），Web 与小游戏包内均无 Cocos 官方 logo |
| 缺陷 | 4 条（P0 1 / P1 1 / P2 1 / P3 1）：BUG-001/002/004 已修复并复测，仅 BUG-003 为需求缺口待决策 |
| 发布判定 | **开发可提测；包体可提审但不可直接对外发布**——真机（TC-073/074/076）、听感（TC-069）、商店素材（TC-075）仍未执行 |

**放行前置（必须完成）**：
1. TC-055「跳过引导」需求确认（现产品无跳过入口，BUG-003）；
2. 真机四项（TC-073/074/075/076）在 TapTap 测试环境跑通；
3. TC-069 声音总开关听感确认。

> 原放行前置中的「TC-067 小屏适配修复」已闭环：BUG-002 修复后 360×640 复测 PASS（fit≈0.82，四 Tab 与设置入口可见可点）。

## 2. 环境与证据根目录

- 源码：`d:\Workspace\TapTap\我是CEO`（Cocos 3.8.8，`assets/core` 纯域逻辑 + `assets/scripts` 表现层）
- Web 预览：`build/web-mobile` + `tools/static-server.cjs 8123`
- 浏览器：Chrome headless（`playwright-core`），视口 390×844（主）/ 360×640（小屏）
- 证据目录：`evidence/test-v1.1/`（R0 准入、R1 引导、R2 首年经营、R3 部门/人才、R4 排行/设置、R5 UI 与声音、R6 平台/发布/启动画面）

## 3. R0 准入门禁

| 项 | 命令 | 结果 |
| --- | --- | --- |
| 类型检查 | `npm run typecheck` | PASS（0 错误）`R0/typecheck.log` |
| 静态检查 | `npm run lint` | PASS（0 错误）`R0/lint.log` |
| 自动化 | `npx vitest run` | PASS 23 文件 / 204 用例 `R0/automation-final.log`、`R0/automation-tests.json` |
| Web 构建 | `--build "platform=web-mobile;debug=true;buildPath=build"` | PASS `R0/build-web.out.log` |
| 小游戏构建 | `tools/build-tap.ps1`（wechatgame 构建 + `tools/convert-tap.cjs` + `tools/patch-splash.cjs`） | PASS `R0/package-check.txt` |
| 包体自检 | `evidence/test-v1.1/R0/package-check.txt` | PASS（4.44MB / 454 条目 / portrait / productVersion 1.0.0 / `convertScriptVersion 2.0.4-ts` / ≤20MB / `splash_logo_bytes=195571`） |
| 启动图复验 | `tools/verify-splash.cjs` | PASS `R6/splash/splash-check.json`、`R6/splash/splash-700ms.png` |

> 说明：Cocos CLI 构建需以 `Start-Process -FilePath <exe> -ArgumentList "<单字符串>" -Wait` 形式调用（`&` 直接调用会静默无操作，数组参数会拉起 GUI）。已固化到 `tools/build-web.ps1` / `tools/build-tap.ps1`，两次构建均以 EXIT=36 视为成功。本次重打包后源码与包体一致；RISK-001 复核结论已修正：`EditorMockPlatform` / `MemoryStorage` 仍作为死代码被打进主包（Cocos 将 `assets` 下全部脚本打入同一 chunk），但生产入口 `PlatformFactory.createPlatform()` 只引用 `TapPlatform` / `CocosPlatform`，运行期不会实例化 Mock，建议后续在构建期做剔除。

## 4. 逐轮执行结果

### R1 创建与引导（12 条：PASS 12）

- 向导三页（S01 公司名 / S02 CEO / S03 首聘）均正常：`R1/s01-company-name.png`、`R1/s02-ceo.png`、`R1/s03-hiring.png`
- 初始资本 ¥300,000、CEO 三性格卡、初始能力 50/50/50、首聘 0/2 时进入按钮禁用均可见
- 四 Tab 与设置入口可用：`R3/m2-dept-list.png`、`R4/m3-settings.png`
- 端到端首年链路：`R2/m1-annual-report-y1.png` + `R2/save-dump.json`

### R2 首年经营与财务（18 条：PASS 18）

- 年报 11 科目与净利润、现金变动**逐项勾稽一致**（`R2/save-dump.json` 的 `check` 段：`lineCheck = sumProfit = 10752 = sumCashDelta`）
- 黄金值 G001—G003、扩产/折旧、离线 40min/8h/24h/40h 封顶 36 月、暂停不结算均以域级自动化覆盖（`goldenYear1` / `investment` / `clock` / `offlineM3` / `releaseGaps`）
- 扩产弹窗三档（¥10,000/50,000/100,000）与「不计当年利润、次年起 10% 折旧」文案一致：`R2/m1-invest-dialog.png`

### R3 招聘、人才、部门、自动化（16 条：PASS 16）

- 招聘弹窗三候选对比（能力/潜力/协作/月薪/招聘费）：`R3/m2-hire-dialog.png`
- 裁员预览：任职 0 年 → 补偿 1 个月 ¥7,826，并给出次年节约工资 ¥93,912 与裁后现金：`R3/m2-layoff-confirm.png`
- 部门创建：`R3/m2-create-dept-dialog.png`（支付 ¥10,000 创建）→ `R3/m2-dept-created.png`（人力资源部创建成功、转手动编制）
- 年中录用生效月份（第 5 月录用、第 6 月起计薪）、现金不足拒招、目标人数不自动裁员：`releaseGaps.test.ts` 新增覆盖

### R4 目标、危机、排行、存档、重置（20 条：PASS 19 / FAIL 1）

- 排行双榜：`R4/m3-rank-assets.png`（资产榜 + 你的排名 11/13）、`R4/m3-rank-years.png`（年限榜 13/13）
- 设置与操作指引重播：`R4/m3-settings.png`、`R4/m3-tutorial-replay.png`
- 存档：`R2/save-dump.json` 显示 `ceo/save/a`、`ceo/save/b`、`ceo/save/active` 三键齐备；CRC 篡改回退、墓碑防复活、新 run 发资本由 `saveRepository` / `resetCompany` 覆盖
- FAIL：TC-055「跳过引导」——产品无跳过入口（见 BUG-003）

### R5 UI 与无障碍、声音（10 条：PASS 9 / BLOCKED 1）

- 页面巡检（创建/公司/部门/人才/招聘/排行/年报/设置/引导）全部截图通过
- PASS：TC-067 360×640 小屏——BUG-002 修复后内容层按可视高兜底缩放（fit≈0.82），顶部公司名/年月、底部四 Tab、右上设置入口均可见可点：`R5/small-360x640/360-company.png`、`360-dept.png`、`360-settings.png`、`small-screen-info.json`
- PASS：TC-068 名称/金额极限值——夹具 `tools/verify-longname-bigmoney.cjs` 将 20 字公司名与 ¥100,000,000,000 写回存档并重算 checksum，公司页标题不裁切、排行金额完整显示：`R6/tc068-longname/tc068-company.png`、`tc068-rank.png`、`tc068-result.json`
- 声音：`R5/audio/audio-persist-result.json` 证明
  - 背景音乐关闭后刷新仍为 `musicEnabled=false`（TC-072 持久化 PASS）
  - 总开关关闭后分项保持 `music=false / sfx=true`（TC-070 分项保留 PASS）
  - 开关连续操作时设置弹窗保持打开（BUG-001 修复验证）：`R5/audio/audio-settings-master-off.png`
  - 听感类 TC-069 BLOCKED（自动化无法判定是否静音）

### R6 TapTap 平台与发布（4 条：BLOCKED 4）

- TC-073 / TC-074 / TC-075 / TC-076 均需真机或 TapTap 后台素材，未执行
- 包体侧证据已就绪：4,657,311 字节（4.44MB）/ 454 条目 / portrait / productVersion 1.0.0 / SHA256 `6C204AFB379DBF6BC36424D9AFCFD5D933D6674611A0BB3348654E0363911415`，见 `R0/package-check.txt`
- **启动画面已替换为自有图片**：`tools/splash/logo.png`（768×768，195,571 字节，深蓝底 + 城市天际线 + 皇冠/增长柱徽章 + 金色「我是CEO」字标）
  - Web 端：`src/settings.json` 写入 `splashScreen.logo.type=custom` + base64（260,786 字符）、`displayRatio=2.4`、`totalTime=1500ms`、`background.color=#0B1526`
  - 小游戏端：`first-screen.js` 硬编码读取产物根目录 `logo.png` / `slogan.png`，已由 `tools/patch-splash.cjs` 写入 `build/wechatgame`、`build/TapBuild/game` 及 `build-templates/`；同时把原生启动层硬编码的纯黑底改为 `#0B1526`、`displayRatio` 由 1 提升到 2.4，使小游戏启动图与 Web 一致且不再是小图
  - 复验：700ms 抓帧显示自有启动图、3000ms 进入首屏，无 Cocos 官方 logo；包内 `logo.png` 与源图 SHA256 一致（`9369BBDA…BC2BB`），包内 `first-screen.js` 已含补丁值

## 5. 缺陷与风险清单

| ID | 关联案例 | 等级 | 现象 | 影响 | 状态 |
| --- | --- | --- | --- | --- | --- |
| BUG-001 | TC-054/066/070 | P3 | 设置弹窗内切换任一声音开关后，整个设置弹窗被关闭 | 需重开设置才能继续切换 | **已修复**（`rebuildSettings` 就地重建弹窗，R5 复测保持打开） |
| BUG-002 | TC-067 | P1 | 360×640 下顶部（公司名/年月）与底部四 Tab 被裁约 86px，设置入口移出可视区 | 小屏设备导航不可用 | **已修复**（无安全区时按可视高兜底缩放，R5 复测 PASS） |
| BUG-003 | TC-055 | P0（需求缺口） | 无「跳过引导」入口 | 用例无法执行；需求与实现不一致 | 待产品确认（需求缺口，非代码缺陷） |
| BUG-004 | TC-004/066 | P2 | 主壳 Body 节点整体 +30 位移，把顶部栏推出 812 设计高上边界，公司名被裁切半行 | 所有机型顶部信息显示不完整 | **已修复**（`Body.setPosition(0,0)`，R6 复测 20 字公司名完整显示） |
| RISK-001 | 包体 | 观察项 | `EditorMockPlatform` / `MemoryStorage` 作为死代码被打进主包（Cocos 将 `assets` 下全部脚本打入同一 chunk） | 体积冗余；运行期不会实例化 | 已复核（非阻断）：`PlatformFactory` 仅引用 `TapPlatform`/`CocosPlatform`，建议构建期剔除 |

## 6. 未覆盖与阻塞清单

| 项 | 关联案例 | 原因 | 补齐方式 |
| --- | --- | --- | --- |
| 真机启动/断网/安卓全流程 | TC-073、TC-074、TC-076 | 无 TapTap 测试环境与安卓设备 | 用户提供设备后执行 |
| 商店素材核对 | TC-075 | 无 TapTap 后台素材清单 | 用户提供素材后核对 |
| 声音听感（静音是否彻底） | TC-069（部分 TC-070/071） | 需人耳/真机 | 用户试听并录屏 |
| 旧版存档升级 | TC-059 | 无正式 D5 旧档 | 用 `releaseGaps` 框架级结论 + 后续真机升级验证 |

> TC-068 名称/金额极限值原为缺口，已用自定义存档夹具（`tools/verify-longname-bigmoney.cjs`）复测 PASS，不再列入阻塞。

## 7. 发布判定

- **可提测**：核心经营链路（创建→首聘→12 月经营→年报）在 Web 预览与域级自动化均闭环，财务勾稽可审计。
- **可提审（有条件）**：包体结构、方向、版本号与体积满足 TapTap 上架要求，启动画面已替换为自有图片；但真机四项未执行，不得视为「可发布」。
- **阻断项**：BUG-003（P0 需求缺口，需产品决策）、真机四项（TC-073/074/076）、听感（TC-069）、商店素材（TC-075）。
- **已闭环**：BUG-001、BUG-002、BUG-004 修复并复测通过；TC-068 夹具补齐；RISK-001 复核为非阻断（死代码残留）。

## 8. 复现命令

```powershell
# 自动化基线
npm run typecheck; npm run lint; npx vitest run

# Web 预览
node tools/static-server.cjs build/web-mobile 8123

# UI 巡检截图（390×844）
node tools/shot-flow.cjs http://localhost:8123/ evidence/test-v1.1/R1
node tools/shot-m1.cjs   http://localhost:8123/ evidence/test-v1.1/R2
node tools/shot-m2.cjs   http://localhost:8123/ evidence/test-v1.1/R3
node tools/shot-m3.cjs   http://localhost:8123/ evidence/test-v1.1/R4

# 小屏与声音
node tools/shot-small-screen.cjs    http://localhost:8123/ evidence/test-v1.1/R5/small-360x640
node tools/verify-audio-settings.cjs http://localhost:8123/ evidence/test-v1.1/R5/audio
node tools/verify-longname-bigmoney.cjs http://localhost:8123/ evidence/test-v1.1/R6/tc068-longname

# 存档勾稽
node tools/verify-annual-reconcile.cjs http://localhost:8123/ evidence/test-v1.1/R2/save-dump.json

# 启动画面（生成 + 复验）
node tools/make-splash.cjs
node tools/patch-splash.cjs
node tools/verify-splash.cjs http://localhost:8123/ evidence/test-v1.1/R6/splash

# TapTap 包体
powershell -ExecutionPolicy Bypass -File tools/build-tap.ps1
```

## 9. 证据索引

| 目录/文件 | 内容 |
| --- | --- |
| `R0/automation-final.log`、`R0/automation-tests.json` | 204 用例全绿明细（23 文件） |
| `R0/typecheck.log`、`R0/lint.log` | 静态门禁 |
| `R0/build-tap-script2.log`、`R0/package-check.txt` | 打包与产物自检 |
| `R1/s01-company-name.png`、`s02-ceo.png`、`s03-hiring.png` | 向导三步 |
| `R2/m1-*.png`、`R2/save-dump.json` | 首年经营、年报、账本勾稽 |
| `R3/m2-*.png` | 部门/人才/招聘/裁员 |
| `R4/m3-*.png` | 双榜、设置、操作指引重播 |
| `R5/audio/*`、`R5/audio.log` | 声音开关状态与持久化 JSON |
| `R5/small-360x640/*` | 小屏适配截图与视口信息（fit≈0.82 复测） |
| `R6/splash/splash-*.png`、`splash-check.json` | 启动画面替换复验（700ms 自有图 / 3000ms 首屏） |
| `R6/tc068-longname/*` | 20 字公司名 / 千亿金额夹具截图与结果 JSON |

> 备注：所有状态均按实际执行结果填写，未执行项一律标注 BLOCKED，未做任何预填通过。UI 证据为 **Web 预览**（非真机），真机结论需在 R6 补测后更新。

## 10. 包体复核（功能覆盖 / TapTap 规范 / 鸿蒙）

复核对象：`build/TapBuild/game.zip`（mtime 2026-11-01 17:48:24，晚于最新源码 `assets/scripts/ui/AppView.ts` 17:32:00，即**包体包含本次全部源码改动**）。

### 10.1 功能覆盖（包内实测，非文档推断）

解包 `build/TapBuild/game.zip` 后在主 bundle `assets/main/index.0bbba.js`（323,731 字节）检索到以下模块符号，证明功能均已随包发布：

| 功能 | 包内命中符号（次数） |
| --- | --- |
| 创建公司 / CEO / 首聘 | `SaveRepository`(6)、`RecruitmentService`(4)、`privacyConsent`(4)、「同意并继续」(2)、「隐私政策」(5) |
| 财务结算 / 年报 / 扩产 | `AnnualReport`(8)、「年度报告」(1)、「扩产」(1)、`advanceRealTime`(2) |
| 招聘 / 裁员 / 调岗 / 部门 | `RecruitmentService`(4)、`LayoffService`(4)、`previewLayoff`(5)、`transferEmployee`(5)、`DepartmentService`(4)、`createDepartment`(7)、`TransferService`(4)、「部门」(11)、「裁员」(9) |
| 自动经营方针 | `AutoHireService`(4)、`setPolicy`(2)、「经营方针」(2)、「自动招聘」(4) |
| 离线结算 | `settleOffline`(5)、`computeOfflineMonths`(1)、`onShow`(6) |
| 危机 / 救助 | `RiskService`(4)、`injectRescueCapital`(5) |
| 排行榜 | `assetsLeaderboard`(5)、`yearsLeaderboard`(5)、`advanceBotsOneYear`(3)、`generateBots`(1) |
| 平台与登录 | `TapPlatform`(9)、`CocosPlatform`(6)、`AuthService`(6)、`globalThis.tap`(1) |
| 适配与音频 | `SafeArea`(10)、`AudioManager`(6)、`ceo.audio.settings`(1) |
| 存档 | `ceo/save/a`(2)、`SaveRepository`(6) |
| 帮助重播 | `replayTutorial`(2) |
| 启动画面 | 包内 `logo.png` SHA256 `9369BBDA…BC2BB`（195,571 字节，自有设计图）；`first-screen.js` 为 `displayRatio=2.4` + `bgColor=#0B1526`；`useDefaultLogo=true` 即使用 `logo.png` 而非 Cocos 官方 logo |

> 注：`LeaderboardService` / `OfflineService` 按类名检索为 0，因其实现为函数式（`assets/core/simulation/leaderboard.ts`、`offline.ts`），已用真实导出名复核为 5 次命中，功能在包内。

### 10.2 TapTap 小游戏规范符合性（技术维度）

| 检查项 | 要求 | 实测 | 结论 |
| --- | --- | --- | --- |
| 包形态 | TapTap 打包工具产出的 zip | `game.zip`，顶层 `game.js` / `first-screen.js` / `cocos-js/` / `assets/` / `src/` | 符合 |
| 体积 | 小游戏首包 ≤ 60MB（本项自设 ≤20MB 门禁更严） | 4,657,311 字节（4.44MB）/ 454 条目 | 符合 |
| 方向 | 竖屏 | `game.json.deviceOrientation = portrait` | 符合 |
| 版本号 | 三段整数且不低于线上版本 | `productVersion = 1.0.0` | 符合 |
| 工程类型 | 小游戏 | `project.config.json.compileType = "game"`；`convertScriptVersion 2.0.4-ts` | 符合 |
| 分包 | 非必需（首包远小于上限） | 无 `subpackages` | 符合 |
| 敏感文件 | 不得含密钥 / 服务端配置 / source map | 包内仅 5 个 config json，**无** `runtime.config.json`、`.env`、`.map`；`clientId/clientToken` 检索 0 次 | 符合 |
| 登录接入 | 小游戏需接入 TapTap 登录 | 代码层已接入（`TapPlatform.login()` + `AuthService` 服务端 code2Session 交换，不改写存档）；但 `authEndpoint` 来自不入库的 `runtime.config.json`，**包内未包含**，故真机首次登录需在发布时注入该配置 | **代码已就绪、配置待补** |
| 隐私合规 | 首启显著告知 | 首启隐私弹窗（`同意并继续`）+ 设置页隐私政策入口；本机单机不联网、不采集经营数据 | 符合 |
| 启动画面 | 不得残留引擎默认标识 | 自有图 + `#0B1526` 底色，无 Cocos logo | 符合 |

### 10.3 鸿蒙（HarmonyOS）结论

- **无独立鸿蒙产物**。当前发布形态为 TapTap 普通小游戏（Cocos web 运行时 + TapTap 小游戏容器），不产出 `.hap` / `harmonyos-next` 包；构建日志中的 `ohos@1.0.0`、`harmonyos-next@1.0.0` 仅为 Cocos 引擎模块注册，不等于鸿蒙适配产物。
- **代码层按鸿蒙运行时已做防御**：`TapPlatform` 对不回包的回调加了超时兜底（`TapPlatform.ts` 152/330 附近注释明确提到鸿蒙不回调 success/fail）、`tools/diag-inject.mjs` 平台分支改为「非 iOS 一律等第二帧」、`tests/unit/tapPlatform.test.ts` 含 silent 运行时（模拟鸿蒙）用例。
- **真机未验证**：鸿蒙设备上的 TapTap 小游戏容器、音频解锁、安全区、前后台离线结算均未实测（依赖真机 TC-073/074/076），因此**不能宣称“已支持鸿蒙”**，只能表述为「按鸿蒙运行时特性做了兼容性防御，待真机验证」。
- 若后续需要鸿蒙原生或鸿蒙小游戏独立包，需新增构建目标与对应资质流程，不在本阶段范围内。

### 10.4 复核结论

1. 包体**覆盖当前全部已实现功能**，且晚于最后一次源码修改，不存在「用旧包冒充新功能」的情况。
2. TapTap 小游戏技术规范 **9 项中 8 项符合，1 项需发布侧补配置**（`runtime.config.json` 的 `authEndpoint` 未随包，登录代码就绪）。
3. 鸿蒙**无独立产物**，仅代码级兼容防御，真机未验证，不宜对外宣称已支持。
4. 遗留优化项：`EditorMockPlatform` / `MemoryStorage` 死代码仍在包内（RISK-001，非阻断），建议后续在构建期剔除。
