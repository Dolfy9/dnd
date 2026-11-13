"""Parsování Markdown stránek: YAML hlavička, Pro DM sekce, nadpisy, plaintext.

Tělo stránky (.md soubor) zůstává kanonické – index ukládá jen odvozené údaje.
body_player = tělo bez "## Pro DM" sekcí (podle nadpisů H1/H2; končí dalším nadpisem
stejné nebo vyšší úrovně – stejná logika jako dnešní extra.js).
"""
import re
import unicodedata

import yaml

FRONT_RE = re.compile(r"\A---\r?\n(.*?)\r?\n---\r?\n", re.S)
HEADING_RE = re.compile(r"^(#{1,6})\s+(.*?)\s*#*\s*$", re.M)
DM_RE = re.compile(r"^pro\s*dm", re.I)
STATUS_RE = re.compile(r"^\s*>\s*\*\*Stav:\*\*\s*(.+?)\s*$", re.M)
TITLE_PREFIX = re.compile(r"^(Postava|Město|Mesto|Země|Quest|Hádanka|Sezení|Kampaň|Šablona|Kniha|Obchod|Druh|Povolání|Podtřída)\s*:\s*", re.I)


def split_front(text: str) -> tuple[dict, str, str]:
    """Vrátí (frontmatter dict, tělo, surový front-blok vč. ---)."""
    m = FRONT_RE.match(text)
    if not m:
        return {}, text, ""
    try:
        meta = yaml.safe_load(m.group(1)) or {}
    except yaml.YAMLError:
        meta = {}
    if not isinstance(meta, dict):
        meta = {}
    return meta, text[m.end():], m.group(0)


def join_front(meta: dict, body: str) -> str:
    if not meta:
        return body
    return "---\n" + yaml.safe_dump(meta, allow_unicode=True, sort_keys=False, width=120) + "---\n" + body.lstrip("\n")


def strip_dm(body: str) -> tuple[str, str]:
    """Rozdělí tělo na (hráčská část, DM část) podle nadpisů „Pro DM…“.

    Pro DM sekce začíná nadpisem (úroveň ≤3) a končí dalším nadpisem stejné
    nebo vyšší úrovně — stejná logika jako dosavadní skrývání v extra.js.
    """
    heads = list(HEADING_RE.finditer(body))
    dm_ranges: list[tuple[int, int]] = []
    i = 0
    while i < len(heads):
        h = heads[i]
        level = len(h.group(1))
        if level <= 3 and DM_RE.match(h.group(2).strip()):
            end = len(body)
            for nxt in heads[i + 1:]:
                if len(nxt.group(1)) <= level:
                    end = nxt.start()
                    break
            dm_ranges.append((h.start(), end))
        i += 1
    if not dm_ranges:
        return body, ""
    player, dm, pos = [], [], 0
    for start, end in dm_ranges:
        player.append(body[pos:start])
        dm.append(body[start:end])
        pos = end
    player.append(body[pos:])
    return "".join(player), "\n".join(p.strip() for p in dm if p.strip())


def title_of(path: str, body: str, meta: dict) -> str:
    t = str(meta.get("title") or "")
    if not t:
        m = re.search(r"^#\s+(.+?)\s*$", body, re.M)
        t = m.group(1) if m else path.rsplit("/", 1)[-1].replace(".md", "").replace("_", " ")
    return TITLE_PREFIX.sub("", t).strip()


def status_of(body: str) -> str:
    m = STATUS_RE.search(body)
    return (m.group(1).strip().lower() if m else "")


try:
    from markdown.extensions.toc import slugify_unicode as _slugify_u  # shoda s render.py

    def slugify(text: str) -> str:
        return _slugify_u(text, "-")
except ImportError:
    def slugify(text: str) -> str:
        s = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
        s = re.sub(r"[^\w\s-]", "", s.lower())
        return re.sub(r"[-\s]+", "-", s).strip("-")


def toc_of(body: str) -> list[dict]:
    seen: dict[str, int] = {}
    out = []
    for h in HEADING_RE.finditer(body):
        level = len(h.group(1))
        if level > 3:
            continue
        text = h.group(2).strip()
        slug = slugify(text)
        if slug in seen:
            seen[slug] += 1
            slug = f"{slug}_{seen[slug]}"
        else:
            seen[slug] = 0
        out.append({"level": level, "title": text, "slug": slug})
    return out


PLAIN_STRIP = [
    (re.compile(r"!\[([^\]]*)\]\([^)]*\)"), r"\1"),
    (re.compile(r"\[([^\]]+)\]\([^)]*\)"), r"\1"),
    (re.compile(r"`+([^`]*)`+"), r"\1"),
    (re.compile(r"<[^>]+>"), " "),
    (re.compile(r"[*_~#>|]"), " "),
]


def plaintext(body: str) -> str:
    text = body
    for rx, sub in PLAIN_STRIP:
        text = rx.sub(sub, text)
    return re.sub(r"\s+", " ", text).strip()
