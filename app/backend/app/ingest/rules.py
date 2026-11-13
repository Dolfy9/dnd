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

    con.commit()
    return counts
