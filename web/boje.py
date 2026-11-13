"""Uložené boje (11_Mapy/boje/<id>.json) a jejich rejstřík pro web (boje_index.json).

Rejstřík obsahuje metadata bojů (bez celého stavu) a seznamy kampaní, questů a sezení,
ke kterým jde boj přiřadit. Používá ho web/build.py i web/server.py.
"""
import json, re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIR = ROOT / "11_Mapy" / "boje"
ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,80}$")
META = ("id", "nazev", "stav", "kampan", "quest", "sezeni", "poznamky", "vysledek", "vytvoreno", "upraveno", "mapa")


def title(p: Path) -> str:
    for ln in p.read_text(encoding="utf-8").splitlines():
        if ln.startswith("# "):
            return re.sub(r"^(Kampaň|Quest|Sezení):\s*", "", ln[2:].strip())
    return p.stem.replace("_", " ")


def link_in(p: Path, label: str):
    m = re.search(r"\*\*" + label + r":\*\*.*?\]\(([^)]+\.md)\)", p.read_text(encoding="utf-8"))
    if not m:
        return ""
    return (p.parent / m.group(1)).resolve().relative_to(ROOT).as_posix() if (p.parent / m.group(1)).exists() else ""


def pages(folder, label=None):
    out = []
    for p in sorted((ROOT / folder).glob("*.md")):
        if p.name == "README.md":
            continue
        e = {"cesta": p.relative_to(ROOT).as_posix(), "nazev": title(p)}
        if label:
            e["kampan"] = link_in(p, label)
        out.append(e)
    return out


def summary(b):
    S = b.get("stav_boje") or {}
    e = {k: b.get(k, "") for k in META}
    e["kola"] = S.get("round", 0)
    e["ucastnici"] = [{"nazev": re.sub(r"<[^>]+>", "", str(t.get("nazev", ""))), "strana": t.get("side"), "hp": t.get("hp"), "max": t.get("max"), "mrtvy": bool(t.get("dead"))} for t in S.get("tok", [])]
    e["kroku"] = len(S.get("log", []))
    return e


def load_all():
    if not DIR.exists():
        return []
    out = []
    for p in sorted(DIR.glob("*.json")):
        try:
            out.append(json.loads(p.read_text(encoding="utf-8")))
        except ValueError:
            pass
    return out


def index_data():
    return {"boje": sorted((summary(b) for b in load_all()), key=lambda x: x.get("upraveno") or "", reverse=True),
            "kampane": pages("07_Kampane"), "questy": pages("08_Questy", "Kampaň"), "sezeni": pages("10_Sezeni", "Kampaň")}


def write_index(*dirs):
    txt = json.dumps(index_data(), ensure_ascii=False)
    for d in dirs:
        if Path(d).exists():
            (Path(d) / "boje_index.json").write_text(txt, encoding="utf-8")


def path_for(bid):
    if not ID_RE.match(bid or ""):
        raise ValueError("neplatné id boje")
    return DIR / f"{bid}.json"
