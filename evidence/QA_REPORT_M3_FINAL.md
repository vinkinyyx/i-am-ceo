# 《我是CEO》独立 QA 复核报告（M0–M3 + 发布前平台项）

- 复核日期：2026-11-01
- 复核方式：独立重新执行自动化套件 + 代码/包体核查 + web-mobile 无头 Chromium 验证；不以开发自报代替复测
- 引擎/插件：Cocos Creator 3.8.8 + taptap-minigame-tools 1.2.2
- 基线：economy-v1.0.0 / golden-cases-v1.0.0 / save schemaVersion=1

## 1. 自动化复核结果

| 项 | 命令 | 结果 |
|---|---|---|
| 单元/集成/黄金/模拟 | `npx vitest run` | **204 passed / 23 files（全绿）** |
| 类型检查 | `npm run typecheck` | 通过，0 错误 |
| 静态检查 | `npm run lint` | 通过，0 错误 |
| 百种子经济模拟 | simulate5year（900 run） | 零负现金、零财务守恒失败、零重复救助、单年自动招聘≤3 |
| 服务端自检 | `node server/selftest.mjs` | 8/8 PASS（含不回传 session_key/openid） |
| web-mobile 无头 | `node tools/verify-v5.cjs` | 隐私首启弹窗→同意落盘→重载不再弹，零 JS 错误 |

黄金用例 G001–G017 全部有断言覆盖；G001/G002/G003 三行业首年黄金账分毫不差；本轮修正 **G016 财务部门口径**后全部通过。

## 2. 黄金用例矩阵（G001–G017）

| ID | 结论 | 落点 |
|---|---|---|
| G001/G002/G003 三行业首年 | PASS | goldenYear1（利润 38000/35000/43500，末现 338000/335000/343500） |
| G004 采购节省 91200 | PASS | departmentsM2（公式级 + 端到端，费用只减一次） |
| G005 裁员 3 年赔 16000 | PASS | staffingM2 |
| G006 首聘费 | PASS | initialHiring |
| G007 扩产 CAPEX | PASS | investment |
| G008 时钟三档全年 | PASS | clock |
| G009 离线 8h/40h | PASS | offlineM3 |
| G010 亏损不清零 | PASS | annualGoal（本轮新增显式用例） |
| G011 三年连盈达标继续 | PASS | annualGoal（本轮补编号） |
| G012 救助一次性 | PASS | eventRiskM3 |
| G013 采购 0 人/去重 | PASS | departmentsM2（含 B06 连点） |
| G014 客服 35% | PASS | departmentsM2 |
| G015/G016 财务合并基数 | PASS | departmentsM2（**本轮修正实现：对"固定费+其他可控运营费"合并节省，先抵固定再抵其他**） |
| G017 HR 产能 +6% | PASS | departmentsM2 |

## 3. 故障与安全用例（B01–B16）

| ID | 结论 | 说明 |
|---|---|---|
| B01/B02 写盘/断电恢复 | PASS | saveRepository |
| B03 墓碑清理 | PASS | resetCompany |
| B04 候选幂等 | PASS | initialHiring |
| B05 招聘与月结并发串行 | PASS（本轮新增） | GameStore mutate 串行锁，并发命令至多一个生效 |
| B06 连点建部只扣一次 | PASS（补编号） | 与 G013 同一用例 |
| B07 裁员重复提交 | PASS | staffingM2 |
| B08/B09/B10 离线回拨/累积/暂停 | PASS | offlineM3 |
| B11 首聘中断恢复 | PASS | initialHiring |
| B12 危机救助恢复 | PASS | eventRiskM3 |
| B13 事件固定 seed | PASS | eventRiskM3 |
| B14 奇异存档拒绝恢复 | PASS（本轮新增） | 新增 stateIntegrity 业务级校验，装载时拒绝并回退另一槽 |
| B15 100 年/500KB 历史压缩 | PASS（本轮新增） | 新增 statePrune，年结裁剪年报/月账/快照/日志；120 年存档 <500KB |
| B16 包体无 Mock/无 BOM 依赖/无密钥 | PASS（本轮新增） | packageHygiene 静态约束 + 包体扫描 |

## 4. 业务验收矩阵（A01–A25）

自动化/无头可验证项均 PASS；以下为需要真机或主体后台、**当前无法在 CI 内闭环**的项：

| ID | 场景 | 状态 |
|---|---|---|
| A20 | 真实 TapTap 包体可上传且客户端可玩 | 包已产出待上传；客户端扫码自测待真机 |
| A21 | 安全区/异形屏 Android/iOS | 代码已接入 safeArea 并有纯函数单测；**真机视觉验收待做** |
| A22 | 登录失效/断网恢复 | 代码已实现（可重试/可单机）；**真机 + 服务端联调待做** |
| A24 | 备案/资质/物料可核验 | 备案 IN_PROGRESS、软著长尾、隐私政策 URL/实机截图/录屏待补 |

其余 A01–A19、A23、A25 由 companyCreate/initialHiring/resetCompany/annualGoal/offlineM3/eventRiskM3/departmentsM2/staffingM2/privacyConsent 等覆盖（A23 隐私同意首启+设置入口本轮新增）。

## 5. 本轮平台/合规代码新增（已过测）

- 安全区适配：`core/platform/safeArea.ts`（纯函数）+ AppView 内容层缩放居中。
- 隐私：首启告知弹窗（同意前不登录不联网）、版本化同意记录、设置页入口。
- 登录：`core/platform/AuthService.ts`（tap.login→最小服务端交换→短期会话；编辑器 mock；失败可重试/可单机）；`TapPlatform.request`/`CocosPlatform.request`。
- 最小服务端：`server/auth-server.mjs`（零依赖、密钥仅环境变量、不回传 session_key/openid、8 项自检）。
- DEC-028 核实：普通小游戏无"加桌面"API（属 APK TapPlay），真正必接为 TapTap 登录；已更新 docs/08、docs/11。
- 财务 G016 口径修正：财务部门合并节省"固定管理费+其他可控运营费"。

## 6. 包体自检（v5）

- 路径：`build/TapBuild/game.zip`，4.18MB（≤20MB 目标，远低于官方 60M+）
- SHA256：`0A833DEA46EE4A3DE95FBCA98BEF2E7E46BAB86EBDB86E73058061DED10A5699`
- 446 项；game.json=portrait/1.0.0；含隐私/登录交换/完整性校验/安全区/历史裁剪代码
- 不含 EditorMockPlatform、不含 Server Secret/Client Token/session_key/私钥；AppID 不写死在包内逻辑（上传时后台绑定）
- 运行时配置 `runtime.config.json`（authEndpoint/privacyPolicyUrl）已打入，当前为空（安全默认）

## 7. QA 结论

- **代码与自动化层面：达到"可提审候选"质量门禁**，无未解决 P0/P1 自动化缺陷。
- 仍 BLOCKED 在**只能由真实设备/主体账号闭环**的事项：iOS 真机、Android 包体上传后扫码自测、登录服务端真机联调（需官方 code2Session URL/Server Secret）、隐私政策 URL、备案/软著、实机截图与录屏。
- 在上述真机/资质项完成前，状态声明为"开发可提审（READY FOR REVIEW PACKAGE）"，**不声明已上架**。
