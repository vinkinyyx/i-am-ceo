# 《我是CEO》登录云函数（LeanCloud 云引擎部署指南）

零服务器方案：把 TapTap code2Session 换取接口部署到 TapTap TDS 的云引擎，免去买服务器。

与 `server/auth-server.mjs` 行为完全等价：相同路由 `POST /v1/auth/taptap/exchange`、相同请求 `{code}`、相同响应 `{sessionToken, expiresInSec}`、相同错误码。**游戏客户端无需改动。**

## 前置条件：域名与备案（先看这一节）

按 [TDS 域名备案指南](https://developer.taptap.cn/docs/v3/sdk/domain/icp/)，**国内节点绑定云引擎域名和 API 域名都需要域名已完成工信部 ICP 备案**。平台只对 API 侧提供「共享/测试域名」，且官方明确说明其仅供测试、可能被回收、不保证可用性——**不能作为正式发布依赖**。因此：

- 正式上线 **必须**买一个域名并完成备案（域名约 ¥30–60/年，备案本身免费，需 1–3 周；TDS 可作为接入商）。
- 没有备案域名时，云引擎部署仍可完成，但**外部无法访问**，只能先跑通部署自测，域名到位后再绑域名、再验证接口。

建议与「小游戏前置备案」并行推进，两者都要走，别等。

## 部署步骤（约 30 分钟）

1. **注册 TDS**：用 TapTap 开发者账号登录 [开发者中心](https://developer.taptap.cn/)，创建游戏（应用）。
2. **进入云引擎**：路径是 **开发者中心 → 你的游戏 → 游戏服务 → 云服务 → 云引擎 → 管理部署**。
   **不需要创建分组**：每个应用默认已有一个 `web` 分组，直接用默认分组即可；只有需要多套后端程序、多域名时才建新分组。
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

5. **绑定访问域名**：**云引擎 → 管理部署 → 你的分组（默认 `web`）→ 设置 → 访问域名**。绑定一个已备案子域名（如 `api.yourdomain.com`），控制台会自动申请 SSL。
6. **自测**（域名绑定生效后）：
   - `GET  https://api.yourdomain.com/healthz` → `{"ok":true}`
   - `POST https://api.yourdomain.com/v1/auth/taptap/exchange`，body `{"code":"bad"}` → 预期 401 `{"code":"TAPTAP_CODE_INVALID"}`（说明链路已通，bad code 被上游拒绝属正常）
7. **回写游戏配置**：把该域名写入项目根 `assets/resources/config/runtime.config.json`（已被 gitignore，不会上传）：

   ```json
   {
     "authEndpoint": "https://api.yourdomain.com",
     "privacyPolicyUrl": "<隐私政策页面地址>"
   }
   ```

   然后重打包：`powershell -ExecutionPolicy Bypass -File tools/build-tap.ps1`。
8. **TapTap 后台白名单**：小游戏管理后台把该域名加入服务器域名白名单。

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
