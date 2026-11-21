"""Bezpečný parser výrazů pro efekty (žádný eval)."""
import pytest

from app.engine.vyrazy import VýrazChyba, vyhodnot

CTX = {"pb": 3, "uroven": 7, "walk": 30,
       "mods": {"STR": 4, "CHA": 2},
       "uroven_v": lambda t: 5 if t == "Fighter" else 0}


def t(expr, ctx=None):
    return vyhodnot(expr, CTX if ctx is None else ctx)


def test_zaklady():
    assert t("5") == 5
    assert t("-3") == -3
    assert t("2 + 3") == 5
    assert t("2 + 3 * 4") == 14          # precedence
    assert t("(2 + 3) * 4") == 20        # závorky
    assert t("10 / 3") == 3              # celočíselné dělení
    assert t("7 - 2 - 1") == 4


def test_funkce():
    assert t("max(1, 5)") == 5
    assert t("min(1, 5)") == 1
    assert t("max(PB, mod:STR)") == 4
    assert t("min(mod:CHA, uroven)") == 2


def test_kontext():
    assert t("PB") == 3
    assert t("uroven") == 7
    assert t("mod:STR") == 4
    assert t("uroven:Fighter") == 5
    assert t("uroven:Bard") == 0
    # prahový lookup uroven:Trida/N → 1 když úroveň ve třídě ≥ N
    assert t("1 + uroven:Fighter/17") == 1   # Fighter 5 < 17 → +0
    assert t("1 + uroven:Fighter/5") == 2    # Fighter 5 ≥ 5 → +1
    assert t("walk") == 30


def test_odmitne_neplatne():
    for e in ["__import__('os')", "abc", "1 +", "(1", "1 2", "5;", "x = 1",
              "t('x')", "mod:", "uroven:", "5 ** 2"]:
        with pytest.raises(VýrazChyba):
            t(e)


def test_retezec_ciselny():
    assert vyhodnot("12", {}) == 12
    assert vyhodnot(8, {}) == 8
