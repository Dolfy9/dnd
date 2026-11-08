#!/usr/bin/env python3
"""Ilustrovaná mapa Montelienu: malovaný podklad (generátor obrázků, 4 dlaždice podle věrné barevné mapy,
11_Mapy/zdroje/Montelien_ilustrace_podklad.jpg) + sázené popisky z 11_Mapy/mista.json + měřítko z kresby DM.

Použití: python3 tools/mapa_ilustrace.py   → 11_Mapy/Montelien_mapa_ilustrovana.jpg
"""
import json
import cv2
from PIL import Image, ImageDraw
from mapa import MAPY, OUT_SCALE, draw_labels, font

KM_PX = 1.7      # km na px vyrovnané mapy (měřítko 150/300/450/600 km z kresby DM, odečteno přibližně)
BAR = (1665, 1405)  # levý konec měřítka (px vyrovnané mapy)


def main():
    data = json.loads((MAPY / "mista.json").read_text(encoding="utf-8"))
    img = cv2.imread(str(MAPY / "zdroje" / "Montelien_ilustrace_podklad.jpg"))
    s = OUT_SCALE
    im = Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB)).convert("RGBA")
    car = Image.new("RGBA", im.size, (0, 0, 0, 0))
    ImageDraw.Draw(car).rounded_rectangle((1630 * s, 1352 * s, 2032 * s, 1428 * s), 18, fill=(238, 222, 184, 235), outline=(58, 36, 18, 255), width=3)
    im = Image.alpha_composite(im, car)
    draw_labels(im, data)
    d = ImageDraw.Draw(im)
    ink = (58, 36, 18, 255)
    x0, y0 = BAR[0] * s, BAR[1] * s
    step = 150 / KM_PX * s
    d.line((x0, y0, x0 + 4 * step, y0), fill=ink, width=4)
    f = font("Cinzel.ttf", 15)
    for i in range(5):
        x = x0 + i * step
        d.line((x, y0 - 10, x, y0 + 10), fill=ink, width=3)
        if i % 2 == 0 and i < 4:
            d.rectangle((x, y0 - 4, x + step, y0 + 4), fill=ink)
        t = f"{i * 150}" + (" km" if i == 4 else "")
        w = d.textlength(t, font=f)
        d.text((x - w / 2, y0 - 42), t, font=f, fill=ink)
    im.convert("RGB").save(MAPY / "Montelien_mapa_ilustrovana.jpg", quality=88)
    print("Uloženo: 11_Mapy/Montelien_mapa_ilustrovana.jpg")


if __name__ == "__main__":
    main()
