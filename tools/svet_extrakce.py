#!/usr/bin/env python3
"""Úvodní data vektorové mapy 11_Mapy/svet.json (souřadnice px vyrovnané kresby 2048×1440).

Zdroje: maska vody z kresby DM (tools/mapa.py + vodstvo.json), barvy ilustrované mapy
(11_Mapy/zdroje/Montelien_ilustrace_podklad.jpg) pro oblasti a řeky, symboly z Analyza_mapy.md.
Spouští se jednou; dál se mapa upravuje v editoru na webu. Existující svet.json bez --prepsat nepřepíše.
"""
import json, sys
from pathlib import Path
import cv2
import numpy as np
from skimage.morphology import skeletonize
from shapely.geometry import Polygon
sys.path.insert(0, str(Path(__file__).parent))
import mapa

OUT = mapa.MAPY / "svet.json"
W, H = mapa.W, mapa.H
ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "web/assets/svet"
PALETA = json.loads((ASSETS / "paleta.json").read_text(encoding="utf-8"))


def poly(c, eps):
    a = cv2.approxPolyDP(c, eps, True).reshape(-1, 2)
    return [[int(x), int(y)] for x, y in a]


def shapes(mask, eps, min_area, typ_even, typ_odd=None):
    cs, hier = cv2.findContours(mask.astype(np.uint8), cv2.RETR_TREE, cv2.CHAIN_APPROX_NONE)
    out = []
    if hier is None:
        return out
    hier = hier[0]
    for i, c in enumerate(cs):
        if cv2.contourArea(c) < min_area:
            continue
        d, p = 0, hier[i][3]
        while p >= 0:
            d, p = d + 1, hier[p][3]
        typ = typ_even if d % 2 == 0 else typ_odd
        if typ is None:
            continue
        b = poly(c, eps)
        if len(b) >= 3:
            out.append({"typ": typ, "uroven": d, "body": b})
    out.sort(key=lambda s: s["uroven"])
    return out


def roughen_coasts(items):
    originals = [Polygon(p["body"]).buffer(0) for p in items]
    result = []
    for i, item in enumerate(items):
        points = np.asarray(item["body"], dtype=float)
        lengths = np.linalg.norm(np.roll(points, -1, axis=0) - points, axis=1)
        perimeter = lengths.sum()
        if not perimeter or not np.any(lengths > 30):
            result.append(item)
            continue
        rng = np.random.default_rng(7103 + i * 7919)
        phases = rng.uniform(0, 2 * np.pi, 3)
        samples = []
        travelled = 0.0
        for j, length in enumerate(lengths):
            a, b = points[j], points[(j + 1) % len(points)]
            if length <= 0:
                samples.append((a, np.zeros(2), 0.0))
                continue
            steps = max(1, int(np.ceil(length / 24))) if length > 30 else 1
            tangent = (b - a) / length
            normal = np.array([-tangent[1], tangent[0]])
            for k in range(steps):
                t = k / steps
                p = a + (b - a) * t
                offset = 0.0
                if length > 30 and k:
                    u = (travelled + t * length) / perimeter
                    noise = (.55 * np.sin(2 * np.pi * 7 * u + phases[0])
                             + .3 * np.sin(2 * np.pi * 15 * u + phases[1])
                             + .15 * np.sin(2 * np.pi * 29 * u + phases[2]))
                    offset = np.clip(length * .08, 2, 6) * noise
                samples.append((p, normal, offset))
            travelled += length
        original = originals[i]
        accepted = None
        for amplitude_scale in (1, .65, .4, .2, 0):
            candidate = np.asarray([p + normal * offset * amplitude_scale for p, normal, offset in samples])
            poly = Polygon(candidate)
            if not poly.is_valid or poly.area < original.area * .75:
                continue
            crossed = False
            for k, other in enumerate(originals):
                if i == k or original.within(other) or other.within(original):
                    continue
                if poly.intersection(other).area > original.intersection(other).area + 1:
                    crossed = True
                    break
            if not crossed:
                accepted = candidate
                break
        result.append(item | {"body": [[round(float(x)), round(float(y))] for x, y in accepted]} if accepted is not None else item)
    return result


def trace(sk, min_len):
    """Skeleton → lomené čáry (jednoduché trasování po sousedech)."""
    sk = sk.copy().astype(np.uint8)
    ys, xs = np.nonzero(sk)
    nb = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]
    def deg(y, x):
        return sum(sk[y + dy, x + dx] for dy, dx in nb if 0 <= y + dy < sk.shape[0] and 0 <= x + dx < sk.shape[1])
    ends = [(y, x) for y, x in zip(ys, xs) if deg(y, x) == 1]
    lines = []
    for start in ends + list(zip(ys, xs)):
        y, x = start
        if not sk[y, x]:
            continue
        pts = [(x, y)]
        sk[y, x] = 0
        while True:
            nxt = [(y + dy, x + dx) for dy, dx in nb if 0 <= y + dy < sk.shape[0] and 0 <= x + dx < sk.shape[1] and sk[y + dy, x + dx]]
            if not nxt:
                break
            y, x = nxt[0]
            sk[y, x] = 0
            pts.append((x, y))
        if len(pts) >= min_len:
            a = cv2.approxPolyDP(np.array(pts, np.int32).reshape(-1, 1, 2), 2.0, False).reshape(-1, 2)
            lines.append([[int(px), int(py)] for px, py in a])
    return lines


def barvy(data, out):
    """Barevný podklad terénu s plynulým klimatem a barevnými oblastmi."""
    w, h, k = 1024, 720, .5
    rng = np.random.default_rng(7)
    def sum_(s):
        n = cv2.GaussianBlur(rng.random((h, w)).astype(np.float32), (0, 0), s)
        return (n - n.mean()) / (n.std() + 1e-6)
    def rgb(v):
        return np.array([int(v[i:i + 2], 16) for i in (1, 3, 5)], dtype=np.float32)
    def smooth(x):
        x = np.clip(x, 0, 1)
        return x * x * (3 - 2 * x)
    yy = np.linspace(0, 1, h, dtype=np.float32)[:, None].repeat(w, 1)
    variation = PALETA["land"]["variation"]
    scales = [v * k for v in variation["noise_scales_px"]]
    noise = .5 * sum_(scales[0]) + .3 * sum_(scales[1]) + .2 * sum_(scales[2])
    t = np.clip(yy + noise * variation["climate_blend"], 0, 1)
    stops = [(0, "north_sage"), (.34, "meadow"), (.66, "grass"), (1, "olive")]
    img = np.stack([np.interp(t, [p[0] for p in stops], [rgb(PALETA["land"][p[1]])[c] for p in stops]) for c in range(3)], axis=2)
    img *= (1 + np.tanh(noise)[..., None] * variation["luminance"])
    img += sum_(42)[..., None] * np.array([3.2, 3.0, 2.2]) + sum_(8)[..., None] * np.array([1.2, 1.1, .8])
    snow_jitter = np.tanh(noise) * variation["snow_edge_noise_px"] / H
    snow_jitter += sum_(variation["snow_edge_noise_scale_px"] * k) * variation["snow_edge_noise_px"] * .25 / H
    snow_pos = yy + snow_jitter
    snow_t = smooth((snow_pos - PALETA["land"]["snow_start"]) / (PALETA["land"]["snow_end"] - PALETA["land"]["snow_start"]))
    snow = 1 - snow_t
    snow_shade = np.clip(.14 + sum_(34) * .025, .06, .23)
    snow_color = rgb(PALETA["land"]["snow"])[None, None, :] * (1 - snow_shade[..., None]) + rgb(PALETA["land"]["snow_shade"])[None, None, :] * snow_shade[..., None]
    img = img * (1 - snow[..., None]) + snow_color * snow[..., None]
    water = np.zeros((h, w), np.uint8)
    for lake in data.get("pevnina", []):
        if lake["typ"] == "jezero":
            cv2.fillPoly(water, [np.int32(np.array(lake["body"]) * k)], 255)
    for river in data.get("reky", []):
        if len(river["body"]) > 1:
            cv2.polylines(water, [np.int32(np.array(river["body"]) * k)], False, 255, 2, cv2.LINE_AA)
    water_distance = cv2.distanceTransform(cv2.bitwise_not(water), cv2.DIST_L2, 3) / k
    wet = (1 - smooth(water_distance / variation["wet_distance_px"])) * variation["wet_strength"]
    wet *= snow_t
    img = img * (1 - wet[..., None]) + rgb(PALETA["land"]["moss"]) * wet[..., None]
    hills = np.zeros((h, w), np.uint8)
    for area in data.get("oblasti", []):
        if area["typ"] in ("hory", "velehory", "kopce"):
            cv2.fillPoly(hills, [np.int32(np.array(area["body"]) * k)], 255)
    hill_distance = cv2.distanceTransform(cv2.bitwise_not(hills), cv2.DIST_L2, 3) / k
    dry = (1 - smooth(hill_distance / variation["foothill_distance_px"])) * variation["foothill_strength"]
    dry *= snow_t
    dry[hills > 0] = 0
    img = img * (1 - dry[..., None]) + rgb(PALETA["land"]["dry"]) * dry[..., None]
    for typ, color in PALETA["areas"].items():
        if typ == "tmavy":
            continue
        m = np.zeros((h, w), np.uint8)
        for o in data["oblasti"]:
            if o["typ"] == typ:
                cv2.fillPoly(m, [np.int32(np.array(o["body"]) * k)], 255)
        m = cv2.GaussianBlur(m.astype(np.float32) / 255, (0, 0), 7)[..., None] * PALETA["area_opacity"].get(typ, .3)
        img = img * (1 - m) + rgb(color) * m
    img = cv2.GaussianBlur(img, (0, 0), 1.5)
    cv2.imwrite(str(out), cv2.cvtColor(np.clip(img, 0, 255).astype(np.uint8), cv2.COLOR_RGB2BGR), [cv2.IMWRITE_JPEG_QUALITY, 90])


def hloubka(data, out):
    """Plnobarevný stínovaný podklad moře podle vzdálenosti od pobřeží."""
    land = np.zeros((H, W), np.uint8)
    lake = np.zeros((H, W), np.uint8)
    for s in sorted(data["pevnina"], key=lambda p: p.get("uroven", 0)):
        pts = np.int32([s["body"]])
        is_land = s["typ"] == "pevnina"
        cv2.fillPoly(land, pts, 255 if is_land else 0)
        cv2.fillPoly(lake, pts, 0 if is_land else 255)
    water = (land == 0).astype(np.uint8) * 255
    distance = cv2.distanceTransform(water, cv2.DIST_L2, 3)
    def rgb(v):
        return np.array([int(v[i:i + 2], 16) for i in (1, 3, 5)], dtype=np.float32)
    def smooth(x):
        x = np.clip(x, 0, 1)
        return x * x * (3 - 2 * x)
    sea = PALETA["sea"]
    coast, middle, deep = rgb(sea["coast"]), rgb(sea["open"]), rgb(sea["deep"])
    t1 = smooth((distance - sea["shallow_distance"]) / (sea["mid_distance"] - sea["shallow_distance"]))
    t2 = smooth((distance - sea["mid_distance"]) / (sea["deep_distance"] - sea["mid_distance"]))
    img = coast[None, None, :] * (1 - t1[..., None]) + middle[None, None, :] * t1[..., None]
    img = img * (1 - t2[..., None]) + deep[None, None, :] * t2[..., None]
    shallow = 1 - smooth(distance / sea["shallow_distance"])
    img = img * (1 - shallow[..., None] * .36) + rgb(sea["shallow"])[None, None, :] * (shallow[..., None] * .36)
    img[lake > 0] = rgb(sea["lake"])
    cv2.imwrite(str(out), cv2.cvtColor(np.clip(img, 0, 255).astype(np.uint8), cv2.COLOR_RGB2BGR), [cv2.IMWRITE_JPEG_QUALITY, 92])

def main():
    if OUT.exists() and "--prepsat" not in sys.argv:
        print("svet.json existuje – použij --prepsat"); return
    data = json.loads((mapa.MAPY / "mista.json").read_text(encoding="utf-8"))
    clean = mapa.rectify()
    water = mapa.water_mask(clean, data)
    land = (~water).astype(np.uint8)
    land = cv2.morphologyEx(land, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)))
    pevnina = roughen_coasts(shapes(land, 1.3, 25, "pevnina", "jezero"))

    pod = cv2.imread(str(mapa.MAPY / "zdroje" / "Montelien_ilustrace_podklad.jpg"))
    pod = cv2.resize(pod, (W, H), interpolation=cv2.INTER_AREA)
    hsv = cv2.cvtColor(pod, cv2.COLOR_BGR2HSV).astype(np.float32)
    h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    inland = cv2.erode(land, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))) > 0
    wat = (h >= 70) & (h <= 105)
    les = (h >= 27) & (h <= 55) & (v < 125) & (s > 100)
    louky = (h >= 27) & (h <= 60) & (v >= 125)
    cls = {"hory": ~wat & ~les & ~louky & (s < 118) & (v > 60) & (v < 215), "les": les, "louky": louky}
    rucne = json.loads((Path(__file__).parent / "svet_oblasti_zdroj.json").read_text(encoding="utf-8"))
    rmask = np.zeros((H, W), np.uint8)
    for a in rucne:
        cv2.fillPoly(rmask, [np.int32(a["body"])], 1)
    oblasti = []
    for typ, m in cls.items():
        f = cv2.GaussianBlur((m & inland & (rmask == 0)).astype(np.float32), (0, 0), 5)
        mm = ((f > .42) & inland & (rmask == 0)).astype(np.uint8)
        mm = cv2.morphologyEx(mm, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7)))
        for sh in shapes(mm, 2.0, {"hory": 260, "les": 120, "louky": 500}[typ], typ):
            sh["typ"] = typ
            oblasti.append(sh)

    nearw = cv2.dilate(water.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15))) > 0
    riv = (h >= 72) & (h <= 108) & (s > 50) & ~nearw & (land > 0)
    riv = cv2.morphologyEx(riv.astype(np.uint8), cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
    n, lab, st, _ = cv2.connectedComponentsWithStats(riv, 8)
    keep = np.zeros_like(riv)
    for i in range(1, n):
        x, y, w, hh = st[i, :4]
        if max(w, hh) >= 60:
            keep[lab == i] = 1
    reky = [{"typ": "reka", "body": l} for l in trace(skeletonize(keep > 0), 45)]

    for a in oblasti:
        if a["typ"] == "les" and sum(q[1] for q in a["body"]) / len(a["body"]) > 700:
            a["typ"] = "haj"
    oblasti = rucne + oblasti
    sym = json.loads((Path(__file__).parent / "svet_symboly_zdroj.json").read_text(encoding="utf-8"))
    svet = {
        "_popis": "Vektorová mapa Montelienu (px vyrovnané kresby 2048×1440, počátek vlevo nahoře). "
                  "pevnina: typ pevnina/jezero, kreslí se podle úrovně (ostrov v jezeře = vyšší úroveň). "
                  "oblasti: les/hory/poust/bazina/pole/kopce/dzungle – vyplní se symboly. reky, cesty, hranice: lomené čáry. "
                  "symboly: jednotlivé kreslené symboly (typ = id z web/assets/svet_symboly.js). Popisky a body míst jsou v mista.json. "
                  "Úvodní verze vytažena nástrojem tools/svet_extrakce.py, dál se upravuje v editoru mapy.",
        "sirka": W, "vyska": H,
        "pevnina": pevnina, "oblasti": oblasti, "reky": reky + [
            {"typ": "reka", "pozn": "řeka u Nöetu (kresba DM)", "body": [[700, 820], [690, 900], [660, 980], [650, 1060], [680, 1140]]},
            {"typ": "reka", "pozn": "přítok zálivu Zairamu (DM)", "body": [[1335, 948], [1350, 975], [1342, 1000], [1365, 1020], [1395, 1030], [1410, 1055], [1435, 1068], [1450, 1085], [1462, 1090]]},
            {"typ": "reka", "pozn": "přítok zálivu Zairamu (DM)", "body": [[1395, 1030], [1392, 1065], [1410, 1090], [1405, 1115], [1428, 1135], [1445, 1150], [1458, 1158]]},
            ],
        "cesty": [],
        "hranice": [{"typ": "hranice", "pozn": "hranice Tali / Zairam (čárkovaně v kresbě DM)", "body": [[1480, 960], [1530, 1000], [1545, 1100], [1525, 1230]]}], "symboly": sym,
    }
    from svet_lore import lore
    lore(svet)
    OUT.write_text(json.dumps(svet, ensure_ascii=False, separators=(",", ":")).replace('},{', '},\n{'), encoding="utf-8")
    barvy(svet, ASSETS / "barvy.jpg")
    hloubka(svet, ASSETS / "hloubka.jpg")
    print("pevnina", len(pevnina), "oblasti", {t: sum(o["typ"] == t for o in oblasti) for t in cls}, "reky", len(reky), "symboly", len(sym))
    dbg = cv2.cvtColor(clean, cv2.COLOR_GRAY2BGR) if clean.ndim == 2 else clean.copy()
    col = {"les": (40, 120, 30), "hory": (130, 110, 140), "velehory": (200, 200, 220), "poust": (60, 170, 230), "dzungle": (20, 90, 20), "bazina": (120, 140, 90), "pole": (60, 200, 220), "kopce": (90, 150, 190)}
    ov = dbg.copy()
    for o in oblasti:
        cv2.fillPoly(ov, [np.int32(o["body"])], col.get(o["typ"], (90, 200, 140)))
    dbg = cv2.addWeighted(dbg, .5, ov, .5, 0)
    for p in pevnina:
        cv2.polylines(dbg, [np.int32(p["body"])], True, (200, 60, 0) if p["typ"] == "pevnina" else (0, 0, 220), 2)
    for r in reky:
        cv2.polylines(dbg, [np.int32(r["body"])], False, (255, 120, 0), 2)
    for s_ in sym:
        cv2.circle(dbg, (s_["x"], s_["y"]), 9, (0, 0, 255), 2)
    cv2.imwrite("/home/ubuntu/work/svet_dbg.jpg", dbg)


if __name__ == "__main__":
    main()
