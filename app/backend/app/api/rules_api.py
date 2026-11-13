"""Knihovna pravidel: katalogy (kouzla, bestiář, předměty, glosář, druhy,
povolání, podtřídy, pozadí, featy) + detail pro popovery (#srd-…)."""
from fastapi import APIRouter, Depends, HTTPException

from .. import db, security
from .listing import paginate

router = APIRouter(prefix="/api/rules", tags=["rules"])

KINDS = ("spell", "monster", "item", "glossary", "species", "class", "subclass",
         "background", "feat", "background_srd", "feat_srd", "species_srd")


@router.get("/kinds")
def kinds(u: dict | None = Depends(security.optional)):
    rows = db.connect().execute(
        "SELECT kind,count(*) c FROM rules GROUP BY kind ORDER BY kind").fetchall()
    return {"kinds": [{"kind": r["kind"], "count": r["c"]} for r in rows]}


@router.get("/list/{kind}")
def list_rules(kind: str, q: str = "", sort: str = "name", order: str = "asc",
               page: int = 1, size: int = 0,
               u: dict | None = Depends(security.optional)):
    if kind not in KINDS:
        raise HTTPException(404, "neznámý druh")
    con = db.connect()
    if q:
        rows = con.execute(
            "SELECT key,name,data FROM rules WHERE kind=? AND name LIKE ? ORDER BY name LIMIT 2000",
            (kind, f"%{q}%")).fetchall()
    else:
        rows = con.execute("SELECT key,name,data FROM rules WHERE kind=? ORDER BY name", (kind,)).fetchall()
    items = [{"key": r["key"], "name": r["name"], "data": db.jload(r["data"])} for r in rows]
    return paginate(items, q=q, q_fields=("name",), sort=sort, order=order, page=page, size=size)


@router.get("/{kind}/{key}")
def rule_detail(kind: str, key: str, u: dict | None = Depends(security.optional)):
    r = db.connect().execute("SELECT kind,key,name,data FROM rules WHERE kind=? AND key=?",
                             (kind, key)).fetchone()
    if not r:
        # fallback: hledej podle jména (case-insensitive)
        r = db.connect().execute(
            "SELECT kind,key,name,data FROM rules WHERE kind=? AND name=? COLLATE NOCASE",
            (kind, key.replace("_", " "))).fetchone()
    if not r:
        raise HTTPException(404, "položka nenalezena")
    return {"kind": r["kind"], "key": r["key"], "name": r["name"], "data": db.jload(r["data"])}


# alias pro SRD kotvy (#srd-bestiar-Ghoul → monster/Ghoul)
SRD_MAP = {"bestiar": "monster", "predmety": "item", "glosar": "glossary"}


@router.get("/srd/{typ}/{key}")
def srd_detail(typ: str, key: str, u: dict | None = Depends(security.optional)):
    kind = SRD_MAP.get(typ, typ)
    return rule_detail(kind, key.replace("_", " "), u)
