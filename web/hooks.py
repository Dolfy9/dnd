"""MkDocs hook: character sheets z front matter + cesta ke zdroji pro editor."""
import html
import json


def on_page_markdown(markdown, page, config, files):
    data = page.meta.get("postava")
    if data:
        payload = json.dumps(data, ensure_ascii=False).replace("</", "<\\/")
        markdown = ('<div class="postava-sheet"></div>\n'
                    f'<script type="application/json" class="postava-data">{payload}</script>\n\n' + markdown)
    return markdown


def on_page_content(content, page, config, files):
    src = page.file.src_uri
    return content + f'\n<div id="zdroj-stranky" data-cesta="{html.escape(src)}" hidden></div>\n'
