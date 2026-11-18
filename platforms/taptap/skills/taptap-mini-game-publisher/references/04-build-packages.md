# 包体生成、版本管理、调试与性能

## 形态 → 发布产物

| 形态 | 推荐处理 | 不能做的事 |
|---|---|---|
| H5（纯 HTML/JS/Vite/React） | 按项目真实编译脚本生成页面产物，优先按 H5 平台/MCP 官方上传路径操作；校验入口 HTML、资源引用、移动端触控及网络状态 | **不把**普通网页 ZIP 当成“Tap 小游戏特定 ZIP” |
| Tap 小游戏（WebGL） | Unity/Cocos 适配/转换器 → TapTap 官方专用 ZIP → 后台`商店→小游戏管理→包体管理`上传、解析、自测、提审 | 不直接上传原 APK、未经转换的 WebGL、任意 dist.zip |
| TapTap 制造 | 走制造编辑器与本地插件的正式作品发布流程 | 不使用 WebGL 的上传包体步骤 |
| APK/PC | 走对应 TapSDK + 客户端包体规范 | 不套用普通小游戏首包限制 |

官方：[创建小游戏](https://developer.taptap.cn/minigameapidoc/quick-start/guide/creation-improvement/)、[AI 形态说明](https://developer.taptap.cn/agents/)。

## WebGL / Tap 小游戏打包清单

1. 先确认实际引擎版本与 TapTap 适配插件版本，按对应官方“打包工具”导出指定 ZIP。
2. [创建指南](https://developer.taptap.cn/minigameapidoc/quick-start/guide/creation-improvement/)表述“首包大小不超过 60M+”（不清楚是否为严格 60MB 上限）；但[审核规范](https://developer.taptap.cn/minigameapidoc/tap-operation/operation-standards/review-standards/)仍写**20MB 以下**。**以当前后台及官方工单为准**。本地脚本只会按 20MB 产生保守的风险提示，不会据此否定平台接收的包。
3. `Vx.y.z` 版本号（x/y/z 为整数），新版本高于旧版；不得与线上/审核中版本重复。
4. 官方创建指南明确要求正确接入 TapTap 登录；需检查返回码、会话恢复、断网后行为。登录态可能涉及 `tap.login()` 与开发者服务端 `code2Session`，**不要将服务端密钥写入客户端**，具体见[小游戏登录态](https://developer.taptap.cn/minigameapidoc/dev/tutorial/open-capabilities/login-management/)。
5. 上传之后在开发版本获取二维码或浏览器自测入口；核对包体解析、首屏、主循环、版本显示、iOS/Android 设备兼容性。正式提审前的“能运行”必须有真机证据。
6. WASM：若 Unity Brotli 压缩 `.wasm.br` 较大，参考[WASM 分包官方流程](https://developer.taptap.cn/minigameapidoc/dev/tutorial/performance/launch/wasm-subpackage/)。文档提及 6MB 以上建议、10MB 以上必须进行分包；需采集首包函数，点击生成并提交，iOS/Android 真机回归。不能把“启用代码分包”直接视作分包完成。

## H5 自测：保持普通网页与平台环境区分

- 验证 `dist/index.html` 存在（如果构建系统适用），静态资源相对路径正确；无 localhost/127.0.0.1/开发 IP 硬编码。
- 在本地 web server 下运行移动端触控测试；浏览器本地正常 ≠ TapTap H5 客户端正常。
- 平台 API 特性检测与失效降级：云存档、广告、排行榜、分享不能在普通浏览器中假装成功。用测试替身和生产实现分离。
- 首次启动、退出重进、无网络、弱网、后台切回、屏幕高宽比、记忆音效设置、数据完整性和重置路径必须测试。
- 使用 [H5 MCP 安装指南](https://developer.taptap.cn/minigameapidoc/quick-start/mcp-guide/mcp-setup/)前确认支持的工程/工具；真实上传后检查平台回执和版本。

## 功能性游戏测试矩阵

| 类别 | 必测事项 |
|---|---|
| 启动 | 首次启动、已建公司重进、断网、弱网、首屏白屏、无响应 |
| 经营 | 创立公司→招聘→部门经营→年度结算→再经营的完整循环 |
| 存档 | 每步持久化、关闭页面/后台切换、重启、失败恢复、数据版本升级 |
| 重置 | 主动关闭公司二次确认；清除经营存档、保留法规要求的账号/合规信息 |
| 音频 | “全部音乐与音效”总开关持久化，子开关不能突破总开关静音 |
| 显示 | 9:20、9:16、不同安全区与刘海；不能裁掉按钮或数值 |
| 广告 | 未完成无奖励，重复回调不重复奖励，弱网不中断主要游戏 |
| 成就榜单 | 列表为空/平台不可用时不卡死；分数逻辑和用户范围符合设计 |

## 云存档及排行榜：只在确有需求时启用

官方[云存档](https://developer.taptap.cn/minigameapidoc/dev/tutorial/open-capabilities/cloud-save-tutorial/)说明：`tap` 全局对象，先本地文件（`tapfile://`）再云同步；单槽上限 10MB、每分钟最多上传 1 次。不要让每次点击就发起云端上传。需要冲突合并与恢复设计。

官方[排行榜](https://developer.taptap.cn/minigameapidoc/dev/tutorial/open-capabilities/leaderboard-tutorial/)说明：后台可选择升序/降序、日/周/月/永久等周期，测试白名单，使用官方排行榜 ID；提交机制与防刷逻辑必须结合实际 API 设计。

## 本地静态预检

```bash
python scripts/preflight.py --project . --target auto --version V1.0.0
python scripts/preflight.py --project . --target tap-mini --package ./build/game.zip --asset-manifest ./examples/asset-manifest.example.json
```

静态检查只看文件存在、版本格式、ZIP 内容可解压、素材尺寸和体积、可疑硬编码。**不会下载任何文件，也不会调用 TapTap 接口**。
