#!/usr/bin/env python3
"""Převede schválenou heraldiku do webových obrázků a doplní stránky."""
from collections import deque
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parent.parent
SOURCE = Path("/home/ubuntu/work/heraldika")
DATA = ROOT / "tools" / "heraldika.json"
LIMITS = {"znak": 640, "vlajka": 900}


def pale(rgb, kind):
    r, g, b = rgb
    if kind == "vlajka":
        return min(rgb) > 210 and max(rgb) - min(rgb) < 55 and sum(rgb) / 3 > 225
    return r > 160 and g > 115 and b > 70 and r >= g - 12 and g >= b - 15


def flood_mask(image, kind):
    width, height = image.size
    rgb = image.convert("RGB")
    pixels = rgb.load()
    try:
        import cv2
        import numpy as np

        source = np.asarray(rgb)
        mask = np.zeros((height + 2, width + 2), dtype=np.uint8)
        tolerance = 75 if kind == "znak" else 40
        flags = cv2.FLOODFILL_MASK_ONLY | cv2.FLOODFILL_FIXED_RANGE | 4 | (255 << 8)
        seeds = {(0, 0), (width - 1, 0), (0, height - 1), (width - 1, height - 1)}
        if kind == "vlajka":
            seeds.update((x, 0) for x in range(0, width, 16))
            seeds.update((x, height - 1) for x in range(0, width, 16))
            seeds.update((0, y) for y in range(0, height, 16))
            seeds.update((width - 1, y) for y in range(0, height, 16))
        for x, y in seeds:
            if pale(pixels[x, y], kind) and not mask[y + 1, x + 1]:
                cv2.floodFill(source.copy(), mask, (x, y), (0, 0, 0),
                              (tolerance,) * 3, (tolerance,) * 3, flags)
        return Image.fromarray((mask[1:-1, 1:-1] == 0).astype("uint8") * 255, "L")
    except ImportError:
        selected = bytearray(width * height)
        raw = rgb.tobytes()
        tolerance = 75 if kind == "znak" else 40
        seeds = {(0, 0), (width - 1, 0), (0, height - 1), (width - 1, height - 1)}
        if kind == "vlajka":
            seeds.update((x, 0) for x in range(0, width, 16))
            seeds.update((x, height - 1) for x in range(0, width, 16))
            seeds.update((0, y) for y in range(0, height, 16))
            seeds.update((width - 1, y) for y in range(0, height, 16))
        for seed in seeds:
            sx, sy = seed
            if selected[sy * width + sx] or not pale(pixels[sx, sy], kind):
                continue
            target = pixels[sx, sy]
            queue = deque([sy * width + sx])
            while queue:
                index = queue.pop()
                if selected[index]:
                    continue
                offset = index * 3
                current = raw[offset:offset + 3]
                if any(abs(current[i] - target[i]) > tolerance for i in range(3)):
                    continue
                if not pale(current, kind):
                    continue
                selected[index] = 1
                x, y = index % width, index // width
                if x: queue.append(index - 1)
                if x + 1 < width: queue.append(index + 1)
                if y: queue.append(index - width)
                if y + 1 < height: queue.append(index + width)
        return Image.frombytes("L", image.size, bytes(0 if value else 255 for value in selected))


def convert(source, target, kind):
    image = Image.open(source).convert("RGB")
    alpha = flood_mask(image, kind).filter(ImageFilter.GaussianBlur(.65))
    image.putalpha(alpha)
    if kind == "znak":
        box = alpha.point(lambda value: 255 if value > 16 else 0).getbbox()
        if box:
            image = image.crop(box)
        margin = max(1, round(max(image.size) * .04))
        image = ImageOps.expand(image, border=margin, fill=(0, 0, 0, 0))
    limit = LIMITS[kind]
    if image.width > limit:
        size = (limit, round(image.height * limit / image.width))
        image = image.resize(size, Image.Resampling.LANCZOS)
    target.parent.mkdir(parents=True, exist_ok=True)
    image.save(target, "WEBP", quality=88, method=6)
    return target


def section(record, folder, city=False):
    coat = f"obrazky/Znak_{record['id']}.webp"
    lines = ["## Heraldika", "", "> **Stav:** návrh", ""]
    images = [f"![Znak – {record['nazev']}]({coat}){{.heraldika-img .heraldika-znak}}"]
    if not city:
        flag = f"obrazky/Vlajka_{record['id']}.webp"
        images.append(f"![Vlajka – {record['nazev']}]({flag}){{.heraldika-img .heraldika-vlajka}}")
    lines.extend([" ".join(images), "", f"**Znak:** {record['znak']}"])
    if record.get("vlajka"):
        lines.extend(["", f"**Vlajka:** {record['vlajka']}"])
    if record.get("proc"):
        lines.extend(["", f"**Proč:** {record['proc']}"])
    lines.append("")
    return "\n".join(lines)


def insert_section(path, text):
    source = path.read_text(encoding="utf-8")
    if "## Heraldika" in source:
        normalized = source.rstrip() + "\n"
        if normalized != source:
            path.write_text(normalized, encoding="utf-8")
        return False
    match = __import__("re").search(r"(?m)^## Související\s*$", source)
    if match:
        updated = source[:match.start()].rstrip() + "\n\n" + text + "\n" + source[match.start():]
    else:
        updated = source.rstrip() + "\n\n" + text.rstrip() + "\n"
    if updated != source:
        path.write_text(updated, encoding="utf-8")
        return True
    return False


def contact_sheet(images, output):
    columns, cell_w, cell_h = 8, 220, 180
    rows = (len(images) * 2 + columns - 1) // columns
    sheet = Image.new("RGB", (columns * cell_w, rows * cell_h), "#f5efe2")
    draw = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 12)
    except OSError:
        font = ImageFont.load_default()
    for index, (name, path) in enumerate(images):
        asset = Image.open(path).convert("RGBA")
        for variant, background in enumerate(("#f5efe2", "#252321")):
            cell = index * 2 + variant
            x, y = (cell % columns) * cell_w, (cell // columns) * cell_h
            draw.rectangle((x, y, x + cell_w, y + cell_h), fill=background)
            thumb = asset.copy()
            thumb.thumbnail((cell_w - 20, cell_h - 38), Image.Resampling.LANCZOS)
            sheet.paste(thumb, (x + (cell_w - thumb.width) // 2, y + 4), thumb)
            color = "#171512" if variant == 0 else "#f5efe2"
            draw.text((x + 6, y + cell_h - 25), name + (" · světlé" if variant == 0 else " · tmavé"), fill=color, font=font)
    sheet.save(output, "JPEG", quality=90)


def main():
    data = json.loads(DATA.read_text(encoding="utf-8"))
    outputs = []
    pages = 0
    for record in data["zeme"]:
        page = ROOT / record["soubor"]
        parent = Path(record["soubor"]).parent
        target_dir = ROOT / parent / "obrazky"
        coat = convert(SOURCE / f"znak_{record['id']}.png", target_dir / f"Znak_{record['id']}.webp", "znak")
        flag = convert(SOURCE / f"vlajka_{record['id']}.png", target_dir / f"Vlajka_{record['id']}.webp", "vlajka")
        outputs.extend([(f"Znak_{record['id']}", coat), (f"Vlajka_{record['id']}", flag)])
        pages += insert_section(page, section(record, parent))
    for record in data["mesta"]:
        page = ROOT / record["soubor"]
        target = ROOT / Path(record["soubor"]).parent / "obrazky" / f"Znak_{record['id']}.webp"
        coat = convert(SOURCE / f"mesto_{record['id']}.png", target, "znak")
        outputs.append((f"Znak_{record['id']}", coat))
        pages += insert_section(page, section(record, Path(record["soubor"]).parent, city=True))
    contact_sheet(outputs, Path("/home/ubuntu/work/her_pruhledne.jpg"))
    print(f"Převedeno {len(outputs)} obrázků; doplněno {pages} stránek; kontaktní list vytvořen.")


if __name__ == "__main__":
    main()
