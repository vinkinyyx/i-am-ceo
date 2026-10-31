# 《我是CEO》B01-B06 素材资产清单 V1.4

**所有目录名与文件名均使用ASCII英文、数字、下划线和连字符，避免不同ZIP解压软件的中文文件名编码问题。**

## 资源统计

| 分类 | 设计项 | PNG | SVG |
|---|---:|---:|---:|
| B01_Onboarding — 启动与创业 | 7 | 11 | 11 |
| B02_CoreBusiness — 核心经营 | 6 | 6 | 6 |
| B03_StaffDepartments — 人才与部门 | 9 | 9 | 9 |
| B04_FinanceRisk — 经营财务与风险 | 8 | 8 | 8 |
| B05_SettingsRecovery — 设置与恢复 | 3 | 3 | 3 |
| B06_SharedAssets — 通用素材 | 67 | 67 | 67 |
**正式画面33项，附启动页4个状态变体；共页面PNG 37、页面SVG 37、共享PNG 67、共享SVG 67。合计208份正式图像文件。**

## B06分类

| 文件夹 | 名称 | PNG/SVG各有 |
|---|---|---:|
| `B06_SharedAssets/EmployeeAvatars` | 人物头像 | 24 |
| `B06_SharedAssets/IndustryIcons` | 行业图标 | 3 |
| `B06_SharedAssets/DepartmentIcons` | 部门图标 | 6 |
| `B06_SharedAssets/BottomNavigation` | 底部导航 | 10 |
| `B06_SharedAssets/FinanceAndStatusIcons` | 财务状态 | 12 |
| `B06_SharedAssets/TimeControlIcons` | 时间操作 | 5 |
| `B06_SharedAssets/UIComponents` | 交互组件 | 7 |

## 正式页面编号对应关系

| UI 编号 | 批次 | 中文名称 | 英文文件标识 |
|---|---|---|---|
| UI-01 | B01_Onboarding | 游戏启动页 | UI-01_Launch |
| UI-02 | B01_Onboarding | 创建公司 | UI-02_CreateCompany |
| UI-03 | B01_Onboarding | 创建CEO | UI-03_CreateCEO |
| UI-04 | B01_Onboarding | 首次招聘 | UI-04_FirstHire |
| UI-05 | B02_CoreBusiness | 公司经营首页 | UI-05_CompanyDashboard |
| UI-06 | B02_CoreBusiness | 部门管理首页 | UI-06_DepartmentList |
| UI-07 | B02_CoreBusiness | 人才管理首页 | UI-07_StaffList |
| UI-08 | B02_CoreBusiness | 企业排行榜 | UI-08_Leaderboard |
| UI-09 | B04_FinanceRisk | 年度财务报告 | UI-09_AnnualReport |
| UI-10 | B03_StaffDepartments | 员工详情 | UI-10_EmployeeDetail |
| UI-11 | B03_StaffDepartments | 部门详情 | UI-11_DepartmentDetail |
| UI-12 | B05_SettingsRecovery | 游戏设置 | UI-12_Settings |
| UI-13 | B05_SettingsRecovery | 关闭公司确认 | UI-13_CloseCompany |
| UI-14 | B04_FinanceRisk | 离线经营报告 | UI-14_OfflineReport |
| UI-15 | B04_FinanceRisk | 经营危机 | UI-15_CashCrisis |
| UI-16 | B03_StaffDepartments | 普通招聘界面 | UI-16_Recruitment |
| UI-17 | B03_StaffDepartments | 录用确认 | UI-17_HiringConfirm |
| UI-18 | B03_StaffDepartments | 裁员赔偿确认 | UI-18_LayoffConfirm |
| UI-19 | B03_StaffDepartments | 创建部门确认 | UI-19_CreateDepartment |
| UI-20 | B03_StaffDepartments | 主营业务扩张 | UI-20_BusinessExpansion |
| UI-21 | B03_StaffDepartments | 经营策略选择 | UI-21_BusinessStrategy |
| UI-22 | B03_StaffDepartments | 部门人员配置 | UI-22_StaffAllocation |
| UI-23 | B04_FinanceRisk | 财务指标说明 | UI-23_FinanceHelp |
| UI-24 | B04_FinanceRisk | 排行榜规则说明 | UI-24_LeaderboardRules |
| UI-25 | B04_FinanceRisk | 连续盈利达成 | UI-25_ProfitMilestone |
| UI-26 | B04_FinanceRisk | 经营救助确认 | UI-26_RecoveryGrant |
| UI-27 | B05_SettingsRecovery | 异常与恢复提示 | UI-27_SaveError |
| UI-28 | B01_Onboarding | 创建公司引导 | UI-28_GuideCreateCompany |
| UI-29 | B01_Onboarding | CEO设定引导 | UI-29_GuideCEO |
| UI-30 | B01_Onboarding | 首次招聘引导 | UI-30_GuideHire |
| UI-31 | B02_CoreBusiness | 经营数据引导 | UI-31_GuideMetrics |
| UI-32 | B02_CoreBusiness | 时间控制引导 | UI-32_GuideTime |
| UI-33 | B04_FinanceRisk | 年度结算引导 | UI-33_GuideAnnualReport |

## 目录说明

- `Screens/`：正式UI画面PNG与SVG，每个编号成对。
- `Specs/`：逐页中文功能规格、状态矩阵。
- `B06_SharedAssets/`：可复用的人物头像、图标和基础组件。
- `Documentation/Previews/`：分类浏览图，不建议在游戏内直接使用。
- `Archive_ReferenceOnly/`：与正式规范不一致的旧概念图，只作历史参考。
- `ASSET_MANIFEST.csv`：逐份图像资产记录，含相对路径、格式、尺寸、文件大小、SHA256和SVG类型。
- `RENAME_MAPPING.csv`：旧中文路径与新英文路径的一对一对照。
- `SCREEN_INDEX.csv`：33项UI画面的开发查找入口。

CSV 文件统一使用 UTF-8 BOM，适合 Windows Excel 直接打开。中文Markdown使用 UTF-8。
