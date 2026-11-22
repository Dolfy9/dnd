"""Import generated garden tiles and the three sail-raft sprites."""
import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageFilter

from asset_shadow_profiles import hull
from mapa_assety import key_magenta, repair_texture

ROOT = Path(__file__).resolve().parents[1]
MAPS = ROOT / "11_Mapy"
RAFT = "pristav-vor-plachta"
GROUNDS = {
    "zahrada-trava-kvety": "Zahrada – jetel a drobné květy",
    "zahrada-mech-listi": "Zahrada – mech a spadané listí",
    "zahrada-hlina-koreny": "Zahrada – vlhká hlína s kořeny",
}


def seams(image):
    a = np.asarray(image.convert("RGB"), dtype=float)
    return {axis: {"edge": round(float(edge.mean()), 3),
                   "interior_p95": round(float(np.percentile(inside.mean(axis=(1, 2)), 95)), 3)}
            for axis, edge, inside in [
                ("x", abs(a[:, 0] - a[:, -1]), abs(np.diff(a, axis=1)).transpose(1, 0, 2)),
                ("y", abs(a[0] - a[-1]), abs(np.diff(a, axis=0)))
            ]}


def sprite_profile(image):
    ratio = round(image.width / image.height, 5)
    image = image.copy()
    image.thumbnail((128, 128))
    alpha = np.asarray(image.getchannel("A"))
    points = []
    for y, row in enumerate(alpha):
        xs = np.flatnonzero(row >= 160)
        if len(xs):
            points += [(int(xs[0]) / image.width, y / image.height),
                       ((int(xs[-1]) + 1) / image.width, (y + 1) / image.height)]
    return [[round(x, 4), round(y, 4)] for x, y in hull(points)], ratio


def write_json(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n")


def main():
    from rembg import new_session, remove

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    source = parser.parse_args().source
    qc = {"source": "gen10", "textures": {}, "sprites": {}}
    tex_path = MAPS / "bojove/textury/textury.json"
    textures = json.loads(tex_path.read_text())
    for slug, name in GROUNDS.items():
        src = source / (slug + ".png")
        image = Image.open(src).convert("RGB").resize((512, 512), Image.Resampling.LANCZOS)
        before = seams(image)
        repair = any(s["edge"] > max(8, s["interior_p95"] * 1.5) for s in before.values())
        if repair:
            image = repair_texture(image)
        dest = MAPS / f"bojove/textury/t-{slug}.webp"
        image.save(dest, "WEBP", quality=90, method=6)
        qc["textures"][slug] = {"sha256": hashlib.sha256(src.read_bytes()).hexdigest(),
                                  "offset_blend": repair, "before": before,
                                  "after": seams(Image.open(dest))}
        entry = {"id": "t-" + slug, "nazev": name, "src": str(dest.relative_to(MAPS)), "cells": 4}
        textures["textury"] = [t for t in textures["textury"] if t["id"] != entry["id"]] + [entry]
    write_json(tex_path, textures)

    session = new_session("isnet-general-use", providers=["CPUExecutionProvider"])
    folder = MAPS / "bojove/assets/Přístav"
    profiles = []
    ratios = []
    variants = []
    for suffix in ("", "-v1", "-v2"):
        src = source / (RAFT + suffix + ".png")
        original = Image.open(src).convert("RGB")
        keyed = key_magenta(original, size=1024)
        # Restrict semantic cleanup to the keyed silhouette's edge.
        core = keyed.getchannel("A").point(lambda a: 255 if a >= 250 else 0).filter(ImageFilter.MinFilter(7))
        semantic = remove(keyed, session=session).getchannel("A")
        keyed.putalpha(ImageChops.darker(keyed.getchannel("A"), ImageChops.lighter(core, semantic)))
        keyed.thumbnail((512, 512), Image.Resampling.LANCZOS)
        pixels = np.array(keyed)
        pixels[:, :, 1] = np.maximum(pixels[:, :, 1], np.maximum(0, np.minimum(pixels[:, :, 0], pixels[:, :, 2]).astype(int) - 8))
        pixels[pixels[:, :, 3] == 0] = 0
        keyed = Image.fromarray(pixels)
        target = folder / ("varianty" if suffix else "") / (RAFT + suffix + ".webp")
        keyed.save(target, "WEBP", lossless=True, method=6, exact=True)
        image = Image.open(target).convert("RGBA")
        rgba = np.asarray(image, dtype=int)
        visible = rgba[:, :, 3] > 32
        fringe = (np.minimum(rgba[:, :, 0], rgba[:, :, 2]) - rgba[:, :, 1] > 30) & visible
        qc["sprites"][src.stem] = {"sha256": hashlib.sha256(src.read_bytes()).hexdigest(),
                                    "alpha_coverage": round(float(visible.mean()), 5),
                                    "magenta_pixels": int(fringe.sum())}
        profile, ratio = sprite_profile(image)
        profiles.append(profile)
        ratios.append(ratio)
        if suffix:
            variants.append(str(target.relative_to(MAPS)))
    path = MAPS / "bojove/assets/assety.json"
    manifest = json.loads(path.read_text())
    asset = {"id": RAFT, "nazev": "Vor s plátěnou plachtou", "kategorie": "Přístav",
             "src": f"bojove/assets/Přístav/{RAFT}.webp", "varianty": variants,
             "w": 3, "h": 3, "vyska": 1.2, "cover": 2, "tags": ["Přístav", "vor", "plachta"], "custom": False}
    manifest["assety"] = [a for a in manifest["assety"] if a["id"] != RAFT] + [asset]
    write_json(path, manifest)
    path = MAPS / "bojove/assets/stiny.json"
    data = json.loads(path.read_text())
    data[RAFT] = {"hulls": profiles, "ratios": ratios}
    path.write_text("{\n" + ",\n".join(json.dumps(k) + ":" + json.dumps(v, separators=(",", ":")) for k, v in data.items()) + "\n}\n")
    write_json(ROOT / "tools/gen10_asset_qc.json", qc)
    print(json.dumps(qc, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
