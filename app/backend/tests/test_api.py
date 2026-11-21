"""API testy: postava endpoints + přílohy (TestClient, dočasné ROOT)."""
import io
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app import db, security
from app.api import media as media_mod, pages as pages_mod
from app.ingest import importer as importer_mod, mirror as mirror_mod
from app.main import app

from fastapi import Request


def _fake_user(request: Request):
    """Testovací uživatel podle hlavičky X-Test-Role (default editor)."""
    role = request.headers.get("x-test-role", "editor")
    return {"login": "t_" + role, "name": role, "role": role, "csrf": "x"}


@pytest.fixture(autouse=True)
def _auth_override():
    app.dependency_overrides[security.user] = _fake_user
    yield
    app.dependency_overrides.clear()


@pytest.fixture()
def client_editor():
    c = TestClient(app)
    c.headers["x-test-role"] = "editor"
    return c


@pytest.fixture()
def client_player():
    c = TestClient(app)
    c.headers["x-test-role"] = "player"
    return c


@pytest.fixture()
def client_anon():
    # bez override → skutečný security.user → nepřihlášený
    app.dependency_overrides.clear()
    yield TestClient(app)
    app.dependency_overrides[security.user] = _fake_user


# ---------- postava_api ----------

def test_nahled(client_editor):
    r = client_editor.post("/api/postava/nahled", json={
        "data": {"tridy": [{"trida": "Fighter", "uroven": 2}],
                 "druh": "Dragonborn",
                 "atributy": {"STR": 14, "DEX": 10, "CON": 16, "INT": 8,
                              "WIS": 13, "CHA": 12},
                 "zbroj": {"nazev": "Chain Mail", "typ": "heavy",
                           "zakladni_ac": 16, "stit": True}}})
    assert r.status_code == 200
    assert r.json()["ac"] == 18


def test_postup_fighter_asi(client_editor):
    r = client_editor.post("/api/postava/postup-moznosti", json={
        "data": {"tridy": [{"trida": "Fighter", "uroven": 3}],
                 "druh": "Human",
                 "atributy": {"STR": 16, "DEX": 12, "CON": 14, "INT": 10,
                              "WIS": 10, "CHA": 10}},
        "trida": "Fighter"})
    j = r.json()
    assert r.status_code == 200
    assert j["nova_uroven"] == 4 and j["asi"] is True
    assert j["hit_die"] == 10 and not j["vybirat_podtridu"]


def test_postup_wizard_podtrida(client_editor):
    r = client_editor.post("/api/postava/postup-moznosti", json={
        "data": {"tridy": [{"trida": "Wizard", "uroven": 2}],
                 "druh": "Human",
                 "atributy": {"STR": 8, "DEX": 12, "CON": 14, "INT": 16,
                              "WIS": 10, "CHA": 10}},
        "trida": "Wizard"})
    j = r.json()
    assert r.status_code == 200
    assert j["nova_uroven"] == 3 and j["vybirat_podtridu"]
    names = [s["nazev"] for s in j["podtridy"]]
    assert "Evoker" in names or len(names) >= 4
    assert j["sloty_po"] == [4, 2]


def test_postup_multiclass_prerekvizity(client_editor):
    # Fighter → Wizard bez INT 13 → nevyhovuje
    r = client_editor.post("/api/postava/postup-moznosti", json={
        "data": {"tridy": [{"trida": "Fighter", "uroven": 3}],
                 "druh": "Human",
                 "atributy": {"STR": 16, "DEX": 12, "CON": 14, "INT": 9,
                              "WIS": 10, "CHA": 10}},
        "trida": "Wizard"})
    j = r.json()
    assert j["prerekvizity"]["nova_trida"]["splneno"] is False
    assert j["prerekvizity"]["vyhovuje"] is False


def test_efekty_typy(client_editor):
    j = client_editor.get("/api/postava/efekty-typy").json()
    typy = {t["typ"] for t in j["typy"]}
    assert {"atribut", "ac_vzorec", "kouzlo", "zdroj", "bonus"} <= typy


def test_obsah_slucuje(client_editor):
    j = client_editor.get("/api/postava/obsah", params={"kind": "species"}).json()
    items = j["items"] if "items" in j else j
    names = {i["name"] for i in items}
    assert "Dwarf" in names


# ---------- přílohy ----------

@pytest.fixture()
def tmp_repo(monkeypatch, tmp_path):
    """Dočasné ROOT pro přílohy; entita 'Pokus.md' je přidána do DB a uklizena."""
    (tmp_path / "03_Mesta").mkdir()
    md = tmp_path / "03_Mesta" / "Mesto_Pokus.md"
    md.write_text("---\nmesto:\n  nazev: Pokus\n---\n\n# Pokus\r\nTělo\r\n", encoding="utf-8")
    for mod in (media_mod, pages_mod, importer_mod, mirror_mod):
        monkeypatch.setattr(mod, "ROOT", tmp_path)
    con = db.connect()
    con.execute(
        "INSERT OR REPLACE INTO entities(type,path,slug,name,data,status,tags,"
        "created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)",
        ("mesto", "03_Mesta/Mesto_Pokus.md", "Pokus", "Pokus",
         db.jdump({"nazev": "Pokus"}), "", "[]", db.now(), db.now()))
    con.commit()
    yield tmp_path
    importer_mod.delete_page("03_Mesta/Mesto_Pokus.md")


def test_priloha_upload_delete(client_editor, tmp_repo):
    r = client_editor.post("/api/media/prilohy",
                           params={"entita": "03_Mesta/Mesto_Pokus.md"},
                           files={"file": ("dopis.txt", io.BytesIO(b"ahoj"), "text/plain")})
    assert r.status_code == 200, r.text
    cesta = r.json()["cesta"]
    assert cesta.startswith("03_Mesta/prilohy/Pokus/")
    assert (tmp_repo / cesta).is_file()
    # záznam v entitě
    data = db.jload(db.connect().execute(
        "SELECT data FROM entities WHERE path='03_Mesta/Mesto_Pokus.md'"
    ).fetchone()["data"])
    assert data["prilohy"][0]["cesta"] == cesta
    # tělo .md zůstalo (frontmatter se přepsal, text zůstal)
    assert "Tělo" in (tmp_repo / "03_Mesta" / "Mesto_Pokus.md").read_text(encoding="utf-8")
    # stažení (text/plain inline + nosniff)
    g = client_editor.get("/api/media/prilohy/" + cesta)
    assert g.status_code == 200
    assert g.headers["x-content-type-options"] == "nosniff"
    assert "attachment" not in g.headers.get("content-disposition", "")
    # smazání
    d = client_editor.delete("/api/media/prilohy",
                             params={"entita": "03_Mesta/Mesto_Pokus.md", "cesta": cesta})
    assert d.status_code == 200
    assert not (tmp_repo / cesta).exists()
    data = db.jload(db.connect().execute(
        "SELECT data FROM entities WHERE path='03_Mesta/Mesto_Pokus.md'"
    ).fetchone()["data"])
    assert data["prilohy"] == []


def test_priloha_binarni_attachment(client_editor, tmp_repo):
    r = client_editor.post("/api/media/prilohy",
                           params={"entita": "03_Mesta/Mesto_Pokus.md"},
                           files={"file": ("data.bin", io.BytesIO(b"\x00\x01"), "application/octet-stream")})
    cesta = r.json()["cesta"]
    g = client_editor.get("/api/media/prilohy/" + cesta)
    assert g.status_code == 200
    assert "attachment" in g.headers["content-disposition"]
    assert g.headers["x-content-type-options"] == "nosniff"


def test_priloha_auth(client_anon, tmp_repo):
    # nepřihlášený: upload i download odmítnuty
    r = client_anon.post("/api/media/prilohy",
                         params={"entita": "03_Mesta/Mesto_Pokus.md"},
                         files={"file": ("a.txt", io.BytesIO(b"x"), "text/plain")})
    assert r.status_code in (401, 403)
    g = client_anon.get("/api/media/prilohy/03_Mesta/prilohy/Pokus/a.txt")
    assert g.status_code in (401, 403)


def test_priloha_tajne(client_editor, client_player, tmp_repo):
    r = client_editor.post("/api/media/prilohy",
                           params={"entita": "03_Mesta/Mesto_Pokus.md", "tajne": True},
                           files={"file": ("tajne.txt", io.BytesIO(b"dm"), "text/plain")})
    assert r.status_code == 200, r.text
    cesta = r.json()["cesta"]
    assert client_editor.get("/api/media/prilohy/" + cesta).status_code == 200
    assert client_player.get("/api/media/prilohy/" + cesta).status_code == 404


def test_priloha_traversal(client_editor, tmp_repo):
    r = client_editor.post("/api/media/prilohy",
                           params={"entita": "03_Mesta/Mesto_Pokus.md"},
                           files={"file": ("../../evil.txt", io.BytesIO(b"x"), "text/plain")})
    assert r.status_code == 200  # název se sanitizuje → uloží se jako evil.txt
    assert ".." not in r.json()["cesta"]
    g = client_editor.get("/api/media/prilohy/../Mesto_Pokus.md")
    assert g.status_code in (400, 404)


def test_repo_nevystavi_prilohy(client_anon, tmp_repo):
    # přílohy nejsou veřejné přes /repo ani když existují
    d = tmp_repo / "03_Mesta" / "prilohy" / "Pokus"
    d.mkdir(parents=True)
    (d / "x.png").write_bytes(b"\x89PNG")
    r = client_anon.get("/repo/03_Mesta/prilohy/Pokus/x.png")
    assert r.status_code == 404


def test_priloha_svg_jako_attachment(client_editor, tmp_repo):
    r = client_editor.post("/api/media/prilohy",
                           params={"entita": "03_Mesta/Mesto_Pokus.md"},
                           files={"file": ("x.svg", io.BytesIO(b"<svg/>"), "image/svg+xml")})
    cesta = r.json()["cesta"]
    g = client_editor.get("/api/media/prilohy/" + cesta)
    assert g.status_code == 200
    assert "attachment" in g.headers["content-disposition"]


def test_prune_stale_rows():
    """Indexovaný řádek k neexistujícímu souboru se při prune smaže."""
    from app.ingest import importer
    con = db.connect()
    fake = "04_Postavy/NPC/Postava_PruneStale_Test.md"
    con.execute("REPLACE INTO pages(path,type,folder,title,status,secret,has_dm,"
                "plaintext,toc,meta,mtime,imported_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
                (fake, "postava", "04_Postavy", "Stale", "", 0, 0, "", "[]", "{}", 0, db.now()))
    con.execute("INSERT INTO entities(type,path,slug,name,data,status,tags,"
                "created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)",
                ("postava", fake, "PruneStale_Test", "Stale", "{}", "", "[]",
                 db.now(), db.now()))
    con.commit()
    assert importer.prune_stale() >= 1
    assert not con.execute("SELECT 1 FROM pages WHERE path=?", (fake,)).fetchone()
    assert not con.execute("SELECT 1 FROM entities WHERE path=?", (fake,)).fetchone()
