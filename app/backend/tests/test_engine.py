"""Jednotkové případy engine postav (pravidla 2024)."""
import pytest

from app import charsheet
import importlib

compute_mod = importlib.import_module("app.engine.compute")
efekty_mod = importlib.import_module("app.engine.efekty")


def c(**kw):
    d = {"tridy": [], "druh": "Human",
         "atributy": {"STR": 10, "DEX": 10, "CON": 10,
                      "INT": 10, "WIS": 10, "CHA": 10}}
    d.update(kw)
    return d


def attr(**kw):
    base = {"STR": 10, "DEX": 10, "CON": 10, "INT": 10, "WIS": 10, "CHA": 10}
    base.update(kw)
    return base


def test_kharr_ac():
    s = charsheet.compute(c(
        tridy=[{"trida": "Fighter", "uroven": 2}], druh="Dragonborn",
        druh_volby="Bronze Dragonborn (Lightning)",
        featy=[{"nazev": "Protection"}],
        zbroj={"nazev": "Chain Mail", "typ": "heavy", "zakladni_ac": 16,
               "stit": True}))
    assert s["ac"] == 18  # Chain Mail 16 + Shield 2
    assert "Lightning" in s["odolnosti"]


def test_barbarian_unarmored():
    s = charsheet.compute(c(
        tridy=[{"trida": "Barbarian", "uroven": 5}],
        atributy=attr(STR=16, DEX=14, CON=16),
        zbroj={"typ": "none"}))
    assert s["ac"] == 10 + 2 + 3  # 10 + DEX + CON


def test_monk_unarmored():
    s = charsheet.compute(c(
        tridy=[{"trida": "Monk", "uroven": 5}],
        atributy=attr(DEX=16, WIS=16),
        zbroj={"typ": "none"}))
    assert s["ac"] == 10 + 3 + 3  # 10 + DEX + WIS


def test_alert_iniciativa():
    base = charsheet.compute(c(tridy=[{"trida": "Fighter", "uroven": 3}],
                               atributy=attr(DEX=14)))
    s = charsheet.compute(c(tridy=[{"trida": "Fighter", "uroven": 3}],
                            atributy=attr(DEX=14), featy=[{"nazev": "Alert"}]))
    assert s["init"] - base["init"] == s["pb"]


def test_tough_hp():
    base = charsheet.compute(c(tridy=[{"trida": "Fighter", "uroven": 3}],
                               atributy=attr(CON=12)))
    s = charsheet.compute(c(tridy=[{"trida": "Fighter", "uroven": 3}],
                            atributy=attr(CON=12), featy=[{"nazev": "Tough"}]))
    assert s["hp"] - base["hp"] == 6  # 2× úroveň postavy


def test_dwarf_hp():
    base = charsheet.compute(c(tridy=[{"trida": "Fighter", "uroven": 5}],
                               atributy=attr(CON=12), druh="Human"))
    s = charsheet.compute(c(tridy=[{"trida": "Fighter", "uroven": 5}],
                            atributy=attr(CON=12), druh="Dwarf"))
    assert s["hp"] - base["hp"] == 5  # Dwarven Toughness +1/úroveň


def test_elf_high_elf_volba():
    s = charsheet.compute(c(
        tridy=[{"trida": "Wizard", "uroven": 1}], atributy=attr(INT=16),
        druh="Elf",
        volby={"Elf: Elven Lineage|Elven Lineage": "High Elf",
               "Elf: Keen Senses|Keen Senses": "Perception"}))
    assert any(x.startswith("Darkvision") for x in s["smysly"])
    assert "Perception" in s["skills"] and s["skills"]["Perception"]["prof"]
    # High Elf → cantrip navíc (Prestidigitation)
    names = [k.get("nazev") for k in s["kouzla"] if isinstance(k, dict)]
    assert "Prestidigitation" in names


def test_elf_bez_volby():
    s = charsheet.compute(c(tridy=[{"trida": "Wizard", "uroven": 1}],
                            atributy=attr(INT=16), druh="Elf"))
    volby = [v["volba"] for v in s["chybejici_volby"]]
    assert any("Lineage" in v for v in volby)


def test_wizard5_sloty():
    s = charsheet.compute(c(tridy=[{"trida": "Wizard", "uroven": 5}],
                            atributy=attr(INT=16)))
    assert s["slots"] == [4, 3, 2]


def test_multiclass_pal2_sor3():
    s = charsheet.compute(c(
        tridy=[{"trida": "Paladin", "uroven": 2},
               {"trida": "Sorcerer", "uroven": 3}],
        atributy=attr(STR=16, CHA=16)))
    # caster level = 2//2 + 3 = 4 → [4,3]
    assert s["slots"] == [4, 3]


def test_warlock_pact():
    s = charsheet.compute(c(tridy=[{"trida": "Warlock", "uroven": 5}],
                            atributy=attr(CHA=16)))
    assert s["pact"]["uroven"] == 3 and s["pact"]["pocet"] == 2


def test_prepis_vyhraje():
    s = charsheet.compute(c(tridy=[{"trida": "Fighter", "uroven": 3}],
                            atributy=attr(DEX=14),
                            prepis={"init": 99, "ac": 25}))
    assert s["init"] == 99 and s["ac"] == 25
    s2 = charsheet.compute(c(tridy=[{"trida": "Fighter", "uroven": 3}],
                             ac_rucne=21))
    assert s2["ac"] == 21


def _fake_rules(rows: dict):
    """Nahradí načítání rules tabulky v obou modulech (compute i efekty)."""
    def fake(kind):
        return rows.get(kind, {})
    return fake


def test_vlastni_druh(monkeypatch):
    fake = _fake_rules({
        "species": {"Žábařík": {
            "vlastni": True, "rychlost": 25,
            "rysy": {"Vodní dýchání": {"text": "Dýchá vodu.",
                                     "efekty": [{"typ": "rychlost", "druh": "swim",
                                                 "hodnota": 30, "nastavit": True}]},
                     "Odolnost proti jedu": {"text": "", "efekty": [
                         {"typ": "odolnost", "hodnota": "Poison"}]}}}},
    })
    monkeypatch.setattr(compute_mod, "rules_rows", fake)
    monkeypatch.setattr(efekty_mod, "rules_rows", fake)
    s = charsheet.compute(c(druh="Žábařík", tridy=[{"trida": "Fighter", "uroven": 1}]))
    assert s["rychlosti"].get("swim") == 30
    assert "Poison" in s["odolnosti"]


def test_vlastni_trida(monkeypatch):
    fake = _fake_rules({
        "class": {"Šárinka": {
            "vlastni": True, "hit_die": 12, "zachrany": ["STR", "CON"],
            "kouzleni": {"typ": "half", "atribut": "WIS"},
            "tabulka": {"1": {"2nd": "2"}, "2": {"2nd": "3"}},
            "rysy": {"Skok": {"uroven": 1, "text": "Skáče daleko.",
                              "efekty": [{"typ": "bonus", "cil": "pasivni",
                                          "hodnota": 2}]}}}}})
    monkeypatch.setattr(compute_mod, "rules_rows", fake)
    monkeypatch.setattr(efekty_mod, "rules_rows", fake)
    s = charsheet.compute(c(tridy=[{"trida": "Šárinka", "uroven": 2}],
                            atributy=attr(STR=16, CON=14, WIS=14)))
    assert s["dice"] == {"d12": 2}
    assert s["saves"]["STR"] == 3 + s["pb"] and s["saves"]["CON"] == 2 + s["pb"]
    assert s["casting"] and s["casting"][0]["ab"] == "WIS"


def test_predmet_ac_naladeni(monkeypatch):
    fake = _fake_rules({
        "item": {"Prsten Ochrany": {
            "vlastni": True, "typ": "ring", "naladeni": True,
            "efekty": [{"typ": "ac", "hodnota": 1}]}},
        "species": {"Human": {"rychlost": 30, "rysy": {}}},
    })
    monkeypatch.setattr(compute_mod, "rules_rows", fake)
    monkeypatch.setattr(efekty_mod, "rules_rows", fake)
    bez = charsheet.compute(c(tridy=[{"trida": "Fighter", "uroven": 1}],
                            zbroj={"nazev": "Chain Mail", "typ": "heavy",
                                   "zakladni_ac": 16}))
    s = charsheet.compute(c(
        tridy=[{"trida": "Fighter", "uroven": 1}],
        zbroj={"nazev": "Chain Mail", "typ": "heavy", "zakladni_ac": 16},
        vybava=[{"nazev": "Prsten Ochrany", "vybaveno": True, "naladeno": True,
                 "predmet": "Prsten Ochrany"}]))
    assert s["ac"] - bez["ac"] == 1
    # bez naladění se efekt neaplikuje
    s2 = charsheet.compute(c(
        tridy=[{"trida": "Fighter", "uroven": 1}],
        zbroj={"nazev": "Chain Mail", "typ": "heavy", "zakladni_ac": 16},
        vybava=[{"nazev": "Prsten Ochrany", "vybaveno": True, "naladeno": False,
                 "predmet": "Prsten Ochrany"}]))
    assert s2["ac"] == bez["ac"]


def test_legacy_asi_volba_potlacena():
    """Legacy postava (bez atributy_zaklad): ASI volba se nehlásí –
    možnosti jsou jen atribut/textové efekty. Nová postava ji hlásí."""
    featy = [{"nazev": "Ability Score Improvement"}]
    legacy = charsheet.compute(c(tridy=[{"trida": "Fighter", "uroven": 4}],
                                 featy=featy))
    assert not any(v["volba"] == "ASI" for v in legacy["chybejici_volby"])
    nova = charsheet.compute(c(tridy=[{"trida": "Fighter", "uroven": 4}],
                               featy=featy,
                               atributy_zaklad=attr(STR=15, CON=13),
                               bonusy_pozadi={"STR": 1}))
    assert any(v["volba"] == "ASI" for v in nova["chybejici_volby"])


def test_magic_initiate_autoresolve():
    """Magic Initiate z pozadí/featu s uvedeným seznamem se vyřeší sám."""
    s = charsheet.compute(c(
        tridy=[{"trida": "Fighter", "uroven": 1}], pozadi="Acolyte",
        featy=[{"nazev": "Magic Initiate", "zdroj": "Pozadí (Acolyte)",
                "poznamka": "Cleric: Toll the Dead, Sacred Flame; Command"}]))
    assert not any(v["volba"] == "Seznam kouzel"
                   for v in s["chybejici_volby"])
    # bez nápovědy zůstane volba nevyřešená (u strukturované postavy)
    s2 = charsheet.compute(c(tridy=[{"trida": "Fighter", "uroven": 1}],
                             featy=[{"nazev": "Magic Initiate"}],
                             atributy_zaklad=attr(STR=15)))
    assert any(v["volba"] == "Seznam kouzel"
               for v in s2["chybejici_volby"])
