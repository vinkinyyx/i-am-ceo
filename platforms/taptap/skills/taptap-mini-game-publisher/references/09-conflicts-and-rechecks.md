# 官方文档冲突台账与“必须复核”的事项

本台账优先用于避免 AI 用过时规则给出“一定可以上线”之类结论。每一条都需在发布当期复核。

| 编号 | 冲突/不确定 | 可见证据 | 处理优先级 |
|---|---|---|---|
| C01 包体大小 | [创建小游戏](https://developer.taptap.cn/minigameapidoc/quick-start/guide/creation-improvement/)提“首包不超过60M+”；[审核规范](https://developer.taptap.cn/minigameapidoc/tap-operation/operation-standards/review-standards/)写 20MB 以下 | 高：以当前上传组件规则/工单答复为准；20MB 只做保守提示，不写死为通用上限 |
| C02 软著 | [审核规范6.5](https://developer.taptap.cn/minigameapidoc/tap-operation/operation-standards/review-standards/)列证书及登记号要求；[备案](https://developer.taptap.cn/minigameapidoc/quick-start/guide/pre-filing/)要求填写著作权人并与权属材料匹配；不同游戏状态/形态可能要求不同 | 高：问游戏后台具体要求，取得个人、无内购、无软著情形的明确答案 |
| C03 H5 与 Tap 小游戏 | [官方 AI 页面](https://developer.taptap.cn/agents/)区分 H5 托管、Tap WebGL、制造、APK；[MCP](https://developer.taptap.cn/minigameapidoc/quick-start/mcp-guide/mcp-setup/)仅 H5 | 高：不要因均叫“小游戏”就合并 SDK/包体 |
| C04 广告后台 | [H5/制造广告指南](https://developer.taptap.cn/minigameapidoc/quick-start/mcp-guide/ad-integration-guide/)走 TapTap 后台；[Dirichlet](https://ssp.dirichlet.cn/docs/mini-program-guide/)说明 Tap 小游戏从 Dirichlet 开通及结算 | 高：按真实形态选择广告账户和回调接口 |
| C05 登录与无服务器 | [小游戏登录态](https://developer.taptap.cn/minigameapidoc/dev/tutorial/open-capabilities/login-management/)描述客户端 code→服务端 code2Session；[官方 AI](https://developer.taptap.cn/agents/)建议先按玩法阶段接登录 | 中高：不能把“平台托管 H5 不需自购域名”推导为“所有平台身份能力不需后端” |
| C06 ICP/备案 | [普通小游戏前置备案](https://developer.taptap.cn/minigameapidoc/quick-start/guide/pre-filing/)整合小游戏备案和 ICP 核准，制造类有特殊要求；[一般安全合规](https://developer.taptap.cn/docs/store/release/policy/policy-guide/)也讨论 APP 核准 | 高：以当期“判断依据”匹配上架形态，旧申请是否覆盖新形态须复核 |
| C07 来源可访问性 | `agents.md` 直链当前检索报不支持 octet-stream；官方 HTML `/agents/` 可读；CLI Markdown 子文档遇到内容类型问题 | 低：不要伪称内置所有原文；按官方 URL 二次读取 |

## 状态赋值规范

- `CONFIRMED_DOC`：仅表示官方文档明确写出（引用 URL），**不代表真实后台放行**。
- `CONFIRMED_ACCOUNT`：有实际后台/工单结果且匹配游戏与时间。
- `CONFLICT`：两个官方页面不一致。
- `NEEDS_VERIFICATION`：缺少资料或实际环境核实。
- `BLOCKED_PENDING_PLATFORM`：有审核中且正式发布必须通过的项目。

## 每次提审前重新核对

- 游戏形态、游戏 ID、目标地区和商业化方式。
- 客户端/小游戏包体实际的上传文件类型及当前限制。
- 资质页面逐项状态，特别是软件著作权、版号、小游戏前置备案、ICP、未成年人保护。
- 平台 SDK/CLI 的具体版本、MCP 当前支持范围。
- 宣传物料上传组件尺寸、大小和数量。
- 隐私政策、SDK清单、隐私检测是否随着版本升级更新。
- 广告媒体正式审核状态、广告位 ID 和财务主体信息。

## 过期策略

将本 Skill 视为**冻结于 2026-11-03 的研究快照**。一旦涉及实际提审、付费、资质、上线或影响玩家权益的功能，必须复核 TapTap 实时官方文档与后台状态；若无法访问，应如实输出“未能核实”。
