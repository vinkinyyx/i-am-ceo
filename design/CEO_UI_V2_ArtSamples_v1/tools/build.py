"""UI V2 样板资产构建：AI 精绘源图 → 去底/规格化/导出，并生成复核预览。
用法: python build.py
"""
import json
import os
import subprocess

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW_AI = os.path.join(ROOT, "raw_ai")
PNG = os.path.join(ROOT, "png")
MASTER = os.path.join(ROOT, "master")
PREVIEW = os.path.join(ROOT, "preview")
TOOLS = os.path.join(ROOT, "tools")
for d in (PNG, MASTER, PREVIEW):
    os.makedirs(d, exist_ok=True)

LO, HI = 26.0, 92.0


def key_green(im: Image.Image) -> Image.Image:
    """绿幕去除：按绿色主导度生成 alpha，并对边缘做去绿溢色。"""
    arr = np.asarray(im.convert("RGB")).astype(np.float32)
    r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]
    dom = g - np.maximum(r, b)
    alpha = np.clip((HI - dom) / (HI - LO), 0.0, 1.0) * 255.0
    # 去绿溢色：把明显偏绿像素的 G 拉回 R/B 均值附近
    target = (r + b) * 0.5
    spill = np.clip(g - target, 0, None) * 0.75
    g2 = np.where(alpha < 250, g - spill, g)
    out = np.stack([r, np.clip(g2, 0, 255), b, alpha], axis=-1)
    return Image.fromarray(out.astype(np.uint8), "RGBA")


def fit_canvas(im: Image.Image, tw: int, th: int, top_margin: int = 30) -> Image.Image:
    bbox = im.split()[3].getbbox()
    im = im.crop(bbox)
    cw, ch = im.size
    scale = min(tw / cw, (th - top_margin) / ch)
    nw, nh = max(1, round(cw * scale)), max(1, round(ch * scale))
    im = im.resize((nw, nh), Image.LANCZOS)
    canvas = Image.new("RGBA", (tw, th), (0, 0, 0, 0))
    x = (tw - nw) // 2
    y = th - nh
    canvas.alpha_composite(im, (x, y))
    return canvas


def auto_head_crop(im: Image.Image, tw: int) -> Image.Image:
    """按 alpha 自动定位头部：头部高度约占画幅 70%，头顶点留 6% 余量，肩部自然入画。"""
    a = np.asarray(im)[..., 3] > 128
    rows = np.where(a.any(axis=1))[0]
    top = int(rows[0])
    widths = []
    for y in rows:
        xs = np.where(a[y])[0]
        widths.append((int(xs[0]), int(xs[-1])))
    head_w = max(w[1] - w[0] for w in widths[: int(len(widths) * 0.45)])
    shoulder_row = top
    for idx, (x0, x1) in enumerate(widths):
        if x1 - x0 > head_w * 1.45:
            shoulder_row = top + idx
            break
    head_h = max(shoulder_row - top, int((rows[-1] - top) * 0.55))
    side = int(round(head_h / 0.70))
    cy = int(round(top + 0.44 * side))
    row = widths[min(int((top + head_h * 0.55) - top), len(widths) - 1)]
    cx = (row[0] + row[1]) // 2
    half = side // 2
    box = (cx - half, cy - half, cx - half + side, cy - half + side)
    print(f"  head top={top} h={head_h} cx={cx} side={side} box={box}")
    return im.crop(box).resize((tw, tw), Image.LANCZOS)


def crop_square(im: Image.Image, cx: int, cy: int, side: int, tw: int) -> Image.Image:
    half = side // 2
    box = (cx - half, cy - half, cx - half + side, cy - half + side)
    im = im.crop(box)
    return im.resize((tw, tw), Image.LANCZOS)


def cover_crop(im: Image.Image, w: int, h: int, fx: float, fy: float) -> Image.Image:
    sw, sh = im.size
    scale = max(w / sw, h / sh)
    nw, nh = round(sw * scale), round(sh * scale)
    big = im.resize((nw, nh), Image.LANCZOS)
    x = min(max(round(nw * fx - w / 2), 0), nw - w)
    y = min(max(round(nh * fy - h / 2), 0), nh - h)
    return big.crop((x, y, x + w, y + h))


def measure(path: str) -> dict:
    im = Image.open(path)
    a = np.asarray(im.convert("RGBA"))[..., 3]
    bbox = Image.fromarray(a).getbbox() if im.mode == "RGBA" else (0, 0, im.width, im.height)
    return {
        "width": im.width,
        "height": im.height,
        "mode": im.mode,
        "alpha_min": int(a.min()) if im.mode == "RGBA" else 255,
        "alpha_max": int(a.max()) if im.mode == "RGBA" else 255,
        "opaque_ratio": round(float((a > 8).mean()), 4),
        "bbox": list(bbox),
        "bytes": os.path.getsize(path),
    }


def px_size(path):
    with Image.open(path) as i:
        return i.size


def main():
    report = []

    # ---- ILL-S05 场景（不透明） ----
    scene_src = os.path.join(RAW_AI, "ill_s05_office.jpg")
    scene = Image.open(scene_src).convert("RGB")
    scene.save(os.path.join(MASTER, "ill_s05_master_2560x1564.png"))
    scene_final = scene.resize((1080, 660), Image.LANCZOS)
    p = os.path.join(PNG, "v2_ill_s05_office_scene.png")
    scene_final.save(p, optimize=True)
    report.append({"asset_id": "ILL-S05", "file": "png/v2_ill_s05_office_scene.png", **measure(p)})

    # ---- CHR-ASSIST01 / CHR-HR01 ----
    chars = [
        ("CHR-ASSIST01", "chr_assist01.jpg", "v2_chr_assist01.png"),
        ("CHR-HR01", "chr_hr01.jpg", "v2_chr_hr01.png"),
    ]
    for aid, src, out in chars:
        keyed = key_green(Image.open(os.path.join(RAW_AI, src)))
        keyed.save(os.path.join(MASTER, out.replace(".png", "_master_alpha.png")))
        fit = fit_canvas(keyed, 720, 960)
        p = os.path.join(PNG, out)
        fit.save(p, optimize=True)
        report.append({"asset_id": aid, "file": "png/" + out, **measure(p)})

    # ---- OLD-AV-01 ----
    av_keyed = key_green(Image.open(os.path.join(RAW_AI, "old_av_01.jpg")))
    av_keyed.save(os.path.join(MASTER, "old_av_01_master_alpha.png"))
    av = auto_head_crop(av_keyed, 256)
    p = os.path.join(PNG, "v2_old_av_01.png")
    av.save(p, optimize=True)
    report.append({"asset_id": "OLD-AV-01", "file": "png/v2_old_av_01.png", **measure(p)})

    # ---- OLD-NAV-01 / 02（矢量渲染） ----
    navs = [
        ("OLD-NAV-01", "v2_old_nav_01_selected", True),
        ("OLD-NAV-02", "v2_old_nav_02_inactive", True),
    ]
    for aid, stem, alpha in navs:
        subprocess.run(
            ["node", os.path.join(TOOLS, "render.cjs"), "--in", os.path.join(ROOT, "src", stem + ".svg"),
             "--out", os.path.join(ROOT, "raw", stem + ".png"), "--w", "192", "--h", "192", "--scale", "4",
             "--alpha", "1" if alpha else "0"],
            check=True, cwd=ROOT,
        )
        img = Image.open(os.path.join(ROOT, "raw", stem + ".png")).convert("RGBA").resize((192, 192), Image.LANCZOS)
        p = os.path.join(PNG, stem + ".png")
        img.save(p, optimize=True)
        report.append({"asset_id": aid, "file": "png/" + stem + ".png", **measure(p)})

    with open(os.path.join(TOOLS, "measure_report.json"), "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    for r in report:
        print(r["asset_id"], f'{r["width"]}x{r["height"]}', r["mode"], "alpha", r["alpha_min"], r["alpha_max"],
              "coverage", r["opaque_ratio"], "bbox", r["bbox"])


if __name__ == "__main__":
    main()
