"""Rozřeže vygenerované archy symbolů (tools/svet_archy/*.png, bílé pozadí) na průhledné sprity
web/assets/svet/<nazev>.webp a zapíše web/assets/svet/sprity.json (rozměry a kotvy).
Pořadí položek v archu = pořadí jmen v JMENA (po řádcích zleva doprava)."""
import json
from pathlib import Path
import cv2
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
ARCHY = ROOT / "tools" / "svet_archy"
OUT = ROOT / "web" / "assets" / "svet"
JMENA = {
    "hory": "hora_a hora_b hora_c masiv_a skala hreben snih hora_d masiv_b hora_e hora_f masiv_c",
    "stromy": "jehl_1 jehl_2 jehl_3 jehl_4 jehl_5 jehl_6 list_1 list_2 list_3 list_4 list_5 list_6 palma_1 palma_2 palmy dzung_1 dzung_2 palma_3 rakos_1 rakos_2 ker_1 ker_2 suchy_1 suchy_2",
    "sidla": "vesnice vesnice2 mesto velkomesto hrad pevnost pristav vez majak chram zricenina kolonada kopar most strazni_vez",
    "landmarky": "pyramida obelisk torii krystal tvar kostka kupole kolo lod vrak vir had demon vlny clun",
    "teren": "kopec_1 kopec_2 kopec_3 kopec_4 kopec_5 duna_1 duna_2 duna_3 duna_4 duna_5 kaktus_1 kaktus_2 balvan_1 balvan_2 oaza pole_1 pole_2 bazina_1 bazina_2 vinice",
}
MAXH = 300
MRIZKA = {"hory": (3, 4), "stromy": (4, 6), "sidla": (3, 5), "landmarky": (3, 5), "teren": (4, 5)}


def km1(v, k):
    c = np.percentile(v, np.linspace(5, 95, k))
    for _ in range(50):
        lab = np.argmin(np.abs(v[:, None] - c[None, :]), axis=1)
        c = np.array([v[lab == i].mean() if np.any(lab == i) else c[i] for i in range(k)])
    return np.argmin(np.abs(v[:, None] - c[None, :]), axis=1), c


def rez(arch, jmena):
    raw = cv2.imread(str(ARCHY / f"{arch}.png"), cv2.IMREAD_UNCHANGED)
    h, w = raw.shape[:2]
    if raw.shape[2] == 4:
        alpha0 = raw[:, :, 3].astype(np.float32) / 255
        img = raw[:, :, :3]
        bg_dist = (alpha0 * 255).astype(np.int16)
    else:
        img = raw
        bg_dist = 255 - img.min(axis=2).astype(np.int16)
    fg = cv2.morphologyEx((bg_dist > 30).astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    ff = (1 - fg).copy()
    mask = np.zeros((h + 2, w + 2), np.uint8)
    cv2.floodFill(ff, mask, (0, 0), 2)
    solid = (ff != 2).astype(np.uint8)
    n, lab, st, cen = cv2.connectedComponentsWithStats(cv2.dilate(solid, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15))))
    comps = [i for i in range(1, n) if st[i, cv2.CC_STAT_AREA] > 1500]
    R, C = MRIZKA[arch]
    ry, rc = km1(np.array([cen[i][1] for i in comps]), R)
    rord = np.argsort(rc)
    cell = {}
    for r in range(R):
        idx = [comps[j] for j in range(len(comps)) if ry[j] == rord[r]]
        cx, cc = km1(np.array([cen[i][0] for i in idx], float), C)
        cord = np.argsort(cc)
        for j, i in enumerate(idx):
            cell.setdefault(r * C + int(np.where(cord == cx[j])[0][0]), []).append(i)
    assert len(cell) == len(jmena), (arch, len(cell), len(jmena))
    labm = np.zeros_like(lab)
    st2 = {}
    for k, ids in cell.items():
        m = np.isin(lab, ids)
        labm[m] = k + 1
        ys, xs = np.nonzero(m)
        st2[k + 1] = (xs.min(), ys.min(), xs.max() - xs.min() + 1, ys.max() - ys.min() + 1)
    lab, order = labm, [k + 1 for k in range(len(jmena))]
    st = st2
    meta = {}
    soft = np.clip(bg_dist.astype(np.float32) / (255 if raw.shape[2] == 4 else 40), 0, 1)
    for i, nm in zip(order, jmena):
        x, y, ww, hh = st[i]
        sel = (lab[y:y + hh, x:x + ww] == i) & (solid[y:y + hh, x:x + ww] > 0)
        a = np.where(sel, np.maximum(soft[y:y + hh, x:x + ww], 0), 0)
        if raw.shape[2] == 3:
            core = cv2.erode(sel.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
            a = np.where(core, 1.0, a)
        a = cv2.GaussianBlur(a.astype(np.float32), (0, 0), .7)
        ys, xs = np.nonzero(a > .05)
        y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        rgb = img[y + y0:y + y1, x + x0:x + x1]
        al = (a[y0:y1, x0:x1] * 255).astype(np.uint8)
        rgba = np.dstack([rgb, al])
        k = min(1.0, MAXH / rgba.shape[0], MAXH * 1.6 / rgba.shape[1])
        if k < 1:
            rgba = cv2.resize(rgba, None, fx=k, fy=k, interpolation=cv2.INTER_AREA)
        cv2.imwrite(str(OUT / f"{nm}.webp"), rgba, [cv2.IMWRITE_WEBP_QUALITY, 88])
        meta[nm] = {"w": rgba.shape[1], "h": rgba.shape[0]}
    return meta


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    meta = {}
    for arch, jm in JMENA.items():
        meta.update(rez(arch, jm.split()))
    (OUT / "sprity.json").write_text(json.dumps(meta, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    (OUT / "sprity.js").write_text("window.SVET_SPRITY_META=" + json.dumps(meta, separators=(",", ":")) + ";\n", encoding="utf-8")
    print(len(meta), "spritů")
