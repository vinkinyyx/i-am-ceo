# 广告变现：平台分流 + 安全的奖励逻辑

## 两条主要变现路径

### A. H5 / TapTap 制造 / 官方指南列出的星火形态

[H5/制造广告指南](https://developer.taptap.cn/minigameapidoc/quick-start/mcp-guide/ad-integration-guide/)明确列出：

1. TapTap 开发者后台完成认证和财务主体资料（真实开户行、收款账户等）。
2. 游戏后台 `商店 → 小游戏广告 → 申请开通`。
3. 让 AI 在**该形态的最新 API 文档**和已运行的 MCP 能力基础上接入广告，不能直接复制 Tap 小游戏 SDK 方法。
4. 后台查看广告收入与提现。文档记录：月度收益每月 10 日更新、100 元最低提现、申请后预计 7 个工作日到账、个人税额依规定预扣预缴；这些是文档口径，**实际结算按账户和当期协议**。

### B. Tap 小游戏（WebGL）与 APK

[Dirichlet 小游戏广告指南](https://ssp.dirichlet.cn/docs/mini-program-guide/)：

1. 使用 TapTap 开发者账号登录 Dirichlet 平台。
2. 新建媒体时选择“小游戏”。
3. 创建广告位，获取广告单元 ID，核对游戏包与媒体关系。
4. 在**小游戏**代码按 [TapTap 小游戏广告 API](https://developer.taptap.cn/minigameapidoc/dev/tutorial/open-capabilities/ad/ad/) 集成；平台说明支持激励视频、插屏、横幅。
5. 验证测试广告填充、加载、展示、退出及奖励；审核通过后切正式 ID。
6. 数据报表/财务结算在 Dirichlet 媒体管理平台进行，而非 H5 小游戏广告页面。

> 不要在正式交付中填一个猜测的 `adUnitId`、声称在当前系统里自动完成申请，也不要混用两个体系的结算页面。

## 广告类型与《我是CEO》的场景建议

| 类型 | 游戏放置位置 | 约束 |
|---|---|---|
| 激励视频（优先） | 用户点“刷新招聘候选人/获得经营建议”等自愿入口 | 完整观看且官方回调确认后才发奖；声明奖励规则，不能强制观看 |
| 插屏 | 年度结算结束等自然停顿 | 平台审核规范禁止打断核心操作；H5 指南建议间隔 ≥2分钟；避免高频强制弹窗 |
| Banner | 非主要经营区域、非点击密集区 | 不遮挡按钮/数据；小游戏审核规范要求高度≤屏幕 10%，可关闭并有明显标识 |
| 原生模板 | 仅已确认该发布形态支持时才考虑 | 必须先查当前 SDK 和广告审核规则，不默认全形态支持 |

审核规范还要求广告显著标注、不可把主要功能变成广告展示、不得模拟系统通知或强制下载第三方 App。官方：[小游戏审核规范](https://developer.taptap.cn/minigameapidoc/tap-operation/operation-standards/review-standards/)。

## 激励视频实现约束（伪代码，**不是官方 SDK API**）

```text
onUserTapReward(rewardId):
  if !userConsentedToRequiredProcessing: return showPrivacyInfo()
  if rewardState in {loading, showing, granting}: return
  rewardState = loading
  ad = adapter.createRewardedVideo(configuredAdUnitId)
  ad.load().then(ad.show).catch(showNonBlockingFailure)

adapter.onClosed(result):
  if result.completed is true:
    grantRewardIdempotently(rewardId, uniqueAdImpressionId)
  else:
    showNormalGame()   # 不发奖励，不剥夺既有权益
  rewardState = idle
```

这里的 `adapter` 是需要根据平台最新 API 编写的**适配器接口**，`completed`、`uniqueAdImpressionId` 等字段仅为业务约定，不是官方参数名。必须检查实际回调结构，若平台回调不提供唯一展示 ID，则设计本地互斥和必要的服务端验证，避免伪造或重复奖励。

## 广告验收（至少 10 个案例）

1. 无网络或广告无填充 → 显示非阻塞提示；可以继续游戏。
2. 成功打开，用户提前关闭 → 不发奖励。
3. 完整观看，官方成功回调 → 发一次奖励。
4. 回调重复触发 → 仍只发一次奖励。
5. 网络恢复后重试 → 没有丢失或重复发奖。
6. 用户在广告出现前迅速连点 → 不重复创建请求。
7. 退出/后台切换 → 回到游戏正常状态，不误发奖励。
8. 关闭音效总开关 → 游戏自身音效静音；不可随意操控第三方广告播放器声音，尊重平台限制。
9. 广告 SDK 实际收集数据与隐私政策披露一致。
10. 禁止在开屏立即强制广告；商业化频次按具体审核规则复核。

## 故障排查

先看广告位及媒体状态、`adUnitId`、测试配置、平台 API 是否匹配游戏形态、网络、频控/无填充、回调监听和隐私同意时序。打印脱敏错误码与调用链；不要只写“广告不显示”或猜测平台故障。
