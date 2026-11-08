import re, json
import os as _os
ROOT = _os.path.abspath(_os.path.join(_os.path.dirname(__file__), "..", ".."))
t = open('glosar_raw.txt', encoding='utf-8').read()
t = t.split('Rules Definitions', 1)[-1] if 'Rules Definitions' in t else t
lines = [l.strip() for l in t.splitlines()]
out, cur = [], None
for l in lines:
    if not l or re.fullmatch(r'\d+', l): continue
    m = re.fullmatch(r"([A-Z][A-Za-z'’ \-]{2,40})(?: \[([A-Za-z ]+)\])?", l)
    if m and len(l.split()) <= 5 and not l.endswith('.'):
        cur = {"nazev": m.group(1).strip(), "stitek": m.group(2) or "", "text": ""}; out.append(cur); continue
    if cur: cur["text"] += (" " if cur["text"] and not cur["text"].endswith("-") else "") + l
out = [o for o in out if len(o["text"]) > 40]
json.dump(out, open('" + ROOT + "/web/assets/srd/glosar.json', 'w'), ensure_ascii=False)
print(len(out), [o["nazev"] for o in out[:8]])
