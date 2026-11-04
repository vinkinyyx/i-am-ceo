# 安装与验证报告

日期：2026-11-04（Asia/Shanghai）。Windows 10 Home China，OS build `26200`。本机 Node.js `v24.13.0`、npm/npx `11.6.2`。Codex Desktop CLI `0.166.0-alpha.5.1`；Codex 配置 `%USERPROFILE%\.codex\config.toml`。

## 安装/核验结果

| 组件 | 结果 | 证据 |
|---|---|---|
| CLI | 已安装 `@taptap/cli 2026.11.2` | npm 官方 registry 查询及 `taptap-cli version` 输出成功；contract 3 |
| Skills | 官方 CLI embedded 15 项；全局同步记录成功 | `taptap-cli skills list` 返回 count 15；`skills status` 显示 Global Agent Skills `sync_recorded (2026.11.2)` |
| MCP 包 | 官方 npm 最新版 `1.24.14` 已固定到 Codex 用户配置，以 npx 启动 | npm registry latest 查询；配置段已添加 |
| MCP 启动/发现 | 通过 | stdio `initialize` 返回服务 `taptap-minigame 1.24.14`；`tools/list` 返回 52 项；Codex 当前工具环境可发现 |
| MCP 只读检查 | 通过 | `check_environment` 显示 production、内置签名器、MAC Token 未配置；未输出或保存密钥 |
| CLI 状态/schema | 通过 | `taptap-cli status` 返回 Capability API ready；`schema app analyze-app-status` 标记 `risk: read`，未登录前未请求账号数据 |
| TapTap 登录 | 未登录 | `auth status` 显示认证未配置 |
| 离线诊断 | CLI 安装检查通过；账号配置/凭据检查失败 | `doctor --offline`：version/install/server_url pass；config/credentials fail；网络/身份检查 skip |
| 原有配置 | 原 MCP 条目保留，仅新增唯一 TapTap 条目 | 编辑前后 `%USERPROFILE%\.codex\config.toml` 核查 |
| 原 Skills | 项目 publisher Skill 已整合 CLI/MCP 路由；CLI 全局 15 项 Skills 同步完成 | `skills/taptap-mini-game-publisher` 存在；CLI `skills status` 显示同步版 `2026.11.2` |

## 执行过的命令

```powershell
npm install -g @taptap/cli --registry=https://registry.npmjs.org/
npm view @taptap/cli version dist-tags --json --registry=https://registry.npmjs.org/
npm view @taptap/instant-games-open-mcp version dist-tags --json --registry=https://registry.npmjs.org/
& "$env:APPDATA\npm\taptap-cli.cmd" version
& "$env:APPDATA\npm\taptap-cli.cmd" skills list
& "$env:APPDATA\npm\taptap-cli.cmd" skills status
& "$env:APPDATA\npm\taptap-cli.cmd" auth status
& "$env:APPDATA\npm\taptap-cli.cmd" doctor --offline
```

执行了 `taptap-cli update --force` 同步与 CLI 版本匹配的技能；最终 `skills status` 确认全局同步记录 `2026.11.2`。未执行登录、创建、上传、修改、提审或发布。

## 限制

无 MAC Token 时 MCP 文档资源可用，管理操作需用户授权。CLI `doctor --offline` 的 config/credentials 检查失败是因为尚未创建 profile 和登录，属于待授权状态，不是安装失败。现有 PowerShell 当前进程 PATH 无 `%APPDATA%\npm`，因此本文给出绝对命令调用形式。官方安装页面与仓库 README 对 H5/小游戏覆盖范围表述不完全一致，按小游戏 MCP 安装页面“当前仅 H5”限制本项目使用。
