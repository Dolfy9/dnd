"""Vektorizace východních hranic z kresby DM do nástroje svet_kresba.json."""
import json
import math
from pathlib import Path

import cv2
import numpy as np
from shapely.geometry import LineString, Point, Polygon
from shapely.ops import nearest_points, polygonize, unary_union
from skimage.morphology import skeletonize

T = Path(__file__).resolve().parent
R = T.parent
K_PATH = T / "svet_kresba.json"
IMG_PATH = T / "svet_archy/hranice_vychod_dm.png"
H = np.array([
    [1.0622541476744136, -5.94189574928109e-7, 616.4252429366333],
    [1.367542630317689e-5, 1.0619243666697018, -5.240186280624511],
    [1.8809856605495925e-8, -6.989608003086606e-9, 1.0],
], dtype=np.float64)
TAG = "východní hranice DM:"
NEIGHBORS = [(-1, -1), (0, -1), (1, -1), (-1, 0), (1, 0), (-1, 1), (0, 1), (1, 1)]
STATES = ("Nölien", "Khearaz", "Mönohen", "Khärghe Zhia", "Knärghe Zhia")


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


def smooth_axis_steps(points, limit=6):
    points = [tuple(p) for p in points]
    corners = {}
    for i in range(1, len(points) - 1):
        a, b, c = points[i - 1:i + 2]
        u = (b[0] - a[0], b[1] - a[1])
        v = (c[0] - b[0], c[1] - b[1])
        lu, lv = math.hypot(*u), math.hypot(*v)
        if not lu or not lv:
            continue
        horizontal = abs(u[1]) < lu * .04 and abs(v[0]) < lv * .04
        vertical = abs(u[0]) < lu * .04 and abs(v[1]) < lv * .04
        if not ((horizontal or vertical) and max(lu, lv) > limit):
            continue
        ru, rv = max(0, lu - limit), max(0, lv - limit)
        if ru and not rv:
            rv = min(lv * .8, ru * .4)
        if rv and not ru:
            ru = min(lu * .8, rv * .4)
        if not ru and not rv:
            continue
        start = (b[0] - u[0] / lu * ru, b[1] - u[1] / lu * ru)
        end = (b[0] + v[0] / lv * rv, b[1] + v[1] / lv * rv)
        corners[i] = (start, end, b)
    result = [points[0]]
    for i in range(1, len(points) - 1):
        if i not in corners:
            result.append(points[i])
            continue
        start, end, control = corners[i]
        result.append(start)
        for step in range(1, 5):
            t = step / 4
            result.append(((1 - t) ** 2 * start[0] + 2 * (1 - t) * t * control[0] + t ** 2 * end[0],
                           (1 - t) ** 2 * start[1] + 2 * (1 - t) * t * control[1] + t ** 2 * end[1]))
    result.append(points[-1])
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
        simplified = list(LineString(path).simplify(2.0, preserve_topology=False).coords)
        fitted = smooth_axis_steps(simplified)
        line = LineString(chaikin(densify(fitted), 2))
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
            best, best_along, best_gap = None, 20.01, 6.01
            targets = [coast] + [other for j, other in enumerate(lines) if j != i]
            for target in targets:
                ray_point, target_point = nearest_points(ray, target)
                along = Point(p).distance(ray_point)
                gap = ray_point.distance(target_point)
                if 0.5 < along <= 20 and gap <= 6 and along < best_along:
                    best, best_along, best_gap = target_point, along, gap
            if best is None:
                origin = Point(p)
                for target in targets:
                    ray_point, target_point = nearest_points(origin, target)
                    distance = origin.distance(target_point)
                    if distance <= 20:
                        vx, vy = target_point.x - p[0], target_point.y - p[1]
                        dot = (vx * dx + vy * dy) / (distance * magnitude + 1e-9)
                        if dot > 0.25 and distance < best_along:
                            best, best_along, best_gap = target_point, distance, 0
            if best is not None:
                coords[side] = (best.x, best.y)
                snapped += 1
        result.append(LineString(coords))
    return result, snapped


def polygon_parts(geom, minimum=1):
    if geom.geom_type == "Polygon":
        candidates = [geom]
    else:
        candidates = [g for g in getattr(geom, "geoms", []) if g.geom_type == "Polygon"]
    return [p for p in candidates if p.area >= minimum]


def rings(geom):
    result = []
    for poly in polygon_parts(geom):
        poly = poly.simplify(1.2, preserve_topology=True)
        points = []
        for x, y in list(poly.exterior.coords)[:-1]:
            p = [int(round(x)), int(round(y))]
            if not points or p != points[-1]:
                points.append(p)
        if len(points) >= 3:
            result.append(points)
    return result


def replace_array(text, key, values):
    key_at = text.index('"' + key + '"')
    start = text.index("[", key_at)
    depth, quoted, escaped = 0, False, False
    end = None
    for i in range(start, len(text)):
        char = text[i]
        if quoted:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                quoted = False
            continue
        if char == '"':
            quoted = True
        elif char == "[":
            depth += 1
        elif char == "]":
            depth -= 1
            if depth == 0:
                end = i
                break
    if end is None:
        raise ValueError("Nelze najít konec pole " + key)
    rows = ",\n".join("    " + json.dumps(value, ensure_ascii=False, separators=(",", ":")) for value in values)
    replacement = "[\n" + rows + "\n  ]" if rows else "[]"
    return text[:start] + replacement + text[end + 1:]


def extract_dashed(mask, labels, matrix):
    result = []
    for i in range(1, int(labels.max()) + 1):
        x, y, w, h = map(int, cv2.boundingRect((labels == i).astype(np.uint8)))
        area = int((labels == i).sum())
        if not (220 <= x and x + w <= 410 and 145 <= y and y + h <= 265 and area < 1000):
            continue
        ys, xs = np.nonzero(labels == i)
        points = np.column_stack((xs, ys)).astype(np.float64)
        center = points.mean(axis=0)
        covariance = np.cov(points.T)
        _, vectors = np.linalg.eigh(covariance)
        direction = vectors[:, -1]
        projection = (points - center) @ direction
        endpoints = np.array([
            center + direction * projection.min(),
            center + direction * projection.max(),
        ], dtype=np.float64).reshape(-1, 1, 2)
        atlas = cv2.perspectiveTransform(endpoints, matrix).reshape(-1, 2)
        line = [[int(round(x)), int(round(y))] for x, y in atlas]
        if line[0] != line[1]:
            result.append({
                "typ": "hranice",
                "pozn": TAG + " čárkovaný úsek u démona",
                "carkovana": True,
                "body": line,
            })
    return result


def main():
    data = json.loads((R / "11_Mapy/svet.json").read_text(encoding="utf-8"))
    places = json.loads((R / "11_Mapy/mista.json").read_text(encoding="utf-8"))["mista"]
    source_text = K_PATH.read_text(encoding="utf-8")
    source = json.loads(source_text)
    image = cv2.imread(str(IMG_PATH))
    if image is None:
        raise FileNotFoundError(IMG_PATH)
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    mask = cv2.inRange(hsv, np.array([125, 80, 70], dtype=np.uint8), np.array([179, 255, 255], dtype=np.uint8))
    cv2.rectangle(mask, (0, 0), (78, 88), 0, -1)
    cv2.rectangle(mask, (0, 865), (80, 938), 0, -1)
    count, components, stats, _ = cv2.connectedComponentsWithStats(mask, 8)
    dashed = extract_dashed(mask, components, H)
    for i in range(1, count):
        x, y, w, h, area = map(int, stats[i])
        if 220 <= x and x + w <= 410 and 145 <= y and y + h <= 265 and area < 1000:
            mask[components == i] = 0
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((7, 7), dtype=np.uint8))
    warped = cv2.warpPerspective(mask, H, (data["sirka"], data["vyska"]), flags=cv2.INTER_NEAREST)
    lines, dangling = trace_lines(warped)

    land_polygons = [
        Polygon(f["body"]).buffer(0) for f in data["pevnina"]
        if f["typ"] in ("pevnina", "ostrov") and len(f["body"]) >= 3
    ]
    lake_polygons = [
        Polygon(f["body"]).buffer(0) for f in data["pevnina"]
        if f["typ"] == "jezero" and len(f["body"]) >= 3
    ]
    land = unary_union(land_polygons).difference(unary_union(lake_polygons)) if lake_polygons else unary_union(land_polygons)
    coast = land.boundary
    lines, snapped = snap_endpoints(lines, dangling, coast)
    faces = list(polygonize(unary_union([coast] + lines)))
    land_faces = [(face, face.intersection(land)) for face in faces]
    seeds = {m["nazev"]: Point(m["x"], m["y"]) for m in places if m.get("typ") == "zeme"}

    assigned = {}
    for name in STATES:
        found = [g for _, g in land_faces if g.area > 1000 and g.covers(seeds[name])]
        if len(found) != 1:
            raise ValueError(f"Popisek {name} neleží právě v jedné východní ploše: {len(found)}")
        assigned[name] = found[0]

    north_point = Point(1148, 288)
    north = next((g for face, g in land_faces if g.area > 3000 and face.covers(north_point)), None)
    if north is None:
        raise ValueError("Potvrzená severní plocha Nölienu nebyla nalezena")
    assigned["Nölien"] = unary_union([assigned["Nölien"], north])

    unassigned_groups = [
        ("Nepřiřazené území – severně od Khearazu", Point(1637, 406),
         lambda p: 1450 < p.centroid.x < 1780 and 300 < p.centroid.y < 500),
        ("Nepřiřazené území – u démona", Point(946, 295),
         lambda p: 850 < p.centroid.x < 1000 and 180 < p.centroid.y < 410),
        ("Nepřiřazené území – východní pobřeží u D:", Point(1733, 798),
         lambda p: 1600 < p.centroid.x < 1880 and 680 < p.centroid.y < 950),
    ]
    special_faces = []
    unassigned = []
    for name, point, group_filter in unassigned_groups:
        group = [face for face in faces if face.area > 2500 and group_filter(face)]
        if not any(face.covers(point) for face in group):
            raise ValueError("Bod nepatří do nerozhodnuté plochy " + name)
        if not group:
            raise ValueError("Chybí nerozhodnutá plocha " + name)
        special_faces.extend(group)
        unassigned.append((name, unary_union(group)))

    merges, unmerged = [], []
    excluded_points = [Point(1533, 191), Point(1815, 1088)]
    for face, geom in land_faces:
        if geom.area < 3000 or geom.bounds[0] < 700 or geom.bounds[3] > 1000:
            continue
        if any(face.covers(point) for point in excluded_points):
            continue
        if any(face.equals(special) for special in special_faces):
            continue
        if any(face.covers(point) for point in [seeds[name] for name in STATES] + [north_point]):
            continue
        # Pouze pobřežní zbytky připojujeme k sousednímu označenému území.
        coastline_length = geom.boundary.intersection(coast).length
        coast_ratio = coastline_length / max(geom.boundary.length, 1)
        if coast_ratio < 0.2:
            unmerged.append((round(geom.area), tuple(round(v) for v in geom.bounds), round(coast_ratio, 2)))
            continue
        scores = {
            name: geom.boundary.intersection(poly.boundary).length
            for name, poly in assigned.items()
        }
        nearest = max(scores, key=scores.get)
        shared = scores[nearest]
        if shared > 1:
            assigned[nearest] = unary_union([assigned[nearest], geom])
            merges.append((round(geom.area), tuple(round(v) for v in geom.bounds), nearest, round(shared), round(coast_ratio, 2)))
        else:
            unmerged.append((round(geom.area), tuple(round(v) for v in geom.bounds), round(coast_ratio, 2)))

    generated = []
    for name, geom in assigned.items():
        note = TAG + (" severní pohoří s chrámy – DM potvrzeno" if name == "Nölien" else f" {name}")
        for ring in rings(geom):
            generated.append({"nazev": name, "pozn": note, "body": ring})
    for name, geom in unassigned:
        for ring in rings(geom):
            generated.append({"nazev": "Nepřiřazené území", "stat": None, "pozn": "nepřiřazeno – čeká na DM (" + name + ")", "body": ring})

    retained_areas = [
        u for u in source.get("uzemi", [])
        if not u.get("pozn", "").startswith(TAG)
        and not (u.get("nazev") == "Nepřiřazené území"
                 and u.get("pozn", "").startswith("nepřiřazeno – čeká na DM"))
    ]
    retained_borders = [b for b in source.get("hranice", []) if not b.get("pozn", "").startswith(TAG)]
    source["uzemi"] = retained_areas + generated
    source["hranice"] = retained_borders + dashed
    updated = replace_array(source_text, "hranice", source["hranice"])
    updated = replace_array(updated, "uzemi", source["uzemi"])
    json.loads(updated)
    K_PATH.write_text(updated, encoding="utf-8")

    print(f"Polygonizované plochy: {len(faces)}; land faces > 3000 px²: {sum(g.area > 3000 for _, g in land_faces)}")
    print("Přiřazené státy:", ", ".join(f"{name}={len(polygon_parts(geom))}" for name, geom in assigned.items()))
    print("Nepřiřazené oblasti:", len(unassigned))
    print("Sloučené pobřežní plochy:", merges)
    print("Nesloučené neoznačené plochy:", unmerged)
    print(f"Připojené volné konce: {snapped}; čárkované úseky: {len(dashed)}")


if __name__ == "__main__":
    main()
