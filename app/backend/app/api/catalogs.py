"""Katalogy: postavy, obchody, druhy + generický přístup k entitám podle typu.

Nahrazuje statické *_index.json + pravidla_katalog/postavy/obchody/druhy.js.
Každý katalog vrací {facets, items} – facety pro filtry v UI.
"""
import re
from pathlib import Path

from fastapi import APIRouter, Depends

from .. import db, render, security
from ..config import ROOT
from .listing import paginate

router = APIRouter(prefix="/api/catalog", tags=["catalog"])

FACETS = {"zeme": "02_Zeme/", "mesta": "03_Mesta/", "frakce": "05_Frakce/", "kampane": "07_Kampane/"}


def _portrait(path: str, data: dict) -> str:
    override = data.get("portret")
    if override and (ROOT / str(override)).is_file():
        return "/" + str(override)
    cand = ROOT / "04_Postavy" / "obrazky" / (Path(path).stem + ".webp")
    return f"/04_Postavy/obrazky/{cand.name}" if cand.is_file() else ""


@router.get("/postavy")
def postavy(q: str = "", sort: str = "name", order: str = "asc",
            page: int = 1, size: int = 0,
            u: dict | None = Depends(security.optional)):
    con = db.connect()
    editor = security.can_edit(u)
    rows = con.execute(
        "SELECT e.*, p.secret FROM entities e LEFT JOIN pages p ON p.path=e.path"
        " WHERE e.type='postava' ORDER BY e.name").fetchall()
    title_of = {r["path"]: r["title"] for r in con.execute("SELECT path,title FROM pages")}
    items = []
    for e in rows:
        if e["secret"] and not editor:
            continue
        data = db.jload(e["data"])
        tridy = " / ".join(
            f"{t.get('trida','')} {t.get('uroven','')}".strip() +
            (f" ({t.get('podtrida')})" if t.get("podtrida") else "")
            for t in (data.get("tridy") or []) if isinstance(t, dict))
        vazby = {}
        for facet, prefix in FACETS.items():
            vazby[facet] = [
                {"path": t, "title": title_of.get(t, t)}
                for t in (data.get(facet) or []) if isinstance(t, str) and t.startswith(prefix)]
        linked = {r["src"] for r in con.execute(
            "SELECT src FROM links WHERE dst=? AND kind IN ('link','fm')", (e["path"],))}
        items.append({
            "id": e["id"], "path": e["path"], "url": render.page_url(e["path"]),
            "name": e["name"], "titul": data.get("titul", ""), "druh": data.get("druh", ""),
            "tridy": tridy, "statblok": data.get("statblok", ""),
            "uroven": sum(int(t.get("uroven") or 0) for t in (data.get("tridy") or []) if isinstance(t, dict)),
            "portret": _portrait(e["path"], data), "status": e["status"],
            "tags": db.jload(e["tags"], []), "vazby": vazby,
            "zmínky": len(linked),
        })
    return paginate(items, q=q, q_fields=("name", "titul", "druh", "tridy", "tags"),
                    sort=sort, order=order, page=page, size=size)


@router.get("/obchody")
def obchody(q: str = "", sort: str = "name", order: str = "asc",
            page: int = 1, size: int = 0,
            u: dict | None = Depends(security.optional)):
    con = db.connect()
    editor = security.can_edit(u)
    rows = con.execute(
        "SELECT e.*, p.secret FROM entities e LEFT JOIN pages p ON p.path=e.path"
        " WHERE e.type='obchod' ORDER BY e.name").fetchall()
    names = {r["path"]: r["title"] for r in con.execute("SELECT path,title FROM pages")}
    people = {r["path"]: r["name"] for r in con.execute(
        "SELECT path,name FROM entities WHERE type='postava'")}
    items = []
    for e in rows:
        if e["secret"] and not editor:
            continue
        d = db.jload(e["data"])
        items.append({
            "id": e["id"], "path": e["path"], "url": render.page_url(e["path"]),
            "name": d.get("nazev") or e["name"], "typ": d.get("typ", ""),
            "majitel": [{"path": p_, "name": people.get(p_, p_)} for p_ in
                        ([d.get("majitel")] if isinstance(d.get("majitel"), str)
                         else d.get("majitel") or [])],
            "personal": [{"path": p_, "name": people.get(p_, p_)} for p_ in d.get("personal") or []],
            "mesto": {"path": d.get("mesto", ""), "title": names.get(d.get("mesto"), "")},
            "zeme": {"path": d.get("zeme", ""), "title": names.get(d.get("zeme"), "")},
            "ctvrt": d.get("ctvrt", ""), "oteviraci_doba": d.get("oteviraci_doba", ""),
            "tags": d.get("stitky") or [], "status": e["status"],
            "nabidka": d.get("nabidka") or [], "sluzby": d.get("sluzby") or [],
        })
    return paginate(items, q=q, q_fields=("name", "typ", "ctvrt", "tags"),
                    sort=sort, order=order, page=page, size=size)


@router.get("/druhy")
def druhy(q: str = "", sort: str = "name", order: str = "asc",
          page: int = 1, size: int = 0,
          u: dict | None = Depends(security.optional)):
    con = db.connect()
    rows = con.execute(
        "SELECT e.*, p.secret FROM entities e LEFT JOIN pages p ON p.path=e.path"
        " WHERE e.type='druh' ORDER BY e.name").fetchall()
    editor = security.can_edit(u)
    items = []
    for e in rows:
        if e["secret"] and not editor:
            continue
        d = db.jload(e["data"])
        stem = Path(e["path"]).stem
        items.append({
            "id": e["id"], "path": e["path"], "url": render.page_url(e["path"]),
            "name": d.get("nazev") or e["name"], "zdroj": d.get("zdroj", ""),
            "edice": d.get("edice", ""), "legacy": bool(d.get("legacy")),
            "velikost": d.get("velikost", ""), "rychlost": d.get("rychlost", ""),
            "typ": d.get("typ", ""), "status": e["status"],
            "obrazek": (ROOT / "13_Druhy" / "obrazky" / (stem + ".webp")).is_file(),
        })
    return paginate(items, q=q, q_fields=("name", "zdroj", "typ", "velikost"),
                    sort=sort, order=order, page=page, size=size)


@router.get("/entity/{type_}")
def by_type(type_: str, q: str = "", sort: str = "name", order: str = "asc",
            page: int = 1, size: int = 0,
            u: dict | None = Depends(security.optional)):
    con = db.connect()
    rows = con.execute(
        "SELECT e.*, p.secret FROM entities e LEFT JOIN pages p ON p.path=e.path"
        " WHERE e.type=? ORDER BY e.name", (type_,)).fetchall()
    editor = security.can_edit(u)
    items = [
        {"id": e["id"], "path": e["path"], "url": render.page_url(e["path"]), "name": e["name"],
         "status": e["status"], "tags": db.jload(e["tags"], [])}
        for e in rows if not e["secret"] or editor]
    return paginate(items, q=q, q_fields=("name", "tags"),
                    sort=sort, order=order, page=page, size=size)
