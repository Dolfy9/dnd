#!/usr/bin/env python3
"""Require an exact Markdown-page match for every rules species."""
import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
data = json.loads((ROOT / "web/assets/pravidla2024.json").read_text(encoding="utf-8"))["druhy"]
slug = lambda name: "Druh_" + re.sub(r"[^A-Za-z0-9]+", "_", name).strip("_")
expected = {slug(name) + ".md" for name in data}
actual = {p.name for p in (ROOT / "13_Druhy").glob("Druh_*.md")}
missing, extra = sorted(expected - actual), sorted(actual - expected)
if missing or extra:
    print("Missing species pages:", missing)
    print("Extra species pages:", extra)
    raise SystemExit(1)
print(f"Species-page coverage: {len(expected)} pages, exact match")

paragraphs = defaultdict(list)
descriptive_sections = {
    "Přehled", "Vzhled", "Původ a mytologie", "Původ a kultura",
    "Společnost a kultura", "Jména", "Hraní postavy", "V Montelienu",
}
for path in sorted((ROOT / "13_Druhy").glob("Druh_*.md")):
    text = path.read_text(encoding="utf-8")
    if text.startswith("---"):
        text = text.split("---", 2)[-1]
    section = ""
    selected = []
    for line in text.splitlines():
        if line.startswith("## "):
            section = line[3:].strip()
        if section in descriptive_sections:
            selected.append(line)
    for block in re.split(r"\n\s*\n", "\n".join(selected)):
        paragraph = " ".join(block.split())
        if not paragraph or paragraph.startswith(("#", "-", "*", ">", "|", "<")):
            continue
        paragraph = re.sub(r"[*_`]", "", paragraph)
        paragraph = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", paragraph)
        paragraph = re.sub(r"\s+", " ", paragraph).strip().casefold()
        if paragraph:
            paragraphs[paragraph].append(path.name)

duplicates = {paragraph: pages for paragraph, pages in paragraphs.items() if len(pages) > 1}
if duplicates:
    print("Repeated prose paragraphs:")
    for paragraph, pages in sorted(duplicates.items()):
        print(f"- {len(pages)} pages: {', '.join(pages)}")
        print(f"  {paragraph}")
    raise SystemExit(1)
print("Duplicate-paragraph check: no repeated prose paragraphs")
