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
sys.path.insert(0, str(Path(__file__).parent))
import mapa

OUT = mapa.MAPY / "svet.json"
W, H = mapa.W, mapa.H


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
    """Barevný podklad terénu (1024×720): klima podle zeměpisné šířky + šum + oblasti ze svet.json."""
    w, h, k = 1024, 720, .5
    rng = np.random.default_rng(7)
    def sum_(s):
        n = cv2.GaussianBlur(rng.random((h, w)).astype(np.float32), (0, 0), s)
        return (n - n.mean()) / (n.std() + 1e-6)
    yy = np.linspace(0, 1, h)[:, None].repeat(w, 1)
    t = np.clip(yy * 1.25 - .2 + sum_(40) * .22 + sum_(12) * .08, 0, 1)[..., None]
    sever, stred, jih = np.array([108, 176, 150.]), np.array([112, 190, 206.]), np.array([126, 189, 220.])
    img = np.where(t < .5, sever + (stred - sever) * (t / .5), stred + (jih - stred) * ((t - .5) / .5))
    img = img + sum_(6)[..., None] * np.array([6, 9, 5.])
    pal = {"louky": ((86, 178, 147), .75), "les": ((76, 132, 92), .7), "haj": ((80, 150, 112), .7), "dzungle": ((70, 140, 88), .75),
           "hory": ((135, 150, 166), .7), "velehory": ((215, 214, 214), .7), "poust": ((134, 206, 232), .85), "pole": ((110, 196, 214), .6),
           "bazina": ((110, 150, 120), .7), "kopce": ((112, 180, 196), .5), "mrtvy": ((120, 150, 160), .6)}
    for typ, (c, a) in pal.items():
        m = np.zeros((h, w), np.uint8)
        for o in data["oblasti"]:
            if o["typ"] == typ:
                cv2.fillPoly(m, [np.int32(np.array(o["body"]) * k)], 255)
        m = cv2.GaussianBlur(m.astype(np.float32) / 255, (0, 0), 7)[..., None] * a
        img = img * (1 - m) + np.array(c, float) * m
    img = cv2.GaussianBlur(img, (0, 0), 1.5)
    cv2.imwrite(str(out), np.clip(img, 0, 255).astype(np.uint8), [cv2.IMWRITE_JPEG_QUALITY, 88])

def main():
    if OUT.exists() and "--prepsat" not in sys.argv:
        print("svet.json existuje – použij --prepsat"); return
    data = json.loads((mapa.MAPY / "mista.json").read_text(encoding="utf-8"))
    clean = mapa.rectify()
    water = mapa.water_mask(clean, data)
    land = (~water).astype(np.uint8)
    land = cv2.morphologyEx(land, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)))
    pevnina = shapes(land, 1.3, 25, "pevnina", "jezero")

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
    OUT.write_text(json.dumps(svet, ensure_ascii=False, separators=(",", ":")).replace('},{', '},\n{'), encoding="utf-8")
    barvy(svet, Path(__file__).resolve().parent.parent / "web/assets/svet/barvy.jpg")
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
