import threading
import uuid
from concurrent.futures import ThreadPoolExecutor

import pytest
from fastapi.testclient import TestClient

from app import db, security
from app.api import battles
from app.config import COOKIE_NAME
from app.main import app
from app.ws import hub


@pytest.fixture()
def encounter():
    con = db.connect()
    users, clients = {}, {}
    for name, role in (("gm", "editor"), ("one", "player"), ("two", "player")):
        uid = con.execute("INSERT INTO users(login,name,pass_hash,role) VALUES(?,?,?,?)",
                          (f"intent-{name}-{uuid.uuid4().hex}", name, "unused", role)).lastrowid
        con.commit()
        session, csrf = security.create_session(uid)
        client = TestClient(app)
        client.cookies.set(COOKIE_NAME, session)
        client.headers["X-CSRF"] = csrf
        users[name], clients[name] = uid, client
    gm = clients["gm"]
    bid = gm.post("/api/battles", json={"name": "Intent QA " + uuid.uuid4().hex}).json()["id"]
    state = {"stav_boje": {
        "tok": [
            {"id": "hero", "side": "druzina", "src": {"owner": str(users["one"])}, "hp": 15, "max": 20},
            {"id": "other", "side": "druzina", "src": {"owner": str(users["two"])}, "hp": 10, "max": 20},
            {"id": "enemy", "side": "nepratele", "x": 1, "y": 0, "hp": 13, "max": 30},
            {"id": "secret", "side": "nepratele", "hidden": True, "hp": 100},
            {"id": "fogged", "side": "nepratele", "x": 5, "y": 5, "hp": 40},
        ], "ord": ["hero", "other"], "turn": 0,
        "fog": {"on": True, "visible": {"1,0": True}, "revealed": {"1,0": True}},
        "pendingResolutions": [{"id": "pending", "kind": "reaction", "actorId": "other"}],
    }}
    assert gm.put(f"/api/battles/{bid}/state", json={"state": state}).status_code == 200
    assert gm.post(f"/api/battles/{bid}/share", json={"shared": True}).status_code == 200
    yield {**clients, "users": users, "bid": bid, "url": f"/api/battles/{bid}/intents", "state": state}
    assert gm.delete(f"/api/battles/{bid}").status_code == 200
    for uid in users.values():
        con.execute("DELETE FROM users WHERE id=?", (uid,))
    con.commit()
    for client in clients.values():
        client.close()


def create(e, who="one", **kw):
    return e[who].post(e["url"], json={"token_id": "hero", "kind": "end_turn", "payload": {}, **kw})


def test_pending_reactions_are_routed_only_to_the_actor_owner(encounter):
    e = encounter
    pending = [
        {"id": "shield", "kind": "reaction", "actorId": "hero", "label": "secret enemy name", "reactionKey": "private", "dc": 99},
        {"id": "oa", "kind": "oa", "tokenId": "hero", "move": {"ownerId": "other", "to": [99, 99]}},
        {"id": "concentration", "kind": "concentration", "tokenId": "hero"},
        {"id": "unowned", "kind": "reaction", "actorId": "enemy"},
    ]
    e["state"]["stav_boje"]["pendingResolutions"] = pending
    assert e["gm"].put(f"/api/battles/{e['bid']}/state", json={"state": e["state"]}).status_code == 200
    def items(who):
        return e[who].get(f"/api/battles/{e['bid']}").json()["state"]["stav_boje"].get("pendingResolutions", [])
    assert [p["id"] for p in items("one")] == ["shield"]
    assert [p["id"] for p in items("two")] == ["oa"]
    assert items("one")[0] == {"id": "shield", "kind": "reaction", "actorId": "hero", "tokenId": "hero", "label": "Reakce"}
    assert len(items("gm")) == 4
    assert create(e, kind="reaction", payload={"pending_id": "oa", "accept": True}).status_code == 400
    assert create(e, kind="reaction", payload={"pending_id": "shield", "accept": True}).status_code == 200
    assert create(e, "two", token_id="other", kind="reaction", payload={"pending_id": "oa", "accept": False}).status_code == 200
    assert e["one"].put(f"/api/battles/{e['bid']}/state", json={"state": e["state"]}).status_code == 403


def test_create_scope_resolve_cancel_and_unchanged_state(encounter):
    e = encounter
    before = e["gm"].get(f"/api/battles/{e['bid']}").json()
    row = create(e).json()
    assert row["status"] == "pending" and row["user_id"] == e["users"]["one"]
    assert row["resolved_at"] is None and row["resolved_by"] is None
    second = create(e, "gm", token_id="other", user_id=e["users"]["two"]).json()
    assert e["one"].get(e["url"]).json()["intents"] == [row]
    assert e["two"].get(e["url"]).json()["intents"] == [second]
    assert len(e["gm"].get(e["url"]).json()["intents"]) == 2
    assert e["two"].delete(f"{e['url']}/{row['id']}").status_code == 404
    assert e["one"].post(f"{e['url']}/{row['id']}/resolve", json={"status": "approved"}).status_code == 403
    r = e["gm"].post(f"{e['url']}/{row['id']}/resolve", json={"status": "approved", "note": "OK"})
    assert r.status_code == 200
    assert r.json()["resolved_by"] == e["users"]["gm"] and r.json()["resolved_at"] and r.json()["note"] == "OK"
    assert e["one"].delete(f"{e['url']}/{row['id']}").status_code == 409
    assert len(e["gm"].get(e["url"], params={"status": "approved"}).json()["intents"]) == 1
    assert e["gm"].post(f"{e['url']}/{row['id']}/resolve", json={"status": "applied"}).status_code == 200
    assert e["gm"].post(f"{e['url']}/{row['id']}/resolve", json={"status": "rejected"}).status_code == 409
    assert e["two"].delete(f"{e['url']}/{second['id']}").json()["status"] == "cancelled"
    assert e["one"].get(e["url"], params={"status": "pending"}).json() == {"intents": []}
    after = e["gm"].get(f"/api/battles/{e['bid']}").json()
    assert after["version"] == before["version"] and after["state"] == before["state"]


def test_ownership_turn_unshared_and_gm_on_behalf(encounter):
    e = encounter
    assert create(e, "two").status_code == 403
    assert create(e, "two", token_id="other").status_code == 400
    assert create(e, user_id=e["users"]["two"]).status_code == 403
    assert create(e, "two", token_id="other", kind="roll", payload={"type": "save", "name": "DEX"}).status_code == 200
    assert create(e, "two", token_id="other", kind="reaction", payload={"pending_id": "pending", "accept": False}).status_code == 200
    assert e["gm"].post(f"/api/battles/{e['bid']}/share", json={"shared": False}).status_code == 200
    assert create(e).status_code == 404
    assert e["one"].get(e["url"]).status_code == 404
    assert create(e, "gm", token_id="other", user_id=e["users"]["two"]).status_code == 200
    assert e["one"].put(f"/api/battles/{e['bid']}/state", json={"state": {}}).status_code == 403
    assert TestClient(app).post(e["url"], json={}).status_code == 401


@pytest.mark.parametrize("kind,payload", [("move", {"path": [[0, 0]]}), ("action", {"action_id": "attack", "target_ids": ["enemy"]}), ("end_turn", {}), ("death_save", {})])
def test_all_turn_bound_kinds_require_stored_turn(encounter, kind, payload):
    assert create(encounter, "two", token_id="other", kind=kind, payload=payload).status_code == 400


@pytest.mark.parametrize("target", ["secret", "fogged", "missing"])
def test_targets_fail_generically_without_leaking_hidden_ids(encounter, target):
    e = encounter
    r = create(e, kind="action", payload={"action_id": "attack", "target_ids": [target]})
    assert r.status_code == 400 and r.json() == {"detail": "Neplatný požadavek"}
    assert target not in r.text
    assert e["one"].get(e["url"]).json() == {"intents": []}


@pytest.mark.parametrize("kind,payload", [
    ("move", {"path": [[0, 0], [1, 0]]}),
    ("action", {"action_id": "spell", "target_ids": ["enemy"], "aoe": {"anchor": [1, 0], "rotation": 90}, "manual_dice": {"attack": 20, "damage": [6, 5]}}),
    ("death_save", {}), ("end_turn", {}),
])
def test_supported_turn_bound_payloads(encounter, kind, payload):
    r = create(encounter, kind=kind, payload=payload)
    assert r.status_code == 200 and r.json()["payload"] == payload


@pytest.mark.parametrize("kind,payload", [
    ("move", {"path": []}), ("move", {"path": [[0, 0]] * 257}),
    ("move", {"path": [[1.5, 2]]}), ("action", {}),
    ("action", {"action_id": "x", "target_ids": ["enemy"] * 65}),
    ("reaction", {"pending_id": "p"}), ("end_turn", {"target_ids": ["secret"]}),
    ("roll", {"type": "attack", "name": "x"}), ("unknown", {}),
])
def test_invalid_payloads(encounter, kind, payload):
    assert create(encounter, kind=kind, payload=payload).status_code == 400


def test_payload_size_caps_and_slot_reuse(encounter):
    e = encounter
    assert create(e, kind="action", payload={"action_id": "x", "manual_dice": {"x": list(range(5000))}}).status_code == 413
    assert e["one"].post(e["url"], content=" " * 32769).status_code == 413
    ids = [create(e).json()["id"] for _ in range(3)]
    assert create(e).status_code == 429
    assert e["one"].delete(f"{e['url']}/{ids[0]}").status_code == 200
    assert create(e).status_code == 200
    assert create(e, "two", token_id="other", kind="roll", payload={"type": "check", "name": "Perception"}).status_code == 200


def test_pending_cap_is_atomic(encounter):
    e = encounter
    def submit(_):
        client = TestClient(app)
        client.cookies.update(e["one"].cookies)
        client.headers["X-CSRF"] = e["one"].headers["X-CSRF"]
        try:
            return client.post(e["url"], json={"token_id": "hero", "kind": "end_turn"}).status_code
        finally:
            client.close()
    with ThreadPoolExecutor(max_workers=5) as pool:
        statuses = list(pool.map(submit, range(5)))
    assert sorted(statuses) == [200, 200, 200, 429, 429]


def test_csrf_on_every_mutation(encounter):
    e = encounter
    row = create(e).json()
    for who, method, suffix, body in [("one", "POST", "", {"token_id": "hero", "kind": "end_turn"}),
                                      ("one", "DELETE", "/" + row["id"], None),
                                      ("gm", "POST", "/" + row["id"] + "/resolve", {"status": "approved"})]:
        client = e[who]
        csrf = client.headers.pop("X-CSRF")
        assert client.request(method, e["url"] + suffix, json=body).status_code == 403
        client.headers["X-CSRF"] = csrf


def test_player_directory_and_auto_movement_meta(encounter):
    e = encounter
    assert e["one"].get("/api/battles/players").status_code == 403
    rows = e["gm"].get("/api/battles/players").json()["players"]
    assert all(set(row) == {"id", "login", "name"} for row in rows)
    assert e["users"]["one"] in {r["id"] for r in rows} and e["users"]["gm"] not in {r["id"] for r in rows}
    url = f"/api/battles/{e['bid']}"
    assert e["one"].get(url).json()["state"]["auto_pohyb"] is False
    assert e["one"].put(url + "/meta", json={"auto_pohyb": True}).status_code == 403
    assert e["gm"].put(url + "/meta", json={"auto_pohyb": True}).status_code == 200
    detail = e["one"].get(url).json()
    assert detail["auto_pohyb"] is True and detail["state"]["auto_pohyb"] is True
    assert next(b for b in e["one"].get("/api/battles").json()["battles"] if b["id"] == e["bid"])["auto_pohyb"] is True


def test_owned_nonparty_token_keeps_details_without_gm_secrets(encounter):
    e = encounter
    token = e["state"]["stav_boje"]["tok"][2]
    token.update(src={"owner": str(e["users"]["one"])}, tmp=3, slots=[{"max": 3, "used": 1}], zdroje=[{"max": 2, "used": 1}], pj_note="secret", poznamka="secret")
    assert e["gm"].put(f"/api/battles/{e['bid']}/state", json={"state": e["state"]}).status_code == 200
    def enemy(who):
        return next(t for t in e[who].get(f"/api/battles/{e['bid']}").json()["state"]["stav_boje"]["tok"] if t["id"] == "enemy")
    own, other = enemy("one"), enemy("two")
    assert own["hp"] == 13 and own["tmp"] == 3 and own["slots"] == token["slots"] and own["zdroje"] == token["zdroje"]
    assert "pj_note" not in own and "poznamka" not in own
    assert "hp" not in other and other["hp_stav"]
    assert own["src"]["owner"] == other["src"]["owner"] == str(e["users"]["one"])
    assert "hp" not in next(t for t in battles.player_view(e["state"])["stav_boje"]["tok"] if t["id"] == "enemy")


def test_delete_battle_cascades_intents(encounter):
    e = encounter
    create(e)
    # A second disposable battle exercises deletion without interfering with fixture cleanup.
    bid = e["gm"].post("/api/battles", json={"name": "Delete intents " + uuid.uuid4().hex}).json()["id"]
    db.connect().execute("INSERT INTO battle_intents(id,battle_id,user_id,token_id,kind,created_at) VALUES(?,?,?,?,?,?)", ("delete-" + bid, bid, e["users"]["one"], "hero", "end_turn", db.now()))
    db.connect().commit()
    assert e["gm"].delete(f"/api/battles/{bid}").status_code == 200
    assert db.connect().execute("SELECT count(*) FROM battle_intents WHERE battle_id=?", (bid,)).fetchone()[0] == 0


def test_websocket_events_and_unshare_revokes_existing_subscribers(encounter, monkeypatch):
    e = encounter
    subscribed = threading.Event()
    original = hub.subscribe
    async def subscribe(*args, **kwargs):
        await original(*args, **kwargs)
        subscribed.set()
    monkeypatch.setattr(hub, "subscribe", subscribe)
    channel = f"battle:{e['bid']}"
    with e["one"].websocket_connect("/api/ws") as player_ws, e["gm"].websocket_connect("/api/ws") as gm_ws:
        for ws in (player_ws, gm_ws):
            subscribed.clear()
            ws.send_json({"op": "sub", "channel": channel})
            assert subscribed.wait(3)
        row = create(e).json()
        event = {"channel": channel, "event": "intent", "data": {"id": row["id"], "status": "pending"}}
        assert player_ws.receive_json() == gm_ws.receive_json() == event
        assert e["one"].delete(f"{e['url']}/{row['id']}").status_code == 200
        for ws in (player_ws, gm_ws):
            assert ws.receive_json()["data"] == {"id": row["id"], "status": "cancelled"}
        row = create(e).json()
        for ws in (player_ws, gm_ws):
            assert ws.receive_json()["data"]["status"] == "pending"
        assert e["gm"].post(f"{e['url']}/{row['id']}/resolve", json={"status": "rejected"}).status_code == 200
        for ws in (player_ws, gm_ws):
            assert ws.receive_json()["data"] == {"id": row["id"], "status": "rejected"}
        assert e["gm"].post(f"/api/battles/{e['bid']}/share", json={"shared": False}).status_code == 200
        assert gm_ws.receive_json()["event"] == "shared"
        assert len(hub._subs[channel]) == 1
        assert all(hub._editors[ws] for ws in hub._subs[channel])
        row = create(e, "gm").json()
        assert gm_ws.receive_json()["data"] == {"id": row["id"], "status": "pending"}
        player_ws.send_json({"op": "sub", "channel": channel})
        assert player_ws.receive_json() == {"channel": channel, "event": "denied"}
