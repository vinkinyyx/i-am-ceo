# 故障排查

## `taptap-cli` 不识别

本机 `%APPDATA%\npm` 未在当前 PATH。检查：

```powershell
npm prefix -g
Get-ChildItem "$env:APPDATA\npm\taptap-cli*"
& "$env:APPDATA\npm\taptap-cli.cmd" version
```

重新打开终端或把 npm prefix 加入用户 PATH 后才可裸命令执行；不要为当前任务改写整个 PATH。

## Skills 状态

执行 `taptap-cli skills list` 查看当前版本嵌入内容；`skills status` 查看全局同步记录。`update --force` 会从官方源同步/重装技能并更新 CLI；需注意版本对应。项目 publisher Skill 与官方内置 CLI skills 不重复覆盖。

## Codex 没显示 MCP

检查 `%USERPROFILE%\.codex\config.toml` 是否有 `[mcp_servers.taptap_minigame]`，确保命令指向本机 `npx.cmd` 且包版本能从 npm 安装。重启/重新加载 Codex，再查 MCP 工具目录。MCP 初始化并不代表已授权；按官方 OAuth 流程由用户扫码登录。

## 无账号/后台查询失败

`auth status` 为未配置时，先由开发者本人运行 `taptap-cli auth login` 完成授权。不要读取、复制或记录本地凭据。登录失败则运行 `taptap-cli doctor`，只向用户汇报脱敏后的错误类别。

## H5 MCP 与 Tap 小游戏形态混用

官方 MCP 安装文档现声明仅支持 H5。Tap 小游戏 WebGL 请走小游戏适配/控制台路线；不能因为 MCP 工具名含 mini-game 就推定项目受支持。

## CLI 命令和文档冲突

先查已安装版本的 `--help`、`schema` 和官方当前页面。CLI 当前有 `upload-mini-app-package`，而 AI 指南说小游戏上传目前控制台完成；在账号 schema、权限与后台验证前，采用明确受支持的控制台路径并保留冲突记录。
