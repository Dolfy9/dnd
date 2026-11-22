import os
from pathlib import Path
import sqlite3
import subprocess
import sys

from app import config, db, watchers
from app.api import battle_maps, battles
from app.ingest import importer, mirror, rules


def test_database_and_writable_paths_are_in_test_sandbox():
    repository = Path(__file__).resolve().parents[3]
    assert config.ROOT != repository
    assert config.ROOT.parent == config.DATA_DIR.parent
    assert config.DB_PATH == config.DATA_DIR / "montelien.db"
    assert Path(db.connect().execute("PRAGMA database_list").fetchone()[2]) == config.DB_PATH
    assert importer.ROOT == mirror.ROOT == watchers.ROOT == battles.ROOT == config.ROOT
    assert battle_maps.MAPY == config.ROOT / "11_Mapy"
    assert rules.A == config.ROOT / "web/assets"
    assert config.DATA_DIR.is_dir()
    assert config.SECRET == "backend-tests-only"


def test_bootstrap_ignores_inherited_paths_even_with_external_database_locked(tmp_path):
    external = tmp_path / "external"
    external.mkdir()
    database = external / "live.db"
    con = sqlite3.connect(database)
    con.execute("CREATE TABLE sentinel(value TEXT)")
    con.execute("INSERT INTO sentinel VALUES('untouched')")
    con.commit()
    before = database.read_bytes()
    env = {**os.environ, "MONT_DB": str(database), "MONT_DATA": str(external / "data"),
           "MONT_ROOT": str(external / "repo")}
    code = """
import runpy
sandbox = runpy.run_path('tests/conftest.py')
from app import config, db
db.init_schema()
con = db.connect()
con.execute("INSERT INTO battle_maps(id,name,data) VALUES('probe','probe','{}')")
con.commit()
assert config.DB_PATH == config.DATA_DIR / 'montelien.db'
assert config.ROOT.parent == config.DATA_DIR.parent
"""
    try:
        con.execute("BEGIN IMMEDIATE")
        result = subprocess.run([sys.executable, "-c", code], cwd=Path(__file__).resolve().parents[1],
                                env=env, capture_output=True, text=True, timeout=20)
        assert result.returncode == 0, result.stdout + result.stderr
        assert not (external / "data").exists()
        assert not (external / "repo").exists()
    finally:
        con.rollback()
        con.close()
    assert database.read_bytes() == before
