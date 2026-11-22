import json
import unittest
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
MAPS = ROOT / "11_Mapy"


class ReferenceAssetsTest(unittest.TestCase):
    def test_paths_images_and_replacement_slots(self):
        entries = json.loads((MAPS / "bojove/assets/assety.json").read_text())["assety"]
        assets = {a["id"]: a for a in entries if a["id"].startswith(("p-", "z-", "ov-"))}
        count = 0
        for a in assets.values():
            for src in [a["src"], *a.get("varianty", [])]:
                with self.subTest(src=src), Image.open(MAPS / src) as im:
                    self.assertEqual(im.format, "WEBP")
                    self.assertLessEqual(max(im.size), 512)
                    if not a["id"].startswith("ov-"):
                        self.assertIn("A", im.getbands())
                    count += 1
        self.assertEqual(count, 86)
        for aid, v in [("z-kvetinovy-zahon", 2), ("z-zivy-plot-roh", 3), ("z-strom-koruna", 1)]:
            a = assets[aid]
            self.assertEqual((MAPS / a["src"]).read_bytes(), (MAPS / a["varianty"][v-1]).read_bytes())

    def test_texture_sizes_and_firefly_background(self):
        textures = json.loads((MAPS / "bojove/textury/textury.json").read_text())["textury"]
        for t in textures:
            if t["id"].startswith("t-"):
                with Image.open(MAPS / t["src"]) as im:
                    self.assertEqual(im.size, (512, 512))
        with Image.open(MAPS / "bojove/assets/Efekty/ov-svetlusky.webp") as im:
            self.assertLess(max(im.getpixel((0, 0))), 4)


if __name__ == "__main__":
    unittest.main()
