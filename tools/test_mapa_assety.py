import importlib.util
import json
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

    def test_variant_import_skips_missing_sparse_empty_and_corrupt_images(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "source"
            source.mkdir()
            Image.new("RGBA",(20,20),(80,90,70,255)).save(source/"tree-v1.webp",lossless=True)
            sparse = Image.new("RGBA",(20,20),(0,0,0,0))
            sparse.putpixel((0,0),(80,90,70,255))
            sparse.putpixel((19,19),(80,90,70,255))
            sparse.save(source/"tree-v2.webp",lossless=True)
            Image.new("RGBA",(20,20),(0,0,0,0)).save(source/"tree-v3.webp",lossless=True)
            (source/"tree-v4.webp").write_bytes(b"invalid")
            entry = {"id":"tree","src":"bojove/assets/Les/tree.webp","w":2,"blocks":True,"anim":"vitr","custom":True}
            metadata = dict(entry)
            with patch.object(assets,"ASSETS",root/"out"):
                assets.index_variants([entry],source)
                self.assertEqual(entry["varianty"],["bojove/assets/Les/varianty/tree-v1.webp"])
                self.assertEqual((root/"out/Les/varianty/tree-v1.webp").read_bytes(),(source/"tree-v1.webp").read_bytes())
                self.assertEqual({k:v for k,v in entry.items() if k != "varianty"},metadata)
                assets.index_variants([entry])
                self.assertEqual(len(entry["varianty"]),1)
                missing = {"id":"missing","src":"bojove/assets/Les/missing.webp"}
                assets.index_variants([missing],source)
                self.assertNotIn("varianty",missing)
                external = {"id":"custom","src":"https://example.com/asset.webp","custom":True}
                before = dict(external)
                assets.index_variants([external],source)
                self.assertEqual(external,before)
                with self.assertRaisesRegex(ValueError,"Chybí adresář"):
                    assets.index_variants([entry],root/"absent")

    def test_variant_coverage_uses_cropped_alpha_and_three_percent_threshold(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)/"variant.webp"
            for opacity,expected in [(7,False),(8,True),(255,True)]:
                image = Image.new("RGBA",(100,100),(0,0,0,0))
                image.paste((20,50,70,opacity),(40,40,60,60))
                image.save(path,lossless=True)
                self.assertEqual(assets.variant_visible(path),expected)

    def test_variant_command_preserves_manifest_metadata_and_custom_assets(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root/"source"
            source.mkdir()
            Image.new("RGBA",(20,20),(80,90,70,255)).save(source/"tree-v1.webp",lossless=True)
            manifest = root/"assety.json"
            original = {"extra":"keep","assety":[
                {"id":"tree","src":"bojove/assets/Les/tree.webp","w":2,"blocks":True,"custom":False,"tags":["story"]},
                {"id":"custom","src":"bojove/assets/Vlastni/custom.webp","custom":True,"light":{"bright":10,"dim":20}},
            ]}
            manifest.write_text(json.dumps(original))
            with patch.object(assets,"ASSETS",root/"out"), patch.object(assets,"MANIFEST_A",manifest), patch("sys.argv",["mapa_assety.py","--varianty",str(source)]):
                self.assertEqual(assets.main(),0)
            imported = json.loads(manifest.read_text())
            self.assertEqual(imported["assety"][0].pop("varianty"),["bojove/assets/Les/varianty/tree-v1.webp"])
            self.assertEqual(imported,original)


if __name__ == "__main__":
    unittest.main()
