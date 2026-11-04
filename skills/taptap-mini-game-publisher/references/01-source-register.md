# 官方资料来源登记（2026-11-03）

本 Skill 由下列七个**用户指定**官方入口，以及为了保证执行准确而检查的延伸文档归纳。并非官网全文镜像。链接保留便于 Codex 在有网络的环境下复核，实际需以最新官方页面/后台为准。

| ID | 用户指定页面 | 访问情况 | 摘要与对应参考 |
|---|---|---|---|
| S1 | [小游戏文档指引](https://developer.taptap.cn/minigameapidoc/quick-start/document-guide/) | 已读取 HTML | 分类入口：注册、开发、备案、发布、变现、运营。导航总入口。 |
| S2 | [创建小游戏](https://developer.taptap.cn/minigameapidoc/quick-start/guide/creation-improvement/) | 已读取 HTML | 创建、状态、资质、指定 ZIP、版本号、WASM。 |
| S3 | [小游戏前置备案](https://developer.taptap.cn/minigameapidoc/quick-start/guide/pre-filing/) | 已读取 HTML | 个人核验、上传材料、短信、核准状态。 |
| S4 | [小游戏广告](https://developer.taptap.cn/minigameapidoc/dev/tutorial/open-capabilities/ad/ad/) | 已读取 HTML | Banner/激励/插屏/原生模板概览、adUnitId、失败兜底。 |
| S5 | [MCP 安装指南](https://developer.taptap.cn/minigameapidoc/quick-start/mcp-guide/mcp-setup/) | 已读取 HTML | 仅 H5、小程序项目 AI_SETUP_GUIDE.md、授权扫码、MCP 适用边界。 |
| S6 | [AI 开发者说明 agents.md](https://developer.taptap.cn/agents.md) | **原始 Markdown 无法由当前检索服务解析**；对应 [官方 HTML](https://developer.taptap.cn/agents/) 已读取 | 项目形态、AI 研发、CLI、能力、上架与安全边界。不能声称已直接读取原版 Markdown。 |
| S7 | [安全合规指南](https://developer.taptap.cn/docs/store/release/policy/policy-guide/) | 已读取 HTML | 广告法、隐私链接、防沉迷、适龄、APP ICP 核准。 |

## 延伸阅读：从七大入口核实的核心子文档

| ID | 链接 | 阅读范围与用途 |
|---|---|---|
| E1 | [小游戏审核规范](https://developer.taptap.cn/minigameapidoc/tap-operation/operation-standards/review-standards/) | 资质、20MB 旧值、软著、广告触发、素材与真实内容、数据隐私 |
| E2 | [宣发物料指引](https://developer.taptap.cn/minigameapidoc/quick-start/guide/game-publish/material/) | 横图/方图/截图/录屏准确规格 |
| E3 | [版本提审](https://developer.taptap.cn/minigameapidoc/quick-start/guide/game-publish/version/) | 开发包提审、审核状态流转 |
| E4 | [H5/制造广告接入指南](https://developer.taptap.cn/minigameapidoc/quick-start/mcp-guide/ad-integration-guide/) | 路线差异、后台开通、结算说明 |
| E5 | [Dirichlet 小游戏广告接入](https://ssp.dirichlet.cn/docs/mini-program-guide/) | Tap 小游戏广告媒体类型、广告 SDK/报表/结算 |
| E6 | [TapTap CLI 主页](https://developer.taptap.cn/v3/cli/) | npm、登录、版本、skills、查询、dry-run、安全写操作 |
| E7 | [小游戏登录态管理](https://developer.taptap.cn/minigameapidoc/dev/tutorial/open-capabilities/login-management/) | tap.login → code → 服务端 code2Session |
| E8 | [小游戏云存档](https://developer.taptap.cn/minigameapidoc/dev/tutorial/open-capabilities/cloud-save-tutorial/) | `tapfile://` 本地文件→云端；单存档 10MB、每分钟最多 1 次上传 |
| E9 | [小游戏排行榜](https://developer.taptap.cn/minigameapidoc/dev/tutorial/open-capabilities/leaderboard-tutorial/) | 配置榜单、周期、排序、白名单、API |
| E10 | [WASM 分包说明](https://developer.taptap.cn/minigameapidoc/dev/tutorial/performance/launch/wasm-subpackage/) | Unity 压缩代码分包、首次覆盖与真机回归 |
| E11 | [TapTap SDK/服务文档总索引](https://developer.taptap.cn/docs/llms.txt) | APK/PC 的 SDK 文档索引，不能直接移植到 H5/Tap 小游戏 |

## 源码/文档质量限制

1. `agents.md` 的 `/agents/` HTML 内容已核查，但原始 `agents.md` 由于媒体类型访问失败，不在压缩包内。
2. 官方 CLI `.md` 子页面在当前检索环境返回不支持 `text/markdown`，没有复制其全文；CLI 用法仅引用可访问的官方 CLI HTML。
3. 文档指引内部个别链接仍指向旧版中文 HTML，访问出现 404。因此本 Skill 优先引用**可访问的规范化 URL**。
4. S2 和 E1 的包体限制冲突；E1 与部分入门页对软著材料的表述并不相同，详见 `09-conflicts-and-rechecks.md`。
5. 截图中的后台实际要求比文档更贴近对应账号/游戏类型，但截图不代表审批结果；有争议时需以工单书面答复为准。
