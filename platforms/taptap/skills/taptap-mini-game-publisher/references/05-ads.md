# TapTap 广告接入

## 按包体选择入口

| 游戏形态 | 广告运营 | 客户端接入 |
|---|---|---|
| Tap 普通小游戏（WebGL） | Dirichlet（TapADN）媒体、推广位、测试、报表和结算 | Tap 客户端提供的 `tap` 小游戏广告 API |
| 星火、H5、TapTap 制造 | 对应游戏在 TapTap 开发者中心的小游戏广告能力 | 查该形态的官方指南及实际工具支持范围 |
| Android/iOS 原生应用 | Dirichlet 应用媒体 | 对应原生 SDK 文档 |

来源：[普通小游戏 IAA](https://developer.taptap.cn/minigameapidoc/quick-start/monetization/IAA-game/)、[Dirichlet 小游戏指南](https://ssp.dirichlet.cn/docs/mini-program-guide/)、[星火/H5/制造广告指南](https://developer.taptap.cn/minigameapidoc/quick-start/mcp-guide/ad-integration-guide/)。

## 普通小游戏后台办理

1. 用 TapTap 开发者账号登录 [Dirichlet](https://ssp.dirichlet.cn/)。核对当前流量主关联的厂商/签约主体、目标小游戏 App ID、游戏在开发者中心的当前状态以及账号管理范围。
2. 流量管理 → 媒体管理 → 新建媒体。联调选「测试」，应用类型选「小游戏」，系统应为「Tap 小游戏」，媒体名称填真实游戏名。有游戏绑定栏时选择目标 App。首轮直连若出现第三方聚合平台竞价，选择不开启。额外必填项以切换后的页面为准。
3. 若「选择 TapTap 上架的游戏/应用」为必填且下拉为空，先核对厂商、主体、目标 App 类型和管理权限。仍为空时记录游戏状态与脱敏截图，通过 TapTap 开发者中心「工单 → 创建工单」请官方确认出现条件，以及首发前的测试绑定或测试位办理方式。通用 FAQ 的预上线测试说明没有明确该下拉框的可选范围。取得实际绑定或针对该 App 的官方测试方式后进入真机联调。
4. 绑定完成后，在推广位管理为该媒体创建「激励视频」测试位。若表单提供方向，按游戏选择，例如竖屏。从推广位详情读取 `adUnitId`，核对所属媒体、目标 App 和测试/正式属性。开发者可提供可核对的官方详情。只有一串无来源数字时先补所属关系，媒体 ID、TapTap App ID 和推广位 ID 分别记录。
5. 使用「流量管理 → 测试工具」按实际页面配置测试，并在 TapTap 客户端扫描目标开发版本的自测二维码。验证通过后按 Dirichlet 页面将媒体、推广位置为正式，提交推广位审核，确认正式状态及开关。生产包使用核对后的正式位。正式媒体与游戏可见状态的实际要求以当前页面或官方答复为准。

来源：[Dirichlet 接入流程](https://ssp.dirichlet.cn/docs/ssp-guide/)、[测试媒体 FAQ](https://ssp.dirichlet.cn/docs/faq/)、[TapTap 真机调试](https://developer.taptap.cn/minigameapidoc/dev/dev-support/debugging/)、[小游戏工单入口](https://developer.taptap.cn/minigameapidoc/quick-start/document-guide/#反馈与求助)。

只有当前官方工具的说明和实际响应能证明覆盖所选普通小游戏及其 Dirichlet 资源时，才用 CLI/MCP 读取这些状态。其他形态的广告页、旧 MCP 状态和历史位 ID 不能证明 Dirichlet 已绑定或开通。媒体/推广位创建、配置和提交审核按用户当前授权执行。

## 激励视频代码契约

- 通过 `tap.createRewardedVideoAd({ adUnitId })` 取得宿主单例，多个入口共用互斥会话。平台在创建和关闭后会拉取素材。覆盖第二次请求前素材已加载、失败后由玩家重试，以及回调晚到。注册和移除自己的 `onLoad`、`onError`、`onClose` 监听。
- 玩家主动选择且当前会话 `onClose` 返回 `isEnded === true` 才可以发奖。`show()` 成功、回前台、超时均不能作为完成证据。用业务会话 ID 做幂等，绑定发起时的进度和奖励归属。
- 提前关闭、无填充、弱网、权限拒绝时走正常游戏路径。奖励已完成但写入结果未知时核对原事务。开发 Mock 与真机结果分别验收。
- 开播前展示奖励规则和继续游戏的选项。首次启动展示限制、广告可关闭性、实际广告服务及隐私披露按审核规范核对。

来源：[激励视频教程](https://developer.taptap.cn/minigameapidoc/dev/tutorial/open-capabilities/ad/rewarded-video-ad/)、[RewardedVideoAd API](https://developer.taptap.cn/minigameapidoc/dev/api/ad/RewardedVideoAd/)、[小游戏广告审核规范](https://developer.taptap.cn/minigameapidoc/tap-operation/operation-standards/minigame-ad-policy/)、[TapADN 隐私资料](https://ssp.dirichlet.cn/docs/agreement/)。

## 排查和验收

| 现象 | 先查 |
|---|---|
| 媒体找不到游戏 | 小游戏形态、当前厂商/流量主、游戏状态、工单结论 |
| `1001` / `1002` | API 参数、推广位 ID、媒体和 App 的所属关系、包内环境 |
| `1004` | 无合适素材，核对测试工具和设备配置，验证游戏降级 |
| `1005`–`1008` | 广告审核、驳回、封禁或广告位关闭，回平台查状态 |
| 看完无奖或双发 | 当前会话与 `isEnded`、监听注册/解绑、幂等发券事务、写盘结果 |
| 真机第二次播放失败 | 自动拉取的 `onLoad` 是否已先到，上一会话是否有延迟回调 |

设备记录包括平台、宿主版本、包版本及 SHA、推广位环境、错误码和业务结果。覆盖完整观看、提前退出、无填充、连续与并发请求、前后台、写入未知及正常玩法回退。错误码以 [RewardedVideoAd.onError](https://developer.taptap.cn/minigameapidoc/dev/api/ad/RewardedVideoAd.onError/) 为准。
