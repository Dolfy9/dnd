import copy
import json
import tempfile
import unittest
from pathlib import Path

from mapa_epicke import ROOT, update_store
from mapa_reference import generate, isolated_store


class ReferenceMapsTest(unittest.TestCase):
    def test_deterministic_editor_native_layers(self):
        maps = generate()
        self.assertEqual(maps, generate())
        self.assertEqual([m["id"] for m in maps],
                         ["reference-pristav-tri-mola", "reference-zahrada-mesic"])
        assets = {a["id"]: a for a in json.loads(
            (ROOT / "11_Mapy/bojove/assets/assety.json").read_text())["assety"]}
        textures = {t["id"] for t in json.loads(
            (ROOT / "11_Mapy/bojove/textury/textury.json").read_text())["textury"]}
        for m in maps:
            with self.subTest(map=m["id"]):
                self.assertEqual(len(m["mrizka"]), 28)
                self.assertTrue(all(len(row) == 42 for row in m["mrizka"]))
                self.assertNotIn("obrazek", m)
                self.assertTrue((ROOT / m["misto"]).is_file())
                self.assertGreater(len(m["objekty"]), 100)
                self.assertLess(m["atmosfera"]["amb"], .5)
                self.assertGreater(m["atmosfera"]["vineta"], 0)
                self.assertTrue(any(o["asset"] == "ov-mlha-chuchvalec" and 0 < o["opacity"] < .7 for o in m["objekty"]))
                self.assertTrue(m["malba"] and m["svetla"] and m["trasy"])
                for o in m["objekty"]:
                    self.assertIn(o["asset"], assets)
                    self.assertGreater(o["w"], 0)
                    self.assertGreater(o["h"], 0)
                    self.assertGreaterEqual(o.get("v", 0), 0)
                    self.assertLessEqual(o.get("v", 0), len(assets[o["asset"]].get("varianty", [])))
                for stroke in m["malba"]:
                    self.assertIn(stroke["t"], textures)
                    self.assertTrue(stroke["p"])
                for route in m["trasy"]:
                    self.assertIn(route["druh"], ["cesta", "molo", "plot", "zidka"])
                    self.assertGreaterEqual(len(route["pts"]), 2)
                    self.assertGreater(route["sirka"], 0)
                    self.assertLessEqual(route["sirka"], 12)
                    self.assertTrue(all(a != b for a, b in zip(route["pts"], route["pts"][1:])))
                    if "t" in route:
                        self.assertIn(route["t"], textures)
                for key in ["objekty", "malba", "svetla", "trasy", "steny", "poznamky"]:
                    self.assertEqual(len(m[key]), len({x["id"] for x in m[key]}))
                for x, y in m["start"]["druzina"]:
                    self.assertNotEqual(m["mrizka"][y][x], "~")

    def test_reference_landmarks_and_water(self):
        harbor, garden = generate()
        self.assertEqual(sum(r["druh"] == "molo" for r in harbor["trasy"]), 3)
        self.assertEqual(len(harbor["interiery"]), 2)
        self.assertEqual(sum(w["typ"] == "door" for w in harbor["steny"]), 2)
        self.assertEqual(len([l for l in harbor["svetla"] if l.get("nazev")=="Tlumené světlo skladu"]),2)
        self.assertGreaterEqual(len([o for o in harbor["objekty"] if o["asset"]=="ov-mesic-odlesk" and o.get("anim")=="voda"]),4)
        self.assertTrue(all(o.get("anim")=="voda" for m in (harbor,garden) for o in m["objekty"] if o["asset"]=="ov-mlha-chuchvalec"))
        patches=[p for p in garden["malba"] if p["poly"] and len(p["p"])==7]
        self.assertEqual(len(patches),36)
        self.assertTrue(all(p["h"]==0 and p["o"]<=.4 for p in patches))
        pond=next(o for o in garden["objekty"] if o["asset"]=="z-jezirko-fontana")
        self.assertEqual(pond["v"],1)
        self.assertAlmostEqual(pond["w"]/pond["h"],512/251,places=3)
        leaves=[o for o in garden["objekty"] if o["asset"]=="d-listi"]
        self.assertLess(len(leaves),30)
        self.assertTrue(all(o["opacity"]<=.3 and o["w"]<1 for o in leaves))
        mist=[o for o in garden["objekty"] if o["asset"]=="ov-mlha-chuchvalec"]
        self.assertTrue(all(o["opacity"]>=.5 for o in mist))
        self.assertEqual(harbor["malba"][0]["t"], "hluboka-voda")
        self.assertEqual(harbor["mrizka"][20][12], "~")
        self.assertEqual(harbor["mrizka"][9][12], ".")
        raft = next(o for o in harbor["objekty"] if o["asset"] == "pristav-vor-plachta")
        self.assertEqual(raft["v"], 0)
        self.assertEqual(raft["w"], raft["h"])
        self.assertFalse(any(o["asset"] in {"stan", "p3-lodni-paluba"} for o in harbor["objekty"]))
        amber = [l for l in harbor["svetla"] if l["color"] == "#ff9f45"]
        self.assertEqual(len(amber), 9)
        self.assertTrue(all(l["intenzita"] == 1 and l["dim"] <= 9 for l in amber))
        self.assertTrue(all(m["atmosfera"]["barva"] == "#010102" for m in (harbor, garden)))
        self.assertTrue(any(o["asset"] == "m-kamenna-zidka" for o in harbor["objekty"]))
        self.assertGreater(len(garden["objekty"]), 700)
        self.assertTrue({"t-zahrada-trava-stin", "t-zahrada-mech-listi", "t-zahrada-hlina-koreny"} <= {p["t"] for p in garden["malba"]})
        self.assertFalse(any(r.get("t")=="t-hlina-pesina" and all(p[0]==21 for p in r["pts"]) for r in garden["trasy"]))
        groundcover=[o for o in garden["objekty"] if o["asset"]=="gen2-kapradi"]
        self.assertGreater(len(groundcover),80)
        bed=[o for o in garden["objekty"] if o["asset"] in {"gen2-kapradi","z-brectan-previs","gen2-ker2"}]
        for y,left,right in [(4.6,2,40),(23.8,2,40),(9.6,8,33),(21.5,8,33)]:
            for x in range(left,right):
                self.assertTrue(any(abs(o["x"]-x)<1.5 and abs(o["y"]-y)<1.4 for o in bed))
        hedges = [r for r in garden["trasy"] if r["druh"] == "plot"]
        self.assertEqual(len(hedges), 4)
        self.assertTrue(all(r["hladke"] and r["sirka"] >= 1.25 for r in hedges))
        for y in (3.5, 25):
            bands = [r for r in hedges if r["pts"][0][1] == y or r["pts"][-1][1] == y]
            self.assertEqual(len(bands), 2)
            self.assertEqual(min(p[0] for r in bands for p in r["pts"]), 1)
            self.assertEqual(max(p[0] for r in bands for p in r["pts"]), 41)
        self.assertEqual(sum(o["asset"] == "z-socha-kral" for o in garden["objekty"]), 8)
        for asset in ["z-rotunda-ruina", "z-jezirko-fontana", "ov-svetlusky", "ov-mesic-odlesk"]:
            self.assertTrue(any(o["asset"] == asset for o in garden["objekty"]))
        self.assertEqual(garden["mrizka"][14][20], "~")
        self.assertEqual(garden["mrizka"][14][5], ".")

    def test_isolated_store_keeps_committed_metadata_and_only_upserts_own_ids(self):
        maps = generate()
        committed = {"metadata": {"keep": [1, 2]}, "mapy": [
            {"id": "user-map", "nazev": "Uživatelova mapa"},
            {"id": maps[0]["id"], "nazev": "Stará verze"}]}
        original = copy.deepcopy(committed)
        result = isolated_store(committed, maps)
        self.assertEqual(committed, original)
        self.assertEqual(result["metadata"], committed["metadata"])
        self.assertEqual(result["mapy"], [committed["mapy"][0], *maps])
        self.assertEqual(isolated_store(result, maps), result)
        self.assertEqual(isolated_store(committed, []), committed)
        self.assertEqual(isolated_store({}, maps), {"mapy": maps})

    def test_working_store_upsert_preserves_user_edits_and_rejects_invalid_json(self):
        maps = generate()
        working = {"note": "unsaved metadata", "mapy": [
            {"id": "user-map", "objekty": [{"id": "edited"}]}]}
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "maps.json"
            path.write_text(json.dumps(working))
            update_store(path, maps)
            first = path.read_bytes()
            update_store(path, maps)
            self.assertEqual(first, path.read_bytes())
            doc = json.loads(first)
            self.assertEqual(doc["mapy"], [*working["mapy"], *maps])
            self.assertEqual(doc["note"], working["note"])
            path.write_text("not json")
            with self.assertRaises(json.JSONDecodeError):
                update_store(path, maps)
            self.assertEqual(path.read_text(), "not json")


if __name__ == "__main__":
    unittest.main()
