# TapTap 能力矩阵

截至 2026-11-04。`文档确认` 代表官方资料如此描述，`本机验证` 代表真实命令/配置检查通过；并不代表账号操作或后台结果已验证。

| 能力 | 官方支持及形态 | 工具路径 | 《我是CEO》适用性 | 验证状态/来源 |
|---|---|---|---|---|
| 形态识别 | H5、Tap 小游戏(WebGL)、APK/PC、TapTap 制造各自独立 | CLI/官方指南/后台 | Cocos 3.8.8 目标 WebGL Tap 小游戏 | 项目规范 + [agents](https://developer.taptap.cn/agents/) 文档确认；包体以实际生成物复核 |
| 创建游戏 | CLI 支持开发者中心应用草稿；小游戏控制台可创建 | CLI或后台 | 可用于创建对应类型草稿，需确认目标形态 | CLI 帮助/文档确认，未调用 |
| H5 上传 | CLI 有 H5 包上传命令；MCP H5 指南也涵盖上传流程 | CLI/MCP | 当前目标不是 H5 | 文档确认，未上传 |
| Tap 小游戏上传 | 当前 CLI `--help` 有 `upload-mini-app-package`；官方 AI 指南称小游戏上传目前控制台完成 | 后台为已明确路径；CLI 命令需 schema/账号验证 | 适用且应先用后台包体管理 | 能力差异待核；未上传 |
| 包体/版本/分包 | Tap 小游戏专用小游戏构建 ZIP；分包规则由小游戏文档定义 | 构建工具+后台；CLI能力逐项核验 | 适用；非 APK/H5 zip | [小游戏文档](https://developer.taptap.cn/minigameapidoc/quick-start/document-guide/)；本机当前构建包不等于平台验收 |
| 登录 | 小游戏生态提供 TapTap 登录；需应用配置及必要服务端流程 | 小游戏 SDK/API；后台 | 视平台登录需求，当前不因工具安装自动改游戏逻辑 | 文档确认，未接入验证 |
| 本地/云存档 | 小游戏文档列离线游玩、云存档 | 小游戏 API/MCP部分形态 | 云存档项目规范当前 DEFERRED，不能擅自增加 | 文档确认 |
| 广告 | 星火、H5、TapTap 制造适用一条广告指南；Tap 小游戏需 Dirichlet 广告联盟 | 后台开通+对应 SDK/联盟 | Tap 小游戏需核对 Dirichlet，非 H5 MCP 广告方案 | [广告指南](https://developer.taptap.cn/minigameapidoc/quick-start/mcp-guide/ad-integration-guide/) 文档确认；资质/开通未验证 |
| 资质/备案 | 小游戏正式上架前需小游戏前置备案；CLI 可查看某些资质 | CLI查询+开发者后台/材料 | 适用 | [文档索引](https://developer.taptap.cn/minigameapidoc/quick-start/document-guide/)；未登录检查 |
| 隐私合规 | 需按实际 SDK/数据收集填写隐私声明并遵守审核规则 | 后台+项目文档 | 适用 | 最新材料需上线前复核；项目已有隐私文件，平台核验未做 |
| 商店素材 | CLI 通用素材库和商店资料操作；规格随形态和后台变更 | CLI/后台 | 适用 | CLI Skills/doc，未上传 |
| 审核 | CLI 文档含预检/审核流程；不可代替正式后台审核 | CLI/后台 | 适用；提交前必须用户确认 | 文档确认，未执行 |
| 数据分析 | CLI 有后台下载、曝光、转化等域；小游戏有数据看板 | CLI/后台 | 上线后可用，需账号/权限 | CLI help有域；未登录查询 |

工具不支持或结果未经核验时标注“待确认”，不构造 API/tool 名称。
