# 微信小游戏

适配器待开发。当前选中此目标时，`PlatformFactory` 返回 `PLATFORM_UNAVAILABLE`。本地开发玩法可使用公共 Web 预览。

- [适配入口](../../assets/platforms/wechat/adapter.ts)由 `PlatformFactory` 读取。实现后为 `MiniGameAdapter.create` 提供工厂。
- 实现 [宿主接口](../../assets/core/platform/IGamePlatform.ts)和 [能力绑定](../../assets/core/platform/PlatformServices.ts)。接入本平台的本地存储、窗口及安全区、前后台、登录与请求，再按产品范围逐项接入广告、云和排行榜。
- 平台运行配置置于 `assets/resources/platforms/wechat/`。平台文档、构建入口和发行物料依次放在本目录的 `docs/`、`tools/`、`materials/`。构建输出使用 `build/wechat/`。
- 接入时为此目标准备独立构建配置、包内容校验、隐私政策和真机记录。公共经营规则沿用[项目总览](../../docs/我是CEO_项目总览.md)。

TapTap 流水线里的 Creator `wechatgame` 中间包归 TapTap 构建使用。微信发行从自己的目标配置、入口和测试环境接入。
