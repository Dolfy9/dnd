"""Vykreslení Markdown → HTML (server-side, role-aware).

Používá python-markdown se stejnými rozšířeními jako dosavadní MkDocs build
(tables, admonition, attr_list, md_in_html, toc) + přepis odkazů:
  - relativní .md odkazy → /p/<cesta> (SPA route)
  - obrázky a média → /repo/<cesta> (statické servírování z repa)
  - kotvy #srd-<typ>-<klic> → data-srd atribut (statblock popover ve frontendu)
DM obsah se odfiltruje už při indexaci (pages.body_player/body_dm).
"""
import html as _html
import re
from urllib.parse import quote

import markdown

from markdown.extensions.toc import slugify_unicode

MD = markdown.Markdown(extensions=["tables", "admonition", "attr_list", "md_in_html",
                                   "toc", "sane_lists", "footnotes"],
                       extension_configs={"toc": {"permalink": True, "slugify": slugify_unicode}})

LINK_RE = re.compile(r'(<a\s[^>]*href=")([^"]+)(")', re.I)
IMG_RE = re.compile(r'(<img\s[^>]*src=")([^"]+)(")', re.I)


def _strip_ext(path: str) -> str:
    return re.sub(r"(README)?\.md$", "", path, flags=re.I)


def page_url(path: str) -> str:
    if path == "README.md":
        return "/"
    return "/p/" + quote(_strip_ext(path))


def _resolve_rel(src_path: str, target: str) -> str:
    """Relativní cíl → path v repu (bez existence checku – pro render stačí přepis)."""
    import os
    if target.startswith("/"):
        return target.lstrip("/")
    return os.path.normpath(os.path.join(os.path.dirname(src_path), target)).replace("\\", "/")


def rewrite_links(src_path: str, html_text: str) -> str:
    def link_sub(m):
        href = m.group(2)
        if href.startswith(("http:", "https:", "mailto:", "#srd-")):
            if href.startswith("#srd-"):
                # #srd-bestiar-Ghoul → data atribut pro popover
                parts = href[5:].split("-", 1)
                if len(parts) == 2:
                    return m.group(1) + href + m.group(3) + f' data-srd="{_html.escape(parts[0])}:{_html.escape(parts[1])}"'
            return m.group(0)
        if href.startswith("#"):
            return m.group(0)
        resolved = _resolve_rel(src_path, href)
        if resolved.endswith(".md") or resolved.endswith("/README.md") or "." not in resolved.rsplit("/", 1)[-1]:
            return m.group(1) + page_url(resolved if resolved.endswith(".md") else resolved + ".md") + m.group(3)
        # binární soubor (obrázek, pdf…) → /repo/
        return m.group(1) + "/repo/" + quote(resolved) + m.group(3)

    def img_sub(m):
        src = m.group(2)
        if src.startswith(("http:", "https:", "data:", "/repo/")):
            return m.group(0)
        resolved = _resolve_rel(src_path, src)
        return m.group(1) + "/repo/" + quote(resolved) + m.group(3)

    html_text = LINK_RE.sub(link_sub, html_text)
    html_text = IMG_RE.sub(img_sub, html_text)
    return html_text


_TAG_RE = re.compile(r"<(/?)([a-zA-Z0-9]+)([^>]*)>")
_SKIP_TAGS = re.compile(r"^(a|code|pre|kbd|samp|h[1-6]|button)$", re.I)
_WORD = r"ěščřžýáíéúůóďťňĚŠČŘŽÝÁÍÉÚŮÓĎŤŇ"


def _link_names(text: str, pairs: list[tuple[str, str]], pat: re.Pattern) -> str:
    if not text.strip():
        return text
    urls = dict(pairs)
    return pat.sub(
        lambda m: (f'<a href="{urls[m.group(1)]}" class="ghost"'
                   f' title="Zmínka bez explicitního odkazu">{m.group(1)}</a>'),
        text)


def autolink(html_text: str, pairs: list[tuple[str, str]]) -> str:
    """Neodkazované výskyty jmen entit přemění na 'ghost' odkazy (links everywhere).

    pairs = [(name, url), ...] seřazené podle délky jména sestupně.
    Zpracovává jen text mimo <a>, <code>, <pre>, nadpisy atd.
    """
    pairs = [(n, u) for n, u in pairs if len(n) >= 4]
    if not pairs:
        return html_text
    pat = re.compile(
        r"(?<![\w" + _WORD + r"/=])("
        + "|".join(re.escape(n) for n, _ in pairs)
        + r")(?![\w" + _WORD + r"])",
    )
    out, pos, depth = [], 0, 0
    for m in _TAG_RE.finditer(html_text):
        seg = html_text[pos:m.start()]
        out.append(seg if depth else _link_names(seg, pairs, pat))
        if _SKIP_TAGS.match(m.group(2)):
            if m.group(1):
                depth = max(0, depth - 1)
            elif not m.group(3).rstrip().endswith("/"):
                depth += 1
        out.append(m.group(0))
        pos = m.end()
    tail = html_text[pos:]
    out.append(tail if depth else _link_names(tail, pairs, pat))
    return "".join(out)


def render_markdown(src_path: str, body: str) -> str:
    MD.reset()
    html_text = MD.convert(body)
    return rewrite_links(src_path, html_text)


def status_class(status: str) -> str:
    if not status:
        return ""
    return "navrh" if "návrh" in status or "navrh" in status else "kanon"
