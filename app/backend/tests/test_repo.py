"""Veřejné médium nesmí obejít filtrovaná mapová API."""
import pytest
from fastapi.testclient import TestClient

from app import config, security
from app.main import app


@pytest.fixture
def repo(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "ROOT", tmp_path)
    return tmp_path


@pytest.mark.parametrize("path", [
    "11_Mapy/bojove_mapy.json",
    "11_Mapy/mista.json",
    "11_Mapy/svet.json",
    "11_Mapy/vodstvo.json",
    "11_Mapy/mapy.json",
    "11_Mapy/mapy/test/mista.json",
    "11_Mapy/boje/secret.json",
    "11_Mapy/new-data.JSON",
])
def test_anonymous_repo_cannot_read_map_data(repo, path):
    file = repo / path
    file.parent.mkdir(parents=True, exist_ok=True)
    file.write_text('{"poznamky":[{"text":"Tajné informace PJ"}]}')
    response = TestClient(app).get("/repo/" + path)
    assert response.status_code == 404
    assert "Tajné informace PJ" not in response.text


@pytest.mark.parametrize("path", [
    "11_Mapy/bojove/assets/assety.json",
    "11_Mapy/bojove/textury/textury.json",
    "11_Mapy/bojove/assets/stul.webp",
])
def test_anonymous_repo_keeps_public_asset_manifests_and_images(repo, path):
    file = repo / path
    file.parent.mkdir(parents=True, exist_ok=True)
    file.write_bytes(b'{"public":true}')
    response = TestClient(app).get("/repo/" + path)
    assert response.status_code == 200
    assert response.content == file.read_bytes()


def test_manifest_alias_cannot_expose_map_data(repo):
    maps = repo / "11_Mapy"
    assets = maps / "bojove/assets"
    assets.mkdir(parents=True)
    data = maps / "bojove_mapy.json"
    data.write_text('{"secret":true}')
    (assets / "assety.json").symlink_to(data)
    response = TestClient(app).get("/repo/11_Mapy/bojove/assets/assety.json")
    assert response.status_code == 404


@pytest.mark.parametrize("role", ["admin", "editor", "player"])
@pytest.mark.parametrize("path", ["mista.json", "bojove_mapy.json", "svet.json"])
def test_editor_coordinate_link_does_not_open_battle_data(repo, monkeypatch, role, path):
    file = repo / "11_Mapy" / path
    file.parent.mkdir(parents=True, exist_ok=True)
    file.write_text('{"data":"coordinates or private map data"}')
    monkeypatch.setitem(app.dependency_overrides, security.optional, lambda: {"role": role})
    response = TestClient(app).get("/repo/11_Mapy/" + path)
    expected = 200 if path == "mista.json" and role in ("admin", "editor") else 404
    assert response.status_code == expected
