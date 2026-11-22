import json
import unittest

import numpy as np
from PIL import Image

from asset_shadow_profiles import height
from import_gen10 import GROUNDS, MAPS, RAFT, ROOT, seams


class Gen10AssetsTest(unittest.TestCase):
    def test_ground_images_repeat_without_outlier_edge_seams(self):
        textures = {t["id"]: t for t in json.loads((MAPS / "bojove/textury/textury.json").read_text())["textury"]}
        for slug in GROUNDS:
            entry = textures["t-" + slug]
            self.assertEqual(entry["cells"], 4)
            with self.subTest(texture=slug), Image.open(MAPS / entry["src"]) as image:
                self.assertEqual(image.format, "WEBP")
                self.assertEqual(image.size, (512, 512))
                for result in seams(image).values():
                    self.assertLess(result["edge"], result["interior_p95"] * 1.5)

    def test_raft_variants_have_clean_alpha_and_matching_shadow_hulls(self):
        manifest = json.loads((MAPS / "bojove/assets/assety.json").read_text())
        asset = next(a for a in manifest["assety"] if a["id"] == RAFT)
        profiles = json.loads((MAPS / "bojove/assets/stiny.json").read_text())[RAFT]
        self.assertEqual((asset["w"], asset["h"]), (3, 3))
        self.assertEqual(asset["vyska"], height(asset))
        self.assertGreater(asset["vyska"], 0)
        self.assertEqual(len(asset["varianty"]), 2)
        self.assertEqual(len(profiles["hulls"]), 3)
        sources = [asset["src"], *asset["varianty"]]
        self.assertEqual(len({(MAPS / src).read_bytes() for src in sources}), 3)
        for i, src in enumerate(sources):
            with self.subTest(src=src), Image.open(MAPS / src) as image:
                self.assertEqual(image.mode, "RGBA")
                self.assertEqual(image.size, (512, 512))
                a = np.asarray(image, dtype=int)
                visible = a[:, :, 3] > 32
                self.assertGreater(visible.mean(), .65)
                self.assertLess(visible.mean(), .85)
                self.assertEqual(a[0, 0, 3], 0)
                self.assertFalse(((np.minimum(a[:, :, 0], a[:, :, 2]) - a[:, :, 1] > 30) & visible).any())
                self.assertEqual(profiles["ratios"][i], 1)
                self.assertGreaterEqual(len(profiles["hulls"][i]), 3)
                self.assertLessEqual(len(profiles["hulls"][i]), 20)
                self.assertTrue(all(0 <= n <= 1 for point in profiles["hulls"][i] for n in point))
        qc = json.loads((ROOT / "tools/gen10_asset_qc.json").read_text())
        self.assertTrue(all(v["magenta_pixels"] == 0 for v in qc["sprites"].values()))


if __name__ == "__main__":
    unittest.main()
