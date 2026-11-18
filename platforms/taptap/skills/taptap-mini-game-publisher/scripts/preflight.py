#!/usr/bin/env python3
"""TapTap 发布素材/包体本地静态预检（非平台审核）。

仅读取本地文件，不联网、不改游戏项目、不读取用户账号凭证。
Usage:
 python preflight.py --project . --target auto --version V1.0.0
 python preflight.py --project . --target tap-mini --package ./build/game.zip --asset-manifest ./asset-manifest.json
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path

VERSION = "1.0.0"
VALID_TARGETS = ["auto", "h5", "tap-mini", "taptap-maker", "apk", "unknown"]
IMAGE_KINDS = {"landscape_promo", "square_promo", "screenshot", "icon"}
SUPPORTED_IMAGE_EXTS = {".png", ".jpg", ".jpeg"}


def check(messages, status, code, message):
    messages.append({"status": status, "code": code, "message": message})


def project_flavor(root: Path):
    signals = []
    if (root / "ProjectSettings/ProjectVersion.txt").exists():
        signals.append("Unity")
    if (root / "settings/v2/packages.json").exists() or (root / "settings/v2/editor.json").exists():
        signals.append("Cocos Creator")
    if (root / "project.json").exists() and (root / "assets").is_dir():
        signals.append("Cocos/other engine (needs confirmation)")
    if (root / "package.json").exists():
        signals.append("npm web/frontend (needs confirmation)")
    if (root / "index.html").exists() or (root / "dist/index.html").exists():
        signals.append("HTML entrypoint")
    if (root / "gradlew").exists() or (root / "app/build.gradle").exists():
        signals.append("Android/Gradle")
    return signals


def probe_image(path: Path):
    try:
        from PIL import Image
    except ImportError:
        return None, "需要 Pillow 才能静态读取图片尺寸（python -m pip install Pillow）"
    try:
        with Image.open(path) as im:
            im.verify()
        with Image.open(path) as im:
            return im.size, None
    except Exception as exc:
        return None, f"无法解析图片: {exc}"


def check_assets(messages, root: Path, manifest_path: Path):
    try:
        data = json.loads(manifest_path.read_text(encoding="utf-8"))
        materials = data["materials"]
        if not isinstance(materials, list):
            raise ValueError("materials must be list")
    except (OSError, ValueError, KeyError, TypeError) as exc:
        check(messages, "FAIL", "MANIFEST", f"素材 manifest 无法读取: {exc}")
        return

    screenshots = 0
    promo_counts = {"landscape_promo": 0, "square_promo": 0, "gameplay_video": 0, "icon": 0}
    for i, asset in enumerate(materials):
        if not isinstance(asset, dict):
            check(messages, "FAIL", f"ASSET-{i}", "素材条目必须是对象")
            continue
        kind = asset.get("kind", "")
        relative = asset.get("path", "")
        if kind not in IMAGE_KINDS | {"gameplay_video"} or not relative:
            check(messages, "FAIL", f"ASSET-{i}", "无效 kind/path")
            continue
        p = (root / relative).resolve()
        if not p.is_relative_to(root.resolve()):
            check(messages, "FAIL", f"ASSET-{i}", f"素材路径逃逸出项目目录: {relative}")
            continue
        if kind in promo_counts:
            promo_counts[kind] += 1
        if kind == "screenshot":
            screenshots += 1
        if not p.is_file():
            check(messages, "FAIL", f"ASSET-{i}", f"不存在: {relative}")
            continue
        ext = p.suffix.lower()
        max_bytes = 500 * 1024 * 1024 if kind == "gameplay_video" else 2 * 1024 * 1024
        if p.stat().st_size > max_bytes:
            check(messages, "FAIL", f"ASSET-{i}", f"{relative} 超过官方物料体积上限 {max_bytes / 1024 / 1024:.0f}MB")
        if kind in IMAGE_KINDS:
            if ext not in SUPPORTED_IMAGE_EXTS:
                check(messages, "FAIL", f"ASSET-{i}", f"{relative} 应为 JPG/PNG")
                continue
            dims, error = probe_image(p)
            if error:
                check(messages, "WARN", f"ASSET-{i}", f"{relative}: {error}")
                continue
            w, h = dims
            if kind == "landscape_promo" and (w, h) != (1920, 1080):
                check(messages, "FAIL", f"ASSET-{i}", f"{relative} 需 1920x1080，实际 {w}x{h}")
            if kind == "square_promo" and (w, h) != (1440, 1440):
                check(messages, "FAIL", f"ASSET-{i}", f"{relative} 需 1440x1440，实际 {w}x{h}")
            if kind == "screenshot" and (max(w, h) < 1280 or min(w, h) < 720):
                check(messages, "FAIL", f"ASSET-{i}", f"{relative} 截图尺寸不符合至少 1280x720 对应方向，实际 {w}x{h}")
            if kind == "icon":
                check(messages, "INFO", "ICON", "官方宣发物料指引未规定统一图标尺寸，须按当前上传控件核实")
        else:
            if ext != ".mp4":
                check(messages, "FAIL", f"ASSET-{i}", f"{relative} 游戏实机录屏需 MP4")
                continue
            if shutil.which("ffprobe"):
                try:
                    raw = subprocess.run(
                        ["ffprobe", "-v", "quiet", "-select_streams", "v:0", "-show_entries", "stream=width,height,codec_name", "-of", "json", str(p)],
                        capture_output=True, text=True, check=True, timeout=10,
                    )
                    stream = json.loads(raw.stdout)["streams"][0]
                    w, h, codec = int(stream["width"]), int(stream["height"]), stream.get("codec_name", "")
                    orient = asset.get("orientation", "portrait" if h > w else "landscape")
                    ok = (w * 9 == h * 16 and w >= 1280 and h >= 720) if orient == "landscape" else (w * 16 == h * 9 and w >= 720 and h >= 1280)
                    # Portrait 9:16 means width:height=9:16.
                    if orient == "portrait":
                        ok = (w * 16 == h * 9 and w >= 720 and h >= 1280)
                    if not ok:
                        check(messages, "FAIL", f"ASSET-{i}", f"{relative} 视频 {w}x{h} 不符合方向 {orient} 的 16:9/9:16 最小尺寸")
                    if codec not in {"h264", "hevc"}:
                        check(messages, "FAIL", f"ASSET-{i}", f"{relative} 视频编码为 {codec}，应为 H.264/HEVC")
                except Exception as exc:
                    check(messages, "FAIL", f"ASSET-{i}", f"视频无法通过 ffprobe 校验: {exc}")
            else:
                check(messages, "WARN", f"ASSET-{i}", f"{relative} 未找到 ffprobe，未验证录屏尺寸与编码；也不能判定录屏真实性")
        if not any(m["code"] == f"ASSET-{i}" and m["status"] == "FAIL" for m in messages):
            check(messages, "PASS", f"ASSET-{i}", f"文件已检查: {relative}")
    if screenshots < 3:
        check(messages, "FAIL", "SCREENSHOTS", f"需要至少 3 张实机截图，manifest 仅 {screenshots}")
    for k in promo_counts:
        if promo_counts[k] < 1:
            check(messages, "FAIL", "MATERIALS", f"manifest 缺少 {k}")
    check(messages, "INFO", "MANUAL", "本工具不能判断截图/视频是否来自真实游戏、版权是否合规、游戏内文案是否真实")


def check_package(messages, package: Path, target: str):
    if not package.is_file():
        check(messages, "FAIL", "PACKAGE", f"未找到包体: {package}")
        return
    size_mb = package.stat().st_size / (1024 * 1024)
    if target == "tap-mini":
        if package.suffix.lower() != ".zip":
            check(messages, "FAIL", "PACKAGE", "Tap 小游戏需要官方打包器指定 ZIP；当前文件扩展名不是 .zip")
        elif not zipfile.is_zipfile(package):
            check(messages, "FAIL", "PACKAGE", "ZIP 文件不能被识别")
        else:
            try:
                with zipfile.ZipFile(package) as archive:
                    names = archive.namelist()
                    if not names:
                        check(messages, "FAIL", "PACKAGE", "ZIP 文件为空")
                    if any(name.startswith("/") or ".." in Path(name).parts for name in names):
                        check(messages, "FAIL", "PACKAGE", "ZIP 存在不安全的路径项")
                    check(messages, "PASS", "PACKAGE", f"ZIP 文件结构可读取（{len(names)} 个条目）；但无法验证是否由官方 TapTap 打包工具生成")
            except Exception as exc:
                check(messages, "FAIL", "PACKAGE", f"ZIP 异常: {exc}")
        if size_mb >= 20:
            check(messages, "WARN", "SIZE_CONFLICT", f"包体 {size_mb:.2f} MiB 达到旧审核规范 20MB 水平；创建指南又写“60M+”，须核实当前后台实际限制")
        else:
            check(messages, "PASS", "SIZE_CONSERVATIVE", f"包体 {size_mb:.2f} MiB 小于保守的 20MiB 本地提示线；这不是平台审核结论")
    elif target == "apk":
        if package.suffix.lower() not in {".apk", ".aab", ".exe", ".zip"}:
            check(messages, "WARN", "PACKAGE", "文件后缀未识别为常见 APK/PC 产物；按当前平台确认")
        check(messages, "INFO", "PACKAGE", f"发现客户端产物 {size_mb:.2f} MiB，未进行 Android 签名或平台包体校验")
    else:
        check(messages, "INFO", "PACKAGE", f"发现包体 {size_mb:.2f} MiB；当前类型不适用 Tap 小游戏 ZIP 的硬编码检查")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--project", default=".", help="项目根目录")
    parser.add_argument("--target", choices=VALID_TARGETS, default="auto", help="实际发行形态；不明确时 auto")
    parser.add_argument("--package", help="已生成的包体文件，相对项目根目录")
    parser.add_argument("--version", help="待发布版本号，例如 V1.0.0")
    parser.add_argument("--asset-manifest", help="素材 JSON manifest 路径，相对项目根目录")
    parser.add_argument("--json", help="生成本地报告 JSON 路径")
    args = parser.parse_args()
    root = Path(args.project).resolve()
    messages = []
    if not root.is_dir():
        print(f"项目目录不存在: {root}", file=sys.stderr)
        return 2
    signals = project_flavor(root)
    check(messages, "INFO", "FLAVOR", "项目线索: " + (" / ".join(signals) if signals else "未检测到常见引擎特征"))
    if args.target == "auto":
        check(messages, "WARN", "ROUTING", "尚未确认 TapTap 发布形态；auto 不会根据文件名强行决定发布路线")
    else:
        check(messages, "INFO", "ROUTING", f"用户指定类型：{args.target}（仍需与实际后台判断依据一致）")
    if args.version is not None:
        if re.fullmatch(r"V\d+\.\d+\.\d+", args.version):
            check(messages, "PASS", "VERSION", f"版本号符合 Vx.y.z 格式：{args.version}；未与后台版本历史比对")
        else:
            check(messages, "FAIL", "VERSION", f"版本号不符合 Vx.y.z 格式：{args.version}")
    if args.package:
        check_package(messages, (root / args.package).resolve(), args.target)
    else:
        check(messages, "WARN", "PACKAGE", "未提供 --package，未检查包体")
    if args.asset_manifest:
        check_assets(messages, root, (root / args.asset_manifest).resolve())
    else:
        check(messages, "WARN", "ASSETS", "未提供 --asset-manifest，未检查宣传物料")
    check(messages, "INFO", "BOUNDARY", "只做本地静态预检；不替代游戏真机运行、平台格式/资质/隐私/审核结果")
    report = {
        "tool": "taptap-mini-game-publisher/preflight",
        "version": VERSION,
        "checked_at_utc": datetime.now(timezone.utc).isoformat(),
        "project": str(root),
        "target": args.target,
        "counts": {status: sum(m["status"] == status for m in messages) for status in ["PASS", "FAIL", "WARN", "INFO"]},
        "checks": messages,
    }
    print(f"TapTap 本地静态预检 v{VERSION} — {args.target}")
    for m in messages:
        print(f"[{m['status']:4}] {m['code']}: {m['message']}")
    print("汇总：" + ", ".join(f"{key}={value}" for key, value in report["counts"].items()))
    if args.json:
        output = Path(args.json).resolve()
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"已输出 JSON：{output}")
    return 2 if report["counts"]["FAIL"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
