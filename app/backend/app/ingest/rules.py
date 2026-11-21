"""Import knihovny pravidel → tabulka rules + rules_fts.

Zdroje (JSON v repu): pravidla2024.json (druhy/tridy/podtridy/pozadi/featy),
kouzla2024.json, srd/bestiar.json, srd/predmety.json, srd/glosar.json,
srd/puvod_a_featy.json. České překlady z web/assets/preklad se slévají do data.cs.
"""
import json
from pathlib import Path

from .. import db
from ..config import ROOT
from . import markdown as M

A = ROOT / "web" / "assets"


def _j(path: Path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return default


def _plain_text(value) -> str:
    """Z libovolné JSON hodnoty udělá prohledávatelný text."""
    if isinstance(value, dict):
        return " ".join(_plain_text(v) for v in value.values())
    if isinstance(value, list):
        return " ".join(_plain_text(v) for v in value)
    return M.plaintext(str(value))


def _put(con, kind: str, key: str, name: str, data: dict) -> None:
    con.execute(
        "INSERT INTO rules(kind,key,name,data) VALUES(?,?,?,?)"
        " ON CONFLICT(kind,key) DO UPDATE SET name=excluded.name, data=excluded.data",
        (kind, key, name, db.jdump(data)))
    row = con.execute("SELECT id FROM rules WHERE kind=? AND key=?", (kind, key)).fetchone()
    con.execute("DELETE FROM rules_fts WHERE kind=? AND key=?", (kind, key))
    con.execute("INSERT INTO rules_fts(kind,key,name,text) VALUES(?,?,?,?)",
                (kind, key, name, _plain_text(data)[:20000]))


def load() -> dict:
    con = db.connect()
    counts: dict[str, int] = {}

    def cnt(kind):
        counts[kind] = counts.get(kind, 0) + 1

    cs_preklad = {
        "monster": _j(A / "preklad" / "bestiar_cs.json", {}),
        "spell": _j(A / "preklad" / "kouzla_cs.json", {}),
        "glossary": _j(A / "preklad" / "glosar_cs.json", {}),
    }

    rules2024 = _j(A / "pravidla2024.json", {})
    for kind, section in (("species", "druhy"), ("class", "tridy"), ("subclass", "podtridy"),
                          ("background", "pozadi"), ("feat", "featy")):
        for key, item in (rules2024.get(section) or {}).items():
            if not isinstance(item, dict):
                item = {"text": item}
            name = item.get("nazev") or key
            _put(con, kind, key, str(name), item)
            cnt(kind)

    for key, item in _j(A / "kouzla2024.json", {}).items():
        if not isinstance(item, dict):
            continue
        name = item.get("nazev") or item.get("name") or key
        data = dict(item)
        if key in cs_preklad.get("spell", {}):
            data["cs"] = cs_preklad["spell"][key]
        _put(con, "spell", key, str(name), data)
        cnt("spell")

    for item in _j(A / "srd" / "bestiar.json", []):
        name = item.get("nazev") or item.get("name") or "?"
        key = item.get("name") or name
        data = dict(item)
        if key in cs_preklad.get("monster", {}):
            data["cs"] = cs_preklad["monster"][key]
        _put(con, "monster", str(key), str(name), data)
        cnt("monster")

    for item in _j(A / "srd" / "predmety.json", []):
        name = item.get("nazev") or item.get("name") or "?"
        _put(con, "item", str(item.get("name") or name), str(name), dict(item))
        cnt("item")

    for item in _j(A / "srd" / "glosar.json", []):
        name = item.get("nazev") or item.get("name") or "?"
        data = dict(item)
        key = str(item.get("name") or name)
        if key in cs_preklad.get("glossary", {}):
            data["cs"] = cs_preklad["glossary"][key]
        _put(con, "glossary", key, str(name), data)
        cnt("glossary")

    for item in _j(A / "srd" / "puvod_a_featy.json", []):
        if not isinstance(item, dict):
            continue
        name = item.get("nazev") or item.get("name") or "?"
        kind = {"background": "background_srd", "feat": "feat_srd", "race": "species_srd"}.get(
            item.get("druh"), "feat_srd")
        _put(con, kind, str(item.get("name") or name), str(name), dict(item))
        cnt(kind)

    # vlastní obsah z entit (po oficiálních, aby ho případný přepis nezničil)
    for k2, n in load_custom(con).items():
        counts[f"custom:{k2}"] = n

    con.commit()
    return counts


# ---------- vlastní (homebrew) obsah z entit ----------
# typ entity → kind v tabulce rules
TYPE_KIND = {"druh": "species", "povolani": "class", "podtrida": "subclass",
             "feat": "feat", "kouzlo": "spell", "predmet": "item",
             "pozadi": "background"}
# typy, které jsou vždy vlastní (nové složky 16_–19_)
ALWAYS_CUSTOM = {"feat", "kouzlo", "predmet", "pozadi"}


def _rysy_map(rysy) -> dict:
    """Seznam [{nazev,uroven?,text,efekty?}] → {nazev: {...}} jako oficiální data."""
    out = {}
    for r in rysy or []:
        if not isinstance(r, dict) or not r.get("nazev"):
            continue
        row = {"text": r.get("text") or ""}
        if r.get("uroven") is not None:
            row["uroven"] = r.get("uroven")
        if r.get("efekty"):
            row["efekty"] = r["efekty"]
        out[str(r["nazev"])] = row
    return out


def normalize_custom(typ: str, data: dict, path: str) -> dict:
    """Převede frontmatter entity na tvar oficiálního řádku rules + vlastni/stranka."""
    d = dict(data or {})
    out: dict = {}
    if typ == "druh":
        for k in ("velikost", "rychlost", "typ", "delka_zivota", "efekty"):
            if d.get(k) is not None:
                out[k] = d[k]
        if d.get("rysy"):
            out["rysy"] = _rysy_map(d["rysy"])
    elif typ == "povolani":
        for k in ("hit_die", "primarni_atribut", "zachrany", "dovednosti_volba",
                  "zbroj", "zbrane", "nastroje", "kouzleni", "tabulka",
                  "podtrida_uroven", "asi_urovne", "efekty", "podtridy"):
            if d.get(k) is not None:
                out[k] = d[k]
        if d.get("rysy"):
            out["rysy"] = _rysy_map(d["rysy"])
    elif typ == "podtrida":
        for k in ("trida", "kouzla_vzdy", "kouzleni", "efekty"):
            if d.get(k) is not None:
                out[k] = d[k]
        if d.get("rysy"):
            out["rysy"] = _rysy_map(d["rysy"])
    elif typ == "feat":
        for k in ("kategorie", "predpoklad", "opakovatelny", "text", "efekty"):
            if d.get(k) is not None:
                out[k] = d[k]
    elif typ == "kouzlo":
        for k in ("uroven", "skola", "cas", "dosah", "slozky", "trvani",
                  "koncentrace", "ritual", "tridy", "text", "vyssi_urovne"):
            if d.get(k) is not None:
                out[k] = d[k]
    elif typ == "predmet":
        for k in ("typ", "vzacnost", "naladeni", "hmotnost", "cena",
                  "zbroj", "zbran", "text", "efekty"):
            if d.get(k) is not None:
                out[k] = d[k]
    elif typ == "pozadi":
        for k in ("atributy", "feat", "dovednosti", "nastroj", "vybava", "text"):
            if d.get(k) is not None:
                out[k] = d[k]
    out["nazev"] = d.get("nazev")
    out["vlastni"] = True
    out["stranka"] = path
    return out


def upsert_entity(con, typ: str, path: str, name: str, data: dict) -> None:
    """Přírůstkový upsert vlastní entity do rules (volá importer)."""
    kind = TYPE_KIND.get(typ)
    if not kind:
        return
    is_custom = typ in ALWAYS_CUSTOM or (isinstance(data, dict) and data.get("vlastni"))
    if not is_custom:
        # neoficiální stránka nesmí přepsat oficiální pravidla
        remove_path(con, path)
        return
    nd = normalize_custom(typ, data, path)
    key = str(nd.get("nazev") or name or path)
    _put(con, kind, key, str(name or key), nd)


def remove_path(con, path: str) -> None:
    """Smaže vlastní řádky rules pocházející ze souboru (delete/rename)."""
    rows = con.execute(
        "SELECT kind,key FROM rules WHERE json_extract(data,'$.stranka')=?",
        (path,)).fetchall()
    for r in rows:
        con.execute("DELETE FROM rules WHERE kind=? AND key=?", (r["kind"], r["key"]))
        con.execute("DELETE FROM rules_fts WHERE kind=? AND key=?", (r["kind"], r["key"]))


def load_custom(con) -> dict:
    """Znovu načte všechny vlastní řádky z tabulky entities (voláno po load())."""
    con.execute("DELETE FROM rules WHERE json_extract(data,'$.vlastni')=1")
    con.execute("DELETE FROM rules_fts WHERE NOT EXISTS "
                "(SELECT 1 FROM rules r2 WHERE r2.kind=rules_fts.kind AND r2.key=rules_fts.key)")
    ph = ",".join("?" * len(TYPE_KIND))
    rows = con.execute(
        f"SELECT type,path,name,data FROM entities WHERE type IN ({ph})",
        tuple(TYPE_KIND)).fetchall()
    counts: dict[str, int] = {}
    for r in rows:
        typ = r["type"]
        data = db.jload(r["data"]) or {}
        is_custom = typ in ALWAYS_CUSTOM or data.get("vlastni")
        if not is_custom:
            continue
        nd = normalize_custom(typ, data, r["path"])
        key = str(nd.get("nazev") or r["name"] or r["path"])
        _put(con, TYPE_KIND[typ], key, str(r["name"] or key), nd)
        counts[TYPE_KIND[typ]] = counts.get(TYPE_KIND[typ], 0) + 1
    return counts
