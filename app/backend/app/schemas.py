"""Schémata entit – definice formulářů pro strukturovaná data.

Soubor app/schemas/<typ>.json popisuje sekce a pole atributů daného typu entity.
Přidání pole do schématu = nový atribut pro VŠECHNY entity toho typu
(formulář, validace i mirror do frontmatteru se odvozují ze schématu).

Formát schématu:
{
  "type": "mesto", "label": "Město",
  "sections": [
    {"title": "Základy", "fields": [
      {"key": "nazev", "label": "Název", "type": "text", "required": true},
      {"key": "zeme", "label": "Země", "type": "link", "target": "zeme"},
      {"key": "velikost", "label": "Velikost", "type": "select",
       "options": ["osada", "vesnice", "městečko", "město", "metropole"]},
      {"key": "ctvrti", "label": "Čtvrti", "type": "list"},
      {"key": "obchody", "label": "Obchody", "type": "links", "target": "obchod"}
    ]}
  ]
}

Typy polí: text, textarea, number, select, checkbox, link, links, list, tags,
dict (objekt s fixními podpoli v "fields"), dictlist (seznam objektů, "fields").
"""
import json
from pathlib import Path

from .config import BACKEND, TYPE_LABELS

SCHEMA_DIR = (BACKEND.parent / "schemas").resolve()
_cache: dict[str, tuple[float, dict]] = {}


def schema_for(type_: str) -> dict:
    """Načte schéma typu (cache podle mtime – editace JSONu se projeví okamžitě)."""
    f = SCHEMA_DIR / f"{type_}.json"
    if not f.is_file():
        return {"type": type_, "label": TYPE_LABELS.get(type_, type_), "sections": []}
    m = f.stat().st_mtime
    c = _cache.get(type_)
    if c and c[0] == m:
        return c[1]
    try:
        data = json.loads(f.read_text(encoding="utf-8"))
    except Exception as e:
        return {"type": type_, "label": type_, "sections": [], "error": str(e)}
    _cache[type_] = (m, data)
    return data


def all_schemas() -> dict:
    return {f.stem: schema_for(f.stem) for f in sorted(SCHEMA_DIR.glob("*.json"))}


def save_schema(type_: str, data: dict) -> None:
    SCHEMA_DIR.mkdir(parents=True, exist_ok=True)
    (SCHEMA_DIR / f"{type_}.json").write_text(
        json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def validate(type_: str, data: dict) -> dict:
    """Ořízne data na klíče schématu a zvaliduje required pole.
    Neznámé klíče se zachovají (nemazat uživatelova data), jen se seřadí za známé."""
    if not isinstance(data, dict):
        return {}
    schema = schema_for(type_)
    known = {f["key"] for s in schema.get("sections", []) for f in s.get("fields", [])}
    out = {}
    for s in schema.get("sections", []):
        for f in s.get("fields", []):
            k = f["key"]
            v = data.get(k)
            if v is None or v == "" or v == [] or v == {}:
                if f.get("required") and v is None:
                    out[k] = ""
                continue
            t = f.get("type", "text")
            if t == "number":
                try:
                    v = int(v) if float(v) == int(float(v)) else float(v)
                except (TypeError, ValueError):
                    continue
            elif t == "checkbox":
                v = bool(v)
            elif t in ("list", "tags", "links") and isinstance(v, str):
                v = [x.strip() for x in v.split(",") if x.strip()]
            elif t == "link" and isinstance(v, list):
                v = v[0] if v else ""
            out[k] = v
    for k, v in data.items():
        if k not in known and v not in (None, "", [], {}):
            out[k] = v
    return out
