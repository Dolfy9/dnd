#!/usr/bin/env python3
"""Připraví web (MkDocs Material) z obsahu repozitáře.

Vytvoří web/docs (symlinky na složky s obsahem), stránku s interaktivní mapou
a web/mkdocs.yml s navigací podle nadpisů souborů. Spuštění: web/serve.sh
"""
import html, json, os, re, shutil
from pathlib import Path
from urllib.parse import unquote
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
    "11_Mapy": "Mapy", "12_Obchody": "Obchody", "_Sablony": "Šablony",
    "14_Povolani": "Povolání", "15_Podtridy": "Podtřídy",
}
PREFIX = re.compile(r"^(Postava|Město|Mesto|Země|Quest|Hádanka|Sezení|Kampaň|Šablona)\s*:\s*", re.I)
MD_LINK = re.compile(r"(?<!!)\[[^\]]*\]\((<[^>]+>|[^)\s]+)(?:\s+[^)]*)?\)")
COUNTRY_MENU = {
    "02_Zeme/Drzava_Knarghae_Zia.md": ("Knärghae Zia", "Nezávislá država"),
    "02_Zeme/Elfsky_Stat_Nolien.md": ("Nölien", "Elfský stát"),
    "02_Zeme/Banerbo.md": ("Banerbo", "Nezávislý národ"),
    "02_Zeme/Imatoma.md": ("Imatoma", "Nezávislý stát"),
    "02_Zeme/Khaeraz.md": ("Khaeraz", "Země"),
    "02_Zeme/Klanove_Zeme_Monohen.md": ("Mönohen", "Klanové země"),
    "02_Zeme/Kralovstvi_Briria.md": ("Briria", "Království"),
    "02_Zeme/Kralovstvi_Imonir.md": ("Imonir", "Království"),
    "02_Zeme/Kralovstvi_Kharghae_Zia.md": ("Khärghae Zia", "Knížectví"),
    "02_Zeme/Kralovstvi_Laertmund.md": ("Laertmund", "Království"),
    "02_Zeme/Provincie_Noet.md": ("Nöet", "Provincie"),
    "02_Zeme/Svobodne_Jizni_Ostrovy.md": ("Svobodné Jižní ostrovy", "Svobodné ostrovy"),
    "02_Zeme/Svobodne_Mesto_Miria.md": ("Miria", "Svobodné město"),
    "02_Zeme/Svobodne_Mesto_Werenor.md": ("Werenor", "Svobodné město"),
    "02_Zeme/Teokracie_Orden.md": ("Orden", "Teokracie"),
    "02_Zeme/Zeme_Zairam.md": ("Zairam", "Země"),
}
NAV_INDEX = {}


def title(md: Path) -> str:
    for line in md.read_text(encoding="utf-8").splitlines():
        if line.startswith("# "):
            return PREFIX.sub("", line[2:].strip()).replace('"', "'")
    return md.stem.replace("_", " ")


def nav_for(dir_: Path, rel: str):
    items = []
    readme = dir_ / "README.md"
    if readme.exists():
        path = f"{rel}/README.md"
        NAV_INDEX[page_url(path)] = title(readme)
        items.append(path)
    files = sorted(p for p in dir_.glob("*.md") if p.name != "README.md")
    for f in files:
        path = f"{rel}/{f.name}"
        full_title = title(f)
        NAV_INDEX[page_url(path)] = full_title
        label = full_title
        if path in COUNTRY_MENU:
            short, kind = COUNTRY_MENU[path]
            label = f"{short} · {kind}"
        elif rel == "03_Mesta":
            label = re.sub(r"^Město\s+", "", full_title, flags=re.I)
        items.append({label: path})
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


def frontmatter(text):
    if not text.startswith("---\n"):
        return {}, text
    end = text.find("\n---\n", 4)
    if end < 0:
        return {}, text
    import yaml
    return yaml.safe_load(text[4:end]) or {}, text[end + 5:]


def page_url(cesta):
    path = cesta.replace("\\", "/")
    if path == "README.md":
        return "/"
    if path.endswith("/README.md"):
        return "/" + path[:-len("README.md")]
    return "/" + re.sub(r"\.md$", "/", path)


def linked_pages(path, body, known):
    found = set()
    for match in MD_LINK.finditer(body):
        target = match.group(1).strip("<>")
        if target.startswith(("http:", "https:", "mailto:", "data:", "#")):
            continue
        target = unquote(target.split("#", 1)[0].split("?", 1)[0])
        if not target:
            continue
        if target.startswith("/"):
            resolved = target.lstrip("/")
        else:
            resolved = os.path.normpath(os.path.join(os.path.dirname(path), target)).replace("\\", "/")
        if resolved.endswith("/"):
            resolved += "README.md"
        elif not resolved.endswith(".md"):
            if resolved + ".md" in known:
                resolved += ".md"
            elif (resolved + "/README.md") in known:
                resolved += "/README.md"
        if resolved in known:
            found.add(resolved)
    return found


def plain_excerpt(body):
    paragraph = []
    for line in body.splitlines():
        text = line.strip()
        if not text or text.startswith(("#", ">", "<")):
            if paragraph:
                break
            continue
        paragraph.append(text)
    text = " ".join(paragraph)
    text = re.sub(r"!\[([^\]]*)\]\([^)]*\)", r"\1", text)
    text = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", text)
    text = re.sub(r"`([^`]*)`", r"\1", text)
    text = re.sub(r"[*_~>#]", "", text)
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text if len(text) <= 220 else text[:219].rstrip() + "…"


def character_portrait(path, data):
    override = data.get("portret")
    candidates = []
    if override:
        candidates.extend((ROOT / str(override), ROOT / Path(path).parent / str(override)))
    else:
        candidates.append(ROOT / "04_Postavy" / "obrazky" / (Path(path).stem + ".webp"))
    for candidate in candidates:
        try:
            rel = candidate.resolve().relative_to(ROOT.resolve()).as_posix()
        except ValueError:
            continue
        if candidate.is_file():
            return "/" + rel
    return ""


def postavy_index():
    all_pages = {}
    for p in sorted(ROOT.rglob("*.md")):
        if p.relative_to(ROOT).parts[0] in SKIP:
            continue
        rel = p.relative_to(ROOT).as_posix()
        _, body = frontmatter(p.read_text(encoding="utf-8"))
        all_pages[rel] = {"title": title(p), "body": body}
    known = set(all_pages)
    for rel, page in all_pages.items():
        page["links"] = linked_pages(rel, page["body"], known)

    characters = {}
    facet_prefixes = {"zeme": "02_Zeme/", "mesta": "03_Mesta/", "frakce": "05_Frakce/", "kampane": "07_Kampane/"}
    for rel, page in all_pages.items():
        if not rel.startswith("04_Postavy/"):
            continue
        meta, _ = frontmatter((ROOT / rel).read_text(encoding="utf-8"))
        data = meta.get("postava")
        if not isinstance(data, dict):
            continue
        folder = Path(rel).parts[1]
        category = {"Vladci": "Vládce", "NPC": "NPC", "Stavitele_a_Bohove": "Stavitel / bůh"}.get(folder, "Postava")
        classes = [
            str(t.get("trida", "")) + ((" " + str(t.get("uroven"))) if t.get("uroven") is not None else "")
            + ((" (" + str(t.get("podtrida")) + ")") if t.get("podtrida") else "")
            for t in (data.get("tridy") or []) if isinstance(t, dict)
        ]
        statblock = str(data.get("statblok") or "")
        class_label = " / ".join(classes) or ("Bez povolání · " + statblock if statblock else "")
        character = {
            "cesta": rel,
            "url": page_url(rel),
            "jmeno": str(data.get("jmeno") or page["title"]),
            "titul": str(data.get("titul") or ""),
            "kategorie": category,
            "druh": str(data.get("druh") or ""),
            "tridy": class_label,
            "uroven": sum(int(t.get("uroven") or 0) for t in (data.get("tridy") or []) if isinstance(t, dict)),
            "statblok": statblock,
            "portret": character_portrait(rel, data),
            "perex": plain_excerpt(page["body"]),
            "stitky": [],
            "data": data,
            "_vazby": {key: {} for key in ("zeme", "mesta", "frakce", "kampane", "questy", "sezeni", "obchody")},
        }
        seen_tags = set()
        for label in data.get("stitky") or []:
            if isinstance(label, str) and label.strip() and label.casefold() not in seen_tags:
                seen_tags.add(label.casefold())
                character["stitky"].append(label)
        for facet, prefix in facet_prefixes.items():
            for target in data.get(facet) or []:
                target = str(target).replace("\\", "/")
                if target in known and target.startswith(prefix):
                    character["_vazby"][facet][target] = False
        for target in page["links"]:
            facet = next((key for key, prefix in facet_prefixes.items() if target.startswith(prefix)), None)
            if facet:
                character["_vazby"][facet].setdefault(target, True)
        characters[rel] = character

    reverse_prefixes = {"07_Kampane/": "kampane", "08_Questy/": "questy", "10_Sezeni/": "sezeni"}
    for rel, page in all_pages.items():
        facet = next((name for prefix, name in reverse_prefixes.items() if rel.startswith(prefix)), None)
        if facet:
            for target in page["links"]:
                if target in characters:
                    characters[target]["_vazby"][facet][rel] = True

    out = []
    for rel, character in sorted(characters.items(), key=lambda pair: pair[1]["jmeno"].casefold()):
        for facet, links in character["_vazby"].items():
            character[facet] = [
                {"cesta": target, "nazev": all_pages[target]["title"], "url": page_url(target), "odvozeno": derived}
                for target, derived in sorted(links.items(), key=lambda pair: all_pages[pair[0]]["title"].casefold())
            ]
        del character["_vazby"]
        out.append(character)
    (DOCS / "postavy_index.json").write_text(json.dumps(out, ensure_ascii=False, default=str), encoding="utf-8")


def obchody_index():
    source = WEB / "assets" / "srd" / "predmety.json"
    srd_names = {item.get("nazev") for item in json.loads(source.read_text(encoding="utf-8"))}
    pages = {p.relative_to(ROOT).as_posix(): title(p) for p in ROOT.rglob("*.md")
             if p.relative_to(ROOT).parts[0] not in SKIP}
    people_path = DOCS / "postavy_index.json"
    people = json.loads(people_path.read_text(encoding="utf-8"))
    by_path = {person["cesta"]: person for person in people}
    shops = []
    for path in sorted((ROOT / "12_Obchody").glob("*.md")):
        rel = path.relative_to(ROOT).as_posix()
        meta, _ = frontmatter(path.read_text(encoding="utf-8"))
        shop = meta.get("obchod")
        if not isinstance(shop, dict):
            raise ValueError(f"{rel}: chybí blok obchod")
        def resolve(target, prefix):
            target = str(target or "").replace("\\", "/")
            if target not in pages or not target.startswith(prefix):
                raise ValueError(f"{rel}: neplatná cesta {target}")
            return {"cesta": target, "nazev": pages[target], "url": page_url(target)}
        def staff(paths):
            result = []
            for target in paths or []:
                person = by_path.get(str(target))
                if not person:
                    raise ValueError(f"{rel}: neplatná postava {target}")
                result.append({"cesta": person["cesta"], "jmeno": person["jmeno"], "url": person["url"],
                               "portret": person["portret"]})
            return result
        offers = shop.get("nabidka") or []
        for row in offers:
            if row.get("srd") and row["srd"] not in srd_names:
                raise ValueError(f"{rel}: neznámá SRD položka {row['srd']}")
        owners = staff(shop.get("majitel") if isinstance(shop.get("majitel"), list) else [shop.get("majitel")])
        personnel = staff(shop.get("personal"))
        shops.append({"cesta": rel, "url": page_url(rel), "nazev": shop.get("nazev") or pages[rel],
                      "typ": shop.get("typ", ""), "majitel": owners, "personal": personnel,
                      "mesto": resolve(shop.get("mesto"), "03_Mesta/"), "zeme": resolve(shop.get("zeme"), "02_Zeme/"),
                      "ctvrt": shop.get("ctvrt", ""), "oteviraci_doba": shop.get("oteviraci_doba", ""),
                      "stitky": shop.get("stitky") or [], "nabidka": offers, "sluzby": shop.get("sluzby") or [],
                      "zdroj": shop})
        for person in owners + personnel:
            by_path[person["cesta"]].setdefault("obchody", []).append(
                {"cesta": rel, "nazev": shop.get("nazev") or pages[rel], "url": page_url(rel), "odvozeno": False})
    for person in people:
        person.setdefault("obchody", [])
    people_path.write_text(json.dumps(people, ensure_ascii=False, default=str), encoding="utf-8")
    (DOCS / "obchody_index.json").write_text(json.dumps(shops, ensure_ascii=False, default=str), encoding="utf-8")


def heraldika_index():
    source = ROOT / "tools" / "heraldika.json"
    if source.is_file():
        shutil.copyfile(source, DOCS / "heraldika_index.json")


def map_page():
    data = json.loads((ROOT / "11_Mapy" / "mista.json").read_text(encoding="utf-8"))
    palette = json.loads((WEB / "assets" / "svet" / "paleta.json").read_text(encoding="utf-8"))
    heraldika = json.loads((ROOT / "tools" / "heraldika.json").read_text(encoding="utf-8"))
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
  <label><input type="checkbox" id="mapa-boj"> ⚔ bojové mapy</label>
  <button type="button" id="mapa-editor" class="ed-only" title="Upravit pobřeží, oblasti, řeky, symboly a popisky">✎ Editor mapy</button>
  <button type="button" id="mapa-meric" title="Klikáním do mapy změříš trasu">⟷ Měřit trasu</button>
</div>
<div id="mapa"></div>
<p class="mapa-pozn">Kolečkem přibližuj, klikni na bod pro detail. Vrstvy vpravo nahoře: atlas z dat (upravitelný v režimu úprav tlačítkem Editor mapy) / ilustrovaná mapa / věrná barevná mapa / původní kresba DM.
Měření trasy počítá s měřítkem z kresby DM (150 km dílek) a cestovním tempem PHB 2024 (Slow 18, Normal 24, Fast 30 mil za den).
Polohy „odhad“ čekají na potvrzení – viz <a href="../11_Mapy/Geografie/">Geografie</a>.</p>
<script src="../assets/leaflet/leaflet.js"></script>
<script>window.MONTELIEN_MISTA = {json.dumps(data, ensure_ascii=False)};</script>
<script>window.SVET_PALETA = {json.dumps(palette, ensure_ascii=False)};</script>
<script>window.MONTELIEN_HERALDIKA = {json.dumps(heraldika, ensure_ascii=False)};</script>
<script src="../assets/leaflet/leaflet-geoman.min.js"></script>
<script src="../assets/svet_symboly.js"></script>
<script src="../assets/svet/sprity.js"></script>
<script src="../assets/svet.js"></script>
<script src="../assets/mapa.js"></script>
"""


def listing_page(filename, heading, folder):
    entries = sorted((ROOT / folder).rglob("*.md"))
    lines = [f"# {heading}", ""]
    for path in entries:
        if path.name == "README.md":
            continue
        rel = path.relative_to(ROOT).as_posix()
        label = title(path)
        if rel in COUNTRY_MENU:
            short, kind = COUNTRY_MENU[rel]
            label = f"{short} · {kind}"
        elif rel.startswith("03_Mesta/"):
            label = re.sub(r"^Město\s+", "", label, flags=re.I)
        lines.append(f"- [{label}]({page_url(rel)})")
    lines.append("")
    (DOCS / filename).write_text("\n".join(lines), encoding="utf-8")
    NAV_INDEX[page_url(filename)] = heading


def species_page_summary(path):
    import yaml
    if not path.is_file():
        return {"prehled": "", "delka_zivota": ""}
    text = path.read_text(encoding="utf-8")
    front = re.match(r"\A---\r?\n(.*?)\r?\n---\r?\n", text, re.S)
    meta = (yaml.safe_load(front.group(1)) or {}).get("druh", {}) if front else {}
    section = re.search(r"^## Přehled\s*\n(.*?)(?=^## |\Z)", text, re.S | re.M)
    paragraphs = [p.strip() for p in (section.group(1) if section else "").split("\n\n") if p.strip() and not p.lstrip().startswith(("<", ">"))]
    plain = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", paragraphs[0] if paragraphs else "")
    return {"prehled": re.sub(r"[*_`]", "", plain), "delka_zivota": str(meta.get("delka_zivota", "") or "")}

def rules_page_overview(path):
    if not path.is_file():
        return ""
    text = path.read_text(encoding="utf-8")
    section = re.search(r"^## Přehled\s*\n(.*?)(?=^## |\Z)", text, re.S | re.M)
    paragraphs = [p.strip() for p in (section.group(1) if section else "").split("\n\n") if p.strip()]
    if not paragraphs:
        return ""
    plain = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", paragraphs[0])
    return re.sub(r"[*_`]", "", plain)


def rules_edition(item):
    if item.get("oznameno"):
        return "oznámeno"
    if item.get("treti_strana"):
        return "třetí strana"
    if item.get("legacy"):
        return "legacy"
    return "2024"


def main():
    NAV_INDEX.clear()
    if DOCS.exists():
        shutil.rmtree(DOCS)
    DOCS.mkdir()
    sections = []
    for d in sorted(p for p in ROOT.iterdir() if p.is_dir() and p.name not in SKIP and not p.name.startswith(".")):
        os.symlink(os.path.relpath(d, DOCS), DOCS / d.name)
        items = nav_for(d, d.name)
        if items and d.name != "13_Druhy":
            sections.append({NAMES.get(d.name, d.name): items})
    for f in ["README.md", "Otevrene_otazky.md", "AGENTS.md"]:
        os.symlink(os.path.relpath(ROOT / f, DOCS), DOCS / f)
    os.symlink(os.path.relpath(WEB / "assets", DOCS), DOCS / "assets")
    (DOCS / "mapa.md").write_text(map_page(), encoding="utf-8")
    (DOCS / "bestiar.md").write_text("---\nhide:\n  - toc\n---\n# Bestiář (SRD 5.2.1)\n\nNetvoři ze SRD 5.2.1 se statbloky. Filtruj podle typu a CR, klikni pro statblok. Obsah SRD 5.2.1 je pod licencí CC-BY 4.0.\n\n<div class=\"srd-katalog\" data-typ=\"bestiar\"></div>\n", encoding="utf-8")
    (DOCS / "postavy.md").write_text("---\nhide:\n  - toc\n  - navigation\n---\n# Katalog postav\n\nPostavy, jejich vazby a štítky pro přípravu hry. Vyhledávej, filtruj nebo otevři kartu postavy.\n\n<div id=\"postavy-katalog\"></div>\n", encoding="utf-8")
    (DOCS / "druhy.md").write_text("---\nhide:\n  - toc\n  - navigation\n---\n# Katalog druhů\n\nVyhledej druh podle názvu a filtruj podle zdroje, edice, velikosti, typu či rychlosti.\n\n<div id=\"druhy-katalog\"></div>\n", encoding="utf-8")
    (DOCS / "povolani.md").write_text("---\nhide:\n  - toc\n  - navigation\n---\n# Povolání\n\nProhlížej povolání podle pravidel, zdroje a sesílacího zaměření.\n\n<div id=\"povolani-katalog\"></div>\n", encoding="utf-8")
    (DOCS / "podtridy.md").write_text("---\nhide:\n  - toc\n  - navigation\n---\n# Podtřídy\n\nVyhledej podtřídu podle povolání, edice, knihy nebo vydavatele.\n\n<div id=\"podtridy-katalog\"></div>\n", encoding="utf-8")
    (DOCS / "pozadi.md").write_text("---\nhide:\n  - toc\n  - navigation\n---\n# Pozadí\n\nPřehled pozadí, jejich zvýšení vlastností, featů a dovedností.\n\n<div id=\"pozadi-katalog\"></div>\n", encoding="utf-8")
    (DOCS / "featy.md").write_text("---\nhide:\n  - toc\n  - navigation\n---\n# Featy\n\nPřehled featů podle kategorie a předpokladů.\n\n<div id=\"featy-katalog\"></div>\n", encoding="utf-8")
    (DOCS / "obchody.md").write_text("---\nhide:\n  - toc\n  - navigation\n---\n# Obchody\n\nKatalog obchodů a jejich nabídek.\n\n<div id=\"obchody-katalog\"></div>\n", encoding="utf-8")
    (DOCS / "predmety.md").write_text("---\nhide:\n  - toc\n---\n# Předměty a výbava (SRD 5.2.1)\n\nZbraně, zbroje, výbava a kouzelné předměty. Obsah SRD 5.2.1 je pod licencí CC-BY 4.0.\n\n<div class=\"srd-katalog\" data-typ=\"predmety\"></div>\n", encoding="utf-8")
    (DOCS / "glosar.md").write_text("---\nhide:\n  - toc\n---\n# Glosář pravidel (SRD 5.2.1)\n\nDefinice pravidel 2024 (stavy, akce, pojmy). Obsah SRD 5.2.1 je pod licencí CC-BY 4.0.\n\n<div class=\"srd-katalog\" data-typ=\"glosar\"></div>\n", encoding="utf-8")
    (DOCS / "boj.md").write_text("---\nhide:\n  - toc\n  - navigation\n---\n# Bojový modul\n\nBojové mapy s mřížkou (1 pole = 5 ft), žetony postav a netvorů, iniciativa a bojový pomocník podle pravidel 2024.\n\n<div id=\"boj-app\"></div>\n", encoding="utf-8")
    boj_index()
    postavy_index()
    species = json.loads((WEB / "assets/pravidla2024.json").read_text(encoding="utf-8"))["druhy"]
    species_index = []
    for name, value in species.items():
        stem = "Druh_" + re.sub(r"[^A-Za-z0-9]+", "_", name).strip("_")
        species_index.append({"nazev": name, "stem": stem, "stranka": f"13_Druhy/{stem}.md",
                              "legacy": bool(value.get("legacy")), "treti_strana": bool(value.get("treti_strana")),
                              "alternativa_2024": value.get("alternativa_2024", "—"),
                              "zdroj": value.get("zdroj", "neověřeno"), "velikost": value.get("velikost", "neověřeno"),
                              "rychlost": value.get("rychlost", "neověřeno"), "typ": value.get("typ", "neověřeno"),
                              "rysy": value.get("rysy", {}), "overeno": value.get("overeno", []),
                              "obrazek": (ROOT / "13_Druhy" / "obrazky" / (stem + ".webp")).is_file(),
                              **species_page_summary(ROOT / "13_Druhy" / f"{stem}.md")})
    (DOCS / "druhy_index.json").write_text(json.dumps(species_index, ensure_ascii=False), encoding="utf-8")
    obchody_index()
    heraldika_index()
    boje.write_index(DOCS)
    (DOCS / "boje.md").write_text("---\nhide:\n  - toc\n  - navigation\n---\n# Správa bojů\n\nUložené boje podle kampaní a questů: stav, účastníci, kola a deník. Boj otevřeš v bojovém modulu, kde ho můžeš dál hrát, přiřadit nebo uložit jako nový.\n\n<div id=\"boje-app\"></div>\n", encoding="utf-8")
    (DOCS / "kouzla.md").write_text("---\nhide:\n  - toc\n---\n# Katalog kouzel (D&D 2024)\n\nVšechna kouzla z pravidel 2024+. Klikni na název pro celý popis.\n\n<div id=\"katalog-kouzel\"></div>\n", encoding="utf-8")
    for filename, heading, folder in [
        ("zeme.md", "Země", "02_Zeme"), ("mesta.md", "Města", "03_Mesta"),
        ("frakce.md", "Frakce", "05_Frakce"), ("kampane.md", "Kampaně", "07_Kampane"),
        ("questy.md", "Questy", "08_Questy"), ("sezeni.md", "Sezení", "10_Sezeni"),
        ("hadanky.md", "Hádanky", "09_Hadanky"), ("knihy.md", "Knihy", "06_Knihy_a_Dokumenty"),
    ]:
        listing_page(filename, heading, folder)

    import pravidla_pages
    P = pravidla_pages.build(DOCS)
    rules = json.loads((WEB / "assets/pravidla2024.json").read_text(encoding="utf-8"))
    caster_types = {"Artificer": "half", "Bard": "full", "Cleric": "full", "Druid": "full",
                    "Paladin": "half", "Ranger": "half", "Sorcerer": "full", "Warlock": "pact", "Wizard": "full"}
    class_index = []
    for name, item in rules["tridy"].items():
        stem = "Povolani_" + re.sub(r"[^A-Za-z0-9]+", "_", name).strip("_")
        planned = f"14_Povolani/{stem}.md"
        legacy_page = f"pravidla/phb/povolani/{pravidla_pages.slug(name)}.md"
        page = ROOT / planned
        class_index.append({
            "name": name, "stem": stem, "page": planned,
            "url": page_url(planned) if page.is_file() else page_url(legacy_page),
            "source": item.get("zdroj", ""), "edition": rules_edition(item),
            "edice": rules_edition(item), "legacy": bool(item.get("legacy")),
            "treti_strana": bool(item.get("treti_strana")), "oznameno": bool(item.get("oznameno")),
            "alternative_2024": item.get("alternativa_2024", ""),
            "alternativa_2024": item.get("alternativa_2024", ""),
            "image": (ROOT / "14_Povolani" / "obrazky" / (stem + ".webp")).is_file(),
            "overview": rules_page_overview(page),
            "hit_die": item.get("hit_die") or ("neověřeno" if item.get("bez_tabulky") else ""),
            "primary_ability": (item.get("core") or {}).get("Primary Ability") or ("neověřeno" if item.get("bez_tabulky") else ""),
            "saves": (item.get("core") or {}).get("Saving Throw Proficiencies") or ("neověřeno" if item.get("bez_tabulky") else ""),
            "caster_type": (item.get("core") or {}).get("Caster Type")
                           or ("neověřeno" if item.get("bez_tabulky") else caster_types.get(name, "none")),
            "skills": (item.get("core") or {}).get("Skill Proficiencies", ""),
            "weapons": (item.get("core") or {}).get("Weapon Proficiencies", ""),
            "armor": (item.get("core") or {}).get("Armor Training", ""),
            "tools": (item.get("core") or {}).get("Tool Proficiencies", ""),
            "starting_equipment": (item.get("core") or {}).get("Starting Equipment", ""),
            "subclasses": [{
                "key": subclass_name, "name": subclass.get("nazev", subclass_name),
                "edition": rules_edition(subclass), "source": subclass.get("zdroj", ""),
                "legacy": bool(subclass.get("legacy")), "treti_strana": bool(subclass.get("treti_strana")),
                "oznameno": bool(subclass.get("oznameno")),
                "alternative_2024": subclass.get("alternativa_2024", ""),
            } for subclass_name, subclass in rules["podtridy"].items() if subclass.get("trida") == name],
        })
    subclass_index = []
    for name, item in rules["podtridy"].items():
        class_slug = re.sub(r"[^A-Za-z0-9]+", "_", item.get("trida", "")).strip("_")
        stem = "Podtrida_" + class_slug + "_" + re.sub(r"[^A-Za-z0-9]+", "_", name).strip("_")
        planned = f"15_Podtridy/{stem}.md"
        page = ROOT / planned
        fallback = f"14_Povolani/Povolani_{class_slug}.md"
        subclass_index.append({
            "key": name, "name": item.get("nazev", name), "stem": stem, "page": planned,
            "url": page_url(planned) if page.is_file() else page_url(fallback),
            "source": item.get("zdroj", ""), "edition": rules_edition(item),
            "edice": rules_edition(item), "class": item.get("trida", ""), "trida": item.get("trida", ""),
            "legacy": bool(item.get("legacy")), "treti_strana": bool(item.get("treti_strana")),
            "oznameno": bool(item.get("oznameno")), "alternative_2024": item.get("alternativa_2024", ""),
            "alternativa_2024": item.get("alternativa_2024", ""),
            "year": item.get("rok", ""), "rok": item.get("rok", ""),
            "revision": item.get("revize", ""), "revize": item.get("revize", ""),
            "verification": item.get("overeno", []),
            "publisher": item.get("vydavatel", ""), "image": (ROOT / "15_Podtridy" / "obrazky" / (stem + ".webp")).is_file(),
            "overview": rules_page_overview(page),
            "features": [{"name": feature, "level": value.get("uroven", ""), "text": value.get("text", "")}
                         for feature, value in (item.get("rysy") or {}).items() if isinstance(value, dict)],
        })
    background_index = [{
        "name": name, "stem": "Pozadi_" + re.sub(r"[^A-Za-z0-9]+", "_", name).strip("_"),
        "page": "pravidla/phb/pozadi.md", "url": "/pravidla/phb/pozadi/",
        "source": item.get("zdroj", ""), "edition": rules_edition(item), "edice": rules_edition(item),
        "image": False, "overview": "", "ability_scores": item.get("atributy", ""),
        "feat": item.get("feat", ""), "skills": item.get("dovednosti", ""),
    } for name, item in rules["pozadi"].items()]
    feat_index = [{
        "name": name, "stem": "Feat_" + re.sub(r"[^A-Za-z0-9]+", "_", name).strip("_"),
        "page": "pravidla/phb/featy.md", "url": "/pravidla/phb/featy/",
        "source": item.get("zdroj", ""), "edition": rules_edition(item), "edice": rules_edition(item),
        "image": False, "overview": "", "category": item.get("kategorie", ""),
        "prerequisite": item.get("predpoklad", ""), "text": item.get("text", ""),
    } for name, item in rules["featy"].items()]
    for filename, data in [("tridy_index.json", class_index), ("podtridy_index.json", subclass_index),
                           ("pozadi_index.json", background_index), ("featy_index.json", feat_index)]:
        (DOCS / filename).write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    knowledge_counts = [
        ("Druhy", len(rules["druhy"]), "druhy/", "Druhy a jejich pravidla."),
        ("Povolání", len(class_index), "povolani/", "Základní třídy a jejich mechaniky."),
        ("Podtřídy", len(subclass_index), "podtridy/", "Oficiální, legacy i třetistranné podtřídy."),
        ("Pozadí", len(background_index), "pozadi/", "Zvýšení vlastností, feat a dovednosti."),
        ("Featy", len(feat_index), "featy/", "Featy podle kategorie a předpokladů."),
        ("Kouzla", len(json.loads((WEB / "assets/kouzla2024.json").read_text(encoding="utf-8"))), "kouzla/", "Kouzla podle povolání, úrovně a školy."),
        ("Bestiář", len(json.loads((WEB / "assets/srd/bestiar.json").read_text(encoding="utf-8"))), "bestiar/", "Netvoři podle typu a Challenge Rating."),
        ("Výbava a předměty", len(json.loads((WEB / "assets/srd/predmety.json").read_text(encoding="utf-8"))), "predmety/", "Výbava, zbraně, zbroje a kouzelné předměty."),
        ("Glosář", len(json.loads((WEB / "assets/srd/glosar.json").read_text(encoding="utf-8"))), "glosar/", "Pojmy a stavy pravidel."),
    ]
    tiles = "".join(
        f'<a class="kat-card znalosti-tile" href="/{href}"><div class="kat-card-body">'
        f'<strong>{html.escape(name)}</strong><small>{count} položek</small><span>{html.escape(description)}</span></div></a>'
        for name, count, href, description in knowledge_counts
    )
    (DOCS / "znalosti.md").write_text(
        "---\nhide:\n  - toc\n  - navigation\n---\n# Znalosti\n\n"
        "<form id=\"znalosti-search\" class=\"znalosti-search\"><label for=\"znalosti-query\">Hledat napříč pravidly</label>"
        "<div><input id=\"znalosti-query\" type=\"search\" placeholder=\"Zadej pojem, povolání nebo kouzlo…\">"
        "<button type=\"submit\" class=\"md-button md-button--primary\">Hledat</button></div></form>\n\n"
        f'<div class="kat-grid znalosti-tiles">{tiles}</div>\n',
        encoding="utf-8")
    NAV_INDEX["/znalosti/"] = "Znalosti rozcestník pravidla katalogy"
    NAV_INDEX["/druhy/"] = "Katalog druhů species druhy"
    NAV_INDEX["/povolani/"] = "Povolání třídy classes"
    NAV_INDEX["/podtridy/"] = "Podtřídy subclassy"
    NAV_INDEX["/pozadi/"] = "Pozadí backgrounds"
    NAV_INDEX["/featy/"] = "Featy"
    NAV_INDEX["/kouzla/"] = "Kouzla spells"
    NAV_INDEX["/bestiar/"] = "Bestiář netvoři"
    NAV_INDEX["/predmety/"] = "Předměty a výbava"
    NAV_INDEX["/glosar/"] = "Glosář pravidel"
    byname = {list(x)[0]: x for x in sections}
    visible_sections = {"Svět", "Země", "Města", "Obchody", "Postavy", "Frakce", "Knihy a dokumenty",
                        "Mapy", "Kampaně", "Questy", "Hádanky", "Sezení", "Povolání", "Podtřídy"}
    rest = [x for x in sections if list(x)[0] not in visible_sections]
    def section_items(name):
        section = byname.get(name)
        return next(iter(section.values())) if section else []

    world = list(section_items("Svět"))
    world.extend([
        {"Země": section_items("Země")},
        {"Města": section_items("Města")},
    ])
    shops = list(section_items("Obchody"))
    shops.insert(0, {"Katalog obchodů": "obchody.md"})
    NAV_INDEX["/obchody/"] = "Obchody katalog obchody prodejny"
    world.append({"Obchody": shops})
    characters = list(section_items("Postavy"))
    characters.insert(0, {"Katalog postav": "postavy.md"})
    NAV_INDEX["/postavy/"] = "Katalog postav postavy katalog NPC"
    world.extend([
        {"Postavy": characters},
        {"Frakce": section_items("Frakce")},
        {"Knihy a dokumenty": section_items("Knihy a dokumenty")},
        {"Mapy": section_items("Mapy")},
    ])
    game = [
        {"Kampaně": section_items("Kampaně")},
        {"Questy": section_items("Questy")},
        {"Hádanky": section_items("Hádanky")},
        {"Sezení": section_items("Sezení")},
    ]
    game[0]["Kampaně"].insert(0, {"Správa bojů": "boje.md"})
    NAV_INDEX["/boje/"] = "Správa bojů"
    game[0]["Kampaně"].insert(0, {"Bojový modul": "boj.md"})
    NAV_INDEX["/boj/"] = "Bojový modul"
    rules = P
    player_nav = {list(item)[0]: next(iter(item.values())) for item in rules[0]["Příručka hráče"]}
    dm_nav = {list(item)[0]: next(iter(item.values())) for item in rules[1]["Příručka PJ"]}
    equipment = list(player_nav["Výbava"])
    magic_items = [item for item in rules[1]["Příručka PJ"]
                   if next(iter(item)).startswith(("Kouzelné předměty", "Vzácnost:", "Lektvary", "Prsteny", "Hůlky", "Divotvorné"))]
    equipment.extend([{"Kouzelné předměty": magic_items}, {"Předměty a výbava (vše)": "predmety.md"}])
    character_nav = [
        {"Tvorba postavy a level up": player_nav["Tvorba postavy a level up"]},
        {"Druhy": "druhy.md"},
        {"Povolání": [{"Katalog povolání": "povolani.md"}] + section_items("Povolání")},
        {"Podtřídy": "podtridy.md"},
        {"Pozadí": "pozadi.md"}, {"Featy": "featy.md"},
    ]
    rules = [
        {"Rozcestník": "znalosti.md"},
        {"Postava": character_nav},
        {"Magie": "kouzla.md"},
        {"Výbava a předměty": equipment},
        {"Netvoři": rules[2]["Bestiář"]},
        {"Pravidla hry": list(player_nav["Pravidla hry"]) + [{"Glosář pravidel": "glosar.md"}]},
        {"Nástroje PJ": list(dm_nav["Nástroje PJ"]) + [dm_nav["Pravidla kouzelných předmětů"]]},
    ]
    nav = [{"Úvod": "README.md"}, {"Mapa": "mapa.md"}, {"Svět": world}, {"Hra": game},
           {"Znalosti": rules}, {"Projekt": rest + [{"Otevřené otázky": "Otevrene_otazky.md"}, {"Pravidla projektu": "AGENTS.md"}]}]
    NAV_INDEX["/"] = "Úvod Montelien"
    NAV_INDEX["/mapa/"] = "Mapa Interaktivní mapa"
    (DOCS / "nav_index.json").write_text(json.dumps(NAV_INDEX, ensure_ascii=False), encoding="utf-8")
    watch_dirs = [s for s in os.listdir(ROOT)
                  if (ROOT / s).is_dir() and s not in SKIP and not s.startswith(".")]
    for required in ("14_Povolani", "15_Podtridy"):
        if required not in watch_dirs:
            watch_dirs.append(required)
    watch = "\n".join(f"  - ../{d}" for d in sorted(watch_dirs))
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
  - assets/katalog.css
  - assets/navigation.css
  - assets/postava.css
  - assets/postavy.css
  - assets/druhy.css
  - assets/heraldika.css
  - assets/boj.css
  - assets/obchody.css
extra_javascript:
  - assets/easymde/easymde.min.js
  - assets/extra.js
  - assets/navigation.js
  - assets/editor.js
  - assets/pravidla_engine.js
  - assets/katalog.js
  - assets/postava.js
  - assets/postavy.js
  - assets/druhy.js
  - assets/pravidla_katalog.js
  - assets/znalosti.js
  - assets/heraldika.js
  - assets/kouzla.js
  - assets/srd.js
  - assets/boj.js
  - assets/obchody.js
not_in_nav: |
  /mapa.md
  /postavy.md
  /kouzla.md
  /bestiar.md
  /povolani.md
  /podtridy.md
  /pozadi.md
  /featy.md
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
