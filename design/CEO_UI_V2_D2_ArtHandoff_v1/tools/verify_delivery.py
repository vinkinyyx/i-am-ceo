"""D2 交付校验：46 项齐全、源稿/PNG/预览存在、实测尺寸模式匹配、runtime 与 png 字节一致。"""
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
H = ROOT / "design" / "CEO_UI_V2_D2_ArtHandoff_v1"
RES = ROOT / "assets" / "resources"

EXPECTED = [
    "ICO-I01", "ICO-I02", "ICO-I03",
    "ICO-K09", "ICO-K10", "ICO-K12", "ICO-K13", "ICO-K14", "ICO-K15",
    "CHR-CEO01", "CHR-GUIDE01", "CHR-ADVISOR01",
    "BRD-01",
    "ILL-S01", "ILL-S02", "ILL-S03", "ILL-S04", "ILL-S10",
    "ILL-S12", "ILL-S13", "ILL-S14", "ILL-S18", "ILL-S19", "ILL-S20",
    "ILL-S21", "ILL-S22", "ILL-S23",
    "STA-03", "STA-04", "STA-05", "STA-06", "STA-07",
    "STA-09", "STA-10", "STA-11", "STA-12", "STA-13",
    "AD-01", "AD-02",
    "BAD-01", "RANK-04",
    "EVT-01", "EVT-02", "EVT-03", "EVT-04", "EVT-05",
]

SPECS = {
    "ICO-I01": (192, 192, "RGBA"), "ICO-I02": (192, 192, "RGBA"), "ICO-I03": (192, 192, "RGBA"),
    "ICO-K09": (192, 192, "RGBA"), "ICO-K10": (192, 192, "RGBA"), "ICO-K12": (192, 192, "RGBA"),
    "ICO-K13": (192, 192, "RGBA"), "ICO-K14": (192, 192, "RGBA"), "ICO-K15": (192, 192, "RGBA"),
    "CHR-CEO01": (720, 960, "RGBA"), "CHR-GUIDE01": (720, 960, "RGBA"), "CHR-ADVISOR01": (720, 960, "RGBA"),
    "BRD-01": (512, 512, "RGBA"),
    "ILL-S01": (1080, 2400, "RGB"), "ILL-S02": (1080, 720, "RGB"), "ILL-S03": (1080, 720, "RGB"),
    "ILL-S04": (1080, 720, "RGB"), "ILL-S10": (1080, 560, "RGB"), "ILL-S12": (720, 480, "RGB"),
    "ILL-S13": (720, 480, "RGB"), "ILL-S14": (720, 480, "RGB"), "ILL-S18": (720, 480, "RGB"),
    "ILL-S19": (720, 480, "RGB"), "ILL-S20": (720, 480, "RGB"), "ILL-S21": (720, 480, "RGB"),
    "ILL-S22": (720, 480, "RGB"), "ILL-S23": (720, 400, "RGB"),
    "STA-03": (192, 192, "RGBA"), "STA-04": (192, 192, "RGBA"), "STA-05": (192, 192, "RGBA"),
    "STA-06": (192, 192, "RGBA"), "STA-07": (192, 192, "RGBA"), "STA-09": (192, 192, "RGBA"),
    "STA-10": (192, 192, "RGBA"), "STA-11": (192, 192, "RGBA"), "STA-12": (192, 192, "RGBA"),
    "STA-13": (192, 192, "RGBA"),
    "AD-01": (360, 280, "RGBA"), "AD-02": (360, 280, "RGBA"),
    "BAD-01": (384, 384, "RGBA"), "RANK-04": (384, 384, "RGBA"),
    "EVT-01": (1080, 600, "RGB"), "EVT-02": (1080, 600, "RGB"), "EVT-03": (1080, 600, "RGB"),
    "EVT-04": (1080, 600, "RGB"), "EVT-05": (1080, 600, "RGB"),
}

REQUIRED_FIELDS = [
    "asset_id", "name", "file", "width", "height", "mode", "alpha_min", "alpha_max",
    "bytes", "source", "master", "runtime_path", "runtime_key", "fit", "crop_focus",
    "crop_rect", "notes", "preview",
]


def main():
    manifest = json.loads((H / "manifest.json").read_text(encoding="utf-8"))
    assets = manifest["assets"]
    ids = [a["asset_id"] for a in assets]

    assert len(assets) == 46, f"条目数 {len(assets)} != 46"
    assert sorted(ids) == sorted(EXPECTED), (
        f"ID 不符; 缺 {sorted(set(EXPECTED) - set(ids))}; 多 {sorted(set(ids) - set(EXPECTED))}")
    assert len(set(ids)) == 46, "ID 重复"

    total = 0
    for a in assets:
        aid = a["asset_id"]
        for f in REQUIRED_FIELDS:
            assert f in a, f"{aid} 缺字段 {f}"
        assert (a["width"], a["height"], a["mode"]) == SPECS[aid], f"{aid} 规格声明不符"
        assert a["runtime_key"] == a["runtime_path"][:-4], f"{aid} runtime_key 不匹配"

        for k in ("file", "source", "master"):
            assert (H / a[k]).is_file(), f"{aid} 缺 {k}: {a[k]}"
        assert len(a["preview"]) >= 1, f"{aid} 缺 preview"
        for v in a["preview"]:
            assert (H / v).is_file(), f"{aid} 缺预览 {v}"

        png = H / a["file"]
        with Image.open(png) as im:
            assert im.size == (a["width"], a["height"]), f"{aid} 尺寸 {im.size}"
            assert im.mode == a["mode"], f"{aid} 模式 {im.mode}"
            extrema = im.getchannel("A").getextrema() if im.mode == "RGBA" else (255, 255)
        assert extrema == (a["alpha_min"], a["alpha_max"]), f"{aid} alpha 记录 {extrema}"
        assert png.stat().st_size == a["bytes"], f"{aid} bytes 不符"
        total += a["bytes"]

        runtime = RES / a["runtime_path"]
        assert runtime.is_file(), f"{aid} 未导入: {a['runtime_path']}"
        assert runtime.read_bytes() == png.read_bytes(), f"{aid} runtime 与 png 字节不一致"
        assert (runtime.parent / (runtime.name + ".meta")).is_file(), f"{aid} 缺 image .meta"

    cats = {}
    for a in assets:
        c = a.get("category", "other")
        cats[c] = cats.get(c, 0) + 1
    print(f"PASS: 46/46 项齐全；分类 {cats}；总字节 {total}；全部分辨率/模式/alpha 匹配，runtime 字节一致")
    print("导入目录:")
    for d in sorted({str(Path(a['runtime_path']).parent) for a in assets}):
        print(f"  assets/resources/{d}")


if __name__ == "__main__":
    main()
