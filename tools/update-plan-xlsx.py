# -*- coding: utf-8 -*-
"""把 CSV 执行结果回填《CEO_Test_Plan_v1_1.xlsx》并更新总览/缺陷/门禁状态。"""
import csv
import os

import openpyxl

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS = os.path.join(ROOT, 'docs', 'CEO_Test_Release_v1_1')
CSV_PATH = os.path.join(DOCS, 'CEO_Test_Schedule_80.csv')
XLSX_PATH = os.path.join(DOCS, 'CEO_Test_Plan_v1_1.xlsx')

rows = {}
counts = {}
with open(CSV_PATH, 'r', encoding='utf-8-sig', newline='') as f:
    reader = csv.reader(f)
    header = next(reader)
    for rec in reader:
        if not rec or not rec[4]:
            continue
        rows[rec[4]] = rec
        counts[rec[16]] = counts.get(rec[16], 0) + 1

wb = openpyxl.load_workbook(XLSX_PATH)

# ---- 02_案例排期80：状态/实际结果/证据路径/备注 与 CSV 对齐 ----
ws = wb['02_案例排期80']
updated = 0
for r in range(2, ws.max_row + 1):
    cid = ws.cell(r, 5).value
    if not cid or cid not in rows:
        continue
    rec = rows[cid]
    for offset, idx in ((17, 16), (18, 17), (19, 18), (20, 19)):
        ws.cell(r, offset).value = rec[idx] if idx < len(rec) else None
    updated += 1

# ---- 04_缺陷跟踪 ----
ws4 = wb['04_缺陷跟踪']
fixes = {
    'BUG-001': (
        '已修复',
        'AppView 新增 rebuildSettings(overlay)：切换开关后就地重建设置弹窗（scheduleOnce 内 destroy+renderSettings），不再调用 this.render() 重建整页；R5 复测连续切换后弹窗保持打开（evidence/test-v1.1/R5/audio/audio-settings-master-off.png）',
    ),
    'BUG-002': (
        '已修复',
        'AppView.buildRoot 在无安全区数据时按 view.getVisibleSize().height 兜底缩放（fit≈0.82 @360×640）；R5 复测顶部栏/底部四 Tab/设置入口均可见可点（evidence/test-v1.1/R5/small-360x640/360-company.png、360-settings.png）',
    ),
}
for r in range(2, ws4.max_row + 1):
    bid = ws4.cell(r, 1).value
    if bid in fixes:
        status, verify = fixes[bid]
        ws4.cell(r, 13).value = status
        ws4.cell(r, 14).value = verify

# BUG-004 行（原空行）
for r in range(2, ws4.max_row + 1):
    if ws4.cell(r, 1).value == 'BUG-004':
        vals = [
            'BUG-004',
            'CEO-TC-004/066',
            'P2',
            'Web 预览 390×844 / Chrome headless',
            '任意已进入公司页的存档',
            '进入公司页观察顶部栏（公司名/副标题）',
            '公司名与副标题完整显示在 812 设计高内，不被上边界裁切',
            '主壳 Body 节点整体 +30 位移，把顶部栏推出 812 上边界，公司名被裁切半行',
            'body.setPosition(0, 30) 相对设计坐标多偏移 30px',
            'evidence/test-v1.1/R6/tc068-longname/tc068-company.png',
            'R6',
            'iOS/UI',
            '已修复',
            'AppView.renderMainShell 的 Body 改为 setPosition(0, 0)，与设计坐标原点对齐；R6 复测 20 字公司名完整显示',
        ]
        for c, v in enumerate(vals, start=1):
            ws4.cell(r, c).value = v
        break

# ---- 00_总览 ----
ws0 = wb['00_总览']
pass_n = counts.get('PASS', 0)
fail_n = counts.get('FAIL', 0)
blocked_n = counts.get('BLOCKED', 0)
executed = pass_n + fail_n + blocked_n
ws0.cell(4, 2).value = 'P0 57条 + P1 23条；已执行 %d 条（PASS %d / FAIL %d / BLOCKED %d）' % (
    executed,
    pass_n,
    fail_n,
    blocked_n,
)
ws0.cell(5, 2).value = '23个测试文件 / 204条用例全绿（typecheck 0 错、lint 0 错）'
ws0.cell(6, 2).value = (
    'game.zip 4,657,311字节（454 条目，sha256 6C204AFB…1415）；'
    '启动图已替换为自有图片（logo.png 195,571字节 / 无 Cocos 官方 logo，小游戏启动层同步深蓝底且放大）'
)
ws0.cell(7, 2).value = '2026-11-02 至 2026-11-06；R0-R6 已执行并回填，R7 收口（真机/听感/商店素材待用户回收）'
ws0.cell(8, 2).value = (
    '开发可提测；包体可提审但不可直接对外发布：TC-055 需求缺口待决策，'
    'TC-069 听感、TC-073/074/076 真机、TC-075 商店素材未执行；无未关闭 S1/S2'
)
ws0.cell(9, 2).value = (
    '包体过期（已消除）、鸿蒙回调（待真机）、离线长时（夹具替代）、'
    '音频无自动化（听感待回收）、TC-055 需求缺口'
)
ws0.cell(10, 2).value = (
    'CEO_Test_Plan_v1_1.md / CEO_Test_Schedule_80.csv / 本工作簿 / '
    'CEO_Test_Result_v1_1.md / QA_Summary.json'
)

# ---- 05_风险与门禁 ----
ws5 = wb['05_风险与门禁']
for r in range(2, ws5.max_row + 1):
    code = ws5.cell(r, 2).value
    if code == 'RK-01':
        ws5.cell(r, 3).value = '包体过期：旧包 13:44 vs 源码 15:44'
        ws5.cell(r, 6).value = '已消除'
    elif code == 'RK-04':
        ws5.cell(r, 6).value = '已定策（听感待回收）'
    elif code == 'GATE-01':
        ws5.cell(r, 6).value = '待真机回收'
    elif code == 'GATE-02':
        ws5.cell(r, 6).value = '待真机回收'
    elif code == 'GATE-06':
        ws5.cell(r, 6).value = '通过（R0 自检 + 启动图替换）'
    elif code == 'GATE-05':
        ws5.cell(r, 6).value = '通过（BUG-001/002/004 已修复，无未关闭 S1/S2）'
    elif code == 'GATE-07':
        ws5.cell(r, 6).value = '通过（80 案例 CSV + 证据目录）'

wb.save(XLSX_PATH)
print('02 rows synced:', updated)
print('counts:', counts)
print('saved:', XLSX_PATH)
