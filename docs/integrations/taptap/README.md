# TapTap 接入知识库

核验日期：2026-11-04（Asia/Shanghai）。本目录记录《我是CEO》的 TapTap 形态路由、工具安装、平台流程与待核事项。平台规则和能力会变化，发布前须回到官方文档及开发者后台复核。

## 当前结论

- 项目：Cocos Creator 3.8.8 + TypeScript；预期发布为 Tap 小游戏 WebGL。不是纯 H5，也不是 TapTap 制造作品。该判断来自项目配置/规范和实际构建路线，正式上传形态仍由生成包及控制台记录确认。
- 官方 `@taptap/instant-games-open-mcp` 最新核验版 `1.24.14`，已配置到 Codex；指南明确当前 MCP 仅支持 H5 小游戏，因此不应直接用于本项目 WebGL 上传或业务能力接入。
- 官方 `@taptap/cli` 已安装 `2026.11.2`，内含 15 项官方 Skills。TapTap CLI 是开发者中心管理工具；Tap 小游戏特定包上传能力虽已出现在该 CLI 当前命令目录，但官方 AI 总览仍称小游戏上传在控制台完成，实际可否上传须以当前 CLI schema/后台实测为准。
- 尚未登录 TapTap。只读的离线诊断通过 CLI 安装检查，但账号、网络服务和数据查询需要用户在本机运行 `taptap-cli auth login` 完成授权后验证。
- 本次没有创建游戏、上传包体/素材、提交审核或发布。

## 索引

- [官方来源](official-sources.md)
- [MCP 安装](mcp-installation.md)
- [CLI 安装](cli-installation.md)
- [Skills 使用](skills-guide.md)
- [能力矩阵](tool-capability-matrix.md)
- [游戏发布路线](game-publishing.md)
- [广告接入](advertising-integration.md)
- [合规清单](compliance-checklist.md)
- [安装验证报告](installation-report.md)
- [故障排查](troubleshooting.md)

## 安全边界

读取状态、查看帮助和 schema 可自动进行。创建、修改、上传、提交审核、发布、付费、改权限、删除等外部写操作均先给出目标和影响并等待用户明确确认。不得把密码、Token、Cookie、账号资料或授权日志写入仓库。
