"""Extrakce odkazů z Markdown těla a frontmatteru → hrany grafu vazeb.

Odkazy: relativní .md odkazy ([x](../02_Zeme/Y.md)), absolutní /cesta, adresářové
odkazy (→ README.md). Kotvy (#…) a externí/SRD odkazy se zahazují.
Frontmatter vazby: postava.zeme/mesta/frakce/kampane, obchod.mesto/zeme/majitel/personal.
"""
import os
import re
from urllib.parse import unquote

MD_LINK = re.compile(r"(?<!!)\[[^\]]*\]\((<[^>]+>|[^)\s]+)(?:\s+[^)]*)?\)")

# frontmatter pole → (predikát, povolený prefix cíle nebo None)
FM_RELS = {
    "zeme": ("v_zemi", "02_Zeme/"),
    "mesta": ("v_meste", "03_Mesta/"),
    "mesto": ("v_meste", "03_Mesta/"),
    "frakce": ("ve_frakci", "05_Frakce/"),
    "kampane": ("v_kampani", "07_Kampane/"),
    "majitel": ("vlastni", "04_Postavy/"),
    "personal": ("zamestnava", "04_Postavy/"),
    "kouzla": ("umi_kouzlo", None),
    "druh": ("je_druhu", None),
    "pozadi": ("ma_pozadi", None),
}


def resolve(src_path: str, target: str, known: set[str]) -> str | None:
    """Přeloží href na path v repu; None, když cíl neexistuje."""
    target = unquote(target.split("#", 1)[0].split("?", 1)[0]).strip("<>")
    if not target or target.startswith(("http:", "https:", "mailto:", "data:")):
        return None
    if target.startswith("/"):
        resolved = target.lstrip("/")
    else:
        resolved = os.path.normpath(os.path.join(os.path.dirname(src_path), target)).replace("\\", "/")
    if resolved.endswith("/"):
        resolved += "README.md"
    elif not resolved.endswith(".md"):
        if resolved + ".md" in known:
            resolved += ".md"
        elif (resolved + "/README.md") in known:
            resolved += "/README.md"
    return resolved if resolved in known else None


def page_links(src_path: str, body: str, known: set[str]) -> set[str]:
    out = set()
    for m in MD_LINK.finditer(body):
        r = resolve(src_path, m.group(1), known)
        if r and r != src_path:
            out.add(r)
    return out


def fm_relations(data: dict) -> list[tuple[str, str]]:
    """Z entitních dat vytáhne (predikát, cílová cesta/hodnota)."""
    rels = []
    for field, (pred, prefix) in FM_RELS.items():
        vals = data.get(field)
        if vals is None:
            continue
        if not isinstance(vals, list):
            vals = [vals]
        for v in vals:
            if isinstance(v, str) and v.endswith(".md"):
                if prefix is None or v.startswith(prefix):
                    rels.append((pred, v.replace("\\", "/")))
    return rels


def find_mentions(name: str, pages_plain: dict[str, str], linked: dict[str, set[str]],
                  min_len: int = 4) -> set[str]:
    """Stránky, kde se jméno entity vyskytuje v textu, ale neodkazuje na ni."""
    if len(name.strip()) < min_len:
        return set()
    pat = re.compile(r"(?<![\wěščřžýáíéúůóďťňĚŠČŘŽÝÁÍÉÚŮÓĎŤŇ])" + re.escape(name.strip())
                     + r"(?![\wěščřžýáíéúůóďťňĚŠČŘŽÝÁÍÉÚŮÓĎŤŇ])", re.I)
    out = set()
    for path, text in pages_plain.items():
        if path in (linked.get(path) or set()):
            continue
        if pat.search(text or ""):
            out.add(path)
    return out
