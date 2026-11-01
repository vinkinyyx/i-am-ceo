# code2Session 最小服务端（详见 `docs/我是CEO_项目总览.md` §9.4）

零第三方依赖的 Node.js（≥18）服务，仅用于把 TapTap 客户端一次性 `code`
换成项目自有的短期会话 token。**不保存任何公司经营数据、CEO/员工姓名。**

## 接口

```http
POST /v1/auth/taptap/exchange
Content-Type: application/json
{"code":"<single-use platform code>"}

200 {"sessionToken":"<opaque>","expiresInSec":3600}
401 {"code":"TAPTAP_CODE_INVALID"}
503 {"code":"TAPTAP_UPSTREAM_UNAVAILABLE"}
```

另提供 `GET /healthz` 存活探针。

## 密钥（只从环境变量读取，严禁入库）

| 变量 | 说明 |
|---|---|
| `PORT` | 监听端口，默认 8787 |
| `TAPTAP_APP_ID` | 小游戏 AppID（MiniApp ID） |
| `TAPTAP_SERVER_SECRET` | 服务端密钥（Server Secret），仅后端持有 |
| `TAPTAP_CODE2SESSION_URL` | 官方 code2Session 地址（以官方当期文档为准） |
| `SESSION_TTL_SEC` | 会话有效期，默认 3600 |
| `NODE_TLS_REJECT_UNAUTHORIZED` | 保持默认；仅本地排障可临时置 0，禁止用于生产 |

启动前必须配置 `TAPTAP_APP_ID` 与 `TAPTAP_SERVER_SECRET`，缺失时服务拒绝启动
（不会用空密钥向官方发起请求）。

## 本地运行

```bash
# Windows PowerShell
$env:TAPTAP_APP_ID="tapxxxxxxxx"; $env:TAPTAP_SERVER_SECRET="<secret>"
$env:TAPTAP_CODE2SESSION_URL="https://<官方域名>/.../jscode2session"
node server/auth-server.mjs

# curl 自测
curl -X POST http://127.0.0.1:8787/v1/auth/taptap/exchange `
  -H "Content-Type: application/json" -d '{\"code\":\"test\"}'
```

## 部署要点

- 仅通过 HTTPS 对外暴露（前置 Nginx/网关终止 TLS）；
- 客户端 `assets/resources/config/runtime.config.json` 的 `authEndpoint`
  指向本服务 https 基础地址（该文件不入库）；
- `sessionToken` 当前为进程内存签发的不透明随机串，多实例/持久化需求属第二阶段；
- 官方 code2Session 的真实 URL、请求/响应字段以 TapTap 当期官方文档为准，
  真机联调时在 `exchangeWithTapTap` 内按实际响应做一次校准。
