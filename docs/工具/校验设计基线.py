#!/usr/bin/env python3
"""Validate document pack's machine-readable config and arithmetic examples.
This checks design reference values, not the actual game engine's implementation.
Run: python 工具/校验设计基线.py
"""
from __future__ import annotations
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
D = ROOT / '配置与测试数据'
C = json.loads((D / 'economy.v1.json').read_text(encoding='utf-8'))
G = json.loads((D / 'golden-cases.v1.json').read_text(encoding='utf-8'))
S = json.loads((D / 'save.schema.json').read_text(encoding='utf-8'))
assert C['currency'] == 'CNY' and C['moneyStorage'] == 'integerYuan'
assert C['time']['offlineRealMsPerGameMonth'] * 12 == 8 * 3600 * 1000
assert C['time']['maxOfflineMonthsPerSession'] == 36
assert C['time']['maxEligibleOfflineMsPerSession'] == 24 * 3600 * 1000
assert len(C['industry']) == 3
assert len(C['departments']['effects']) == 5
assert len(C['departments']['staffMultiplierBps']) == 6
assert S['$schema'].endswith('2020-12/schema')

# Check that three standard year-1 examples are algebraically consistent with their industry config.
for case in G['cases']:
    if case['id'] in ('G001', 'G002', 'G003'):
        ind = C['industry'][case['industry']]
        x = case['expected']
        assert x['revenueYuan'] == ind['firstYearDemandYuan']
        assert x['directCostYuan'] == x['revenueYuan'] * ind['directCostBps'] // 10000
        assert x['otherOperatingCostYuan'] == x['revenueYuan'] * ind['otherOperatingCostBps'] // 10000
        assert x['afterSalesCostYuan'] == x['revenueYuan'] * ind['afterSalesCostBps'] // 10000
        assert x['fixedCostYuan'] == ind['fixedManagementAnnualYuan']
        assert x['payrollYuan'] == 12 * sum(case['employeeSalaryMonthlyYuan'])
        assert x['recruitmentCostYuan'] == sum(case['recruitmentFeesYuan'])
        costs = sum(x[k] for k in ('directCostYuan', 'otherOperatingCostYuan', 'afterSalesCostYuan', 'fixedCostYuan', 'payrollYuan', 'recruitmentCostYuan'))
        assert x['profitYuan'] == x['revenueYuan'] - costs
        assert x['endingCashYuan'] == x['startingCashYuan'] + x['profitYuan']
    if case['id'] == 'G004':
        e = case['expected']
        assert e['eligibleDirectCostYuan'] == case['directCostBeforeSavingYuan'] * case['procurementEligibleDirectCostBps'] // 10000
        assert e['savedDirectCostYuan'] == e['eligibleDirectCostYuan'] * case['savingBps'] // 10000
        assert e['departmentNetContributionFirstYearYuan'] == e['savedDirectCostYuan'] - e['departmentPayrollAnnualYuan'] - case['recruitmentFeeYuan'] - case['departmentSetupFeeYuan']
    if case['id'] == 'G005':
        assert case['expected']['severanceYuan'] == case['expected']['severanceMonths'] * case['salaryMonthlyYuan']
    if case['id'] == 'G007':
        e = case['expected']
        assert e['endingCashYuan'] == case['startingCashYuan'] - case['capexYuan']
        assert e['endingBusinessAssetBookYuan'] == case['startingBusinessAssetBookYuan'] + case['capexYuan']
        assert e['assetDeltaYuan'] == 0 and e['immediateOperatingProfitEffectYuan'] == 0
    if case['id'] == 'G016':
        x = case['expected']; base=case['fixedCostYuan']+case['otherControllableOpCostYuan']
        assert x['totalSavingsYuan'] == base * case['savingBps']//10000
        assert x['fixedCostSavingsYuan'] + x['otherOpSavingsYuan'] == x['totalSavingsYuan']
    if case['id'] == 'G017':
        x=case['expected']
        assert x['capacityAfterHrYuan'] == case['baseCapacityYuan']*(10000+case['hrBonusBps'])//10000
        assert x['maxAdditionalRevenueYuan'] == min(case['marketDemandYuan'],x['capacityAfterHrYuan'])-min(case['marketDemandYuan'],case['baseCapacityYuan'])

try:
    from jsonschema import Draft202012Validator
    Draft202012Validator.check_schema(S)
except ImportError:
    print('Optional jsonschema not installed; JSON structure parsed but schema syntax not separately validated.')

assert len(G['cases']) >= 12
assert all((ROOT / file).exists() for file in [
    'README.md', '00_范围_规则_冲突处理.md', '01_整体架构_目录与接口.md',
    '02_核心数据模型_存档与重置.md','03_模拟时钟_结算_财务引擎.md',
    '04_行业参数_数值平衡.md','05_CEO_员工_候选人与裁员.md',
    '06_部门_自动经营_策略.md','07_页面路由_UI组件_新手引导.md',
    '08_TapTap适配_审核与交付.md','09_测试设计_黄金用例.md',
    '10_实施任务_交付门禁与Agent协作.md','11_规则与待校准项登记.md',
    '12_业务命令接口_状态机与异常.md'])
print('PASS: 3 industry year-1 examples, 5 supporting departments, finance/HR test cases, schema files, time limits, document inventory.')
print(f'Total reference fixtures: {len(G["cases"])}')
