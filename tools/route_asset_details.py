"""Derive route details from the existing generated wood and hedge artwork."""
import colorsys
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1] / "11_Mapy/bojove"


def main():
    target = ROOT / "assets/Trasy"
    target.mkdir(exist_ok=True)
    wood = Image.open(ROOT / "textury/drevo.webp").convert("RGB")
    for i, box in enumerate(((155, 10, 500, 40), (10, 55, 330, 80),
                             (10, 140, 320, 165), (150, 275, 490, 295))):
        wood.crop(box).resize((512, 40), Image.Resampling.LANCZOS).save(
            target / f"prkno-{i}.webp", quality=90)
    for i in range(4):
        source = (ROOT / "assets/Zahrada/z-zivy-plot.webp" if i == 0 else
                  ROOT / f"assets/Zahrada/varianty/z-zivy-plot-v{i}.webp")
        hedge = Image.open(source).convert("RGBA")
        pixels = []
        for index in range(hedge.width * hedge.height):
            r, g, b, a = hedge.getpixel((index % hedge.width, index // hedge.width))
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            if (h < .12 or h > .88) and s > .3 or s < .25 and v > .58:
                h, s, v = .27, .58, v * .7
            tone = 1.04 - .3 * (index // hedge.width) / hedge.height
            rgb = colorsys.hsv_to_rgb(h, s, min(1, v * tone))
            pixels.append((*[round(c * 255) for c in rgb], a))
        hedge.putdata(pixels)
        hedge.save(target / f"listovi-{i}.webp", quality=90)


if __name__ == "__main__":
    main()
