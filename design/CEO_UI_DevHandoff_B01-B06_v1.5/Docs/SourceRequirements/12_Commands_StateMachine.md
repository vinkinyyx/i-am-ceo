# 12｜业务命令详细契约、状态机与接口异常

> 用途：任意Agent可以按本文件实现一条命令而不自行解释业务状态。所有修改命令必须在**串行GameMutationLock + 验证runId + 成功持久化**的共同包装下执行。文中均为本项目**内部TS接口**，不是TapTap平台的公开HTTP接口。

## 12.1 公共命令包装

```ts
type CommandBase = {
  commandId: string;          // 由调用方生成；一次点击唯一，重试时复用
  expectedRunId: string;      // 当期runId；创建新run时使用当前草稿id或特殊前置token
  expectedRevision?: number;  // 乐观并发保护
};
type CommandResult<T> =
  | {ok: true; revision: number; runId: string; payload: T}
  | {ok: false; code: GameErrorCode; displayMessage: string; details?: Record<string,unknown>};
```

所有“预览”接口只能读状态，不可修改现金或抛弃Offer。所有涉及现金的确认操作必须二次校验，不依赖前端UI“已灰掉”判断。所有Money均元整数，`commandId`不得复用到另一动作。`RUN_CHANGED`优先于金钱校验，避免旧run仍然支付资金。

## 12.2 指令索引与不变量

| 命令 | 必要参数（除公共项） | 允许的阶段 | 成功结果 | 关键失败 |
|---|---|---|---|---|
| `createCompany` | `companyName,industry,ceoName,ceoTrait` | CREATING | 公司、CEO、初始现金30万；主营部；阶段HIRING_INITIAL | INVALID_NAME,INVALID_INDUSTRY,RUN_CHANGED |
| `rollCompanyNames` | `industry,count=3` | CREATING | 3个安全候选名称 | INVALID_INDUSTRY |
| `getOffer` | `departmentId` | HIRING_INITIAL/RUNNING | 稳定3人Offer | DEPT_NOT_FOUND, NOT_READY |
| `refreshOffer` | `departmentId` | HIRING_INITIAL/RUNNING | 新Offer，原Offer失效 | NOT_READY |
| `hireEmployee` | `offerId,candidateId,departmentId` | HIRING_INITIAL/RUNNING | Employee、费用分录 | OFFER_EXPIRED,INSUFFICIENT_CASH |
| `getSeverancePreview` | `employeeId` | RUNNING/DISTRESS | 数额/产能影响、确认token | EMPLOYEE_NOT_FOUND |
| `dismissEmployee` | `employeeId,confirmationToken` | RUNNING/DISTRESS | PENDING_DISMISSAL、赔偿分录 | CONFIRMATION_EXPIRED,INSUFFICIENT_CASH |
| `createDepartment` | `supportType` | RUNNING | 新部门(0员工)、设立费分录 | DEPT_ALREADY_EXISTS,INSUFFICIENT_CASH |
| `setDepartmentMode` | `deptId,mode,targetCount` | RUNNING/DISTRESS | 部门设置已存档 | DEPT_NOT_FOUND,INVALID_TARGET |
| `transferEmployee` | `employeeId,targetDeptId` | RUNNING | 下月调岗计划 | DEPT_NOT_FOUND,EMPLOYEE_NOT_FOUND |
| `setPolicy` | `STEADY/GROWTH/PROFIT` | RUNNING/DISTRESS | 策略新值 | INVALID_POLICY |
| `investInBusiness` | `amountYuan(10000整数倍)` | RUNNING | 现金减少/业务资产增加/产能加成 | INSUFFICIENT_CASH,INVALID_AMOUNT |
| `setSpeed` | `0/1/2/5` | RUNNING/DISTRESS | 时间控制保存 | INVALID_SPEED |
| `advanceOneMonth` | `expectedMonthKey,source` | RUNNING/DISTRESS | Ledger/最新State | MONTH_ALREADY_SETTLED,INSUFFICIENT_CASH |
| `settleOffline` | `nowEpochMs` | RUNNING | OfflineSummary | RESET_IN_PROGRESS,SAVE_FAILED |
| `grantRescueCapital` | `confirmationToken` | DISTRESS/WARNING | 现金和实收资本增加10万 | ALREADY_USED,CONFIRMATION_EXPIRED |
| `closeCompanyPreview` | 无 | 任意已建公司阶段 | Token和清除清单 | NOT_READY |
| `confirmCloseCompany` | `confirmationToken` | 任意已建公司阶段 | 新run处于CREATING | CONFIRMATION_EXPIRED,RUN_CHANGED |

`rollCompanyNames`和`getOffer`可能涉及可持久化的RNG序列/offer计数，因此虽然不直接变资金，也应保证重启可复现；可以作为写入命令处理并用明确的幂等键。纯财务预览绝不可生成新候选来改变RNG。

## 12.3 createCompany的完整前后条件

**前置**：当前无已创建公司；行业属于三枚举；公司名/CEO名有效；性格属于三枚举；没有重置未完成的墓碑；没有另一并发创建命令已提交。

**执行**：创建`companyId`、初始部门`BUSINESS`、CEO属性全50、run独立市场RNG；一次性注入30万元到`cashYuan`和`paidInCapitalYuan`，`initializedCapital=true`；`gameYear=1,gameMonth=1`，`phase=HIRING_INITIAL`，`speed=0`，年报空、部门只有主营；自动经营在首聘2人完成前不启动。

**幂等**：同一`commandId`重试返回已创建公司；在同run换个commandId重复执行应返回`NOT_READY`，不得再注资。

**非法状态**：关闭公司后旧run的createCompany迟到→`RUN_CHANGED`，不能把旧姓名覆盖新公司。

## 12.4 招聘/裁员：时点与金额

初聘流程：`getOffer → hire1 → getNewOffer → hire2 → tutorialDashboard`。每次招聘在确认瞬间扣`cashYuan`并在`pendingEntries`插入唯一`JournalEntry`，同时增加`executedCommandIds`；初聘两人从游戏第1月起计工资，不必等第2月。

运营期招聘：点击确认月序Index=i，员工`effectiveFromMonthIndex=i+1`；招聘费属于i所在经营年度，**如果i恰好等于12月且确认时月结尚未进行，属于第12月；如果已经年结则属于新年第1月**。

裁员：生成预览token时绑定`runId/employeeId/salary/tenure/amount/revision`，有效期60秒；确认在同锁下重新算一次费用并验证token，补偿立刻从现金扣、员工下个经营月停止工资与产能，防止重试重复扣费。不存在“裁员取消可退赔偿”操作。自动经营没有调用dismiss权限。

## 12.5 设部门/人员锁定/业务投资

- 设部成功后只有空部门，一次性扣¥10,000；不能重复建同类型。没有可无损“撤销建部”的后门。
- 切换模式AUTO时校验预算；切回LOCKED不会自动裁员；目标人数是**计划值**，不等于立即增加员工，需说明实际人数差异。
- 业务扩张以¥10,000整数倍，确认前预览对产能增加/需求缺口/现金安全的影响；确认后`cash -= amount; businessAssetBook += amount; businessCapacityInvestment += amount`。成功后本月利润不应因该笔资本支出下降。

## 12.6 年结/救助/重开的状态变化

```text
RUNNING --(12个月结算完毕)--> RUNNING(nextYear)
RUNNING --(预计刚性费用无法覆盖)--> WARNING(业务状态，phase仍RUNNING)
RUNNING --(必要费用确实无法支付)--> DISTRESS(暂停新月份结算)
DISTRESS --(追加资本或调整后可支付)--> RUNNING
RUNNING --(连续3年利润>0)--> RUNNING + target3YearsAchieved
任意已建公司阶段 --(双确认关公司)--> RESETTING --> CREATING(new run)
```

一次救助仅`rescueCapitalUsed=false`可执行，其他条件无效；成功后现金和实收资本各增加100,000，营业收入/利润各增加0。主动关闭公司可在经营正常、亏损、困难时进行；外部平台账号登录状态不变。

## 12.7 自动招聘的特殊幂等

自动招聘按`autoHire/<runId>/<year>/<month>/<deptType>`生成命令ID；若某次尝试没有产生实际雇用（未达经济阈值、资金不足），**不要把失败ID写成成功事务**。若月结失败重试，在同一月生成相同Offer，并且已成功招聘的同一个ID不能重复录用。每月总共最多1次成功自动聘用；若多个部门同时满足需要，由候选ROI降序选择一个。

## 12.8 反向查询（只读接口）

| 只读方法 | 输出 | 排序/过滤约束 |
|---|---|---|
| `getDashboard` | 公司/年份/月进度/现金/预计利润/风险/建议 | 不能暴露平台session_key |
| `getDepartmentCards` | 部门类型、人数、费用、贡献、建部可用状态 | 主营部在第一位 |
| `getEmployees(deptId?)` | 可滚动员工摘要 | 默认聘用时间逆序，稳定ID二次排序 |
| `getCandidateOffer(deptId)` | 三候选卡 | 按生成顺序，刷新前ID稳定 |
| `getAnnualReports` | 年份、利润、现金、资产趋势 | 最新在前；详细月账受24个月限制 |
| `getRanking(type)` | bot和用户排位、资产/年限 | 数值降序，平手botId/companyId稳定排序 |
| `getRiskAdvice` | 最多1条可解释建议 | 优先级详见06 |
| `getStorageHealth` | 最近成功保存版本、大小、错误状态 | 不能泄露存档全量到日志 |

## 12.9 端到端执行示例：首年贸易标准档

```text
createCompany(TRADE, CEO default) -> Cash=300000
hire first 5000/month -> Cash=295000; pendingRecruitmentExpense=5000
hire second 5000/month -> Cash=290000; pendingRecruitmentExpense=10000
start clock -> first month (¥60000收入; ¥36000直接; ¥4800其他营运;
  ¥1200售后; ¥4000固定; ¥10000工资; 一次已支付¥10000招聘费)
month1 operating cash received net +4000; Cash=294000
month1 ledger cashDelta = +4000 - 10000 = -6000;
month1 profit = +4000 - 10000 = -6000
months2-12 each profit+4000 and cashDelta+4000
annual report Revenue=720000, Profit=38000, CashOpen=300000, CashClose=338000
```

这里的**关键区别**：第1月月账`cashDelta=-6000`已经包含首聘时现金支付的-10000，但运行时从月结开始只需把**尚未支付**的经营净收现+4000加到当前现金290000。若再次应用-10000，就会错误变成328000。任何实现必须明确`ledger.cashDelta`和`newUnpaidCashDelta`的不同。

## 12.10 内部错误到界面文案映射

- `INSUFFICIENT_CASH`→“当前现金不足，还需要 ¥{gap}。”
- `OFFER_EXPIRED`→“候选人信息已经更新，请重新选择。”
- `MONTH_ALREADY_SETTLED`→后台幂等返回旧结果，UI不弹“领取两次”。
- `RESET_IN_PROGRESS`→“正在关闭旧公司，暂不能执行其他操作。”
- `SAVE_FAILED`→“保存失败，本次操作未确认保存，请重试。”
- `RUN_CHANGED`→“公司已重新创建，旧操作已取消。”
- `CONFIRMATION_EXPIRED`→“确认已失效，请重新查看费用后确认。”

失败不得执行半笔钱、半次裁员；UI不能吞掉错误或只打印日志。
