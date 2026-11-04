# TapTap CLI 安装与用法

## 安装

官方命令（2026-11-04 实际执行成功）：

```powershell
npm install -g @taptap/cli --registry=https://registry.npmjs.org/
```

实际版本 `2026.11.2`。npm 全局前缀是 `%APPDATA%\npm`，当前 PowerShell `PATH` 未包含该目录时用完整路径：

```powershell
$cli = Join-Path $env:APPDATA 'npm\taptap-cli.cmd'
& $cli version
& $cli --help
& $cli skills list
& $cli auth status
& $cli doctor --offline
```

首次登录需用户本人执行 `taptap-cli auth login` 并在 TapTap 页面完成授权；不在自动流程中触发登录。查看账号状态：`taptap-cli auth status`。凭据由 CLI 存于本机，禁止复制进仓库。

## 操作顺序与风险

先 `taptap-cli --help`、`taptap-cli <domain> --help`、`taptap-cli schema <service> <method>`。只读命令可查询；写操作先 `--dry-run`，且必须由用户确认后执行。`--yes` 不是授权替代。安装版本实际列出的域包括 app、package-management、qualification、test-plan、dashboard-stats、player-feedback、community-management、assets、whats-new、官方消息推送等；具体以版本和登录 scope 为准。

CLI 与 MCP 区别：CLI 连接开发者中心做应用/商店/包体/资质/运营流程；小游戏 MCP 面向 H5 项目集成和管理小游戏开放能力。Skills 是指导 Agent 如何使用 CLI 的工作流文本，并非独立 API。
