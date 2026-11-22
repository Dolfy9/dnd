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
    (d / f"{bid}.json").write_text(json.dumps(state, ensure_ascii=False, indent=1), encoding="utf-8", newline="")


def _row_or_404(bid: str):
    r = db.connect().execute("SELECT * FROM battles WHERE id=?", (bid,)).fetchone()
    if not r:
        raise HTTPException(404, "boj nenalezen")
    return r


def _hp_bucket(t: dict) -> str:
    hp, mx = t.get("hp", 0) or 0, t.get("max", 1) or 1
    if t.get("dead") or hp <= 0:
        return "Mrtvý"
    if hp >= mx:
        return "Nezraněný"
    f = hp / mx
    return "Lehce zraněný" if f > 0.5 else "Těžce zraněný" if f > 0.25 else "Na pokraji"


def player_view(state: dict, user_id: int | None = None) -> dict:
    """Stav boje pro hráče: bez skrytých žetonů, DM poznámek, pj logů a přesných HP nepřátel."""
    import copy
    s = copy.deepcopy(state or {})
    sb = s.get("stav_boje")
    if not isinstance(sb, dict):
        return s
    sb.pop("pendingResolutions", None)
    fog = sb.get("fog") or {}
    fog_on = bool(fog.get("on"))
    visible = fog.get("visible") if isinstance(fog.get("visible"), dict) else fog.get("revealed") or {}
    hidden = fog.get("hidden") or {}
    revealed = fog.get("revealed") or {}
    if fog_on:
        revealed = {k: v for k, v in revealed.items() if k not in hidden}
        visible = {k: v for k, v in visible.items() if k in revealed}
        fog["revealed"] = revealed
        fog["visible"] = visible

    def _visible(x, y):
        if not fog_on:
            return True
        if not isinstance(x, (int, float)) or not isinstance(y, (int, float)):
            return False
        key = f"{int(x)},{int(y)}"
        return key in visible and key not in hidden

    def _in_fog(t):
        """Token je skryt v mlze, pokud nejsou odhaleny vsechny jeho bunky."""
        if not fog_on or t.get("side") == "druzina":
            return False
        x, y, sz = t.get("x"), t.get("y"), t.get("s", 1) or 1
        if x is None or y is None:
            return True
        for dx in range(sz):
            for dy in range(sz):
                if not _visible(x + dx, y + dy):
                    return True
        return False

    toks = []
    for t in sb.get("tok", []):
        if t.get("skryty") or t.get("hidden"):
            continue
        if _in_fog(t):
            continue
        t = dict(t)
        owned = user_id is not None and (t.get("src") or {}).get("owner") == str(user_id)
        if t.get("side") != "druzina" and not owned:
            t["hp_stav"] = _hp_bucket(t)
            for k in ("hp", "max", "tmp", "ds", "saves", "pj_note", "poznamka"):
                t.pop(k, None)
        else:
            t.pop("pj_note", None)
            t.pop("poznamka", None)
        toks.append(t)
    sb["tok"] = toks
    private_sources = set(sb.pop("privateSourceIds", []) or [])
    private_sources.update(l.get("id") for l in sb.get("lights", []) if l.get("dmOnly"))
    map_id = sb.get("map") or s.get("mapa")
    if map_id:
        row = db.connect().execute("SELECT data FROM battle_maps WHERE id=?", (map_id,)).fetchone()
        mdata = (db.jload(row["data"]) or {}) if row else {}
        private_sources.update(o.get("id") for o in [*(mdata.get("svetla") or []), *(mdata.get("objekty") or [])] if o.get("dmOnly"))
    if "lights" in sb:
        sb["lights"] = [l for l in sb["lights"] if l.get("id") not in private_sources]
    if "zdroje" in sb:
        sb["zdroje"] = {k: v for k, v in sb["zdroje"].items() if k not in private_sources}
    cells = sb.pop("lightCells", None)
    if isinstance(cells, dict):
        sb["playerLightCells"] = {k: v for k, v in cells.items()
                                  if v in ("bright", "dim", "dark")
                                  and (not fog_on or (k in visible and k in revealed and k not in hidden))}
    ids = {t.get("id") for t in toks}
    hidden_names = [t.get("nazev") for t in (state.get("stav_boje") or {}).get("tok", [])
                    if t.get("id") not in ids and t.get("nazev")]
    sb["log"] = [l for l in sb.get("log", []) if not l.get("pj") and not any(
        name in str(l.get("t", "")) + str(l.get("detail", "")) + str(l.get("kdo", "")) for name in hidden_names)]
    old_order = sb.get("ord") or []
    turn = sb.get("turn", -1)
    active = old_order[turn] if 0 <= turn < len(old_order) else None
    sb["ord"] = [tid for tid in old_order if tid in ids]
    sb["turn"] = sb["ord"].index(active) if active in sb["ord"] else -1
    sb["eco"] = {tid: value for tid, value in (sb.get("eco") or {}).items() if tid in ids}
    for key in ("pj_poznamky", "dm_notes", "poznamky"):
        sb.pop(key, None)
        s.pop(key, None)
    sb["kresby"] = [k for k in sb.get("kresby", []) if not k.get("dmOnly") and (
        not fog_on or (k.get("pts") and all(_visible(*p) for p in k["pts"])))]
    if fog_on:
        sb["zones"] = [z for z in sb.get("zones", []) if not z.get("pj") and (
            z.get("tokenId") in ids if z.get("tokenId") else _visible(*(z.get("anchor") or [None, None])))]
        sb["lights"] = [l for l in sb.get("lights", []) if not l.get("dmOnly") and (
            l.get("tokenId") in ids if l.get("tokenId") else _visible(*(l.get("anchor") or [None, None])))]
        def _fx_visible(fx):
            if fx.get("tokenId") and fx["tokenId"] not in ids:
                return False
            points = [fx[k] for k in ("from", "to", "at") if fx.get(k)]
            if fx.get("area"):
                points.append(fx["area"].get("anchor") or [None, None])
            return bool(points or fx.get("tokenId")) and all(_visible(*p) for p in points)
        sb["fx"] = [fx for fx in sb.get("fx", []) if _fx_visible(fx)]
        fog.pop("manual", None)
        fog.pop("hidden", None)
    s.pop("pj_poznamky", None)
    s.pop("dm_notes", None)
    return s


def _summary(r, player: bool = False, user_id: int | None = None) -> dict:
    s = db.jload(r["state"])
    if player:
        s = player_view(s, user_id)
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
            "auto_pohyb": bool(s.get("auto_pohyb", False)),
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
        out.append(_summary(r, player=not editor, user_id=u.get("id") if u else None))
    pages = {t: [dict(x) for x in con.execute(
        "SELECT path,title FROM pages WHERE type=? ORDER BY title", (t,))]
        for t in ("kampan", "quest", "sezeni")}
    return {"battles": out, "pages": pages}


@router.get("/{bid}")
def get_battle(bid: str, u: dict | None = Depends(security.optional)):
    r = _row_or_404(bid)
    if not security.can_edit(u) and not r["shared"]:
        raise HTTPException(404, "boj nenalezen")
    out = _summary(r, player=not security.can_edit(u), user_id=u.get("id") if u else None)
    state = db.jload(r["state"])
    state.setdefault("auto_pohyb", False)
    if not security.can_edit(u):
        state = player_view(state, u.get("id") if u else None)
        out["ucastnici"] = [
            {"nazev": re.sub(r"<[^>]+>", "", str(t.get("nazev", ""))),
             "strana": t.get("side"), "hp_stav": t.get("hp_stav"),
             "hp": t.get("hp"), "max": t.get("max"),
             "mrtvy": bool(t.get("dead"))}
            for t in (state.get("stav_boje") or {}).get("tok", [])]
    out["state"] = state
    return out


class NewBattle(BaseModel):
    name: str
    kampan: str = ""
    kampane: list[str] = []
    quest: str = ""
    sezeni: str = ""
    map_ref: str = ""
    auto_pohyb: bool = False


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
    stav_boje: dict = {}
    if b.map_ref:
        row = db.connect().execute("SELECT data FROM battle_maps WHERE id=?", (b.map_ref,)).fetchone()
        if row:
            mdata = db.jload(row["data"]) or {}
            if mdata.get("mlha") is True:
                stav_boje["fog"] = {"on": True, "revealed": {}, "visible": {}}
            if mdata.get("svetla"):
                stav_boje["lights"] = [
                    {"id": l.get("id", f"l{i}"), "anchor": [l.get("x", 0), l.get("y", 0)],
                     "bright": l.get("bright", 0), "dim": l.get("dim", 0),
                     "nazev": l.get("nazev", "světlo mapy"),
                     **{key: l[key] for key in ("dmOnly", "zap", "tvar", "smer", "sirka", "delka", "color", "intenzita", "efekt", "rychlost", "stiny", "blikani") if key in l}}
                    for i, l in enumerate(mdata["svetla"])]
    state = {"id": bid, "nazev": b.name, "stav": "priprava", "kampan": kampan,
             "kampane": kampane, "auto_pohyb": b.auto_pohyb,
             "quest": b.quest, "sezeni": b.sezeni, "mapa": b.map_ref,
             "vytvoreno": db.now(), "upraveno": db.now(), "stav_boje": stav_boje}
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
    state = {**(db.jload(r["state"]) or {}), **b.state}
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
    await hub.broadcast(f"battle:{bid}", "state", {"version": r["version"] + 1})
    db.audit(u["login"], "battle.state", bid)
    return {"ok": True, "version": r["version"] + 1}


class MetaBody(BaseModel):
    name: str | None = None
    kampan: str | None = None     # primární kampaň (zpětná kompatibilita)
    kampane: list[str] | None = None
    quest: str | None = None
    sezeni: str | None = None
    map_ref: str | None = None
    auto_pohyb: bool | None = None


@router.put("/{bid}/meta")
def put_meta(bid: str, b: MetaBody, u: dict = Depends(security.require("editor"))):
    """Úprava metadat boje (vazby na kampaně/quest/sezení/mapu) bez dotknutí stavu."""
    r = _row_or_404(bid)
    state = db.jload(r["state"])
    if b.auto_pohyb is not None:
        state["auto_pohyb"] = b.auto_pohyb
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
