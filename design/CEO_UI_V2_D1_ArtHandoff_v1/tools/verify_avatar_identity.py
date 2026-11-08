"""D1-QA-02 复核：OLD-AV-01/02/03 同身份，仅衣装绿/蓝系配色不同。

输出：
  evidence/ui-v2-d1-qa-02/avatar-identity-check.json
  evidence/ui-v2-d1-qa-02/avatar-thumbs-44px.png（40–48px 缩略对照）
校验项：
  1) 三张实测 256×256 RGBA，alpha 边界一致
  2) AV-02/03 相对 AV-01 的差异像素，必须全部落在 AV-01 的蓝色衣装掩码内
  3) 非衣装区域（皮肤/头发/五官/背景）逐像素完全相同 -> 同一身份
  4) 44px 缩略下三张主色不同
"""
import json
from pathlib import Path

from PIL import Image

ROOT = Path(r"d:\Workspace\TapTap\我是CEO")
SAMPLES = ROOT / "design" / "CEO_UI_V2_ArtSamples_v1" / "png" / "v2_old_av_01.png"
RUNTIME = ROOT / "assets" / "resources" / "ui" / "avatars"
OUT = ROOT / "evidence" / "ui-v2-d1-qa-02"
FILES = {
    "OLD-AV-01": SAMPLES,
    "OLD-AV-02": RUNTIME / "EmployeeAvatar_01_Male_ShortHair_Color2.png",
    "OLD-AV-03": RUNTIME / "EmployeeAvatar_01_Male_ShortHair_Color3.png",
}


def clothing_mask(img):
    """蓝色衣装掩码，与 recolor_avatar_variants.py 的判定保持一致。"""
    px = img.load()
    w, h = img.size
    mask = set()
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a and b > r + 28 and b >= g + 6 and b > 60:
                mask.add((x, y))
    return mask


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    imgs = {k: Image.open(v).convert("RGBA") for k, v in FILES.items()}
    base = imgs["OLD-AV-01"]
    mask = clothing_mask(base)
    report = {"checkedAt": __import__("datetime").datetime.now().isoformat(timespec="seconds"), "checks": []}

    ok_specs = all(im.size == (256, 256) for im in imgs.values())
    report["checks"].append({"id": "av-same-spec-256-rgba", "status": "PASS" if ok_specs else "FAIL",
                             "detail": {k: im.size for k, im in imgs.items()}})

    base_alpha = [base.getpixel((x, y))[3] for y in range(256) for x in range(256)]
    same_alpha = all([im.getpixel((x, y))[3] for y in range(256) for x in range(256)] == base_alpha for im in imgs.values())
    report["checks"].append({"id": "av-identical-alpha-boundary", "status": "PASS" if same_alpha else "FAIL", "detail": None})

    for key in ("OLD-AV-02", "OLD-AV-03"):
        im = imgs[key]
        diff_outside = 0
        diff_inside = 0
        for y in range(256):
            for x in range(256):
                if im.getpixel((x, y)) == base.getpixel((x, y)):
                    continue
                if (x, y) in mask:
                    diff_inside += 1
                else:
                    diff_outside += 1
        status = "PASS" if diff_outside == 0 and diff_inside > 0 else "FAIL"
        report["checks"].append({"id": f"{key}-diff-only-in-clothing", "status": status,
                                 "detail": {"diffInsideClothing": diff_inside, "diffOutsideClothing": diff_outside,
                                            "changingPixels": diff_inside + diff_outside}})

    # 44px 缩略对照
    tile = 44
    pad = 8
    sheet = Image.new("RGBA", (tile * 3 + pad * 4, tile + pad * 2 + 14), (255, 255, 255, 255))
    from PIL import ImageDraw
    draw = ImageDraw.Draw(sheet)
    for i, (key, im) in enumerate(imgs.items()):
        thumb = im.resize((tile, tile), Image.LANCZOS)
        x = pad + i * (tile + pad)
        sheet.alpha_composite(thumb, (x, pad))
        draw.text((x, pad + tile + 2), key.replace("OLD-", ""), fill=(20, 30, 50, 255))
    sheet_path = OUT / "avatar-thumbs-44px.png"
    sheet.save(sheet_path)

    # 缩略主色差异
    means = {}
    for key, im in imgs.items():
        t = im.resize((tile, tile), Image.LANCZOS).convert("RGB")
        px = list(t.getdata())
        means[key] = tuple(round(sum(p[i] for p in px) / len(px), 1) for i in range(3))
    distinct = len({means[k] for k in means}) == 3
    report["checks"].append({"id": "av-thumb-44px-distinct", "status": "PASS" if distinct else "FAIL",
                             "detail": {"meanRgb": means, "sheet": str(sheet_path.relative_to(ROOT))}})

    passed = all(c["status"] == "PASS" for c in report["checks"])
    report["status"] = "PASS" if passed else "FAIL"
    (OUT / "avatar-identity-check.json").write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(report, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
