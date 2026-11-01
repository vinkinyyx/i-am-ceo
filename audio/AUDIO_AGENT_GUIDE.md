# 《我是CEO》音频开发Agent交接

## 交接基线

- 以本包中的16个真实MP3为P0音频资产；WAV母版仅用于后续编辑或循环故障回退。
- `Config/audio_manifest.json`为唯一资产ID—路径—播放事件映射。`Config/audio_event_map.json`为事件分发规则，禁止在多个UI点击回调重复播放同一SFX。
- `Config/audio_settings.json`保存独立音乐、音效开关和总开关逻辑。先读取设置再启动BGM。

## 具体接入顺序

1. 将 `CocosDropIn/assets/resources/audio/` 拷贝到游戏工程的 `assets/resources/audio/`。
2. 实现单例`AudioManager`，区分音乐 `BGM` 和音效 `JNG/SFX` 总线、音量、加载缓存、首次触摸解锁。
3. BGM只保留一条逻辑活跃轨；跨业务页面保持BGM_02持续播放，不叠加。
4. 招聘、创建部门、裁员需在业务数据已成功扣费/保存后播放对应成功提示。非法操作用SFX_05。
5. 关闭公司确认后停止所有音频，重置本轮音频偏好（遵照原V1.1要求）；重进公司创建后重启创业BGM。
6. 验收：关闭全部声音立即停止BGM/JNG/SFX；重新开启不补播被抑制的事件；1×/2×/5×不能影响配乐速度；离线多年度不会连响多次结算提示。

## 音频质量验收

- 所有MP3能通过Cocos AudioClip及TapTap目标机加载。
- 检查机型无爆音、无明显音量跳变、短SFX不因MP3编码延迟被截断。
- 两首BGM连续播放3遍，重点关注循环接缝；如有MP3边缘空隙，参考母版处理。
- 记录不同手机的音量问题与系统媒体音量测试证据。
- `QA_REPORT.csv`是文件技术检查，不等于真机完成验收。
