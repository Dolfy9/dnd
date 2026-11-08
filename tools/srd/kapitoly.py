"""Převod kapitol SRD 5.2.1 (PDF) na Markdown: python3 kapitoly.py cesta/k/SRD_CC_v5.2.1.pdf
Výstup: web/assets/srd/kapitoly/<slug>.md (nadpisy podle velikosti písma, tabulky přes find_tables)."""
import sys, re, json
from pathlib import Path
import pymupdf

OUT = Path(__file__).resolve().parents[2] / "web/assets/srd/kapitoly"
# (slug, název, první strana, poslední strana [čísla tištěná v SRD], rozdělit podle H2)
KAP = [("pravidla_hry", "Pravidla hry (Playing the Game)", 5, 18, False),
       ("tvorba_postavy", "Tvorba postavy a postup na úrovních (Character Creation)", 19, 27, False),
       ("nastroje_pj", "Nástroje PJ (Gameplay Toolbox)", 192, 203, True),
       ("kouzelne_predmety_pravidla", "Pravidla kouzelných předmětů (Magic Items)", 204, 208, False)]
H = {26: "#", 18: "##", 14: "###", 12: "####"}


def table_md(t):
    rows = [[(c or "").replace("\n", " ").strip() for c in r] for r in t.extract()]
    rows = [r for r in rows if any(r)]
    if not rows: return ""
    w = max(len(r) for r in rows)
    fixed = []
    for r in rows:
        cells = [c for c in r if c]
        if len(cells) == 1 and w > 1 and len(cells[0].split()) >= w:
            parts = cells[0].split(); cells = parts[:w - 1] + [" ".join(parts[w - 1:])] if len(parts) > w else parts
            r = cells
        fixed.append(r + [""] * (w - len(r)))
    s = "| " + " | ".join(fixed[0]) + " |\n|" + "---|" * w + "\n"
    return s + "".join("| " + " | ".join(c.replace("|", "/") for c in r) + " |\n" for r in fixed[1:]) + "\n"


def span_md(s):
    txt = s["text"]
    if not txt.strip(): return txt
    f, size = s["font"], round(s["size"])
    if "BoldItalic" in f: return "***" + txt.strip() + "*** "
    if "Bold" in f or ("SemiBold" in f and size < 11): return "**" + txt.strip() + "** "
    if "Italic" in f: return "*" + txt.strip() + "* "
    return txt


def page_md(pg):
    W = pg.rect.width
    tabs = pg.find_tables().tables
    tb = [pymupdf.Rect(t.bbox) for t in tabs]
    items = []
    for t, r in zip(tabs, tb):
        items.append((0 if r.x0 < W / 2 - 20 else 1, r.y0, "tab", table_md(t), None))
    for b in pg.get_text("dict")["blocks"]:
        if b.get("type") != 0: continue
        for l in b["lines"]:
            r = pymupdf.Rect(l["bbox"])
            if any(r.intersects(x) for x in tb): continue
            sp = [x for x in l["spans"] if x["color"] != 0x808285]
            if not "".join(x["text"] for x in sp).strip(): continue
            col = 0 if r.x0 < W / 2 - 20 else 1
            first = next(x for x in sp if x["text"].strip())
            size = round(first["size"]); r = pymupdf.Rect(r.x0, first["origin"][1] - first["size"], r.x1, first["origin"][1])
            if first["color"] == 0x8c2220 and size in H:
                items.append((col, r.y0, "h", H[size] + " " + "".join(x["text"] for x in sp).strip(), r)); continue
            bold = "Bold" in first["font"] or "SemiBold" in first["font"]
            items.append((col, r.y0, "l", "".join(span_md(x) for x in sp).rstrip(), (r, bold)))
    items.sort(key=lambda x: (x[0], x[1]))
    out, buf, prev = [], "", None
    def flush():
        nonlocal buf
        if buf: out.append(buf.strip() + "\n")
        buf = ""
    for col, y, k, v, meta in items:
        if k == "tab": flush(); out.append(v); prev = None; continue
        if k == "h":
            if out and out[-1].startswith(v.split(" ")[0] + " ") and prev == "h": out[-1] = out[-1].rstrip() + " " + v.split(" ", 1)[1] + "\n"
            else: flush(); out.append("\n" + v + "\n")
            prev = "h"; continue
        r, bold = meta
        newp = prev is None or prev == "h" or v.lstrip().startswith("•") or (bold and buf.rstrip().endswith((".", ":", "**"))) \
            or (isinstance(prev, tuple) and (r.y1 - prev[0].y1 > 17 or prev[1] != col))
        if newp:
            flush()
            buf = ("- " + v.lstrip()[1:].strip()) if v.lstrip().startswith("•") else v.strip()
        elif buf.endswith("-") and not buf.endswith(" -"): buf = buf[:-1] + v.lstrip()
        else: buf = buf + " " + v.strip()
        prev = (r, col)
    flush()
    s = "\n".join(out)
    s = re.sub(r"\*\*\s*\*\*", "", s); s = re.sub(r"\*\*(\s*)([^*\n]+?)\s*\*\*", r"**\2**", s)
    return s


def main(pdf):
    d = pymupdf.open(pdf); OUT.mkdir(parents=True, exist_ok=True); idx = []
    for slug, title, a, b, split in KAP:
        md = "\n".join(page_md(d[i - 1]) for i in range(a, b + 1))
        md = re.sub(r"\n{3,}", "\n\n", md).strip()
        for _ in range(3): md = re.sub(r"^(#+) (.+)\n+\1 (?=[a-z]|Magical|Contagions)", r"\1 \2 ", md, flags=re.M)
        md = re.sub(r"^# .*\n", "", md, flags=re.M)
        if split:
            parts = re.split(r"\n(?=## )", "\n" + md)
            for p in parts:
                p = p.strip()
                if not p.startswith("## "): continue
                name = p.split("\n", 1)[0][3:].strip()
                if "\n" not in p: continue
                s2 = slug + "_" + re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")
                (OUT / f"{s2}.md").write_text("# " + name + "\n" + p.split("\n", 1)[1] + "\n", encoding="utf-8")
                idx.append({"slug": s2, "nazev": name, "skupina": title})
        else:
            (OUT / f"{slug}.md").write_text("# " + title + "\n\n" + md + "\n", encoding="utf-8")
            idx.append({"slug": slug, "nazev": title, "skupina": None})
    (OUT / "index.json").write_text(json.dumps(idx, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps(idx, ensure_ascii=False))


main(sys.argv[1])
