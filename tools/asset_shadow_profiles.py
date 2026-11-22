"""Precompute opaque sprite hulls and physical height defaults for lighting."""
import json
import re
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / "11_Mapy"


def hull(points):
    points = sorted(set(points))
    def cross(o, a, b):
        return (a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0])
    def half(seq):
        out = []
        for p in seq:
            while len(out) > 1 and cross(out[-2], out[-1], p) <= 0:
                out.pop()
            out.append(p)
        return out
    result = half(points)[:-1] + half(reversed(points))[:-1]
    while len(result) > 20:
        i = min(range(len(result)), key=lambda i: abs(cross(result[i-1], result[i], result[(i+1) % len(result)])))
        result.pop(i)
    return result


def height(asset):
    text = (asset["id"] + " " + asset["nazev"]).lower()
    if asset.get("blend") or asset.get("z", 0) < 0 or re.search(r"koberec|rohoz|kvetinovy|květinový|p-site\b|sítě|m-sit\b|brectan|břečťan|kaluž|louže|puddle|obtisk|decal|paprsk|mlha|svetlus|odlesk|runova|runová|cesta|pavučin|web|kost|prulom|schod|trhlin|pazdrovi|vinorost|reka-prechod|koreny|kvety|smiti|ikona|paluba|p3-lana|kotva|lekniny|krev|kruh|\bruna\b|ohen|ohne|oheň|ohriste|ohniště|portal", text):
        return 0
    if re.search(r"sloup|soch|strom|smrk|skrin|skříň|rotunda|pilíř|pillar|wardrobe|stalaktit|stożar|stěžeň|skala|skála", text):
        return 3
    if re.search(r"fontana|fontána|urna|kolik|kolík|stul|stůl|postel|zidle|židle|plot|hrada|hradba|zídka|\bvor\b|\braft\b", text):
        return 1.2
    if re.search(r"lavic|lavič|bedn|crate|sud|barrel|ker|keř|bush|truhl|kamen|kámen|balvan", text):
        return .6
    return 1.2 if asset.get("blocks") or asset.get("cover") or asset.get("kategorie") in {"Nábytek", "Dungeon", "Město", "Loď", "Stavby", "Tábor/bitva"} else .6 if asset.get("kategorie") == "Příroda" else 0


def main():
    manifest = ROOT / "bojove/assets/assety.json"
    data = json.loads(manifest.read_text())
    profiles = {}
    for asset in data["assety"]:
        asset["vyska"] = height(asset)
        variants, ratios = [], []
        for source in [asset["src"], *asset.get("varianty", [])]:
            image = Image.open(ROOT / source).convert("RGBA")
            ratios.append(round(image.width/image.height, 5))
            image.thumbnail((128, 128))
            alpha = image.getchannel("A")
            points = []
            for y in range(image.height):
                xs = [x for x in range(image.width) if alpha.getpixel((x, y)) >= 160]
                if xs:
                    points.extend([(min(xs)/image.width, y/image.height), ((max(xs)+1)/image.width, (y+1)/image.height)])
            variants.append([[round(x, 4), round(y, 4)] for x, y in hull(points)])
        profiles[asset["id"]] = {"hulls": variants, "ratios": ratios}
    manifest.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n")
    (ROOT / "bojove/assets/stiny.json").write_text("{\n" + ",\n".join(json.dumps(k)+":"+json.dumps(v, separators=(",", ":")) for k, v in profiles.items()) + "\n}\n")


if __name__ == "__main__":
    main()
