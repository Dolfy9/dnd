#!/usr/bin/env python3
"""Organické (přírodní) bojové mapy: terén je spojité pole (šum, křivky, nepravidelné objekty),
z něj se vykreslí předloha pro generátor obrázků a teprve z něj se odvodí logická mřížka 30×20.

  python3 tools/boj_organicke.py            # předlohy do ~/predlohy/org + náhled mřížek
  python3 tools/boj_organicke.py --zapsat   # navíc přepíše mřížky a starty těchto map v 11_Mapy/bojove_mapy.json
"""
import json, math, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "11_Mapy" / "bojove_mapy.json"
PRED = Path.home() / "predlohy" / "org"
W, H, PX, PY = 30, 20, 1536, 1024
S = PX / W
ys, xs = np.mgrid[0:PY, 0:PX]
X, Y = (xs + .5) / S, (ys + .5) / S
CL = ".gr#oT%^~,=+_xSd"   # d = jen dekorace (předloha), v mřížce podklad
COL = {".": (150, 140, 120), "g": (92, 128, 64), "r": (165, 135, 95), "#": (48, 44, 40), "o": (135, 130, 122), "T": (34, 78, 36),
       "%": (110, 72, 40), "^": (112, 100, 72), "~": (28, 70, 120), ",": (88, 135, 160), "=": (140, 105, 65), "+": (110, 70, 35),
       "_": (6, 6, 8), "x": (200, 60, 40), "S": (160, 160, 160), "d": (60, 52, 44)}


def vn(rng, sc):
    gw, gh = int(W / sc) + 3, int(H / sc) + 3
    g = rng.uniform(-1, 1, (gh, gw))
    fx, fy = X / sc, Y / sc
    ix, iy = fx.astype(int), fy.astype(int)
    tx, ty = fx - ix, fy - iy
    tx, ty = tx * tx * (3 - 2 * tx), ty * ty * (3 - 2 * ty)
    a, b, c, d = g[iy, ix], g[iy, ix + 1], g[iy + 1, ix], g[iy + 1, ix + 1]
    return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty


def fbm(seed, sc, octv=4):
    rng = np.random.default_rng(seed)
    out, amp, tot = 0, 1, 0
    for _ in range(octv):
        out = out + amp * vn(rng, sc); tot += amp; amp *= .5; sc /= 2
    return out / tot


class M:
    def __init__(s, base, seed):
        s.L = np.full((PY, PX), CL.index(base), np.int8)
        s.base = base; s.seed = seed; s.rng = np.random.default_rng(seed)

    def put(s, mask, c):
        s.L[mask] = CL.index(c)

    def at(s, x, y):
        return CL[s.L[min(PY - 1, int(y * S)), min(PX - 1, int(x * S))]]

    def blob(s, cx, cy, rx, ry, c, rough=.3, sc=2.5, ang=0):
        ca, sa = math.cos(ang), math.sin(ang)
        u, v = (X - cx) * ca + (Y - cy) * sa, -(X - cx) * sa + (Y - cy) * ca
        d = (u / rx) ** 2 + (v / ry) ** 2 + rough * fbm(int(s.rng.integers(1e9)), sc)
        s.put(d < 1, c); return d

    def seg(s, pts, w, c, rough=0.0):
        d = np.full((PY, PX), 1e9)
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            dx, dy = x1 - x0, y1 - y0
            t = np.clip(((X - x0) * dx + (Y - y0) * dy) / (dx * dx + dy * dy), 0, 1)
            d = np.minimum(d, np.hypot(X - x0 - t * dx, Y - y0 - t * dy))
        if rough:
            d = d + rough * fbm(int(s.rng.integers(1e9)), 1.5)
        s.put(d < w / 2, c); return d

    def rect(s, cx, cy, w, h, ang, c):
        ca, sa = math.cos(ang), math.sin(ang)
        u, v = (X - cx) * ca + (Y - cy) * sa, -(X - cx) * sa + (Y - cy) * ca
        m = (abs(u) < w / 2) & (abs(v) < h / 2); s.put(m, c); return u, v

    def house(s, cx, cy, w, h, ang, door=(0, 1), t=.35):
        s.rect(cx, cy, w, h, ang, "#"); u, v = s.rect(cx, cy, w - 2 * t, h - 2 * t, ang, ".")
        ca, sa = math.cos(ang), math.sin(ang)
        dx, dy = door[0] * (w / 2 - t / 2), door[1] * (h / 2 - t / 2)
        s.rect(cx + dx * ca - dy * sa, cy + dx * sa + dy * ca, 1.1 if door[1] else t * 1.6, t * 1.6 if door[1] else 1.1, ang, "+")

    def scatter(s, c, n, rmin, rmax, on, box=(0, 0, W, H), gap=.3, avoid=()):
        pts, k = [], 0
        for _ in range(n * 60):
            if k >= n: break
            x, y = s.rng.uniform(box[0], box[2]), s.rng.uniform(box[1], box[3]); r = s.rng.uniform(rmin, rmax)
            if s.at(x, y) not in on or any(math.hypot(x - a, y - b) < r + rr + gap for a, b, rr in pts) or any(f(x, y) for f in avoid):
                continue
            pts.append((x, y, r)); k += 1
            s.put((X - x) ** 2 / r ** 2 + (Y - y) ** 2 / (r * s.rng.uniform(.75, 1)) ** 2 < 1, c)
        return pts

    def grid(s):
        rows = []
        for gy in range(H):
            row = ""
            for gx in range(W):
                blk = s.L[int(gy * S):int((gy + 1) * S), int(gx * S):int((gx + 1) * S)]
                f = np.bincount(blk.ravel(), minlength=len(CL)) / blk.size
                F = {c: f[i] for i, c in enumerate(CL)}
                if F["#"] >= .4: ch = "#"
                elif F["_"] >= .5: ch = "_"
                elif F["="] >= .4: ch = "="
                elif F["+"] >= .25: ch = "+"
                elif F["S"] >= .4: ch = "S"
                elif F["T"] >= .35: ch = "T"
                elif F["o"] >= .3: ch = "o"
                elif F["%"] >= .35: ch = "%"
                elif F["x"] >= .3: ch = "x"
                elif F["~"] >= .5: ch = "~"
                elif F["~"] + F[","] >= .45: ch = ","
                elif F["^"] >= .4: ch = "^"
                elif F["r"] >= .4: ch = "r"
                elif F["#"] + F["_"] >= .5: ch = "#"
                else:
                    best = max((F[c], c) for c in ".g")
                    ch = best[1] if best[0] > 0 else s.base
                    if ch == "d": ch = s.base
                row += ch
            rows.append(row)
        return rows

    def image(s, path):
        pal = np.array([COL[c] for c in CL], np.float32)
        im = pal[s.L]
        sh = fbm(s.seed + 7, 3) * 18 + fbm(s.seed + 8, .6, 3) * 10
        im = np.clip(im + sh[..., None], 0, 255).astype(np.uint8)
        Image.fromarray(im).filter(ImageFilter.GaussianBlur(2.2)).save(path)


def brod():
    m = M("g", 11)
    m.put(fbm(12, 3) > .3, "^")
    cx = 15 + 3 * np.sin(Y / 3.2) + 1.4 * np.sin(Y / 1.7 + 1)
    hw = 2.3 + .9 * fbm(13, 4)
    d = np.abs(X - cx) + .5 * fbm(14, 1.2)
    m.put(d < hw, ","); m.put((d < hw * .55) & (np.abs(Y - 10 - 1.2 * np.sin(X / 2)) > 1.7), "~")
    p = 10 + 2.2 * np.sin(X / 4) + .5 * np.sin(X / 1.3)
    m.put((np.abs(Y - p) < .75 + .2 * fbm(15, 1)) & (d > hw), "r")
    river = lambda x, y: abs(x - (15 + 3 * math.sin(y / 3.2) + 1.4 * math.sin(y / 1.7 + 1))) < 3.6
    m.scatter("T", 42, .6, 1.35, "g^", avoid=(river, lambda x, y: abs(y - (10 + 2.2 * math.sin(x / 4))) < 1.5))
    m.scatter("o", 9, .35, .7, "g^,")
    m.seg([(5.5, 3.2), (9.2, 5.1)], .7, "%"); m.seg([(21.5, 15.5), (24.8, 13.4)], .75, "%")
    return m, (0, 6, 5, 14), (22, 4, 29, 16), "forest stream ford: a meandering clear stream with pebbly shallows and a darker deep channel, a muddy ford where the dirt path crosses, dense deciduous forest with large tree canopies, ferns and bramble undergrowth (the brownish patches), mossy boulders, two fallen moss-covered tree trunks (the long brown shapes), dappled sunlight."


def most():
    m = M("g", 21)
    m.put(fbm(22, 3) > .35, "^")
    cy = 10 + 1.6 * np.sin(X / 4 + .5) + .8 * np.sin(X / 1.9)
    hw = 3.4 + .7 * fbm(23, 4)
    d = np.abs(Y - cy) + .45 * fbm(24, 1.2)
    m.put(d < hw, ","); m.put(d < hw * .7, "~")
    a = math.radians(14)
    m.rect(15, 10, 3.2, 16, a, "=")
    for sgn in (-1, 1):
        m.rect(15 + sgn * 1.75 * math.cos(a), 10 + sgn * 1.75 * math.sin(a), .35, 15.6, a, "d")
    for (y0, y1, xs_) in ((0, 2.3, 16.9), (17.8, 20, 13.1)):
        pass
    m.seg([(16.95, 2.2), (17.6, 0)], 2.6, "r", .3); m.seg([(13.05, 17.8), (12.0, 20)], 2.6, "r", .3)
    m.house(21.5, 16.3, 4.6, 3.6, math.radians(-9), door=(-1, 0))
    m.scatter("T", 24, .6, 1.3, "g^", avoid=(lambda x, y: abs(y - 10) < 5.5,))
    m.scatter("o", 12, .35, .8, "g^,")
    return m, (13, 0, 19, 2), (8, 15, 26, 19), "a weathered old stone arch bridge with low stone parapets crossing a wide wild river at a slight angle, fast turbulent deep water with foam and rapids, rocky shallow river banks with pebbles, grassy meadow banks with clumps of shrubs (the brownish patches), scattered trees, a small stone toll house with a slate roof cut away on the south bank, dirt roads leading to both ends of the bridge, bright daylight."


def ruiny():
    m = M("g", 31)
    m.put(fbm(32, 2.5) > .05, ".")
    a = math.radians(17)
    m.rect(15, 10, 17.4, 11.4, a, "#"); m.rect(15, 10, 15.6, 9.6, a, ".")
    ca, sa = math.cos(a), math.sin(a)
    for (u, v, w, h) in ((-3.5, -5.2, 2.6, 2.4), (4.8, 5.2, 2.2, 2.4), (-8.2, 1.5, 2.4, 2.4), (8.2, -2.5, 2.4, 1.8)):   # průlomy se sutí
        m.rect(15 + u * ca - v * sa, 10 + u * sa + v * ca, w, h, a, "^")
    for (gx, gy, r) in ((8.5, 5.8, 1.6), (21.5, 14.2, 1.4), (19.8, 4.4, 1.3), (9.5, 15.5, 1.2), (13.2, 4.8, .9)):
        m.put((X - gx) ** 2 + (Y - gy) ** 2 < r * r, "^")
    m.rect(15.6, 10.2, 5.2, 4, a, "#"); m.rect(15.6, 10.2, 4.4, 3.2, a, ".")
    m.rect(13.9 - .1, 9.7, .5, 1.2, a, "+")
    m.blob(16, 10.4, .8, .55, "x", .1, ang=a)
    ca, sa = math.cos(a), math.sin(a)
    for i in range(6):
        for sgn in (-1, 1):
            u, v = -6 + i * 2.4, sgn * 3.1
            if (i, sgn) in ((2, 1), (4, -1)): continue
            px_, py_ = 15 + u * ca - v * sa, 10 + u * sa + v * ca
            m.put((X - px_) ** 2 + (Y - py_) ** 2 < .42 ** 2 * 2.2, "o")
    m.blob(25.5, 3.2, 2.4, 1.7, "_", .35, 2)
    m.put((fbm(33, 1.4) > .45) & (m.L == CL.index(".")), "^")
    inside = lambda x, y: abs((x - 15) * ca + (y - 10) * sa) < 9 and abs(-(x - 15) * sa + (y - 10) * ca) < 6
    m.scatter("T", 18, .7, 1.4, "g.", avoid=(inside,))
    m.scatter("o", 7, .3, .6, ".^", box=(5, 3, 25, 17))
    return m, (0, 14, 6, 19), (12, 7, 20, 13), "the overgrown ruins of an ancient temple of a lost civilisation: crumbling thick stone walls with collapsed breaches and rubble piles (the brownish patches), a broken colonnade, an inner sanctum with a stone altar glowing with red runes, cracked flagstones invaded by grass, roots and ivy, trees growing through the ruins, a collapsed sinkhole in the north-east corner, overcast moody light."


def bazina():
    m = M(",", 41)
    m.put(fbm(42, 2.6) > .12, "g"); m.put((fbm(43, 1.5) > .3) & (m.L == CL.index("g")), "^")
    m.put(fbm(44, 2.2) > .42, "~")
    m.seg([(0, 10.5), (4, 9.6), (8.5, 11.2), (13, 10.4), (17.5, 11.6), (20.5, 9.8), (22.4, 8.2)], 1.0, "=")
    m.seg([(13, 10.4), (14.5, 14.5), (13.2, 19.5)], .9, "=")
    m.house(23.6, 5.2, 4.8, 4, math.radians(12), door=(0, 1))
    m.scatter("T", 26, .5, 1.1, "g^", avoid=(lambda x, y: 20 < x < 27.5 and 2 < y < 8.5,))
    m.scatter("o", 5, .3, .6, "g,")
    return m, (0, 8, 4, 13), (19, 2, 29, 9), "a misty murky swamp: shallow brown-green stagnant water with algae and lily pads, darker deep pools, irregular grassy hummocks with tall reeds and sedges (the brownish patches), gnarled moss-covered dead trees and willows, a crooked rotten plank boardwalk winding through, a witch's wooden hut on stilts with a mossy roof cut away showing a small cauldron inside, low drifting fog."


def jezero():
    m = M("g", 51)
    d = ((X - 15) / 11) ** 2 + ((Y - 10.2) / 7) ** 2 + .35 * fbm(52, 2.5)
    m.put(d < 1, "^")
    for (hx, hy, r) in ((11.5, 9.2, 1.0), (19.5, 12.4, .8), (16.2, 6.4, .55), (8.6, 12.8, .6), (22.5, 7.8, .5)):
        m.blob(hx, hy, r * 1.3, r, "~", .35, 1)
    m.put((fbm(53, 1.6) > .35) & (m.L == CL.index("g")), "^")
    m.seg([(0, 9.5), (2.8, 10.2), (4.6, 9.4)], 1.4, "r", .3); m.seg([(25.6, 10.8), (27.4, 10), (30, 10.6)], 1.4, "r", .3)
    m.scatter("T", 46, .6, 1.25, "g^", avoid=(lambda x, y: ((x - 15) / 12) ** 2 + ((y - 10.2) / 8) ** 2 < 1,))
    m.scatter("o", 11, .35, .85, "g^")
    return m, (0, 7, 3, 12), (25, 5, 29, 15), "a frozen lake in a northern snowy spruce forest: irregular natural shoreline, cracked blue-white lake ice with frost and wind-swept snow drifts, several jagged dark holes of freezing black water, deep snow around the lake with snow-covered shrubs and drifts (the brownish patches on land), snow-laden spruce trees, granite boulders dusted with snow, a trampled snowy trail entering from west and east, light snowfall, cold overcast light."


def jeskyne():
    m = M("#", 61)
    d = ((X - 15) / 13.3) ** 2 + ((Y - 10) / 8.4) ** 2 + .45 * fbm(62, 2.4)
    m.put(d < 1, "."); m.seg([(0, 10.2), (3.5, 9.6)], 2.6, ".", .5)
    l = m.blob(19.2, 8.8, 5.6, 4.2, ",", .4, 2.2); m.put(l < .62, "~")
    m.seg([(9.5, 13.6), (12.2, 15.0), (15.6, 14.4), (18.4, 16.2)], 1.3, "_", .25)
    m.seg([(13.6, 13.4), (14.4, 16.2)], 1.1, "=")
    m.put((fbm(63, 1.4) > .35) & (m.L == CL.index(".")), "^")
    m.scatter("o", 20, .3, .75, ".^")
    m.seg([(25.4, 15.1), (26.6, 15.9)], .8, "%")
    return m, (0, 8, 5, 12), (20, 13, 27, 17), "a vast natural limestone cavern enclosed by rough dark rock walls with an organic irregular outline: uneven cave floor, loose rubble and gravel heaps (the brownish patches), many natural stalagmites, a black still underground lake with a pale wet stone shore, a jagged deep crevice crossed by a narrow natural rock bridge, a few rotting remains of an old expedition in the south-east, faint bluish bioluminescent fungi near the water, deep shadows."


def prusmyk():
    m = M("#", 71)
    cy = 10 + 3 * np.sin(X / 4.5) + 1 * np.sin(X / 1.7)
    hw = 3.3 + 1.3 * fbm(72, 3)
    d = np.abs(Y - cy) + .5 * fbm(73, 1)
    m.put(d < hw, "."); m.put((fbm(74, 1.3) > .2) & (d < hw), "^")
    m.put(np.abs(Y - cy) < .7, "r")
    m.blob(25.5, 3.3, 2.4, 1.3, ".", .25, 1.5)
    ch = np.abs(X - (18 + .3 * (Y - 10) + .6 * np.sin(Y / 1.5))) + .25 * fbm(75, 1)
    m.put((ch < 1.2) & (m.L != CL.index("#")), "_")
    m.put((ch < 1.9) & (np.abs(Y - cy) < 1.0), "=")
    m.scatter("o", 16, .35, .9, ".^")
    m.seg([(25.2, 3.1), (26.1, 3.6)], .6, "%")
    return m, (0, 4, 4, 15), (22, 2, 29, 16), "a narrow winding mountain pass between towering jagged grey granite cliffs: a stony dirt trail, loose scree slopes (the brownish patches), patches of old snow and alpine grass, scattered boulders, a deep bottomless chasm with mist cutting across the pass, spanned by a sagging rope-and-plank bridge, a small rock ledge with a lookout's supply crate in the north-east, harsh clear daylight with long shadows."


def oaza():
    m = M(".", 81)
    m.put(np.sin(X * .9 + Y * .35 + 3 * fbm(82, 3)) > .62, "^")
    d = m.blob(14, 10, 5.6, 3.6, ",", .35, 2.4); m.put(d < .55, "~")
    m.put((d >= 1) & (d < 2.1), "g")
    m.scatter("T", 15, .6, 1.2, "g")
    for (px_, py_) in ((23.6, 2.7), (26.9, 3.4), (24.1, 7.3), (27.3, 6.6), (25.2, 5.1)):
        m.put((X - px_) ** 2 + (Y - py_) ** 2 < .45 ** 2 * 2, "o")
    m.rect(25.6, 5.0, 1.6, 2.6, math.radians(8), "S"); m.rect(22.4, 4.4, .6, 2.4, math.radians(25), "#")
    m.blob(3.0, 14.6, 1.3, .9, "%", .1, ang=.4); m.blob(6.8, 16.6, 1.2, .8, "%", .1, ang=-.3)
    m.scatter("o", 10, .3, .7, ".^")
    return m, (1, 12, 9, 18), (21, 1, 29, 9), "a desert oasis at noon: wind-rippled golden sand with organic dune ridges (the brownish streaks), a natural irregular turquoise pond with sandy shallows, lush grass, reeds and date palms around the water, a caravan camp with two canvas tents and rugs, the sand-buried ruins of an ancient temple in the east with broken leaning sandstone pillars and a stairway descending underground, scattered rocks, harsh bright sunlight with crisp shadows."


def pobrezi():
    m = M(".", 91)
    sh = 19 + 2.5 * np.sin(Y / 3) + 1.2 * fbm(92, 3)
    m.put(X > sh - 1.8, ","); m.put(X > sh, "~")
    cl = 4 + 1.6 * np.sin(Y / 2.3) + 1.4 * fbm(93, 2)
    m.put(X < cl, "#")
    m.blob(2.5, 9.6, 3.2, 1.5, ".", .25, 1.5); m.blob(.8, 9.6, .8, .8, "S", .1)
    m.put((fbm(94, 1.5) > .4) & (m.L == CL.index(".")), "^")
    m.rect(23.2, 13.2, 5.4, 2.0, math.radians(-22), "%")
    m.scatter("o", 16, .3, .8, ".,~", box=(5, 0, 30, 20))
    return m, (6, 0, 12, 4), (13, 13, 22, 18), "a wild tropical beach at dusk below steep dark basalt cliffs on the west with an organic jagged outline: pale sand with seaweed, driftwood and pebble patches (the brownish patches), wet sand and curving surf foam, shallow turquoise water fading into deep blue sea, scattered dark sea rocks, the long brown shape in the surf is a broken wrecked wooden ship hull lying on its side with exposed ribs, a sea cave in the cliff with rough carved steps, warm golden low sunlight."


MAPY = {"divoke-kraje-brod": brod, "kop-aram-most": most, "dar-kemmar-ruiny": ruiny, "bazina-chatrc": bazina,
        "sever-zamrzle-jezero": jezero, "jeskyne-jezero": jeskyne, "orden-prusmyk": prusmyk, "tali-oaza": oaza, "ostrovy-pobrezi": pobrezi}

if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).parent))
    from boj_mapy import spots
    PRED.mkdir(parents=True, exist_ok=True)
    data = json.loads(OUT.read_text(encoding="utf-8"))
    sceny = {}
    for mid, f in MAPY.items():
        m, sd, sn, scena = f()
        rows = m.grid(); m.image(PRED / f"{mid}.png"); sceny[mid] = scena

        class G2:
            def get(s, x, y):
                return rows[y][x] if 0 <= x < W and 0 <= y < H else "#"
        st = {"druzina": spots(G2(), 6, *sd), "nepratele": spots(G2(), 6, *sn)}
        print(mid, st); print("\n".join(rows)); print()
        if "--zapsat" in sys.argv:
            for d in data["mapy"]:
                if d["id"] == mid:
                    d["mrizka"] = rows; d["start"] = st
    (PRED / "sceny.json").write_text(json.dumps(sceny, ensure_ascii=False, indent=1), encoding="utf-8")
    if "--zapsat" in sys.argv:
        OUT.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8"); print("zapsáno →", OUT)
