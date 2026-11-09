#!/usr/bin/env python3
"""Check class-page coverage, rendered length, and repeated authored paragraphs."""
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "web"))
import hooks

classes = json.loads((ROOT / "web/assets/pravidla2024.json").read_text(encoding="utf-8"))["tridy"]
slug = lambda name: "Povolani_" + re.sub(r"[^A-Za-z0-9]+", "_", name).strip("_")
expected = {slug(name) + ".md" for name in classes}
actual = {path.name for path in (ROOT / "14_Povolani").glob("Povolani_*.md")}
missing, extra = sorted(expected - actual), sorted(actual - expected)
if missing or extra:
    print("Missing class pages:", missing)
    print("Extra class pages:", extra)
    raise SystemExit(1)
print(f"Class-page coverage: {len(expected)} pages, exact match")

prose_sections = {
    "Přehled", "Fantazie a role ve skupině", "Jak se hraje", "Doporučené volby 2024",
    "Multiclass", "Tipy pro hráče a DM", "3 háčky", "V Montelienu",
}
paragraphs = defaultdict(list)
short_pages = []
for name in classes:
    path = ROOT / "14_Povolani" / (slug(name) + ".md")
    text = path.read_text(encoding="utf-8")
    rendered = hooks._class_page(text, path.relative_to(ROOT).as_posix(), ROOT)
    rendered = re.sub(r"(?ms)^---\n.*?\n---\n", "", rendered)
    rendered = re.sub(r"<!--.*?-->", " ", rendered, flags=re.S)
    rendered = re.sub(r"<[^>]+>", " ", rendered)
    if len(re.findall(r"[\w’'-]+", rendered, flags=re.UNICODE)) < 900:
        short_pages.append(path.name)

    source = re.sub(r"(?ms)^---\n.*?\n---\n", "", text)
    section = ""
    selected = []
    for line in source.splitlines():
        if line.startswith("## "):
            section = line[3:].strip()
        if section in prose_sections:
            selected.append(line)
    for block in re.split(r"\n\s*\n", "\n".join(selected)):
        paragraph = " ".join(block.split())
        if not paragraph or paragraph.startswith(("#", "-", "*", ">", "|", "<")):
            continue
        paragraph = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", paragraph)
        paragraph = re.sub(r"[*_`]", "", paragraph)
        paragraph = re.sub(r"\s+", " ", paragraph).strip().casefold()
        if len(paragraph.split()) >= 8:
            paragraphs[paragraph].append(path.name)

if short_pages:
    print("Class pages below 900 rendered words:", short_pages)
    raise SystemExit(1)
duplicates = {paragraph: pages for paragraph, pages in paragraphs.items() if len(pages) > 1}
if duplicates:
    print("Repeated class-page prose paragraphs:")
    for paragraph, pages in sorted(duplicates.items()):
        print(f"- {len(pages)} pages: {', '.join(pages)}")
        print(f"  {paragraph}")
    raise SystemExit(1)
print("Rendered length: every class page has at least 900 words")
print("Duplicate-paragraph check: no repeated authored prose paragraphs")
