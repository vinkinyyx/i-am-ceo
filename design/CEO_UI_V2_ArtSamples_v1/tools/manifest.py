"""生成 manifest.json：把实测宽高、alpha、裁切焦点与台账映射合并成一份可核对清单。"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
measure = json.load(open(os.path.join(ROOT, "tools", "measure_report.json"), encoding="utf-8"))

META = {
    "ILL-S05": {
        "name": "公司首页·小型现代办公室（空镜，不含人物）",
        "kind": "场景插画",
        "page": ["UI-05 公司经营首页 T01 /tab/company"],
        "source": "src/../raw_ai/ill_s05_office.jpg（AI 精绘母版 2560×1564）",
        "master": "master/ill_s05_master_2560x1564.png",
        "runtime_path": "assets/resources/ui_v2/scenes/ill_s05.png",
        "runtime_key": "ui_v2/scenes/ill_s05",
        "fit": "cover",
        "crop_focus": {"343x160": [0.50, 0.48], "343x96": [0.50, 0.56]},
        "crop_rect": {"343x160": "源图 x 0..1080，y 65..569", "343x96": "源图 x 0..1080，y 218..521"},
        "notes": "右侧约三分之一为人物站位；左右各留裁切余量；不含公司名、金额、按钮、气泡、榜单行、图表、品牌字样与水印。",
    },
    "CHR-ASSIST01": {
        "name": "经营助理 NPC（半身）",
        "kind": "透明人物立绘",
        "page": ["UI-05 公司经营首页", "UI-08 排行榜"],
        "source": "raw_ai/chr_assist01_test.jpg（绿幕母版 1680×2240）",
        "master": "master/v2_chr_assist01_master_alpha.png",
        "runtime_path": "assets/resources/ui_v2/characters/chr_assist01.png",
        "runtime_key": "ui_v2/characters/chr_assist01",
        "fit": "contain，底部对齐，水平居中",
        "crop_focus": {"banner": [0.62, 1.00]},
        "crop_rect": "-",
        "notes": "白西装+浅蓝衬衫+蓝挂绳空白工牌+金色胸针；暖棕过肩发；张开手掌迎客；发梢、手指、服装外沿完整；顶部留 30px 余量。",
    },
    "CHR-HR01": {
        "name": "人事经理 NPC（半身）",
        "kind": "透明人物立绘",
        "page": ["UI-04 首次招聘", "UI-07 人才总览", "UI-16 日常招聘中心", "UI-30 教程首聘", "EX-05 每日招聘券提示"],
        "source": "raw_ai/chr_hr01.jpg（绿幕母版 1680×2240）",
        "master": "master/v2_chr_hr01_master_alpha.png",
        "runtime_path": "assets/resources/ui_v2/characters/chr_hr01.png",
        "runtime_key": "ui_v2/characters/chr_hr01",
        "fit": "contain，底部对齐，水平居中",
        "crop_focus": {"banner": [0.62, 1.00]},
        "crop_rect": "-",
        "notes": "藏青西装+白衬衫+金边眼镜；齐颈黑短发；抱白色文件夹并握笔讲解；与助理在发型、服装色、姿态上均可区分。",
    },
    "OLD-AV-01": {
        "name": "员工头像 男-短发·配色1",
        "kind": "透明头像",
        "page": ["UI-04", "UI-07", "UI-10 员工详情", "UI-16", "UI-17 招聘费用确认", "UI-18 裁员赔偿确认", "UI-22 部门员工配置"],
        "source": "raw_ai/old_av_01.jpg（绿幕母版 1920×1920）；旧稿 source_key: ui/avatars/EmployeeAvatar_01_Male_ShortHair_Color1",
        "master": "master/old_av_01_master_alpha.png",
        "runtime_path": "assets/resources/ui_v2/avatars/old_av_01.png",
        "runtime_key": "ui_v2/avatars/old_av_01",
        "fit": "圆形遮罩，中心对齐",
        "crop_focus": {"circle": [0.50, 0.50]},
        "crop_rect": "母版 x 135..1884，y 181..1930（头部占画幅约 70%，顶留 6%）",
        "notes": "保留旧 ID 身份：短发、蓝西装、白衬衫、深藏青领带；40–48px 下五官可辨；后续 24 格沿用同一取景与光向。",
    },
    "OLD-NAV-01": {
        "name": "底部导航·公司（选中）",
        "kind": "矢量图标",
        "page": ["UI-05", "UI-06", "UI-07", "UI-08", "UI-12"],
        "source": "src/v2_old_nav_01_selected.svg（可编辑矢量源稿）",
        "master": "src/v2_old_nav_01_selected.svg",
        "runtime_path": "assets/resources/ui_v2/navigation/old_nav_01.png",
        "runtime_key": "ui_v2/navigation/old_nav_01",
        "fit": "contain，20–24 展示 / 40–44 触达区独立",
        "crop_focus": {"icon": [0.50, 0.50]},
        "crop_rect": "-",
        "notes": "与 OLD-NAV-02 共用同一组几何，包围盒完全一致 [43,25,149,157]；选中态深蓝填充+白色开窗。",
    },
    "OLD-NAV-02": {
        "name": "底部导航·公司（未选中）",
        "kind": "矢量图标",
        "page": ["UI-05", "UI-06", "UI-07", "UI-08", "UI-12"],
        "source": "src/v2_old_nav_02_inactive.svg（可编辑矢量源稿）",
        "master": "src/v2_old_nav_02_inactive.svg",
        "runtime_path": "assets/resources/ui_v2/navigation/old_nav_02.png",
        "runtime_key": "ui_v2/navigation/old_nav_02",
        "fit": "contain，20–24 展示 / 40–44 触达区独立",
        "crop_focus": {"icon": [0.50, 0.50]},
        "crop_rect": "-",
        "notes": "6px 灰蓝描边外沿与选中态填充外沿重合；窗与门同尺寸浅灰填充；包围盒与 OLD-NAV-01 一致。",
    },
}

out = []
for r in measure:
    m = META[r["asset_id"]]
    out.append({**r, **m})

manifest = {
    "package": "CEO UI V2 美术样板 v1",
    "generated_for": "Cocos Creator 3.8.8 / assets/resources/ui_v2",
    "style_bible": {
        "style": "轻半写实日式 2D 商业插画",
        "light": "暖日光自左侧窗户进入，右下方投光，阴影偏冷蓝灰",
        "palette": {
            "primary_blue": "#3668B2",
            "deep_blue": "#315FA4",
            "ink": "#243247",
            "sub_ink": "#53647A",
            "bg": "#F4F6FA",
            "warm_light": "#FFE3B4",
            "wood": "#C79A6B",
            "gold_accent": "#E5B85D",
        },
        "gold_usage": "仅胸针、镜架、领带夹等小面积点缀，不承担信息",
        "forbidden": ["公司名", "金额", "等级", "按钮", "对白框", "排行行", "图表", "品牌字样", "水印", "虚构游戏币"],
    },
    "assets": out,
}
with open(os.path.join(ROOT, "manifest.json"), "w", encoding="utf-8") as f:
    json.dump(manifest, f, ensure_ascii=False, indent=2)
print(json.dumps(manifest["assets"], ensure_ascii=False, indent=1)[:1200])
print("manifest.json written")
