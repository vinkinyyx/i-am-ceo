# 游戏形态路由：先判形态再写代码

**一级规则**：同名“小游戏”不代表相同分发产物。官方 AI 页面明确区分 Tap 小游戏（WebGL）、H5、TapTap 制造与 APK/PC。

| 类型 | 常见识别证据 | 产物/发布流程 | 能力文档 | 易犯错 |
|---|---|---|---|---|
| H5 | `index.html`、纯 HTML/JS、Vite/React 产物、平台托管 H5 | 平台支持的 H5 上传/MCP 路线；从实际后台读上传要求 | [H5 MCP](https://developer.taptap.cn/minigameapidoc/quick-start/mcp-guide/mcp-setup/) | 假装 H5 就是 WebGL，照搬 Tap 小游戏 ZIP API |
| Tap 小游戏 WebGL | Unity/Cocos + TapTap 适配/转换配置，导出 `converted/game` 等 | 平台打包工具产出的 ZIP；控制台包体管理提审 | [小游戏文档](https://developer.taptap.cn/minigameapidoc/quick-start/document-guide/) | 直接传 APK 或普通网页 ZIP；用 CLI 的 APK 上传命令 |
| TapTap 制造 | 在 TapTap 制造编辑器/本地插件创作作品 | 制造作品对应发布入口 | 制造官方说明和 [H5/制造广告](https://developer.taptap.cn/minigameapidoc/quick-start/mcp-guide/ad-integration-guide/) | 错套 WebGL ZIP 或制造以外的 SDK |
| APK / PC | `AndroidManifest.xml`、Gradle、APK/AAB、Windows 可执行程序等 | 平台对应客户端包体管理 | [TapSDK 索引](https://developer.taptap.cn/docs/llms.txt) | 套用小游戏 20MB/60M+ 或默认免防沉迷 |

## 识别程序

1. 检查产品后台的**游玩提供方式**，它比语言或引擎名更关键。
2. 检查项目构建配置，留存构建命令与产物路径。
3. 查看实际将上传的产物，不靠文件扩展名自行猜测：官方 Tap 小游戏要求专用 ZIP；H5 也可能出现 ZIP 打包容器，但并非同一规范。
4. 如果一个游戏兼有 APK 和小游戏，分别列每种形态的资质和身份/存档互通要求；官方创建指南提醒同时提供两种游玩方式时需接 TapTap 登录并保障用户数据互通。
5. 不能确认时，返回 `NEEDS_VERIFICATION`，提示查询后台“包体管理/游玩提供方式/判断依据”。

## 决策树（逻辑）

```text
是否在 TapTap 制造工具里构建作品？─是→ TapTap 制造
          │否
最终是 Android/PC 安装包？──────是→ APK/PC
          │否
是否使用 TapTap WebGL 适配/打包器？─是→ Tap 小游戏
          │否
是否是平台托管 HTML/JS 站点？────是→ H5
          │否
                   UNKNOWN → 暂停专用 SDK/打包建议
```

**注意**：当前 [官方 MCP 安装指南](https://developer.taptap.cn/minigameapidoc/quick-start/mcp-guide/mcp-setup/)仅明确支持 H5。具有 MCP 的开发工具（如 Codex）不等于它能对所有形态自动部署。
