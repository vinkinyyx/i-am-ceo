"""D0 导入：把 6 张样板 PNG 拷入 assets/resources 并生成 Creator 3.8.8 .meta。

键映射按总览 §30.9：
- ILL-S05        -> ui_v2/scenes/ill_s05.png
- CHR-ASSIST01   -> ui_v2/characters/chr_assist01.png
- CHR-HR01       -> ui_v2/characters/chr_hr01.png
- OLD-AV-01      -> ui/avatars/EmployeeAvatar_01_Male_ShortHair_Color1.png
- OLD-NAV-01     -> ui/navigation/Nav_Company.png
- OLD-NAV-02     -> ui/navigation/Nav_Company_Inactive.png

幂等：重跑只覆盖同名文件，UUID 固定（首次生成后写入本脚本同目录 import_uuids.json）。
"""
import json
import shutil
import uuid
from pathlib import Path

ROOT = Path(r"d:\Workspace\TapTap\我是CEO")
SRC = ROOT / "design" / "CEO_UI_V2_ArtSamples_v1" / "png"
DST = ROOT / "assets" / "resources"
UUID_STORE = Path(__file__).with_name("import_uuids.json")

# (源文件, 目标相对 resources 路径, 宽, 高, 是否含 alpha)
IMAGES = [
    ("v2_ill_s05_office_scene.png", "ui_v2/scenes/ill_s05.png", 1080, 660, False),
    ("v2_chr_assist01.png", "ui_v2/characters/chr_assist01.png", 720, 960, True),
    ("v2_chr_hr01.png", "ui_v2/characters/chr_hr01.png", 720, 960, True),
    ("v2_old_av_01.png", "ui/avatars/EmployeeAvatar_01_Male_ShortHair_Color1.png", 256, 256, True),
    ("v2_old_nav_01_selected.png", "ui/navigation/Nav_Company.png", 192, 192, True),
    ("v2_old_nav_02_inactive.png", "ui/navigation/Nav_Company_Inactive.png", 192, 192, True),
]

DIRS = ["ui", "ui/avatars", "ui/navigation", "ui_v2", "ui_v2/scenes", "ui_v2/characters"]


def load_uuids():
    if UUID_STORE.exists():
        return json.loads(UUID_STORE.read_text(encoding="utf-8"))
    return {}


def save_uuids(store):
    UUID_STORE.write_text(json.dumps(store, indent=2, ensure_ascii=False), encoding="utf-8")


def dir_meta(u: str) -> str:
    return json.dumps({
        "ver": "1.2.0",
        "importer": "directory",
        "imported": True,
        "uuid": u,
        "files": [],
        "subMetas": {},
        "userData": {},
    }, indent=2)


def image_meta(u: str, name: str, w: int, h: int, has_alpha: bool) -> str:
    hw, hh = w / 2, h / 2
    tex = u + "@6c48a"
    sf = u + "@f9941"
    data = {
        "ver": "1.0.27",
        "importer": "image",
        "imported": True,
        "uuid": u,
        "files": [".json", ".png"],
        "subMetas": {
            "6c48a": {
                "importer": "texture",
                "uuid": tex,
                "displayName": name,
                "id": "6c48a",
                "name": "texture",
                "userData": {
                    "wrapModeS": "clamp-to-edge",
                    "wrapModeT": "clamp-to-edge",
                    "imageUuidOrDatabaseUri": u,
                    "isUuid": True,
                    "visible": False,
                    "minfilter": "linear",
                    "magfilter": "linear",
                    "mipfilter": "none",
                    "anisotropy": 0,
                },
                "ver": "1.0.22",
                "imported": True,
                "files": [".json"],
                "subMetas": {},
            },
            "f9941": {
                "importer": "sprite-frame",
                "uuid": sf,
                "displayName": name,
                "id": "f9941",
                "name": "spriteFrame",
                "userData": {
                    "trimThreshold": 1,
                    "rotated": False,
                    "offsetX": 0,
                    "offsetY": 0,
                    "trimX": 0,
                    "trimY": 0,
                    "width": w,
                    "height": h,
                    "rawWidth": w,
                    "rawHeight": h,
                    "borderTop": 0,
                    "borderBottom": 0,
                    "borderLeft": 0,
                    "borderRight": 0,
                    "packable": True,
                    "pixelsToUnit": 100,
                    "pivotX": 0.5,
                    "pivotY": 0.5,
                    "meshType": 0,
                    "vertices": {
                        "rawPosition": [-hw, -hh, 0, hw, -hh, 0, -hw, hh, 0, hw, hh, 0],
                        "indexes": [0, 1, 2, 2, 1, 3],
                        "uv": [0, h, w, h, 0, 0, w, 0],
                        "nuv": [0, 0, 1, 0, 0, 1, 1, 1],
                        "minPos": [-hw, -hh, 0],
                        "maxPos": [hw, hh, 0],
                    },
                    "isUuid": True,
                    "imageUuidOrDatabaseUri": tex,
                    "atlasUuid": "",
                    "trimType": "auto",
                },
                "ver": "1.0.12",
                "imported": True,
                "files": [".json"],
                "subMetas": {},
            },
        },
        "userData": {
            "type": "sprite-frame",
            "fixAlphaTransparencyArtifacts": False,
            "hasAlpha": has_alpha,
            "redirect": tex,
        },
    }
    return json.dumps(data, indent=2)


def main():
    store = load_uuids()
    for d in DIRS:
        p = DST / d
        p.mkdir(parents=True, exist_ok=True)
        key = f"dir:{d}"
        if key not in store:
            store[key] = str(uuid.uuid4())
        (p.parent / (p.name + ".meta")).write_text(dir_meta(store[key]), encoding="utf-8")

    for src_name, rel, w, h, alpha in IMAGES:
        src = SRC / src_name
        dst = DST / rel
        if not src.exists():
            raise FileNotFoundError(src)
        shutil.copyfile(src, dst)
        key = f"img:{rel}"
        if key not in store:
            store[key] = str(uuid.uuid4())
        name = Path(rel).stem
        (dst.parent / (dst.name + ".meta")).write_text(
            image_meta(store[key], name, w, h, alpha), encoding="utf-8")
        print(f"imported {rel} uuid={store[key]}")

    save_uuids(store)
    print("done")


if __name__ == "__main__":
    main()
