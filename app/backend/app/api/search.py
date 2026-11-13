"""Vyhledávání: FTS5 přes stránky, entity a knihovnu pravidel.

Hráči: jen hráčsky bezpečný index (pages_fts, entities, rules).
Editor/admin: navíc dm_fts (Pro DM sekce) a tajné stránky.
FTS5 dotaz: jednoduchá slova → "slovo* slovo2*"; LIKE fallback pro krátké/dotazy s diakritikou.
"""
import re

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from .. import db, render, security

router = APIRouter(prefix="/api/search", tags=["search"])

_KIND_LABELS = {
    "spell": "Kouzlo", "monster": "Netvor", "item": "Předmět", "glossary": "Pojem",
    "species": "Druh", "class": "Povolání", "subclass": "Podtřída",
    "background": "Pozadí", "feat": "Feat", "background_srd": "Pozadí (SRD)",
    "feat_srd": "Feat (SRD)", "species_srd": "Druh (SRD)",
}


def _fts_query(q: str) -> str:
    words = re.findall(r"[\wěščřžýáíéúůóďťňĚŠČŘŽÝÁÍÉÚŮÓĎŤŇ]+", q.lower())
    return " ".join(w + "*" for w in words[:8])


def _snippet(text: str, q: str, width: int = 160) -> str:
    if not text:
        return ""
    m = re.search(re.escape(q.split()[0]) if q.split() else ".", text, re.I)
    if not m:
        return text[:width] + ("…" if len(text) > width else "")
    s = max(0, m.start() - 60)
    e = min(len(text), m.end() + 100)
    return ("…" if s else "") + text[s:e] + ("…" if e < len(text) else "")


@router.get("")
def search(q: str = "", scope: str = "", limit: int = 12,
           u: dict | None = Depends(security.optional)):
    q = q.strip()
    if len(q) < 2:
        return {"q": q, "groups": {}}
    editor = security.can_edit(u)
    con = db.connect()
    fq = _fts_query(q)
    like = f"%{q}%"
    groups: dict[str, list] = {"Stránky": [], "Entity": [], "Knihovna pravidel": [], "Pro DM": []}

    # --- stránky (hráčský index) ---
    try:
        rows = con.execute(
            "SELECT p.path,p.title,p.type,p.status,p.secret,snippet(pages_fts,2,'<b>','</b>','…',12) s"
            " FROM pages_fts f JOIN pages p ON p.path=f.path"
            " WHERE pages_fts MATCH ? ORDER BY rank LIMIT ?", (fq, limit * 2)).fetchall()
    except Exception:
        rows = con.execute(
            "SELECT path,title,type,status,secret,plaintext s FROM pages"
            " WHERE title LIKE ? OR plaintext LIKE ? LIMIT ?", (like, like, limit * 2)).fetchall()
    for r in rows:
        if r["secret"] and not editor:
            continue
        groups["Stránky"].append({"path": r["path"], "title": r["title"], "type": r["type"],
                                  "status": r["status"], "url": render.page_url(r["path"]),
                                  "snippet": re.sub(r"</?b>", "", r["s"] or "")})

    # --- entity ---
    try:
        rows = con.execute(
            "SELECT e.id,e.type,e.name,e.path,e.status,p.secret FROM entities_fts f"
            " JOIN entities e ON e.id=f.id LEFT JOIN pages p ON p.path=e.path"
            " WHERE entities_fts MATCH ? LIMIT ?", (fq, limit)).fetchall()
    except Exception:
        rows = con.execute(
            "SELECT e.id,e.type,e.name,e.path,e.status,p.secret FROM entities e"
            " LEFT JOIN pages p ON p.path=e.path WHERE e.name LIKE ? LIMIT ?", (like, limit)).fetchall()
    for r in rows:
        if r["secret"] and not editor:
            continue
        groups["Entity"].append({"id": r["id"], "type": r["type"], "name": r["name"],
                                 "path": r["path"], "status": r["status"],
                                 "url": render.page_url(r["path"])})

    # --- knihovna pravidel ---
    try:
        rows = con.execute(
            "SELECT kind,key,name,snippet(rules_fts,3,'','','…',10) s FROM rules_fts"
            " WHERE rules_fts MATCH ? LIMIT ?", (fq, limit)).fetchall()
    except Exception:
        rows = con.execute("SELECT kind,key,name,'' s FROM rules WHERE name LIKE ? LIMIT ?",
                           (like, limit)).fetchall()
    for r in rows:
        groups["Knihovna pravidel"].append({"kind": r["kind"], "kind_label": _KIND_LABELS.get(r["kind"], r["kind"]),
                                            "key": r["key"], "name": r["name"],
                                            "url": f"/katalog/{r['kind']}#{r['key']}"})

    # --- Pro DM (jen editoři) ---
    if editor:
        try:
            rows = con.execute(
                "SELECT p.path,p.title,snippet(dm_fts,2,'','','…',10) s FROM dm_fts f"
                " JOIN pages p ON p.path=f.path WHERE dm_fts MATCH ? LIMIT ?",
                (fq, limit)).fetchall()
            for r in rows:
                groups["Pro DM"].append({"path": r["path"], "title": r["title"],
                                         "url": render.page_url(r["path"]), "snippet": r["s"]})
        except Exception:
            pass

    return {"q": q, "groups": {k: v for k, v in groups.items() if v}}
