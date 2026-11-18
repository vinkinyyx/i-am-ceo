# 《我是CEO》项目日志

## 2026-11-18 · 文档合并与历史归档

- 根 README 合并原项目记忆，只保留 `AGENTS.md` 作为 Agent 规则入口。项目总览保留产品与技术规范、业务不变量、测试门禁及决策编号，完整旧稿及逐轮验收说明随此次归档保留。
- UI V2 开发交接与美术生产规格合到同一 Markdown。页面与素材台账保留 JSON，程序绘制项保留唯一 CSV。旧 Word、Excel、同内容 CSV 和旧版素材包移出工作区。
- TapTap 发布、联调与 Dirichlet 实施说明合到平台 README，独立保留隐私文案和可运行的项目发布 Skill。音频设计、接入与验收合到音频 README，与 Cocos 音频配置一致的副本移出工作区。
- 历史验证证据和旧截图命令移出工程。仍有调用的两份浏览器存档夹具迁到 `tests/fixtures/browser/`，生成报告写到忽略的 `build/logs/browser/`。核对夹具内容逐字节一致。
- `npm run check` 通过（633 通过，1 个可选用例默认跳过）。另单独启用该用例，验证 900 行模拟数据能写到新路径。素材清单、头像一致性、5 项 TapTap 预检测试和文档链接核对通过。
- 此次移出 776 个文件（73,078,860 字节）。原始路径、文件数及恢复方法见本机 归档清单 `D:/Workspace/TapTap/_cleanup-backups/我是CEO-20261118-doc-consolidation/archive-manifest.json`。按清单中的相对路径可取回旧稿与证据。

## 2026-11-18 · 多平台目录整理

- 公共经营、存档、Cocos UI 和运行资源继续由根工程维护。共享 UI 设计源迁至 `docs/ui-design/`，美术和音频制作源归到 `materials/`。引擎用的场景、脚本与运行配置保留原 `.meta` UUID。
- TapTap 适配器、配置、换票服务、构建工具、项目 Skill、发布文档和宣传素材已归位。历史 TapTap 包校验记录迁至 `platforms/taptap/evidence/`。Dirichlet 实施设计沿用总览原 §32 编号，正文迁至 [TapTap 激励视频](../platforms/taptap/README.md#激励视频)。
- 抖音和微信各有独立的 `MiniGameAdapter` 注册入口。标记为这些目标但没有实现时明确返回平台不可用。TapTap 转换使用的 `wechatgame` 中间件留在 TapTap 工作目录。
- 旧构建、缓存、退役转换脚本和非运行设计文档的导入元数据移出工作区。本地安装依赖、Creator 类型声明、必要配置和仍有追溯用途的证据留在工作区。

### 验证

- `npm run check` 通过，633 个测试通过，1 个可选的证据导出测试跳过。招聘广告券测试使用固定测试时钟验证原有账本断言。Playwright 依赖已写入锁文件。
- `npm run web-build` 通过。使用 Playwright 在 375 × 812 视口操作真实 Canvas，验证隐私同意入库、公司及两名员工入库、现金从 300,000 元减至 286,228 元，实扣费 13,772 元。重载恢复同一局，浏览器错误为零。
- `npm run release-build` 和 `npm run tap-build` 均完成 TapTap 诊断流水线。最终验证包为 diagnostic-20261118-150859766/01，版本 1.0.0，11,544,946 字节，598 个条目。ZIP 的 SHA-256 为 `d11e6918fce19a84c63de4c3610631c40acb70aa2c06361a8bb0a5ab8f01aecb`，构建前后输入指纹一致。广告、云备份、真实榜均以禁用配置验证。
- TapTap 认证服务自检和换票云函数部署 ZIP 构建通过。项目发布 Skill 预检单测 5 项通过，主机缺少 ffprobe，视频尺寸与编码分支待具备工具后验证。D1 美术核对通过，涵盖 47 个素材 ID。
- TapTap 真机、云测和后台状态尚未验证。抖音和微信原生实现、构建及真机测试待接入。

### 恢复记录

- 本机归档目录为 `D:/Workspace/TapTap/_cleanup-backups/我是CEO-20261118-reorganization/`。`archive-manifest.json` 记录整理前外移项，`verification/archive-manifest.json` 记录重新验证后移出的产物和缓存。ZIP 按 SHA-256 回读校验。
- 最终诊断包在归档目录的 `verification/build/taptap/release/diagnostic-20261118-150859766/01/game.zip`。TapTap 构建 manifest、Web 浏览器回读报告和截图同在归档的 `verification/build/` 下。
