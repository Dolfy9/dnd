#!/usr/bin/env bash
# Kompletní kontrola projektu: odkazy a index, JSON data, syntaxe JS, testy pravidel, build webu.
set -u
cd "$(dirname "$0")/.."
ok=0; fail=0
krok() { local n="$1"; shift; if "$@" >/tmp/kontrola_krok.log 2>&1; then echo "OK    $n"; ok=$((ok+1)); else echo "CHYBA $n"; tail -n 15 /tmp/kontrola_krok.log; fail=$((fail+1)); fi; }
krok "odkazy a index (tools/kontrola.py --index)" python3 tools/kontrola.py --index
krok "JSON data" python3 -c "
import json, pathlib, sys
bad = []
for p in list(pathlib.Path('web/assets').rglob('*.json')) + list(pathlib.Path('11_Mapy').glob('*.json')):
    try: json.loads(p.read_text(encoding='utf-8'))
    except Exception as e: bad.append(f'{p}: {e}')
print('\n'.join(bad)); sys.exit(1 if bad else 0)"
krok "pokrytí stránek druhů" python3 tools/kontrola_druhy.py
krok "bojové mapy (rozměry, obrázky)" python3 -c "
import json, pathlib, sys
d = json.loads(pathlib.Path('11_Mapy/bojove_mapy.json').read_text(encoding='utf-8')); err = []
for m in d['mapy']:
    w = {len(r) for r in m['mrizka']}
    if len(w) != 1: err.append(m['id'] + ': řádky mřížky mají různou délku')
    if m.get('obrazek') and not (pathlib.Path('11_Mapy') / m['obrazek']).exists(): err.append(m['id'] + ': chybí obrázek ' + m['obrazek'])
print('\n'.join(err)); sys.exit(1 if err else 0)"
krok "atlas mapy (svet.json, sprity)" node tools/kontrola_svet.js
for f in web/assets/*.js; do krok "syntaxe $f" node -e "new Function(require('fs').readFileSync('$f','utf8'))"; done
if [ -f /tmp/postavy.json ]; then krok "testy pravidel" node tools/test_pravidla.js /tmp/postavy.json; else krok "testy pravidel" node tools/test_pravidla.js; fi
krok "generování webu (web/build.py)" python3 web/build.py
krok "build MkDocs" bash -c "/usr/bin/python3 -m mkdocs build -q -f web/mkdocs.yml 2>&1 | grep -i 'error' && exit 1 || exit 0"
echo "Hotovo: $ok OK, $fail chyb."
[ "$fail" -eq 0 ]
