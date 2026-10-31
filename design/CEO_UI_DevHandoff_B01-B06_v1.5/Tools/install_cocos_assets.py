#!/usr/bin/env python3
"""Safely copy B06 PNGs into an existing Cocos Creator project.

DRY RUN by default. Does not touch or create Cocos .meta files.
Python 3, standard library only.

Usage:
  python Tools/install_cocos_assets.py /path/to/MyCocosProject
  python Tools/install_cocos_assets.py /path/to/MyCocosProject --apply
"""
import argparse
import hashlib
from pathlib import Path
import shutil
import sys


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('project_dir', type=Path)
    ap.add_argument('--apply', action='store_true', help='perform the copy; default is dry-run')
    args = ap.parse_args()
    project = args.project_dir.expanduser().resolve()
    if not (project / 'assets').is_dir() or not (project / 'project.json').is_file():
        print('ERROR: expected existing Cocos Creator project containing assets/ and project.json', file=sys.stderr)
        return 2
    package = Path(__file__).resolve().parents[1]
    source = package / 'CocosDropIn/assets/resources/ui'
    dest = project / 'assets/resources/ui'
    add = unchanged = conflicts = 0
    for png in sorted(source.rglob('*.png')):
        target = dest / png.relative_to(source)
        if target.exists():
            if digest(png) == digest(target):
                unchanged += 1
                continue
            print('CONFLICT (skipped):', target)
            conflicts += 1
            continue
        print(('COPY ' if args.apply else 'DRY-RUN ')+str(png.relative_to(source)))
        add += 1
        if args.apply:
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(png, target)
    print(f'new={add}, unchanged={unchanged}, conflicts={conflicts}, applied={args.apply}')
    return 1 if conflicts else 0


if __name__ == '__main__':
    raise SystemExit(main())
