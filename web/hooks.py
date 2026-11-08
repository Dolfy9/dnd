"""MkDocs hook: character sheets z front matter + cesta ke zdroji pro editor."""
import html
import json
import posixpath
import re
from pathlib import Path
from urllib.parse import quote


def on_page_markdown(markdown, page, config, files):
    src = page.file.src_path
    if not src.startswith("11_Mapy/"):
        data_path = Path(__file__).resolve().parent.parent / "11_Mapy" / "mista.json"
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
            block = (f'\n\n<div class="mapa-vlozena"><p><a class="md-button mapa-zobrazit" href="{href}">Zobrazit na mapě</a></p>'
                     f'<iframe title="Mapa: {html.escape(place["nazev"], quote=True)}" src="{crop}" loading="lazy"></iframe></div>\n\n')
            heading = re.search(r"^#\s+.+?$", markdown, re.M)
            if heading:
                end = heading.end()
                markdown = markdown[:end] + block + markdown[end:]
            else:
                markdown = block + markdown
    data = page.meta.get("postava")
    if data:
        payload = json.dumps(data, ensure_ascii=False).replace("</", "<\\/")
        markdown = ('<div class="postava-sheet"></div>\n'
                    f'<script type="application/json" class="postava-data">{payload}</script>\n\n' + markdown)
    return markdown


def on_page_content(content, page, config, files):
    src = page.file.src_uri
    return content + f'\n<div id="zdroj-stranky" data-cesta="{html.escape(src)}" hidden></div>\n'
