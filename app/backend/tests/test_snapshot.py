"""Regresní test: compute() proti snapshotu před přepsáním engine.

Snapshot: C:\\Users\\dolfy\\AppData\\Local\\Temp\\montshots\\sheet_snapshot_before.json
Povolené rozdíly = ověřené opravy podle pravidel 2024 (viz ALLOWED_DIFFS).
"""
import json
from pathlib import Path

import pytest

from app import charsheet, db

SNAP = Path(r"C:\Users\dolfy\AppData\Local\Temp\montshots\sheet_snapshot_before.json")

# ověřené rules-correct rozdíly (soubor → množina změněných klíčů)
ALLOWED_DIFFS = {
    "Postava_Dluben.md": {"speed"},                    # Monk Unarmored Movement +15
    "Postava_Vaelen.md": {f"save:{a}" for a in ("STR", "DEX", "CON", "INT", "WIS", "CHA")},  # Aura of Protection
    "Postava_Eligon.md": {f"save:{a}" for a in ("STR", "DEX", "CON", "INT", "WIS", "CHA")},  # Aura of Protection
    "Postava_Irtis.md": {"hp"},                        # Draconic Resilience +20
    "Postava_Iridin_III.md": {"speed"},                # Ranger Roving +5
    "Postava_Mi_Komde.md": {"speed"},                  # Wood Elf 35
    "Postava_Oltar.md": {"speed"},                     # Barbarian Fast Movement +10
    "Postava_Otec_Samuel.md": {"slots"},               # oprava: caster level 3 (Warlock lvl se nepočítá)
    "Postava_Szkunzi.md": {"speed"},                   # Fast Movement +10
    "Postava_Veanor_I.md": {"speed"},                  # Roving +5
    "Postava_Yuthika.md": {"slots"},                   # oprava: Bard 3 → [4,2]
    "Postava_Ne_Maru_Solkai.md": {"hp"},               # Draconic Resilience +3
    "Postava_Ilien_Vaerisse.md": {"init", "speed"},    # Dread Ambusher +PB, Wood Elf 35
    "Postava_Kurrath_Ozgunzi.md": {"speed"},           # Monk/Barbarian movement
    "Postava_Baldrok_Ghorrund.md": {"slots"},          # oprava: Bard 2 → [3]
    "Postava_Ghrent.md": {"ac"},                       # Warforged Integrated Protection +1
    "Postava_Haldrak_Wennk.md": {"init"},              # Dread Ambusher
    "Postava_Kaellith_Vorr.md": {"ac", "hp"},          # Draconic Resilience
    "Postava_Ughrak_Senn.md": {"speed"},               # Monk Unarmored Movement
    "Postava_Wulvar_Dhenn.md": {"init"},               # Dread Ambusher
}


@pytest.mark.skipif(not SNAP.exists(), reason="snapshot neexistuje")
def test_snapshot_diff():
    before = json.loads(SNAP.read_text(encoding="utf-8"))
    con = db.connect()
    rows = con.execute("SELECT path,data FROM entities WHERE type='postava'").fetchall()
    chyby, rozdily = [], []
    for r in rows:
        data = db.jload(r["data"])
        try:
            s = charsheet.compute(data)
        except Exception as ex:  # noqa: BLE001
            chyby.append(f"{r['path']}: {ex}")
            continue
        b = before.get(r["path"])
        if not b:
            continue  # postava přidaná po snapshotu (Postava_Ysmera_Vanthal)
        fname = r["path"].split("/")[-1]
        for k in ("ac", "hp", "init", "passive", "speed"):
            if s[k] != b.get(k):
                rozdily.append((fname, k))
        for a, v in s["saves"].items():
            if v != b["saves"][a]:
                rozdily.append((fname, f"save:{a}"))
        for k2, v in s["skills"].items():
            if v["val"] != b["skills"][k2]:
                rozdily.append((fname, f"skill:{k2}"))
        if s["slots"] != b["slots"]:
            rozdily.append((fname, "slots"))
    neocekavane = [(f, k) for f, k in rozdily
                   if k not in ALLOWED_DIFFS.get(f, set())]
    assert not chyby, f"chyby výpočtu: {chyby}"
    assert not neocekavane, f"neověřené rozdíly: {neocekavane}"
