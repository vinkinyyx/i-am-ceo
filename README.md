# 《我是CEO》第一阶段 MVP

TapTap 普通小游戏 · Cocos Creator 3.8.8 + TypeScript · 竖屏 375×812。

本仓库为可运行的 Cocos 工程，M0—M3 代码已全部落地，可产出 TapTap 小游戏包。

- **需求、设计、测试基线、当前执行进展**：全部集中在 [docs/我是CEO_项目总览.md](docs/我是CEO_项目总览.md)（唯一权威文档）。
- **Agent 执行规范**：`AGENT.md`。

## 目录

- `assets/core/` 纯 TypeScript 领域层（**不依赖 Cocos / DOM / 平台 SDK**，可在 Node 单测）
  - `domain/` 类型、错误码、命令/Result、金钱、公司与候选人生成、校验
  - `simulation/` 月结、年结、离线、事件、排行、时钟、可复现随机数
  - `persistence/` 双槽存档、CRC32、信封校验、墓碑、迁移、完整性校验、历史裁剪
  - `platform/` 平台抽象 `ITapPlatform`、编辑器 Mock、安全区、隐私同意、登录
  - `application/` GameStore（串行变更 + 持久化）、GameFacade、各命令服务
- `assets/scripts/` Cocos 表现层：Bootstrap、代码驱动 UI（AppView/UiFactory）、音频、平台适配
- `assets/scenes/Game.scene` 唯一启动场景（Canvas + Camera + Bootstrap）
- `tests/` Vitest 单元 / 集成 / 黄金用例 / 模拟 / 包体卫生
- `tools/` 构建（`build-web.ps1`、`build-tap.ps1`）、静态服务器、无头截图与包体校验
- `server/` 最小 TapTap 登录 code 交换服务（零依赖，密钥仅环境变量）
- `design/` UI 与音频设计交付包｜`evidence/` 构建与测试证据

## 常用命令

```bash
npm install
npm run typecheck          # 严格 TS 检查（strict + noUncheckedIndexedAccess）
npm run lint               # ESLint
npx vitest run             # 全部单测 / 集成 / 黄金 / 模拟（23 文件）
node tools/static-server.cjs build/web-mobile 8123   # 本地预览
node server/selftest.mjs   # 服务端自检
```

## 构建

```powershell
# 本地 / 无头验证
powershell -ExecutionPolicy Bypass -File tools/build-web.ps1

# TapTap 小游戏包 → build/TapBuild/game.zip
powershell -ExecutionPolicy Bypass -File tools/build-tap.ps1
```

构建前请先关闭 Cocos Creator（单实例锁会让 CLI 静默失败）。

## 编辑器

用 Cocos Dashboard 以 Cocos Creator 3.8.8 打开本目录，启动场景 `assets/scenes/Game.scene`。

## 平台状态（如实标注）

- web-mobile 构建与无头 Chromium 运行已验证；Tap 小游戏包已实际产出（约 5.24 MiB，472 条目）。
- Android 云端准入测试通过；华为 HarmonyOS 真机卡启动页仍在排查（见总览 §11.6）。
- iOS 真机、备案/软著、实机截图与录屏、后台提审仍待办，**未上架**。
- 生产平台代码不得使用 `window` / `document` / `localStorage`。
