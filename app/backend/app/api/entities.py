"""Entity: seznam (pro pickery/autocomplete), detail, update strukturovaných dat.

Uložení → validace → mirror do .md frontmatteru → reimport (aktualizuje index a graf).
"""
import re

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from .. import db, render, schemas, security
from ..config import ROOT, TYPE_LABELS
from ..ingest import importer, mirror
from ..ingest.markdown import split_front
from .listing import paginate
from .pages import safe_path

router = APIRouter(prefix="/api/entities", tags=["entities"])


def _entity_or_404(eid: int):
    r = db.connect().execute("SELECT * FROM entities WHERE id=?", (eid,)).fetchone()
    if not r:
        raise HTTPException(404, "entita nenalezena")
    return r


@router.get("")
def list_entities(type: str = "", q: str = "", sort: str = "name", order: str = "asc",
                  page: int = 1, size: int = 0, limit: int = 500,
                  u: dict | None = Depends(security.optional)):
    con = db.connect()
    sql = "SELECT e.id,e.type,e.path,e.slug,e.name,e.status,e.tags,e.data,p.secret FROM entities e LEFT JOIN pages p ON p.path=e.path"
    conds, args = [], []
    if type:
        conds.append("e.type=?")
        args.append(type)
    if q:
        conds.append("e.name LIKE ?")
        args.append(f"%{q}%")
    if conds:
        sql += " WHERE " + " AND ".join(conds)
    sql += " ORDER BY e.name LIMIT ?"
    args.append(limit if not size else 10000)
    rows = con.execute(sql, args).fetchall()
    out = []
    for r in rows:
        if r["secret"] and not security.can_edit(u):
            continue
        out.append({"id": r["id"], "type": r["type"], "type_label": TYPE_LABELS.get(r["type"], r["type"]),
                    "path": r["path"], "slug": r["slug"], "name": r["name"],
                    "status": r["status"], "tags": db.jload(r["tags"], []),
                    "data": db.jload(r["data"], {}),
                    "url": render.page_url(r["path"])})
    return paginate(out, sort=sort, order=order, page=page, size=size)


@router.get("/by-path")
def get_entity_by_path(path: str, u: dict | None = Depends(security.optional)):
    e = _entity_by_path(path)
    return _entity_payload(e, u)


@router.get("/{eid}")
def get_entity(eid: int, u: dict | None = Depends(security.optional)):
    e = _entity_or_404(eid)
    return _entity_payload(e, u)


def _entity_payload(e, u: dict | None):
    page = db.connect().execute("SELECT secret FROM pages WHERE path=?", (e["path"],)).fetchone()
    if page and page["secret"] and not security.can_edit(u):
        raise HTTPException(404, "entita nenalezena")
    data = db.jload(e["data"])
    return {"id": e["id"], "type": e["type"], "type_label": TYPE_LABELS.get(e["type"], e["type"]),
            "path": e["path"], "slug": e["slug"], "name": e["name"], "data": data,
            "status": e["status"], "tags": db.jload(e["tags"], []),
            "url": render.page_url(e["path"]), "editable": security.can_edit(u)}


class EntityData(BaseModel):
    data: dict
    name: str | None = None
    tags: list[str] | None = None
    status: str | None = None


def _fmt(v) -> str:
    if v is None:
        return "—"
    if isinstance(v, (dict, list)):
        s = db.jdump(v)
    else:
        s = str(v)
    return s[:60]


def _diff(old, new, prefix: str = "", out: list | None = None, depth: int = 0) -> list:
    out = out if out is not None else []
    if depth > 3 or len(out) >= 12:
        return out
    if isinstance(old, dict) and isinstance(new, dict):
        for k in list(old) + [k for k in new if k not in old]:
            _diff(old.get(k), new.get(k), f"{prefix}{k}.", out, depth + 1)
    elif old != new:
        out.append(f"{prefix.rstrip('.')}: {_fmt(old)}→{_fmt(new)}")
    return out


@router.get("/{eid}/log")
def entity_log(eid: int, u: dict = Depends(security.require("editor"))):
    e = _entity_or_404(eid)
    con = db.connect()
    rows = con.execute(
        "SELECT ts,user,action,target,detail FROM audit WHERE target=? OR target LIKE ? "
        "ORDER BY id DESC LIMIT 120", (e["path"], e["path"] + "%")).fetchall()
    return {"items": [dict(r) for r in rows]}


@router.put("/{eid}")
def put_entity(eid: int, b: EntityData, u: dict = Depends(security.require("editor"))):
    e = _entity_or_404(eid)
    p = ROOT / e["path"]
    if not p.is_file():
        raise HTTPException(404, "zrcadlený soubor chybí")
    key = mirror.type_key_for(e["type"])
    data = schemas.validate(e["type"], b.data if isinstance(b.data, dict) else {})
    # mirror do souboru (jen u typů s YAML klíčem)
    if key:
        mirror.write_frontmatter(e["path"], key, data)
    con = db.connect()
    con.execute("UPDATE entities SET name=?,data=?,tags=?,status=?,updated_at=?,updated_by=? WHERE id=?",
                (b.name or e["name"], db.jdump(data), db.jdump(b.tags or db.jload(e["tags"], [])),
                 b.status or e["status"], db.now(), u["login"], eid))
    con.commit()
    importer.reingest([e["path"]])
    changes = _diff(db.jload(e["data"], {}), data)
    if b.name and b.name != e["name"]:
        changes.insert(0, f"jmeno: {e['name']}→{b.name}")
    db.audit(u["login"], "entity.save", e["path"], "; ".join(changes[:12]) or e["type"])
    return {"ok": True}


class NewEntity(BaseModel):
    type: str
    dir: str
    name: str
    data: dict = {}
    template: str = ""


@router.post("")
def new_entity(b: NewEntity, u: dict = Depends(security.require("editor"))):
    import unicodedata
    ascii_name = unicodedata.normalize("NFD", b.name).encode("ascii", "ignore").decode()
    stem = re.sub(r"[^A-Za-z0-9]+", "_", ascii_name).strip("_") or "Nova"
    prefix = {"postava": "Postava_", "obchod": "Obchod_", "druh": "Druh_", "mesto": "Mesto_",
              "quest": "Quest_", "hadanka": "Hadanka_", "sezeni": "Sezeni_", "kniha": "Kniha_",
              "povolani": "Povolani_", "podtrida": "Podtrida_"}.get(b.type, "")
    p = safe_path(f"{b.dir.strip('/')}/{prefix}{stem}.md")
    if p.exists():
        raise HTTPException(409, "soubor už existuje")
    key = mirror.type_key_for(b.type)
    meta = {key: dict(b.data)} if key else {}
    if key == "postava":
        meta[key].setdefault("jmeno", b.name)
    if b.template:
        tpl = safe_path(b.template)
        if tpl.is_file():
            tmeta, tbody, _ = split_front(tpl.read_text(encoding="utf-8"))
            for k, v in tmeta.items():
                meta.setdefault(k, v)
            if key and isinstance(tmeta.get(key), dict):
                merged = dict(tmeta[key])
                merged.update(meta.get(key) or {})
                meta[key] = merged
            body = re.sub(r"^# .*$", "# " + b.name, tbody, count=1, flags=re.M)
        else:
            body = f"# {b.name}\n\n> **Stav:** návrh\n\n"
    else:
        body = f"# {b.name}\n\n> **Stav:** návrh\n\n## Pro DM (tajné)\n"
    from ..ingest.markdown import join_front
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(join_front(meta, body), encoding="utf-8")
    rel = p.relative_to(ROOT).as_posix()
    importer.reingest([rel])
    db.audit(u["login"], "entity.create", rel, b.type)
    row = db.connect().execute("SELECT id FROM entities WHERE path=?", (rel,)).fetchone()
    return {"ok": True, "id": row["id"] if row else None, "path": rel, "url": render.page_url(rel)}


def _entity_by_path(path: str):
    row = db.connect().execute(
        "SELECT * FROM entities WHERE path=? OR path=?", (path, path + ".md")).fetchone()
    if not row:
        raise HTTPException(404, "entita nenalezena")
    return row


@router.delete("/{eid}")
def delete_entity(eid: int, u: dict = Depends(security.require("editor"))):
    e = _entity_or_404(eid)
    p = ROOT / e["path"]
    if p.is_file():
        p.unlink()
    importer.delete_page(e["path"])
    db.audit(u["login"], "entity.delete", e["path"], e["type"])
    return {"ok": True}


class LinkBody(BaseModel):
    field: str          # klíč links-pole v datech entity (např. "kampane")
    path: str           # cílová cesta v repu
    op: str = "add"     # "add" | "remove"


@router.post("/{eid}/links")
def set_link(eid: int, b: LinkBody, u: dict = Depends(security.require("editor"))):
    """Atomické přidání/odebrání cíle v links-poli entity (mirror + reingest)."""
    e = _entity_or_404(eid)
    p = ROOT / e["path"]
    if not p.is_file():
        raise HTTPException(404, "zrcadlený soubor chybí")
    data = db.jload(e["data"])
    cur = data.get(b.field)
    lst = cur if isinstance(cur, list) else ([cur] if isinstance(cur, str) and cur else [])
    if b.op == "remove":
        lst = [x for x in lst if x != b.path]
    elif b.path not in lst:
        lst.append(b.path)
    data[b.field] = lst
    key = mirror.type_key_for(e["type"])
    data = schemas.validate(e["type"], data)
    if key:
        mirror.write_frontmatter(e["path"], key, data)
    con = db.connect()
    con.execute("UPDATE entities SET data=?,updated_at=?,updated_by=? WHERE id=?",
                (db.jdump(data), db.now(), u["login"], eid))
    con.commit()
    importer.reingest([e["path"]])
    db.audit(u["login"], "entity.link", f"{e['path']}:{b.field}", b.path)
    return {"ok": True, "list": lst}


class RelBody(BaseModel):
    pred: str
    obj: int
    note: str = ""


@router.post("/{eid}/relations")
def add_rel(eid: int, b: RelBody, u: dict = Depends(security.require("editor"))):
    _entity_or_404(eid)
    _entity_or_404(b.obj)
    con = db.connect()
    con.execute("INSERT OR REPLACE INTO relations(subj,pred,obj,note) VALUES(?,?,?,?)",
                (eid, b.pred, b.obj, b.note))
    con.commit()
    db.audit(u["login"], "relation.add", f"{eid}→{b.obj}", b.pred)
    return {"ok": True}


@router.delete("/{eid}/relations")
def del_rel(eid: int, pred: str, obj: int, u: dict = Depends(security.require("editor"))):
    con = db.connect()
    con.execute("DELETE FROM relations WHERE subj=? AND pred=? AND obj=?", (eid, pred, obj))
    con.commit()
    db.audit(u["login"], "relation.del", f"{eid}→{obj}", pred)
    return {"ok": True}
