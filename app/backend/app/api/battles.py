"""Boje: seznam, detail, uložení stavu (verzované), sdílení hráčům.

DB je kanonická; při uložení se zrcadlí JSON do 11_Mapy/boje/<id>.json (git/Obsidian).
Živé sdílení: PUT state → WS broadcast na kanál battle:<id>.
"""
import json
import re
import time

from fastapi import APIRouter, Depends, HTTPException

from .. import db, security
from ..config import ROOT
from ..ws import hub
from pydantic import BaseModel

router = APIRouter(prefix="/api/battles", tags=["battles"])
ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,80}$")


def _mirror(bid: str, state: dict) -> None:
    d = ROOT / "11_Mapy" / "boje"
    d.mkdir(parents=True, exist_ok=True)
    (d / f"{bid}.json").write_text(json.dumps(state, ensure_ascii=False, indent=1), encoding="utf-8")


def _row_or_404(bid: str):
    r = db.connect().execute("SELECT * FROM battles WHERE id=?", (bid,)).fetchone()
    if not r:
        raise HTTPException(404, "boj nenalezen")
    return r


def _summary(r) -> dict:
    s = db.jload(r["state"])
    stav = s.get("stav_boje") or {}
    kampane = s.get("kampane")
    if not isinstance(kampane, list):
        kampane = [r["kampan"]] if r["kampan"] else []
    return {"id": r["id"], "name": r["name"], "status": r["status"], "kampan": r["kampan"],
            "kampane": kampane,
            "quest": r["quest"], "sezeni": r["sezeni"], "map_ref": r["map_ref"],
            "kola": stav.get("round", 0),
            "ucastnici": [{"nazev": re.sub(r"<[^>]+>", "", str(t.get("nazev", ""))),
                           "strana": t.get("side"), "hp": t.get("hp"), "max": t.get("max"),
                           "mrtvy": bool(t.get("dead"))} for t in stav.get("tok", [])],
            "shared": bool(r["shared"]), "updated_at": r["updated_at"], "version": r["version"]}


@router.get("")
def list_battles(u: dict | None = Depends(security.optional)):
    con = db.connect()
    rows = con.execute("SELECT * FROM battles ORDER BY updated_at DESC").fetchall()
    editor = security.can_edit(u)
    out = []
    for r in rows:
        if not editor and not r["shared"]:
            continue  # hráč vidí jen živě sdílené boje
        out.append(_summary(r))
    pages = {t: [dict(x) for x in con.execute(
        "SELECT path,title FROM pages WHERE type=? ORDER BY title", (t,))]
        for t in ("kampan", "quest", "sezeni")}
    return {"battles": out, "pages": pages}


@router.get("/{bid}")
def get_battle(bid: str, u: dict | None = Depends(security.optional)):
    r = _row_or_404(bid)
    if not security.can_edit(u) and not r["shared"]:
        raise HTTPException(404, "boj nenalezen")
    out = _summary(r)
    out["state"] = db.jload(r["state"])
    return out


class NewBattle(BaseModel):
    name: str
    kampan: str = ""
    kampane: list[str] = []
    quest: str = ""
    sezeni: str = ""
    map_ref: str = ""


@router.post("")
def create_battle(b: NewBattle, u: dict = Depends(security.require("editor"))):
    import unicodedata
    ascii_name = unicodedata.normalize("NFD", b.name).encode("ascii", "ignore").decode()
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_name.lower()).strip("-") or "boj"
    bid = slug
    i = 2
    while db.connect().execute("SELECT 1 FROM battles WHERE id=?", (bid,)).fetchone():
        bid = f"{slug}-{i}"
        i += 1
    kampane = list(dict.fromkeys(b.kampane or ([b.kampan] if b.kampan else [])))
    kampan = kampane[0] if kampane else ""
    state = {"id": bid, "nazev": b.name, "stav": "priprava", "kampan": kampan,
             "kampane": kampane,
             "quest": b.quest, "sezeni": b.sezeni, "mapa": b.map_ref,
             "vytvoreno": db.now(), "upraveno": db.now(), "stav_boje": {}}
    con = db.connect()
    con.execute(
        "INSERT INTO battles(id,name,status,kampan,quest,sezeni,map_ref,state,version,created_at,updated_at)"
        " VALUES(?,?,?,?,?,?,?,?,0,?,?)",
        (bid, b.name, "priprava", kampan, b.quest, b.sezeni, b.map_ref, db.jdump(state),
         db.now(), db.now()))
    con.commit()
    _mirror(bid, state)
    db.audit(u["login"], "battle.create", bid)
    return {"ok": True, "id": bid}


class BattleState(BaseModel):
    state: dict
    version: int = 0


@router.put("/{bid}/state")
async def put_state(bid: str, b: BattleState, u: dict = Depends(security.require("editor"))):
    r = _row_or_404(bid)
    if b.version and b.version != r["version"]:
        raise HTTPException(409, "konflikt verzí – boj mezitím změnil někdo jiný")
    state = b.state
    state["id"] = bid
    state["upraveno"] = db.now()
    con = db.connect()
    con.execute(
        "UPDATE battles SET state=?,version=version+1,updated_at=?,name=?,status=?,kampan=?,quest=?,sezeni=?,map_ref=?"
        " WHERE id=?",
        (db.jdump(state), db.now(), state.get("nazev", r["name"]), state.get("stav", r["status"]),
         state.get("kampan", r["kampan"]), state.get("quest", r["quest"]),
         state.get("sezeni", r["sezeni"]), state.get("mapa", r["map_ref"]), bid))
    con.commit()
    _mirror(bid, state)
    await hub.broadcast(f"battle:{bid}", "state", {"version": r["version"] + 1, "state": state})
    db.audit(u["login"], "battle.state", bid)
    return {"ok": True, "version": r["version"] + 1}


class MetaBody(BaseModel):
    name: str | None = None
    kampan: str | None = None     # primární kampaň (zpětná kompatibilita)
    kampane: list[str] | None = None
    quest: str | None = None
    sezeni: str | None = None
    map_ref: str | None = None


@router.put("/{bid}/meta")
def put_meta(bid: str, b: MetaBody, u: dict = Depends(security.require("editor"))):
    """Úprava metadat boje (vazby na kampaně/quest/sezení/mapu) bez dotknutí stavu."""
    r = _row_or_404(bid)
    state = db.jload(r["state"])
    if b.name is not None:
        state["nazev"] = b.name
    if b.kampane is not None:
        kampane = list(dict.fromkeys(b.kampane))
        state["kampane"] = kampane
        state["kampan"] = kampane[0] if kampane else ""
    elif b.kampan is not None:
        state["kampan"] = b.kampan
        if not state.get("kampane"):
            state["kampane"] = [b.kampan] if b.kampan else []
    if b.quest is not None:
        state["quest"] = b.quest
    if b.sezeni is not None:
        state["sezeni"] = b.sezeni
    if b.map_ref is not None:
        state["mapa"] = b.map_ref
    state["upraveno"] = db.now()
    con = db.connect()
    con.execute(
        "UPDATE battles SET state=?,updated_at=?,name=?,kampan=?,quest=?,sezeni=?,map_ref=? WHERE id=?",
        (db.jdump(state), db.now(), state.get("nazev", r["name"]),
         state.get("kampan", r["kampan"]), state.get("quest", r["quest"]),
         state.get("sezeni", r["sezeni"]), state.get("mapa", r["map_ref"]), bid))
    con.commit()
    _mirror(bid, state)
    db.audit(u["login"], "battle.meta", bid)
    return {"ok": True}


class ShareBody(BaseModel):
    shared: bool


@router.post("/{bid}/share")
async def share(bid: str, b: ShareBody, u: dict = Depends(security.require("editor"))):
    r = _row_or_404(bid)
    con = db.connect()
    con.execute("UPDATE battles SET shared=? WHERE id=?", (int(b.shared), bid))
    con.commit()
    await hub.broadcast(f"battle:{bid}", "shared", {"shared": b.shared})
    db.audit(u["login"], "battle.share", bid, str(b.shared))
    return {"ok": True}


@router.delete("/{bid}")
def delete_battle(bid: str, u: dict = Depends(security.require("editor"))):
    _row_or_404(bid)
    con = db.connect()
    con.execute("DELETE FROM battles WHERE id=?", (bid,))
    con.commit()
    f = ROOT / "11_Mapy" / "boje" / f"{bid}.json"
    if f.is_file():
        f.unlink()
    db.audit(u["login"], "battle.delete", bid)
    return {"ok": True}
