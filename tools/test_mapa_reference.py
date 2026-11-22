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
                self.assertLess(m["atmosfera"]["amb"], .3)
                self.assertGreater(m["atmosfera"]["vineta"], 0)
                self.assertTrue(any(o["asset"] == "ov-mlha-chuchvalec" and 0 < o["opacity"] < .3 for o in m["objekty"]))
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
        self.assertEqual(harbor["malba"][0]["t"], "hluboka-voda")
        self.assertEqual(harbor["mrizka"][20][12], "~")
        self.assertEqual(harbor["mrizka"][9][12], ".")
        self.assertTrue(any(o["asset"] == "p3-lodni-paluba" for o in harbor["objekty"]))
        self.assertTrue(any(o["asset"] == "stan" for o in harbor["objekty"]))
        self.assertTrue(any(o["asset"] == "m-kamenna-zidka" for o in harbor["objekty"]))
        self.assertGreater(len(garden["objekty"]), 700)
        self.assertTrue({"trava", "teren-les", "hlina"} <= {p["t"] for p in garden["malba"] if p["h"] == 0})
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
