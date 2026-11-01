# Agent 音频开发交接规程

1. 先读 `README_CN.md`、`Specs/01_Audio_Asset_List.md`、`Config/audio_manifest.json`；仅按 manifest 的16项工作，不得擅加第二阶段功能。
2. 音乐制作 Agent：先交2首BGM的可循环试听样，再交3段JNG，最后11段SFX；音色必须统一；每项保留来源/授权证据。
3. 资源处理 Agent：导出WAV源母版和小体积MP3，按英文文件名放入 `CocosDropIn/assets/resources/audio` 对应目录，更新 JSON `status=produced` 后重新核对数量。
4. Cocos开发 Agent：实现单一AudioManager，数据驱动事件播放，设置持久化、切后台处理、首次手势解锁、并发节流，进行TapTap真机测试。
5. QA Agent：逐项执行 `Specs/04_Audio_QA.md`，保存每条测试结果与设备环境；未通过不得宣称音频“完成”。
6. 所有外部素材不得省略许可证明；一首音乐再授权分发、用于游戏及宣传片的范围需要有对应授权。
7. 禁止用“没有声音导致按钮不可操作”的实现方式；音频必须是可选增强，不是经营逻辑依赖。

## 默认验收证据

- `audio_asset_qa.json`: 文件校验、编码、时长、大小、loop接缝检查结果；
- `audio_rights_register.json`: 作者、来源、许可、证明文件、商用/再分发权限；
- `AQA_results.md`: 17项实际测试记录及设备/软件版本；
- 真实游戏内前台/后台与设置切换的验证录屏。


## V1.1追加的实现约束

- 开发UI-12时，优先接入 `masterEnabled` 总开关，其余 `musicEnabled` 和 `effectsEnabled` 为分项偏好；三者都须持久化。
- `BGM` 由 `musicEnabled` 控制；`JNG` 与 `SFX` 由 `effectsEnabled` 控制；总开关一票否决。
- 不仅阻止新声音，必须对已播放的所有声音立即生效。
- 音频关闭不能影响招聘、部门、经营结算、存档等业务。
- 先按 `UI_PATCH/UI-12_Settings_AudioSwitch.md` 交接给 UI Agent，再由 AudioManager Agent 接入事件。
