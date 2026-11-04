# TapTap Mini Game Publisher Skill（2026-11-03）

针对中国大陆 TapTap 游戏发布流程的**独立整理 Skill**，可用于本地 Codex、Cursor 等 AI 编程助手。以个人开发者《我是CEO》为示例，但总体适用于其他游戏。

- **入口：**`SKILL.md`
- **参考：**`references/` 共 10 份，覆盖 7 个指定官方入口和重要子文档。
- **工具：**`scripts/preflight.py` 可进行包体/素材静态检查，无网络、无登录、无提交动作。
- **例子：**`examples/asset-manifest.example.json`、`examples/CODEX_PROMPT.md`。
- **原始资料：**官方资料链接与访问状态见 `references/01-source-register.md`。

## 使用方法

1. 解压整个目录到本地工程的 `skills/taptap-mini-game-publisher/`，或 Codex/Agent 能读取的技能目录。
2. 指示 AI 阅读 `SKILL.md`。若客户端支持自动发现技能，也可在支持的目录按其官方约定安装。
3. 先识别游戏形态与实际资质，再决定构建、广告、提审步骤。
4. 仅在准备好素材与包体后运行静态预检：

```powershell
python skills/taptap-mini-game-publisher/scripts/preflight.py --project . --target auto --version V1.0.0
```

## 重要声明

本 Skill 是对官方开发者材料的**原创归纳与工作流**，不是平台官方签发的认证、不是法规/技术更新订阅，也不包含官方文档全文。`agents.md` 原始文件在当前检索环境不可直接读，已使用对应官方 `/agents/` HTML 核实主要内容。任何正式审批与上线必须查看当前平台要求并得到相应授权。安装 Skill 不代表已连接官方 MCP、CLI 或开发者账户。
