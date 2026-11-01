# 08｜TapTap普通小游戏适配、发布资质与提审门禁

> 资料检查日期：2026-11-01。**以下是基于官方文档的设计约束，不等于已经注册、打包、备案或审核通过。** 正式提交时需再次核对最新后台规则。此文件只针对**普通小游戏（Tap小游戏/WebGL运行时）**，不混用H5小游戏、APK SDK、PC游戏上传流程。

## 8.1 为什么选普通小游戏

目标：TapTap内即点即玩，竖屏2D轻量交互，优先Cocos Creator 3.8.x + TS。普通小游戏运行时不是浏览器，官方明确不存在BOM/DOM；`window`, `document`, `localStorage`不能作为正式SDK依赖。渲染和触屏由引擎/小游戏运行时承接。官方适配扩展在 Cocos 构建中勾选“微信小游戏→转换为Tap小游戏”，包体通常位于`build/TapBuild/game.zip`。官方链接见8.10。

## 8.2 接口适配层

```ts
interface ITapPlatform {
  getEnvironment(): 'TAPTAP'|'EDITOR';
  getWindowInfo(): {width:number;height:number;safeArea?:{top:number;bottom:number;left:number;right:number}};
  onShow(callback: ()=>void): Unsubscribe;
  onHide(callback: ()=>void): Unsubscribe;
  getStorage<T>(key:string):Promise<T|null>;
  setStorage<T>(key:string,data:T):Promise<void>;
  removeStorage(key:string):Promise<void>;
  login():Promise<{code:string}|{mock:true}>;
  getNetworkState():Promise<'online'|'offline'|'unknown'>;
}
```

- 真实版调用`tap.getWindowInfo`, `tap.onShow`, `tap.onHide`, `tap.setStorage/getStorage/removeStorage`, `tap.login`；**具体签名以官方SDK/适配插件最终版本为准**，不要直接把上面抽象当SDK签名。
- 本地编辑器`EditorMockPlatform`采用独立的开发存储实现，严禁将Mock包含进正式生产入口。
- SDK接口失败要转`PLATFORM_UNAVAILABLE/SAVE_FAILED/AUTH_REQUIRED`等领域错误；禁止平台原始异常泄漏到玩家页面。
- 生命周期：`onHide`暂停在线时钟、提交快照并记录水位；`onShow`先从持久化恢复/检查runId，计算离线月份，再启用在线时钟。注意重复绑定监听的清理与热重载。

## 8.3 本地缓存限制是架构约束

官方`tap.setStorage`文档说明：单key最多**1MB**、总存储最多**10MB**；如启用加密，单key有效上限约**0.7MB**，所有缓存约7.1MB。因此采用双槽数据+最近24个月完整账本+不无限存历史。每个slot目标**<500KB**，存档前估算JSON大小，超过预算先压缩历史再写盘。密码/平台会话密钥不能写业务存档。

## 8.4 平台登录与最小服务端的实际边界

官方流程：客户端`tap.login()`获取一次性`code`→开发者可信服务端调用`code2Session`，取`openid`及`session_key`→服务端给小游戏自定义会话；**`session_key`绝不可回传客户端**，`code`不可复用。官方创建小游戏说明提醒上传包体需正确接入TapTap登录。

第一阶段**经营数据完全本地**，但为平台认证联调预留最小无业务资料服务：

```http
POST /v1/auth/taptap/exchange
Content-Type: application/json
{"code":"<single-use platform code>"}

200 {"sessionToken":"opaque-short-lived","expiresInSec":3600}
401 {"code":"TAPTAP_CODE_INVALID"}
503 {"code":"TAPTAP_UPSTREAM_UNAVAILABLE"}
```

此HTTP接口是**本项目建议由开发者实现的后端接口，不是TapTap现成接口**。服务端通过机密管理环境变量调用官方`code2Session`，不把APP Secret/会话密钥写入代码仓库或前端，返回短期opaque token；最小版本不保存公司经营数据、CEO自定义姓名或员工姓名。若平台接入路径另有允许的客户端登录简化方案，需以官方最新文档确认后登记变更，不能自行省略登录检查。

上线决策：首次未联网且没有已认证游戏环境时，按TapTap联调及审核可用性决定是否给出“连接网络完成必要平台验证”的提示；已有有效本地经营档在断网期间可进入核心单机玩法，但**不能伪造平台登录成功**。具体断网策略必须由真机联调确定且上架前明确锁版。

## 8.5 添加到桌面、权限、适龄与文本安全

- **（2026-11-01 核实更新）** "添加桌面快捷方式"属于 **APK 的 TapPlay 沙箱能力**（游戏 APK 勾选 TapPlay 授权，运行时可引导创建桌面快捷方式）；**TapTap 普通小游戏 WebGL 运行时没有该 API**——官方适配扩展 taptap-minigame-tools v1.2.2 的 `tap-minigame.d.ts` 不含任何 shortcut/desktop 接口。普通小游戏真正必接的是 **TapTap 登录**（见官方"创建小游戏 §5.1 包体上传：请确保上传包体内已正确接入 TapTap 登录"）。因此第一阶段小游戏不实现、也不自行调用任何加桌面函数；如未来同时发布 APK/TapPlay 版本再评估桌面引导。
- 当前游戏不需位置、相机、麦克风、通讯录、相册权限；默认不申请任何无关权限。
- 平台适龄标记需按内容评估，在开发者后台提交相应资料；游戏不会因为看起来卡通就自行宣称适龄级别。
- 用户自定义名称只用于本地游玩、不发布到真实在线排行；采用字数、控制字符、敏感词与侵权风险过滤。预制名称库由人工审查与测试。
- 个人信息：TapTap平台标识只用于必要身份环节；**本地玩法档**与账号注销/隐私合规处理分离。游戏内提供隐私政策入口及必要说明。

## 8.6 包体构建流程（实测门禁）

1. 确定Cocos 3.8.x的实际小版本、官方适配插件版本，记录版本号、下载来源与hash。
2. 在Cocos扩展管理器导入/启用官方Tap小游戏扩展，检查控制台已加载输出。
3. 构建发布选择官方文档要求的引擎输出平台与“转换为Tap小游戏”，填写从开发者后台获得的真实AppID。
4. 开始构建，检查`build/TapBuild/game.zip`存在、能解压、包内入口/资源正确，未携带密钥/调试数据。
5. 上传开发包、生成自测入口，在Android/iOS的TapTap客户端真机测试初次进入、触屏、登录、存档/后台、关闭公司重开、离线恢复。
6. 记录打包日志、包大小、引擎版本、插件版本、模拟器与真机结果；构建失败不得声称已兼容平台。

官方创建小游戏指引称首包**不超过60M+**，该表述存在平台特定含义；项目内部将目标设为**≤20MB**方便快速加载，最终上限以后台当前规则为准。提交版本号遵循 `Vx.y.z`，每部分为整数且更新版本唯一递增。

## 8.7 上架资质与外部流程

| 项目 | 必须准备/确认 | 责任 | 验收证据 |
|---|---|---|---|
| TapTap开发者认证 | 以个人或企业主体完成入驻 | 用户/运营 | 后台认证状态截图 |
| 创建普通小游戏 | 游戏形态选“小游戏”，记录AppID | 用户/运营 | 后台唯一ID |
| 小游戏前置备案 | 软件著作权人信息、游戏介绍、负责人材料、电子核验等 | 用户/运营 | 核准号/审核状态 |
| 版号 | 当前官方说明：不涉及内购的小游戏无需提交版号；如变更商业化需重核实 | 法务/运营 | 官方当前规则核对表 |
| 防沉迷 | 单独小游戏游玩方式默认依托平台，按实际路径核实 | 开发/运营 | 平台自测及审查确认 |
| 内容审核 | 文案、命名、经营事件、版权、权限、隐私 | 设计/法务 | 审核检查记录 |
| 宣传素材 | 横幅、方图、3张以上实机图、竖屏实机视频等 | 美术/运营 | 文件清单、尺寸校验 |
| 提审与上线 | 包体+备案+商店资料+版本审核 | 运营 | 开发者后台截图 |

**特别提醒**：TapTap的“页面预约/敬请期待”与“正式上线（试玩版）”的包体/资质要求不同。本项目目标是可玩的小游戏正式上线；不能因为预约页面通过审核就当作游戏已可发布。

## 8.8 提审物料（以后台最终规格为准）

- 横版宣传图：1920×1080 JPG/PNG、2MB内；方形宣传图：1440×1440 JPG/PNG、2MB内。
- 实机截图：不少于3张，按平台要求的分辨率/比例；推荐实际取自公司、人才招聘、部门、年度报告。
- 实机录屏：竖屏9:16、至少720×1280、MP4，演示真实经营流程。不制作虚假CG代替实机操作。
- 游戏简介、功能说明、适龄/隐私说明、UI操作说明与无广告无内购说明。
- 备案用内容介绍说明应与**当前包体真正实现**的玩法一致，禁止包含尚未实现的子公司、多行业业务扩展等。

上述图片和视频规格来自前版官方指引，正式制作前再次在开发者后台确认；本设计包没有生成美术资源和录屏。

## 8.9 审核前技术/安全检查

1. 正式构建里没有平台密钥、测试用户私密内容、Node依赖/Mock权限接口。
2. TapTap客户端首次登录失败、`code`过期/重复、网络断开、后台恢复均可解释与恢复。
3. 业务存档不用账号信息作为公开排行榜展示名；关闭公司只删当前经营档。
4. 自定义输入严格过滤，不能输入HTML触发渲染或外部脚本。
5. 不包含广告/内购入口或空白广告位；游戏文案不含虚假经济收益承诺。
6. 检查适龄与未成年人规则、隐私政策链接、素材字体许可。
7. 对照当前审核规范核查“不得简单网站套壳”“无法关闭广告”等要求。
8. Android/iOS至少各1台、两种屏幕比例、支持离线/断网回归、权限拒绝、存储空间不足、升级存档迁移。

## 8.10 官方核实链接（TapTap普通小游戏专用）

- 开发指南：https://developer.taptap.cn/minigameapidoc/quick-start/document-guide/
- Cocos适配：https://developer.taptap.cn/minigameapidoc/dev/engine/Cocos-Laya-Egret/
- 创建/包体/资质：https://developer.taptap.cn/minigameapidoc/quick-start/guide/creation-improvement/
- 登录时序：https://developer.taptap.cn/minigameapidoc/dev/tutorial/open-capabilities/login-management/
- 本地储存：https://developer.taptap.cn/minigameapidoc/dev/api/storage/tap.setStorage/
- 设备安全区：https://developer.taptap.cn/minigameapidoc/dev/api/base/system/tap.getWindowInfo/
- onShow：https://developer.taptap.cn/minigameapidoc/dev/api/base/app/life-cycle/tap.onShow/
- 前置备案：https://developer.taptap.cn/minigameapidoc/quick-start/guide/pre-filing/
- 审核规则：https://developer.taptap.cn/minigameapidoc/tap-operation/operation-standards/review-standards/
- 适龄规则：https://developer.taptap.cn/minigameapidoc/tap-operation/operation-standards/age-rating/
- 官方 AI/Agent 指南：https://developer.taptap.cn/agents.md

**重要区分**：运营认证、备案、实际提审需要开发者主体及平台后台操作，设计文件/本地打包并不能代替审核完成。
