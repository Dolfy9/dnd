#!/usr/bin/env python3
"""Území států podle map hranic DM → přepíše zeme[] a statní hranice v 11_Mapy/svet.json.

Postup:
1.  Maska pevniny (pevnina+ostrov − jezera) v rozlišení mapy.
2.  Bariérová maska = magentové tahy z DM kreseb (hranice_vychod_dm.png,
    hranice_jih_dm.png) přes homografie H / H_SOUTH, ořez na pevninu,
    malá dilatace, aby se tahy uzavřely.
3.  Buňky = souvislé oblasti pevniny mimo bariéry. Přiřazení:
    buňka s popiskem státu (mista.json typ "zeme") → ten stát;
    jinak >50 % překryv s polygonem uzemi z tools/svet_kresba.json;
    jinak malé buňky (<~3000 px) se pohltí šířením od sousedů;
    velké nepřiřazené buňky zůstávají NEPŘIŘAZENÉ (otevřené otázky DM).
4.  Bariéry a pohlcené buňky se doplní šířením nejbližšího označení
    (hranice tak leží ve středu tahu), pak mírný modový filtr proti zubům.
5.  Vektorizace per stát: findContours RETR_CCOMP → vnější + díry,
    zjednodušení ~1 px, Chaikinovo vyhlazení, prsteny < 30 px² zahodit.
    Zapisuje se jako plochý seznam prstenů s even-odd sémantikou.
6.  Hranice = pixely, kde se dotýkají dvě různé označení → kostra →
    lomené čáry. V hranice[] se nahradí jen položky „jižní/východní hranice
    DM:" a „(vypočtená…)"; ostatní zůstávají. Čárkované DM úseky ležící
    >70 % v moři zůstávají (jde o mořské značky z kresby).
"""
import json
import math
import shutil
from pathlib import Path

import cv2
import numpy as np
from shapely.geometry import LineString, Point, Polygon
from shapely.ops import nearest_points
from skimage.filters.rank import modal
from skimage.morphology import disk, skeletonize

T = Path(__file__).resolve().parent
R = T.parent
SVET = R / "11_Mapy/svet.json"
MISTA = R / "11_Mapy/mista.json"
KRESBA = T / "svet_kresba.json"
IMG_EAST = T / "svet_archy/hranice_vychod_dm.png"
IMG_SOUTH = T / "svet_archy/hranice_jih_dm.png"
BACKUP = Path(r"C:\Users\dolfy\AppData\Local\Temp\montshots\svet.backup.json")
DEBUG_DIR = Path(r"C:\Users\dolfy\AppData\Local\Temp\montshots")
BASE_IMG = R / "11_Mapy/Montelien_mapa_vyrovnana.jpg"

H = np.array([
    [1.0622541476744136, -5.94189574928109e-7, 616.4252429366333],
    [1.367542630317689e-5, 1.0619243666697018, -5.240186280624511],
    [1.8809856605495925e-8, -6.989608003086606e-9, 1.0],
], dtype=np.float64)
H_SOUTH = np.array([
    [1.1789986344678178, -0.00016248895505274524, 52.137001017849215],
    [-1.894482472645219e-5, 1.1781780940862343, 687.7360914591272],
    [-1.3859678518250163e-8, -1.2857555929462806e-7, 1.0],
], dtype=np.float64)

MIN_BUNKA = 3000      # menší buňky se pohltí
MIN_PRSTEN = 30.0     # plocha prstenu v px²
NEIGHBORS = [(-1, -1), (0, -1), (1, -1), (-1, 0), (1, 0), (-1, 1), (0, 1), (1, 1)]


# --- pomocné (převzaté z vychodni_hranice.py) ---

def neighbors(p, pixels):
    return [(p[0] + dx, p[1] + dy) for dx, dy in NEIGHBORS if (p[0] + dx, p[1] + dy) in pixels]


def edge(a, b):
    return (a, b) if a < b else (b, a)


def chaikin(points, rounds=2):
    points = list(points)
    for _ in range(rounds):
        if len(points) < 3:
            break
        smoothed = [points[0]]
        for a, b in zip(points[:-1], points[1:]):
            smoothed.extend([
                (0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]),
                (0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]),
            ])
        smoothed.append(points[-1])
        points = smoothed
    return points


def chaikin_closed(points, rounds=2):
    """Chaikinovo vyhlazení uzavřeného prstenu."""
    points = list(points)
    for _ in range(rounds):
        if len(points) < 3:
            break
        out = []
        n = len(points)
        for i in range(n):
            a, b = points[i], points[(i + 1) % n]
            out.append((0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]))
            out.append((0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]))
        points = out
    return points


def densify(points, max_step=5):
    result = [points[0]]
    for a, b in zip(points[:-1], points[1:]):
        distance = math.hypot(b[0] - a[0], b[1] - a[1])
        steps = max(1, math.ceil(distance / max_step))
        result.extend((
            a[0] + (b[0] - a[0]) * i / steps,
            a[1] + (b[1] - a[1]) * i / steps,
        ) for i in range(1, steps + 1))
    return result


def trace_lines(mask):
    skeleton = skeletonize(mask > 0)
    ys, xs = np.nonzero(skeleton)
    pixels = set(zip(xs.tolist(), ys.tolist()))
    visited = set()
    paths = []
    for start in sorted(pixels):
        if len(neighbors(start, pixels)) == 2:
            continue
        for first in neighbors(start, pixels):
            if edge(start, first) in visited:
                continue
            path = [start, first]
            visited.add(edge(start, first))
            previous, current = start, first
            while len(neighbors(current, pixels)) == 2:
                following = next(
                    (q for q in neighbors(current, pixels)
                     if q != previous and edge(current, q) not in visited),
                    None,
                )
                if following is None:
                    break
                visited.add(edge(current, following))
                path.append(following)
                previous, current = current, following
            paths.append(path)

    lines, dangling = [], []
    for path in paths:
        if len(path) < 2:
            continue
        simplified = list(LineString(path).simplify(1.6, preserve_topology=False).coords)
        line = LineString(chaikin(densify(simplified), 2))
        if line.length < 1:
            continue
        lines.append(line)
        dangling.append((
            path[0] if len(neighbors(path[0], pixels)) == 1 else None,
            path[-1] if len(neighbors(path[-1], pixels)) == 1 else None,
        ))
    return lines, dangling


def snap_endpoints(lines, dangling, coast):
    snapped = 0
    result = []
    for i, line in enumerate(lines):
        coords = list(line.coords)
        for side, tip in ((0, dangling[i][0]), (-1, dangling[i][1])):
            if tip is None:
                continue
            p = coords[side]
            adjacent = coords[1] if side == 0 else coords[-2]
            dx, dy = p[0] - adjacent[0], p[1] - adjacent[1]
            magnitude = math.hypot(dx, dy)
            if magnitude == 0:
                continue
            ray = LineString([p, (p[0] + dx / magnitude * 20, p[1] + dy / magnitude * 20)])
            best, best_along = None, 20.01
            targets = [coast] + [o for j, o in enumerate(lines) if j != i]
            for target in targets:
                ray_point, target_point = nearest_points(ray, target)
                along = Point(p).distance(ray_point)
                gap = ray_point.distance(target_point)
                if 0.5 < along <= 20 and gap <= 6 and along < best_along:
                    best, best_along = target_point, along
            if best is not None:
                coords[side] = (best.x, best.y)
                snapped += 1
        result.append(LineString(coords))
    return result, snapped


def magenta_mask_east(img):
    """Magické tahy východního listu (s čištěním legendových artefaktů)."""
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    mask = cv2.inRange(hsv, np.array([125, 80, 70], np.uint8), np.array([179, 255, 255], np.uint8))
    cv2.rectangle(mask, (0, 0), (78, 88), 0, -1)
    cv2.rectangle(mask, (0, 865), (80, 938), 0, -1)
    count, comp, stats, _ = cv2.connectedComponentsWithStats(mask, 8)
    for i in range(1, count):
        x, y, w, h, area = map(int, stats[i])
        if 220 <= x and x + w <= 410 and 145 <= y and y + h <= 265 and area < 1000:
            mask[comp == i] = 0
    return cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))


def magenta_mask_south(img):
    """Magické tahy jižního listu (jen souvislé plné hranice, čárky pryč)."""
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    raw = cv2.inRange(hsv, np.array([125, 80, 70], np.uint8), np.array([179, 255, 255], np.uint8))
    raw[:25] = 0
    closed = cv2.morphologyEx(raw, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))
    count, labels, stats, _ = cv2.connectedComponentsWithStats(closed, 8)
    solid = np.zeros_like(closed)
    for i in range(1, count):
        if int(stats[i, cv2.CC_STAT_AREA]) >= 1000:
            solid[labels == i] = 255
    return solid


def polygon_rings(geom, minimum=MIN_PRSTEN):
    """Shapely geometrie → seznam prstenů [[x,y],…] (vnější i díry)."""
    polys = [geom] if geom.geom_type == "Polygon" else [
        g for g in getattr(geom, "geoms", []) if g.geom_type == "Polygon"]
    rings = []
    for poly in polys:
        if poly.area < minimum:
            continue
        for seq in [poly.exterior.coords, *[r.coords for r in poly.interiors]]:
            pts = []
            for x, y in list(seq)[:-1]:
                p = [int(round(x)), int(round(y))]
                if not pts or p != pts[-1]:
                    pts.append(p)
            if len(pts) >= 3:
                rings.append(pts)
    return rings


def main():
    svet = json.loads(SVET.read_text(encoding="utf-8"))
    mista = json.loads(MISTA.read_text(encoding="utf-8"))["mista"]
    kresba = json.loads(KRESBA.read_text(encoding="utf-8"))
    W, Hh = int(svet["sirka"]), int(svet["vyska"])
    shutil.copy2(SVET, BACKUP)
    print(f"Záloha: {BACKUP}")

    # 1) maska pevniny
    land = np.zeros((Hh, W), np.uint8)
    for p in svet.get("pevnina", []):
        if len(p.get("body") or []) >= 3:
            cv2.fillPoly(land, [np.int32(np.array(p["body"]))],
                         0 if p["typ"] == "jezero" else 1)

    # 2) bariérová maska + pokrytí listů
    img_e = cv2.imread(str(IMG_EAST))
    img_s = cv2.imread(str(IMG_SOUTH))
    if img_e is None or img_s is None:
        raise FileNotFoundError("chybí DM kresby hranic v tools/svet_archy/")
    warped_e = cv2.warpPerspective(magenta_mask_east(img_e), H, (W, Hh), flags=cv2.INTER_NEAREST)
    warped_s = cv2.warpPerspective(magenta_mask_south(img_s), H_SOUTH, (W, Hh), flags=cv2.INTER_NEAREST)
    barrier = (((warped_e > 0) | (warped_s > 0)) & (land > 0)).astype(np.uint8)
    barrier = cv2.dilate(barrier, np.ones((5, 5), np.uint8)) & land
    footprint_e = cv2.warpPerspective(np.full(img_e.shape[:2], 255, np.uint8), H, (W, Hh), flags=cv2.INTER_NEAREST)
    footprint_s = cv2.warpPerspective(np.full(img_s.shape[:2], 255, np.uint8), H_SOUTH, (W, Hh), flags=cv2.INTER_NEAREST)
    coverage = (footprint_e > 0) | (footprint_s > 0)

    # 3) buňky
    free = ((land > 0) & (barrier == 0)).astype(np.uint8)
    n_cells, cell_lab, cell_stats, cell_cent = cv2.connectedComponentsWithStats(free, 4)
    print(f"Buňky pevniny mimo bariéry: {n_cells - 1}")

    stavy = [z["nazev"] for z in svet.get("zeme", []) if z.get("nazev")]
    sid = {n: i + 1 for i, n in enumerate(stavy)}   # 1..N = státy, 254 = nepřiřazeno
    UNASSIGNED = 254
    # popisky států; když leží v tahu bariéry, posuneme na nejbližší volný bod
    popisky = {}
    for m in mista:
        if m.get("typ") != "zeme" or m.get("nazev") not in sid:
            continue
        x, y = int(round(m["x"])), int(round(m["y"]))
        if not (0 <= x < W and 0 <= y < Hh and free[y, x]):
            ys, xs = np.nonzero(free[max(0, y - 90):y + 90, max(0, x - 90):x + 90])
            if len(xs):
                k = int(((xs + max(0, x - 90) - x) ** 2 + (ys + max(0, y - 90) - y) ** 2).argmin())
                x, y = int(xs[k] + max(0, x - 90)), int(ys[k] + max(0, y - 90))
            else:
                print(f"  ! popisek {m['nazev']}: žádná volná buňka do 90 px")
        popisky[m["nazev"]] = (x, y)
    # polygony nápovědy z kresby (Divoký Sever, Dräar nemají popisek)
    kpolys = {}
    for u in kresba.get("uzemi", []):
        n = u.get("nazev")
        if n in sid and len(u.get("body") or []) >= 3:
            kpolys.setdefault(n, []).append(Polygon(u["body"]).buffer(0))
    kmasks = {}
    for n, polys in kpolys.items():
        m = np.zeros((Hh, W), np.uint8)
        for poly in polys:
            for geom in ([poly] if poly.geom_type == "Polygon" else
                         [g for g in getattr(poly, "geoms", []) if g.geom_type == "Polygon"]):
                for ring in [geom.exterior.coords]:
                    cv2.fillPoly(m, [np.int32(np.array(ring))], 1)
        kmasks[n] = m

    bunka_vlastnik = {}      # id buňky → název státu / UNASSIGNED / "absorb"
    konflikty = []
    neprirazene = []
    for cid in range(1, n_cells):
        area = int(cell_stats[cid, cv2.CC_STAT_AREA])
        cmask = cell_lab == cid
        hits = [n for n, (x, y) in popisky.items() if cmask[y, x]]
        in_cov = bool((cmask & coverage).any())
        if hits:
            if len(hits) > 1:
                scores = {n: int((cmask & (kmasks.get(n) or 0)).sum()) if n in kmasks else 0
                          for n in hits}
                owner = max(scores, key=scores.get)
                konflikty.append(f"buňka {cid}: popisky {hits} → {owner} (překryv kresby {scores})")
            else:
                owner = hits[0]
            bunka_vlastnik[cid] = owner
            continue
        scores = {n: int((cmask & km).sum()) / area for n, km in kmasks.items()}
        best = max(scores, key=scores.get) if scores else None
        if best and scores[best] > .5 and (in_cov or best == "Divoký Sever"):
            bunka_vlastnik[cid] = best
            continue
        if area < MIN_BUNKA:
            bunka_vlastnik[cid] = "absorb"
            continue
        bunka_vlastnik[cid] = UNASSIGNED
        cx, cy = cell_cent[cid]
        neprirazene.append((cid, area, round(cx), round(cy), in_cov))

    # 4) výplň: bariéry + pohlcené buňky = šíření nejbližšího označení v pevnině
    lab = np.zeros((Hh, W), np.uint8)
    for cid, v in bunka_vlastnik.items():
        if v == "absorb":
            continue
        lab[cell_lab == cid] = UNASSIGNED if v == UNASSIGNED else sid[v]
    neplnene = (land > 0) & (lab == 0)
    kernel = np.ones((3, 3), np.uint8)
    for _ in range(1600):
        growable = neplnene & (lab == 0)
        d = cv2.dilate(np.where(lab == UNASSIGNED, 0, lab), kernel)
        grow = growable & (d > 0) & (d < UNASSIGNED)
        if not grow.any():
            break
        lab[grow] = d[grow]
    zbyly = int(((land > 0) & (lab == 0)).sum())
    if zbyly:
        print(f"  ! {zbyly} px se nepodařilo doplnit šířením (ostrovy bez souseda)")
        lab[(land > 0) & (lab == 0)] = UNASSIGNED
    # modový filtr proti zubům (jen lehce)
    lab = modal(lab, disk(2)).astype(np.uint8)

    # 5) vektorizace
    vysledky = {}
    for n in stavy:
        m = (lab == sid[n]).astype(np.uint8)
        cnts, hier = cv2.findContours(m, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
        rings = []
        if cnts:
            order = sorted(range(len(cnts)), key=lambda i: -abs(cv2.contourArea(cnts[i])))
            for i in order:
                c = cnts[i]
                if abs(cv2.contourArea(c)) < MIN_PRSTEN:
                    continue
                a = cv2.approxPolyDP(c, 1.0, True).reshape(-1, 2)
                if len(a) < 3:
                    continue
                smooth = chaikin_closed([(float(x), float(y)) for x, y in a], 2)
                ring = [[int(round(x)), int(round(y))] for x, y in smooth]
                if len(ring) >= 3:
                    rings.append(ring)
        vysledky[n] = rings
        print(f"  {n}: {int(m.sum())} px, {len(rings)} prstenů")

    # zdroj území: dm = buňky z pokryté oblasti, navrh = mimo pokrytí
    pomer_dm = {}
    for n in stavy:
        m = lab == sid[n]
        total = int(m.sum())
        pomer_dm[n] = float((m & coverage).sum()) / total if total else 0.0

    # 6) hranice mezi sousedy
    coast = unary_union_land = None
    land_polys = [Polygon(p["body"]).buffer(0) for p in svet["pevnina"]
                  if p["typ"] in ("pevnina", "ostrov") and len(p.get("body") or []) >= 3]
    lakes = [Polygon(p["body"]).buffer(0) for p in svet["pevnina"]
             if p["typ"] == "jezero" and len(p.get("body") or []) >= 3]
    from shapely.ops import unary_union
    unary_union_land = unary_union(land_polys)
    if lakes:
        unary_union_land = unary_union_land.difference(unary_union(lakes))
    coast = unary_union_land.boundary

    nove_hranice = []
    stati_navrh = {n for n in stavy if pomer_dm[n] < .5}
    for i, a in enumerate(stavy):
        for b in stavy[i + 1:]:
            ma = (lab == sid[a]).astype(np.uint8)
            mb = (lab == sid[b]).astype(np.uint8)
            frontier = ((cv2.dilate(ma, kernel) > 0) & (mb > 0)) | ((ma > 0) & (cv2.dilate(mb, kernel) > 0))
            if not frontier.any():
                continue
            lines, dangling = trace_lines(frontier.astype(np.uint8))
            lines = [l for l in lines if l.length >= 12]
            if not lines:
                continue
            lines, snapped = snap_endpoints(lines, dangling, coast)
            navrh = a in stati_navrh or b in stati_navrh
            pozn = f"hranice {a} / {b} ({'návrh' if navrh else 'mapa hranic DM'})"
            for l in lines:
                body = [[int(round(x)), int(round(y))] for x, y in l.coords]
                if len(body) >= 2:
                    nove_hranice.append({"typ": "statni", "pozn": pozn,
                                         "navrh": bool(navrh), "body": body})

    # staré hranice: zahodit DM-vektorové a vypočtené; mořské čárky nechat
    def nad_more(body):
        pts = np.array(body, dtype=np.float64)
        if len(pts) == 2:
            mid = np.linspace(pts[0], pts[1], 12)
        else:
            mid = pts[::max(1, len(pts) // 12)]
        return float(np.mean([land[int(round(min(max(y, 0), Hh - 1))),
                                  int(round(min(max(x, 0), W - 1)))] == 0 for x, y in mid])) > .7

    zachovane = []
    zahozene = 0
    for h in svet.get("hranice", []):
        pozn = h.get("pozn", "") or ""
        rusit = pozn.startswith("jižní hranice DM:") or pozn.startswith("východní hranice DM:") or "vypočten" in pozn
        if rusit and not (h.get("carkovana") and nad_more(h.get("body") or [])):
            zahozene += 1
            continue
        zachovane.append(h)

    svet["hranice"] = zachovane + nove_hranice
    print(f"hranice: ponecháno {len(zachovane)}, zahozeno {zahozene}, nových {len(nove_hranice)}")

    # zápis států
    for z in svet["zeme"]:
        n = z.get("nazev")
        if n not in vysledky:
            continue
        z["body"] = vysledky[n]
        z["pas"] = []
        z.pop("_auto_body", None)
        zdroj = "dm" if pomer_dm.get(n, 0) >= .5 else "navrh"
        z["_uzemi"] = zdroj
        z["pozn"] = ("území podle mapy hranic DM" if zdroj == "dm"
                     else "území – návrh, mimo mapu hranic DM")
        if not vysledky[n]:
            print(f"  ! {n}: žádné pixely – prázdné body")

    SVET.write_text(json.dumps(svet, ensure_ascii=False, indent=1), encoding="utf-8")

    # 7) ladicí překryvy
    img = cv2.imread(str(BASE_IMG))
    if img is not None:
        base = cv2.resize(img, (W, Hh))
        ov = base.copy()
        rng = np.random.RandomState(7)
        for n in stavy:
            color = rng.randint(60, 255, 3).tolist()
            for ring in vysledky[n]:
                cv2.fillPoly(ov, [np.int32(np.array(ring))], color)
        cv2.addWeighted(ov, .35, base, .65, 0, ov)
        for h in nove_hranice:
            cv2.polylines(ov, [np.int32(np.array(h["body"]))], False, (40, 40, 200), 2)
        for n, (x, y) in popisky.items():
            cv2.putText(ov, n, (x - 30, y), cv2.FONT_HERSHEY_SIMPLEX, .5, (0, 0, 0), 3)
            cv2.putText(ov, n, (x - 30, y), cv2.FONT_HERSHEY_SIMPLEX, .5, (255, 255, 255), 1)
        out = DEBUG_DIR / "uzemi_overlay.jpg"
        cv2.imwrite(str(out), ov, [cv2.IMWRITE_JPEG_QUALITY, 90])
        print(f"Overlay: {out}")
        bar = np.zeros((Hh, W), np.uint8)
        bar[barrier > 0] = 255
        cv2.imwrite(str(DEBUG_DIR / "uzemi_bariery.png"), bar)

    print("\nKonflikty popisků:")
    for k in konflikty:
        print("  " + k)
    print("Nepřiřazené velké buňky:")
    for cid, area, cx, cy, cov in neprirazene:
        print(f"  buňka {cid}: {area} px, centroid ({cx},{cy}), v pokrytí: {cov}")
    print("\nZdroj území:")
    for n in stavy:
        print(f"  {n}: {pomer_dm.get(n, 0) * 100:.0f}% v pokrytí -> {'dm' if pomer_dm.get(n, 0) >= .5 else 'navrh'}")


if __name__ == "__main__":
    main()
