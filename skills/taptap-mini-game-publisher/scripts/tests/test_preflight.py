"""纯本地标准库测试；图像维度测试需 Pillow。"""
import importlib.util
import json
import subprocess
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

SCRIPT = Path(__file__).parents[1] / "preflight.py"


class PreflightTests(unittest.TestCase):
    def run_script(self, base, *args):
        return subprocess.run([sys.executable, str(SCRIPT), "--project", str(base), *args], capture_output=True, text=True)

    def test_valid_version_and_zip(self):
        with tempfile.TemporaryDirectory() as d:
            base = Path(d)
            with zipfile.ZipFile(base / "game.zip", "w") as archive:
                archive.writestr("game.js", "console.log('test')")
            res = self.run_script(base, "--target", "tap-mini", "--version", "V1.2.3", "--package", "game.zip")
            self.assertEqual(res.returncode, 0, res.stdout + res.stderr)
            self.assertIn("PACKAGE", res.stdout)
            self.assertIn("PASS", res.stdout)

    def test_bad_version(self):
        with tempfile.TemporaryDirectory() as d:
            res = self.run_script(d, "--version", "1.0.0")
            self.assertEqual(res.returncode, 2)
            self.assertIn("不符合 Vx.y.z", res.stdout)

    def test_bad_manifest(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            (root / "assets.json").write_text(json.dumps({"materials": []}), encoding="utf-8")
            res = self.run_script(d, "--asset-manifest", "assets.json")
            self.assertEqual(res.returncode, 2)
            self.assertIn("SCREENSHOTS", res.stdout)

    def test_untrusted_manifest_path(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            (root / "assets.json").write_text(json.dumps({"materials": [
                {"kind": "icon", "path": "../outside.png"},
            ]}), encoding="utf-8")
            res = self.run_script(d, "--asset-manifest", "assets.json")
            self.assertEqual(res.returncode, 2)
            self.assertIn("路径逃逸", res.stdout)

    def test_valid_assets_when_pillow_available(self):
        try:
            from PIL import Image
        except ImportError:
            self.skipTest("Pillow is not installed")
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            imgs = [("landscape_promo", "land.png", (1920, 1080)),
                    ("square_promo", "square.png", (1440, 1440)),
                    ("screenshot", "s1.png", (720, 1280)),
                    ("screenshot", "s2.png", (720, 1280)),
                    ("screenshot", "s3.png", (720, 1280)),
                    ("icon", "icon.png", (512, 512))]
            for _, name, dims in imgs:
                Image.new("RGB", dims).save(root / name)
            (root / "record.mp4").write_bytes(b"not a real movie")
            assets = [{"kind": kind, "path": name} for kind, name, _ in imgs]
            assets.append({"kind": "gameplay_video", "path": "record.mp4"})
            (root / "assets.json").write_text(json.dumps({"materials": assets}), encoding="utf-8")
            res = self.run_script(d, "--asset-manifest", "assets.json")
            self.assertIn("land.png", res.stdout)
            self.assertIn("square.png", res.stdout)
            self.assertIn("视频无法通过 ffprobe 校验", res.stdout)  # ffprobe cannot decode placeholder file


if __name__ == "__main__":
    unittest.main()
