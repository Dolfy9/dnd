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
    cls = {
        "les": (h > 33) & (h < 80) & (s > 70) & (v < 125),
    }
    oblasti = []
    for typ, m in cls.items():
        f = cv2.GaussianBlur((m & inland).astype(np.float32), (0, 0), 7)
        thr = .38
        mm = ((f > thr) & inland).astype(np.uint8)
        mm = cv2.morphologyEx(mm, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))
        for sh in shapes(mm, 3.0, 450, typ):
            sh["typ"] = typ
            oblasti.append(sh)

    nearw = cv2.dilate(water.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (35, 35))) > 0
    riv = (h > 82) & (h < 108) & (s > 60) & (v > 70) & ~nearw & (land > 0)
    riv = cv2.morphologyEx(riv.astype(np.uint8), cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
    n, lab, st, _ = cv2.connectedComponentsWithStats(riv, 8)
    keep = np.zeros_like(riv)
    for i in range(1, n):
        x, y, w, hh = st[i, :4]
        if max(w, hh) >= 60:
            keep[lab == i] = 1
    reky = [{"typ": "reka", "body": l} for l in trace(skeletonize(keep > 0), 45)]

    rucne = json.loads((Path(__file__).parent / "svet_oblasti_zdroj.json").read_text(encoding="utf-8")) if (Path(__file__).parent / "svet_oblasti_zdroj.json").exists() else []
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
            {"typ": "reka", "pozn": "odhad z ilustrace", "body": [[390, 240], [375, 300], [350, 360], [335, 420]]},
            {"typ": "reka", "pozn": "odhad z ilustrace", "body": [[350, 480], [400, 540], [430, 600], [440, 660], [500, 700], [600, 725]]}],
        "cesty": [],
        "hranice": [{"typ": "hranice", "pozn": "hranice Tali / Zairam (čárkovaně v kresbě DM)", "body": [[1480, 960], [1530, 1000], [1545, 1100], [1525, 1230]]}], "symboly": sym,
    }
    OUT.write_text(json.dumps(svet, ensure_ascii=False, separators=(",", ":")).replace('},{', '},\n{'), encoding="utf-8")
    print("pevnina", len(pevnina), "oblasti", {t: sum(o["typ"] == t for o in oblasti) for t in cls}, "reky", len(reky), "symboly", len(sym))
    dbg = cv2.cvtColor(clean, cv2.COLOR_GRAY2BGR) if clean.ndim == 2 else clean.copy()
    col = {"les": (40, 120, 30), "hory": (130, 110, 140), "velehory": (200, 200, 220), "poust": (60, 170, 230), "dzungle": (20, 90, 20), "bazina": (120, 140, 90), "pole": (60, 200, 220), "kopce": (90, 150, 190)}
    ov = dbg.copy()
    for o in oblasti:
        cv2.fillPoly(ov, [np.int32(o["body"])], col[o["typ"]])
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
