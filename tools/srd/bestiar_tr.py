"""Překlad bestiáře: python3 bestiar_tr.py dump N | merge soubor.json | stav
Mechanická hlavička útoků se převádí automaticky, ručně se překládá jen popisný text (segmenty).
Výsledek: web/assets/preklad/bestiar_cs.json  {anglický text: český text}."""
import json, re, sys, os
from pathlib import Path
A = Path(__file__).resolve().parents[2] / "web/assets"
SEG = Path(__file__).with_name("bestiar_segmenty_cs.json")
OUT = A / "preklad/bestiar_cs.json"
KEYS = ["rysy", "akce", "bonusove_akce", "reakce", "legendarni"]
HEAD = re.compile(r"^((?:Melee|Ranged|Melee or Ranged) Attack Roll: [^.]*?ft\.(?: \d+ \([^)]*\)| \d+) [A-Z][a-z]+ damage(?: plus \d+ \([^)]*\) [A-Z][a-z]+ damage)*\.)\s*(.*)$", re.S)

def head_cs(h):
    return (h.replace(", reach ", ", dosah ").replace(" or range ", " nebo dostřel ").replace(", range ", ", dostřel ")
             .replace(" damage plus ", " damage plus "))

def texts():
    b = json.load(open(A / "srd/bestiar.json", encoding="utf-8"))
    return sorted({e["text"] for m in b for k in KEYS for e in (m.get(k) or []) if e.get("text")})

def split(t):
    m = HEAD.match(t)
    return (m.group(1), m.group(2)) if m else (None, t)

NUM = re.compile(r"\d+")
def tpl(s):
    nums = NUM.findall(s); i = iter(range(len(nums)))
    return NUM.sub(lambda m: "{%d}" % next(i), s), nums
def fill(t, nums):
    return re.sub(r"\{(\d+)\}", lambda m: nums[int(m.group(1))], t)
def tr(seg, done):
    t, nums = tpl(seg)
    return fill(done[t], nums) if t in done else None
def segs():
    return sorted({tpl(s)[0] for t in texts() for s in [split(t)[1]] if s.strip()})

def compose(done):
    out = {}
    for t in texts():
        h, tail = split(t)
        c = tr(tail, done) if tail.strip() else ""
        if c is None: continue
        out[t] = ((head_cs(h) + " ") if h else "") + c
        out[t] = out[t].strip()
    json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=0, sort_keys=True)
    return len(out), len(texts())

done = json.load(open(SEG, encoding="utf-8")) if SEG.exists() else {}
cmd = sys.argv[1]
if cmd == "dump":
    todo = [s for s in segs() if s not in done]
    print(f"zbývá {len(todo)} z {len(segs())}, znaků {sum(map(len, todo))}")
    B = todo[: int(sys.argv[2])]
    json.dump(B, open(Path(__file__).with_name("_davka.json"), "w", encoding="utf-8"), ensure_ascii=False)
    for i, s in enumerate(B, 1): print(i, s)
elif cmd == "lines":
    B = json.load(open(Path(__file__).with_name("_davka.json"), encoding="utf-8"))
    L = [l.rstrip("\n").replace("\\n", "\n") for l in open(sys.argv[2], encoding="utf-8") if l.strip()]
    assert len(L) == len(B), (len(L), len(B))
    for b, l in zip(B, L):
        miss = set(re.findall(r"\{\d+\}", b)) ^ set(re.findall(r"\{\d+\}", l))
        if miss: print("NESEDÍ ZÁSTUPCI", miss, l[:80])
    done.update(dict(zip(B, L)))
    json.dump(done, open(SEG, "w", encoding="utf-8"), ensure_ascii=False, indent=0, sort_keys=True)
    print("segmentů", len(done), "plných textů %d/%d" % compose(done))
elif cmd == "merge":
    done.update(json.load(open(sys.argv[2], encoding="utf-8")))
    json.dump(done, open(SEG, "w", encoding="utf-8"), ensure_ascii=False, indent=0, sort_keys=True)
    print("segmentů", len(done), "plných textů %d/%d" % compose(done))
else:
    print("plných textů %d/%d" % compose(done))
