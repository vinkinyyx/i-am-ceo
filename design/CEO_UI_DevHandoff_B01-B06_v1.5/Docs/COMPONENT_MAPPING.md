# 原生UI组件与素材映射

| Cocos Prefab（建议创建） | 主要使用页面 | 推荐来源 | 数据绑定 / 操作 |
|---|---|---|---|
| PrimaryBottomTabs | UI-05~08 | B06/navigation | 仅T01-T04，4Tab；设置不在此列 |
| CompanyMetricCard | UI-05/09/31 | B06/status + 原生卡片 | 标题、金额、趋势、说明 |
| EmployeeOfferCard | UI-04/16/30 | B06/avatars | 候选名、专业能力、成长潜力、性格、工资、招聘费 |
| EmployeeListItem | UI-07/10 | B06/avatars | 聘用年月、岗位、薪水、所属部门 |
| DepartmentCard | UI-06/11 | B06/departments | 人数、投入、收益、创建状态 |
| AnnualProfitTable | UI-09/14 | 原生Layout/ScrollView | 年度收入、成本、利润、现金变化 |
| SimpleConfirmDialog | UI-17/19/26 | B06/components | 金额、余额、确认/取消 |
| DangerConfirmDialog | UI-13/18 | B06/components | 红色危险确认、token校验 |
| TutorialSpotlight | UI-28~33 | Cocos Mask / 原生遮罩 | 高亮真实锚点、支持跳过说明 |
| GameClockControls | UI-05/32 | B06/time | 暂停、1×、2×、5× |
| RankingRow | UI-08 | 原生节点 + B06/status | 名次、公司名、年限/资产，模拟企业标签 |

**所有Prefab需Agent在现有Cocos工程里创建**；本资源包没有可导入的prefab、scene、脚本实现、事件监听器。
