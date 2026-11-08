"""D2 导入：按 manifest.json 把 46 张 PNG 拷入 assets/resources 并生成 Creator 3.8.8 .meta。

- 源/目标映射全部读 manifest 的 file -> runtime_path，不写死。
- 已存在的目录 .meta（D1 已建）保留不动；只为新目录生成 .meta。
- 图片 UUID 幂等：首次生成后写入本脚本同目录 import_uuids.json，重跑沿用。
- 导入前用 PIL 复核每张 PNG 实测宽高/模式与 manifest 一致。
"""
import json
import shutil
import uuid
from pathlib import Path

from PIL import Image

ROOT = Path(r"d:\Workspace\TapTap\我是CEO")
HANDOFF = ROOT / "design" / "CEO_UI_V2_D2_ArtHandoff_v1"
DST = ROOT / "assets" / "resources"
UUID_STORE = Path(__file__).with_name("import_uuids.json")

MANIFEST = json.loads((HANDOFF / "manifest.json").read_text(encoding="utf-8"))
ASSETS = MANIFEST["assets"]
assert len(ASSETS) == 46, len(ASSETS)


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

    # 1) 目录：只给还没有 .meta 的目录生成（D1 已建的 scenes/characters/business/rank 不动）
    dirs = sorted({str(Path(a["runtime_path"]).parent).replace("\\", "/") for a in ASSETS})
    for d in dirs:
        p = DST / d
        p.mkdir(parents=True, exist_ok=True)
        meta_path = p.parent / (p.name + ".meta")
        if meta_path.exists():
            print(f"dir meta kept: {d}")
            continue
        key = f"dir:{d}"
        if key not in store:
            store[key] = str(uuid.uuid4())
        meta_path.write_text(dir_meta(store[key]), encoding="utf-8")
        print(f"dir meta created: {d}")

    # 2) 图片：先比对已存在文件内容，再覆盖；meta 按 manifest 规格重写
    for a in ASSETS:
        src = HANDOFF / a["file"]
        rel = a["runtime_path"]
        dst = DST / rel
        if not src.exists():
            raise FileNotFoundError(src)
        with Image.open(src) as im:
            assert im.size == (a["width"], a["height"]), (a["asset_id"], im.size)
            assert im.mode == a["mode"], (a["asset_id"], im.mode)
        if dst.exists():
            same = src.read_bytes() == dst.read_bytes()
            print(f"exists {'identical' if same else 'DIFF->overwrite'}: {rel}")
        shutil.copyfile(src, dst)
        key = f"img:{rel}"
        if key not in store:
            store[key] = str(uuid.uuid4())
        has_alpha = a["alpha_min"] < 255
        name = Path(rel).stem
        (dst.parent / (dst.name + ".meta")).write_text(
            image_meta(store[key], name, a["width"], a["height"], has_alpha), encoding="utf-8")

    save_uuids(store)
    print(f"done: {len(ASSETS)} images imported")


if __name__ == "__main__":
    main()
