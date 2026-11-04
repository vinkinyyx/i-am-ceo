# 官方资料来源

核验日期：2026-11-04。页面可访问性以本次 HTTP 浏览结果为准，发布前应复核。

| 来源 | 状态与本次核验 | 用途 |
|---|---|---|
| [开发者中心](https://developer.taptap.cn/) | 可访问 | 产品形态和后台入口 |
| [TapTap CLI](https://developer.taptap.cn/v3/cli/) | 可访问，含安装、授权、Skills、命令参考 | CLI 主入口 |
| [AI 开发者说明](https://developer.taptap.cn/agents/) | 可访问 | 形态分流、上架和边界；明确 Tap 小游戏上传目前控制台完成 |
| [小游戏文档索引](https://developer.taptap.cn/minigameapidoc/quick-start/document-guide/) | 可访问 | 小游戏开发、广告、登录、存档、测试、备案、审核 |
| [官方 MCP 仓库](https://github.com/taptap/instant-games-open-mcp) | 可访问且持续有近期代码/文档更新；npm registry 查询到 `1.24.14` | MCP 源码与发布说明 |
| [官方 MCP npm 包](https://www.npmjs.com/package/@taptap/instant-games-open-mcp) | npm 页面浏览器返回 403；官方 registry `npm view` 成功，latest `1.24.14` | 安装包版本核验 |
| [MCP 安装指南](https://developer.taptap.cn/minigameapidoc/quick-start/mcp-guide/mcp-setup/) | 可访问；明确只支持 H5 小游戏 | H5 MCP 配置与授权 |
| [广告接入指南](https://developer.taptap.cn/minigameapidoc/quick-start/mcp-guide/ad-integration-guide/) | 可访问；指出星火、H5、TapTap 制造广告路线与 Tap 小游戏广告区别 | 广告开通、集成、结算 |
| [CLI 命令参考](https://developer.taptap.cn/v3/cli/command-reference/) | CLI 文档页提供入口；本次以已安装 CLI `--help` / skills 输出核对命令。`.md` 访问不稳定 | 具体命令以本机实际输出为准 |
| [TapTap agents.md](https://developer.taptap.cn/agents.md) | 链接由官网提供，抓取器不能稳定解析 Markdown | CLI 与形态导航 |

官方 AI 页面列出小游戏、H5、APK/PC、TapTap 制造不同路径；能力不能跨形态推定。仓库 `main` 活跃及 npm latest 只证明有更新发布，不能保证未来维护 SLA。
