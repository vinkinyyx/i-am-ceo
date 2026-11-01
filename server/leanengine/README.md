# 《我是CEO》登录云函数（LeanCloud 云引擎部署指南）

零服务器方案：把 TapTap code2Session 换取接口部署到 LeanCloud 云引擎（TapTap 自家 TDS 生态），使用平台共享域名（已备案），**无需购买服务器、无需域名 ICP 备案**。

与 `server/auth-server.mjs` 行为完全等价：相同路由 `POST /v1/auth/taptap/exchange`、相同请求 `{code}`、相同响应 `{sessionToken, expiresInSec}`、相同错误码。**游戏客户端无需改动。**

## 部署步骤（约 30 分钟）

1. **注册 TDS / LeanCloud**：用 TapTap 开发者账号登录 [TDS 控制台](https://developer.taptap.cn/)（或 LeanCloud 国际/国内控制台），创建一个应用（区域选**国内**）。
2. **进入 云引擎**：应用 → 云引擎 → 创建分组（选 Node.js 18+ 运行环境）。
3. **上传代码**：把本目录（`server/leanengine/`）整个作为云引擎项目部署，两种方式任选：
   - 控制台「Git 部署」：把本目录推到一个仓库分支绑定；
   - 或安装 CLI：`npm i -g leancloud-cli`，在本目录执行 `lean login` → `lean switch <应用名>` → `lean deploy --prod`。
4. **配置环境变量**（云引擎 → 设置 → 自定义环境变量）：

   | 变量 | 值 | 说明 |
   | --- | --- | --- |
   | `TAPTAP_APP_ID` | TapTap 后台的 Client ID | 开发者中心 → 游戏服务 → 应用配置 |
   | `TAPTAP_SERVER_SECRET` | TapTap 后台的 Server Secret | **仅服务端可见，绝不进游戏包** |
   | `TAPTAP_CODE2SESSION_URL` | 官方 code2Session 地址 | 以 TapTap 当期官方文档为准，真机联调时核对 |
   | `SESSION_TTL_SEC` | `3600`（可选） | 会话有效期 |

5. **自测**：云引擎会给一个 `https://<你的应用>.lc-cn-n1-shared.com` 形式的访问域名，依次验证：
   - `GET  https://<域名>/healthz` → `{"ok":true}`
   - `POST https://<域名>/v1/auth/taptap/exchange`，body `{"code":"bad"}` → 预期 401 `{"code":"TAPTAP_CODE_INVALID"}`（说明链路已通，bad code 被上游拒绝属正常）
6. **回写游戏配置**：把该域名告诉我（或自行）写入项目根 `assets/resources/config/runtime.config.json`（已被 gitignore，不会上传）：

   ```json
   {
     "authEndpoint": "https://<你的应用>.lc-cn-n1-shared.com",
     "privacyPolicyUrl": "<隐私政策页面地址>"
   }
   ```

   然后重打包：`powershell -ExecutionPolicy Bypass -File tools/build-tap.ps1`。
7. **TapTap 后台白名单**：小游戏管理后台把该域名加入服务器域名白名单。

## 运维说明

- **会话存储**：进程内存，单实例足够 MVP；若将来扩多实例，改用 LeanCache（Redis）存会话。
- **扩容/休眠**：免费档实例有休眠策略，冷启动几秒属正常；登录为低频操作，影响可忽略。上线后如介意，可在控制台开「标准实例」。
- **密钥安全**：三个 `TAPTAP_*` 变量只存在于云引擎环境变量；仓库与游戏包内均不应出现。
- **日志排障**：云引擎控制台 → 日志，检索 `[auth-cloud]`。

## 本地自测（可选）

```bash
cd server/leanengine
npm install
TAPTAP_APP_ID=xxx TAPTAP_SERVER_SECRET=yyy TAPTAP_CODE2SESSION_URL=https://example.invalid node server.js
# 另开终端
curl -X POST http://localhost:3000/v1/auth/taptap/exchange -H "Content-Type: application/json" -d '{"code":"bad"}'
```
