"""Boje: player_view filtrace + version-only WS broadcast."""
import pytest
from fastapi.testclient import TestClient
from fastapi import Request

from app import db, security
from app.api import battles as battles_mod
from app.main import app


def _fake_user(request: Request):
    role = request.headers.get("x-test-role", "editor")
    return {"login": "t_" + role, "name": role, "role": role, "csrf": "x"}


@pytest.fixture(autouse=True)
def _auth_override():
    app.dependency_overrides[security.user] = _fake_user
    app.dependency_overrides[security.optional] = _fake_user
    yield
    app.dependency_overrides.clear()


@pytest.fixture()
def editor():
    c = TestClient(app)
    c.headers["x-test-role"] = "editor"
    return c


@pytest.fixture()
def player():
    c = TestClient(app)
    c.headers["x-test-role"] = "player"
    return c


def _mk_battle(client) -> str:
    r = client.post("/api/battles", json={"name": "Test Pybattle", "map_ref": "octowerin-ulicka"})
    assert r.status_code == 200, r.text
    bid = r.json()["id"]
    return bid


def _mk_state():
    return {"nazev": "T", "stav_boje": {
        "round": 2, "turn": 0, "ord": ["a", "b"],
        "tok": [
            {"id": "a", "nazev": "Hero", "side": "druzina", "hp": 20, "max": 20, "ac": 15},
            {"id": "b", "nazev": "Goblin", "side": "nepratele", "hp": 3, "max": 7, "tmp": 2,
             "pj_note": "tajné", "saves": {"DEX": 2}},
            {"id": "c", "nazev": "Skrytý", "side": "nepratele", "hp": 9, "max": 9, "skryty": True},
        ],
        "log": [
            {"k": 1, "c": "10:00", "kdo": "Hero", "typ": "attack", "t": "zásah"},
            {"k": 1, "c": "10:00", "kdo": "PJ", "typ": "system", "t": "dm tajné", "pj": True},
        ],
        "eco": {}, "zones": [], "fx": [],
    }, "dm_notes": "super tajné"}


def test_seed_shaped_map_lights(editor, monkeypatch):
    monkeypatch.setattr(battles_mod, "_mirror", lambda *args: None)
    con = db.connect()
    mid = "test-shaped-seed-map"
    shaped = {"id": "shaped", "x": 3.5, "y": 4.5, "bright": 10, "dim": 20,
              "tvar": "pruh", "smer": 90, "sirka": 70, "delka": 6,
              "color": "#ff8800", "intenzita": .7, "efekt": "pulz",
              "rychlost": .8, "stiny": False, "blikani": False, "zap": False, "dmOnly": True}
    bid = None
    try:
        con.execute("INSERT INTO battle_maps(id,name,data) VALUES(?,?,?)", (mid, "Shaped seed test", db.jdump({"svetla": [shaped, {"id": "old", "bright": 5}]})))
        con.commit()
        response = editor.post("/api/battles", json={"name": "Test shaped lights", "map_ref": mid})
        assert response.status_code == 200, response.text
        bid = response.json()["id"]
        state = db.jload(con.execute("SELECT state FROM battles WHERE id=?", (bid,)).fetchone()["state"])
        light, old = state["stav_boje"]["lights"]
        assert light == {key: value for key, value in shaped.items() if key not in ("x", "y")} | {"anchor": [3.5, 4.5], "nazev": "světlo mapy"}
        assert old == {"id": "old", "anchor": [0, 0], "bright": 5, "dim": 0, "nazev": "světlo mapy"}
        del light["dmOnly"]
        state["stav_boje"]["zdroje"] = {"shaped": False, "old": True}
        public = battles_mod.player_view(state)["stav_boje"]
        assert public["lights"] == [old]
        assert public["zdroje"] == {"old": True}
    finally:
        con.execute("DELETE FROM battle_maps WHERE id=?", (mid,))
        if bid:
            con.execute("DELETE FROM battles WHERE id=?", (bid,))
        con.commit()


# ---------- player_view (čistá funkce) ----------

def test_player_view_strips_hidden_and_pj():
    s = battles_mod.player_view(_mk_state())
    toks = s["stav_boje"]["tok"]
    assert [t["nazev"] for t in toks] == ["Hero", "Goblin"]
    gob = toks[1]
    assert "hp" not in gob and "max" not in gob and "tmp" not in gob
    assert gob["hp_stav"] == "Těžce zraněný"  # 3/7
    assert "pj_note" not in gob and "saves" not in gob
    hero = toks[0]
    assert hero["hp"] == 20  # družina vidí přesná čísla
    logs = s["stav_boje"]["log"]
    assert len(logs) == 1 and logs[0]["t"] == "zásah"
    assert "dm_notes" not in s


def test_player_view_strips_pending_decisions_without_mutating_gm_state():
    state = _mk_state()
    state["stav_boje"]["pendingResolutions"] = [{"kind": "concentration", "label": "Secret caster DC 18"}]
    public = battles_mod.player_view(state)
    assert "pendingResolutions" not in public["stav_boje"]
    assert state["stav_boje"]["pendingResolutions"][0]["label"] == "Secret caster DC 18"


def test_player_view_buckets():
    def bucket(hp, mx, dead=False):
        s = battles_mod.player_view({"stav_boje": {"tok": [
            {"id": "x", "nazev": "e", "side": "nepratele", "hp": hp, "max": mx, "dead": dead}], "log": []}})
        return s["stav_boje"]["tok"][0]["hp_stav"]
    assert bucket(10, 10) == "Nezraněný"
    assert bucket(6, 10) == "Lehce zraněný"
    assert bucket(4, 10) == "Těžce zraněný"
    assert bucket(1, 10) == "Na pokraji"
    assert bucket(0, 10) == "Mrtvý"
    assert bucket(5, 10, dead=True) == "Mrtvý"


def test_player_view_fog_strips_enemies_on_unrevealed_cells():
    s = _mk_state()
    sb = s["stav_boje"]
    for t, xy in zip(sb["tok"], [(0, 0), (5, 5), (0, 0)]):
        t["x"], t["y"], t["s"] = xy[0], xy[1], 1
    sb["fog"] = {"on": True, "revealed": {"0,0": 1}}
    out = battles_mod.player_view(s)["stav_boje"]["tok"]
    assert [t["nazev"] for t in out] == ["Hero"]  # Goblin v mlze, Skrytý skrytý


def test_player_view_fog_off_keeps_tokens():
    s = _mk_state()
    s["stav_boje"]["fog"] = {"on": False, "revealed": {}}
    for t in s["stav_boje"]["tok"]:
        t["x"], t["y"], t["s"] = 9, 9, 1
    out = battles_mod.player_view(s)["stav_boje"]["tok"]
    assert len(out) == 2  # jen skrytý odfiltrován


def test_player_view_fog_large_token_partially_revealed():
    s = _mk_state()
    sb = s["stav_boje"]
    og = {"id": "o", "nazev": "Ogre", "side": "nepratele", "hp": 5, "max": 10,
          "x": 2, "y": 2, "s": 2}
    sb["tok"] = [og]
    sb["fog"] = {"on": True, "revealed": {"2,2": 1, "3,2": 1}}  # 2 z 4 buněk
    assert battles_mod.player_view(s)["stav_boje"]["tok"] == []
    sb["fog"]["revealed"].update({"2,3": 1, "3,3": 1})
    assert len(battles_mod.player_view(s)["stav_boje"]["tok"]) == 1


# ---------- integrace ----------

def test_partial_state_save_preserves_all_campaigns_and_metadata(editor, monkeypatch):
    monkeypatch.setattr(battles_mod, "_mirror", lambda *args: None)
    response = editor.post("/api/battles", json={"name": "Multicampaign autosave", "kampane": ["first", "second"], "map_ref": "octowerin-ulicka", "quest": "quest-one"})
    assert response.status_code == 200
    bid = response.json()["id"]
    try:
        initial = editor.get(f"/api/battles/{bid}").json()["state"]
        assert editor.put(f"/api/battles/{bid}/state", json={"state": {"stav_boje": {"tok": []}}}).status_code == 200
        saved = editor.get(f"/api/battles/{bid}").json()["state"]
        for key in ("kampane", "kampan", "quest", "mapa", "nazev", "vytvoreno"):
            assert saved[key] == initial[key]
        assert saved["stav_boje"] == {"tok": []}
        assert editor.put(f"/api/battles/{bid}/state", json={"state": {"kampane": [], "quest": ""}}).status_code == 200
        assert editor.get(f"/api/battles/{bid}").json()["state"]["kampane"] == []
    finally:
        editor.delete(f"/api/battles/{bid}")

def test_source_states_sync_to_players_but_only_editors_can_write(editor, player, monkeypatch):
    monkeypatch.setattr(battles_mod, "_mirror", lambda *args: None)
    bid = _mk_battle(editor)
    try:
        state = _mk_state()
        state["stav_boje"]["zdroje"] = {"torch": False, "portal": True}
        state["stav_boje"]["log"].append({"typ": "system", "kdo": "PJ", "t": "Pochodeň: vypnuto"})
        response = editor.put(f"/api/battles/{bid}/state", json={"state": state, "version": 0})
        assert response.status_code == 200, response.text
        assert editor.post(f"/api/battles/{bid}/share", json={"shared": True}).status_code == 200
        shared = player.get(f"/api/battles/{bid}").json()["state"]["stav_boje"]
        assert shared["zdroje"] == {"torch": False, "portal": True}
        assert shared["log"][-1]["t"] == "Pochodeň: vypnuto"
        denied = player.put(f"/api/battles/{bid}/state", json={"state": state, "version": 1})
        assert denied.status_code == 403
    finally:
        editor.delete(f"/api/battles/{bid}")

def test_get_detail_player_filtered(editor, player):
    bid = _mk_battle(editor)
    r = editor.put(f"/api/battles/{bid}/state", json={"state": _mk_state(), "version": 0})
    assert r.status_code == 200
    editor.post(f"/api/battles/{bid}/share", json={"shared": True})
    r = player.get(f"/api/battles/{bid}")
    assert r.status_code == 200, r.text
    sb = r.json()["state"]["stav_boje"]
    assert len(sb["tok"]) == 2
    assert sb["tok"][1]["hp_stav"] == "Těžce zraněný"
    assert len(sb["log"]) == 1
    r = editor.get(f"/api/battles/{bid}")
    sb = r.json()["state"]["stav_boje"]
    assert len(sb["tok"]) == 3 and len(sb["log"]) == 2  # editor vidí vše
    editor.delete(f"/api/battles/{bid}")


def test_put_state_broadcasts_version_only(editor, monkeypatch):
    sent = {}
    async def fake_broadcast(channel, event, data):
        sent["data"] = data
    monkeypatch.setattr(battles_mod.hub, "broadcast", fake_broadcast)
    bid = _mk_battle(editor)
    r = editor.put(f"/api/battles/{bid}/state", json={"state": _mk_state(), "version": 0})
    assert r.status_code == 200
    assert sent["data"] == {"version": 1}
    assert "state" not in sent["data"]
    editor.delete(f"/api/battles/{bid}")


def test_fog_persistence_and_player_memory_filtering(editor, player, monkeypatch):
    monkeypatch.setattr(battles_mod, "_mirror", lambda *args: None)
    bid = _mk_battle(editor)
    try:
        state = _mk_state()
        sb = state["stav_boje"]
        sb["tok"][0].update(x=0, y=0)
        sb["tok"][1].update(x=2, y=0)
        sb["fog"] = {"on": True, "revealed": {"0,0": 1, "2,0": 1}, "visible": {"0,0": 1},
                     "manual": {"0,0": 1}, "hidden": {"4,0": 1}}
        sb["kresby"] = [{"id": "seen", "pts": [[0, 0]], "dmOnly": False}, {"id": "unknown", "pts": [[4, 0]]}]
        sb["lights"] = [{"id": "memory-light", "anchor": [2, 0]}, {"id": "seen-light", "anchor": [0, 0]}]
        sb["zones"] = [{"id": "unknown-zone", "anchor": [4, 0]}, {"id": "seen-zone", "anchor": [0, 0]}]
        sb["fx"] = [{"id": "unknown-fx", "at": [4, 0]}, {"id": "seen-fx", "at": [0, 0]}]
        sb["pj_poznamky"] = "Secret room inhabitants"
        sb["poznamky"] = "A hidden trap"
        sb["log"].append({"t": "Goblin útočí", "kdo": "Goblin"})
        assert editor.put(f"/api/battles/{bid}/state", json={"state": state}).status_code == 200
        assert editor.post(f"/api/battles/{bid}/share", json={"shared": True}).status_code == 200
        restored = editor.get(f"/api/battles/{bid}").json()["state"]["stav_boje"]
        assert restored["fog"] == sb["fog"]
        public = player.get(f"/api/battles/{bid}").json()["state"]["stav_boje"]
        assert [t["id"] for t in public["tok"]] == ["a"]
        assert [t["nazev"] for t in player.get(f"/api/battles/{bid}").json()["ucastnici"]] == [sb["tok"][0]["nazev"]]
        assert public["ord"] == ["a"]
        for key, expected in (("kresby", "seen"), ("lights", "seen-light"), ("zones", "seen-zone"), ("fx", "seen-fx")):
            assert [v["id"] for v in public[key]] == [expected]
        assert all("Goblin" not in str(l) for l in public["log"])
        assert "pj_poznamky" not in public and "poznamky" not in public
        summary = next(b for b in player.get("/api/battles").json()["battles"] if b["id"] == bid)
        assert [t["nazev"] for t in summary["ucastnici"]] == [sb["tok"][0]["nazev"]]
        assert "manual" not in public["fog"] and "hidden" not in public["fog"]
        sb["fog"]["visible"]["2,0"] = 1
        assert editor.put(f"/api/battles/{bid}/state", json={"state": state}).status_code == 200
        assert [t["id"] for t in player.get(f"/api/battles/{bid}").json()["state"]["stav_boje"]["tok"]] == ["a", "b"]
    finally:
        editor.delete(f"/api/battles/{bid}")
