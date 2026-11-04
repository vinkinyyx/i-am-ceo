# TapTap Skills

## 官方 CLI 内置技能

`taptap-cli skills list` 实际返回 15 个 Skills，版本为 `2026.11.2` 对应技能集。`taptap-cli skills status` 报告 Embedded Skills 15、Global Agent Skills `sync_recorded (2026.11.2)`，由 `taptap-cli update --force` 同步完成。技能列表摘要：

- `taptap-cli`：CLI 能力发现、执行规范与风险门禁。
- `taptap-identity`：登录态、开发者/游戏 ID 与 scope。
- `taptap-publish-game`：创建游戏草稿及发布准备。
- `taptap-app-edit`：资料、版本和审核工作流。
- `taptap-package-management`：包体管理与自测。
- `taptap-qualification`：资质查询与材料流程。
- `taptap-test-plan`：测试计划。
- `taptap-dashboard-stats`：后台数据。
- `taptap-player-feedback`：评价查看及处理。
- `taptap-community-management`：论坛互动。
- `taptap-asset-library`、`taptap-materials`：素材库、素材整理和上传流程。
- `taptap-game-sign`：签到活动。
- `taptap-whats-new`：详情页活动/公告。
- `taptap-official-message-push`：官方消息推送。

源技能会随 CLI 版本匹配更新。查看实际技能：`taptap-cli skills list`、`taptap-cli skills read <skill>`；升级：`taptap-cli update`。不可复制旧版本技能内容作为官方最新规范。

## 项目内 Skill 整合

项目原有 `skills/taptap-mini-game-publisher` 已覆盖形态识别、资质和发布预检。本次将其保留并在 Skill 中加入 CLI/MCP 官方能力路由；不复制官方 CLI 的 15 个技能到项目，避免版本漂移与重复功能。启动任务时阅读该目录 `SKILL.md` 和本知识库。

本机 Codex CLI 全局技能同步已由 CLI 状态确认；项目专属 publisher skill 保持原样目录和名称。
