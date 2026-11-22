"""Import keyed garden beds, grass and statue with derived variants."""
import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageEnhance, ImageFilter, ImageOps

from import_gen10 import MAPS, ROOT, sprite_profile, write_json
from mapa_assety import key_magenta

ASSETS = {
    "zahrada-zahon-porost-a": ("Zarostlý růžový záhon", 6, 4, .4),
    "zahrada-zahon-porost-b": ("Divoký podrost s kapradím", 3, 3, .6),
    "zahrada-vysoka-trava": ("Vysoká tráva a plevel", 1.4, 1.4, .8),
    "zahrada-socha-podstavec": ("Zahalená socha na mechovém podstavci", 2.8, 2.8, 3),
}


def despill(image):
    pixels = np.array(image.convert("RGBA"))
    pixels[:, :, 1] = np.maximum(pixels[:, :, 1], np.maximum(0, np.minimum(pixels[:, :, 0], pixels[:, :, 2]).astype(int)-8))
    pixels[pixels[:, :, 3] == 0] = 0
    return Image.fromarray(pixels)


def variants(image):
    return [image, ImageOps.mirror(image), ImageEnhance.Color(ImageEnhance.Brightness(image).enhance(.94)).enhance(.85)]


def main():
    from rembg import new_session, remove

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    source = parser.parse_args().source
    missing = [slug for slug in ASSETS if not (source / (slug+".png")).is_file()]
    if missing:
        raise ValueError("Chybí zdrojové obrázky: " + ", ".join(missing))
    folder = MAPS / "bojove/assets/Zahrada"
    (folder / "varianty").mkdir(parents=True, exist_ok=True)
    manifest_path = MAPS / "bojove/assets/assety.json"
    profiles_path = MAPS / "bojove/assets/stiny.json"
    manifest = json.loads(manifest_path.read_text())
    profiles = json.loads(profiles_path.read_text())
    session = new_session("isnet-general-use", providers=["CPUExecutionProvider"])
    qc = {"source": "gen11", "sprites": {}}
    for slug, (name, w, h, height) in ASSETS.items():
        path = source / (slug+".png")
        with Image.open(path) as original:
            keyed = key_magenta(original, aspect=w/h, size=1024)
        core = keyed.getchannel("A").point(lambda a: 255 if a >= 250 else 0).filter(ImageFilter.MinFilter(7))
        semantic = remove(keyed, session=session).getchannel("A")
        keyed.putalpha(ImageChops.darker(keyed.getchannel("A"), ImageChops.lighter(core, semantic)))
        keyed.thumbnail((512,512), Image.Resampling.LANCZOS)
        if "zahon" in slug:
            keyed = ImageEnhance.Brightness(keyed).enhance(1.4)
        sources, hulls, ratios = [], [], []
        for i, image in enumerate(variants(keyed)):
            image = despill(image)
            target = folder / ("varianty" if i else "") / (slug + (f"-v{i}" if i else "") + ".webp")
            image.save(target, "WEBP", lossless=True, exact=True, method=6)
            sources.append(str(target.relative_to(MAPS)))
            outline, ratio = sprite_profile(image)
            hulls.append(outline)
            ratios.append(ratio)
            rgba = np.asarray(image, dtype=int)
            visible = rgba[:,:,3] > 32
            fringe = (np.minimum(rgba[:,:,0],rgba[:,:,2])-rgba[:,:,1] > 30) & (rgba[:,:,3]>0)
            qc["sprites"][target.stem] = dict(source_sha256=hashlib.sha256(path.read_bytes()).hexdigest(),
                                             magenta_pixels=int(fringe.sum()), alpha_coverage=round(float(visible.mean()),5))
        asset = dict(id=slug, nazev=name, kategorie="Zahrada", src=sources[0], varianty=sources[1:],
                     w=w, h=h, vyska=height, custom=False, tags=["Zahrada", "gen11"])
        if "socha" in slug:
            asset["cover"] = 3
        else:
            asset.update(z=-1, blocks=False)
        manifest["assety"] = [a for a in manifest["assety"] if a["id"] != slug] + [asset]
        profiles[slug] = dict(hulls=hulls, ratios=ratios)
    write_json(manifest_path, manifest)
    profiles_path.write_text("{\n" + ",\n".join(json.dumps(k)+":"+json.dumps(v,separators=(",",":")) for k,v in profiles.items()) + "\n}\n")
    write_json(ROOT / "tools/gen11_asset_qc.json", qc)
    print(json.dumps(qc, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
