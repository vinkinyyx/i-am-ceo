"""D2 渲染流水线：SVG -> Chromium 精确光栅化 -> PIL 实测/预览 -> manifest/measure_report。

用法（在仓库根目录）：
    python materials/design/CEO_UI_V2_D2_ArtHandoff_v1/tools/render_svg.py
    python materials/design/CEO_UI_V2_D2_ArtHandoff_v1/tools/render_svg.py --only ICO-I01,ILL-S02
    python materials/design/CEO_UI_V2_D2_ArtHandoff_v1/tools/render_svg.py --skip-existing

要点：
- viewport = 图片精确像素，deviceScaleFactor=1。
- 透明资产 screenshot(omit_background=True)，RGB 场景转 RGB 后保存。
- 场景预览 360×160 / 360×96 cover（focus 0.50,0.52）；透明资产 128px 浅/深底复核；人物 180px 高浅底。
"""
import argparse
import json
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

HANDOFF = Path(__file__).resolve().parent.parent
SRC = HANDOFF / "src"
PNG = HANDOFF / "png"
PREVIEW = HANDOFF / "preview"

# asset_id, name, width, height, mode, runtime_path, notes, category
SPECS = [
    ("ICO-I01", "电商贸易", 192, 192, "RGBA", "ui_v2/industries/ico_i01.png", "购物袋+纸箱；蓝主体、金色点缀；无文字。", "icon"),
    ("ICO-I02", "软件科技", 192, 192, "RGBA", "ui_v2/industries/ico_i02.png", "代码窗口+齿轮；窗口内用箭头/斜杠符号，不含可读文字。", "icon"),
    ("ICO-I03", "企业服务", 192, 192, "RGBA", "ui_v2/industries/ico_i03.png", "公文包+楼宇；蓝白主体、金色锁扣。", "icon"),
    ("ICO-K09", "设置/音频", 192, 192, "RGBA", "ui_v2/business/ico_k09.png", "滑杆+音符；三档滑杆，金色音符。", "icon"),
    ("ICO-K10", "离线提示", 192, 192, "RGBA", "ui_v2/business/ico_k10.png", "月牙+时钟；夜间离线语义，金色月牙。", "icon"),
    ("ICO-K12", "投资产能", 192, 192, "RGBA", "ui_v2/business/ico_k12.png", "上升柱+箭头；末柱金色强调。", "icon"),
    ("ICO-K13", "组织锁定", 192, 192, "RGBA", "ui_v2/business/ico_k13.png", "组织节点+锁；锁为金色，节点为蓝色。", "icon"),
    ("ICO-K14", "财务帮助", 192, 192, "RGBA", "ui_v2/business/ico_k14.png", "账本+问号；问号为图形路径，不含文字。", "icon"),
    ("ICO-K15", "经营倍速", 192, 192, "RGBA", "ui_v2/business/ico_k15.png", "快进双箭头+表盘；橙金指针。", "icon"),

    ("CHR-CEO01", "CEO 半身立绘", 720, 960, "RGBA", "ui_v2/characters/chr_ceo01.png", "深蓝西装、白衬衫、短发，正面略侧；透明背景，前景占画面≥80%。", "character"),
    ("CHR-GUIDE01", "新手导师半身", 720, 960, "RGBA", "ui_v2/characters/chr_guide01.png", "青绿色针织衫、温和微笑、手持小册；小册无文字。", "character"),
    ("CHR-ADVISOR01", "经营顾问半身", 720, 960, "RGBA", "ui_v2/characters/chr_advisor01.png", "灰蓝马甲、金色细框眼镜、图表夹；图表仅柱线，无文字。", "character"),

    ("BRD-01", "品牌图形", 512, 512, "RGBA", "ui_v2/brand/brd_01.png", "蓝金圆环内 C/E/O 抽象徽记；字母为几何路径，不含长文字。", "brand"),

    ("ILL-S01", "启动主视觉·城市创业", 1080, 2400, "RGB", "ui_v2/scenes/ill_s01.png", "竖向城市天际线+晨光；中下留干净渐变区给 Logo；空镜无人物/按钮。", "scene"),
    ("ILL-S02", "创建公司·创业办公桌", 1080, 720, "RGB", "ui_v2/scenes/ill_s02.png", "办公桌、笔记本、咖啡、窗光；空镜无人物。", "scene"),
    ("ILL-S03", "CEO 创建·老板办公室", 1080, 720, "RGB", "ui_v2/scenes/ill_s03.png", "书架、落地窗、老板桌；空镜无人物。", "scene"),
    ("ILL-S04", "首次招聘·等候室", 1080, 720, "RGB", "ui_v2/scenes/ill_s04.png", "明亮等候室、两把椅子、前台；空镜无人物。", "scene"),
    ("ILL-S10", "员工详情·办公桌近景", 1080, 560, "RGB", "ui_v2/scenes/ill_s10.png", "个人办公桌近景；空镜无人物。", "scene"),
    ("ILL-S12", "关闭公司·夜办公楼层", 720, 480, "RGB", "ui_v2/scenes/ill_s12.png", "熄灯的夜办公楼层；深蓝低照度，无人物。", "scene"),
    ("ILL-S13", "离线回归·日出办公楼", 720, 480, "RGB", "ui_v2/scenes/ill_s13.png", "日出时的办公楼外景；暖色天际，无人物。", "scene"),
    ("ILL-S14", "资金危机·雨天窗景", 720, 480, "RGB", "ui_v2/scenes/ill_s14.png", "雨天窗景办公室；冷蓝低饱和，无人物。", "scene"),
    ("ILL-S18", "经营援助·资金到账", 720, 480, "RGB", "ui_v2/scenes/ill_s18.png", "纸钞/盾牌/到账上升箭头；概念插图，无文字。", "scene"),
    ("ILL-S19", "异常恢复·文件夹+盾牌", 720, 480, "RGB", "ui_v2/scenes/ill_s19.png", "文件夹+盾牌+对勾；概念插图，无文字。", "scene"),
    ("ILL-S20", "云备份·云端保险柜", 720, 480, "RGB", "ui_v2/scenes/ill_s20.png", "云端保险柜；数据点汇入云，无文字。", "scene"),
    ("ILL-S21", "云冲突·两份进度账本", 720, 480, "RGB", "ui_v2/scenes/ill_s21.png", "两份进度账本对比，中间警示菱形；无文字/数字。", "scene"),
    ("ILL-S22", "云删除·打开的保险柜", 720, 480, "RGB", "ui_v2/scenes/ill_s22.png", "打开的保险柜+确认对勾；无文字。", "scene"),
    ("ILL-S23", "主营市场趋势·城市天际线", 720, 400, "RGB", "ui_v2/scenes/ill_s23.png", "城市商务天际线+趋势线；无文字。", "scene"),

    ("STA-03", "重置警告", 192, 192, "RGBA", "ui_v2/status/sta_03.png", "循环箭头+感叹号；警示橙 #D9922E。", "status"),
    ("STA-04", "现金风险", 192, 192, "RGBA", "ui_v2/status/sta_04.png", "钱袋+下箭头；危险红 #C75353。", "status"),
    ("STA-05", "裁员风险", 192, 192, "RGBA", "ui_v2/status/sta_05.png", "人物剪影+减号；警示橙。", "status"),
    ("STA-06", "援助成功", 192, 192, "RGBA", "ui_v2/status/sta_06.png", "手+盾+对勾；盈利绿 #2E9E6B。", "status"),
    ("STA-07", "存档错误", 192, 192, "RGBA", "ui_v2/status/sta_07.png", "软盘+叉；危险红。", "status"),
    ("STA-09", "云待上传", 192, 192, "RGBA", "ui_v2/status/sta_09.png", "云+上箭头；主蓝 #3668B2。", "status"),
    ("STA-10", "云已确认", 192, 192, "RGBA", "ui_v2/status/sta_10.png", "云+对勾；盈利绿。", "status"),
    ("STA-11", "存档冲突", 192, 192, "RGBA", "ui_v2/status/sta_11.png", "两份文档+警示三角；警示橙。", "status"),
    ("STA-12", "删除待确认", 192, 192, "RGBA", "ui_v2/status/sta_12.png", "垃圾桶+问号；中性蓝灰。", "status"),
    ("STA-13", "广告奖励待核", 192, 192, "RGBA", "ui_v2/status/sta_13.png", "播放键+沙漏；金色等待。", "status"),

    ("AD-01", "自愿观看视频角标", 360, 280, "RGBA", "ui_v2/ads/ad_01.png", "播放圆钮+胶卷；不烘焙文字。", "ad"),
    ("AD-02", "免一次招聘费券", 360, 280, "RGBA", "ui_v2/ads/ad_02.png", "票券+剪刀虚线；不做成已获得状态（无对勾/盖章）。", "ad"),

    ("BAD-01", "三年连续盈利奖章", 384, 384, "RGBA", "ui_v2/badges/bad_01.png", "金色奖章+抽象数字 3（路径绘制）；无其他文字。", "badge"),
    ("RANK-04", "真实榜入口插图", 384, 384, "RGBA", "ui_v2/rank/rank_04.png", "榜单板+柱状条；不画名次数字。", "rank"),

    ("EVT-01", "客户需求变化", 1080, 600, "RGB", "ui_v2/events/evt_01.png", "商店+上升曲线；事件插图，无人物/文字。", "event"),
    ("EVT-02", "设备维护", 1080, 600, "RGB", "ui_v2/events/evt_02.png", "机器+扳手；无文字。", "event"),
    ("EVT-03", "市场景气波动", 1080, 600, "RGB", "ui_v2/events/evt_03.png", "波浪曲线+城市剪影；无文字。", "event"),
    ("EVT-04", "人才相关事件", 1080, 600, "RGB", "ui_v2/events/evt_04.png", "两个人头像剪影+对话气泡；无文字。", "event"),
    ("EVT-05", "运营成本变化", 1080, 600, "RGB", "ui_v2/events/evt_05.png", "账单+硬币堆；无金额/文字。", "event"),
]

FOCUS = (0.50, 0.52)


def spec_dict(s, idx):
    aid, name, w, h, mode, runtime, notes, cat = s
    return {
        "index": idx,
        "asset_id": aid,
        "name": name,
        "width": w,
        "height": h,
        "mode": mode,
        "runtime_path": runtime,
        "runtime_key": runtime[:-4],
        "notes": notes,
        "category": cat,
        "source": f"src/{aid.lower().replace('-', '_')}.svg",
        "file": f"png/{aid.lower().replace('-', '_')}.png",
    }


def cover_crop(im, cw, ch, fx, fy):
    w, h = im.size
    scale = max(cw / w, ch / h)
    nw, nh = max(cw, round(w * scale)), max(ch, round(h * scale))
    rs = im.resize((nw, nh), Image.LANCZOS)
    left = round((nw - cw) * fx)
    top = round((nh - ch) * fy)
    left = max(0, min(nw - cw, left))
    top = max(0, min(nh - ch, top))
    return rs.crop((left, top, left + cw, top + ch)), (left, top, scale)


def alpha_review(im, dst):
    """浅底/深底双面板，内容 128px。"""
    canvas = Image.new("RGB", (288, 160), "#F5F7FB")
    dark = Image.new("RGB", (144, 160), "#273244")
    canvas.paste(dark, (144, 0))
    thumb = im.convert("RGBA")
    thumb.thumbnail((128, 128), Image.LANCZOS)
    for i, bg in enumerate(("#F5F7FB", "#273244")):
        panel = Image.new("RGBA", (144, 160), bg)
        ox = i * 144 + (144 - thumb.width) // 2
        oy = (160 - thumb.height) // 2
        panel.alpha_composite(thumb, (ox - i * 144, oy))
        canvas.paste(panel.convert("RGB"), (i * 144, 0))
    canvas.save(dst)


def char_preview(im, dst):
    canvas = Image.new("RGB", (170, 210), "#F5F7FB")
    thumb = im.convert("RGBA")
    thumb.thumbnail((760, 180), Image.LANCZOS)
    panel = Image.new("RGBA", canvas.size, "#F5F7FB")
    panel.alpha_composite(thumb, ((170 - thumb.width) // 2, 210 - 15 - thumb.height))
    canvas.paste(panel.convert("RGB"), (0, 0))
    canvas.save(dst)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default="")
    ap.add_argument("--skip-existing", action="store_true")
    args = ap.parse_args()
    only = {s.strip().upper() for s in args.only.split(",") if s.strip()}

    specs = [spec_dict(s, i + 1) for i, s in enumerate(SPECS)]
    if only:
        specs = [s for s in specs if s["asset_id"] in only]

    missing = [s["asset_id"] for s in specs if not (HANDOFF / s["source"]).is_file()]
    if missing:
        raise SystemExit(f"缺少 SVG 源稿: {missing}")

    PNG.mkdir(exist_ok=True)
    PREVIEW.mkdir(exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1920, "height": 1080}, device_scale_factor=1)
        for s in specs:
            out = HANDOFF / s["file"]
            if args.skip_existing and out.exists():
                print(f"skip: {s['asset_id']}")
                continue
            svg = (HANDOFF / s["source"]).read_text(encoding="utf-8")
            page.set_viewport_size({"width": s["width"], "height": s["height"]})
            page.set_content(
                "<!doctype html><html><head><style>html,body{margin:0;padding:0;"
                "background:transparent;overflow:hidden}svg{display:block}</style></head>"
                f"<body>{svg}</body></html>",
                wait_until="load",
            )
            page.screenshot(path=str(out), omit_background=(s["mode"] == "RGBA"))
            with Image.open(out) as im:
                im = im.convert("RGBA") if s["mode"] == "RGBA" else im.convert("RGB")
                im.save(out)
            print(f"render: {s['asset_id']} {s['width']}x{s['height']} {s['mode']}")
        browser.close()

    # 预览 + 实测（只处理本次渲染范围）
    reports = []
    for s in specs:
        path = HANDOFF / s["file"]
        if not path.exists():
            continue
        with Image.open(path) as im:
            if im.size != (s["width"], s["height"]) or im.mode != s["mode"]:
                raise SystemExit(f"规格不符 {s['asset_id']}: {im.size} {im.mode}")
            alpha = im.getchannel("A").getextrema() if s["mode"] == "RGBA" else (255, 255)
            previews = []
            crop_rect = "none (contain)"
            if s["category"] in ("scene", "event"):
                for cw, ch, tag in ((360, 160, "360x160"), (360, 96, "360x96")):
                    prev, info = cover_crop(im, cw, ch, *FOCUS)
                    name = f"{path.stem}_{tag}.png"
                    prev.save(PREVIEW / name)
                    previews.append(f"preview/{name}")
                _, (left, top, scale) = cover_crop(im, 360, 96, *FOCUS)
                sw, sh = round(360 / scale), round(96 / scale)
                crop_rect = (f"cover center=({FOCUS[0]:.2f},{FOCUS[1]:.2f}) "
                             f"-> src x={round(left / scale)} y={round(top / scale)} "
                             f"w={sw} h={sh}; preview 360x160 & 360x96")
            elif s["category"] == "character":
                name = f"{path.stem}_180.png"
                char_preview(im, PREVIEW / name)
                previews.append(f"preview/{name}")
                crop_rect = "contain; 180px height light preview"
            else:
                name = f"{path.stem}_alpha_review.png"
                alpha_review(im, PREVIEW / name)
                previews.append(f"preview/{name}")
                crop_rect = "contain; 128px light/dark alpha review"

            reports.append({
                "asset_id": s["asset_id"],
                "name": s["name"],
                "file": s["file"],
                "width": s["width"],
                "height": s["height"],
                "mode": s["mode"],
                "alpha_min": alpha[0],
                "alpha_max": alpha[1],
                "bytes": path.stat().st_size,
                "source": s["source"],
                "master": s["source"],
                "runtime_path": s["runtime_path"],
                "runtime_key": s["runtime_key"],
                "fit": "cover center" if s["category"] in ("scene", "event") else "contain",
                "crop_focus": {"scene": [FOCUS[0], FOCUS[1]]} if s["category"] in ("scene", "event") else {"anchor": [0.5, 0.5]},
                "crop_rect": crop_rect,
                "notes": s["notes"],
                "category": s["category"],
                "preview": previews,
            })

    # 只有全量渲染时才重写台账
    if len(reports) == len(SPECS):
        manifest = {
            "package": "CEO UI V2 D2 美术交接 v1",
            "generated_for": "Cocos Creator 3.8.8; developer agent import",
            "style_reference": "../../../docs/ui-design/03_Asset_Registry_V2.json",
            "count": len(reports),
            "assets": reports,
        }
        (HANDOFF / "manifest.json").write_text(
            json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
        measure = [{
            "asset_id": r["asset_id"], "width": r["width"], "height": r["height"],
            "mode": r["mode"], "alpha_min": r["alpha_min"], "alpha_max": r["alpha_max"],
            "bytes": r["bytes"], "runtime_path": r["runtime_path"],
        } for r in reports]
        (HANDOFF / "tools" / "measure_report.json").write_text(
            json.dumps(measure, indent=2, ensure_ascii=False), encoding="utf-8")
        total = sum(r["bytes"] for r in reports)
        print(f"done: {len(reports)} assets, {total} bytes")
        for r in reports:
            print(f"  {r['asset_id']:<14} {r['width']}x{r['height']:<5} {r['mode']} "
                  f"a=({r['alpha_min']},{r['alpha_max']}) {r['bytes']:>8} B")
    else:
        print(f"partial render: {len(reports)}/{len(SPECS)}")


if __name__ == "__main__":
    main()
