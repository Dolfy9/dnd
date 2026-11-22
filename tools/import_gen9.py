"""Import extinguished source artwork and mark interactive assets."""
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path('/home/ubuntu/gen9')
manifest = ROOT / '11_Mapy/bojove/assets/assety.json'
data = json.loads(manifest.read_text())
for asset in data['assety']:
    off = SOURCE / (asset['id'] + '-vyp.webp')
    if off.exists():
        target = Path(asset['src']).with_name(asset['id'] + '-vyp.webp')
        shutil.copyfile(off, ROOT / '11_Mapy' / target)
        asset['srcVyp'] = str(target)
    if off.exists() or asset.get('light') or asset.get('anim') or 'portal' in asset['id']:
        asset['prepinatelny'] = True
manifest.write_text(json.dumps(data, ensure_ascii=False, indent=1) + '\n')
