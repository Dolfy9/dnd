import os
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND))

import pytest

from app import db
from app.ingest import rules


@pytest.fixture(scope="session", autouse=True)
def _rules_loaded():
    """Pravidla musí být v DB (engine čte rules tabulku)."""
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
