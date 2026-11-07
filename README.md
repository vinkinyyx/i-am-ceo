# 《我是CEO》

Cocos Creator 3.8.8 + TypeScript，竖屏经营游戏，目标为 TapTap 普通小游戏。不是 Lua 项目；Web 构建用于本地预览，正式小游戏包使用独立构建流程。

## 当前执行入口

- [项目总览](docs/我是CEO_项目总览.md)是需求、设计、决策、任务状态和验收结论的唯一权威文档。
- **剩余开发任务书 §28 / 最新执行提示词 §28.12**：按DEV-01—08完成权威身份刷新、云榜/奖励接线、服务部署准备、配置模式、真实能力联调、清理后资源、固定验收与最终候选。§27.15保留当前完成度和平台阻塞，已通过业务不重做。
- **最新规划复核（2026-11-07）**：577 passed/1 skipped；A本地与B1服务部署包已交付，B2仍需缓存有效期内平台换号的真实身份复验收口；广告实时仍未开通，榜为空，authEndpoint/隐私URL未配置。后台spark声明与mini_app槽位冲突且旧绑定失效，先核清发行状态；见总览§27.15。1.0.6包CRC/SHA正常，但清理后134项资源输入缺失，最终候选须按当前源码重建。
- 云备份、真实榜已有部分本地实现，接手前阅读 **§21.20**，复用现有代码；云服务用于备份和跨设备恢复，不扩建玩家运营后台。
- 玩家真实榜与本地模拟榜并存；每日广告可跳过，招聘奖励仅免招聘费，后续月薪照付。真实平台接入及设备验收以证据为准。
- **激励视频是必做项**：专项见总览 **§24.14**，含每日/招聘双入口、原生播放、奖励事务、L2真机测试包和生产启用门禁；本人需准备的信息见 **§27.10**。不能以disabled包或Fake通过当作真实接入完成。
- 用户本人需要办理的账号、平台及设备条件见 **§27.10**。
- Agent 工作规则见 [AGENT.md](AGENT.md)；平台参考见 [TapTap 接入知识库](docs/integrations/taptap/README.md)及项目 `skills/`。参考资料有核验日期，正式接入前须重新确认官方接口和后台状态。

历史测试数量、旧包 SHA256 和整改过程保留在总览及 `evidence/`，不再在首页叠加互相覆盖的历史状态。

## 保留的构建与清理记录

2026-11-05 已将旧包、重复预览、Cocos 导入缓存和临时调试文件移出项目并归档。清单及恢复目录见 [cleanup-result.json](evidence/cleanup-20261105/cleanup-result.json)，处理记录见总览 **§11.25**。

2026-11-05清理时保留的历史构建：

`build/release/m3-20261104-cloud-rank-r1/05/`

其中 `game.zip` 和 `web-preview/web-mobile/` 保留用于历史追溯。2026-11-06最新诊断包为 `build/release/m4-20261107-f26-verified/01/game.zip`（1.0.5，4,446,563 bytes，461 entries，VERIFY_OK）；广告/云/真实榜disabled，§27后续阶段未完成，不代表可提审。旧r31保留追溯。后续完成整改须新releaseId出包，不能用旧候选证明新功能。

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
