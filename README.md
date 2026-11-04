# 《我是CEO》

Cocos Creator 3.8.8 + TypeScript，竖屏经营游戏，目标为 TapTap 普通小游戏。不是 Lua 项目；Web 构建用于本地预览，正式小游戏包使用独立构建流程。

## 当前执行入口

- [项目总览](docs/我是CEO_项目总览.md)是需求、设计、决策、任务状态和验收结论的唯一权威文档。
- **下一步执行总览 §22.16**：统一处理按钮布局、详情页持续显示、云备份、真实玩家榜、广告与发布整改。
- **UI 整改尚未执行**：员工详情约 3.8 秒随月结消失的问题已复现，见总览 §22.1；不能把打开弹窗或导航通过当作整改完成。
- 云备份、真实榜已有部分本地实现，接手前阅读 **§21.20**，复用现有代码；云服务用于备份和跨设备恢复，不扩建玩家运营后台。
- 玩家真实榜与本地模拟榜并存；每日广告可跳过，招聘奖励仅免招聘费，后续月薪照付。真实平台接入及设备验收以证据为准。
- 用户本人需要办理的账号、平台及设备条件见 **§21.17**。
- Agent 工作规则见 [AGENT.md](AGENT.md)；平台参考见 [TapTap 接入知识库](docs/integrations/taptap/README.md)及项目 `skills/`。参考资料有核验日期，正式接入前须重新确认官方接口和后台状态。

历史测试数量、旧包 SHA256 和整改过程保留在总览及 `evidence/`，不再在首页叠加互相覆盖的历史状态。

## 保留的构建与清理记录

2026-11-05 已将旧包、重复预览、Cocos 导入缓存和临时调试文件移出项目并归档。清单及恢复目录见 [cleanup-result.json](evidence/cleanup-20261105/cleanup-result.json)，处理记录见总览 **§11.25**。

目前只保留最新一批构建：

`build/release/m3-20261104-cloud-rank-r1/05/`

其中 `game.zip` 为现存历史候选产物，`web-preview/web-mobile/` 为对应预览。该包通过本轮静态复验，**不代表 §22 的 UI 问题已修复，也不代表具备提审或上线条件**。完成整改后须用新的 releaseId 重新构建和验收，不能重用旧包作为整改成果。

旧 `build/web-mobile/` 已归档。运行默认预览命令前，请先重新执行 `npm run web-build`；也可直接预览保留构建：

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
