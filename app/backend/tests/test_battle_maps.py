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
