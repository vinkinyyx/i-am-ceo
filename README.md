# 《我是CEO》

Cocos Creator 3.8.8 + TypeScript，竖屏经营游戏，目标为 TapTap 普通小游戏。不是 Lua 项目；Web 构建用于本地预览，正式小游戏包使用独立构建流程。

## 当前执行入口

- [项目总览](docs/我是CEO_项目总览.md)是需求、设计、决策、任务状态和验收结论的唯一权威文档。
- **下一步执行总览 §24.12**：按最新独立验收差异继续UI、身份、云操作、真实榜、广告与发布收口；§21—23保留完整基线设计。
- **R31独立复验（2026-11-06）**：493 passed/1 skipped、候选ZIP静态PASS，保留危机延后/会话/过期保框等修复；仍实测确认按钮gap仅4、子确认取消后不回原详情。云按钮只提示、profile固定null，榜服务未挂提交流程，不能只等待用户提供ID。详见总览§11.28/§24，证据`evidence/acceptance-r31-independent-20261106/`；整体不可提审。
- 云备份、真实榜已有部分本地实现，接手前阅读 **§21.20**，复用现有代码；云服务用于备份和跨设备恢复，不扩建玩家运营后台。
- 玩家真实榜与本地模拟榜并存；每日广告可跳过，招聘奖励仅免招聘费，后续月薪照付。真实平台接入及设备验收以证据为准。
- **激励视频是必做项**：专项见总览 **§24.14**，含每日/招聘双入口、原生播放、奖励事务、L2真机测试包和生产启用门禁；本人需准备的信息见 **§24.14.9**。不能以disabled包或Fake通过当作真实接入完成。
- 用户本人需要办理的账号、平台及设备条件见 **§24.11**（补充并纠正§21.17）。
- Agent 工作规则见 [AGENT.md](AGENT.md)；平台参考见 [TapTap 接入知识库](docs/integrations/taptap/README.md)及项目 `skills/`。参考资料有核验日期，正式接入前须重新确认官方接口和后台状态。

历史测试数量、旧包 SHA256 和整改过程保留在总览及 `evidence/`，不再在首页叠加互相覆盖的历史状态。

## 保留的构建与清理记录

2026-11-05 已将旧包、重复预览、Cocos 导入缓存和临时调试文件移出项目并归档。清单及恢复目录见 [cleanup-result.json](evidence/cleanup-20261105/cleanup-result.json)，处理记录见总览 **§11.25**。

2026-11-05清理时保留的历史构建：

`build/release/m3-20261104-cloud-rank-r1/05/`

其中 `game.zip` 和 `web-preview/web-mobile/` 保留用于历史追溯。2026-11-06最新候选为 `build/release/m4-20261106-r31/01/game.zip`，静态复验通过但仍有§24缺口，不代表可提审。后续完成整改须新releaseId出包，不能用旧候选证明新功能。

旧默认Web预览曾归档，当前 `build/web-mobile/` 已重新生成。以下命令仅预览历史云/榜候选；验证新改动时必须核对当前产物和源码指纹：

```powershell
node tools/static-server.cjs build/release/m3-20261104-cloud-rank-r1/05/web-preview/web-mobile 8123
```

## 工程目录

| 路径 | 用途 |
|---|---|
| `assets/core/` | 经营规则、月结、命令、持久化、平台适配 |
| `assets/scripts/` | Cocos UI、启动、音频及平台表现层 |
| `assets/scenes/` | 启动场景 |
| `assets/resources/` | 运行素材、配置；本地配置不得泄露凭据 |
| `tests/`、`tools/` | 测试、Canvas 驱动、构建和包体校验 |
| `docs/` | 权威总览、隐私材料、配置和专项参考 |
| `evidence/` | 验收记录、失败复现、回归种子及清理清单 |
| `design/`、`audio/` | 设计源文件与音频交付；新背景源位于 `design/00_ALL_49_PNG_37_SVG/` |
| `CEO_TapTap_Animated_Promo_v1/`、`CEO_TapTap_Store_Batch02_v2.0/` | 现有宣传源素材，保留待平台物料验收 |
| `extensions/`、`settings/`、`profiles/` | 引擎扩展和工程配置，保留 |
| `server/` | 现有最小认证服务，不等于需要另建经营数据库 |

`node_modules/` 保留以便继续开发；`library/`、大部分 `temp/` 可由 Creator 重新生成。`temp/declarations/` 和 `temp/tsconfig.cocos.json` 保留，避免误删现有工程声明依赖。

## 本地验证与构建

```powershell
npm run check             # 领域/UI 类型检查、lint、全部测试
npm run web-build         # 生成新的本地 Web 预览
npm run static-server     # 预览新生成的 build/web-mobile
node server/selftest.mjs  # 最小认证服务自检
```

正式小游戏构建先阅读总览发布门禁和 `tools/build-tap-v2.ps1` 的真实参数。关闭 Creator 后执行构建；构建通过、ZIP 校验通过、真机通过、云测通过、提审通过分别记录，不相互替代。

本轮没有提交、推送、上传、提审或发布。
