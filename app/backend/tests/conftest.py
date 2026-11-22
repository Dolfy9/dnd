import os
import shutil
import sys
import tempfile
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND))

import pytest

if "app.config" in sys.modules:
    raise RuntimeError("Application config was imported before the test sandbox")

_sandbox = tempfile.TemporaryDirectory(prefix="montelien-tests-")
_base = Path(_sandbox.name)
_root = _base / "repo"
_data = _base / "data"
shutil.copytree(BACKEND.parents[1] / "web/assets", _root / "web/assets")
(_root / "11_Mapy").mkdir()
(_root / "11_Mapy/bojove_mapy.json").write_text(
    '{\n "mapy": [\n  {"id": "octowerin-ulicka", "nazev": "Testovací ulička", "mrizka": ["...."]}\n ]\n}',
    encoding="utf-8")
os.environ.update(MONT_ROOT=str(_root), MONT_DATA=str(_data),
                  MONT_DB=str(_data / "montelien.db"), MONT_SECRET="backend-tests-only")

from app import db
from app.ingest import rules


@pytest.fixture(scope="session", autouse=True)
def _rules_loaded():
    """Pravidla musí být v DB (engine čte rules tabulku)."""
    db.init_schema()
    con = db.connect()
    n = con.execute("SELECT count(*) c FROM rules").fetchone()["c"]
    if not n:
        rules.load()


def base_char(**kw):
    c = {"tridy": [], "atributy": {"STR": 10, "DEX": 10, "CON": 10,
                                   "INT": 10, "WIS": 10, "CHA": 10},
         "druh": "Human"}
    c.update(kw)
    return c
