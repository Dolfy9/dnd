"""Player requests for GM adjudication; these never mutate combat state."""
import json
import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from .. import db, security
from ..ws import hub
from .battles import _row_or_404, pending_actor, player_view

router = APIRouter(prefix="/api/battles", tags=["battles"])
MAX_PAYLOAD_BYTES = 16384
MAX_REQUEST_BYTES = 32768
MAX_PENDING = 3
Status = Literal["pending", "approved", "rejected", "cancelled", "applied"]
Name = Annotated[str, Field(min_length=1, max_length=200)]
Cell = tuple[Annotated[int, Field(strict=True, ge=-100000, le=100000)], Annotated[int, Field(strict=True, ge=-100000, le=100000)]]


class Payload(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class Move(Payload):
    path: list[Cell] = Field(min_length=1, max_length=256)


class Area(Payload):
    anchor: tuple[float, float]
    rotation: float = 0


class Action(Payload):
    action_id: Name
    target_ids: list[Name] = Field(default_factory=list, max_length=64)
    aoe: Area | None = None
    manual_dice: dict[Name, int | list[int]] | None = None


class Reaction(Payload):
    pending_id: Name
    accept: bool


class Roll(Payload):
    type: Literal["check", "save"]
    name: Name
    dc: int | None = Field(default=None, ge=0, le=100)
    value: int | None = None


PAYLOADS = {"move": Move, "action": Action, "end_turn": Payload,
            "death_save": Payload, "reaction": Reaction, "roll": Roll}


class NewIntent(Payload):
    token_id: Name
    kind: Literal["move", "action", "end_turn", "death_save", "reaction", "roll"]
    payload: dict = Field(default_factory=dict)
    user_id: int | None = None


class Resolution(Payload):
    status: Literal["approved", "rejected", "cancelled", "applied"]
    note: str = Field(default="", max_length=2000)


def _invalid():
    raise HTTPException(400, "Neplatný požadavek")


async def _body(request: Request) -> NewIntent:
    data = bytearray()
    async for chunk in request.stream():
        data.extend(chunk)
        if len(data) > MAX_REQUEST_BYTES:
            raise HTTPException(413, "Požadavek je příliš velký")
    try:
        body = NewIntent.model_validate_json(data)
        if len(json.dumps(body.payload, ensure_ascii=False).encode("utf-8")) > MAX_PAYLOAD_BYTES:
            raise HTTPException(413, "Požadavek je příliš velký")
        PAYLOADS[body.kind].model_validate(body.payload)
        return body
    except (ValidationError, ValueError):
        _invalid()


def _intent(bid: str, iid: str):
    row = db.connect().execute("SELECT * FROM battle_intents WHERE battle_id=? AND id=?", (bid, iid)).fetchone()
    if not row:
        raise HTTPException(404, "Požadavek nenalezen")
    return row


def _result(row):
    return {**dict(row), "payload": db.jload(row["payload"])}


async def _notify(bid: str, iid: str, status: str):
    await hub.broadcast(f"battle:{bid}", "intent", {"id": iid, "status": status})


@router.get("/players")
def players(u: dict = Depends(security.require("editor"))):
    rows = db.connect().execute("SELECT id,login,name FROM users WHERE role='player' AND disabled=0 ORDER BY login").fetchall()
    return {"players": [dict(row) for row in rows]}


@router.post("/{bid}/intents")
async def create_intent(bid: str, request: Request, u: dict = Depends(security.user)):
    b = await _body(request)
    editor = security.can_edit(u)
    uid = b.user_id if editor and b.user_id is not None else u["id"]
    if not editor and b.user_id not in (None, u["id"]):
        raise HTTPException(403, "Nedostatečná oprávnění")
    con = db.connect()
    with con:
        con.execute("BEGIN IMMEDIATE")
        battle = _row_or_404(bid)
        if not editor and not battle["shared"]:
            raise HTTPException(404, "boj nenalezen")
        state = db.jload(battle["state"])
        sb = state.get("stav_boje") or {}
        tokens = sb.get("tok") or []
        token = next((t for t in tokens if t.get("id") == b.token_id), None)
        if token is None:
            _invalid()
        if not editor:
            if (token.get("src") or {}).get("owner") != str(u["id"]):
                raise HTTPException(403, "Nedostatečná oprávnění")
            order, turn = sb.get("ord") or [], sb.get("turn", -1)
            if b.kind not in ("reaction", "roll") and not (isinstance(turn, int) and 0 <= turn < len(order) and order[turn] == b.token_id):
                _invalid()
            if b.kind == "reaction" and not any(p.get("id") == b.payload["pending_id"] and pending_actor(p) == b.token_id
                                                 for p in sb.get("pendingResolutions", [])):
                _invalid()
        if not con.execute("SELECT 1 FROM users WHERE id=? AND disabled=0", (uid,)).fetchone():
            _invalid()
        view = state if editor else player_view(state, u["id"])
        visible = {t.get("id") for t in (view.get("stav_boje") or {}).get("tok", [])}
        if any(tid not in visible for tid in b.payload.get("target_ids", [])):
            _invalid()
        pending = con.execute("SELECT count(*) FROM battle_intents WHERE battle_id=? AND user_id=? AND status='pending'", (bid, uid)).fetchone()[0]
        if pending >= MAX_PENDING:
            raise HTTPException(429, "Příliš mnoho čekajících požadavků")
        iid = uuid.uuid4().hex
        con.execute("INSERT INTO battle_intents(id,battle_id,user_id,token_id,kind,payload,created_at) VALUES(?,?,?,?,?,?,?)",
                    (iid, bid, uid, b.token_id, b.kind, db.jdump(b.payload), db.now()))
    await _notify(bid, iid, "pending")
    return _result(_intent(bid, iid))


@router.get("/{bid}/intents")
def list_intents(bid: str, status: Status | None = None, u: dict = Depends(security.user)):
    battle = _row_or_404(bid)
    if not security.can_edit(u) and not battle["shared"]:
        raise HTTPException(404, "boj nenalezen")
    query, args = "SELECT * FROM battle_intents WHERE battle_id=?", [bid]
    if not security.can_edit(u):
        query += " AND user_id=?"
        args.append(u["id"])
    if status is not None:
        query += " AND status=?"
        args.append(status)
    rows = db.connect().execute(query + " ORDER BY created_at,rowid", args).fetchall()
    return {"intents": [_result(row) for row in rows]}


@router.post("/{bid}/intents/{iid}/resolve")
async def resolve_intent(bid: str, iid: str, b: Resolution, u: dict = Depends(security.require("editor"))):
    con = db.connect()
    with con:
        con.execute("BEGIN IMMEDIATE")
        row = _intent(bid, iid)
        if row["status"] not in ("pending", "approved"):
            raise HTTPException(409, "Požadavek je již uzavřen")
        con.execute("UPDATE battle_intents SET status=?,note=?,resolved_at=?,resolved_by=? WHERE id=?",
                    (b.status, b.note, db.now(), u["id"], iid))
    await _notify(bid, iid, b.status)
    return _result(_intent(bid, iid))


@router.delete("/{bid}/intents/{iid}")
async def cancel_intent(bid: str, iid: str, u: dict = Depends(security.user)):
    con = db.connect()
    with con:
        con.execute("BEGIN IMMEDIATE")
        row = _intent(bid, iid)
        if row["user_id"] != u["id"]:
            raise HTTPException(404, "Požadavek nenalezen")
        if row["status"] != "pending":
            raise HTTPException(409, "Požadavek již nečeká na vyřízení")
        con.execute("UPDATE battle_intents SET status='cancelled',resolved_at=?,resolved_by=? WHERE id=?", (db.now(), u["id"], iid))
    await _notify(bid, iid, "cancelled")
    return _result(_intent(bid, iid))
