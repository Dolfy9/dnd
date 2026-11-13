"""Zrcadlení entit zpět do .md souborů.

DB je kanonická pro strukturovaná data (postava:/obchod:/druh: bloky),
tělo souboru zůstává netknuté. Při uložení entity se přepíše jen frontmatter
blok – soubor v gitu/Obsidianu tak dál ukazuje kompletní data.
"""
from pathlib import Path

import yaml

from ..config import ENTITY_KEY, ROOT
from . import markdown as M


def write_frontmatter(rel_path: str, type_key: str, data: dict, extra_meta: dict | None = None) -> None:
    """Přepíše YAML hlavičku souboru; tělo zůstane bajt po bajtu stejné."""
    p = ROOT / rel_path
    text = p.read_text(encoding="utf-8")
    meta, body, _ = M.split_front(text)
    meta = dict(meta)
    if type_key:
        meta[type_key] = data
    for k, v in (extra_meta or {}).items():
        meta[k] = v
    front = "---\n" + yaml.safe_dump(meta, allow_unicode=True, sort_keys=False, width=120) + "---\n"
    newline = "\r\n" if "\r\n" in text else "\n"
    if newline == "\r\n":
        front = front.replace("\n", "\r\n")
    p.write_text(front + body.lstrip("\r\n"), encoding="utf-8")


def type_key_for(type_: str) -> str:
    return ENTITY_KEY.get(type_, "")
