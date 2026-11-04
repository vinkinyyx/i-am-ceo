import hashlib
import json
import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
POINTER = OUT / 'archive-location.json'


def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def files(path):
    if path.is_file():
        yield path
    elif path.is_dir():
        for directory, _, names in os.walk(path):
            for name in names:
                yield Path(directory) / name


def dump(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf-8')


def prepare():
    archive = ROOT.parent / '_archives' / ROOT.name / ('cleanup-' + datetime.now().strftime('%Y%m%d-%H%M%S'))
    archive.mkdir(parents=True, exist_ok=False)
    (archive / 'README-before.md').write_bytes((ROOT / 'README.md').read_bytes())
    (archive / 'git-status-before.txt').write_bytes(subprocess.check_output(['git', 'status', '--short'], cwd=ROOT))
    protected = []
    for directory in ['assets', 'tests', 'tools', 'docs', 'skills', 'extensions', 'settings', 'profiles', 'design', 'audio', 'server', 'build-templates', '.creator']:
        for path in files(ROOT / directory):
            protected.append({'path': str(path.relative_to(ROOT)), 'sha256': digest(path)})
    dump(archive / 'protected-inputs-before.json', protected)
    targets = [p for p in (ROOT / 'build').iterdir() if p.name != 'release']
    targets += [p for p in (ROOT / 'build/release').iterdir() if p.name != 'm3-20261104-cloud-rank-r1']
    targets += [p for p in (ROOT / 'build/release/m3-20261104-cloud-rank-r1').iterdir() if p.name != '05']
    targets += [ROOT / 'library']
    targets += [p for p in (ROOT / 'temp').iterdir() if p.name not in ['declarations', 'tsconfig.cocos.json']]
    targets += [ROOT / p for p in ['.screenshots', 'node_modules/.vite'] if (ROOT / p).exists()]
    records = []
    for target in targets:
        target.resolve().relative_to(ROOT)
        entries = [{'path': str(p.relative_to(ROOT)), 'bytes': p.stat().st_size, 'sha256': digest(p)} for p in files(target)]
        records.append({'source': str(target), 'destination': str(archive / target.relative_to(ROOT)), 'files': entries})
    dump(archive / 'manifest.json', {'root': str(ROOT), 'archive': str(archive), 'targets': records})
    dump(POINTER, {'archive': str(archive)})
    print(json.dumps({'prepared': True, 'targets': len(records), 'protectedFiles': len(protected)}, ensure_ascii=False))


def verify():
    archive = Path(json.loads(POINTER.read_text(encoding='utf-8'))['archive'])
    manifest = json.loads((archive / 'manifest.json').read_text(encoding='utf-8'))
    entries = [entry for target in manifest['targets'] for entry in target['files']]
    for target in manifest['targets']:
        assert not Path(target['source']).exists(), target['source']
    for entry in entries:
        assert digest(archive / entry['path']) == entry['sha256'], entry['path']
    protected = json.loads((archive / 'protected-inputs-before.json').read_text(encoding='utf-8'))
    for entry in protected:
        assert digest(ROOT / entry['path']) == entry['sha256'], entry['path']
    result = dict(ok=True, archive=str(archive), movedTargets=len(manifest['targets']), movedFiles=len(entries), movedBytes=sum(e['bytes'] for e in entries), protectedFilesChecked=len(protected), archiveHashesVerified=True, protectedInputsUnchanged=True, permanentDeletion=False, remainingRelease='build/release/m3-20261104-cloud-rank-r1/05')
    result['movedMiB'] = round(result['movedBytes'] / 1048576, 2)
    dump(OUT / 'cleanup-result.json', result)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    {'prepare': prepare, 'verify': verify}[sys.argv[1]]()
