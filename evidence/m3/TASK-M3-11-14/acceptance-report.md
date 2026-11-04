# TASK-M3-11-01—14 分层验收报告

日期：2026-11-04（Asia/Shanghai）  
范围：Cocos Creator 3.8.8、TapTap 普通小游戏；只含玩家云备份/恢复方向，不建设运营玩家后台；保留本地模拟榜。所有平台开关默认关闭。

## 结果

| 层 | 状态 | 证据/结论 |
|---|---|---|
| 本地质量 | PASS | [`npm-check-final-03.log`](npm-check-final-03.log)：`npm run check` exit 0；62 files，477 passed，1 skipped。另有云codec/账号过滤/unknown create/导入事务/榜分/广告账本 Fake 证据。 |
| 包静态 | PASS | [最终构建 manifest](../build/m3-20261104-cloud-rank-r1/05/manifest.json)、`verify-package.log` 与 `package-check.json`：Cocos exit 36 + done marker、Tap 转换、ZIP静态检查、release config检查和输入指纹一致。 |
| 本地视觉 | PASS | [`visual-05/visual-matrix-report.json`](visual-05/visual-matrix-report.json)：375×812、360×640、390×844、375×834；公司/部门/人才/本地排行/设置；28 checks PASS，browserErrors=0。真实榜配置 disabled，所以不展示平台榜。 |
| TapTap平台运行 | BLOCKED / NOT_RUN | MCP未授权/未选App，缺真实云/榜权限和测试账号设备；本次无云写/删、榜创建、上传、提审或发布。Fake不代替平台结果。 |
| 可提审 | NOT_READY | 必须先完成同一SHA设备A/B恢复/账号隔离/关闭公司/reset、云冲突、榜单降分清零与政策/资质后台条件。 |

## 唯一推荐开发自测候选

- 版本：`1.0.2`
- releaseId：`m3-20261104-cloud-rank-r1`
- 用途：`product-test-candidate`（供本人后续开发自测使用）
- 包：`D:\Workspace\TapTap\我是CEO\build\release\m3-20261104-cloud-rank-r1\05\game.zip`
- SHA256：`ee8466375391acc91197e5e8805e9e8403952eb803149aab5917e6706bec6183`
- ZIP大小：4,617,974 bytes
- manifest：`D:\Workspace\TapTap\我是CEO\evidence\m3\build\m3-20261104-cloud-rank-r1\05\manifest.json`
- 广告：`disabled`，adUnitId 为空；未运行广告验证。
- 云存档/真实榜：`disabled`，没有真实App ID、archive、榜单ID；未声称平台验证。
- 候选包 sourceFingerprint：`3777b24855a2be2c2d0cada6fb1010710e784aa672cf671aee79431625178d22`，构建前/后/复核相同。

## 实施内容与边界

- 新增 CloudCheckpoint codec、CRC/size/schema/app/environment/reset epoch 校验、closed-run保护、祖先/分支比较、Tap云存档Provider和本地 Fake 编排。
- create 意图先落本地；结果 unknown 后按 `appId+environment+profileId+checkpointId` 查证，绝不盲目新建。恢复经过 GameStore 单锁/journal提交，要求本地基线未变；本机广告账本权威，云端券/session不合并；导入将离线水位设为当前，不重复结算。
- 新设备空档可初始化恢复；已有运行中公司只接受相同run。关闭公司继续依赖已有本地墓碑防旧局回写。仍缺跨设备 reset epoch 持久协调、云分支选择/管理UI及远端历史配额处理。
- 新增榜单Provider/Fake、资产与经营年限映射、两榜部分失败隔离、云确认提交API与账号代际栅栏；现有本地模拟榜保留，真实榜设置需独立同意。提交服务尚未连入玩家云备份UI，真实榜ID缺失时不开启。
- 广告：UTC+8 dayKey、保留日归属、D+7日历到期、券元数据/完成ID有界、unknown grant同会话重试、冷启动无完成回执会话取消；onHide只取消loading而不判定正在展示的广告失败；在线时钟/音频增加广告暂停。
- 隐私政策升至V3，运行时、资源、文档说明可选云备份与公开榜身份展示；云/榜/广告资源均默认关闭。真实公开政策URL和平台数据处理/删除条件仍待本人完成。

## 仍需本人完成（§21.17）

1. 官方OAuth授权并核对正确开发者主体、TapTap App及普通小游戏版本/资格。
2. 核实云存档权限、配额、账号隔离、保留/删除、当前API及两账号两设备测试条件。
3. 创建测试资产榜/年限榜并配置白名单；实测 numeric/desc/latest、分数下降和清零。
4. 提供可公开访问的V3隐私政策URL及Tap云/榜实际数据类别、平台删除渠道。
5. 核实广告资格和真实广告位；没有实名核验的广告环境保持关闭。
6. 本人用唯一ZIP上传开发自测并按同SHA完成平台真机验收。该操作未由本次执行。

任务级状态、S1—S9映射和历史attempt记录见 [项目总览 §21.20](../../../docs/我是CEO_项目总览.md)。
