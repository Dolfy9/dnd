#!/usr/bin/env python3
"""Připraví web (MkDocs Material) z obsahu repozitáře.

Vytvoří web/docs (symlinky na složky s obsahem), stránku s interaktivní mapou
a web/mkdocs.yml s navigací podle nadpisů souborů. Spuštění: web/serve.sh
"""
import json, os, re, shutil
from pathlib import Path
import boje

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


def boj_index():
    """Seznam postav s daty z front matter pro bojový modul."""
    import yaml
    out = []
    for p in sorted((ROOT / "04_Postavy").rglob("*.md")):
        t = p.read_text(encoding="utf-8")
        if not t.startswith("---"):
            continue
        try:
            meta = yaml.safe_load(t.split("---", 2)[1]) or {}
        except Exception:
            continue
        if meta.get("postava"):
            out.append({"cesta": str(p.relative_to(ROOT)), "postava": meta["postava"]})
    (DOCS / "boj_postavy.json").write_text(json.dumps(out, ensure_ascii=False, default=str), encoding="utf-8")


def map_page():
    data = json.loads((ROOT / "11_Mapy" / "mista.json").read_text(encoding="utf-8"))
    for m in data["mista"]:
        m["url"] = "../" + re.sub(r"(README)?\.md$", "", m["odkaz"]) + ("" if m["odkaz"].endswith("README.md") else "/")
    bm = json.loads((ROOT / "11_Mapy" / "bojove_mapy.json").read_text(encoding="utf-8"))
    data["boj"] = [{"id": x["id"], "nazev": x["nazev"], "misto": x.get("misto") or "", "obrazek": x.get("obrazek", "")} for x in bm["mapy"]]
    return f"""---
hide:
  - toc
---
# Interaktivní mapa

<link rel="stylesheet" href="../assets/leaflet/leaflet.css">
<link rel="stylesheet" href="../assets/leaflet/leaflet-geoman.css">
<div class="mapa-legenda">
  <input type="search" id="mapa-hledat" placeholder="Hledat místo…" list="mapa-seznam"><datalist id="mapa-seznam"></datalist>
  <span><i class="tecka jistota-mapa"></i> popsáno na mapě DM</span>
  <span><i class="tecka jistota-kanon"></i> potvrzeno DM</span>
  <span><i class="tecka jistota-odhad"></i> odhad (návrh)</span>
  <label><input type="checkbox" id="mapa-body" checked> místa</label>
  <label><input type="checkbox" id="mapa-sidla"> sídla bez jména</label>
  <label><input type="checkbox" id="mapa-stitky"> jména měst</label>
  <label><input type="checkbox" id="mapa-boj" checked> ⚔ bojové mapy</label>
  <button type="button" id="mapa-editor" class="ed-only" title="Upravit pobřeží, oblasti, řeky, symboly a popisky">✎ Editor mapy</button>
  <button type="button" id="mapa-meric" title="Klikáním do mapy změříš trasu">⟷ Měřit trasu</button>
</div>
<div id="mapa"></div>
<p class="mapa-pozn">Kolečkem přibližuj, klikni na bod pro detail. Vrstvy vpravo nahoře: atlas z dat (upravitelný v režimu úprav tlačítkem Editor mapy) / ilustrovaná mapa / věrná barevná mapa / původní kresba DM.
Měření trasy počítá s měřítkem z kresby DM (150 km dílek) a cestovním tempem PHB 2024 (Slow 18, Normal 24, Fast 30 mil za den).
Polohy „odhad“ čekají na potvrzení – viz <a href="../11_Mapy/Geografie/">Geografie</a>.</p>
<script src="../assets/leaflet/leaflet.js"></script>
<script>window.MONTELIEN_MISTA = {json.dumps(data, ensure_ascii=False)};</script>
<script src="../assets/leaflet/leaflet-geoman.min.js"></script>
<script src="../assets/svet_symboly.js"></script>
<script src="../assets/svet.js"></script>
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
    (DOCS / "bestiar.md").write_text("---\nhide:\n  - toc\n---\n# Bestiář (SRD 5.2.1)\n\nNetvoři ze SRD 5.2.1 se statbloky. Filtruj podle typu a CR, klikni pro statblok. Obsah SRD 5.2.1 je pod licencí CC-BY 4.0.\n\n<div class=\"srd-katalog\" data-typ=\"bestiar\"></div>\n", encoding="utf-8")
    (DOCS / "predmety.md").write_text("---\nhide:\n  - toc\n---\n# Předměty a výbava (SRD 5.2.1)\n\nZbraně, zbroje, výbava a kouzelné předměty. Obsah SRD 5.2.1 je pod licencí CC-BY 4.0.\n\n<div class=\"srd-katalog\" data-typ=\"predmety\"></div>\n", encoding="utf-8")
    (DOCS / "glosar.md").write_text("---\nhide:\n  - toc\n---\n# Glosář pravidel (SRD 5.2.1)\n\nDefinice pravidel 2024 (stavy, akce, pojmy). Obsah SRD 5.2.1 je pod licencí CC-BY 4.0.\n\n<div class=\"srd-katalog\" data-typ=\"glosar\"></div>\n", encoding="utf-8")
    (DOCS / "boj.md").write_text("---\nhide:\n  - toc\n  - navigation\n---\n# Bojový modul\n\nBojové mapy s mřížkou (1 pole = 5 ft), žetony postav a netvorů, iniciativa a bojový pomocník podle pravidel 2024.\n\n<div id=\"boj-app\"></div>\n", encoding="utf-8")
    boj_index()
    boje.write_index(DOCS)
    (DOCS / "boje.md").write_text("---\nhide:\n  - toc\n  - navigation\n---\n# Správa bojů\n\nUložené boje podle kampaní a questů: stav, účastníci, kola a deník. Boj otevřeš v bojovém modulu, kde ho můžeš dál hrát, přiřadit nebo uložit jako nový.\n\n<div id=\"boje-app\"></div>\n", encoding="utf-8")
    (DOCS / "kouzla.md").write_text("---\nhide:\n  - toc\n---\n# Katalog kouzel (D&D 2024)\n\nVšechna kouzla z pravidel 2024+. Klikni na název pro celý popis.\n\n<div id=\"katalog-kouzel\"></div>\n", encoding="utf-8")

    import pravidla_pages
    P = pravidla_pages.build(DOCS)
    GR = [("Svět", ["Svět", "Země", "Města", "Postavy", "Frakce", "Knihy a dokumenty", "Mapy"]), ("Hra", ["Kampaně", "Questy", "Hádanky", "Sezení"])]
    byname = {list(x)[0]: x for x in sections}
    grouped = [{g: [byname[n] for n in names if n in byname]} for g, names in GR]
    grouped[1]["Hra"].insert(0, {"Správa bojů": "boje.md"})
    grouped[1]["Hra"].insert(0, {"Bojový modul": "boj.md"})
    rest = [x for x in sections if list(x)[0] not in sum([n for _, n in GR], [])]
    nav = [{"Úvod": "README.md"}, {"Interaktivní mapa": "mapa.md"}] + grouped + [{"Pravidla 2024": P}] + [{"Projekt": rest + [{"Otevřené otázky": "Otevrene_otazky.md"}, {"Pravidla projektu": "AGENTS.md"}]}]
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
  - assets/boj.css
extra_javascript:
  - assets/easymde/easymde.min.js
  - assets/extra.js
  - assets/editor.js
  - assets/pravidla_engine.js
  - assets/postava.js
  - assets/kouzla.js
  - assets/srd.js
  - assets/boj.js
not_in_nav: |
  /mapa.md
  /kouzla.md
  /bestiar.md
  /predmety.md
  /glosar.md
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
