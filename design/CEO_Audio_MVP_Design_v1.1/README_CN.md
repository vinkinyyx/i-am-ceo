# 《我是CEO》第一阶段音频设计包 V1.1

> 用途：将音频任务交给任意音乐制作或开发 Agent，要求可追踪、低成本、TapTap 小游戏友好。

## V1.1更新：一键关闭/开启全部声音

- UI-12「游戏设置」新增 **全部音乐与音效** 总开关，默认开；一键关闭后BGM、年度结算短乐与按钮音效全部立即静音。
- 原有「背景音乐」「操作与提示音效」独立开关仍然保留；总开关恢复后按此前分项偏好执行。
- 开关状态持久化，App重新启动保持，静音期间不积压事件；关闭公司重开时依既定规则恢复默认声音设置。
- 开发细则见 `UI_PATCH/`；新增AQA-18至AQA-25测试。16项音频总数量不变。

## 本次交付

- **音频需求清单**：2 首循环背景音乐 + 3 段短乐 + 11 个操作音效 = 16 个**待制作**音频资产。
- **配置文件**：`Config/audio_manifest.json`（每条资源的用途、时长、文件名、触发条件、状态）和 `Config/audio_event_map.json`（事件映射）。
- **技术/验收**：`Specs/02_Music_Brief.md`、`Specs/03_Cocos_TapTap_Integration.md`、`Specs/04_Audio_QA.md`。
- **已有音频**：`ReferenceOnly/PromoOriginalMusic_26s.wav`，来自此前宣传片的 26 秒音轨，用于风格参考，**不计入游戏的 16 项**。

注意：**本包是设计清单与开发契约，不包含新制作的 16 条游戏内音频**。音频生产完成后须将真实文件放入 `CocosDropIn/assets/resources/audio/` 对应目录并更新状态、授权证据。空目录中有 `.gitkeep` 仅用于显示未来放置位置。

## 第一阶段取舍

- 不做战斗音乐、地图音乐、上市音乐、子公司音乐、多人音乐，也不为每种部门单独作曲。
- 游戏可以持续挂机，背景音乐要柔和、耐听、可静音，速度加速不改变乐曲速度。
- 首次上手教学使用创业曲，开始经营后统一使用经营曲；年度结果以短乐进行反馈。
- 亏损不是破产，避免恐怖、激烈或刺激消费式警报。

## 推荐读取顺序

1. `Specs/01_Audio_Asset_List.md`
2. `Specs/02_Music_Brief.md`
3. `Config/audio_manifest.json`
4. `Config/audio_event_map.json`
5. `Specs/03_Cocos_TapTap_Integration.md`
6. `Specs/04_Audio_QA.md`
7. `AGENT_AUDIO_HANDOFF.md`

## 参考来源（用于技术核验）

- Cocos Creator 3.8 音频系统 https://docs.cocos.com/creator/3.8/manual/zh/audio-system/overview.html
- Cocos Creator 3.8 AudioSource API https://docs.cocos.com/creator/3.8/api/en/class/AudioSource
- TapTap 小游戏 `tap.setInnerAudioOption` https://developer.taptap.cn/minigameapidoc/dev/api/media/audio/tap.setInnerAudioOption/

本包建议的音乐风格、音量、时长、位率是项目参数，并非 TapTap 官方硬性限定；应通过真机测试调整。
