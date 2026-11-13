#!/usr/bin/env python3
"""Návrh heraldiky pro státy bez schválených znaků (Banerbo, Imatoma).

Generuje plošnou heraldickou grafiku (štít + vlajka) do 02_Zeme/obrazky/
podle blasonů vymyšlených z loru. Jde o NÁVRH – DM může přes GUI
v /heraldika obrázky kdykoli nahradit vlastními.

Barvy drží linii ostatních znaků: znak 640x723 RGBA (průhledné pozadí,
tvar štítu), vlajka 900x600.
"""
import math
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "02_Zeme" / "obrazky"

# heraldické tinktury
AZURE = (32, 72, 138)        # modrá
AZURE_D = (22, 52, 104)
VERT = (24, 94, 78)          # mořská zeleň
VERT_D = (16, 66, 56)
GOLD = (212, 168, 74)        # zlatá
ARGENT = (230, 228, 220)     # stříbrná
ARGENT_D = (196, 194, 184)
INK = (40, 32, 24)

SS = 2  # supersampling


def shield_mask(w=640, h=723):
    """Heater shield: rovný vrch s mírným zaoblením, bezier spodek do špičky."""
    m = Image.new("L", (w * SS, h * SS), 0)
    d = ImageDraw.Draw(m)
    w, h = w * SS, h * SS
    x0, x1, y0 = w * 0.05, w * 0.95, h * 0.06
    ytop, ysplit, ybot = y0, h * 0.38, h * 0.97
    # horní část: obdélník se zaoblenými horními rohy
    d.rounded_rectangle([x0, ytop, x1, ysplit + h * 0.1], radius=h * 0.05, fill=255)
    # spodek: kvadratické bezier křivky z obou stran do špičky
    def bez(p0, p1, p2, n=64):
        return [((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0],
                 (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1])
                for t in (i / n for i in range(n + 1))]
    tip = (w * 0.5, ybot)
    left = bez((x0, ysplit), (x0, h * 0.8), tip)
    right = bez((x1, ysplit), (x1, h * 0.8), tip)
    d.polygon(left + list(reversed(right)), fill=255)
    return m


def waves(d, x0, y0, x1, y1, n, color, thick, phase=0.0):
    """Vlnky jako posloupnost oblouků."""
    span = (x1 - x0) / n
    pts_top, pts_bot = [], []
    for i in range(n * 8 + 1):
        x = x0 + span * i / 8
        y = y0 + math.sin((x - x0) / span * math.pi * 2 + phase) * (y1 - y0) * 0.45
        pts_top.append((x, y))
    d.line(pts_top, fill=color, width=thick, joint="curve")


def wave_band(d, x0, y0, x1, y1, rows, color):
    """Pás vln – tři řady obloukových vln."""
    for r in range(rows):
        y = y0 + (y1 - y0) * r / max(rows - 1, 1)
        waves(d, x0, y, x1, y, 6, color, int(10 * SS), phase=r * 1.1)


def ship(d, cx, cy, s, hull=GOLD, sail=ARGENT):
    """Jednoduchá plachetnice: trup, stěžeň, dvě plachty."""
    # trup
    d.polygon([(cx - s * 0.55, cy), (cx + s * 0.55, cy),
               (cx + s * 0.42, cy + s * 0.22), (cx - s * 0.42, cy + s * 0.22)],
              fill=hull)
    d.polygon([(cx - s * 0.42, cy + s * 0.22), (cx + s * 0.42, cy + s * 0.22),
               (cx + s * 0.30, cy + s * 0.30), (cx - s * 0.30, cy + s * 0.30)],
              fill=hull)
    # stěžně
    d.line([(cx - s * 0.16, cy - s * 0.78), (cx - s * 0.16, cy)], fill=hull, width=int(s * 0.045))
    d.line([(cx + s * 0.22, cy - s * 0.62), (cx + s * 0.22, cy)], fill=hull, width=int(s * 0.04))
    # přední plachta (trojúhelník)
    d.polygon([(cx - s * 0.13, cy - s * 0.74), (cx - s * 0.13, cy - s * 0.08),
               (cx - s * 0.52, cy - s * 0.10)], fill=sail)
    # hlavní plachta (oblý čtverec – látinská ra)
    d.polygon([(cx - s * 0.19, cy - s * 0.74), (cx + s * 0.18, cy - s * 0.52),
               (cx - s * 0.19, cy - s * 0.10)], fill=sail)
    # zadní plachta
    d.polygon([(cx + s * 0.25, cy - s * 0.58), (cx + s * 0.25, cy - s * 0.12),
               (cx + s * 0.50, cy - s * 0.14)], fill=sail)
    # vlaječka na stěžni
    d.polygon([(cx - s * 0.16, cy - s * 0.78), (cx - s * 0.16, cy - s * 0.68),
               (cx + s * 0.02, cy - s * 0.70)], fill=hull)


def fish(d, cx, cy, s, color=ARGENT, facing=1):
    """Heraldická ryba bokem."""
    d.ellipse([cx - s, cy - s * 0.38, cx + s, cy + s * 0.38], fill=color)
    # ocas
    d.polygon([(cx - s * 0.9 * facing, cy),
               (cx - s * 1.45 * facing, cy - s * 0.45),
               (cx - s * 1.45 * facing, cy + s * 0.45)], fill=color)
    # oko
    d.ellipse([cx + s * 0.55 * facing - s * 0.07, cy - s * 0.12,
               cx + s * 0.55 * facing + s * 0.07, cy + s * 0.02], fill=INK)
    # ploutev
    d.polygon([(cx - s * 0.1, cy + s * 0.3), (cx + s * 0.25, cy + s * 0.62),
               (cx + s * 0.45, cy + s * 0.3)], fill=color)


def net(d, x0, y0, x1, y1, step, color, thick):
    """Diagonální rybářská síť."""
    for off in range(int(-(y1 - y0)), int(x1 - x0) + step, step):
        d.line([(x0 + off, y0), (x0 + off + (y1 - y0), y1)], fill=color, width=thick)
        d.line([(x0 + off + (y1 - y0), y0), (x0 + off, y1)], fill=color, width=thick)


def star(d, cx, cy, r, color, points=4):
    pts = []
    for i in range(points * 2):
        rr = r if i % 2 == 0 else r * 0.28
        a = -math.pi / 2 + i * math.pi / points
        pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    d.polygon(pts, fill=color)


def make_shield(paint):
    w, h = 640 * SS, 723 * SS
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    mask = shield_mask()
    paint(d, w, h)
    # kontura štítu
    edge = mask.filter(__import__("PIL.ImageFilter", fromlist=["MaxFilter"]).MaxFilter(9))
    edge_img = Image.new("RGBA", (w, h), INK + (255,))
    img = Image.composite(img, Image.new("RGBA", (w, h), (0, 0, 0, 0)), mask)
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    out.paste(edge_img, (0, 0), edge)
    out.alpha_composite(img)
    return out.resize((640, 723), Image.LANCZOS)


def make_flag(paint):
    w, h = 900 * SS, 600 * SS
    img = Image.new("RGB", (w, h))
    d = ImageDraw.Draw(img)
    paint(d, w, h)
    return img.resize((900, 600), Image.LANCZOS)


def banerbo_shield(d, w, h):
    d.rectangle([0, 0, w, h], fill=AZURE)
    d.rectangle([0, 0, w, int(h * 0.5)], fill=AZURE_D)
    # hvězda navigace
    star(d, w * 0.5, h * 0.2, w * 0.09, GOLD)
    # loď
    ship(d, w * 0.5, h * 0.52, w * 0.34)
    # vlny
    wave_band(d, w * 0.06, h * 0.72, w * 0.94, h * 0.74, 3, ARGENT)


def banerbo_flag(d, w, h):
    d.rectangle([0, 0, w, h], fill=AZURE)
    d.rectangle([0, int(h * 0.72), w, h], fill=AZURE_D)
    wave_band(d, 0, int(h * 0.78), w, int(h * 0.80), 2, ARGENT)
    ship(d, w * 0.5, h * 0.40, w * 0.26)
    star(d, w * 0.16, h * 0.2, w * 0.05, GOLD)
    star(d, w * 0.84, h * 0.2, w * 0.05, GOLD)


def imatoma_shield(d, w, h):
    d.rectangle([0, 0, w, h], fill=VERT)
    # síť přes celý štít
    m = shield_mask()
    net(d, 0, 0, w, int(h * 0.62), int(w * 0.085), ARGENT_D, int(7 * SS))
    # velká stříbrná ryba (lovci ryb)
    fish(d, w * 0.5, int(h * 0.38), w * 0.21, ARGENT, facing=1)
    # trojzubec pod rybou? zůstane čisté – dole vlny (oceán, dno)
    wave_band(d, w * 0.06, h * 0.72, w * 0.94, h * 0.74, 3, ARGENT)


def imatoma_flag(d, w, h):
    d.rectangle([0, 0, w, h], fill=VERT)
    d.rectangle([0, int(h * 0.74), w, h], fill=VERT_D)
    # síť v horní části
    net(d, 0, 0, w, int(h * 0.72), int(w * 0.075), ARGENT_D, int(6 * SS))
    fish(d, w * 0.5, h * 0.36, w * 0.16, ARGENT)
    wave_band(d, 0, int(h * 0.80), w, int(h * 0.82), 2, ARGENT)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    jobs = [
        ("Znak_banerbo.webp", make_shield(banerbo_shield)),
        ("Vlajka_banerbo.webp", make_flag(banerbo_flag)),
        ("Znak_imatoma.webp", make_shield(imatoma_shield)),
        ("Vlajka_imatoma.webp", make_flag(imatoma_flag)),
    ]
    for name, img in jobs:
        img.save(OUT / name, "WEBP", quality=88)
        print("ok", name)


if __name__ == "__main__":
    main()
