import importlib.util
import tempfile
import unittest
from unittest.mock import patch
from pathlib import Path
from PIL import Image

spec = importlib.util.spec_from_file_location("mapa_assety", Path(__file__).with_name("mapa_assety.py"))
assets = importlib.util.module_from_spec(spec)
spec.loader.exec_module(assets)


class AssetImportTests(unittest.TestCase):
    def test_animation_metadata(self):
        for key, anim in [("gen2-strom", "vitr"), ("keř", "vitr"), ("pochodeň", "ohen"),
                          ("portal", "portal"), ("rune-kamen", "zare"), ("i-krb","ohen"),
                          ("i-kolebka-lustr","ohen"), ("m-lucerna-sloup","ohen")]:
            self.assertEqual(assets.animation_metadata({"id": key}), {"anim": anim})
        self.assertEqual(assets.animation_metadata({"id": "stul"}), {})
    def test_key_trim_despill_and_empty(self):
        image = Image.new("RGB", (20, 20), "#ff00ff")
        image.paste((20, 180, 30), (5, 5, 15, 15))
        image.putpixel((5, 5), (138, 90, 143))
        result = assets.key_magenta(image)
        self.assertEqual(result.size, (512, 512))
        self.assertEqual(result.getpixel((0, 0))[3], 0)
        self.assertGreater(result.getpixel((256, 256))[3], 250)
        self.assertIsNone(assets.key_magenta(Image.new("RGB", (10, 10), "#ff00ff")).getbbox())

    def test_texture_and_missing_source(self):
        result = assets.repair_texture(Image.new("RGB", (1024, 1024), "#746550"))
        self.assertEqual(result.size, (512, 512))
        self.assertEqual(result.getpixel((0, 0)), result.getpixel((511, 511)))
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaisesRegex(ValueError, "Chybí zdrojové"):
                assets.import_images(Path(directory), {"assety": [{"id": "missing", "kategorie": "Test"}], "textury": []})

    def test_legacy_metadata(self):
        entries = assets.legacy_assets()
        self.assertEqual(len({e["id"] for e in entries}), len(entries))
        self.assertTrue(all(e["custom"] is False and e["w"] > 0 and e["h"] > 0 for e in entries))
        tree = next(e for e in entries if e["id"] == "gen2-strom")
        self.assertTrue(tree["blocks"])
        self.assertEqual(tree["cover"], 3)

    def test_flat_import_preserves_portrait_and_declared_size(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            image = Image.new("RGB", (40, 80), (185,40,200))
            image.paste("#92764c", (5, 5, 35, 75))
            image.save(root / "ship.png")
            prompts = {"assety":[{"id":"ship","kategorie":"Přístav","w":8,"h":18,"size":256}],"textury":[]}
            with patch.object(assets, "ASSETS", root / "out"):
                assets.import_images(root, prompts)
            with Image.open(root / "out/Přístav/ship.webp") as result:
                self.assertEqual(result.size, (114, 256))
                self.assertEqual(result.getpixel((0,0))[3], 0)
                self.assertGreater(result.getpixel((57,128))[3], 250)

    def test_optional_legacy_images_are_not_generated(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(assets, "ASSETS", Path(directory)), patch.object(assets, "TEXDIR", Path(directory)):
                self.assertEqual(assets.index_assets({"assety": []}), ([], []))
                self.assertEqual(assets.index_textures({"textury": []}), ([], []))

    def test_decal_metadata_survives_index(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);(root/"Obtisky").mkdir()
            Image.new("RGBA",(20,20),(80,90,70,160)).save(root/"Obtisky/d-mech.webp")
            entry={"id":"d-mech","nazev":"Mech","kategorie":"Obtisky","w":2,"h":2,"z":-20,"blocks":False}
            with patch.object(assets,"ASSETS",root):
                indexed,missing=assets.index_assets({"assety":[entry]})
            self.assertEqual(missing,[])
            self.assertEqual(indexed[0]["z"],-20)
            self.assertIs(indexed[0]["blocks"],False)


if __name__ == "__main__":
    unittest.main()
