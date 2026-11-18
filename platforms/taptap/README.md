# 《我是CEO》TapTap 发布手册

维护范围包括本地构建、平台联调和发行验收。账号操作和对外动作遵循 [Agent 规则](../../AGENTS.md)。

| 位置 | 所属能力 |
|---|---|
| [assets/platforms/taptap/](../../assets/platforms/taptap/) | 宿主、登录、激励视频、云备份和公开榜适配器 |
| [assets/resources/platforms/taptap/](../../assets/resources/platforms/taptap/) | TapTap 客户端配置及运行配置样例 |
| [隐私政策](docs/隐私政策_我是CEO.md) | TapTap 公开文案维护稿 |
| [tools/](tools/) | 本地构建、转换、补丁、打包、校验及指纹 |
| [services/tap-auth/](services/tap-auth/) · [server/](server/README.md) | 换票云函数与最小自托管认证参考 |
| [materials/](materials/) · [skills/](skills/taptap-mini-game-publisher/SKILL.md) | 商店物料与项目发布 Skill |

从仓库根目录运行。首次本地构建可把 `assets/resources/platforms/taptap/runtime.config.example.json` 复制为同目录的 `runtime.config.json`。保留已有本地配置。用于诊断的样例停用云、榜、广告的外部能力。

```powershell
npm run release-build -- -Purpose diagnostic -ReleaseId local-diagnostic -GameVersion 1.0.0
node platforms/taptap/server/selftest.mjs
```

`npm run tap-build` 也是诊断构建入口，自动生成 releaseId。更换尝试目录使用 `-Attempt`。中间的 `wechatgame` 为 Creator 提供给 TapTap 转换器的输入。包在 `build/taptap/release/<releaseId>/<attempt>/game.zip`，日志及 manifest 在 `build/taptap/logs/<releaseId>/<attempt>/`。

Creator 需在项目根目录发现 `extensions/taptap-minigame-tools/` 和 `build-templates/wechatgame/`。这两处为引擎加载路径。

## 发布与联调

- 游戏目标为 Tap 普通小游戏，Cocos Web 预览用于本机回归。构建前确认 Creator 及 TapTap 转换扩展、发行模式、运行配置，关闭正在占用本工程的编辑器。
- 用 `diagnostic` 做禁用能力的本地运行与回归。平台条件齐备后，按真实用途生成测试候选或生产候选。保留 releaseId、版本、完整 ZIP SHA-256、manifest 和自测记录；测试与生产的账号、配置、广告位和榜单需要匹配各自环境。
- 安装 CLI 或调用平台前，查当前 CLI 的 `skills list`、目标命令 `--help` 和 `schema`。开发者账号由本人走官方授权；核实 App 归属和协作权限。若能力、形态或当前权限不能覆盖目标操作，回到开发者后台已明确支持的入口。H5 MCP 不能当作本项目 WebGL 包体的上传入口。
- 发行前分别核对主体认证、当前 App 的前置备案和所需资质、商店素材权属和内容、隐私政策 HTTPS 可访问、适龄与广告披露。通过认证、同包真机验证、平台审核和正式启用分别记录。
- 已有平台登录、云与榜的本地实现和换票部署包，真实账号交换、跨设备、榜单和广告仍需同一候选包实测。准备匹配 App 的测试账号、设备、云与榜配置，以及已授权的 HTTPS 换票入口。密钥只填服务端安全配置，项目内只留样例。
- 本轮本地诊断证据见[项目日志](../../docs/CHANGELOG.md)。平台通用知识、来源及异常处理见[项目发布 Skill](skills/taptap-mini-game-publisher/SKILL.md)。

## 激励视频

### 32.1 范围、事实与交付阶段

《我是CEO》为 Cocos Creator 3.8.8 + TypeScript 的竖屏 Tap 普通小游戏，项目既有官方查询确认 App ID `1016161`。本专项沿用产品决策 DEC-040，覆盖一个 Dirichlet 激励视频位、经营页每日提醒和普通招聘两个入口、招聘费减免券以及同包实测。项目 Skill 的[广告参考](skills/taptap-mini-game-publisher/references/05-ads.md)维护通用平台办理流程，本文维护游戏实际实现与验收。产品规则见[项目总览](../../docs/我是CEO_项目总览.md)与 DEC-040。

| 阶段 | 当前事实 | 完成条件 |
|---|---|---|
| 后台绑定 | 用户已进入 Dirichlet。截图选择「测试 / 小游戏 / Tap 小游戏」，必填游戏下拉无匹配 | 找到目标 App 的有效绑定与测试位，或取得官方明确的首发前联调方法 |
| 本地实现 | Provider、Coordinator、发券与招聘事务、隐私和 UI 入口已存在。当前 `ads.config.json` 为 disabled，推广位为空 | 针对 §32.4 的实际缺口复现并修复，广告专项测试通过 |
| 真机接通 | 待取得有效测试位并构建测试候选 | 目标 Android/iOS Tap 客户端实际播放，奖励与招聘账本符合 §32.6 |
| 正式启用 | 待验证 | 正式媒体和推广位状态、隐私披露、正式候选及其回归结果齐备 |

### 32.2 后台操作与空列表处理

1. 核对 TapTap 中 App `1016161` 的厂商和当前状态，核对 Dirichlet 流量主的关联主体与账号管理权限。若出现厂商不一致，先纠正登录或管理范围，确认现有游戏和流量主的归属。
2. Dirichlet → 流量管理 → 媒体管理 → 新建媒体，选「测试 / 小游戏 / Tap 小游戏」，名称「我是CEO」。绑定选中该 App。若有第三方聚合竞价项，首轮直连保持关闭。
3. 同一主体下仍无可选项时，在 TapTap 开发者中心右上角提交工单，附 App ID、游戏状态、厂商、表单路径和脱敏截图。问清该 App 出现在下拉的具体条件，是否能首发前绑定测试媒体，或由平台提供适用的测试推广位。通用 FAQ 提到开放下载前的测试媒体，小游戏公开指南未列出该必填下拉框的准入条件。只有官方答复明确要求并确认适用于本 App 时，才据此安排上架顺序。公开发布、开预约和提交审核有各自的授权范围。
4. 绑定可用后，推广位管理 → 新建推广位，选所属媒体「我是CEO」、类型「激励视频」、测试属性，若有方向字段选「竖屏」。名称可用「我是CEO-招聘费减免-激励视频-测试」。保留推广位详情中的 App/媒体关联、推广位 ID、测试属性和实际设备测试要求。历史 MCP `status=0` 是另一入口的历史查询记录，当前 Dirichlet 流程以真实后台详情或官方针对该 App 的答复为准。MCP/CLI 只有明确覆盖该 App 的 Dirichlet 资源时才作为查询渠道。

工单正文可直接使用下文。

> 《我是CEO》（App ID 1016161）是 Tap 普通小游戏。Dirichlet 新建「测试 → 小游戏 → Tap 小游戏」媒体时，必填的「选择 TapTap 上架的游戏/应用」无匹配结果。请确认该 App 在什么状态下可绑定测试媒体，以及是否有首发前的测试绑定或激励视频测试推广位办理方式。

来源：[TapTap 普通小游戏 IAA](https://developer.taptap.cn/minigameapidoc/quick-start/monetization/IAA-game/)、[Dirichlet 小游戏接入](https://ssp.dirichlet.cn/docs/mini-program-guide/)、[Dirichlet 办理流程](https://ssp.dirichlet.cn/docs/ssp-guide/)、[Dirichlet 测试 FAQ](https://ssp.dirichlet.cn/docs/faq/)、[TapTap 官方工单](https://developer.taptap.cn/minigameapidoc/quick-start/document-guide/#反馈与求助)。

### 32.3 产品行为与状态提交

- 两个入口共用同一广告位和成功额度。完成首聘两人、真实前台经营满 60 秒、完成适用的隐私同意且可安全展示后，经营页每天最多提醒一次，可跳过。跳过后当天不重复提示，仍可在日常招聘中主动进入。招聘页同时保留正常付费招聘。
- 完整观看领一张券，同一北京时间自然日最多成功一次，按既有规则最多持有一张有效券、有效期 7 个自然日。先查券、冷却、每日请求额度、当前公司和存档状态。无填充或中途退出不计为成功发券，既有频控为每天最多 3 次请求，相邻请求间隔至少 120 秒。跨午夜按原会话预留日结算，重开公司沿用现有日额度规则。
- 请求链沿用 `AppView → AdRewardCoordinator → GameFacade / GameStore → TapRewardedAdProvider`。先提交观看会话预留，再调用 Provider。Provider 只从本次 `onClose({ isEnded: true })` 返回完成。Coordinator 绑定原 `sessionId`、`runId` 和 owner，将发券及成功额度写进同一个存档事务。普通招聘预览显示一次性招聘费和月薪，使用券后重新确认。扣券与录用同事务，招聘费为 0、月薪原额、次月到岗。取消、候选过期或提交失败时按原事务回执核对券，避免多扣或吞券。
- 广告关掉后经营和音频恢复。奖励写入未知时使用原会话查回执或补核，玩家可继续经营。核对原公司与归属后才能补发。同一局刷新、重复回调或重复点击只得到一次奖励。进程被杀后按现有持久化回执判断：已提交则读回，只有预留且无完成证据则取消并正常经营。

### 32.4 代码落点与必须复验的边界

| 模块 | 当前实现 / 后续工作 |
|---|---|
| [TapRewardedAdProvider](../../assets/platforms/taptap/TapRewardedAdProvider.ts) | 已用 `tap.createRewardedVideoAd` 和严格 `isEnded === true`。当前加载等待主要绑定在单次请求，关闭后自动预加载的 `onLoad` 可能在下次请求之前到达。先用现有 Provider 测试模拟该顺序，再用真机复验。若复现，用实例生命周期内的加载监听维护就绪状态，明确初始化、关闭、错误和释放时机。单次会话的关闭/错误监听只解绑自身。 |
| 同一 Provider 的播放异常 | 当前 `show()` 拒绝或超时会结束调用但保留防迟到回调的会话。验证宿主在明确失败后是否仍发 close，以及 close 与 onShow 的先后。若复现永久占用，在能确认原生播放终止的分支释放；不确定时隔离旧会话，恢复正常经营，按已核实的宿主事件或宿主重启恢复广告入口。复验旧 close 到达时无法完成新会话。 |
| [AdRewardCoordinator](../../assets/scripts/ads/AdRewardCoordinator.ts)、[AppView](../../assets/scripts/ui/AppView.ts) | 已有待核状态与 owner 校验。当前 owner 状态判定把 `identityVerification === 'unavailable'` 归为未知。需用广告单能力配置复现首次进入和回前台后发券，防止云身份不可用把从未绑定的平台本地玩家永久挂起。设计上由既有本地 scope 支持从未绑定且无切换迹象的本地经营；已有账号归属且身份未知则保留原 owner 等待核对。不得把既有绑定降级为 local。 |
| [AdRewardService](../../assets/core/application/AdRewardService.ts)、[RecruitmentService](../../assets/core/application/RecruitmentService.ts) | 复用现有预约日、发券、券归属和招聘事务。用现有单测与集成测试覆盖异常时钟、跨午夜、重开、换号及恢复。若修复只在 Provider 或前台身份判断，领域模型和招聘计算沿用现有实现。 |
| 配置与隐私 | [adConfig.ts](../../assets/scripts/ads/adConfig.ts) 校验 schema、策略版本、推广位和 `privacyReviewed`。上线前根据实际广告服务和数据用途核对游戏内政策、公开 HTTPS 链接、玩家同意时序。拒绝隐私后正常经营，无广告请求。 |

排查时记录阶段、脱敏会话标识、平台 `errCode`、宿主版本与环境。加载阶段当前将错误折叠为 `load-failed`，若真机联调无法定位原因，保留脱敏错误码用于日志，面向玩家继续显示可经营的提示。`1002` 查位 ID 和所属关系，`1004` 验证无填充降级，`1005–1008` 查审核与开关。来源：[官方激励视频接口](https://developer.taptap.cn/minigameapidoc/dev/tutorial/open-capabilities/ad/rewarded-video-ad/)、[错误码](https://developer.taptap.cn/minigameapidoc/dev/api/ad/RewardedVideoAd.onError/)、[广告审核规则](https://developer.taptap.cn/minigameapidoc/tap-operation/operation-standards/minigame-ad-policy/)。

### 32.5 配置、构建和联调

| 构建用途 | 广告配置与证据 |
|---|---|
| `diagnostic` | `environment=disabled`、`enabled=false`、ID 空。用于普通经营与禁用降级回归。 |
| `product-test-candidate` | 隔离构建使用 `environment=test`、真实测试位、完成隐私核对后启用。按当前 schema 2、策略版本 3、`dailyGrantLimit=1`，设置可访问的 `runtime.privacyPolicyUrl`。广告单能力候选可以保留云和榜关闭，`runtime.authEndpoint` 留空。 |
| `product-production-candidate` | 使用该 App 审核通过且开启的正式推广位及生产环境，按同样隐私条件重新打包，复核正式包和推广位对应关系。 |

平台配置只放客户端使用的推广位 ID 等必要数据，凭据、财务材料和媒体密钥留在官方办理渠道。构建从隔离的配置开始，仓库默认仍可用于无广告开发。现有 [配置校验器](tools/validate-release-config.cjs) 检查字段和占位值，媒体归属及正式状态通过后台证据确认。

本地开发使用 `npm run test -- tests/unit/rewardedAdProvider.test.ts tests/unit/adRewardState.test.ts tests/integration/adCoordinator.test.ts` 和 `npm run typecheck:ui`。测试位和隐私配置齐备后，按实际 App 版本记录选取新版本和 releaseId，使用 `npm run release-build -- -Purpose product-test-candidate -ReleaseId <新releaseId> -GameVersion <三段版本号>`。记录 `CONFIG_OK`、产物 SHA-256、构建用途和测试位。经授权上传该包到开发版本，在 Dirichlet「流量管理 → 测试工具」按后台要求配置测试设备，再在 Tap 客户端扫描该开发包的自测二维码。记录包版本、SHA、客户端版本、系统、设备和业务结果。来源：[真机调试](https://developer.taptap.cn/minigameapidoc/dev/dev-support/debugging/)、[Dirichlet 测试工具与上线](https://ssp.dirichlet.cn/docs/ssp-guide/)。

### 32.6 验收与执行顺序

| 场景 | 通过条件 |
|---|---|
| 首聘、首启、隐私拒绝、广告关闭 | 首聘与首 60 秒无广告入口，拒绝或关闭时可正常经营和付费招聘，不消耗每日提示 |
| 双入口与完整观看 | 玩家主动点击，视频完整关闭后才发一张券；重复点击、重复回调、换入口均无额外券。重启回读券和日额度 |
| 提前退出、弱网、无填充、无效位 | 无券，招聘、经营和音频恢复；仅按原频控手动重试 |
| 次日且无有效券，或未领到券后的合规重试 | 模拟与真机覆盖提前就绪、延迟就绪、load 错误、show 拒绝和迟到 close，后续有效请求可播，旧回调不能给新会话发券 |
| 返回顺序与存档异常 | 覆盖 close 先于/晚于 onShow，已完成但存档未知时核原事务，经营时钟可恢复，无重复播放、重复结算或重复发券 |
| 本地经营与账号变化 | 广告单能力配置下本地玩家可以发券和使用。已绑定账号未知时保留原待核记录，换号、换公司、云恢复时无串券 |
| 券招聘与正常招聘 | 券招聘实际招聘费为 0、月薪原额、次月到岗，扣券只一次。正常招聘原价，取消/候选过期不消耗券 |
| 正式候选 | 同 App 正式推广位已审核且开启，生产包配置一致，按目标设备复测播放、完成、失败和账本。若需止损，按授权关闭 Dirichlet 推广位并验证降级，后续发布禁用广告的候选 |

**TASK-F27-B3 / DEV-05 广告子项执行顺序**。先完成 §32.2 的后台归属核查，同时用本地夹具验证 §32.4 的加载和身份边界。有效测试位齐备后构建、上传自测并跑 §32.6。完成条件由原生播放、券和账本读回共同证明。公开文档对空列表的具体准入条件仍待官方答复，当前阶段为设计完成、平台绑定待确认、真机未测。
