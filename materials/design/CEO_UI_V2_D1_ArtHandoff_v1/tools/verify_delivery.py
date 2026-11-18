from pathlib import Path
from PIL import Image
import json
H=Path('materials/design/CEO_UI_V2_D1_ArtHandoff_v1'); m=json.loads((H/'manifest.json').read_text(encoding='utf-8')); ids=[x['asset_id'] for x in m['assets']]
expected=[*[f'OLD-NAV-{n:02}' for n in range(3,10)],*[f'ICO-D{n:02}' for n in range(1,7)],'ILL-S07','ILL-S15','OLD-AV-02','OLD-AV-03','ILL-S06','ILL-S08','ILL-S09',*[f'OLD-AV-{n:02}' for n in range(4,25)],'ICO-K03','ICO-K04','ICO-K07','RANK-01','RANK-02','RANK-03']
assert len(ids)==47 and sorted(ids)==sorted(expected),(len(ids),set(expected)-set(ids),set(ids)-set(expected))
for a in m['assets']:
 for k in ['file','source','master']:
  assert (H/a[k]).is_file(),(a['asset_id'],k,a[k])
 for v in a['preview']: assert (H/v).is_file(),(a['asset_id'],v)
 with Image.open(H/a['file']) as im:
  assert im.size==(a['width'],a['height']) and im.mode==a['mode'],a['asset_id']
assert all(x['source_key'] for x in json.loads(Path('docs/ui-design/03_Asset_Registry_V2.json').read_text(encoding='utf-8')) if x['asset_id'] in ids and x['asset_id'].startswith(('OLD-AV','OLD-NAV','ICO-D')))
print('PASS: 47 IDs, source/master/previews, measured PNG specs, B06 source keys')
