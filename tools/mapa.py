#!/usr/bin/env python3
"""Vyrenderuje popsanou fantasy mapu z podkladu a 11_Mapy/mista.json.

Použití: python3 tools/mapa.py [--debug]   (vyžaduje Pillow)
--debug přidá body všech míst (kontrola souřadnic).
"""
import json, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
MAPY = ROOT / "11_Mapy"
FONTS = Path(__file__).resolve().parent / "fonts"
SCALE = 2
INK = (58, 36, 18, 255)
HALO = (246, 233, 200, 255)


def font(name, size):
    return ImageFont.truetype(str(FONTS / name), size * SCALE)


def text_layer(text, fnt, spacing=0.18):
    letters = list(text.upper())
    gap = int(fnt.size * spacing)
    widths = [fnt.getbbox(c)[2] for c in letters]
    w = sum(widths) + gap * (len(letters) - 1) + 40
    h = int(fnt.size * 1.6) + 40
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    x = 20
    for c, cw in zip(letters, widths):
        d.text((x, 20), c, font=fnt, fill=INK, stroke_width=max(2, fnt.size // 9), stroke_fill=HALO)
        x += cw + gap
    return layer


def paste_center(img, layer, x, y, rot):
    if rot:
        layer = layer.rotate(rot, expand=True, resample=Image.BICUBIC)
    img.alpha_composite(layer, (int(x - layer.width / 2), int(y - layer.height / 2)))


def main(debug=False):
    data = json.loads((MAPY / "mista.json").read_text(encoding="utf-8"))
    base = Image.open(MAPY / "Montelien_mapa_fantasy_podklad.jpg").convert("RGBA")
    img = base.resize((base.width * SCALE, base.height * SCALE), Image.LANCZOS)
    region = font("Cinzel.ttf", 27)
    place = font("IMFePIit28P.ttf", 25)
    for m in data["mista"]:
        x, y = m["x"] * SCALE, m["y"] * SCALE
        if m.get("popisek"):
            parts = m["nazev"].split(" ")
            fnt = region if m["typ"] == "zeme" else place
            if len(parts) == 2 and m.get("rot", 0) == 0:
                paste_center(img, text_layer(parts[0], fnt), x, y - fnt.size * 0.55, 0)
                paste_center(img, text_layer(parts[1], font("Cinzel.ttf", 18), 0.3), x, y + fnt.size * 0.6, 0)
            else:
                paste_center(img, text_layer(m["nazev"], fnt, 0.35 if m["typ"] != "zeme" else 0.18), x, y, m.get("rot", 0))
        if debug:
            d = ImageDraw.Draw(img)
            d.ellipse((x - 8, y - 8, x + 8, y + 8), fill=(200, 0, 0, 255))
            d.text((x + 10, y - 10), m["nazev"], fill=(200, 0, 0, 255), font=font("IMFePIrm28P.ttf", 9))

    title = text_layer("Montelien", font("Cinzel.ttf", 40), 0.12)
    paste_center(img, title, 1310 * SCALE, 978 * SCALE, 0)
    # měřítko: 600 km ≈ 238 px podkladu (přepočet z měřítka na DM mapě)
    d = ImageDraw.Draw(img)
    x0, y0, seg = 1190 * SCALE, 925 * SCALE, int(238 / 4 * SCALE)
    for i in range(4):
        d.rectangle((x0 + i * seg, y0, x0 + (i + 1) * seg, y0 + 6 * SCALE),
                    fill=INK if i % 2 == 0 else HALO, outline=INK, width=2)
    small = font("IMFePIrm28P.ttf", 11)
    for i in range(5):
        lbl = f"{i * 150}" + (" km" if i == 4 else "")
        d.text((x0 + i * seg, y0 + 9 * SCALE), lbl, font=small, fill=INK, anchor="ma",
               stroke_width=3, stroke_fill=HALO)

    out = MAPY / ("Montelien_mapa_fantasy_debug.jpg" if debug else "Montelien_mapa_fantasy.jpg")
    img.convert("RGB").save(out, quality=88)
    print("Uloženo:", out.relative_to(ROOT))


if __name__ == "__main__":
    main("--debug" in sys.argv)
