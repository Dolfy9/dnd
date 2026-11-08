"""Doplnění atlasu (svet.json) o prvky z loru: oblasti, mrtvá země, pole u sídel, strážní věže, potopené věže Kop Aramu a obchodní cesty."""
import json
import math
from pathlib import Path

import cv2
import numpy as np
from scipy.sparse import csr_matrix
from scipy.sparse.csgraph import minimum_spanning_tree
from scipy.spatial import Delaunay
from shapely.geometry import LineString, Point, Polygon
from shapely.ops import linemerge, nearest_points, unary_union
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


def geoms(g):
    return list(g.geoms) if hasattr(g, "geoms") else [g]


def irregular(g, seed, amplitude, spacing=7):
    out = []
    for p in geoms(g):
        if p.geom_type != "Polygon" or p.area < 20:
            continue
        line = LineString(p.exterior.coords)
        length = line.length
        points = []
        for d in np.arange(0, length, spacing):
            q = line.interpolate(d)
            a = line.interpolate((d - 2) % length)
            b = line.interpolate((d + 2) % length)
            tangent = np.array([b.x - a.x, b.y - a.y], dtype=float)
            tangent /= np.linalg.norm(tangent) + 1e-9
            normal = np.array([-tangent[1], tangent[0]])
            offset = amplitude * (
                .48 * math.sin(d * .16 + seed * .01)
                + .30 * math.sin(d * .31 + seed * .023)
                + .22 * math.sin(d * .062 + seed * .04)
            )
            points.append((q.x + normal[0] * offset, q.y + normal[1] * offset))
        shaped = Polygon(points).buffer(0)
        out.extend(x for x in geoms(shaped) if x.geom_type == "Polygon" and x.area > 20)
    return unary_union(out) if out else g


def staty(svet, land, ob, mista, k=4):
    """Území států: cenová vzdálenost od popisku země (hory a moře jsou přirozené hranice)."""
    W, H = svet["sirka"], svet["vyska"]
    w, h = W // k, H // k
    m = np.zeros((h, w), np.uint8)
    for p in svet["pevnina"]:
        cv2.fillPoly(m, [np.int32(np.array(p["body"]) / k)], 1 if p["typ"] == "pevnina" else 0)
    cost = np.where(m > 0, 1.0, 25.0)
    for typ, c in {"hory": 6, "velehory": 12}.items():
        mm = np.zeros((h, w), np.uint8)
        for o in ob:
            if o["typ"] == typ:
                cv2.fillPoly(mm, [np.int32(np.array(o["body"]) / k)], 1)
        cost = np.where((mm > 0) & (m > 0), c, cost)
    nz = cv2.GaussianBlur(np.random.default_rng(3).random((h, w)).astype(np.float32), (0, 0), 5)
    nz = (nz - nz.min()) / (nz.max() - nz.min() + 1e-9)
    cost = cost * (1 + 1.6 * nz)
    seeds = [x for x in mista if x["typ"] == "zeme"] + [x for x in mista if x["nazev"] in ("Divoký Sever", "Dräar")]
    ys, xs = np.nonzero(m)
    C = []
    for sd in seeds:
        r, c = min(int(sd["y"] // k), h - 1), min(int(sd["x"] // k), w - 1)
        if m[r, c] == 0:
            i = np.argmin((ys - r) ** 2 + (xs - c) ** 2); r, c = ys[i], xs[i]
        cc, _ = MCP_Geometric(cost).find_costs([(r, c)])
        C.append(cc)
    lab = np.argmin(np.stack(C), 0)
    lab = np.argmax(np.stack([cv2.GaussianBlur((lab == i).astype(np.float32), (0, 0), 2.5) for i in range(len(seeds))]), 0)
    out = []
    for i, sd in enumerate(seeds):
        mm = ((lab == i) & (m > 0)).astype(np.uint8)
        cs, _ = cv2.findContours(mm, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
        polys = []
        for c in cs:
            if cv2.contourArea(c) < 20:
                continue
            c = cv2.approxPolyDP(c, 1.0, True).reshape(-1, 2) * k + k / 2
            if len(c) < 3:
                continue
            p = Polygon(chaikin([tuple(q) for q in c] + [tuple(c[0])], 2)).buffer(0).intersection(land)
            polys += [g for g in geoms(p) if g.geom_type == "Polygon" and g.area > 300]
        if polys:
            out.append({"nazev": sd["nazev"], "polys": polys, "divoke": sd["typ"] != "zeme"})
    return out


def meandr(pts, amp, rng, krok=6):
    L = LineString(pts)
    if L.length < 2 * krok:
        return [list(p) for p in pts]
    d = np.arange(0, L.length, krok)
    P = np.array([L.interpolate(x).coords[0] for x in d] + [pts[-1]])
    t = np.gradient(P, axis=0); t /= np.linalg.norm(t, axis=1)[:, None] + 1e-9
    nrm = np.c_[-t[:, 1], t[:, 0]]
    nz = np.convolve(rng.normal(0, 1, len(P) + 8), np.ones(7) / 7, "same")[4:4 + len(P)] * amp
    nz[0] = nz[-1] = 0
    return (P + nrm * nz[:, None]).tolist()


def hydro(svet, land, ob, seeds, rng, k=2):
    W, H = svet["sirka"], svet["vyska"]
    w, h = W // k, H // k
    m = np.zeros((h, w), np.uint8)
    for p in svet["pevnina"]:
        cv2.fillPoly(m, [np.int32(np.array(p["body"]) / k)], 1 if p["typ"] == "pevnina" else 0)
    hm = np.zeros((h, w), np.float32)
    for o in ob:
        if o["typ"] in ("hory", "velehory", "kopce") and len(o["body"]) > 2:
            cv2.fillPoly(hm, [np.int32(np.array(o["body"]) / k)], 1.0)
    hb = cv2.GaussianBlur(hm, (0, 0), 6)
    nz = cv2.GaussianBlur(rng.random((h, w)).astype(np.float32), (0, 0), 4)
    cost = np.where(m > 0, 1 + 8 * hb + 3 * nz, 1.0)
    voda = (m == 0) & (cv2.dilate(m, np.ones((3, 3), np.uint8)) > 0)
    mcp = MCP_Geometric(cost)
    C, _ = mcp.find_costs(list(zip(*np.nonzero(voda))))
    hy, hx = np.nonzero(hm > 0)
    drawn = np.zeros((h, w), np.uint8)
    out = []
    def rc(p):
        return min(max(int(p[1] / k), 0), h - 1), min(max(int(p[0] / k), 0), w - 1)
    for sd in sorted(seeds, key=lambda r: -LineString(r["body"]).length):
        pts = [list(map(float, p)) for p in sd["body"]]
        if C[rc(pts[0])] < C[rc(pts[-1])]:
            pts = pts[::-1]
        # pramen: nejbližší hory/kopce do 140 px proti proudu
        up = []
        if len(hy):
            r0, c0 = rc(pts[0]); d2 = (hy - r0) ** 2 + (hx - c0) ** 2; i = int(np.argmin(d2))
            q = [float(hx[i] * k), float(hy[i] * k)]
            u = np.subtract(pts[0], pts[min(2, len(pts) - 1)]); v = np.subtract(q, pts[0])
            if d2[i] * k * k < 140 ** 2 and d2[i] > 9 and np.dot(u, v) > .35 * np.linalg.norm(u) * np.linalg.norm(v):
                up = meandr([q, pts[0]], 5, rng)[:-1]
        # ústí: cesta po spádu k vodě, končí v moři/jezeře nebo v jiné řece
        down = []
        for r, c in mcp.traceback(rc(pts[-1]))[::-1][1:]:
            down.append([c * k + k / 2, r * k + k / 2])
            if drawn[r, c] or m[r, c] == 0:
                print("  řeka", sd.get("pozn", "")[:30], "ústí", "do řeky" if drawn[r, c] else "do vody", (c * k, r * k), len(down))
                break
        pts = meandr(pts, 2.5, rng, 5)
        if down:
            down = meandr([pts[-1]] + down[::3] + [down[-1]], 4, rng)[1:]
        full = up + pts + down
        full = chaikin([tuple(p) for p in full], 2)
        Lf = LineString(full).simplify(.7)
        if Lf.length < 40:
            continue
        cv2.polylines(drawn, [np.int32(np.array(Lf.coords) / k)], False, 1, 2)
        out.append({"typ": "reka", "pozn": sd.get("pozn", "") + " – pramen a ústí dopočteny", "body": [[round(x), round(y)] for x, y in Lf.coords]})
    return out


def lore(svet):
    K = json.loads((Path(__file__).with_name("svet_kresba.json")).read_text(encoding="utf-8"))
    Z = json.loads((T / "svet_lore.json").read_text(encoding="utf-8"))
    mista = json.loads((R / "11_Mapy/mista.json").read_text(encoding="utf-8"))["mista"]
    vod = json.loads((R / "11_Mapy/vodstvo.json").read_text(encoding="utf-8"))
    W, H = svet["sirka"], svet["vyska"]
    pev = [Polygon(p["body"]).buffer(0) for p in svet["pevnina"] if p["typ"] == "pevnina" and len(p["body"]) > 2]
    jez = [Polygon(p["body"]).buffer(0) for p in svet["pevnina"] if p["typ"] != "pevnina" and len(p["body"]) > 2]
    land = unary_union(pev).difference(unary_union(jez)) if jez else unary_union(pev)
    rng = np.random.default_rng(11)
    ob = svet["oblasti"]
    clipped = []
    for o in ob:
        if o["typ"] not in ("poust", "ledovec"):
            clipped.append(o)
            continue
        for b in kousky(Polygon(o["body"]).buffer(0).intersection(land)):
            clipped.append(o | {"body": b})
    ob[:] = clipped

    for o in Z["oblasti"]:
        for b in kousky(Polygon(o["body"]).buffer(0).intersection(land)):
            ob.append(o | {"pozn": o["pozn"] + " (lore, návrh)", "body": b})

    for v in K.get("vyrezat", []):
        vyrez = Polygon(v["body"]).buffer(0)
        typy = set(v["typy"])
        ob2 = []
        for o in ob:
            if o["typ"] not in typy:
                ob2.append(o)
                continue
            for b in kousky(Polygon(o["body"]).buffer(0).difference(vyrez), 150):
                ob2.append(o | {"body": b})
        ob[:] = ob2

    for o in K.get("oblasti", []):
        for b in kousky(Polygon(o["body"]).buffer(0).intersection(land)):
            ob.append(o | {"body": b})

    ridges = unary_union([Polygon(o["body"]).buffer(0) for o in ob if o["typ"] in ("hory", "velehory") and len(o["body"]) > 2])
    reshaped = []
    hinai_main = None
    for i, o in enumerate(ob):
        if o["typ"] not in ("les", "haj", "dzungle", "mrtvy", "mrtva_zeme") or len(o["body"]) < 3:
            reshaped.append(o)
            continue
        poly = Polygon(o["body"]).buffer(0)
        note = o.get("pozn", "")
        named_jungle = "Hinai Mihi" in note or ("Mönohen" in note and o["typ"] in ("haj", "dzungle"))
        amp = 12 if named_jungle else 3.5
        center = poly.centroid
        seed = round(center.x * 13 + center.y * 17 + i * 7919)
        shaped = irregular(poly, seed, amp).intersection(land)
        if named_jungle:
            shaped = shaped.difference(ridges.buffer(4))
            if "Hinai Mihi" in note:
                hinai_main = shaped
        for b in kousky(shaped, 45):
            reshaped.append(o | {"body": b})
    ob[:] = reshaped
    if hinai_main and not hinai_main.is_empty:
        center = hinai_main.centroid
        for i, (dx, dy, radius) in enumerate(((-78, 12, 10), (72, -38, 9), (58, 61, 8), (-44, 75, 8))):
            grove = irregular(Point(center.x + dx, center.y + dy).buffer(radius, resolution=8), 1301 + i * 271, 3)
            grove = grove.difference(hinai_main.buffer(6)).intersection(land).difference(ridges.buffer(4))
            for b in kousky(grove, 45):
                ob.append({"typ": "dzungle", "tmavy": True, "hustota": 1.2, "pozn": "Hinai Mihi – odlehlý háj (návrh)", "body": b})

    for o in ob:
        if o["typ"] == "hory" and len(o["body"]) > 2 and Polygon(o["body"]).buffer(0).centroid.y < 480:
            o["typ"] = "velehory"
    st = staty(svet, land, ob, mista)
    uzemi = {}
    vychodni_uzemi = {}
    neprirazene = []
    for u in K.get("uzemi", []):
        if u.get("stat", "stat") is None:
            g = Polygon(u["body"]).buffer(0)
            if g.area > 0:
                neprirazene.append(g)
            continue
        if not any(z["nazev"] == u["nazev"] for z in st):
            continue
        g = Polygon(u["body"]).buffer(0).intersection(land)
        if g.area > 0:
            target = vychodni_uzemi if u.get("pozn", "").startswith("východní hranice DM:") else uzemi
            target[u["nazev"]] = unary_union([target[u["nazev"]], g]) if u["nazev"] in target else g
    if uzemi:
        vyhra = unary_union(list(uzemi.values()))
        for z in st:
            g = unary_union(z["polys"]).difference(vyhra)
            if z["nazev"] in uzemi:
                g = unary_union([g, uzemi[z["nazev"]]])
            z["polys"] = [p for p in geoms(g) if p.geom_type == "Polygon" and p.area > 1]
    for z in st:
        if z["nazev"] in vychodni_uzemi:
            g = unary_union([unary_union(z["polys"]), vychodni_uzemi[z["nazev"]]])
            z["polys"] = [p for p in geoms(g) if p.geom_type == "Polygon" and p.area > 1]
    kn = next((z for z in st if z["nazev"].startswith("Knärghe")), None)
    kn_region = unary_union([
        Polygon(body(p.simplify(1.5))).buffer(0) for p in kn["polys"] if p.area > 3000
    ]) if kn else Polygon(Z["mrtva_zeme"]["body"])
    mz = irregular(kn_region, 6421, 14, spacing=5).intersection(kn_region.buffer(-2)).intersection(land)
    ob[:] = [o for o in ob if not (
        o["typ"] == "mrtva_zeme" and len(o["body"]) > 2
        and Polygon(o["body"]).buffer(0).intersection(mz).area > 1
    )]
    ob2 = []
    for o in ob:
        if o["typ"] != "poust":
            ob2.append(o)
            continue
        for b in kousky(Polygon(o["body"]).buffer(0).difference(mz.buffer(2)), 60):
            ob2.append(o | {"body": b})
    ob[:] = ob2
    ob3 = []
    for i, o in enumerate(ob):
        if o["typ"] in ("ledovec", "velehory") and len(o["body"]) >= 3:
            amp = 7 if o["typ"] == "ledovec" else 3
            shaped = irregular(Polygon(o["body"]).buffer(0), 42001 + i * 271, amp, spacing=6).intersection(land)
            for b in kousky(shaped, 45 if o["typ"] == "ledovec" else 100):
                ob3.append(o | {"body": b})
            continue
        if o["typ"] not in ("les", "haj", "dzungle", "mrtvy") or len(o["body"]) < 3:
            ob3.append(o)
            continue
        amp = 12 if "Hinai Mihi" in o.get("pozn", "") or "Mönohen" in o.get("pozn", "") else 8
        p = irregular(Polygon(o["body"]).buffer(0), 31001 + i * 271, amp)
        for b in kousky(p, 45):
            ob3.append(o | {"body": b})
    ob[:] = ob3
    svet["zeme"] = [{"nazev": z["nazev"], "body": [body(p.simplify(1.5)) for p in z["polys"] if p.area > 3000], "pozn": "území státu vypočtené z popisků a terénu (návrh)"}
                    | ({"barva": "#1e1614"} if z is kn else {"barva": "#6b6b6b"} if z["divoke"] else {}) for z in st]
    for geom in neprirazene:
        for p in geoms(geom):
            if p.geom_type == "Polygon" and p.area > 1000:
                svet["zeme"].append({
                    "nazev": "Nepřiřazené území", "stat": None,
                    "barva": "#838b8f", "pozn": "nepřiřazeno – čeká na DM",
                    "body": [body(p.simplify(1.5))],
                })
    cb = land.boundary.buffer(7)
    for z, zz in zip(st, svet["zeme"]):
        U = unary_union(z["polys"])
        zz["pas"] = [[body(p.simplify(1.2))] + [[[round(x), round(y)] for x, y in r.coords[:-1]] for r in p.interiors]
                     for p in geoms(U.difference(U.buffer(-7)).difference(land.boundary.buffer(3))) if p.geom_type == "Polygon" and p.area >= 40]
    for i in range(len(st)):
        A = unary_union(st[i]["polys"])
        for j in range(i + 1, len(st)):
            B = unary_union(st[j]["polys"])
            if not A.buffer(6).intersects(B):
                continue
            seg = A.boundary.intersection(B.buffer(6)).difference(cb)
            seg = linemerge([g for g in geoms(seg) if g.geom_type == "LineString"]) if seg.geom_type != "LineString" else seg
            for g in geoms(seg):
                if g.geom_type == "LineString" and g.length > 25:
                    g = g.simplify(1.5)
                    svet["hranice"].append({"typ": "hranice", "pozn": f"hranice {st[i]['nazev']} / {st[j]['nazev']} (vypočtená, návrh)", "body": [[round(x), round(y)] for x, y in g.coords]})
                    if st[i] is kn or st[j] is kn:
                        for d in np.arange(10, g.length - 5, 34):
                            p = g.interpolate(d); q = nearest_points(mz.buffer(-6), p)[0] if mz.buffer(-6).area > 0 else p
                            svet["symboly"].append({"typ": "kul", "x": int(q.x), "y": int(q.y), "m": round(float(rng.uniform(.85, 1.15)), 2), "pozn": "kůly s lebkami na hranici Knärghe Zhie (DM)"})
    hranice_kresba = [h for h in K.get("hranice", []) if h.get("carkovana")]
    if hranice_kresba:
        svet["hranice"].extend(hranice_kresba)
    for o in ob:
        if o["typ"] in ("les", "haj", "louky") and len(o["body"]) > 2 and mz.contains(Polygon(o["body"]).buffer(0).representative_point()):
            o["typ"] = "mrtvy"
            o["pozn"] = Z["mrtva_zeme"]["pozn"] + " (lore)"
    for b in kousky(mz.intersection(land), 500):
        ob.append({"typ": "mrtva_zeme", "pozn": Z["mrtva_zeme"]["pozn"] + " (lore)", "zdroj": Z["mrtva_zeme"]["zdroj"], "body": b})

    def v_oblasti(x, y, typy):
        p = Point(x, y)
        return any(o["typ"] in typy and len(o["body"]) > 2 and Polygon(o["body"]).buffer(0).contains(p) for o in ob)

    snih = unary_union([Polygon(o["body"]).buffer(0) for o in ob if o["typ"] in ("ledovec", "velehory") and len(o["body"]) > 2]).buffer(24)
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
            if poly.intersects(snih):
                continue
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

    # kopce: podhůří kolem pohoří a hornatý Laertmund
    hor = unary_union([Polygon(o["body"]).buffer(0) for o in ob if o["typ"] in ("hory", "velehory") and len(o["body"]) > 2])
    jine = unary_union([Polygon(o["body"]).buffer(0) for o in ob if o["typ"] in ("les", "haj", "dzungle", "poust", "ledovec", "mrtvy", "bazina") and len(o["body"]) > 2])
    lae = next((Point(x["x"], x["y"]).buffer(110) for x in mista if x["nazev"] == "Laertmund"), Polygon())
    kop = hor.buffer(34).difference(hor.buffer(3)).union(lae.difference(hor)).difference(jine).difference(mz)
    for v in K.get("vyrezat", []):
        if "kopce" in v["typy"]:
            kop = kop.difference(Polygon(v["body"]).buffer(0))
    podhuri = unary_union([
        Polygon(o["body"]).buffer(o["podhuri"]).difference(Polygon(o["body"]).buffer(3))
        for o in ob if o["typ"] in ("hory", "velehory") and o.get("podhuri")
    ])
    kop = kop.union(podhuri).difference(jine).difference(mz).intersection(land.buffer(-8))
    for b in kousky(kop, 400):
        ob.append({"typ": "kopce", "pozn": "podhůří / pahorkatina (lore: hornatý Laertmund; podhůří pohoří)", "body": b})
    # řeky: obkreslené úseky z kresby + ruční, prodloužené k prameni a ústí (hydrologicky)
    seeds = [{"typ": "reka", "pozn": r["nazev"], "body": r["body"]} for r in K["reky"]] + [r for r in svet["reky"] if "DM" in r.get("pozn", "") and not r.get("pozn", "").startswith("řeka u Nöetu")]
    svet["reky"] = hydro(svet, land, ob, seeds, rng)
    for hb in K.get("hradby", []):
        svet.setdefault("hradby", []).append({"typ": "hradba", "pozn": hb["nazev"], "body": hb["body"]})
        line = LineString(hb["body"])
        for d in np.arange(0, line.length, 18):
            p = line.interpolate(d)
            a, b = line.interpolate(max(0, d - 1)), line.interpolate(min(line.length, d + 1))
            angle = math.degrees(math.atan2(b.y - a.y, b.x - a.x))
            if abs(angle) > 90:
                angle += -180 if angle > 0 else 180
            angle = max(-45, min(45, angle))
            svet["symboly"].append({"typ": "hradba", "x": int(p.x), "y": int(p.y), "m": 1.0, "rot": angle})
    for ut in K.get("utesy", []):
        svet.setdefault("utesy", []).append({"typ": "utes", "pozn": ut["nazev"], "body": ut["body"]})
        line = LineString(ut["body"])
        for d in np.arange(0, line.length, 15):
            p = line.interpolate(d)
            a, b = line.interpolate(max(0, d - 1)), line.interpolate(min(line.length, d + 1))
            angle = math.degrees(math.atan2(b.y - a.y, b.x - a.x))
            if abs(angle) > 90:
                angle += -180 if angle > 0 else 180
            angle = max(-50, min(50, angle))
            svet["symboly"].append({"typ": "utes_velky", "x": int(p.x), "y": int(p.y), "m": float(rng.uniform(.9, 1.1)), "rot": angle})
    svet["symboly"] += K.get("pevnosti", [])
    # nic nepřetéká do moře: oblasti oříznout podle souše
    le = land.buffer(-7)
    ob2 = []
    for o in ob:
        if len(o["body"]) < 3:
            continue
        for b in kousky(Polygon(o["body"]).buffer(0).intersection(le if o["typ"] != "pole" else land), 60):
            ob2.append(o | {"body": b})
    ob[:] = ob2
    svet["oblasti"] = ob
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
    mm = np.zeros((h, w), np.uint8)
    for g in geoms(mz):
        cv2.fillPoly(mm, [np.int32(np.array(g.exterior.coords) / k)], 1)
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
    svet["cesty"] += K.get("cesty", [])
    for area in svet.get("oblasti", []):
        coordinates = area.get("body", [])
        if len(coordinates) < 4:
            continue
        poly = Polygon(coordinates)
        if not poly.is_valid:
            poly = poly.buffer(0)
        if poly.area <= 3000 or poly.length <= 0 or 4 * math.pi * poly.area / poly.length ** 2 <= .8:
            continue
        ring = poly.exterior
        n = max(72, int(ring.length / 8))
        phase = sum(ord(c) for c in area.get("pozn", "")) * .017
        amplitude = 5
        points = []
        for i in range(n):
            d = ring.length * i / n
            p0, p1, p2 = (ring.interpolate((d + off) % ring.length) for off in (-2, 2, 0))
            tx, ty = p1.x - p0.x, p1.y - p0.y
            length = max(1e-6, math.hypot(tx, ty))
            t = i / n
            wave = math.sin(t * math.tau * 11 + phase) + .35 * math.sin(t * math.tau * 17 + phase * 1.7)
            points.append((p2.x - ty / length * wave * amplitude, p2.y + tx / length * wave * amplitude))
        candidate = Polygon(points)
        if candidate.is_valid and candidate.area > poly.area * .72 and candidate.area < poly.area * 1.3:
            area["body"] = [[round(x, 1), round(y, 1)] for x, y in candidate.exterior.coords[:-1]]
    return svet
