"""D1-QA-02：把 OLD-AV-02/03 修成与 OLD-AV-01 同一身份，只改衣装蓝系配色。

问题：旧 OLD-AV-02/03 是扁平矢量头像，与 OLD-AV-01 的轻半写实人物不是同一角色。
修复：以 OLD-AV-01 的运行母版为唯一身份源，只对蓝色衣装像素做 HSV 调色，
      皮肤、头发、五官、轮廓完全保留，因此同一 avatarId 组仍可辨认为同一人。

输出同步四份：
  1) 源稿记录：manifest source/master 指向 OLD-AV-01 母版 + 本脚本
  2) 导出图：design/CEO_UI_V2_D1_ArtHandoff_v1/png/old_av_02.png、old_av_03.png
  3) 预览：design/CEO_UI_V2_D1_ArtHandoff_v1/preview/old_av_0{2,3}_alpha_review.png
  4) 运行图：assets/resources/ui/avatars/EmployeeAvatar_01_*_Color{2,3}.png
运行图 .meta 与 UUID 由 import_resources.py 沿用既有记录，不重生成。
"""
import colorsys
import json
from pathlib import Path

from PIL import Image

ROOT = Path(r"d:\Workspace\TapTap\我是CEO")
HANDOFF = ROOT / "design" / "CEO_UI_V2_D1_ArtHandoff_v1"
AV01_MASTER = ROOT / "design" / "CEO_UI_V2_ArtSamples_v1" / "png" / "v2_old_av_01.png"
RUNTIME = ROOT / "assets" / "resources" / "ui" / "avatars"

# 目标配色：同蓝系，仅明度/饱和度不同（保持身份与色板一致）
VARIANTS = {
    "old_av_02": {"hue": 0.012, "sat": 0.72, "val": 1.20},   # Color2：亮天蓝
    "old_av_03": {"hue": -0.010, "sat": 1.22, "val": 0.74},  # Color3：深海军蓝
}
RUNTIME_NAME = {
    "old_av_02": "EmployeeAvatar_01_Male_ShortHair_Color2.png",
    "old_av_03": "EmployeeAvatar_01_Male_ShortHair_Color3.png",
}


def is_clothing(r, g, b):
    """蓝色衣装判定：蓝显著高于红、且高于绿，排除肤色/深棕发。"""
    return b > r + 28 and b >= g + 6 and b > 60


def recolor(img: Image.Image, hue: float, sat: float, val: float) -> Image.Image:
    src = img.convert("RGBA")
    out = src.copy()
    px_in = src.load()
    px_out = out.load()
    w, h = src.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px_in[x, y]
            if a == 0 or not is_clothing(r, g, b):
                continue
            hh, ss, vv = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            hh = (hh + hue) % 1.0
            ss = min(1.0, ss * sat)
            vv = min(1.0, vv * val)
            nr, ng, nb = colorsys.hsv_to_rgb(hh, ss, vv)
            px_out[x, y] = (round(nr * 255), round(ng * 255), round(nb * 255), a)
    return out


def alpha_review(img: Image.Image, tile: int = 96) -> Image.Image:
    """浅/深底 2 格缩略，用于人工检查透明边缘。"""
    canvas = Image.new("RGBA", (tile * 2, tile), (0, 0, 0, 0))
    for i, bg in enumerate([(255, 255, 255, 255), (32, 40, 56, 255)]):
        base = Image.new("RGBA", (tile, tile), bg)
        thumb = img.copy()
        thumb.thumbnail((tile, tile), Image.LANCZOS)
        base.alpha_composite(thumb, ((tile - thumb.width) // 2, (tile - thumb.height) // 2))
        canvas.alpha_composite(base, (i * tile, 0))
    return canvas


def main():
    base01 = Image.open(AV01_MASTER).convert("RGBA")
    if base01.size != (256, 256):
        base01 = base01.resize((256, 256), Image.LANCZOS)
    manifest_path = HANDOFF / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    by_id = {a["asset_id"]: a for a in manifest["assets"]}

    for stem, params in VARIANTS.items():
        out = recolor(base01, **params)
        png_path = HANDOFF / "png" / f"{stem}.png"
        out.save(png_path)
        alpha_review(out).save(HANDOFF / "preview" / f"{stem}_alpha_review.png")
        runtime_path = RUNTIME / RUNTIME_NAME[stem]
        out.save(runtime_path)

        asset_id = "OLD-AV-" + stem.split("_")[-1]
        entry = by_id[asset_id]
        entry["source"] = "../CEO_UI_V2_ArtSamples_v1/png/v2_old_av_01.png"
        entry["master"] = "../CEO_UI_V2_ArtSamples_v1/png/v2_old_av_01.png"
        entry["derived_from"] = "OLD-AV-01"
        entry["derivation"] = "tools/recolor_avatar_variants.py"
        entry["bytes"] = png_path.stat().st_size
        entry["notes"] = (
            "与 OLD-AV-01 同一身份：复用其母版，仅对蓝色衣装像素做 HSV 调色，"
            "皮肤/头发/五官/轮廓不变。保留 Asset Registry 原 source_key 与运行 .meta UUID。"
        )
        print(f"{asset_id} -> {runtime_path.name} {png_path.stat().st_size} B")

    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
    print("manifest updated")


if __name__ == "__main__":
    main()
