#!/usr/bin/env python3
"""Věrná barevná mapa Montelienu přímo z fotky DM kresby.

Kroky: vyrovnání perspektivy → odstranění stínů → maska pevnina/moře →
pergamen + moře + tvoje čáry jako inkoust → ruční nápisy nahrazeny sázeným
textem (11_Mapy/mista.json, pole popisek). Tvary se NEPŘEKRESLUJÍ.

Použití: python3 tools/mapa.py [--debug]     (Pillow, opencv-python-headless, numpy)
Výstupy: 11_Mapy/Montelien_mapa_vyrovnana.jpg (čb. kresba), 11_Mapy/Montelien_mapa.jpg
"""
import json, sys
from pathlib import Path
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
MAPY = ROOT / "11_Mapy"
FONTS = Path(__file__).resolve().parent / "fonts"
W, H = 2048, 1440
OUT_SCALE = 1.5
# rohy papíru na fotce (TL, TR, BR, BL)
QUAD = [[0, 0], [2040, 108], [2030, 1500], [0, 1495]]
# body v otevřeném moři / vodních plochách pro vyplnění moře
SEA_SEEDS = [(30, 700), (30, 1100), (20, 300), (600, 40), (1000, 40), (1500, 60), (2000, 150), (2010, 700),
             (2000, 1200), (1700, 1430), (1100, 1430), (700, 1425), (250, 1250), (150, 1100), (1750, 900),
             (1950, 1300), (1300, 1350), (800, 350), (1600, 300), (950, 1100), (755, 520)]
LAKE_SEEDS = [(1200, 700), (1250, 790), (985, 760), (1380, 935), (1300, 945)]
# slabě nakreslené ostrovy: (x0, y0, x1, y1) – obrys se dohledá s nižším prahem
FAINT_LAND = [(120, 500, 250, 660), (30, 1265, 400, 1435)]
INK = (58, 36, 18)
HALO = (243, 230, 196)


def rectify():
    src = cv2.imread(str(MAPY / "Montelien_mapa_foto.jpg"))
    M = cv2.getPerspectiveTransform(np.float32(QUAD), np.float32([[0, 0], [W, 0], [W, H], [0, H]]))
    rect = cv2.warpPerspective(src, M, (W, H), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
    g = cv2.cvtColor(rect, cv2.COLOR_BGR2GRAY).astype(np.float32)
    bg = cv2.morphologyEx(g, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (25, 25)))
    bg = cv2.GaussianBlur(bg, (0, 0), 9)
    n = np.clip(g / (bg + 1e-3), 0, 1.2)
    n = np.clip((n - 0.55) / (0.97 - 0.55), 0, 1)
    return (n * 255).astype(np.uint8)


def flood(walls, seeds):
    ff = walls.copy()
    mask = np.zeros((H + 2, W + 2), np.uint8)
    for s in seeds:
        if ff[s[1], s[0]] == 0:
            cv2.floodFill(ff, mask, s, 128)
    return ff == 128


def box_mask(data, grow=0):
    m = np.zeros((H, W), np.uint8)
    for it in data["mista"]:
        p = it.get("popisek")
        if p and p.get("box"):
            cv2.fillPoly(m, [rbox(it["x"], it["y"], p["box"][0] + grow, p["box"][1] + grow, p.get("rot", 0))], 1)
    return m.astype(bool)


def water_mask(clean, data):
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
    walls = cv2.dilate(((clean < 110) * 255).astype(np.uint8), k)
    water = flood(walls, SEA_SEEDS) | flood(walls, LAKE_SEEDS)
    for x0, y0, x1, y1 in FAINT_LAND:
        sub = clean[y0:y1, x0:x1]
        wl = cv2.dilate(((sub < 185) * 255).astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))
        ff = wl.copy()
        m = np.zeros((ff.shape[0] + 2, ff.shape[1] + 2), np.uint8)
        for (px, py) in [(0, 0), (ff.shape[1] - 1, 0), (0, ff.shape[0] - 1), (ff.shape[1] - 1, ff.shape[0] - 1)]:
            if ff[py, px] == 0:
                cv2.floodFill(ff, m, (px, py), 128)
        inside = ff != 128
        water[y0:y1, x0:x1] &= ~inside
    # ruční písmena v moři nesmí tvořit pevninu
    bm = box_mask(data, 18)
    land = (~water & bm).astype(np.uint8)
    opened = cv2.morphologyEx(land, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (23, 23)))
    near = cv2.dilate(water.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (25, 25))) > 0
    water |= (land > 0) & (opened == 0) & near
    water[:40, :] = True
    water[:, -22:] = True
    water = cv2.morphologyEx(water.astype(np.uint8), cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))
    # zaplnit drobné ostrůvky šumu v moři
    n, lab, st, _ = cv2.connectedComponentsWithStats(1 - water, 8)
    for i in range(1, n):
        if st[i, cv2.CC_STAT_AREA] < 120:
            water[lab == i] = 1
    return water.astype(bool)


def rbox(cx, cy, length, height, rot):
    return cv2.boxPoints(((cx, cy), (length, height), -rot)).astype(np.int32)


def render(clean, water, data, debug=False):
    rng = np.random.default_rng(7)

    def noise(s):
        n = rng.random((H // s + 2, W // s + 2)).astype(np.float32)
        return cv2.resize(n, (W, H), interpolation=cv2.INTER_CUBIC)[:H, :W]
    tex = 0.5 * noise(180) + 0.3 * noise(50) + 0.2 * noise(10)
    tex = (tex - tex.mean()) / tex.std()
    land_c = np.array([236, 218, 176], np.float32)
    sea_c = np.array([166, 196, 196], np.float32)
    col = np.where(water[..., None], sea_c, land_c) * (1 + 0.04 * tex[..., None])
    # pobřežní linky a stín u pobřeží
    dist = cv2.distanceTransform(water.astype(np.uint8), cv2.DIST_L2, 5)
    shade = np.exp(-dist / 10.0) * water
    col = col * (1 - 0.18 * shade[..., None])
    for d, a in [(9, 0.35), (18, 0.22), (30, 0.12)]:
        ring = (np.abs(dist - d) < 0.9) & water
        col[ring] = col[ring] * (1 - a) + np.array([70, 100, 110]) * a
    yy, xx = np.mgrid[0:H, 0:W]
    vig = np.clip(((xx / W - .5) ** 2 + (yy / H - .5) ** 2) ** .5 - .3, 0, 1)
    col = col * (1 - 0.5 * vig[..., None])
    ink = np.clip((0.86 - clean / 255.0) / 0.55, 0, 1)
    ink[:40, :] = 0  # okraj fotky
    ink[:, -22:] = 0
    bm = cv2.GaussianBlur(box_mask(data).astype(np.float32), (0, 0), 3)
    ink = ink * (1 - bm) + np.minimum(ink, 0.1) * bm
    a = (ink * 0.92)[..., None]
    col = col * (1 - a) + np.array(INK, np.float32) * a
    img = Image.fromarray(np.clip(col, 0, 255).astype(np.uint8))
    img = img.resize((int(W * OUT_SCALE), int(H * OUT_SCALE)), Image.LANCZOS).convert("RGBA")
    draw_labels(img, data)
    if debug:
        d = ImageDraw.Draw(img)
        for m in data["mista"]:
            x, y = m["x"] * OUT_SCALE, m["y"] * OUT_SCALE
            d.ellipse((x - 6, y - 6, x + 6, y + 6), fill=(200, 0, 0, 255))
            p = m.get("popisek")
            if p and p.get("box"):
                pts = rbox(m["x"], m["y"], p["box"][0], p["box"][1], p.get("rot", 0)) * OUT_SCALE
                d.polygon([tuple(pt) for pt in pts], outline=(255, 0, 0, 255))
    return img


def font(name, size):
    return ImageFont.truetype(str(FONTS / name), int(size * OUT_SCALE))


def text_layer(text, fnt, spacing):
    letters = list(text.upper())
    gap = int(fnt.size * spacing)
    widths = [fnt.getbbox(c)[2] for c in letters]
    w = sum(widths) + gap * (len(letters) - 1) + 40
    layer = Image.new("RGBA", (w, int(fnt.size * 1.6) + 40), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    x = 20
    for c, cw in zip(letters, widths):
        d.text((x, 20), c, font=fnt, fill=INK + (255,), stroke_width=max(2, fnt.size // 8), stroke_fill=HALO + (255,))
        x += cw + gap
    return layer


def paste(img, layer, x, y, rot):
    if rot:
        layer = layer.rotate(rot, expand=True, resample=Image.BICUBIC)
    img.alpha_composite(layer, (int(x - layer.width / 2), int(y - layer.height / 2)))


def draw_labels(img, data):
    for m in data["mista"]:
        p = m.get("popisek")
        if not p:
            continue
        x, y, rot = m["x"] * OUT_SCALE, m["y"] * OUT_SCALE, p.get("rot", 0)
        styl = p.get("styl", "zeme")
        words = m["nazev"].split(" ")
        if styl == "more":
            f = font("IMFePIit28P.ttf", p.get("velikost", 22))
            half = (len(words) + 1) // 2
            for i, ln in enumerate([" ".join(words[:half]), " ".join(words[half:])]):
                paste(img, text_layer(ln, f, 0.2), x, y + (i - .5) * f.size * 1.1, rot)
        elif len(words) == 2 and styl == "zeme":
            import math
            f1, f2 = font("Cinzel.ttf", 24), font("Cinzel.ttf", 17)
            dx, dy = math.sin(math.radians(rot)), math.cos(math.radians(rot))
            off = f1.size * 0.55
            paste(img, text_layer(words[0], f1, 0.15), x - dx * off, y - dy * off, rot)
            paste(img, text_layer(words[1], f2, 0.3), x + dx * off, y + dy * off, rot)
        else:
            f = font("Cinzel.ttf", 27) if styl == "zeme" else font("IMFePIit28P.ttf", 26)
            paste(img, text_layer(m["nazev"], f, 0.18 if styl == "zeme" else 0.3), x, y, rot)
    paste(img, text_layer("Montelien", font("Cinzel.ttf", 48), 0.12), 1810 * OUT_SCALE, 120 * OUT_SCALE, 0)


def main(debug=False):
    data = json.loads((MAPY / "mista.json").read_text(encoding="utf-8"))
    clean = rectify()
    cv2.imwrite(str(MAPY / "Montelien_mapa_vyrovnana.jpg"), clean, [cv2.IMWRITE_JPEG_QUALITY, 90])
    water = water_mask(clean, data)
    img = render(clean, water, data, debug)
    out = MAPY / ("Montelien_mapa_debug.jpg" if debug else "Montelien_mapa.jpg")
    img.convert("RGB").save(out, quality=88)
    print("Uloženo:", out.relative_to(ROOT))


if __name__ == "__main__":
    main("--debug" in sys.argv)
