#!/usr/bin/env python3
"""Připraví textury a průhledné rekvizity pro bojové mapy (Pillow).

Použití: python3 tools/boj_assety.py [vstupní_složka] [--sheet cesta.png]
Výchozí vstup je ~/gen; tex_*.png a prop_*.png se převedou do web/assets/boj.
Textury mají plynulé návaznosti, rekvizity odstraněné purpurové pozadí.
Volitelný přehled ukazuje textury 2×2 a rekvizity na šedém i tmavém pozadí.
"""
import argparse
import math
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "web/assets/boj"


def texture(image):
    image = image.convert("RGB").resize((512, 512), Image.Resampling.LANCZOS)
    for axis in (0, 1):
        weights = []
        for i in range(512):
            distance = min(i, 511 - i) / 112
            weights.append(round(255 * (1 + math.cos(math.pi * min(1, distance))) / 2))
        strip = Image.new("L", (512, 1))
        strip.putdata(weights)
        mask = strip.resize((512, 512)) if axis == 0 else strip.transpose(Image.Transpose.ROTATE_90).resize((512, 512))
        shifted = ImageChops.offset(image, 256 if axis == 0 else 0, 256 if axis == 1 else 0)
        image = Image.composite(shifted, image, mask)
    return image


def prop(image):
    image = image.convert("RGBA")
    pixels = []
    source = image.load()
    for r, g, b, a in (source[x, y] for y in range(image.height) for x in range(image.width)):
        spill = max(0, min(r, b) - g)
        opacity = 1 - spill / 255
        if opacity <= .025 or not a:
            pixels.append((0, 0, 0, 0))
        else:
            clean = tuple(round(max(0, min(255, c))) for c in (
                (r - spill) / opacity, g / opacity, (b - spill) / opacity))
            pixels.append((*clean, round(a * opacity)))
    image.putdata(pixels)
    bbox = image.getbbox()
    if bbox is None:
        return Image.new("RGBA", (256, 256))
    image = image.crop(bbox)
    side = max(image.size)
    padding = max(1, round(side * .04))
    square = Image.new("RGBA", (side + padding * 2, side + padding * 2))
    square.paste(image, ((square.width - image.width) // 2, (square.height - image.height) // 2))
    return square.resize((256, 256), Image.Resampling.LANCZOS)


def contact_sheet(paths, destination):
    columns, width, height = 5, 272, 292
    sheet = Image.new("RGB", (columns * width, math.ceil(len(paths) / columns) * height), "#eee8da")
    draw = ImageDraw.Draw(sheet)
    for i, path in enumerate(paths):
        x, y = (i % columns) * width + 8, (i // columns) * height + 8
        draw.text((x, y), path.parent.name + "/" + path.stem, fill="#222222")
        with Image.open(path) as image:
            if path.parent.name == "tex":
                tile = image.convert("RGB").resize((128, 128), Image.Resampling.LANCZOS)
                for dx, dy in ((0, 0), (128, 0), (0, 128), (128, 128)):
                    sheet.paste(tile, (x + dx, y + 20 + dy))
            else:
                sprite = image.convert("RGBA").resize((128, 128), Image.Resampling.LANCZOS)
                for dx, color in ((0, "#888888"), (128, "#181818")):
                    panel = Image.new("RGBA", (128, 256), color)
                    panel.alpha_composite(sprite, (0, 64))
                    sheet.paste(panel.convert("RGB"), (x + dx, y + 20))
    destination.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(destination)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", nargs="?", type=Path, default=Path.home() / "gen")
    parser.add_argument("--sheet", type=Path)
    args = parser.parse_args()
    source = args.input.expanduser()
    inputs = sorted(source.glob("tex_*.png")) + sorted(source.glob("prop_*.png"))
    if not inputs:
        parser.error(f"Žádné tex_*.png ani prop_*.png v {source}")
    paths = []
    for path in inputs:
        kind, key = path.stem.split("_", 1)
        target = OUT / ("tex" if kind == "tex" else "prop") / (key + ".webp")
        target.parent.mkdir(parents=True, exist_ok=True)
        with Image.open(path) as image:
            result = texture(image) if kind == "tex" else prop(image)
        result.save(target, "WEBP", quality=82, method=6, exact=True)
        paths.append(target)
    if args.sheet:
        contact_sheet(paths, args.sheet.expanduser())
    print(f"Hotovo: {len(paths)} assetů, {sum(p.stat().st_size for p in paths):,} bajtů.")


if __name__ == "__main__":
    main()
