import unittest

import numpy as np
from PIL import Image

from garden_lawn_grade import ID, TEXTURES, night_lawn
from import_gen10 import seams


class NightLawnTest(unittest.TestCase):
    def test_grade_darkens_and_desaturates_without_changing_size(self):
        source = Image.new("RGB", (2, 1), (50, 150, 30))
        result = night_lawn(source)
        self.assertEqual(result.size, source.size)
        rgb = result.getpixel((0, 0))
        self.assertLess(max(rgb)-min(rgb), 120*.5)
        self.assertLess(np.mean(rgb), np.mean(source.getpixel((0, 0))))
        self.assertEqual(night_lawn(Image.new("RGB", (1, 1))).getpixel((0, 0)), (0, 0, 0))

    def test_saved_grade_matches_source_and_remains_seamless(self):
        with Image.open(TEXTURES / "t-zahrada-trava-kvety.webp") as source, Image.open(TEXTURES / (ID+".webp")) as result:
            self.assertTrue(np.array_equal(np.asarray(result), np.asarray(night_lawn(source))))
            for edge in seams(result).values():
                self.assertLess(edge["edge"], edge["interior_p95"]*1.5)


if __name__ == "__main__":
    unittest.main()
