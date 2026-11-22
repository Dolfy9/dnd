"""Derive a muted night lawn from the generated seamless garden artwork."""
import json
from pathlib import Path

from PIL import Image, ImageEnhance

MAPS = Path(__file__).resolve().parents[1] / "11_Mapy"
TEXTURES = MAPS / "bojove/textury"
ID = "t-zahrada-trava-stin"


def night_lawn(image):
    return ImageEnhance.Brightness(ImageEnhance.Color(image.convert("RGB")).enhance(.45)).enhance(.78)


def main():
    target = TEXTURES / (ID + ".webp")
    with Image.open(TEXTURES / "t-zahrada-trava-kvety.webp") as image:
        night_lawn(image).save(target, "WEBP", lossless=True, method=6)
    path = TEXTURES / "textury.json"
    manifest = json.loads(path.read_text())
    entry = dict(id=ID, nazev="Zahrada – zastíněný jetel a květy", src=str(target.relative_to(MAPS)), cells=4)
    manifest["textury"] = [t for t in manifest["textury"] if t["id"] != ID] + [entry]
    path.write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + "\n")
    print("NIGHT_LAWN", target)


if __name__ == "__main__":
    main()
