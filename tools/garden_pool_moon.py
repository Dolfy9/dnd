"""Create a moonlit colour-grade variant of the generated garden fountain."""
import json
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
MAPS = ROOT / "11_Mapy"
ASSETS = MAPS / "bojove/assets"


def moon_grade(image):
    pixels = np.asarray(image.convert("RGBA")).copy()
    rgb = pixels[:, :, :3].astype(float)
    r, g, b = rgb.transpose(2, 0, 1)
    weight = np.clip((g - np.maximum(r, b)) / 18, 0, 1)[:, :, None]
    luminance = rgb @ np.array([.2126, .7152, .0722])
    cool = luminance[:, :, None] * np.array([.28, .5, .68])
    pixels[:, :, :3] = np.rint(rgb * (1 - weight) + cool * weight).astype("uint8")
    return Image.fromarray(pixels)


def main():
    manifest_path = ASSETS / "assety.json"
    manifest = json.loads(manifest_path.read_text())
    asset = next(a for a in manifest["assety"] if a["id"] == "z-jezirko-fontana")
    target = "bojove/assets/Zahrada/varianty/z-jezirko-fontana-v1.webp"
    with Image.open(MAPS / asset["src"]) as image:
        moon_grade(image).save(MAPS / target, "WEBP", lossless=True, exact=True, method=6)
    asset["varianty"] = [target]
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + "\n")
    path = ASSETS / "stiny.json"
    profiles = json.loads(path.read_text())
    entry = profiles[asset["id"]]
    entry["hulls"] = [entry["hulls"][0], entry["hulls"][0]]
    entry["ratios"] = [entry["ratios"][0], entry["ratios"][0]]
    path.write_text("{\n" + ",\n".join(json.dumps(k) + ":" + json.dumps(v, separators=(",", ":")) for k, v in profiles.items()) + "\n}\n")
    print("MOON_POOL_VARIANT", target)


if __name__ == "__main__":
    main()
