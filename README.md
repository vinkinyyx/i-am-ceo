# 《我是CEO》

一款竖屏公司经营模拟游戏，使用 Cocos Creator 3.8.8 和 TypeScript。玩家选择贸易、软件科技或企业服务作为主营行业，从创建公司、首聘两人开始经营，随后管理部门、调整人员和预算、查看年报与排行。Web 预览与小游戏目标共用经营、存档和 UI。

## 平台

| 目标 | 当前状态 |
|---|---|
| Web 本地预览 | 可运行创建公司、招聘、经营和本地存档。 |
| [TapTap 普通小游戏](platforms/taptap/README.md) | 适配器、诊断构建和 ZIP 校验已验证。登录换票、云备份、真实榜和激励视频仍需同包真机验证。 |
| [抖音小游戏](platforms/douyin/README.md) | 已预留适配入口，原生实现和发行包待开发。 |
| [微信小游戏](platforms/wechat/README.md) | 已预留适配入口，原生实现和发行包待开发。 |

## 在 Windows 本地运行

使用 Node.js 20 或更高版本和 Cocos Creator 3.8.8。在 Creator 中打开仓库根目录，完成首次资源导入并生成 `temp/declarations/`。构建前关闭该项目的 Creator 窗口。

```powershell
npm ci
npm ci --prefix extensions/taptap-minigame-tools
npm run check
npm run web-build
npm run static-server
```

Web 预览地址为 `http://localhost:8123`。第二条安装命令为完整回归中的 TapTap ZIP 校验准备依赖。Creator 安装在自定义位置时，按 `tsconfig.ui.json` 校准声明路径，并在构建命令后追加 `-- -CocosExe "<完整路径>"`。

TapTap 打包前请按[发布手册](platforms/taptap/README.md)准备本地运行配置。可用 `npm run tap-build` 生成禁用联网能力的诊断包。

## 目录与维护

| 路径 | 用途 |
|---|---|
| `assets/core/` 与 `assets/scripts/` | 公共经营规则、存档、宿主接口、Cocos UI 和音频 |
| `assets/scenes/` 与 `assets/resources/` | 场景、运行资源和配置 |
| `assets/platforms/` 与 `assets/resources/platforms/` | 各平台运行适配器和客户端配置 |
| `platforms/` | 平台手册、构建脚本、发行素材及服务 |
| [docs/](docs/我是CEO_项目总览.md) 与 [materials/](materials/README.md) | 产品规则、设计规范和美术音频源文件 |
| `tests/` 与 `tools/` | 回归测试、合成存档夹具和本地开发工具 |

从[项目总览](docs/我是CEO_项目总览.md)、[UI V2 规范](docs/ui-design/01_UI_全量详细设计规范_V2.md)、[音频维护](materials/audio/README.md)和[项目日志](docs/CHANGELOG.md)查看现行规则与验证记录。协作约定见 [AGENTS.md](AGENTS.md)。

GitHub 源码包含可复现的工程文件及配置样例。本机配置、Creator 缓存、安装依赖和构建产物由本地环境管理。
