import json
import subprocess
import sys
import tempfile
import unittest

import numpy as np
from PIL import Image

from import_gen11 import ASSETS, MAPS, ROOT, despill, sprite_profile, variants


class Gen11AssetsTest(unittest.TestCase):
    def test_imported_sprites_have_clean_edges_variants_and_profiles(self):
        assets = {a["id"]:a for a in json.loads((MAPS/"bojove/assets/assety.json").read_text())["assety"]}
        profiles = json.loads((MAPS/"bojove/assets/stiny.json").read_text())
        for slug, (_,w,h,height) in ASSETS.items():
            asset = assets[slug]
            self.assertEqual((asset["w"],asset["h"],asset["vyska"]),(w,h,height))
            sources = [asset["src"],*asset["varianty"]]
            self.assertEqual(len(sources),3)
            self.assertEqual(len({(MAPS/src).read_bytes() for src in sources}),3)
            for i,src in enumerate(sources):
                with self.subTest(src=src), Image.open(MAPS/src) as image:
                    self.assertEqual(image.mode,"RGBA")
                    self.assertEqual(image.format,"WEBP")
                    self.assertLessEqual(max(image.size),512)
                    rgba=np.asarray(image,dtype=int)
                    visible=rgba[:,:,3]>32
                    self.assertTrue(.25 < visible.mean() < .9)
                    self.assertEqual(rgba[0,0,3],0)
                    self.assertFalse(((np.minimum(rgba[:,:,0],rgba[:,:,2])-rgba[:,:,1]>30)&(rgba[:,:,3]>0)).any())
                    outline,ratio=sprite_profile(image)
                    self.assertEqual(profiles[slug]["hulls"][i],outline)
                    self.assertEqual(profiles[slug]["ratios"][i],ratio)
                    self.assertGreaterEqual(len(outline),3)

    def test_despill_and_variants_preserve_alpha_including_empty_sprite(self):
        for image in (Image.new("RGBA",(8,8)),Image.new("RGBA",(8,8),(200,40,210,90))):
            for variant in variants(image):
                self.assertTrue(np.array_equal(np.asarray(despill(variant))[:,:,3],np.asarray(image)[:,:,3]))
        self.assertEqual(despill(Image.new("RGBA",(1,1),(255,0,255,0))).getpixel((0,0)),(0,0,0,0))

    def test_missing_sources_fail_before_any_import(self):
        with tempfile.TemporaryDirectory() as source:
            result=subprocess.run([sys.executable,str(ROOT/"tools/import_gen11.py"),source],capture_output=True,text=True)
        self.assertNotEqual(result.returncode,0)
        self.assertIn("Chybí zdrojové obrázky",result.stderr)


if __name__ == "__main__":
    unittest.main()
