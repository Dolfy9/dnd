import json
import tempfile
import unittest
from pathlib import Path

from mapa_epicke import ROOT, generate, inside, update_store


class EpicMapsTest(unittest.TestCase):
    def test_deterministic_assets_and_dimensions(self):
        maps = generate()
        self.assertEqual(maps, generate())
        self.assertEqual(len(maps), 6)
        self.assertEqual(len({m["id"] for m in maps}), 6)
        assets = {a["id"] for a in json.loads((ROOT / "11_Mapy/bojove/assets/assety.json").read_text())["assety"]}
        textures = {a["id"] for a in json.loads((ROOT / "11_Mapy/bojove/textury/textury.json").read_text())["textury"]}
        for m in maps:
            with self.subTest(map=m["id"]):
                self.assertEqual(len(m["mrizka"]), 28)
                self.assertTrue(all(len(row) == 36 for row in m["mrizka"]))
                self.assertGreaterEqual(len(m["objekty"]), 100)
                self.assertTrue(all(o["asset"] in assets for o in m["objekty"]))
                self.assertTrue(all(p["t"] in textures for p in m["malba"]))
                self.assertTrue(all(p["p"] for p in m["malba"]))
                self.assertGreaterEqual(len(m["poznamky"]), 3)
                self.assertGreaterEqual(len(m["start"]["druzina"]), 6)
                self.assertTrue((ROOT / m["misto"]).is_file())
                for key in ["objekty", "steny", "malba", "svetla", "poznamky"]:
                    self.assertEqual(len(m[key]), len({e["id"] for e in m[key]}))

    def test_idempotent_upsert_preserves_other_maps_and_metadata(self):
        maps = generate()
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "maps.json"
            path.write_text(json.dumps({"note":"keep", "mapy":[{"id":"legacy","nazev":"Staré"}]}))
            update_store(path, maps)
            first = path.read_bytes()
            update_store(path, maps)
            self.assertEqual(first, path.read_bytes())
            doc = json.loads(first)
            self.assertEqual(doc["note"], "keep")
            self.assertEqual(doc["mapy"][0], {"id":"legacy","nazev":"Staré"})
            self.assertEqual(doc["mapy"][1:], maps)
            path.write_text('{"mapy":[]}')
            update_store(path, [])
            self.assertEqual(json.loads(path.read_text()), {"mapy":[]})

    def test_invalid_store_does_not_get_overwritten(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "maps.json"
            with self.assertRaises(FileNotFoundError):
                update_store(path, [])
            path.write_text("not json")
            with self.assertRaises(json.JSONDecodeError):
                update_store(path, generate())
            self.assertEqual(path.read_text(), "not json")
        self.assertTrue(inside(1,1,[(0,0),(2,0),(2,2),(0,2)]))
        self.assertFalse(inside(3,1,[(0,0),(2,0),(2,2),(0,2)]))
        self.assertFalse(inside(0,0,[]))

    def test_art_direction_and_roof_metadata(self):
        maps=generate()
        used={o["asset"] for m in maps for o in m["objekty"]}
        supplied={p.stem for p in (ROOT/"11_Mapy/bojove/assets").rglob("*.webp") if p.stem.startswith(("d-","i-","m-"))}
        self.assertTrue(supplied <= used, supplied-used)
        self.assertTrue(maps[0]["interiery"])
        self.assertTrue(maps[1]["interiery"])
        self.assertTrue(maps[3]["interiery"])
        for m in maps:
            for o in m["objekty"]:
                if o["asset"].startswith("d-"):
                    self.assertFalse(o["blocks"])
                    self.assertLess(o["z"],0)
            for region in m["interiery"]:
                self.assertGreaterEqual(len(region["poly"]),3)
        winter=maps[-1]
        self.assertFalse(any(s["t"]=="hlina" for s in winter["malba"]))
        self.assertFalse(any(s["t"]=="dlazba" for s in maps[-2]["malba"]))


if __name__ == "__main__":
    unittest.main()
