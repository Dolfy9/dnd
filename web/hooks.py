"""MkDocs hook: character sheets z front matter + cesta ke zdroji pro editor."""
import html
import json
import posixpath
import re
from pathlib import Path
from urllib.parse import quote


def homepage_tiles(root):
    def pages(path):
        folder = root / path
        if not folder.is_dir():
            return 0
        count = len([p for p in folder.rglob("*.md") if p.name != "README.md"])
        return count or int((folder / "README.md").exists())

    def entries(path):
        try:
            value = json.loads((root / path).read_text(encoding="utf-8"))
            return len(value) if isinstance(value, list) else len(value.get("results", value))
        except (OSError, ValueError, TypeError):
            return 0

    def count_label(count):
        if count == 1:
            noun = "položka"
        elif 2 <= count <= 4:
            noun = "položky"
        else:
            noun = "položek"
        return f"{count} {noun}"

    rules = json.loads((root / "web/assets/pravidla2024.json").read_text(encoding="utf-8"))
    knowledge_count = sum(len(rules.get(key, {})) for key in ("druhy", "tridy", "podtridy", "pozadi", "featy"))
    knowledge_count += sum(entries(path) for path in (
        "web/assets/kouzla2024.json", "web/assets/srd/bestiar.json",
        "web/assets/srd/predmety.json", "web/assets/srd/glosar.json",
    ))
    tiles = [
        ("mapa", "Mapa", "mapa/", 1, "Prozkoumej svět a jeho vrstvy."),
        ("zeme", "Země", "zeme/", pages("02_Zeme"), "Státy, knížectví a svobodná území."),
        ("mesta", "Města", "mesta/", pages("03_Mesta"), "Sídla, přístavy a pevnosti."),
        ("obchody", "Obchody", "obchody/", pages("12_Obchody"), "Obchody, služby a jejich nabídky."),
        ("postavy", "Postavy", "postavy/", pages("04_Postavy"), "Najdi postavu podle jména a vazeb."),
        ("znalosti", "Znalosti", "znalosti/", knowledge_count, "Pravidla, druhy, povolání, kouzla, výbava a bestiář."),
        ("frakce", "Frakce", "frakce/", pages("05_Frakce"), "Řády, odboj a další mocenské skupiny."),
        ("kampane", "Kampaně", "kampane/", pages("07_Kampane"), "Příběhové oblouky a jejich záznamy."),
        ("questy", "Questy", "questy/", pages("08_Questy"), "Dobrodružství a úkoly."),
        ("sezeni", "Sezení", "sezeni/", pages("10_Sezeni"), "Záznamy odehraných her."),
        ("hadanky", "Hádanky", "hadanky/", pages("09_Hadanky"), "Šifry, pasti a záhady."),
        ("knihy", "Knihy", "knihy/", pages("06_Knihy_a_Dokumenty"), "Texty, kroniky a listiny."),
        ("boj", "Bojový modul", "boj/", 1, "Mapa střetu, iniciativa a přehled boje."),
    ]
    links = []
    for icon, name, href, count, description in tiles:
        label = count_label(count)
        if icon == "obchody":
            label = f"{count} " + ("obchod" if count == 1 else "obchody" if 2 <= count <= 4 else "obchodů")
        links.append(
            f'<a class="nav-home-tile nav-tile-{icon}" href="{href}" data-icon="{icon}">'
            f'<span class="nav-home-icon" aria-hidden="true"></span><span class="nav-home-copy">'
            f'<strong>{name}</strong><small>{label}</small><span>{description}</span></span></a>'
        )
    return '<section class="nav-home-tiles" aria-label="Rychlý rozcestník">' + "".join(links) + "</section>"


def _class_mechanics(name, rules):
    class_data = rules["tridy"][name]
    lines = []
    if class_data.get("bez_tabulky"):
        lines.extend([
            "> **Neověřeno:** chassis této třídy, včetně kostky životů, záchran a postupu, nebylo možné ověřit.",
            "> Výpočet úrovňového postupu ani spell slotů pro tuto třídu není podporován.",
            "",
        ])
    table = class_data.get("tabulka") or {}
    if table:
        columns = list(next(iter(table.values())).keys())
        lines.append("| Úroveň | " + " | ".join(columns) + " |")
        lines.append("|" + "---|" * (len(columns) + 1))
        for level, row in sorted(table.items(), key=lambda entry: int(entry[0])):
            cells = [str(row.get(column, "")).replace("|", " / ").replace("\n", " ") for column in columns]
            lines.append("| " + str(level) + " | " + " | ".join(cells) + " |")
        lines.append("")
    def feature_key(entry):
        feature = entry[1]
        level = feature.get("uroven", 99) if isinstance(feature, dict) else 99
        try:
            return (0, float(level), entry[0])
        except (TypeError, ValueError):
            return (1, str(level), entry[0])

    for feature_name, feature in sorted((class_data.get("rysy") or {}).items(), key=feature_key):
        if isinstance(feature, dict):
            level, text = feature.get("uroven", ""), feature.get("text", "")
        else:
            level, text = "", feature
        lines.append("### " + feature_name + (f" · {level}. úroveň" if level else ""))
        if text:
            lines.extend(["", str(text), ""])
    options = [(option_name, option) for option_name, option in rules.get("volby_trid", {}).items()
               if option.get("trida") == name]
    if options:
        lines.extend(["## Volby povolání", ""])
        for option_name, option in sorted(options):
            feature = class_data.get("rysy", {}).get(option.get("feature", ""), {})
            text = feature.get("text", "") if isinstance(feature, dict) else feature
            lines.extend(["### " + option_name, "", str(text), ""])
    return "\n".join(lines).strip()


def _class_subclasses(name, rules):
    groups = {"2024": [], "třetí strana": [], "legacy": []}
    for subclass_name, item in rules["podtridy"].items():
        if item.get("trida") != name:
            continue
        group = "legacy" if item.get("legacy") else "třetí strana" if item.get("treti_strana") else "2024"
        groups[group].append((subclass_name, item))
    output = []
    for group, entries in groups.items():
        if not entries:
            continue
        output.extend(["### " + group.capitalize(), ""])
        for subclass_name, item in sorted(entries, key=lambda entry: entry[0].casefold()):
            edition = "oznámeno" if item.get("oznameno") else "legacy" if item.get("legacy") else "třetí strana" if item.get("treti_strana") else "2024"
            query = f"trida={quote(name)}&edice={quote(edition)}&q={quote(item.get('nazev', subclass_name))}"
            label = item.get("nazev", subclass_name)
            note = " — legacy, alternativa 2024: " + str(item.get("alternativa_2024")) if item.get("legacy") and item.get("alternativa_2024") else ""
            announced = " — oznámeno" if item.get("oznameno") else ""
            output.append(f"- [{label}](/podtridy/?{query}){announced}{note}")
        output.append("")
    return "\n".join(output).strip() or "Podtřídy zatím nejsou v datech uvedeny."


def _class_people(name, root, montelien=False):
    index = root / "web" / "docs" / "postavy_index.json"
    if not index.is_file():
        return "V rejstříku postav zatím nejsou dostupná data."
    people = json.loads(index.read_text(encoding="utf-8"))
    pattern = re.compile(r"(?<![A-Za-z])" + re.escape(name) + r"(?![A-Za-z])", re.I)
    matches = [person for person in people if pattern.search(str(person.get("tridy", "")))]
    if not matches:
        return "V rejstříku postav zatím není zaznamenána žádná postava tohoto povolání."
    output = []
    for person in matches:
        label = person.get("jmeno", "Postava")
        line = f"- [{label}]({person.get('url', '/')})"
        if montelien:
            places = []
            for key in ("zeme", "mesta", "frakce"):
                for place in person.get(key, []) or []:
                    places.append(f"[{place.get('nazev', key)}]({place.get('url', '/')})")
            if places:
                line += " — " + ", ".join(places)
        else:
            line += " — " + str(person.get("tridy", ""))
        output.append(line)
    return "\n".join(output)


def _class_page(markdown, src, root):
    rules_path = root / "web" / "assets" / "pravidla2024.json"
    if not src.startswith("14_Povolani/Povolani_") or not rules_path.is_file():
        return markdown
    rules = json.loads(rules_path.read_text(encoding="utf-8"))
    name = next((class_name for class_name in rules.get("tridy", {})
                 if "Povolani_" + re.sub(r"[^A-Za-z0-9]+", "_", class_name).strip("_") + ".md" == Path(src).name), None)
    if name is None:
        return markdown
    class_data = rules["tridy"][name]
    basics = [f"- **{key}:** {value}" for key, value in class_data.get("core", {}).items() if key != "Hit Point Die"]
    hit_die = class_data.get("hit_die")
    if isinstance(hit_die, int) or str(hit_die).isdigit():
        basics.insert(0, f"- **Hit Die:** d{hit_die}")
    elif hit_die:
        basics.insert(0, f"- **Hit Die:** {hit_die}")
    elif class_data.get("bez_tabulky"):
        basics.insert(0, "- **Hit Die:** neověřeno")
    replacements = {
        "<!-- udaje:povolani -->": "\n".join(basics) or "Základní údaje nejsou v datech uvedeny.",
        "<!-- mechaniky:povolani -->": _class_mechanics(name, rules),
        "<!-- podtridy:povolani -->": _class_subclasses(name, rules),
        "<!-- vazby:povolani -->": _class_people(name, root, montelien=True),
        "<!-- postavy:povolani -->": _class_people(name, root),
    }
    for placeholder, content in replacements.items():
        markdown = markdown.replace(placeholder, content)
    return markdown


def on_page_markdown(markdown, page, config, files):
    src = page.file.src_path
    root = Path(__file__).resolve().parent.parent
    markdown = _class_page(markdown, src, root)
    if src == "README.md":
        tiles = homepage_tiles(root)
        existing = re.search(r'<section class="nav-home-tiles"[^>]*>.*?</section>', markdown, re.S)
        if existing:
            markdown = markdown[:existing.start()] + tiles + markdown[existing.end():]
        else:
            heading = re.search(r"(?m)^#\s+.+$", markdown)
            if heading:
                pos = heading.end()
                markdown = markdown[:pos] + "\n\n" + tiles + "\n" + markdown[pos:]
    data = page.meta.get("postava")
    override = data.get("portret") if isinstance(data, dict) else None
    portrait_path = override_path = None
    if override:
        for source in (root / str(override), root / Path(src).parent / str(override)):
            candidate = source.resolve()
            try:
                rel = candidate.relative_to(root).as_posix()
            except ValueError:
                continue
            if candidate.is_file():
                portrait_path = override_path = rel
                break
    if not portrait_path and src.startswith("04_Postavy/"):
        candidate = root / "04_Postavy" / "obrazky" / (Path(src).stem + ".webp")
        if candidate.is_file():
            portrait_path = candidate.relative_to(root).as_posix()
    portrait_url = posixpath.relpath(portrait_path, posixpath.dirname(page.url) or ".") if portrait_path else None
    if not src.startswith("11_Mapy/"):
        data_path = root / "11_Mapy" / "mista.json"
        places = json.loads(data_path.read_text(encoding="utf-8"))["mista"]
        matches = [m for m in places if m.get("odkaz") == src]
        if matches:
            title = page.meta.get("title")
            if not title:
                heading = re.search(r"^#\s+(.+?)\s*$", markdown, re.M)
                title = heading.group(1) if heading else ""
            title = re.sub(r"^(Postava|Město|Mesto|Země|Quest|Hádanka|Sezení|Kampaň|Šablona)(?:\s*:\s*|\s+)", "", title, flags=re.I).strip()
            place = next((m for m in matches if m["nazev"] == title), matches[0])
            map_url = posixpath.relpath("mapa/", posixpath.dirname(page.url) or ".")
            query = quote(place["nazev"], safe="")
            href = f"{map_url}?misto={query}"
            crop = f"{href}&amp;vyrez=1"
            preview_class = " mapa-preview-zeme" if place.get("typ") == "zeme" else ""
            if place.get("typ") == "zeme":
                crop += "&amp;typ=zeme"
            block = (f'\n\n<div class="mapa-vlozena{preview_class}"><p><a class="md-button mapa-zobrazit" href="{href}">Zobrazit na mapě</a></p>'
                     f'<iframe title="Mapa: {html.escape(place["nazev"], quote=True)}" src="{crop}" loading="lazy"></iframe></div>\n\n')
            heading = re.search(r"^#\s+.+?$", markdown, re.M)
            if heading:
                end = heading.end()
                markdown = markdown[:end] + block + markdown[end:]
            else:
                markdown = block + markdown
    if data:
        sheet_data = dict(data)
        if override_path:
            sheet_data["portret"] = override_path
        else:
            sheet_data.pop("portret", None)
        payload = json.dumps(sheet_data, ensure_ascii=False).replace("</", "<\\/")
        portret_attr = f' data-portret-url="{html.escape(portrait_url, quote=True)}"' if portrait_url else ""
        markdown = (f'<div class="postava-sheet"{portret_attr}></div>\n'
                    f'<script type="application/json" class="postava-data">{payload}</script>\n\n' + markdown)
    elif portrait_url:
        title = page.meta.get("title") or Path(src).stem.replace("_", " ")
        figure = (f'\n<figure class="postava-portret"><a href="{html.escape(portrait_url, quote=True)}" target="_blank" rel="noopener">'
                  f'<img src="{html.escape(portrait_url, quote=True)}" alt="{html.escape(title, quote=True)}" loading="lazy"></a></figure>\n\n')
        markdown = figure + markdown
    return markdown


def on_page_content(content, page, config, files):
    src = page.file.src_uri
    return content + f'\n<div id="zdroj-stranky" data-cesta="{html.escape(src)}" hidden></div>\n'
