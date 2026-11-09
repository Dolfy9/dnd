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

    tiles = [
        ("mapa", "Mapa", "mapa/", 1, "Prozkoumej svět a jeho vrstvy."),
        ("zeme", "Země", "zeme/", pages("02_Zeme"), "Státy, knížectví a svobodná území."),
        ("mesta", "Města", "mesta/", pages("03_Mesta"), "Sídla, přístavy a pevnosti."),
        ("obchody", "Obchody", "obchody/", pages("12_Obchody"), "Obchody, služby a jejich nabídky."),
        ("postavy", "Postavy", "postavy/", pages("04_Postavy"), "Najdi postavu podle jména a vazeb."),
        ("frakce", "Frakce", "frakce/", pages("05_Frakce"), "Řády, odboj a další mocenské skupiny."),
        ("kampane", "Kampaně", "kampane/", pages("07_Kampane"), "Příběhové oblouky a jejich záznamy."),
        ("questy", "Questy", "questy/", pages("08_Questy"), "Dobrodružství a úkoly."),
        ("sezeni", "Sezení", "sezeni/", pages("10_Sezeni"), "Záznamy odehraných her."),
        ("hadanky", "Hádanky", "hadanky/", pages("09_Hadanky"), "Šifry, pasti a záhady."),
        ("knihy", "Knihy", "knihy/", pages("06_Knihy_a_Dokumenty"), "Texty, kroniky a listiny."),
        ("bestiar", "Bestiář", "bestiar/", entries("web/assets/srd/bestiar.json"), "Netvoři ze SRD 5.2.1."),
        ("kouzla", "Kouzla", "kouzla/", entries("web/assets/kouzla2024.json"), "Kouzla podle pravidel 2024."),
        ("predmety", "Předměty", "predmety/", entries("web/assets/srd/predmety.json"), "Výbava a magické předměty."),
        ("glosar", "Glosář", "glosar/", entries("web/assets/srd/glosar.json"), "Pojmy a stavy pravidel."),
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


def on_page_markdown(markdown, page, config, files):
    src = page.file.src_path
    root = Path(__file__).resolve().parent.parent
    if src == "README.md" and not 'class="nav-home-tiles"' in markdown:
        heading = re.search(r"(?m)^#\s+.+$", markdown)
        if heading:
            pos = heading.end()
            markdown = markdown[:pos] + "\n\n" + homepage_tiles(root) + "\n" + markdown[pos:]
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
