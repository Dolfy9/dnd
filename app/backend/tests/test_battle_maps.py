"""Bojové mapy API: CRUD, upload obrázku, byte-identický round-trip, player filtr."""
import json
from io import BytesIO

import pytest
from fastapi.testclient import TestClient
from fastapi import Request

from app import security
from app.main import app
from app.config import ROOT

JSON_F = ROOT / "11_Mapy" / "bojove_mapy.json"


def _fake_user(request: Request):
    role = request.headers.get("x-test-role", "editor")
    return {"login": "t_" + role, "name": role, "role": role, "csrf": "x"}


@pytest.fixture(autouse=True)
def _auth_override():
    app.dependency_overrides[security.user] = _fake_user
    app.dependency_overrides[security.optional] = _fake_user
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def editor():
    c = TestClient(app)
    c.headers["x-test-role"] = "editor"
    return c


@pytest.fixture
def player():
    c = TestClient(app)
    c.headers["x-test-role"] = "player"
    return c


@pytest.fixture
def tmp_map(editor):
    r = editor.post("/api/map/bojove", json={"nazev": "Test Mapa X", "mrizka": ["....", ".##.", "...."]})
    assert r.status_code == 200, r.text
    mid = r.json()["id"]
    yield mid
    editor.delete(f"/api/map/bojove/{mid}")


def test_crud(editor, tmp_map):
    mid = tmp_map
    r = editor.get("/api/map/data")
    m = next(x["data"] for x in r.json()["bojove_mapy"] if x["id"] == mid)
    assert m["nazev"] == "Test Mapa X"
    # update — přidej zeď a poznámku
    r = editor.put(f"/api/map/bojove/{mid}", json={
        "steny": [{"id": "w1", "a": [1, 0], "b": [1, 1], "typ": "secret"}],
        "poznamky": [{"id": "n1", "x": 0, "y": 0, "text": "tajné"}],
        "objekty": [{"id": "o1", "asset": "strom", "x": 1, "y": 1, "w": 1, "h": 1, "dmOnly": True},
                    {"id": "o2", "asset": "strom", "x": 2, "y": 1, "w": 1, "h": 1}],
    })
    assert r.status_code == 200, r.text
    assert r.json()["mapa"]["steny"][0]["typ"] == "secret"
    # duplikat
    r = editor.post(f"/api/map/bojove/{mid}/duplikat")
    dup = r.json()["id"]
    assert dup != mid
    editor.delete(f"/api/map/bojove/{dup}")
    # delete
    r = editor.delete(f"/api/map/bojove/{mid}")
    assert r.status_code == 200
    r = editor.get("/api/map/data")
    assert not any(x["id"] == mid for x in r.json()["bojove_mapy"])


def test_player_filter(editor, player, tmp_map):
    mid = tmp_map
    editor.put(f"/api/map/bojove/{mid}", json={
        "steny": [{"id": "w1", "a": [1, 0], "b": [1, 1], "typ": "secret"}],
        "poznamky": [{"id": "n1", "x": 0, "y": 0, "text": "tajné"}],
        "objekty": [{"id": "o1", "asset": "s", "x": 1, "y": 1, "w": 1, "h": 1, "dmOnly": True},
                    {"id": "o2", "asset": "s", "x": 2, "y": 1, "w": 1, "h": 1}],
        "kresby": [{"id": "k1", "kind": "line", "pts": [[0, 0], [1, 1]], "stroke": "#fff",
                    "width": 1, "dmOnly": True}],
    })
    r = player.get("/api/map/data")
    m = next(x["data"] for x in r.json()["bojove_mapy"] if x["id"] == mid)
    assert "poznamky" not in m
    assert m["steny"][0]["typ"] == "wall"          # secret → wall
    assert [o["id"] for o in m["objekty"]] == ["o2"]
    assert m.get("kresby", []) == []


def test_image_validation(editor, tmp_map):
    mid = tmp_map
    r = editor.post(f"/api/map/bojove/{mid}/obrazek",
                    files={"file": ("x.txt", BytesIO(b"hello"), "text/plain")})
    assert r.status_code == 400
    png = bytes.fromhex("89504e470d0a1a0a") + b"\x00" * 32
    r = editor.post(f"/api/map/bojove/{mid}/obrazek",
                    files={"file": ("mapa.png", BytesIO(png), "image/png")})
    assert r.status_code == 200, r.text
    assert r.json()["obrazek"].endswith(".png")


def test_byte_identical_roundtrip(editor):
    raw_before = JSON_F.read_bytes()
    r = editor.post("/api/map/bojove", json={"nazev": "RoundTrip Tmp"})
    mid = r.json()["id"]
    # soubor po přidání: původní položky nesmí být přeformátované — porovnej
    # serializaci původních map před/po
    before = json.loads(raw_before)
    after = json.loads(JSON_F.read_text(encoding="utf-8"))
    for mb, ma in zip(before["mapy"], after["mapy"]):
        assert json.dumps(mb, ensure_ascii=False, indent=1) == \
               json.dumps(ma, ensure_ascii=False, indent=1)
    editor.delete(f"/api/map/bojove/{mid}")
    assert JSON_F.read_bytes() == raw_before


def test_paint_atmosphere_roundtrip(editor, monkeypatch, tmp_path):
    from app.api import battle_maps

    storage = tmp_path / "mapy.json"
    monkeypatch.setattr(battle_maps, "JSON_F", storage)
    fields = {
        "malba": [{"id": "s", "t": "hlina", "b": 1.25, "o": .8, "h": .4,
                   "p": [[.1, .2], [1.75, 2.3]]}],
        "atmosfera": {"amb": .15, "barva": "#101522"},
        "pocasi": {"typ": "bourka", "sila": .8, "vitr": 125},
        "objekty": [{"id": "portal", "asset": "portal", "anim": False, "x": 1, "y": 1, "w": 2, "h": 2}],
        "svetla": [{"id": "l", "x": 1.2, "y": 2.3, "bright": 10, "dim": 15,
                    "intenzita": .7, "blikani": True}],
    }
    r = editor.post("/api/map/bojove", json={"nazev": "Visual Roundtrip Tmp", **fields})
    assert r.status_code == 200, r.text
    mid = r.json()["id"]
    try:
        stored = json.loads(storage.read_text())["mapy"][0]
        for key, value in fields.items():
            assert stored[key] == value
            assert r.json()["mapa"][key] == value
        r = editor.put(f"/api/map/bojove/{mid}", json={"malba": [], "atmosfera": None})
        assert r.status_code == 200, r.text
        stored = json.loads(storage.read_text())["mapy"][0]
        assert stored["malba"] == []
        assert "atmosfera" not in stored
        assert stored["svetla"] == fields["svetla"]
    finally:
        editor.delete(f"/api/map/bojove/{mid}")
