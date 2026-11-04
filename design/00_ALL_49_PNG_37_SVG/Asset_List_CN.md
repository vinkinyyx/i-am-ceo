# 《我是CEO》全屏素材 9:20 重制清单 V2.0

**统一交付尺寸：1080 × 2400 像素；比例严格9:20；格式PNG。正式UI同时提供SVG编辑源。**

## 一、处理口径

- 正式UI 37张：源尺寸750×1624，约为9.24:20，并非9:20。按照原始SVG重新安排上下安全边距，并重新渲染；没有把全部UI直接压扁或裁掉。
- 历史概念竖屏图10张：源尺寸有852×1845、941×1672、1024×1536等。保留文字、人物和控件，针对背景安全区补齐纵向空间。它们仅为概念参考，不应作为真实游戏界面贴图直接部署。
- 新版启动插画1张：新生成美术，导出1080×2400；其“78%”为示意内容，不是可用的游戏加载进度，实际游戏需动态绘制。
- UI通用背景1张：从现有浅蓝背景颜色基线重新制作无字版。

## 二、正式UI（37张，33个UI编号＋4张UI-01状态变体）

| UI | 用途 | 9:20图片 | 可编辑源 |
|---|---|---|---|
| UI-01 | 启动页 | `01_OfficialUI_PNG/B01_Onboarding/UI-01_Launch_9x20.png` | `02_OfficialUI_SVG/B01_Onboarding/UI-01_Launch_9x20.svg` |
| UI-01 | 启动页 — HasSave状态 | `01_OfficialUI_PNG/B01_Onboarding/UI-01_Launch_HasSave_9x20.png` | `02_OfficialUI_SVG/B01_Onboarding/UI-01_Launch_HasSave_9x20.svg` |
| UI-01 | 启动页 — Loading状态 | `01_OfficialUI_PNG/B01_Onboarding/UI-01_Launch_Loading_9x20.png` | `02_OfficialUI_SVG/B01_Onboarding/UI-01_Launch_Loading_9x20.svg` |
| UI-01 | 启动页 — NoSave状态 | `01_OfficialUI_PNG/B01_Onboarding/UI-01_Launch_NoSave_9x20.png` | `02_OfficialUI_SVG/B01_Onboarding/UI-01_Launch_NoSave_9x20.svg` |
| UI-01 | 启动页 — SaveRecovery状态 | `01_OfficialUI_PNG/B01_Onboarding/UI-01_Launch_SaveRecovery_9x20.png` | `02_OfficialUI_SVG/B01_Onboarding/UI-01_Launch_SaveRecovery_9x20.svg` |
| UI-02 | 创建公司 | `01_OfficialUI_PNG/B01_Onboarding/UI-02_CreateCompany_9x20.png` | `02_OfficialUI_SVG/B01_Onboarding/UI-02_CreateCompany_9x20.svg` |
| UI-03 | 创建CEO | `01_OfficialUI_PNG/B01_Onboarding/UI-03_CreateCEO_9x20.png` | `02_OfficialUI_SVG/B01_Onboarding/UI-03_CreateCEO_9x20.svg` |
| UI-04 | 首次招聘 | `01_OfficialUI_PNG/B01_Onboarding/UI-04_FirstHire_9x20.png` | `02_OfficialUI_SVG/B01_Onboarding/UI-04_FirstHire_9x20.svg` |
| UI-28 | 创建公司引导 | `01_OfficialUI_PNG/B01_Onboarding/UI-28_GuideCreateCompany_9x20.png` | `02_OfficialUI_SVG/B01_Onboarding/UI-28_GuideCreateCompany_9x20.svg` |
| UI-29 | CEO设定引导 | `01_OfficialUI_PNG/B01_Onboarding/UI-29_GuideCEO_9x20.png` | `02_OfficialUI_SVG/B01_Onboarding/UI-29_GuideCEO_9x20.svg` |
| UI-30 | 首次招聘引导 | `01_OfficialUI_PNG/B01_Onboarding/UI-30_GuideHire_9x20.png` | `02_OfficialUI_SVG/B01_Onboarding/UI-30_GuideHire_9x20.svg` |
| UI-05 | 公司经营首页 | `01_OfficialUI_PNG/B02_CoreBusiness/UI-05_CompanyDashboard_9x20.png` | `02_OfficialUI_SVG/B02_CoreBusiness/UI-05_CompanyDashboard_9x20.svg` |
| UI-06 | 部门列表 | `01_OfficialUI_PNG/B02_CoreBusiness/UI-06_DepartmentList_9x20.png` | `02_OfficialUI_SVG/B02_CoreBusiness/UI-06_DepartmentList_9x20.svg` |
| UI-07 | 人才列表 | `01_OfficialUI_PNG/B02_CoreBusiness/UI-07_StaffList_9x20.png` | `02_OfficialUI_SVG/B02_CoreBusiness/UI-07_StaffList_9x20.svg` |
| UI-08 | 企业排行榜 | `01_OfficialUI_PNG/B02_CoreBusiness/UI-08_Leaderboard_9x20.png` | `02_OfficialUI_SVG/B02_CoreBusiness/UI-08_Leaderboard_9x20.svg` |
| UI-31 | 财务数据引导 | `01_OfficialUI_PNG/B02_CoreBusiness/UI-31_GuideMetrics_9x20.png` | `02_OfficialUI_SVG/B02_CoreBusiness/UI-31_GuideMetrics_9x20.svg` |
| UI-32 | 时间控制引导 | `01_OfficialUI_PNG/B02_CoreBusiness/UI-32_GuideTime_9x20.png` | `02_OfficialUI_SVG/B02_CoreBusiness/UI-32_GuideTime_9x20.svg` |
| UI-10 | 员工详情 | `01_OfficialUI_PNG/B03_StaffDepartments/UI-10_EmployeeDetail_9x20.png` | `02_OfficialUI_SVG/B03_StaffDepartments/UI-10_EmployeeDetail_9x20.svg` |
| UI-11 | 部门详情 | `01_OfficialUI_PNG/B03_StaffDepartments/UI-11_DepartmentDetail_9x20.png` | `02_OfficialUI_SVG/B03_StaffDepartments/UI-11_DepartmentDetail_9x20.svg` |
| UI-16 | 日常招聘 | `01_OfficialUI_PNG/B03_StaffDepartments/UI-16_Recruitment_9x20.png` | `02_OfficialUI_SVG/B03_StaffDepartments/UI-16_Recruitment_9x20.svg` |
| UI-17 | 招聘确认 | `01_OfficialUI_PNG/B03_StaffDepartments/UI-17_HiringConfirm_9x20.png` | `02_OfficialUI_SVG/B03_StaffDepartments/UI-17_HiringConfirm_9x20.svg` |
| UI-18 | 裁员确认 | `01_OfficialUI_PNG/B03_StaffDepartments/UI-18_LayoffConfirm_9x20.png` | `02_OfficialUI_SVG/B03_StaffDepartments/UI-18_LayoffConfirm_9x20.svg` |
| UI-19 | 创建部门 | `01_OfficialUI_PNG/B03_StaffDepartments/UI-19_CreateDepartment_9x20.png` | `02_OfficialUI_SVG/B03_StaffDepartments/UI-19_CreateDepartment_9x20.svg` |
| UI-20 | 业务扩张 | `01_OfficialUI_PNG/B03_StaffDepartments/UI-20_BusinessExpansion_9x20.png` | `02_OfficialUI_SVG/B03_StaffDepartments/UI-20_BusinessExpansion_9x20.svg` |
| UI-21 | 业务策略 | `01_OfficialUI_PNG/B03_StaffDepartments/UI-21_BusinessStrategy_9x20.png` | `02_OfficialUI_SVG/B03_StaffDepartments/UI-21_BusinessStrategy_9x20.svg` |
| UI-22 | 员工配置 | `01_OfficialUI_PNG/B03_StaffDepartments/UI-22_StaffAllocation_9x20.png` | `02_OfficialUI_SVG/B03_StaffDepartments/UI-22_StaffAllocation_9x20.svg` |
| UI-09 | 年度经营报告 | `01_OfficialUI_PNG/B04_FinanceRisk/UI-09_AnnualReport_9x20.png` | `02_OfficialUI_SVG/B04_FinanceRisk/UI-09_AnnualReport_9x20.svg` |
| UI-14 | 离线收益报告 | `01_OfficialUI_PNG/B04_FinanceRisk/UI-14_OfflineReport_9x20.png` | `02_OfficialUI_SVG/B04_FinanceRisk/UI-14_OfflineReport_9x20.svg` |
| UI-15 | 现金危机 | `01_OfficialUI_PNG/B04_FinanceRisk/UI-15_CashCrisis_9x20.png` | `02_OfficialUI_SVG/B04_FinanceRisk/UI-15_CashCrisis_9x20.svg` |
| UI-23 | 财务指标说明 | `01_OfficialUI_PNG/B04_FinanceRisk/UI-23_FinanceHelp_9x20.png` | `02_OfficialUI_SVG/B04_FinanceRisk/UI-23_FinanceHelp_9x20.svg` |
| UI-24 | 排行榜规则 | `01_OfficialUI_PNG/B04_FinanceRisk/UI-24_LeaderboardRules_9x20.png` | `02_OfficialUI_SVG/B04_FinanceRisk/UI-24_LeaderboardRules_9x20.svg` |
| UI-25 | 盈利里程碑 | `01_OfficialUI_PNG/B04_FinanceRisk/UI-25_ProfitMilestone_9x20.png` | `02_OfficialUI_SVG/B04_FinanceRisk/UI-25_ProfitMilestone_9x20.svg` |
| UI-26 | 经营援助确认 | `01_OfficialUI_PNG/B04_FinanceRisk/UI-26_RecoveryGrant_9x20.png` | `02_OfficialUI_SVG/B04_FinanceRisk/UI-26_RecoveryGrant_9x20.svg` |
| UI-33 | 年度报告引导 | `01_OfficialUI_PNG/B04_FinanceRisk/UI-33_GuideAnnualReport_9x20.png` | `02_OfficialUI_SVG/B04_FinanceRisk/UI-33_GuideAnnualReport_9x20.svg` |
| UI-12 | 设置 | `01_OfficialUI_PNG/B05_SettingsRecovery/UI-12_Settings_9x20.png` | `02_OfficialUI_SVG/B05_SettingsRecovery/UI-12_Settings_9x20.svg` |
| UI-13 | 关闭公司 | `01_OfficialUI_PNG/B05_SettingsRecovery/UI-13_CloseCompany_9x20.png` | `02_OfficialUI_SVG/B05_SettingsRecovery/UI-13_CloseCompany_9x20.svg` |
| UI-27 | 存档异常恢复 | `01_OfficialUI_PNG/B05_SettingsRecovery/UI-27_SaveError_9x20.png` | `02_OfficialUI_SVG/B05_SettingsRecovery/UI-27_SaveError_9x20.svg` |

## 三、独立竖屏概念参考（10张）

| 序号 | 用途 | 原尺寸 | 新文件 |
|---|---|---|---|
| CONCEPT-01 | 创建CEO／进取型概念图 | 852x1845 | `03_ConceptReference_PNG/CEO_CreateCEO_Progressive_9x20.png` |
| CONCEPT-02 | CEO性格偏好引导概念图 | 852x1845 | `03_ConceptReference_PNG/CEO_Guide_CEO_Personality_9x20.png` |
| CONCEPT-03 | 年度经营报告概念图 | 941x1672 | `03_ConceptReference_PNG/CEO_AnnualReport_Concept_9x20.png` |
| CONCEPT-04 | 创建公司引导概念图 | 852x1845 | `03_ConceptReference_PNG/CEO_Guide_CreateCompany_9x20.png` |
| CONCEPT-05 | 公司经营首页概念图 | 941x1672 | `03_ConceptReference_PNG/CEO_Dashboard_Concept_9x20.png` |
| CONCEPT-06 | 创建公司界面概念图 | 852x1845 | `03_ConceptReference_PNG/CEO_CreateCompany_Concept_9x20.png` |
| CONCEPT-07 | 旧版启动Loading概念图 | 941x1672 | `03_ConceptReference_PNG/CEO_OldSplash_Loading_9x20.png` |
| CONCEPT-08 | 城市创业概念图 | 1024x1536 | `03_ConceptReference_PNG/CEO_CityStartup_Concept_9x20.png` |
| CONCEPT-09 | 首次招聘引导概念图 | 852x1845 | `03_ConceptReference_PNG/CEO_Guide_FirstHire_9x20.png` |
| CONCEPT-10 | 首次招聘界面概念图 | 941x1672 | `03_ConceptReference_PNG/CEO_FirstHire_Concept_9x20.png` |

## 四、启动美术与全屏纯背景

| 序号 | 用途 | 文件 |
|---|---|---|
| SPLASH-01 | 全新绘制启动插画（含示意加载进度，仅作视觉稿） | `04_SplashAndBackground_PNG/CEO_Splash_NewArtwork_9x20.png` |
| BG-01 | 游戏内UI通用浅蓝渐变底图（无文字、无控件） | `04_SplashAndBackground_PNG/CEO_BG_SoftBlue_UI_9x20.png` |

## 五、不需改成9:20的原有素材

- B06共享头像、行业图标、部门图标、导航图标和按钮组件：属于局部素材，保留各自的原始长宽比。
- TapTap游戏图标512×512、方形宣传图1440×1440、横版宣传图1920×1080、横版封面460×215：属于商店规范尺寸，不适用9:20。
- TapTap竖版封面600×900是2:3，不能冒充9:20的游戏运行画面；应保留平台要求的尺寸。
- 动态视频16:9/9:16不等于静态全屏UI，按视频平台格式分别处理。

## 六、开发注意

1. 游戏采用375×833.333... 逻辑画布（9:20）或等比例缩放；实际屏幕刘海、状态栏、手势导航仍需动态适配。
2. UI设计稿是布局参考，数字、公司名、员工信息、按钮均由Cocos动态渲染，不能将整屏PNG作为可点击页面。
3. 新启动美术中的文字和加载数字是设计预览，正式版本可替换为动态Logo、Loading进度和随机提示。
4. 概念图采用图像重排与背景延展，不代表原有游戏功能已经实现；应用内应优先使用正式UI SVG/PNG。
5. 产物已做尺寸、格式、文件解码、独立文件名、ZIP完整性检查；未进行TapTap真机效果验收。
