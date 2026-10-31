# 《我是CEO》第一阶段 UI — 开发直接对接版 V1.5

此包基于 `CEO_UI_B01-B06_v1.4` **重新整理现有素材**，不新增第二阶段功能，不声称已实现游戏场景或Cocos Prefab。ZIP内所有路径与文件名均为ASCII，中文只写在文档和CSV内容中。

## 使用顺序

1. 查看 `Config/screen_registry.csv` 或 `.json`，定位33项UI、页面类型、父页面、数据和交互。
2. 打开 `DesignReference/FullScreenPNG/` 了解视觉样式，但**不要把整屏PNG做成游戏运行时Sprite**。
3. 参考 `DesignSource/FullScreenSVG/`、`Docs/ScreenSpecs/`、`Docs/ScreenStates/` 使用 Cocos 原生 Label、Button、EditBox、ScrollView、Layout 等组件搭建页面。
4. 将 `CocosDropIn/assets/resources/ui/` 内的PNG放入**现有 Cocos Creator 项目对应位置**；由Cocos导入生成 `.meta` 与 SpriteFrame，避免手工拼写UUID。
5. 参考 `Config/asset_registry.json` 用 `resources.load("ui/avatars/xxx", SpriteFrame, ...)`（示例格式，仅在资源导入正确后使用）；图标资源ID不要依赖中文文件名。
6. 将UI行为绑定到已有的内部GameQuery/GameCommand服务，详细命令约束见`Docs/SourceRequirements/12_Commands_StateMachine.md`；不允许界面直接篡改现金或绕开存档。
7. 依照 `Docs/DEV_AGENT_TASKS.md` 分阶段实现与验收。

## 文件夹分工

```text
CocosDropIn/assets/resources/ui/     // only B06 PNG (SpriteFrame candidates)
DesignReference/FullScreenPNG/       // B01-B05 full-screen PNG; DO NOT import as game UI
DesignSource/FullScreenSVG/          // editable reference / SVG view source
DesignSource/B06_SharedSVG/          // B06 native vector sources, not guaranteed runtime SVG
Docs/ScreenSpecs/                   // 33 screen specs
Docs/ScreenStates/                  // 33 state matrices
Docs/SourceRequirements/            // baseline docs excerpts from existing engineering package
Config/                             // JSON & CSV registries, routing, tutorial, tokens
IntegrationContracts/               // TS type contracts, no implementation
QA/                                 // validation report
```

## 重要边界

- 设计基准375×812逻辑像素，页面参考PNG 750×1624，运行时适配 SafeArea、Fit Width；点击热区至少44×44逻辑像素。
- 只允许4个底部Tab：公司、部门、人才、排行。`Nav_Settings.png` 来源资源存在，但**不应成为第5个Tab**；设置应从公司首页进入。
- `CocosDropIn` 仅存可复用PNG，运行时文字/数字/列表/确认弹窗应由Prefab + Cocos Label/组件渲染。
- `Component_*.png` 只是形状参考或可选九宫格候选；需要手工配置SpriteFrame和九宫格边界，**本包未提供 .meta/.prefab 或九宫格参数**。
- `DesignSource`下的SVG是设计稿，不代表Cocos内可以直接加载SVG；必要时经官方资源工具转PNG。
- 持久化失败、招聘/裁员/建部/救助/重置必须处理幂等、二次确认和错误恢复，不能仅靠按钮禁用。
- 不新增真实在线排行、内购、跨行业、集团或子公司。
- 现有截图为视觉对照稿，未经逐设备像素级验证。正式上线需在Cocos里完成运行、交互、竖屏适配和TapTap真机验证。

## 核心统计

- B01—B05 共33项 UI；UI-01另有4张变体。
- B06 共67项共享素材（各一张PNG、一份SVG），按7组分类。
- 游戏运行候选PNG：67项；**整屏参考PNG：37张，不应打进发布运行资源**。
- 源设计SVG：37份整屏 + 67份共享；配置与文档另列。

## 数据与代码命名

- `UI-xx`：素材设计编号。`S00-S03/T01-T04/D01-D07`：已有工程规范中的导航或页面ID。
- `Axx`：弹窗或帮助层的**本对接包建议内部ID**，不代表已有工程已实现该路由。
- `UIIntent.action`：前端交互键，不是现成服务端接口；落地时映射至已有领域命令及只读查询。
- 中文说明可留在数据文件，所有游戏界面文案应由本地化/代码配置驱动。

## 开发Agent入口与安全安装工具

- `AGENT_UI_HANDOFF.md`：交给任意开发 Agent 的项目UI接入步骤；不会覆盖工程现有 `AGENT.md`。
- `Tools/install_cocos_assets.py`：B06 PNG安全合并脚本，**默认仅预览**，显式加`--apply`才复制；路径冲突默认跳过且返回非零状态。不会自动写`.meta`。
- 在 Windows 上可先执行：`python Tools/install_cocos_assets.py C:\\path\\to\\CocosProject`，确认无冲突再追加`--apply`。
