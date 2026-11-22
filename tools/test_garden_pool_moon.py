import json
import unittest

import numpy as np
from PIL import Image

from garden_pool_moon import ASSETS, MAPS, moon_grade


class MoonPoolTest(unittest.TestCase):
    def test_grade_preserves_neutral_stone_and_alpha_and_cools_green(self):
        image = Image.new("RGBA", (2, 1))
        image.putdata([(130, 130, 130, 255), (60, 100, 30, 90)])
        result = moon_grade(image)
        self.assertEqual(result.getpixel((0, 0)), (130, 130, 130, 255))
        r, g, b, a = result.getpixel((1, 0))
        self.assertLess(r, g)
        self.assertLess(g, b)
        self.assertEqual(a, 90)

    def test_saved_variant_preserves_silhouette_and_profile(self):
        manifest = json.loads((ASSETS / "assety.json").read_text())
        asset = next(a for a in manifest["assety"] if a["id"] == "z-jezirko-fontana")
        with Image.open(MAPS / asset["src"]) as original, Image.open(MAPS / asset["varianty"][0]) as variant:
            self.assertEqual(original.size, variant.size)
            self.assertTrue(np.array_equal(np.asarray(original.convert("RGBA"))[:, :, 3], np.asarray(variant)[:, :, 3]))
        profile = json.loads((ASSETS / "stiny.json").read_text())[asset["id"]]
        self.assertEqual(profile["hulls"][0], profile["hulls"][1])
        self.assertEqual(profile["ratios"][0], profile["ratios"][1])
