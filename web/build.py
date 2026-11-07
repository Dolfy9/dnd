#!/usr/bin/env python3
"""Připraví web (MkDocs Material) z obsahu repozitáře.

Vytvoří web/docs (symlinky na složky s obsahem), stránku s interaktivní mapou
a web/mkdocs.yml s navigací podle nadpisů souborů. Spuštění: web/serve.sh
"""
import json, os, re, shutil
from pathlib import Path

WEB = Path(__file__).resolve().parent
ROOT = WEB.parent
DOCS = WEB / "docs"
SKIP = {"_import", "tools", "web", ".git", ".obsidian"}
NAMES = {
    "01_Svet": "Svět", "Mista": "Místa", "02_Zeme": "Země", "03_Mesta": "Města",
    "04_Postavy": "Postavy", "Stavitele_a_Bohove": "Stavitelé a bohové",
    "Vladci": "Vládci", "NPC": "NPC", "05_Frakce": "Frakce",
    "06_Knihy_a_Dokumenty": "Knihy a dokumenty", "07_Kampane": "Kampaně",
    "08_Questy": "Questy", "09_Hadanky": "Hádanky", "10_Sezeni": "Sezení",
    "11_Mapy": "Mapy", "_Sablony": "Šablony",
}
PREFIX = re.compile(r"^(Postava|Město|Mesto|Země|Quest|Hádanka|Sezení|Kampaň|Šablona)\s*:\s*", re.I)


def title(md: Path) -> str:
    for line in md.read_text(encoding="utf-8").splitlines():
        if line.startswith("# "):
            return PREFIX.sub("", line[2:].strip()).replace('"', "'")
    return md.stem.replace("_", " ")


def nav_for(dir_: Path, rel: str):
    items = []
    readme = dir_ / "README.md"
    if readme.exists():
        items.append(f"{rel}/README.md")
    files = sorted(p for p in dir_.glob("*.md") if p.name != "README.md")
    for f in files:
        items.append({title(f): f"{rel}/{f.name}"})
    for sub in sorted(p for p in dir_.iterdir() if p.is_dir()):
        sub_items = nav_for(sub, f"{rel}/{sub.name}")
        if sub_items:
            items.append({NAMES.get(sub.name, sub.name.replace("_", " ")): sub_items})
    return items


def yaml_nav(items, indent=2):
    out = []
    pad = " " * indent
    for it in items:
        if isinstance(it, str):
            out.append(f"{pad}- {it}")
        else:
            (k, v), = it.items()
            if isinstance(v, str):
                out.append(f'{pad}- "{k}": {v}')
            else:
                out.append(f'{pad}- "{k}":')
                out.extend(yaml_nav(v, indent + 4))
    return out


def map_page():
    data = json.loads((ROOT / "11_Mapy" / "mista.json").read_text(encoding="utf-8"))
    for m in data["mista"]:
        m["url"] = "../" + re.sub(r"(README)?\.md$", "", m["odkaz"]) + ("" if m["odkaz"].endswith("README.md") else "/")
    return f"""---
hide:
  - toc
---
# Interaktivní mapa

<link rel="stylesheet" href="../assets/leaflet/leaflet.css">
<div class="mapa-legenda">
  <span><i class="tecka jistota-mapa"></i> popsáno na mapě DM</span>
  <span><i class="tecka jistota-kanon"></i> potvrzeno DM</span>
  <span><i class="tecka jistota-odhad"></i> odhad (návrh)</span>
  <label><input type="checkbox" id="mapa-body" checked> místa</label>
  <label><input type="checkbox" id="mapa-sidla"> sídla bez jména</label>
</div>
<div id="mapa"></div>
<p class="mapa-pozn">Kolečkem přibližuj, klikni na bod pro detail. Vrstvy vpravo nahoře: barevná mapa / původní kresba.
Polohy „odhad“ čekají na potvrzení – viz <a href="../11_Mapy/Geografie/">Geografie</a>.</p>
<script src="../assets/leaflet/leaflet.js"></script>
<script>window.MONTELIEN_MISTA = {json.dumps(data, ensure_ascii=False)};</script>
<script src="../assets/mapa.js"></script>
"""


def main():
    if DOCS.exists():
        shutil.rmtree(DOCS)
    DOCS.mkdir()
    sections = []
    for d in sorted(p for p in ROOT.iterdir() if p.is_dir() and p.name not in SKIP and not p.name.startswith(".")):
        os.symlink(os.path.relpath(d, DOCS), DOCS / d.name)
        items = nav_for(d, d.name)
        if items:
            sections.append({NAMES.get(d.name, d.name): items})
    for f in ["README.md", "Otevrene_otazky.md", "AGENTS.md"]:
        os.symlink(os.path.relpath(ROOT / f, DOCS), DOCS / f)
    os.symlink(os.path.relpath(WEB / "assets", DOCS), DOCS / "assets")
    (DOCS / "mapa.md").write_text(map_page(), encoding="utf-8")

    nav = ["README.md", {"Interaktivní mapa": "mapa.md"}] + sections + [
        {"Otevřené otázky": "Otevrene_otazky.md"}, {"Pravidla projektu": "AGENTS.md"}]
    watch = "\n".join(f"  - ../{d}" for d in [s for s in os.listdir(ROOT)
                      if (ROOT / s).is_dir() and s not in SKIP and not s.startswith(".")])
    cfg = f"""# Generováno web/build.py – neupravovat ručně
site_name: Montelien
site_description: Lore a kampaně D&D 5e (2024)
docs_dir: docs
site_dir: site
use_directory_urls: true
theme:
  name: material
  language: cs
  font: false
  palette:
    - scheme: slate
      primary: brown
      accent: amber
      toggle: {{icon: material/weather-sunny, name: Světlý režim}}
    - scheme: default
      primary: brown
      accent: deep orange
      toggle: {{icon: material/weather-night, name: Tmavý režim}}
  features:
    - navigation.tabs
    - navigation.sections
    - navigation.indexes
    - navigation.top
    - navigation.tracking
    - search.suggest
    - search.highlight
    - toc.follow
  icon:
    logo: material/castle
hooks:
  - hooks.py
plugins:
  - search:
      separator: '[\\s\\-_,:!=\\[\\]()"/]+'
markdown_extensions:
  - tables
  - toc: {{permalink: true}}
  - admonition
  - attr_list
  - md_in_html
  - meta
extra_css:
  - assets/easymde/easymde.min.css
  - assets/extra.css
  - assets/postava.css
extra_javascript:
  - assets/easymde/easymde.min.js
  - assets/extra.js
  - assets/editor.js
  - assets/postava.js
not_in_nav: |
  /mapa.md
validation:
  omitted_files: ignore
  absolute_links: ignore
  unrecognized_links: ignore
  anchors: ignore
watch:
{watch}
  - assets
nav:
""" + "\n".join(yaml_nav(nav)) + "\n"
    (WEB / "mkdocs.yml").write_text(cfg, encoding="utf-8")
    print("Web připraven: web/docs, web/mkdocs.yml")


if __name__ == "__main__":
    main()
