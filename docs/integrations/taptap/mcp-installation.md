# TapTap 官方小游戏 MCP

## 安装与配置

官方 npm：`@taptap/instant-games-open-mcp`，核验版 `1.24.14`（2026-11-04）。用户级 Codex 配置文件：`%USERPROFILE%\.codex\config.toml`。本机添加了单独 `[mcp_servers.taptap_minigame]` 配置，原 MCP 项保留：

```toml
[mcp_servers.taptap_minigame]
command = 'C:\Program Files\nodejs\npx.cmd'
args = ['-y', '@taptap/instant-games-open-mcp@1.24.14']
enabled = true
startup_timeout_sec = 120
tool_timeout_sec = 120
```

PowerShell 检查版本：

```powershell
npm view @taptap/instant-games-open-mcp version --registry=https://registry.npmjs.org/
npx -y @taptap/instant-games-open-mcp@1.24.14
```

本机 MCP `initialize` 握手成功，返回服务名 `taptap-minigame`、版本 `1.24.14`；`tools/list` 成功返回 52 个工具，Codex 当前会话也已发现此 MCP。启动摘要还报告 34 个只读 resources。工具定义可能随版本变化，按实时 MCP 工具描述/schema 为准。

## 实际工具清单

| 模块 | 工具（名称保持原文） | 参数字段 | 用途与边界 |
|---|---|---|---|
| 应用/认证 | `get_current_app_info` | `ignore_cache` | 查询当前选中游戏；先核对应用上下文 |
| | `check_environment` | 无 | 查看服务环境和授权状态（已只读验证） |
| | `get_environment_switch_guide` | `target_environment`, `package_tag` | 环境切换指引 |
| | `start_oauth_authorization` | 无 | OAuth 授权链接；用户本人扫码 |
| | `complete_oauth_authorization` | 无 | 用户授权后完成 OAuth |
| | `list_developers_and_apps` | `limit`, `offset` | 查看账号下应用；必须让用户选择目标 |
| | `select_app` | `developer_id`, `app_id` | 改变当前应用上下文，需用户明确选定 |
| | `create_developer` | schema 动态 | 创建开发者身份，外部写入，确认后 |
| | `create_app` | `developerId`, `appName`, `genre` | 创建游戏，外部写入，确认后 |
| | `update_app_info` | `developerId`, `appId`, `appName`, `genre`, `description`, `chattingLabel`, `chattingNumber`, `screenOrientation`, `icon`, `banner`, `screenshots`, `trialNote` | 更新资料，外部写入，确认后 |
| | `get_app_status` | `app_id`, `ignore_cache` | 查询审核/发布状态 |
| | `upload_image` | `filePath`, `base64Data`, `filename` | 上传素材，外部写入，确认后 |
| | `clear_auth_data` | `clear_token`, `clear_cache` | 清除本地授权/应用缓存，破坏性操作，确认后 |
| 当前游戏数据 | `get_current_app_store_overview` | `start_date`, `end_date` | 商店数据概览 |
| | `get_current_app_review_overview` | `start_date`, `end_date` | 评价统计 |
| | `get_current_app_community_overview` | `start_date`, `end_date` | 社区统计 |
| | `get_current_app_store_snapshot` | 无 | 商店页快照 |
| | `get_current_app_forum_contents` | `type`, `sort`, `from`, `limit`, `group_label_id` | 当前游戏论坛内容 |
| | `get_current_app_reviews` | `sort`, `from`, `limit`, `is_collapsed`, `filter_platform` | 玩家评价列表 |
| | `like_current_app_review` | `review_id` | 点赞，公开写入，必须确认具体评价 |
| | `reply_current_app_review` | `review_id`, `contents`, `reply_comment_id`, `confirm_high_risk` | 官方身份回复，公开写入，确认回复文案后执行 |
| 排行榜 | `get_leaderboard_integration_guide` | 无 | 读接入指南 |
| | `create_leaderboard` | `title`, `period_type`, `score_type`, `score_order`, `calc_type`, `display_limit`, `period_time` | 创建服务器排行榜，确认后 |
| | `list_leaderboards` | `page`, `page_size` | 查询排行榜 |
| | `publish_leaderboard` | `id`, `publish` | 发布或改白名单模式，确认后 |
| | `get_user_leaderboard_scores` | `leaderboardId`, `limit` | 读取排行榜数据，需授权 |
| H5 上传 | `prepare_h5_upload` | `gamePath`, `genre` | 检查 H5 目录（相对路径）及预览信息 |
| | `upload_h5_game` | `gamePath`, `genre`, `screenOrientation` | 上传 H5，外部写入，确认后；**仅 H5，不用于 WebGL Tap 小游戏** |
| 调试/振动 | `get_debug_feedbacks` | `limit`, `status`, `fetch_and_mark_processed`, `download_assets`, `moment_id` | 读取反馈；标记已处理或下载资源会改状态/本地文件 |
| | `get_vibrate_integration_guide` | 无 | 读振动接入指南 |
| 联机指南 | `get_multiplayer_guide` | 无 | 读多人联机指南 |
| | `get_code_template` | 无 | 读联机模板 |
| | `get_api_event_table` | 无 | 读 API/事件关系表 |
| | `get_protocol_template` | 无 | 读通信协议模板 |
| | `get_extended_apis` | 无 | 读扩展 API |
| | `get_player_id_guide` | 无 | 读玩家 ID 规则 |
| | `get_sync_strategy` | 无 | 读同步策略 |
| | `generate_local_guide` | schema 动态 | 在项目写指南文件，先核路径/内容 |
| | `get_api_data_structures` | 无 | 读接口数据结构 |
| | `generate_multiplayer_code` | schema 动态 | 生成代码文件，先核变更内容；不代表适用于本项目 |
| | `diagnose_multiplayer_issues` | schema 动态 | 联机问题诊断 |
| | `check_multiplayer_code` | `code` | 静态检查提供的联机代码 |
| | `get_debug_logger` | 无 | 读调试日志说明 |
| 分享 | `get_share_integration_guide` | 无 | 读分享指南 |
| | `create_share_template` | `developer_id`, `app_id`, `contents`, `remark` | 创建模板，外部写入并需审核，确认后 |
| | `list_share_templates` | `developer_id`, `app_id`, `page`, `page_size` | 查分享模板 |
| | `get_share_template_info` | `developer_id`, `app_id`, `template_code` | 查单个模板 |
| | `search_share_docs` | `query` | 搜索分享文档 |
| 云存档 | `get_cloud_save_integration_guide` | 无 | 读云存档指南；不执行云存档写操作 |
| 广告 | `get_ads_integration_workflow` | 无 | 首先读取广告接入流程 |
| | `check_ads_status` | 无 | 查询所选游戏广告状态；更新本地缓存 |
| | `get_ad_integration_guide` | 无 | 生成含当前广告位信息的接入指南；不可将 H5 示例套用 WebGL |

参数栏为 `tools/list` schema 字段集合；必填、默认值、枚举、长度限制以 Codex 实时工具描述为准。MCP 内广告指南称其支持 TapTap Minigame/H5 的全局 `tap` API，但官方网页指南明确其配置安装当前仅 H5；对《我是CEO》WebGL 广告不调用此 MCP 生成代码。

## 形态与授权

官方安装页明确 **仅支持 H5 小游戏**，Unity/其他引擎小游戏 MCP 支持在开发中。不得用于《我是CEO》的 Tap 小游戏 WebGL 上传。官方流程中 OAuth/device authorization 需要开发者本人扫码/登录；本机未启动授权，不保存任何凭据。

## 状态

Codex 工具发现、MCP stdio 握手和 `check_environment` 只读检查均通过。授权未完成；无 MAC Token 时管理功能不可用。MCP 包输出的生产环境 Client ID/Secret 为二进制内嵌/受保护，未读取或记录凭据。
