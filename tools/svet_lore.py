"""Doplnění atlasu (svet.json) o prvky z loru: oblasti, mrtvá země, pole u sídel, strážní věže, potopené věže Kop Aramu a obchodní cesty."""
import json
from pathlib import Path

import cv2
import numpy as np
from scipy.sparse import csr_matrix
from scipy.sparse.csgraph import minimum_spanning_tree
from scipy.spatial import Delaunay
from shapely.geometry import Point, Polygon
from shapely.ops import unary_union
from skimage.graph import MCP_Geometric

T = Path(__file__).resolve().parent
R = T.parent
VELKA = {"mesto", "hrad", "pevnost", "pristav", "kopar"}


def body(p):
    return [[int(round(x)), int(round(y))] for x, y in list(p.exterior.coords)[:-1]]


def kousky(g, min_a=150):
    gs = [g] if g.geom_type == "Polygon" else list(getattr(g, "geoms", []))
    return [body(p.simplify(1.2)) for p in gs if p.geom_type == "Polygon" and p.area >= min_a]


def chaikin(pts, n=2):
    for _ in range(n):
        o = [pts[0]]
        for a, b in zip(pts[:-1], pts[1:]):
            o += [(.75 * a[0] + .25 * b[0], .75 * a[1] + .25 * b[1]), (.25 * a[0] + .75 * b[0], .25 * a[1] + .75 * b[1])]
        pts = o + [pts[-1]]
    return pts


def lore(svet):
    Z = json.loads((T / "svet_lore.json").read_text(encoding="utf-8"))
    mista = json.loads((R / "11_Mapy/mista.json").read_text(encoding="utf-8"))["mista"]
    vod = json.loads((R / "11_Mapy/vodstvo.json").read_text(encoding="utf-8"))
    W, H = svet["sirka"], svet["vyska"]
    pev = [Polygon(p["body"]).buffer(0) for p in svet["pevnina"] if p["typ"] == "pevnina" and len(p["body"]) > 2]
    jez = [Polygon(p["body"]).buffer(0) for p in svet["pevnina"] if p["typ"] != "pevnina" and len(p["body"]) > 2]
    land = unary_union(pev).difference(unary_union(jez)) if jez else unary_union(pev)
    rng = np.random.default_rng(11)
    ob = svet["oblasti"]

    for o in Z["oblasti"]:
        for b in kousky(Polygon(o["body"]).buffer(0).intersection(land)):
            ob.append({"typ": o["typ"], "pozn": o["pozn"] + " (lore, návrh)", "zdroj": o["zdroj"], "body": b})

    mz = Polygon(Z["mrtva_zeme"]["body"]).segmentize(12)
    ex = np.array(mz.exterior.coords)[:-1]
    nz = np.convolve(np.r_[rng.normal(0, 1, len(ex)), rng.normal(0, 1, 6)], np.ones(5) / 5, "same")[:len(ex)] * 26
    c0 = ex.mean(0); dv = ex - c0; dv /= np.linalg.norm(dv, axis=1)[:, None]
    mz = Polygon(ex + dv * nz[:, None]).buffer(0)
    for o in ob:
        if o["typ"] in ("les", "haj", "louky") and len(o["body"]) > 2 and mz.contains(Polygon(o["body"]).buffer(0).representative_point()):
            o["typ"] = "mrtvy"
            o["pozn"] = Z["mrtva_zeme"]["pozn"] + " (lore)"
    for b in kousky(mz.intersection(land), 500):
        ob.append({"typ": "mrtva_zeme", "pozn": Z["mrtva_zeme"]["pozn"] + " (lore)", "zdroj": Z["mrtva_zeme"]["zdroj"], "body": b})

    def v_oblasti(x, y, typy):
        p = Point(x, y)
        return any(o["typ"] in typy and len(o["body"]) > 2 and Polygon(o["body"]).buffer(0).contains(p) for o in ob)

    zeme = [m for m in mista if m["typ"] == "zeme"]
    sidla = [m for m in mista if m["typ"] in ("sidlo", "mesto") and m.get("nazev") != "Nové místo"]
    for s in sidla:
        z = min(zeme, key=lambda q: (q["x"] - s["x"]) ** 2 + (q["y"] - s["y"]) ** 2)["nazev"]
        if z not in Z["pole_zeme"] or mz.contains(Point(s["x"], s["y"])):
            continue
        for _ in range(2):
            a = rng.uniform(0, 2 * np.pi); d = rng.uniform(16, 28)
            cx, cy = s["x"] + np.cos(a) * d, s["y"] + np.sin(a) * d * .7
            if v_oblasti(cx, cy, {"hory", "velehory", "les", "haj", "dzungle", "poust", "ledovec"}):
                continue
            r = rng.uniform(11, 19)
            poly = Polygon([(cx + np.cos(t) * r * rng.uniform(.75, 1.2), cy + np.sin(t) * r * .75 * rng.uniform(.75, 1.2)) for t in np.linspace(0, 2 * np.pi, 9)[:-1]])
            for b in kousky(poly.buffer(0).intersection(land), 120):
                ob.append({"typ": "pole", "pozn": f"pole u sídla ({z}) – lore: úrodné kraje (návrh)", "body": b})

    sym = svet["symboly"]
    for s in Z["symboly"]:
        sym.append({k: s[k] for k in ("typ", "x", "y", "m")} | {"pozn": s["pozn"] + " (lore)"})
    kop = next((s for s in sym if s["typ"] == "kopar"), None)
    if kop:
        n = 0
        for a in np.linspace(0, 2 * np.pi, 14)[:-1]:
            x, y = kop["x"] + np.cos(a) * 58, kop["y"] - 12 + np.sin(a) * 40
            if not land.buffer(4).contains(Point(x, y)) and n < 6:
                sym.append({"typ": "zricenina", "x": int(x), "y": int(y), "m": .42, "pozn": "věže starého Kop Aramu čnějící z hladiny (lore)"}); n += 1
    coast = land.boundary
    vybrane = []
    for x, y in [(130, 120), (215, 300), (470, 200), (360, 420)]:
        p = coast.interpolate(coast.project(Point(x, y)))
        q = Point(p.x + (x - p.x) * .0, p.y)
        for k in range(1, 6):
            c = Point(p.x + (240 - p.x) * .02 * k, p.y + (260 - p.y) * .02 * k)
            if land.contains(c):
                q = c; break
        if all(abs(q.x - a) + abs(q.y - b) > 60 for a, b in vybrane):
            vybrane.append((q.x, q.y))
            sym.append({"typ": "strazni_vez", "x": int(q.x), "y": int(q.y), "m": .8, "pozn": "opuštěná císařská strážní věž na pobřeží Divokého Severu (lore)"})

    # obchodní cesty
    k = 4
    w, h = W // k, H // k
    m = np.zeros((h, w), np.uint8)
    for p in svet["pevnina"]:
        cv2.fillPoly(m, [np.int32(np.array(p["body"]) / k)], 1 if p["typ"] == "pevnina" else 0)
    cost = np.where(m > 0, 1.0, np.inf)
    for typ, c in {"les": 2.2, "haj": 2.2, "mrtvy": 3, "dzungle": 4, "poust": 2.2, "bazina": 5, "hory": 7, "velehory": 25, "ledovec": 25}.items():
        mm = np.zeros((h, w), np.uint8)
        for o in ob:
            if o["typ"] == typ:
                cv2.fillPoly(mm, [np.int32(np.array(o["body"]) / k)], 1)
        cost = np.where((mm > 0) & np.isfinite(cost), c, cost)
    mm = np.zeros((h, w), np.uint8); cv2.fillPoly(mm, [np.int32(np.array(Z["mrtva_zeme"]["body"]) / k)], 1)
    cost = np.where((mm > 0) & np.isfinite(cost), cost * Z["uzavrena_zeme_cena"], cost)
    for b in vod.get("mosty", []):
        mm = np.zeros((h, w), np.uint8); cv2.polylines(mm, [np.int32(np.array(b["body"]) / k)], False, 1, 2)
        cost = np.where(mm > 0, 1.0, cost)
        svet["cesty"].append({"typ": "most", "pozn": "Most Kop Aramu (DM)", "body": b["body"]})
    uzly = []
    for s in sidla:
        uzly.append((s["x"], s["y"], s["typ"] == "mesto"))
    for s in sym:
        if s["typ"] in VELKA:
            uzly.append((s["x"], s["y"], True))
    u2 = []
    for x, y, v in uzly:
        j = next((i for i, q in enumerate(u2) if abs(q[0] - x) + abs(q[1] - y) < 22), None)
        if j is None:
            u2.append([x, y, v])
        else:
            u2[j][2] = u2[j][2] or v
    uzly = [u for u in u2 if 0 <= u[1] // k < h and 0 <= u[0] // k < w and np.isfinite(cost[int(u[1] // k), int(u[0] // k)])]
    pts = np.array([[u[0], u[1]] for u in uzly], float)
    hrany = set()
    for t in Delaunay(pts).simplices:
        for a, b in ((t[0], t[1]), (t[1], t[2]), (t[0], t[2])):
            if np.hypot(*(pts[a] - pts[b])) < 330:
                hrany.add((min(a, b), max(a, b)))
    cesty, cena = {}, {}
    mcp_cost = np.where(np.isfinite(cost), cost, 1e9)
    for a in range(len(uzly)):
        nb = [b for x, b in hrany if x == a]
        if not nb:
            continue
        mcp = MCP_Geometric(mcp_cost)
        cc, _ = mcp.find_costs([(int(pts[a][1] // k), int(pts[a][0] // k))])
        for b in nb:
            end = (int(pts[b][1] // k), int(pts[b][0] // k))
            if cc[end] >= 1e8:
                continue
            cesty[(a, b)] = mcp.traceback(end); cena[(a, b)] = cc[end]
    n = len(uzly)
    G = np.zeros((n, n))
    for (a, b), c in cena.items():
        G[a, b] = c
    mst = minimum_spanning_tree(csr_matrix(G)).tocoo()
    vyber = {(min(a, b), max(a, b)) for a, b in zip(mst.row, mst.col)}
    for (a, b), c in cena.items():
        if uzly[a][2] and uzly[b][2] and c < 1.35 * np.hypot(*(pts[a] - pts[b])) / k:
            vyber.add((a, b))
    for a, b in sorted(vyber):
        tr = cesty.get((a, b))
        if not tr or len(tr) < 3:
            continue
        c = np.array([[x * k + k / 2, y * k + k / 2] for y, x in tr], np.float32).reshape(-1, 1, 2)
        c = cv2.approxPolyDP(c, 3.5, False).reshape(-1, 2).tolist()
        c = [pts[a].tolist()] + c[1:-1] + [pts[b].tolist()]
        hl = uzly[a][2] and uzly[b][2]
        svet["cesty"].append({"typ": "cesta" if hl else "stezka", "pozn": "obchodní cesta (lore: Briria protkaná obchodními cestami; trasa vypočtená, návrh)",
                              "body": [[round(x), round(y)] for x, y in chaikin([tuple(p) for p in c])]})
    return svet
