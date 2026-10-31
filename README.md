# 《我是CEO》第一阶段 MVP

TapTap 普通小游戏 · Cocos Creator 3.8.8 + TypeScript · 竖屏 375×812。

本仓库为可运行的 Cocos 工程。设计基线见 `docs/`（AGENT.md 为开发宪法）。

## 目录

- `assets/core/` 纯 TypeScript 领域层（**不依赖 Cocos / DOM / 平台 SDK**，可在 Node 单测）
  - `domain/` 类型、错误码、命令/Result、金钱、公司与候选人生成、校验
  - `simulation/` 可复现随机数
  - `persistence/` 双槽存档、CRC32、信封校验、墓碑、迁移
  - `platform/` 平台抽象 `ITapPlatform` 与编辑器 Mock
  - `application/` GameStore（串行变更+持久化）、GameFacade、各命令服务
- `assets/scripts/` Cocos 表现层：Bootstrap、代码驱动 UI、Cocos 平台适配
- `assets/scenes/Game.scene` 唯一启动场景（Canvas+Camera+Bootstrap）
- `tests/` Vitest 单元与集成测试
- `tools/` 静态服务器、无头截图等开发辅助
- `evidence/` 构建与运行截图证据

## 常用命令

```bash
npm install
npm run typecheck          # 严格 TS 检查（strict + noUncheckedIndexedAccess）
npm run lint               # ESLint
npm test                   # 全部单测/集成测
npm run test:golden        # 黄金用例（M1 起填充）
```

## 编辑器

用 Cocos Dashboard 以 Cocos Creator 3.8.8 打开本目录。启动场景 `assets/scenes/Game.scene`。

## 无头构建 web-mobile（PoC）

```powershell
& "C:\ProgramData\cocos\editors\Creator\3.8.8\CocosCreator.exe" `
  --project "<本目录>" `
  --build "platform=web-mobile;debug=true;buildPath=build" --nogui
```

产物在 `build/web-mobile/`。无头浏览器验证：

```bash
node tools/static-server.cjs build/web-mobile 8123
# 另开：
node tools/shot.cjs http://localhost:8123/ evidence.png   # 需 playwright-core
```

## M0 范围

创建公司/CEO、三候选首聘 2 人、本地双槽存档（断电恢复/墓碑重开）、
四 Tab 竖屏壳、新手提示、关闭公司事务。财务结算(M1)、部门/自动经营(M2)、
离线/事件/排行/真机平台(M3)在后续里程碑实现。

## 平台状态（如实标注）

- web-mobile 构建与无头 Chromium 运行已验证。
- TapTap 官方小游戏适配扩展、AppID、真机与备案为外部前置，未接入前相关项为 BLOCKED，
  详见 `EXECUTION_STATUS.md`。生产平台代码不得使用 window/document/localStorage。
