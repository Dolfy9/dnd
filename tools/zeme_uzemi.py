#!/usr/bin/env python3
"""Přepočet územních polygonů států (klíč "body" v 11_Mapy/svet.json).

Metoda: vícezdrojová dilatace (voronoiovský rozklad) na masce pevniny.
Každý stát roste ze semínka — kotva popisku (mista.json, typ "zeme"),
případně těžiště největšího existujícího fragmentu. Růst blokují
hranice (svet.json → hranice) a pobřeží (pevnina). Kde hranice chybí,
rozhraní vznikne ve vzdálenostním středu mezi semínky.

Výsledek je návrh území pro hover zvýraznění — přesné hranice doladí
editor mapy.
"""
import json
import sys
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
MAPY = ROOT / "11_Mapy"
SVET = MAPY / "svet.json"
MISTA = MAPY / "mista.json"


def centroid(rings):
    best, bx, by = 0, 0, 0
    for ring in rings or []:
        if len(ring) < 3:
            continue
        a = abs(sum(ring[i][0] * ring[(i + 1) % len(ring)][1]
                    - ring[(i + 1) % len(ring)][0] * ring[i][1]
                    for i in range(len(ring))) / 2)
        if a > best:
            best = a
            bx = int(sum(p[0] for p in ring) / len(ring))
            by = int(sum(p[1] for p in ring) / len(ring))
    return (bx, by) if best else None


def main() -> None:
    force = "--force" in sys.argv
    svet = json.loads(SVET.read_text(encoding="utf-8"))
    mista = json.loads(MISTA.read_text(encoding="utf-8"))
    W, H = int(svet.get("sirka", 2048)), int(svet.get("vyska", 1440))

    land = np.zeros((H, W), np.uint8)
    for p in svet.get("pevnina", []):
        if p.get("body"):
            cv2.fillPoly(land, [np.int32(np.array(p["body"]))],
                         0 if p.get("typ") == "jezero" else 1)

    barrier = np.zeros((H, W), np.uint8)
    for l in svet.get("hranice", []):
        if l.get("body") and len(l["body"]) > 1:
            cv2.polylines(barrier, [np.int32(np.array(l["body"]))], False, 1, 5)
    barrier = cv2.dilate(barrier, np.ones((3, 3), np.uint8))

    # existující území beze jména = pevné oblasti (nezáležitá samostatná území)
    fixed = np.zeros((H, W), np.uint8)
    for z in svet.get("zeme", []):
        if z.get("nazev"):
            continue
        for ring in z.get("body") or []:
            if len(ring) >= 3:
                cv2.fillPoly(fixed, [np.int32(np.array(ring))], 1)

    # semínka = kotva popisku (DM ji kreslí dovnitř území)
    anchors = {m["nazev"]: (int(round(m["x"])), int(round(m["y"])))
               for m in mista.get("mista", [])
               if m.get("typ") in ("zeme", "misto") and m.get("nazev")}
    named = [z for z in svet.get("zeme", []) if z.get("nazev")]
    seeds = {}
    for z in named:
        pt = anchors.get(z["nazev"])
        if pt is None:
            pt = centroid([r for g in (z.get("pas") or []) for r in g]
                          or z.get("body") or [])
        if pt:
            seeds[z["nazev"]] = pt

    # růst přes celou mapu (i moře) — ostrovní státy tak získají všechny
    # ostrovy; na konci se území ořízne na pevninu. Blokují jen pevná
    # bezejmenná území (hranice jako bariéra vnitřky uzavřela → špatně).
    lab = np.zeros((H, W), np.uint8)  # 0=volno, 1..n=stát, 255=bariéra
    lab[fixed > 0] = 255
    ids = {}
    for i, (n, (x, y)) in enumerate(seeds.items()):
        if not (0 <= x < W and 0 <= y < H):
            continue
        if lab[y, x] != 0:
            win = 80
            x0, y0 = max(0, x - win), max(0, y - win)
            ys, xs = np.nonzero(lab[y0:y + win, x0:x + win] == 0)
            if len(xs) == 0:
                continue
            k = int(((xs + x0 - x) ** 2 + (ys + y0 - y) ** 2).argmin())
            x, y = int(xs[k] + x0), int(ys[k] + y0)
        ids[n] = i + 1
        lab[y, x] = i + 1

    kernel = np.ones((3, 3), np.uint8)
    for _ in range(1600):
        d = cv2.dilate(np.where(lab == 255, 0, lab), kernel)
        grow = (lab == 0) & (d > 0)
        if not grow.any():
            break
        lab[grow] = d[grow]

    changed = 0
    for z in named:
        n = z["nazev"]
        sid = ids.get(n)
        if not sid:
            print(f"  ! {n}: bez semínka, přeskakuju")
            continue
        region = ((lab == sid) & (land > 0)).astype(np.uint8)
        cs, _ = cv2.findContours(region, cv2.RETR_EXTERNAL,
                                 cv2.CHAIN_APPROX_SIMPLE)
        body = []
        for c in sorted(cs, key=cv2.contourArea, reverse=True):
            if cv2.contourArea(c) < 400:
                continue
            a = cv2.approxPolyDP(c, 3.0, True).reshape(-1, 2)
            if len(a) >= 3:
                body.append([[int(x), int(y)] for x, y in a])
        if not body:
            print(f"  ! {n}: prázdné území")
            continue
        if not force and z.get("body") and not z.get("_auto_body"):
            # ponechat ručně nakreslená území
            pass
        z["body"] = body
        z["_auto_body"] = True
        z["pozn"] = "území dopočtené z hranic a pevniny (návrh – doladit v editoru)"
        changed += 1
        print(f"  ok {n}: {len(body)} polygonů, {int(region.sum())} px")

    if changed:
        SVET.write_text(json.dumps(svet, ensure_ascii=False, indent=1),
                        encoding="utf-8")
    print(f"hotovo: {changed} států přepočteno")


if __name__ == "__main__":
    main()
