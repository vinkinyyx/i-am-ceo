# R32 执行结果（A 本地收口 / B 能力接通 / C 同包真机 / D 可提审）

日期：2026-11-07（任务跨午夜，源于 11 月 6 日）
范围：§27.4 A1—A3、§27.5 B1、§27.6 B2、B3 只读复核、C/D 阻塞口径
纪律：未部署、未上传、未修改后台、未提审、未发布、未 git commit/push。

## 0. 本轮代码改动（仅本地）

| 文件 | 改动 | 目的 |
|---|---|---|
| `assets/scripts/ui/AppView.ts` | 运行中确认被拒时区分原因，给出“暂停并重新预览 / 暂停并重新预览”出口 | A1 反例语义与文案一致 |
| `assets/scripts/ui/AppView.ts` | `downloadCloudPreview` 下载期间只校验身份与 runId，基线由 `prepareRestore` 在下载完成时捕获，并回传 `settledOwner` | 保持经营时也能生成预览；之后任何 tick 使确认安全过期 |
| `assets/core/application/CloudSyncService.ts` | `prepareRestore` 在未显式传 expected 时，以“下载完成这一刻”为基线 | 同上；传 expected 的旧调用语义不变 |
| `assets/scripts/ui/shortContentAnchor.ts`（新增） | 短内容 ScrollView 逐帧把 Content 顶边贴回可视区；超过一屏立即让位 | 修复“按钮看得见点不到”，Cocos 限制单脚本一个 Component |
| `assets/scripts/ui/dialogs.ts` | 在 `buildScroll` 挂载 `ShortContentAnchor` | 同上 |
| `assets/core/application/CloudSyncService.ts` | `backup()` 支持 `allowNewCheckpointWithLegacy`；新增 `reconcileLegacyPending` | A2 只读核对 / 另建新备份（上一轮已写，本轮验收） |
| `assets/core/platform/AuthService.ts`、`PlayerIdentity.ts` | profile 协议校验、作用域缓存、`SessionPlayerIdentityProvider` | B2 |

F26 已通过的事务、owner、父子布局修复未改动。

## 1. A 本地收口

### A1 云恢复预览的暂停选择

Web 构建：`build/web-mobile`（01:29 重建，ad 环境 disabled）
验收脚本：`evidence/acceptance-r32-20261107/a1-a2-web.cjs`
报告：`evidence/acceptance-r32-20261107/a1-a2-report.json` → **PASS 14/14，browserErrors 0**

| 场景 | 断言 | 结果 |
|---|---|---|
| S1 | 三动作可见；点击暂停后 `speed=0 && status=ready` 才预览；停留 5.5s 后确认成功（cash 777777）；恢复后保持暂停并给“继续经营（1×）”；点击后 `speed=1` | PASS |
| S2 | 保持经营 → 停留 5.6s → 确认被拒且提示“请暂停并重新预览”；点击后先暂停再重预览（`speed=0/ready`），停留 5.6s 后确认成功 | PASS |
| S3 | 取消后显示“经营已暂停”+继续入口；点“保持暂停”后 `speed` 仍为 0；未导入云档 | PASS |
| S4 | 旧 pending 展示 operationId/checkpointId 与只读核对入口；核对成功 create=0，旧 key 清除 | PASS |
| S5 | “保留旧未决，另建新备份”→ create=1，旧记录保留，toast 明确“未重发旧上传” | PASS |

截图：`S1-pause-choice.png`、`S1-restored-paused.png`、`S2-baseline-expired.png`、`S2-restored.png`、`S3-cancel-paused.png`、`S4-legacy-pending.png`、`S4-legacy-confirmed.png`、`S5-new-backup.png`。

### A2 旧 global pending

- 服务层：`reconcileLegacyPending` 仅 list/download/readLocal/decode，唯一命中且 app/env/profile/checkpoint 一致才迁移水位并删除旧 key；未找到/列表失败/重复/跨账号/内容损坏均保留隔离。
- 单测：`tests/integration/cloudSync.test.ts`（含 7 个 legacy 用例）通过。
- 浏览器：S4/S5 见上，真实 create 计数为 0 / 1，旧意图从未重发。

### A3 固定故障点与四视口

- 暂停路径故障矩阵：`tests/integration/cloudPauseFaultMatrix.test.ts` 5 例通过；
  统一不变量 `isPreviewEligible = ok && speed===0 && status==='ready'`，
  覆盖 slot-before-apply（→recovery-required）、pointer-after-apply（→recovery-required）、journal-remove（可恢复 ready 或不可预览）与健康路径；失败路径永不可预览。
- 既有事务/owner 矩阵继续覆盖 staging、intent、墓碑、目标槽、指针：`transactionRecoveryMatrix.test.ts`（11 例）、`f26OwnerRestoreRecovery.test.ts`（3 例）。
- 四视口 375×812、360×640、390×844、375×834 顺序执行：
  `evidence/acceptance-r32-20261107/visual-min-r32b/visual-matrix-report.json` → 4/4 PASS，28 checks。
  说明：该矩阵为现有主 Tab 视觉/热区检查，不覆盖 §19.11 全部弹窗与键盘/安全区用例（沿用既有口径，未扩张范围）。

### A 出口门禁

| 项目 | 命令 | 结果 |
|---|---|---|
| Lint | `npm run lint` | PASS |
| 主工程类型 | `npm run typecheck` | PASS |
| UI 类型 | `npm run typecheck:ui` | PASS |
| 全量测试（单 worker） | `npx vitest run --maxWorkers=1 --minWorkers=1 --no-file-parallelism` | **577 passed / 1 skipped，69 files** |
| Web 构建 | `powershell -File tools/build-web.ps1` | PASS |
| A1/A2 浏览器 | `node evidence/acceptance-r32-20261107/a1-a2-web.cjs` | PASS 14/14 |

### 当前本地包（diagnostic，未上传）

- 目录：`build/release/m4-20261107-r32-a/01/game.zip`
- 版本：1.0.6；大小 4,452,972 bytes（4.247 MiB）；461 entries
- SHA256：`541685fc350a4dd2565a44b9acaeec483f1474a7f9a164891dd68174ed19b14e`
- manifest：`evidence/m3/build/m4-20261107-r32-a/01/manifest.json`（PIPELINE_OK / VERIFY_OK / CRC 通过）
- 输入指纹：`8971897902a5ee5b748876cbfe0774d955c557d00201fa7a6d63b1c8daadaea4`（549 项，构建前后一致）
- 属性：adsEnvironment=disabled、policyVersion=3、debug=false、sourceMaps=false；不含服务端 Secret/.env/测试 Fake

## 2. B 能力接通

### B1 最小换票云函数（代码/测试/部署包完成，未部署）

- 代码：`services/tap-auth/{handler.cjs,exchange.cjs,session.cjs,package.json,env.example}`
  - `POST /v1/auth/taptap/exchange`（仅 code，≤4KiB），`GET /health`；错误码 400/401/429/503
  - 上游 `cloud-miniapp.tapapis.cn/auth/v1/jscode2session` 4s 超时；secret/session_key/openid 不下发、不写日志
  - profileId = `tap_` + HMAC 截断（43 字符）；session 含 sub/aud/iat/exp/jti，恒时比较
- 契约测试：`tests/unit/tapAuthContract.test.mjs` **38 通过**（合法交换、无效/过期 code、上游超时/错误/缺字段、错 app/env、profile 稳定、签名篡改/过期、日志无敏感内容）
- 部署包：`build/server/tap-auth-20261107/01/tap-auth.zip`（9,487 bytes，SHA256 `8bb863ed7e021c75a088b42d79e7c10c3772299448966e450a4d352db3bef159`，manifest 见同目录，CRC 通过、5 条目、无顶层目录）

**部署配置预览（腾讯云 SCF，待用户确认后执行）**

| 项 | 值 |
|---|---|
| 地域 | ap-guangzhou（与国内 Tap 服务同区，延迟最低） |
| 函数类型 | 事件函数，运行环境 Node.js 20.x（20.19 线） |
| 入口 | `handler.main` |
| 内存/超时 | 128 MB / 10 s |
| 并发 | 单实例并发 1；预留并发 0（按量弹性） |
| 函数 URL | 开启，公网访问（认证 NONE），HTTPS 由平台提供；CORS 仅放行 Web 联调 Origin 与 Tap 实际请求域名 |
| 环境变量 | `TAP_MINIAPP_ID`、`TAP_MINIAPP_SECRET`、`GAME_APP_ID=1016161`、`GAME_ENV=test`、`PROFILE_HMAC_KEY`、`SESSION_SIGNING_KEY`（Secret 由用户在控制台填写） |
| 日志 | 仅 requestId/耗时/结果码；关闭请求体与上游 URL 记录 |
| 其他资源 | 无数据库、无 VPC、无 CLB、无自定义域名、无定时触发器 |

**费用估算（公式，最终以官网价格与账号实际计费为准）**：资源使用 = 调用次数 × 单价(元/GBs) × 内存(GB) × 单次耗时(s)；调用次数费另计；出网流量按 GB 计。
按 128 MB、200 ms/次、1 万次/月计算 ≈ 250 GBs + 1 万次调用，处于常见免费额度内，量级为 **0—1 元/月**；主要变量是出网流量（每次响应约 0.3 KB，可忽略）。不产生固定规格费用。

**变更预览**：新建 1 个函数 + 1 个函数 URL + 6 个环境变量（其中 2 个密钥由用户填写）；不新建数据库/网络/证书/域名；回滚 = 删除函数与 URL。
**部署前置（用户办理）**：① 腾讯云实名账号并授权创建 SCF；② 提供 MiniApp ID 与 Server Secret（只在控制台环境变量填写，不发聊天/仓库）；③ 在 Tap 后台把函数 URL 域名加入 request 合法域名；④ 确认地域与预算。

### B2 客户端身份接线（本地完成）

- `AuthService`：解析并严格校验 `protocolVersion=1 / profileId / appId / environment / scope=tap-minigame-account`；无 protocolVersion 的旧服务端只允许登录、不产生 verified 身份；`setExpectedScope` 使跨 app/环境缓存会话失效并强制重登；`currentSession()` 只读。
- `PlayerIdentity`：`SessionPlayerIdentityProvider` 仅在 tap 运行时 + 有效 profile + 未过期 + scope/app/env 匹配时 verified，否则给出具体 unavailable 原因。
- `AppView`：登录单飞（`loginInFlight`）+ `authed` 复验；云初始化以新 profile 推进 authEpoch。
- 测试：`tests/unit/authService.test.ts` 17 例、`tests/unit/playerIdentity.test.ts` 6 例通过；浏览器/构建层面未回归（A1/A2 14/14 + 四视口 28/28）。
- 边界：真实 `tap.login → 换票 → profile 一致` 必须部署 B1 后在同包真机验证；当前不作为通过。

### B3 广告（只读复核：未开通）

- 事实：`check_ads_status` 返回 status=0（未开通）；用户已确认办理后再刷新，本轮不自动轮询。
- 办理人/入口：用户本人；https://developer.taptap.cn/forge/503251/app/1016161/operation/ad-monetization 完成主体/协议/收款。
- 解除条件：status=1 且存在有效竖屏广告位；用户告知“重新检查广告状态”后 agent 再查一次。
- 解除后验收：`get_ad_integration_guide` → 最小接入 → L2 包；按 P01—P04 验完整观看/取消/无填充/双入口/首聘/券招聘。

## 3. C 同包真机（BLOCKED，未虚构）

| 项 | 内容 |
|---|---|
| 实际证据 | 无 Tap 可测设备/测试资格；无第二设备或安全清档条件；无两个测试账号；当前包为 diagnostic（adsEnvironment=disabled） |
| 办理人 | 用户 |
| 入口 | TapTap 开发者后台《我是CEO》(App 1016161) → 测试计划/包体管理，安装 `game.zip`（SHA 541685fc…）；云恢复需第二设备；榜单需两个合法账号 |
| 解除条件 | 至少 1 台可安装本包的 TapTap 设备 + 安装资格；云/榜项再需第二设备/第二账号 |
| 解除后验收 | 同 SHA 跑 §27.8 P01—P09（视频券、取消/无填充、未知发券核对、双入口/首聘、跨设备云档、A/B 账号、双榜撤回、生命周期、30 分钟稳定性），逐项记录 PASS/FAIL |

## 4. D 可提审（BLOCKED，未虚构）

| 阻塞 | 实际证据 | 办理人/入口 | 解除条件 | 解除后验收 |
|---|---|---|---|---|
| 广告未开通 | status=0 | 用户；§27.7 的 ad-monetization 入口 | status=1 且有有效竖屏位 | B3 解除后验收 |
| 换票服务未部署 | 仅有 ZIP，无 HTTPS 入口 | 用户授权部署；腾讯云 SCF | 按 B1 配置创建函数并配置 6 个环境变量 | 真机 `tap.login` 换票成功、profile 跨设备一致、云档绑定 |
| MiniApp ID/Secret 未配置 | `services/tap-auth/env.example` 仍为占位符；MCP 未返回 MiniApp ID | 用户在《我是CEO》小游戏开发设置核实并直接填云环境变量 | 两值与函数绑定 | `/health` ready；交换返回 appId=1016161 |
| 隐私政策 URL 为空 | runtime 隐私 URL 为空 | 用户提供主体/邮箱/可访问 URL | URL 可访问且与登录/云/榜/广告披露一致 | 首启同意流程与后台资料一致 |
| 资质未核验 | 备案/权属/版号状态未提供 | 用户在后台按实际状态提供 | 资质齐全 | 提交审核前逐项核对 |
| 测试计划/资格 | 未建立 | 用户后台创建测试计划 | 计划生效 | 与 C 阶段合并验证 |

以上任一未解除时，不进入上传/绑定/提审/发布；这些动作另需用户逐项授权。

## 5. 未授权操作声明

本轮未执行：云函数部署、任何商店/广告/榜单后台上写、包体上传、资料绑定、提审、发布、git commit/push。所有产物仅存在于本地工作区。
