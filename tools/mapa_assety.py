#!/usr/bin/env python3
"""Generátor / indexer assetů bojových map.

Použití:
    python3 tools/mapa_assety.py            # vypíše, co chybí; s OPENAI_API_KEY generuje
    python3 tools/mapa_assety.py --index    # jen přeindexovat složky (ručně vložené obrázky)
    python3 tools/mapa_assety.py --import DIR [--legacy DIR]

- Assety: 11_Mapy/bojove/assets/<kategorie>/<id>.webp, manifest assety.json.
- Textury: 11_Mapy/bojove/textury/<id>.webp (512 px = 4 buňky), manifest textury.json.
- Ručně vložené PNG/WebP soubory se při běhu převedou na WebP a zaindexují.
- S nastaveným OPENAI_API_KEY generuje chybějící přes Images API (gpt-image-1,
  transparent PNG), ořízne průhledné okraje a uloží WebP.
- Bez klíče vypíše seznam chybějících a skončí s 0.
"""
from __future__ import annotations

import argparse
import json
import math
import os
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "11_Mapy" / "bojove" / "assets"
TEXDIR = ROOT / "11_Mapy" / "bojove" / "textury"
PROMPTS = ROOT / "tools" / "mapa_assety_prompty.json"
MANIFEST_A = ASSETS / "assety.json"
MANIFEST_T = TEXDIR / "textury.json"
TEX_CELLS = 4  # 512 px tile = 4×4 buňky

LEGACY_TEXTURES = {
    "mesto": "Městská dlažba", "krypta": "Podlaha krypty", "les": "Lesní půda", "ruiny": "Ruiny",
    "reka": "Říční břeh", "more": "Moře", "pristav": "Přístav", "bazina": "Bažina",
    "snih": "Sníh", "jeskyne": "Jeskyně", "hory": "Hory", "poust": "Poušť", "plaz": "Pláž",
    "g": "Tráva", "r": "Cesta", "wall": "Zdivo", "rubble": "Sutiny", "voda": "Hluboká voda",
    "melcina": "Mělčina", "most": "Most", "propast": "Propast", "schody": "Schody",
    "skala": "Přírodní skalní stěna", "bedrock": "Skalní masiv", "mlha": "Mlha",
    "parchment": "Pergamen", "panel": "Dřevěný panel",
}
LEGACY_PROPS = {
    "strom": "Dub", "strom2": "Borovice", "strom3": "Bříza", "ker": "Keř", "ker2": "Křoví",
    "balvan": "Balvan", "balvan2": "Skaliska", "sloup": "Sloup", "bedny": "Bedny", "sudy": "Sudy",
    "ohen": "Oheň", "dvere": "Dveře", "sarkofag": "Sarkofág", "kosti": "Kosti",
    "portal": "Modrý portál", "portal2": "Fialový portál", "lucerna": "Lucerna", "pochoden": "Pochodeň",
    "stul": "Stůl", "zidle": "Židle", "koberec": "Koberec", "studna": "Studna", "oltar": "Oltář",
    "socha": "Socha", "kmen": "Kmen", "parez": "Pařez", "houby": "Houby", "lekniny": "Lekníny",
    "rakos": "Rákos", "stan": "Stan", "vuz": "Vůz", "krev": "Krev", "truhla": "Truhla",
    "regal": "Regál", "krystal": "Krystal", "hrob": "Hrob", "kapradi": "Kapradí", "keltsky_kamen": "Runový kámen",
}


def legacy_assets() -> list[dict]:
    entries = []
    for key, name in LEGACY_PROPS.items():
        natural = key.startswith(("strom", "ker", "balvan")) or key in (
            "kmen", "parez", "houby", "lekniny", "rakos", "kapradi", "krystal")
        category = "Příroda" if natural else "Magie" if key.startswith("portal") else "Rekvizity"
        large = key.startswith("strom") or key in ("vuz", "stan")
        entry = {"id": "gen2-" + key, "nazev": name + " – realistický", "kategorie": category,
                 "w": 2 if large else 1, "h": 2 if large else 1, "custom": False}
        if key.startswith(("strom", "balvan")) or key in ("sloup", "socha", "studna", "oltar", "regal"):
            entry.update(blocks=True, cover=3)
        elif key in ("bedny", "sudy", "kmen", "parez", "vuz", "sarkofag", "truhla", "stul"):
            entry.update(cover=2, difficult=True)
        elif key.startswith("ker") or key in ("kapradi", "rakos"):
            entry.update(difficult=True)
        if key in ("ohen", "lucerna", "pochoden"):
            entry["light"] = {"bright": 10, "dim": 10}
        entries.append(entry)
    return entries


def repair_texture(image):
    from PIL import Image, ImageChops
    image = image.convert("RGB").resize((512, 512), Image.Resampling.LANCZOS)
    weights = [round(255 * (1 + math.cos(math.pi * min(1, min(i, 511 - i) / 112))) / 2) for i in range(512)]
    strip = Image.new("L", (512, 1))
    strip.putdata(weights)
    for axis in (0, 1):
        mask = (strip if axis == 0 else strip.transpose(Image.Transpose.ROTATE_90)).resize((512, 512))
        shifted = ImageChops.offset(image, 256 if axis == 0 else 0, 256 if axis else 0)
        image = Image.composite(shifted, image, mask)
    return image


def key_magenta(image):
    from PIL import Image, ImageChops, ImageMath
    image = image.convert("RGBA")
    r, g, b, original_alpha = image.split()
    spill = ImageChops.subtract(ImageChops.darker(r, b), g)
    alpha = ImageChops.invert(spill)
    denominator = ImageChops.lighter(alpha, Image.new("L", image.size, 1))
    channels = [ImageMath.lambda_eval(
        lambda v: v["convert"]((v["c"] - v["s"]) * 255 / v["d"], "L"),
        c=c, s=spill, d=denominator) for c in (r, g, b)]
    alpha = ImageChops.multiply(alpha.point(lambda a: 0 if a <= 6 else a), original_alpha)
    result = Image.merge("RGBA", (*channels, alpha))
    bbox = alpha.getbbox()
    if bbox is None:
        return Image.new("RGBA", (512, 512))
    result = result.crop(bbox)
    side = max(result.size)
    padding = max(1, round(side * .04))
    square = Image.new("RGBA", (side + 2 * padding, side + 2 * padding))
    square.paste(result, ((square.width - result.width) // 2, (square.height - result.height) // 2))
    return square.resize((512, 512), Image.Resampling.LANCZOS)


def import_images(source: Path, prompts: dict) -> None:
    from PIL import Image
    expected = [(source / "assets" / (a["id"] + ".png"), ASSETS / a["kategorie"] / (a["id"] + ".webp"), True)
                for a in prompts["assety"]]
    expected += [(source / "textury" / (t["id"] + ".png"), TEXDIR / (t["id"] + ".webp"), False)
                 for t in prompts["textury"]]
    missing = [str(src) for src, _, _ in expected if not src.is_file()]
    if missing:
        raise ValueError("Chybí zdrojové obrázky: " + ", ".join(missing))
    for src, dst, keyed in expected:
        dst.parent.mkdir(parents=True, exist_ok=True)
        with Image.open(src) as image:
            result = key_magenta(image) if keyed else repair_texture(image)
            result.save(dst, "WEBP", quality=80, method=6, exact=True)
    print(f"Import: {len(expected)} obrázků.")


def import_legacy(source: Path) -> None:
    from PIL import Image
    for key in LEGACY_TEXTURES:
        shutil.copyfile(source / "tex" / (key + ".webp"), TEXDIR / ("teren-" + key + ".webp"))
    for entry in legacy_assets():
        dst = ASSETS / entry["kategorie"]
        dst.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source / "prop" / (entry["id"].removeprefix("gen2-") + ".webp"), dst / (entry["id"] + ".webp"))
    for kind, folder in (("fx", "fx"), ("ovl", "ovl"), ("icon", "ikony")):
        target = ASSETS.parent / folder
        target.mkdir(parents=True, exist_ok=True)
        for path in (source / kind).glob("*.webp"):
            with Image.open(path) as image:
                if max(image.size) > 512:
                    image.thumbnail((512, 512), Image.Resampling.LANCZOS)
                    image.save(target / path.name, "WEBP", quality=80, method=6, exact=True)
                else:
                    shutil.copyfile(path, target / path.name)


def load_prompts() -> dict:
    return json.loads(PROMPTS.read_text(encoding="utf-8"))


def to_webp(src: Path, dst: Path, trim: bool = True) -> None:
    from PIL import Image
    im = Image.open(src).convert("RGBA")
    if trim:
        bbox = im.getchannel("A").getbbox()
        if bbox:
            pad = 8
            im = im.crop((max(0, bbox[0] - pad), max(0, bbox[1] - pad),
                          min(im.width, bbox[2] + pad), min(im.height, bbox[3] + pad)))
    im.thumbnail((512, 512))
    im.save(dst, "WEBP", quality=80, method=6)


def gen_image(client, prompt: str, transparent: bool) -> bytes | None:
    try:
        r = client.images.generate(model="gpt-image-1", prompt=prompt, size="1024x1024",
                                   background="transparent" if transparent else "opaque", n=1)
        import base64
        return base64.b64decode(r.data[0].b64_json)
    except Exception as e:  # noqa: BLE001
        print(f"  ! generování selhalo: {e}")
        return None


def index_assets(prompts: dict) -> tuple[list[dict], list[dict]]:
    """Přeindexuj složku assets → manifest entries + seznam chybějících."""
    entries, missing = [], []
    for a in prompts["assety"] + legacy_assets():
        kat_dir = ASSETS / a["kategorie"]
        img = kat_dir / f"{a['id']}.webp"
        if img.is_file():
            entries.append({"id": a["id"], "nazev": a["nazev"], "kategorie": a["kategorie"],
                            "src": f"bojove/assets/{a['kategorie']}/{a['id']}.webp",
                            "tags": [a["kategorie"]], "custom": False,
                            **{k: a[k] for k in ("w", "h", "blocks", "cover", "difficult", "light") if k in a}})
        else:
            # ručně vložené png/jpg → konvertovat
            alt = next((kat_dir.glob(f"{a['id']}.*")), None) if kat_dir.is_dir() else None
            if alt and alt.suffix.lower() in (".png", ".jpg", ".jpeg", ".webp") and alt.name != img.name:
                kat_dir.mkdir(parents=True, exist_ok=True)
                try:
                    to_webp(alt, img)
                    entries.append({"id": a["id"], "nazev": a["nazev"], "kategorie": a["kategorie"],
                                    "src": f"bojove/assets/{a['kategorie']}/{a['id']}.webp",
                                    "tags": [a["kategorie"]]})
                    continue
                except Exception as e:  # noqa: BLE001
                    print(f"  ! konverze {alt.name}: {e}")
            if "prompt" in a:
                missing.append(a)
    return entries, missing


def index_textures(prompts: dict) -> tuple[list[dict], list[dict]]:
    entries, missing = [], []
    for t in prompts["textury"] + [{"id": "teren-" + k, "nazev": n} for k, n in LEGACY_TEXTURES.items()]:
        img = TEXDIR / f"{t['id']}.webp"
        if img.is_file():
            entries.append({"id": t["id"], "nazev": t["nazev"],
                            "src": f"bojove/textury/{t['id']}.webp", "cells": TEX_CELLS})
        else:
            alt = next((TEXDIR.glob(f"{t['id']}.*")), None) if TEXDIR.is_dir() else None
            if alt and alt.suffix.lower() in (".png", ".jpg", ".jpeg", ".webp") and alt.name != img.name:
                try:
                    to_webp(alt, img, trim=False)
                    entries.append({"id": t["id"], "nazev": t["nazev"],
                                    "src": f"bojove/textury/{t['id']}.webp", "cells": TEX_CELLS})
                    continue
                except Exception as e:  # noqa: BLE001
                    print(f"  ! konverze {alt.name}: {e}")
            if "prompt" in t:
                missing.append(t)
    return entries, missing


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--index", action="store_true")
    parser.add_argument("--import", dest="source", type=Path)
    parser.add_argument("--legacy", type=Path, help="Dřívější složka boj/{tex,prop,fx,ovl,icon}")
    args = parser.parse_args()
    prompts = load_prompts()
    ASSETS.mkdir(parents=True, exist_ok=True)
    TEXDIR.mkdir(parents=True, exist_ok=True)

    if args.source:
        import_images(args.source.expanduser(), prompts)
    if args.legacy:
        import_legacy(args.legacy.expanduser())
    index_only = args.index or args.source is not None or args.legacy is not None
    key = os.environ.get("OPENAI_API_KEY")
    client = None
    if key and not index_only:
        try:
            from openai import OpenAI
            client = OpenAI()
        except Exception as e:  # noqa: BLE001
            print(f"OpenAI klient nedostupný ({e}) — jen indexuji.")

    entries_a, missing_a = index_assets(prompts)
    entries_t, missing_t = index_textures(prompts)

    if client and missing_a:
        print(f"Generuji {len(missing_a)} assetů…")
        still = []
        for a in missing_a:
            dst_dir = ASSETS / a["kategorie"]
            dst_dir.mkdir(parents=True, exist_ok=True)
            img = dst_dir / f"{a['id']}.webp"
            raw = gen_image(client, f"{prompts['style_asset']}. {a['prompt']}", True)
            if raw:
                tmp = dst_dir / f"{a['id']}.png"
                tmp.write_bytes(raw)
                try:
                    to_webp(tmp, img)
                    tmp.unlink()
                    entries_a.append({"id": a["id"], "nazev": a["nazev"], "kategorie": a["kategorie"],
                                      "src": f"bojove/assets/{a['kategorie']}/{a['id']}.webp",
                                      "tags": [a["kategorie"]]})
                    print(f"  + {a['id']}")
                    continue
                except Exception as e:  # noqa: BLE001
                    print(f"  ! webp {a['id']}: {e}")
            still.append(a)
        missing_a = still

    if client and missing_t:
        print(f"Generuji {len(missing_t)} textur…")
        still = []
        for t in missing_t:
            img = TEXDIR / f"{t['id']}.webp"
            raw = gen_image(client, f"{prompts['style_texture']}. {t['prompt']}", False)
            if raw:
                tmp = TEXDIR / f"{t['id']}.png"
                tmp.write_bytes(raw)
                try:
                    to_webp(tmp, img, trim=False)
                    tmp.unlink()
                    entries_t.append({"id": t["id"], "nazev": t["nazev"],
                                      "src": f"bojove/textury/{t['id']}.webp", "cells": TEX_CELLS})
                    print(f"  + {t['id']}")
                    continue
                except Exception as e:  # noqa: BLE001
                    print(f"  ! webp {t['id']}: {e}")
            still.append(t)
        missing_t = still

    # zachovat custom položky manifestu (uploady z editoru)
    if MANIFEST_A.is_file():
        try:
            old = json.loads(MANIFEST_A.read_text(encoding="utf-8")).get("assety", [])
            have = {e["id"] for e in entries_a}
            entries_a += [e for e in old if e.get("id") not in have and e.get("custom")]
        except ValueError:
            pass
    MANIFEST_A.write_text(json.dumps({"assety": entries_a}, ensure_ascii=False, indent=1), encoding="utf-8")
    MANIFEST_T.write_text(json.dumps({"textury": entries_t}, ensure_ascii=False, indent=1), encoding="utf-8")

    print(f"Manifest: {len(entries_a)} assetů, {len(entries_t)} textur.")
    if missing_a:
        print(f"Chybí {len(missing_a)} assetů: {', '.join(a['id'] for a in missing_a[:20])}…")
    if missing_t:
        print(f"Chybí {len(missing_t)} textur: {', '.join(t['id'] for t in missing_t)}")
    if not client and (missing_a or missing_t):
        print("OPENAI_API_KEY není nastaven — generování přeskočeno (vlož obrázky ručně a spusť znovu).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
