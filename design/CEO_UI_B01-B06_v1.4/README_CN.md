# CEO UI MVP — B01-B06 V1.4（跨平台无乱码版）

本压缩包是《我是CEO》第一阶段MVP的统一UI交付。**文件与目录名称全部改为ASCII英文**，避免Windows内置解压、7-Zip以及部分ZIP工具对中文文件名的不同编码处理。

## 打开顺序
1. 先打开 `ASSET_INDEX_CN.md`：中文分类及全部33项UI编号映射。
2. 再打开 `SCREEN_INDEX.csv`：根据UI编号找到正式PNG、SVG、规格、状态矩阵。
3. 需要查找图片时，打开 `ASSET_MANIFEST.csv`：208份PNG/SVG逐文件清单。
4. 如需追溯旧名称，打开 `RENAME_MAPPING.csv`。

## 正式交付内容
- B01_Onboarding：启动/创建公司/CEO/首次招聘及引导，共7项；UI-01还提供4个启动状态变体。
- B02_CoreBusiness：4个导航页与2个引导，共6项。
- B03_StaffDepartments：员工、部门、录用、裁员、经营策略等，共9项。
- B04_FinanceRisk：财务报告、离线结算、危机、救助等，共8项。
- B05_SettingsRecovery：设置、关闭公司、异常恢复，共3项。
- B06_SharedAssets：7组通用素材，共67项，每项PNG + SVG。

## 使用注意
- 正式开发基线以 `B01_...` 至 `B05_.../Screens/` 画面为准，不使用 `Archive_ReferenceOnly/` 中的旧稿。
- 所有页面中的公司名、数字、员工姓名、按钮文字均应在Cocos中动态绘制，不能直接把整屏PNG当成交互页面。
- SVG是否为原生矢量以清单中的 `SVG_Construction` 列为准。正式页面已按原生布局SVG提供。
- 此次调整仅涉及路径、命名、文件清单和说明，**没有重新绘制UI或宣称完成TapTap真机验收**。
- 对页面细节与交互验收，以 `Specs/`、项目V1.0开发文档和AGENT.md为准。
