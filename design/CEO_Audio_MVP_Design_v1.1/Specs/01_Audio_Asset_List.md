# 01｜第一阶段音频资产需求清单

## 工作量汇总

| 类型 | 数量 | 用途 |
|---|---:|---|
| 循环背景音乐 BGM | 2 | 创业流程、常态经营 |
| 短乐 JNG | 3 | 年度盈利、年度亏损、连续盈利目标 |
| 操作音效 SFX | 11 | 点击、选择、招聘、部门、风险等 |
| **合计** | **16** | **不含宣传片现有音轨** |

## 资产详细清单

| ID | 中文名称 | 文件名 | 推荐时长 | 页面/事件 | 优先级 |
|---|---|---|---:|---|---|
| BGM_01 | 创业启程 | `BGM_01_StartupLoop.mp3` | 60秒 | startup | P0 |
| BGM_02 | 日常经营 | `BGM_02_OfficeLoop.mp3` | 96秒 | operation | P0 |
| JNG_01 | 年度盈利 | `JNG_01_YearProfit.mp3` | 2.5秒 | annual_profit | P0 |
| JNG_02 | 年度亏损 | `JNG_02_YearLoss.mp3` | 2.5秒 | annual_loss | P0 |
| JNG_03 | 连续盈利里程碑 | `JNG_03_ThreeYearGoal.mp3` | 4.0秒 | three_year_goal | P0 |
| SFX_01 | 通用按钮点击 | `SFX_01_UITap.mp3` | 0.12秒 | ui.tap | P0 |
| SFX_02 | 卡片选择 | `SFX_02_Select.mp3` | 0.2秒 | ui.select | P0 |
| SFX_03 | 操作确认 | `SFX_03_Confirm.mp3` | 0.3秒 | ui.confirm | P0 |
| SFX_04 | 返回与取消 | `SFX_04_Back.mp3` | 0.18秒 | ui.back | P0 |
| SFX_05 | 非法操作 | `SFX_05_Invalid.mp3` | 0.27秒 | ui.invalid | P0 |
| SFX_06 | 随机公司名称 | `SFX_06_RerollName.mp3` | 0.4秒 | company.reroll_name | P0 |
| SFX_07 | 招聘成功 | `SFX_07_Recruit.mp3` | 0.75秒 | employee.recruited | P0 |
| SFX_08 | 创建部门 | `SFX_08_CreateDepartment.mp3` | 0.85秒 | department.created | P0 |
| SFX_09 | 裁员完成 | `SFX_09_Layoff.mp3` | 0.45秒 | employee.laid_off | P0 |
| SFX_10 | 速度切换 | `SFX_10_SpeedChange.mp3` | 0.3秒 | time.speed_changed | P0 |
| SFX_11 | 现金安全警告 | `SFX_11_CashWarning.mp3` | 0.65秒 | finance.cash_crisis_opened | P0 |

## 为什么只要16项

1. B01创建公司/CEO/首次招聘共享一首创业BGM。
2. B02—B05的日常经营、部门、员工、排行榜和财务界面共享一首长循环BGM。
3. 成功/亏损/成就各用极短乐句，避免因频繁结算不断换背景曲。
4. 11个通用音效覆盖全部必要交互；未指定操作原则上复用，不单独制作新文件。

## 各资产制作描述与精确触发

### BGM_01｜创业启程
- 位置：`assets/resources/audio/bgm/BGM_01_StartupLoop.mp3`
- 气质：清新、期待、轻快；钢琴+马林巴+轻木吉他+克制鼓点；无歌声
- 用途：`startup`；相关UI：UI-01, UI-02, UI-03, UI-04, UI-28, UI-29, UI-30
- 建议时长：60秒；循环：是；建议分组基准音量：0.25
- 备注：无缝循环；主旋律不超过2轨；第一下手指点击后才启动；启动页默认不自动播放
- 当前状态：待制作（planned_not_produced）

### BGM_02｜日常经营
- 位置：`assets/resources/audio/bgm/BGM_02_OfficeLoop.mp3`
- 气质：温和积极、有稳定节奏；软电钢琴+拨弦+轻电子节奏；避免高频持续提示感
- 用途：`operation`；相关UI：UI-05, UI-06, UI-07, UI-08, UI-09, UI-10, UI-11, UI-12, UI-14, UI-15
- 建议时长：96秒；循环：是；建议分组基准音量：0.22
- 备注：全经营模块共用，打开子页面不中断重启；年度报告可按比例压低BGM
- 当前状态：待制作（planned_not_produced）

### JNG_01｜年度盈利
- 位置：`assets/resources/audio/jingles/JNG_01_YearProfit.mp3`
- 气质：短促明亮四音动机，钟琴/钢琴，精致不浮夸
- 用途：`annual_profit`；相关UI：UI-09
- 建议时长：2.5秒；循环：否；建议分组基准音量：0.6
- 备注：仅当玩家主动看到一次新年度盈利报告播放；离线多年度批量结算只播最后一次合并反馈
- 当前状态：待制作（planned_not_produced）

### JNG_02｜年度亏损
- 位置：`assets/resources/audio/jingles/JNG_02_YearLoss.mp3`
- 气质：克制低音下行，轻提示；不恐怖、不尖锐
- 用途：`annual_loss`；相关UI：UI-09, UI-15
- 建议时长：2.5秒；循环：否；建议分组基准音量：0.5
- 备注：连续查看同一报告不重复播放；不能将亏损误表现为立刻破产
- 当前状态：待制作（planned_not_produced）

### JNG_03｜连续盈利里程碑
- 位置：`assets/resources/audio/jingles/JNG_03_ThreeYearGoal.mp3`
- 气质：短庆祝音型+轻打击，现代企业成就感，非赌场式中奖
- 用途：`three_year_goal`；相关UI：UI-25
- 建议时长：4.0秒；循环：否；建议分组基准音量：0.65
- 备注：每轮公司存档只首次触发一次，关闭公司重置后下一轮允许再次触发
- 当前状态：待制作（planned_not_produced）

### SFX_01｜通用按钮点击
- 位置：`assets/resources/audio/sfx/SFX_01_UITap.mp3`
- 气质：柔软木质轻点击，无刺耳脉冲
- 用途：`ui.tap`；相关UI：ALL
- 建议时长：0.12秒；循环：否；建议分组基准音量：0.45
- 备注：全局最小触发间隔120ms
- 当前状态：待制作（planned_not_produced）

### SFX_02｜卡片选择
- 位置：`assets/resources/audio/sfx/SFX_02_Select.mp3`
- 气质：向上的细小双音，强调选择成功
- 用途：`ui.select`；相关UI：UI-02, UI-03, UI-04, UI-16, UI-21, UI-22
- 建议时长：0.2秒；循环：否；建议分组基准音量：0.5
- 备注：只有选择状态真实改变才播放
- 当前状态：待制作（planned_not_produced）

### SFX_03｜操作确认
- 位置：`assets/resources/audio/sfx/SFX_03_Confirm.mp3`
- 气质：短三角音/两音确认，轻快清楚
- 用途：`ui.confirm`；相关UI：UI-17, UI-19, UI-20, UI-26
- 建议时长：0.3秒；循环：否；建议分组基准音量：0.55
- 备注：需成功处理业务命令后触发；失败使用Invalid
- 当前状态：待制作（planned_not_produced）

### SFX_04｜返回与取消
- 位置：`assets/resources/audio/sfx/SFX_04_Back.mp3`
- 气质：短下行轻音，低存在感
- 用途：`ui.back`；相关UI：ALL
- 建议时长：0.18秒；循环：否；建议分组基准音量：0.42
- 备注：普通返回，不覆盖警告弹窗
- 当前状态：待制作（planned_not_produced）

### SFX_05｜非法操作
- 位置：`assets/resources/audio/sfx/SFX_05_Invalid.mp3`
- 气质：柔和拒绝提示音，不使用尖叫警报
- 用途：`ui.invalid`；相关UI：UI-02, UI-17, UI-18, UI-19, UI-27
- 建议时长：0.27秒；循环：否；建议分组基准音量：0.5
- 备注：与可见错误提示同时触发，不能仅靠声音反馈
- 当前状态：待制作（planned_not_produced）

### SFX_06｜随机公司名称
- 位置：`assets/resources/audio/sfx/SFX_06_RerollName.mp3`
- 气质：翻卡/纸片拨动+轻电子粒子感
- 用途：`company.reroll_name`；相关UI：UI-02
- 建议时长：0.4秒；循环：否；建议分组基准音量：0.5
- 备注：公司名刷新完成时播放；快速多次点击要节流
- 当前状态：待制作（planned_not_produced）

### SFX_07｜招聘成功
- 位置：`assets/resources/audio/sfx/SFX_07_Recruit.mp3`
- 气质：轻上行成功音、短，表现新成员加入
- 用途：`employee.recruited`；相关UI：UI-04, UI-17
- 建议时长：0.75秒；循环：否；建议分组基准音量：0.6
- 备注：只在实际扣费、员工加入并保存成功时播放；自动招聘和离线批次不逐人播放
- 当前状态：待制作（planned_not_produced）

### SFX_08｜创建部门
- 位置：`assets/resources/audio/sfx/SFX_08_CreateDepartment.mp3`
- 气质：轻巧搭建、卡片落位、音阶收尾
- 用途：`department.created`；相关UI：UI-06, UI-19
- 建议时长：0.85秒；循环：否；建议分组基准音量：0.6
- 备注：确认并成功创建后播放，未来升级可复用
- 当前状态：待制作（planned_not_produced）

### SFX_09｜裁员完成
- 位置：`assets/resources/audio/sfx/SFX_09_Layoff.mp3`
- 气质：中性短下降音，避免欢快奖励感
- 用途：`employee.laid_off`；相关UI：UI-18
- 建议时长：0.45秒；循环：否；建议分组基准音量：0.38
- 备注：赔偿正确结算后播放；不暗示裁员是正向奖励
- 当前状态：待制作（planned_not_produced）

### SFX_10｜速度切换
- 位置：`assets/resources/audio/sfx/SFX_10_SpeedChange.mp3`
- 气质：小机械调档声，无持续转速音
- 用途：`time.speed_changed`；相关UI：UI-05, UI-32
- 建议时长：0.3秒；循环：否；建议分组基准音量：0.42
- 备注：1x/2x/5x同一音效；BGM播放速度永不跟随经营加速
- 当前状态：待制作（planned_not_produced）

### SFX_11｜现金安全警告
- 位置：`assets/resources/audio/sfx/SFX_11_CashWarning.mp3`
- 气质：低频双音警示，明显但不惊吓
- 用途：`finance.cash_crisis_opened`；相关UI：UI-15
- 建议时长：0.65秒；循环：否；建议分组基准音量：0.48
- 备注：仅进入危机画面时单次播放；后台挂机和重复弹窗不反复响
- 当前状态：待制作（planned_not_produced）

