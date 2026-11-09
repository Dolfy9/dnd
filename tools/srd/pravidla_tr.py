"""Překlad textů povolání, subclass a druhů: python3 pravidla_tr.py dump N | lines soubor.txt | stav
Klíč = anglický text (odstavec), výsledek web/assets/preklad/pravidla_cs.json."""
import json, sys, re
from pathlib import Path
A = Path(__file__).resolve().parents[2] / "web/assets"
OUT = A / "preklad/pravidla_cs.json"; B = Path(__file__).with_name("_davka_pr.json")
def paras():
    p = json.load(open(A / "pravidla2024.json", encoding="utf-8")); out = []
    def add(t):
        for x in str(t or "").split("\n"):
            x = x.strip()
            if x and not x.startswith("|") and len(x) > 3: out.append(x)
    for n, c in p["tridy"].items():
        for f in (c.get("rysy") or {}).values(): add(f.get("text") if isinstance(f, dict) else f)
    for n, c in p["podtridy"].items():
        for f in (c.get("rysy") or {}).values(): add(f.get("text") if isinstance(f, dict) else f)
    for option in p.get("volby_trid", {}).values():
        feature = p["tridy"].get(option.get("trida"), {}).get("rysy", {}).get(option.get("feature"), {})
        add(feature.get("text") if isinstance(feature, dict) else feature)
    for n, c in p["druhy"].items():
        for f in (c.get("rysy") or {}).values(): add(f if isinstance(f, str) else f.get("text"))
    seen = set(); return [x for x in out if not (x in seen or seen.add(x))]
done = json.load(open(OUT, encoding="utf-8")) if OUT.exists() else {}
cmd = sys.argv[1]
if cmd == "dump":
    todo = [x for x in paras() if x not in done]
    print(f"zbývá {len(todo)} z {len(paras())}, znaků {sum(map(len, todo))}")
    b = todo[: int(sys.argv[2])]; json.dump(b, open(B, "w", encoding="utf-8"), ensure_ascii=False)
    for i, x in enumerate(b, 1): print(i, x)
elif cmd == "lines":
    b = json.load(open(B, encoding="utf-8")); L = [l.rstrip("\n") for l in open(sys.argv[2], encoding="utf-8") if l.strip()]
    assert len(L) == len(b), (len(L), len(b))
    done.update(dict(zip(b, L))); json.dump(done, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=0, sort_keys=True)
    print("přeloženo", len(done), "z", len(paras()))
else:
    print(len(done), "z", len(paras()))
