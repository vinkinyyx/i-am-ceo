# Codex / TapTap CLI / H5 MCP 安全接入

## 官方 AI 页面与 CLI

- [TapTap AI 开发者指南 HTML](https://developer.taptap.cn/agents/)；[其官方原始 Markdown URL](https://developer.taptap.cn/agents.md)（当前研究环境无法直接解析，不能把本地 Skill 当作官方原文）。
- [TapTap CLI 主页](https://developer.taptap.cn/v3/cli/)。官网说明 CLI 随 npm 分发并自带与版本匹配的 AI skills。
- [TapSDK 文档索引](https://developer.taptap.cn/docs/llms.txt)，供 APK/PC 引擎方案使用。

### Windows / Codex 可使用的基本命令

```powershell
# 在已安装 Node.js / npm，且获准访问互联网的环境运行
npm i -g @taptap/cli --registry=https://registry.npmjs.org/
taptap-cli version
taptap-cli --help
taptap-cli skills list
# 需要授权访问开发者后台时，再人工完成登录
taptap-cli auth login
# 开始具体操作前只读检查
taptap-cli developer +list
# 不知道参数时必须参考 CLI 实际版本 schema
taptap-cli schema app create-app
```

这些命令来自 CLI 官方首页。官方 HTML 亦出现 `taptap-cli --version`，但 CLI 首页推荐 `taptap-cli version`，优先遵循安装版本帮助输出。

CLI 可以支持资料维护、素材上传、资质查询、测试计划、数据等操作；**具体能力以 `taptap-cli skills list` / `--help` 的实时输出为准**，不要因为官方某页说“可以”便猜测命令、参数或调用顺序。

### Tap 小游戏上传重要例外

官方 AI 页面明确提示：**Tap 小游戏上传目前在控制台完成，不走 CLI 上传命令**。CLI 文档中的 `app create-app ... package_type: apk` 示例不能被直接改写并用于专用小游戏 ZIP。

### H5 MCP 配置

[官方 H5 MCP 安装指南](https://developer.taptap.cn/minigameapidoc/quick-start/mcp-guide/mcp-setup/)写明：

1. 当前**只支持 H5** 小游戏，Unity 等 Tap 小游戏尚未声明支持。
2. 下载官方 `AI_SETUP_GUIDE.md` 放进游戏项目；在 Cursor 或其他支持 MCP 的 AI 工具中让助手遵照该文件进行安装。
3. 授权步骤由用户扫码确认；不得让 AI 伪造授权、硬编码密钥或上传个人令牌。
4. 官方示例能力包括查看应用、修改截图、H5 产物上传、排行榜、云存档等；**实际以已安装 MCP 工具暴露的能力为准**。
5. 配置完成后可让 AI 检查项目/管理游戏，但发布、删除和改账户权限仍需显式批准。

> Codex 是否已经连接平台 MCP 需要真实执行环境核实。仅安装本 Skill 并不自动创建 MCP 服务器、不自动连接开发者账号。

## 最小权限与预览机制

```text
查询 → 查看当前游戏/包体/资质 → 确认目标游戏ID → 展示变更预览
    → 核实 CLI schema / SDK API → 本地验证 → 请求用户批准高风险操作
    → 执行 → 核实结果 → 记录审计信息
```

CLI 首页官方示例有 `--dry-run`、`--idempotency-key`、`--yes`：能预览先预览，**不可将 `--yes` 用作绕过用户审批**。不要在仓库提交 `.env`、OAuth token、合作方 API key、广告后台密码、结算银行信息和有身份标识的截图。

## 集成到已有 Codex 项目

将整个 `taptap-mini-game-publisher` 目录安装到 Codex 会扫描的 skills 目录，或直接放到项目仓库 `skills/` 中，打开 `SKILL.md` 交给 AI。实际自动发现目录位置取决于 Codex 客户端版本；若不确定，按手工显式加载：

```text
请阅读 ./skills/taptap-mini-game-publisher/SKILL.md，
先扫描项目，列明 TapTap 的发布形态、当前资质缺项和构建产物。
不修改代码、不执行提交审核，不创建发布任务；
先给出所需文件、官方资料链接与预检结果。
```

## 常用 CLI 官方参考

- [CLI 主页](https://developer.taptap.cn/v3/cli/)
- [命令参考](https://developer.taptap.cn/v3/cli/command-reference.md)
- [官方发布游戏 Skill](https://developer.taptap.cn/v3/cli/skills/taptap-publish-game.md)
- [官方包体管理 Skill](https://developer.taptap.cn/v3/cli/skills/taptap-package-management.md)
- [官方资质 Skill](https://developer.taptap.cn/v3/cli/skills/taptap-qualification.md)

上述 `.md` 官方 URL 在本次网页检索中由于 `text/markdown` 媒体类型未能直接读取，使用前应由用户本地 Codex 在可联网环境取最新版本，**不要当成本 Skill 已内置的官方全文**。
