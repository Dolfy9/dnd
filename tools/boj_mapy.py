#!/usr/bin/env python3
"""Generuje výchozí bojové mapy (mřížka 5 ft) do 11_Mapy/bojove_mapy.json.

Znaky dlaždic: . podlaha/zem, g tráva, r cesta, # zeď, o sloup/balvan/socha,
T strom, % bedny/sarkofág/stůl (half cover, těžký terén), ^ těžký terén (sutiny, podrost),
~ hluboká voda, , mělčina, = most/lávka, + dveře, _ propast/jáma, x nebezpečí, S schody.
Spuštění: python3 tools/boj_mapy.py [--prepsat]
         python3 tools/boj_mapy.py --predlohy   # schematické předlohy pro ilustrace (viz tools/boj_obrazky.md)
Ilustrace map leží v 11_Mapy/bojove/<id>.jpg a mapa na ně odkazuje polem "obrazek".
"""
import json, random, sys
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "11_Mapy" / "bojove_mapy.json"


PRED = {"%": (130, 85, 45), "g": (96, 140, 70), "r": (170, 140, 100), "#": (45, 40, 38), "o": (130, 125, 120),
        "T": (40, 90, 40), "^": (110, 95, 75), "~": (30, 80, 140), ",": (90, 140, 175), "=": (140, 105, 65),
        "+": (110, 70, 35), "_": (5, 5, 5), "x": (230, 110, 30), "S": (150, 150, 150)}
PODKLAD = {"mesto": (140, 134, 122), "krypta": (90, 85, 80), "les": (96, 140, 70), "ruiny": (150, 140, 112), "reka": (110, 150, 80)}


def predlohy():
    """Vykreslí schematické předlohy (1536×1024) z mřížek v OUT do 11_Mapy/bojove/predlohy/."""
    from PIL import Image, ImageDraw
    cil = OUT.parent / "bojove" / "predlohy"
    cil.mkdir(parents=True, exist_ok=True)
    for m in json.loads(OUT.read_text(encoding="utf-8"))["mapy"]:
        g = m["mrizka"]; w, h = len(g[0]), len(g); c = 1536 // w
        im = Image.new("RGB", (w * c, h * c), PODKLAD.get(m.get("podklad"), PODKLAD["mesto"])); dr = ImageDraw.Draw(im)
        for y, row in enumerate(g):
            for x, ch in enumerate(row):
                col = PRED.get(ch); x0, y0 = x * c, y * c
                if not col:
                    continue
                if ch in "oT":
                    dr.ellipse((x0 + 4, y0 + 4, x0 + c - 4, y0 + c - 4), fill=col)
                elif ch == "%":
                    dr.rectangle((x0 + 6, y0 + 6, x0 + c - 6, y0 + c - 6), fill=col)
                elif ch == "+":
                    dr.rectangle((x0 + 4, y0 + c // 3, x0 + c - 4, y0 + 2 * c // 3), fill=col)
                elif ch == "x":
                    dr.ellipse((x0 + 8, y0 + 8, x0 + c - 8, y0 + c - 8), fill=col)
                else:
                    dr.rectangle((x0, y0, x0 + c - 1, y0 + c - 1), fill=col)
        im.resize((1536, 1024)).save(cil / f"{m['id']}.png")
        print("předloha:", cil / f"{m['id']}.png")


class G:
    def __init__(s, w, h, fill="."):
        s.w, s.h = w, h
        s.g = [[fill] * w for _ in range(h)]

    def ok(s, x, y):
        return 0 <= x < s.w and 0 <= y < s.h

    def set(s, x, y, c):
        if s.ok(x, y):
            s.g[y][x] = c

    def get(s, x, y):
        return s.g[y][x] if s.ok(x, y) else "#"

    def rect(s, x0, y0, x1, y1, c):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                s.set(x, y, c)

    def box(s, x0, y0, x1, y1, c="#"):
        for x in range(x0, x1 + 1):
            s.set(x, y0, c); s.set(x, y1, c)
        for y in range(y0, y1 + 1):
            s.set(x0, y, c); s.set(x1, y, c)

    def scatter(s, rnd, c, n, x0=0, y0=0, x1=None, y1=None, on=".g"):
        x1 = s.w - 1 if x1 is None else x1
        y1 = s.h - 1 if y1 is None else y1
        k = 0
        for _ in range(n * 30):
            if k >= n:
                break
            x, y = rnd.randint(x0, x1), rnd.randint(y0, y1)
            if s.get(x, y) in on:
                s.set(x, y, c); k += 1

    def rows(s):
        return ["".join(r) for r in s.g]


def ulicka():
    r = random.Random(11); g = G(30, 20, ".")
    g.rect(0, 8, 29, 11, "r")                       # hlavní ulice
    g.rect(13, 0, 16, 7, "r")                       # ulička k Katedrále
    for (x0, y0, x1, y1, d) in [(0, 0, 11, 6, (6, 6)), (18, 0, 29, 6, (22, 6)), (0, 13, 8, 19, (4, 13)),
                               (11, 13, 19, 19, (15, 13)), (22, 13, 29, 19, (25, 13))]:
        g.rect(x0, y0, x1, y1, "#"); g.rect(x0 + 1, y0 + 1, x1 - 1, y1 - 1, "."); g.set(*d, "+")
    for x0, y0, x1, y1 in [(1, 1, 10, 5), (19, 1, 28, 5), (1, 14, 7, 18), (12, 14, 18, 18), (23, 14, 28, 18)]:
        g.scatter(r, "%", 3, x0, y0, x1, y1, on=".")
    g.rect(0, 7, 29, 7, "."); g.rect(0, 12, 29, 12, ".")   # chodníky
    g.set(9, 7, "%"); g.set(10, 7, "%"); g.set(20, 12, "%"); g.set(21, 12, "%"); g.set(2, 12, "%")
    g.set(14, 9, "o"); g.set(15, 10, "o")                    # kašna
    g.set(9, 12, "^"); g.set(10, 12, "^"); g.set(26, 7, "x")
    g.rect(13, 0, 16, 0, "S")
    return dict(id="octowerin-ulicka", nazev="Octowerin – Ulička pod Katedrálou",
                misto="03_Mesta/Mesto_Octowerin.md", podklad="mesto", osvetleni="Dim Light (noc, lucerny)",
                popis="Noční křižovatka pod schody ke Katedrále. Domy s dveřmi do dílen, kašna uprostřed, stánky a bedny jako kryt. Lucerna v rohu (x) hoří – Fire 1d4 při vstupu.",
                start={"druzina": [[1, 9], [1, 10], [2, 9], [2, 10], [3, 9], [3, 10]], "nepratele": [[27, 9], [27, 10], [14, 2], [15, 2], [26, 11]]},
                stretnuti=[{"nazev": "Guard", "pocet": 3}, {"nazev": "Guard Captain", "pocet": 1}], mrizka=g.rows())


def krypta():
    r = random.Random(23); g = G(30, 20, "#")
    g.rect(1, 7, 8, 12, ".")                                  # vstupní sál
    g.rect(9, 9, 12, 10, ".")                                 # chodba
    g.rect(13, 3, 28, 16, ".")                                # hlavní krypta
    for x in (15, 19, 23, 27):
        g.set(x, 6, "o"); g.set(x, 13, "o")
    for y in (8, 11):
        for x in (16, 17, 21, 22, 25):
            g.set(x, y, "%")                                  # sarkofágy
    g.rect(13, 14, 20, 16, ",")                               # zatopená část
    g.rect(14, 15, 17, 16, "~")
    g.rect(3, 13, 6, 18, "."); g.rect(4, 17, 5, 18, "_")      # boční výklenek s jámou
    g.rect(3, 1, 6, 6, "."); g.rect(4, 1, 5, 1, "S")          # schody nahoru
    g.scatter(r, "^", 10, 13, 3, 28, 16, on=".")
    g.set(28, 9, "x"); g.set(28, 10, "x")                     # nekrotický oltář
    g.set(9, 9, "+")
    return dict(id="mictima-krypta", nazev="Mictima – Zatopená krypta",
                misto="03_Mesta/Mesto_Mictima.md", podklad="krypta", osvetleni="Darkness (bez světla)",
                popis="Krypta pod hřbitovem Mictimy. Řady sarkofágů (half cover), sloupy (three-quarters cover), zatopený kout s hlubokou vodou a boční jáma (10 ft, 1d6 Bludgeoning). Oltář (x) vyzařuje Necrotic 1d6 na začátku tahu.",
                start={"druzina": [[4, 2], [5, 2], [4, 3], [5, 3], [4, 4], [5, 4]], "nepratele": [[18, 9], [20, 10], [24, 9], [26, 10], [19, 4], [23, 15]]},
                stretnuti=[{"nazev": "Zombie", "pocet": 4}, {"nazev": "Ghoul", "pocet": 2}], mrizka=g.rows())


def brod():
    r = random.Random(37); g = G(30, 20, "g")
    for y in range(20):                                       # potok
        cx = 14 + int(3 * __import__("math").sin(y / 3.0))
        for x in range(cx - 1, cx + 2):
            g.set(x, y, "~")
        g.set(cx - 2, y, ","); g.set(cx + 2, y, ",")
    for x in range(30):                                       # cesta přes brod
        y = 9 + (1 if x > 20 else 0)
        for yy in (y, y + 1):
            g.set(x, yy, "," if g.get(x, yy) in "~," else "r")
    g.scatter(r, "T", 38, 0, 0, 29, 19, on="g")
    g.scatter(r, "^", 45, 0, 0, 29, 19, on="g")
    g.scatter(r, "o", 6, 0, 0, 29, 19, on="g")
    g.rect(23, 3, 26, 5, "^"); g.set(24, 4, "o")               # vývrat
    for p in [(1, 9), (1, 10), (2, 9), (2, 10), (3, 9), (3, 10), (27, 10), (27, 11)]:
        g.set(*p, "r")
    return dict(id="divoke-kraje-brod", nazev="Divoké kraje – Lesní brod",
                misto="", podklad="les", osvetleni="Bright Light (den) / Dim Light v podrostu",
                popis="Lesní cesta přechází potok mělkým brodem. Hluboká voda (swim) uprostřed, mělčina je těžký terén. Stromy dávají three-quarters cover, podrost je těžký terén – ideální přepadení ze zálohy.",
                start={"druzina": [[1, 9], [1, 10], [2, 9], [2, 10], [3, 9], [3, 10]], "nepratele": [[20, 3], [22, 6], [19, 15], [24, 14], [27, 10]]},
                stretnuti=[{"nazev": "Bandit", "pocet": 4}, {"nazev": "Bandit Captain", "pocet": 1}], mrizka=g.rows())


def ruiny():
    r = random.Random(53); g = G(30, 20, "g")
    g.box(6, 3, 23, 16, "#")                                  # obvod svatyně
    g.rect(7, 4, 22, 15, ".")
    for x, y in [(6, 8), (6, 9), (6, 10), (14, 3), (15, 3), (23, 11), (23, 12), (10, 16), (11, 16), (19, 16)]:
        g.set(x, y, "^")                                      # průlomy
    for x in (9, 13, 17, 21):
        g.set(x, 6, "o"); g.set(x, 13, "o")
    g.rect(18, 8, 21, 11, "."); g.rect(19, 9, 20, 10, "%")    # oltář
    g.set(18, 8, "x"); g.set(21, 11, "x")
    g.box(10, 8, 13, 11, "#"); g.rect(11, 9, 12, 10, "."); g.set(13, 10, "^"); g.set(10, 9, "^")
    g.scatter(r, "^", 18, 7, 4, 22, 15, on=".")
    g.scatter(r, "^", 25, on="g"); g.scatter(r, "o", 8, on="g"); g.scatter(r, "T", 6, on="g")
    g.rect(25, 0, 29, 2, "_")
    return dict(id="dar-kemmar-ruiny", nazev="Dar Kemmar – Zřícená svatyně Stavitelů",
                misto="03_Mesta/Mesto_Dar_Kemmar.md", podklad="ruiny", osvetleni="Dim Light (soumrak)",
                popis="Rozpadlá svatyně z éry Stavitelů. Průlomy ve zdech (sutiny = těžký terén), řady sloupů, vnitřní cela a oltář s rudými runami (x): kdo začne tah vedle, hází CON save DC 13, při neúspěchu Necrotic 2d6. V rohu se propadla zem do hlubiny.",
                start={"druzina": [[1, 9], [1, 10], [2, 9], [2, 10], [1, 11], [2, 11]], "nepratele": [[20, 7], [16, 10], [12, 12], [19, 12]]},
                stretnuti=[{"nazev": "Wight", "pocet": 1}, {"nazev": "Shadow", "pocet": 2}, {"nazev": "Zombie", "pocet": 2}], mrizka=g.rows())


def most():
    r = random.Random(71); g = G(30, 20, "g")
    g.rect(0, 7, 29, 12, "~"); g.rect(0, 6, 29, 6, ","); g.rect(0, 13, 29, 13, ",")
    g.rect(13, 3, 16, 16, "=")                                # most
    for y in range(6, 14):
        g.set(12, y, "#"); g.set(17, y, "#")                  # zábradlí
    g.set(12, 9, "="); g.set(17, 10, "_")                     # průlom v zábradlí, díra
    g.set(14, 11, "_")
    g.rect(13, 0, 16, 2, "r"); g.rect(13, 17, 16, 19, "r")
    g.box(18, 14, 23, 18, "#"); g.rect(19, 15, 22, 17, "."); g.set(18, 15, "+"); g.set(20, 16, "%")   # mýtnice
    g.set(13, 3, "%"); g.set(16, 3, "%")                      # závora a sudy
    g.scatter(r, "T", 14, 0, 0, 29, 5, on="g"); g.scatter(r, "T", 10, 0, 14, 29, 19, on="g")
    g.scatter(r, "o", 8, on="g"); g.scatter(r, "^", 16, on="g")
    return dict(id="kop-aram-most", nazev="Most Kop Aramu",
                misto="03_Mesta/Mesto_Kop_Aram.md", podklad="reka", osvetleni="Bright Light (den)",
                popis="Starý kamenný most přes dravou řeku (hluboká voda, proud strhne 10 ft po proudu na konci tahu). Zábradlí dává half cover, průlomy vedou rovnou do vody. Na jižním břehu stojí mýtnice.",
                start={"druzina": [[13, 0], [14, 0], [15, 0], [16, 0], [14, 1], [15, 1]], "nepratele": [[14, 15], [15, 15], [20, 16], [8, 15], [24, 15]]},
                stretnuti=[{"nazev": "Ogre", "pocet": 1}, {"nazev": "Bugbear Warrior", "pocet": 2}, {"nazev": "Goblin Warrior", "pocet": 3}], mrizka=g.rows())


if __name__ == "__main__":
    if "--predlohy" in sys.argv:
        predlohy()
        sys.exit(0)
    if OUT.exists() and "--prepsat" not in sys.argv:
        sys.exit(f"{OUT} existuje (mapy mohly být upravené na webu); použij --prepsat")
    maps = [ulicka(), krypta(), brod(), ruiny(), most()]
    for m in maps:
        if (OUT.parent / "bojove" / f"{m['id']}.jpg").exists():
            m["obrazek"] = f"bojove/{m['id']}.jpg"
    OUT.write_text(json.dumps({"mapy": maps}, ensure_ascii=False, indent=1), encoding="utf-8")
    print("zapsáno", len(maps), "map →", OUT)
