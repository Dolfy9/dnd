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
PODKLAD = {"mesto": (140, 134, 122), "krypta": (90, 85, 80), "les": (96, 140, 70), "ruiny": (150, 140, 112), "reka": (110, 150, 80),
           "more": (30, 80, 140), "pristav": (150, 140, 120), "bazina": (85, 110, 70), "snih": (225, 230, 235),
           "jeskyne": (70, 66, 62), "hory": (130, 125, 115), "poust": (215, 185, 130), "plaz": (220, 200, 150)}


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


PRUCHOZI = ".gr,=+^S"


def spots(g, n, x0, y0, x1, y1):
    """Prvních n průchozích polí v obdélníku, rozložených po dvou."""
    out = []
    for step in (2, 1):
        for y in range(y0, y1 + 1, step):
            for x in range(x0, x1 + 1, step):
                if g.get(x, y) in PRUCHOZI and [x, y] not in out:
                    out.append([x, y])
                if len(out) >= n:
                    return out
    return out


def mapa(g, start_d, start_n, **kw):
    kw["start"] = {"druzina": spots(g, 6, *start_d), "nepratele": spots(g, 6, *start_n)}
    kw["mrizka"] = g.rows()
    return kw


def lod():
    r = random.Random(101); g = G(30, 20, "~")
    def trup(y0, y1, x0, x1):
        g.rect(x0, y0, x1, y1, "#"); g.rect(x0 + 1, y0 + 1, x1 - 1, y1 - 1, ".")
        for k in range(1, 3):                                   # zúžená příď
            g.rect(x1 + k, y0 + k, x1 + k, y1 - k, "#")
            if y1 - k - 1 >= y0 + k + 1:
                g.rect(x1 + k - 1, y0 + k + 1, x1 + k - 1, y1 - k - 1, ".")
    trup(1, 8, 2, 24)
    g.set(8, 4, "o"); g.set(16, 4, "o")                         # stěžně
    g.set(12, 5, "S"); g.rect(4, 2, 6, 3, "%"); g.set(20, 6, "%"); g.set(21, 6, "%")
    g.rect(3, 2, 3, 7, "^")                                     # lana a sítě na zádi
    trup(12, 18, 5, 22)
    g.set(11, 15, "o"); g.set(17, 15, "o"); g.set(14, 16, "S"); g.rect(7, 13, 8, 14, "%")
    for x in (9, 15, 20):                                       # abordážní můstky
        g.rect(x, 8, x, 12, "=")
    g.scatter(r, ",", 10, 0, 9, 29, 11, on="~")
    return mapa(g, (4, 2, 22, 7), (7, 13, 20, 17), id="more-abordaz", nazev="Abordáž na otevřeném moři",
                misto="01_Svet/Mista/More_a_ostrovy.md", podklad="more", osvetleni="Bright Light (den), zataženo",
                popis="Dvě lodě svázané abordážními háky na rozbouřeném moři. Paluby jsou z prken, zábradlí (#) dává half cover. Mezi loděmi vedou tři úzké můstky (= , DC 10 Acrobatics při Dash). Kdo spadne do moře, je v hluboké vodě a musí plavat; trup je 10 ft nad hladinou. Poklopy (S) vedou do podpalubí.",
                stretnuti=[{"nazev": "Pirate Captain", "pocet": 1}, {"nazev": "Pirate", "pocet": 4}, {"nazev": "Reef Shark", "pocet": 2}])


def pristav():
    r = random.Random(102); g = G(30, 20, "r")
    g.rect(0, 11, 29, 19, "~"); g.rect(0, 10, 29, 10, "#")      # nábřežní zeď
    for x0 in (3, 13, 23):                                      # mola
        g.rect(x0, 10, x0 + 2, 18, "=")
    g.rect(16, 12, 20, 16, "#"); g.rect(17, 13, 19, 15, ".")    # kotvící loď u mola
    g.box(1, 0, 9, 5); g.rect(2, 1, 8, 4, "."); g.set(5, 5, "+"); g.rect(3, 1, 4, 2, "%"); g.rect(7, 3, 8, 4, "%")
    g.box(19, 0, 28, 5); g.rect(20, 1, 27, 4, "."); g.set(23, 5, "+"); g.set(24, 5, "+"); g.rect(25, 1, 27, 2, "%")
    g.scatter(r, "%", 10, 0, 6, 29, 9, on="r"); g.scatter(r, "o", 4, 0, 6, 29, 9, on="r")
    g.scatter(r, ",", 6, 0, 11, 29, 12, on="~")
    return mapa(g, (10, 6, 18, 9), (3, 12, 25, 18), id="menkant-pristav", nazev="Menkant, noční přístav",
                misto="03_Mesta/Mesto_Menkant.md", podklad="pristav", osvetleni="Dim Light (lucerny), jinak Darkness",
                popis="Dlážděné nábřeží se sklady a hromadami beden a sudů (half cover). Tři dřevěná mola vedou nad hlubokou vodu, u prostředního kotví loď. Nábřežní zeď je 10 ft vysoká, do vody se z ní dá skočit. Ze skladů vedou dveře na nábřeží.",
                stretnuti=[{"nazev": "Bandit Captain", "pocet": 1}, {"nazev": "Bandit", "pocet": 3}, {"nazev": "Spy", "pocet": 1}])


def bazina():
    r = random.Random(103); g = G(30, 20, ",")
    for _ in range(9):
        cx, cy, rr = r.randint(2, 27), r.randint(2, 17), r.randint(2, 3)
        for y in range(cy - rr, cy + rr + 1):
            for x in range(cx - rr, cx + rr + 1):
                if (x - cx) ** 2 + (y - cy) ** 2 <= rr * rr:
                    g.set(x, y, "g" if r.random() < .8 else "^")
    g.scatter(r, "~", 22, on=","); g.scatter(r, "T", 26, on="g^"); g.scatter(r, "^", 30, on="g,")
    for x in range(0, 30):                                      # povalový chodník
        g.set(x, 10 + (1 if 8 < x < 20 else 0), "=")
    g.box(21, 3, 26, 7); g.rect(22, 4, 25, 6, "."); g.set(23, 7, "+"); g.set(24, 6, "%")   # chatrč na kůlech
    g.rect(23, 8, 23, 10, "=")
    return mapa(g, (0, 9, 4, 12), (20, 2, 29, 9), id="bazina-chatrc", nazev="Mlžná bažina a čarodějnická chatrč",
                misto="", podklad="bazina", osvetleni="Dim Light (mlha), Heavily Obscured za 30 ft",
                popis="Mělká stojatá voda (difficult terrain) s ostrůvky trávy a rákosu, mezi nimi hluboké tůně. Přes bažinu vede shnilý povalový chodník (normální pohyb). Na kůlech stojí chatrč, kam se dá dostat po lávce. Stromy dávají half cover, mlha omezuje výhled.",
                stretnuti=[{"nazev": "Green Hag", "pocet": 1}, {"nazev": "Giant Frog", "pocet": 2}, {"nazev": "Will-o'-Wisp", "pocet": 1}])


def jezero_led():
    r = random.Random(104); g = G(30, 20, "g")
    for y in range(20):
        for x in range(30):
            if ((x - 15) / 11) ** 2 + ((y - 10) / 7.5) ** 2 <= 1:
                g.set(x, y, "^")
    g.scatter(r, "~", 7, 6, 4, 24, 16, on="^")
    for (x, y) in ((12, 9), (13, 9), (12, 10), (19, 12), (20, 12)):
        g.set(x, y, "~")
    g.scatter(r, "T", 30, on="g"); g.scatter(r, "o", 10, on="g")
    g.rect(0, 9, 3, 10, "r"); g.rect(26, 9, 29, 10, "r")
    return mapa(g, (0, 7, 3, 12), (24, 5, 29, 15), id="sever-zamrzle-jezero", nazev="Zamrzlé jezero na Divokém severu",
                misto="01_Svet/Mista/Divoky_Sever.md", podklad="snih", osvetleni="Bright Light (den), sněžení",
                popis="Zamrzlé jezero obklopené smrky a balvany. Led je slippery ice (difficult terrain; při Dash DC 10 Dexterity save, jinak Prone). Otvory v ledu (~) jsou ledová voda: Extreme Cold a hrozba podchlazení. Led se kolem otvorů láme pod Large tvory.",
                stretnuti=[{"nazev": "Winter Wolf", "pocet": 1}, {"nazev": "Wolf", "pocet": 4}, {"nazev": "Ice Mephit", "pocet": 2}])


def jeskyne():
    r = random.Random(105); g = G(30, 20, "#")
    for y in range(20):
        for x in range(30):
            if ((x - 15) / 13.5) ** 2 + ((y - 10) / 8.5) ** 2 <= 1 and r.random() > .04:
                g.set(x, y, ".")
    g.rect(0, 9, 3, 11, ".")
    for y in range(20):
        for x in range(30):
            d = ((x - 19) / 6) ** 2 + ((y - 9) / 5) ** 2
            if d <= 1:
                g.set(x, y, "~" if d < .65 else ",")
    g.rect(13, 14, 17, 15, "_"); g.rect(15, 14, 15, 15, "=")    # puklina s kamenným mostem
    g.scatter(r, "o", 16, on="."); g.scatter(r, "^", 14, on=".")
    g.rect(26, 15, 27, 16, "%")                                  # stará výprava
    return mapa(g, (0, 8, 5, 12), (20, 14, 27, 17), id="jeskyne-jezero", nazev="Jeskyně s podzemním jezerem",
                misto="", podklad="jeskyne", osvetleni="Darkness (světélkující houby: Dim Light u jezera)",
                popis="Rozlehlá krasová jeskyně. Uprostřed leží černé podzemní jezero (hluboká voda, mělký okraj), stalagmity dávají half cover a sutě jsou difficult terrain. Přes puklinu vede úzký kamenný most. V koutě leží zbytky staré výpravy.",
                stretnuti=[{"nazev": "Giant Octopus", "pocet": 1}, {"nazev": "Darkmantle", "pocet": 2}, {"nazev": "Grick", "pocet": 2}])


def prusmyk():
    r = random.Random(106); g = G(30, 20, "#")
    for x in range(30):
        c = 9 + round(3 * __import__("math").sin(x / 4.5)); w = 3 + (x % 7 > 3)
        g.rect(x, c - w, x, c + w, ".")
        g.set(x, c, "r"); g.set(x, c + 1, "r")
    g.scatter(r, "^", 40, on="."); g.scatter(r, "o", 14, on=".")
    for y in range(20):                                         # propast s mostem
        if g.get(18, y) != "#":
            g.set(18, y, "_"); g.set(19, y, "_")
    for y in range(20):
        if g.get(18, y) == "_" and g.get(17, y) in "r" or (g.get(18, y) == "_" and g.get(20, y) == "r"):
            g.set(18, y, "="); g.set(19, y, "=")
    g.rect(24, 2, 27, 4, "."); g.set(25, 3, "%")                # římsa s hlídkou
    return mapa(g, (0, 4, 4, 15), (22, 2, 29, 16), id="orden-prusmyk", nazev="Horský průsmyk pod Ordenem",
                misto="03_Mesta/Pevnost_Orden.md", podklad="hory", osvetleni="Bright Light (den), studený vítr",
                popis="Úzká stezka sevřená skalními stěnami. Suť je difficult terrain, balvany dávají half cover. Průsmyk přetíná propast (pád 60 ft) s jediným vratkým provazovým mostem. Na římse nad cestou je pozorovatelna.",
                stretnuti=[{"nazev": "Griffon", "pocet": 2}, {"nazev": "Ogre", "pocet": 1}, {"nazev": "Scout", "pocet": 2}])


def oaza():
    r = random.Random(107); g = G(30, 20, ".")
    for y in range(20):
        for x in range(30):
            d = ((x - 14) / 5.5) ** 2 + ((y - 10) / 3.5) ** 2
            if d <= 1:
                g.set(x, y, "~" if d < .55 else ",")
            elif d <= 2.2:
                g.set(x, y, "g")
    g.scatter(r, "T", 14, on="g"); g.scatter(r, "^", 45, on=".")
    for (x, y) in ((24, 3), (27, 3), (24, 7), (27, 7)):          # sloupy chrámu
        g.set(x, y, "o")
    g.rect(25, 4, 26, 6, "S"); g.rect(22, 4, 23, 5, "#")
    g.rect(2, 14, 3, 15, "%"); g.rect(6, 16, 7, 17, "%")         # stany karavany
    return mapa(g, (1, 12, 9, 18), (21, 1, 29, 9), id="tali-oaza", nazev="Oáza v poušti Tali",
                misto="01_Svet/Mista/Tali.md", podklad="poust", osvetleni="Bright Light (poledne), Extreme Heat",
                popis="Jezírko s palmami uprostřed písečných dun (duny jsou difficult terrain). U vody tábořila karavana, stany dávají half cover. Na východě trčí sloupy pohřbeného chrámu se schodištěm do podzemí. V poledním žáru hrozí Extreme Heat.",
                stretnuti=[{"nazev": "Lamia", "pocet": 1}, {"nazev": "Jackal", "pocet": 4}, {"nazev": "Giant Scorpion", "pocet": 1}])


def trziste():
    r = random.Random(108); g = G(30, 20, "r")
    g.rect(0, 17, 29, 19, "~"); g.rect(0, 16, 29, 16, "=")
    g.box(0, 0, 8, 5); g.rect(1, 1, 7, 4, "."); g.set(4, 5, "+")
    g.box(21, 0, 29, 5); g.rect(22, 1, 28, 4, "."); g.set(25, 5, "+"); g.rect(26, 1, 27, 2, "%")
    g.box(0, 9, 4, 14); g.rect(1, 10, 3, 13, "."); g.set(4, 11, "+")
    for y in (8, 12):
        for x in range(7, 24, 3):
            g.rect(x, y, x + 1, y, "%")                         # stánky
    for y in range(9, 12):
        for x in range(13, 16):
            g.set(x, y, "~" if (x, y) == (14, 10) else "o")
    g.set(14, 10, "~"); g.set(13, 10, "r"); g.set(15, 10, "r")
    g.scatter(r, "%", 6, 5, 6, 28, 15, on="r")
    return mapa(g, (10, 1, 19, 4), (6, 13, 26, 15), id="miria-trziste", nazev="Miria, tržiště u přístavu",
                misto="03_Mesta/Mesto_Miria.md", podklad="mesto", osvetleni="Bright Light (den), hustý dav",
                popis="Rušné tržiště mezi kupeckými domy a přístavní hrází. Stánky a vozíky dávají half cover a dav je difficult terrain pro každého, kdo neuhne. Uprostřed stojí kamenná kašna. Na jihu vede dřevěná hráz nad hlubokou vodou přístavu.",
                stretnuti=[{"nazev": "Assassin", "pocet": 1}, {"nazev": "Tough", "pocet": 3}, {"nazev": "Spy", "pocet": 1}])


def nadvori():
    r = random.Random(109); g = G(30, 20, ".")
    g.box(0, 0, 29, 19)
    for (x, y) in ((0, 0), (26, 0), (0, 16), (26, 16)):          # věže
        g.rect(x, y, x + 3, y + 3, "#")
    g.set(1, 4, "S"); g.set(28, 4, "S"); g.set(1, 15, "S"); g.set(28, 15, "S")
    g.rect(13, 19, 16, 19, "+")                                  # brána
    g.box(9, 0, 20, 5); g.rect(10, 1, 19, 4, "."); g.rect(14, 5, 15, 5, "+"); g.rect(10, 1, 11, 1, "%")  # kaple
    g.set(14, 10, "~"); g.set(15, 10, "o")                       # studna
    g.rect(4, 7, 4, 12, "o")                                     # cvičné panáky
    g.rect(22, 7, 25, 8, "%"); g.rect(22, 11, 25, 11, "%")       # vozy a sudy
    g.scatter(r, "^", 8, 3, 13, 26, 17, on=".")
    return mapa(g, (12, 14, 18, 17), (10, 1, 19, 4), id="orden-nadvori", nazev="Nádvoří ordenské pevnosti",
                misto="03_Mesta/Pevnost_Orden.md", podklad="ruiny", osvetleni="Dim Light (pochodně, noc)",
                popis="Hradby se čtyřmi věžemi, schodiště (S) vedou na ochoz. Brána na jihu, kaple Ordenu na severu. Uprostřed studna, u západní zdi cvičné panáky, u východní vozy se zásobami (half cover). Z ochozu je výhled na celé nádvoří.",
                stretnuti=[{"nazev": "Knight", "pocet": 1}, {"nazev": "Guard", "pocet": 4}, {"nazev": "Priest Acolyte", "pocet": 1}])


def pobrezi():
    r = random.Random(110); g = G(30, 20, ".")
    import math
    for y in range(20):
        sh = 18 + round(2 * math.sin(y / 3))
        g.rect(sh, y, 29, y, "~"); g.rect(sh - 2, y, sh - 1, y, ",")
        cl = 4 + round(1.5 * math.sin(y / 2.3))
        g.rect(0, y, cl, y, "#")
    g.rect(0, 8, 5, 11, "."); g.rect(0, 9, 1, 10, "S")           # jeskyně v útesu
    g.rect(21, 12, 25, 14, "%"); g.set(23, 11, "o")              # vrak
    g.scatter(r, "o", 14, 5, 0, 29, 19, on=".,~"); g.scatter(r, "^", 12, on=".")
    return mapa(g, (6, 0, 12, 4), (13, 13, 22, 18), id="ostrovy-pobrezi", nazev="Pobřeží pod útesy",
                misto="01_Svet/Mista/More_a_ostrovy.md", podklad="plaz", osvetleni="Bright Light (soumrak), příliv",
                popis="Písečná pláž mezi strmými útesy a mořem. V příboji leží vrak lodi (half cover) a skály. Mělčina je difficult terrain, dál je hluboká voda. V útesu je jeskyně se schodištěm k pašerácké skrýši. Každé 3 kola příliv posune hranici mělčiny o 1 pole na pevninu.",
                stretnuti=[{"nazev": "Sahuagin Warrior", "pocet": 3}, {"nazev": "Giant Crab", "pocet": 2}, {"nazev": "Sea Hag", "pocet": 1}])


NOVE = [lod, pristav, bazina, jezero_led, jeskyne, prusmyk, oaza, trziste, nadvori, pobrezi]


if __name__ == "__main__":
    if "--predlohy" in sys.argv:
        predlohy()
        sys.exit(0)
    if "--pridat" in sys.argv:                                   # doplní nové mapy, existující (i upravené) nechá být
        data = json.loads(OUT.read_text(encoding="utf-8"))
        ids = {m["id"] for m in data["mapy"]}
        for f in NOVE:
            m = f()
            if m["id"] not in ids:
                if not m.get("misto"):
                    m.pop("misto", None)
                data["mapy"].append(m); print("přidána:", m["id"])
        for m in data["mapy"]:
            if not m.get("obrazek") and (OUT.parent / "bojove" / f"{m['id']}.jpg").exists():
                m["obrazek"] = f"bojove/{m['id']}.jpg"
        OUT.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
        sys.exit(0)
    if OUT.exists() and "--prepsat" not in sys.argv:
        sys.exit(f"{OUT} existuje (mapy mohly být upravené na webu); použij --prepsat")
    maps = [ulicka(), krypta(), brod(), ruiny(), most()]
    for m in maps:
        if (OUT.parent / "bojove" / f"{m['id']}.jpg").exists():
            m["obrazek"] = f"bojove/{m['id']}.jpg"
    OUT.write_text(json.dumps({"mapy": maps}, ensure_ascii=False, indent=1), encoding="utf-8")
    print("zapsáno", len(maps), "map →", OUT)
