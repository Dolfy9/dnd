"""Správa: uživatelé, audit, reindex, zálohy, návrhy k revizi, heraldika, hudba."""
import shutil
import sqlite3
import time

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from .. import db, security
from ..config import DATA_DIR, DB_PATH, ROOT
from ..ingest import importer, rules

router = APIRouter(prefix="/api/admin", tags=["admin"])
admin = security.require("admin")


# ---------- uživatelé ----------
@router.get("/users")
def users(u: dict = Depends(admin)):
    rows = db.connect().execute(
        "SELECT id,login,name,role,created_at,disabled FROM users ORDER BY login").fetchall()
    return {"users": [dict(r) for r in rows]}


class UserBody(BaseModel):
    login: str
    name: str = ""
    password: str = ""
    role: str = "player"
    disabled: bool = False


@router.post("/users")
def create_user(b: UserBody, u: dict = Depends(admin)):
    login = b.login.strip().lower()
    if not login or not b.password:
        raise HTTPException(400, "login i heslo jsou povinné")
    if b.role not in ("admin", "editor", "player"):
        raise HTTPException(400, "neplatná role")
    con = db.connect()
    if con.execute("SELECT 1 FROM users WHERE login=?", (login,)).fetchone():
        raise HTTPException(409, "uživatel už existuje")
    con.execute("INSERT INTO users(login,name,pass_hash,role,created_at) VALUES(?,?,?,?,?)",
                (login, b.name or login, security.hash_password(b.password), b.role, db.now()))
    con.commit()
    db.audit(u["login"], "user.create", login, b.role)
    return {"ok": True}


@router.put("/users/{uid}")
def update_user(uid: int, b: UserBody, u: dict = Depends(admin)):
    con = db.connect()
    row = con.execute("SELECT id,login FROM users WHERE id=?", (uid,)).fetchone()
    if not row:
        raise HTTPException(404, "uživatel nenalezen")
    if b.role not in ("admin", "editor", "player"):
        raise HTTPException(400, "neplatná role")
    if uid == u["id"] and (b.disabled or b.role != "admin"):
        raise HTTPException(400, "nemůžeš si odebrat roli ani se zakázat")
    con.execute("UPDATE users SET name=?,role=?,disabled=? WHERE id=?",
                (b.name or row["login"], b.role, int(b.disabled), uid))
    if b.password:
        con.execute("UPDATE users SET pass_hash=? WHERE id=?",
                    (security.hash_password(b.password), uid))
        con.execute("DELETE FROM sessions WHERE user_id=?", (uid,))
    con.commit()
    db.audit(u["login"], "user.update", row["login"], f"role={b.role} disabled={b.disabled}")
    return {"ok": True}


@router.delete("/users/{uid}")
def delete_user(uid: int, u: dict = Depends(admin)):
    con = db.connect()
    row = con.execute("SELECT login FROM users WHERE id=?", (uid,)).fetchone()
    if not row:
        raise HTTPException(404, "uživatel nenalezen")
    if uid == u["id"]:
        raise HTTPException(400, "nemůžeš smazat sám sebe")
    con.execute("DELETE FROM users WHERE id=?", (uid,))
    con.commit()
    db.audit(u["login"], "user.delete", row["login"])
    return {"ok": True}


# ---------- audit ----------
@router.get("/audit")
def audit_log(limit: int = 200, u: dict = Depends(admin)):
    rows = db.connect().execute(
        "SELECT ts,user,action,target,detail FROM audit ORDER BY id DESC LIMIT ?",
        (min(limit, 1000),)).fetchall()
    return {"items": [dict(r) for r in rows]}


# ---------- návrhy k revizi ----------
@router.get("/navrhy")
def navrhy(u: dict = Depends(security.require("editor"))):
    rows = db.connect().execute(
        "SELECT path,title,type,status FROM pages WHERE status LIKE '%navrh%' OR status LIKE '%návrh%'"
        " ORDER BY type,title").fetchall()
    from .. import render
    return {"items": [dict(r, url=render.page_url(r["path"])) for r in rows]}


# ---------- systém ----------
@router.post("/reindex")
def reindex(u: dict = Depends(admin)):
    stats = importer.import_all()
    stats["rules"] = rules.load()
    db.audit(u["login"], "admin.reindex")
    return {"ok": True, "stats": stats}


@router.post("/backup")
def backup(u: dict = Depends(admin)):
    """Záloha DB + do ZIPu i klíčové JSON (malé); vrátí cestu k souboru."""
    stamp = time.strftime("%Y%m%d-%H%M%S")
    target = DATA_DIR / "backups" / f"montelien-{stamp}.sqlite"
    target.parent.mkdir(parents=True, exist_ok=True)
    dst = sqlite3.connect(str(target))
    db.connect().backup(dst)
    dst.close()
    db.audit(u["login"], "admin.backup", target.name)
    return {"ok": True, "file": target.name}


@router.get("/status")
def status(u: dict = Depends(admin)):
    con = db.connect()
    return {
        "db": str(DB_PATH),
        "root": str(ROOT),
        "pages": con.execute("SELECT count(*) c FROM pages").fetchone()["c"],
        "entities": con.execute("SELECT count(*) c FROM entities").fetchone()["c"],
        "links": con.execute("SELECT count(*) c FROM links").fetchone()["c"],
        "rules": con.execute("SELECT count(*) c FROM rules").fetchone()["c"],
        "battles": con.execute("SELECT count(*) c FROM battles").fetchone()["c"],
        "users": con.execute("SELECT count(*) c FROM users").fetchone()["c"],
    }


# ---------- heraldika + hudba ----------
@router.get("/heraldry")
def heraldry(u: dict | None = Depends(security.optional)):
    rows = db.connect().execute("SELECT entity,data FROM heraldry").fetchall()
    return {"items": [{"entity": r["entity"], "data": db.jload(r["data"])} for r in rows]}


class HeraldryBody(BaseModel):
    entity: str
    data: dict


@router.put("/heraldry")
def put_heraldry(b: HeraldryBody, u: dict = Depends(security.require("editor"))):
    con = db.connect()
    con.execute("INSERT INTO heraldry(entity,data) VALUES(?,?) ON CONFLICT(entity) DO UPDATE SET data=excluded.data",
                (b.entity, db.jdump(b.data)))
    con.commit()
    # zrcadlo do tools/heraldika.json
    f = ROOT / "tools" / "heraldika.json"
    try:
        import json
        raw = json.loads(f.read_text(encoding="utf-8")) if f.is_file() else {}
        raw[b.entity] = b.data
        f.write_text(json.dumps(raw, ensure_ascii=False, indent=1), encoding="utf-8")
    except Exception:
        pass
    db.audit(u["login"], "heraldry.save", b.entity)
    return {"ok": True}


class HeraldryEntryBody(BaseModel):
    typ: str                       # "zeme" | "mesta"
    id: str
    fields: dict                   # merge-only: nikdy se nic nemaže


@router.put("/heraldry/entry")
def put_heraldry_entry(b: HeraldryEntryBody, u: dict = Depends(security.require("editor"))):
    """Upraví položku heraldiky v tools/heraldika.json (+ zrcadlo do indexu,
    DB a `## Heraldika` sekce stránky). Merge — klíče mimo fields zůstávají."""
    import json
    if b.typ not in ("zeme", "mesta"):
        raise HTTPException(400, "typ musí být zeme|mesta")
    f = ROOT / "tools" / "heraldika.json"
    raw = json.loads(f.read_text(encoding="utf-8")) if f.is_file() else {}
    items = raw.setdefault(b.typ, [])
    entry = next((x for x in items if x.get("id") == b.id), None)
    if entry is None:
        if not b.fields.get("nazev") or not b.fields.get("soubor"):
            raise HTTPException(404, "položka nenalezena; pro novou je nutný nazev+soubor")
        entry = {"id": b.id}
        items.append(entry)
    entry.update({k: v for k, v in b.fields.items() if v is not None})
    f.write_text(json.dumps(raw, ensure_ascii=False, indent=1), encoding="utf-8")
    idx = ROOT / "web" / "docs" / "heraldika_index.json"
    if idx.is_file() or True:
        idx.write_text(json.dumps(raw, ensure_ascii=False, indent=1), encoding="utf-8")
    con = db.connect()
    con.execute("INSERT INTO heraldry(entity,data) VALUES(?,?) ON CONFLICT(entity) DO UPDATE SET data=excluded.data",
                (b.typ, db.jdump(items)))
    con.commit()
    # sync textových řádků v `## Heraldika` sekci stránky
    soubor = entry.get("soubor")
    if soubor:
        md = ROOT / soubor
        if md.is_file():
            text = md.read_text(encoding="utf-8")
            lines = text.split("\n")
            out, in_sec, i = [], False, 0
            while i < len(lines):
                ln = lines[i]
                if ln.startswith("## "):
                    in_sec = ln.strip() == "## Heraldika"
                if in_sec:
                    for key, label in (("znak", "**Znak:**"), ("vlajka", "**Vlajka:**"), ("proc", "**Proč:**")):
                        if key in b.fields and ln.startswith(label):
                            ln = f"{label} {entry.get(key, '')}"
                out.append(ln)
                i += 1
            md.write_text("\n".join(out), encoding="utf-8")
    db.audit(u["login"], "heraldry.entry", f"{b.typ}/{b.id}")
    return {"ok": True, "entry": entry}


@router.get("/music")
def music(u: dict | None = Depends(security.optional)):
    rows = db.connect().execute("SELECT * FROM music_presets").fetchall()
    return {"items": [dict(r) for r in rows]}


class MusicBody(BaseModel):
    id: str
    name: str
    video_id: str
    list_id: str = ""
    note: str = ""


@router.put("/music")
def put_music(b: MusicBody, u: dict = Depends(security.require("editor"))):
    con = db.connect()
    con.execute("INSERT OR REPLACE INTO music_presets(id,name,video_id,list_id,note) VALUES(?,?,?,?,?)",
                (b.id, b.name, b.video_id, b.list_id, b.note))
    con.commit()
    db.audit(u["login"], "music.save", b.id)
    return {"ok": True}
