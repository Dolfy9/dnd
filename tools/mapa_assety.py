#!/usr/bin/env python3
"""Generátor / indexer assetů bojových map.

Použití:
    python3 tools/mapa_assety.py            # vypíše, co chybí; s OPENAI_API_KEY generuje
    python3 tools/mapa_assety.py --index    # jen přeindexovat složky (ručně vložené obrázky)

- Assety: 11_Mapy/bojove/assets/<kategorie>/<id>.webp, manifest assety.json.
- Textury: 11_Mapy/bojove/textury/<id>.webp (512 px = 4 buňky), manifest textury.json.
- Ručně vložené PNG/WebP soubory se při běhu převedou na WebP a zaindexují.
- S nastaveným OPENAI_API_KEY generuje chybějící přes Images API (gpt-image-1,
  transparent PNG), ořízne průhledné okraje a uloží WebP.
- Bez klíče vypíše seznam chybějících a skončí s 0.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "11_Mapy" / "bojove" / "assets"
TEXDIR = ROOT / "11_Mapy" / "bojove" / "textury"
PROMPTS = ROOT / "tools" / "mapa_assety_prompty.json"
MANIFEST_A = ASSETS / "assety.json"
MANIFEST_T = TEXDIR / "textury.json"
TEX_CELLS = 4  # 512 px tile = 4×4 buňky


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
    im.thumbnail((1024, 1024))
    im.save(dst, "WEBP", quality=88)


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
    for a in prompts["assety"]:
        kat_dir = ASSETS / a["kategorie"]
        img = kat_dir / f"{a['id']}.webp"
        if img.is_file():
            entries.append({"id": a["id"], "nazev": a["nazev"], "kategorie": a["kategorie"],
                            "src": f"bojove/assets/{a['kategorie']}/{a['id']}.webp",
                            "tags": [a["kategorie"]]})
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
            missing.append(a)
    return entries, missing


def index_textures(prompts: dict) -> tuple[list[dict], list[dict]]:
    entries, missing = [], []
    for t in prompts["textury"]:
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
            missing.append(t)
    return entries, missing


def main() -> int:
    prompts = load_prompts()
    ASSETS.mkdir(parents=True, exist_ok=True)
    TEXDIR.mkdir(parents=True, exist_ok=True)

    index_only = "--index" in sys.argv
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
