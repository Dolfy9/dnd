"""Generuje stránky znalostní báze pravidel 2024 (PHB / DMG / MM) do docs/pravidla/."""
import json
from pathlib import Path

A = Path(__file__).parent / "assets"
LIC = "\n\n<small>Data: pravidla 2024 (PHB 2024) a SRD 5.2.1 (CC-BY 4.0). Funkční názvy jsou anglicky.</small>\n"


def slug(s):
    return "".join(c if c.isalnum() else "_" for c in s).strip("_")


def katalog(typ, pole="", hodnoty=""):
    a = f' data-pole="{pole}" data-hodnoty="{hodnoty}"' if pole else ""
    return f'<div class="srd-katalog" data-typ="{typ}"{a}></div>\n'


def page(title, body, hide_toc=False):
    fm = "---\nhide:\n  - toc\n---\n" if hide_toc else ""
    return f"{fm}# {title}\n\n{body}{LIC}"


def _table(title, cells):
    long = [i for i, c in enumerate(cells) if len(c) > 45]
    k = 2
    if long and long[0] - 1 >= 2 and len(cells) % (long[0] - 1) == 0: k = long[0] - 1
    elif len(cells) % 2: k = 3 if len(cells) % 3 == 0 else 2
    if cells and cells[0] in ("Name", "Název"): k = 1
    rows = [cells[i:i + k] for i in range(0, len(cells), k)]
    md = (f"**{title}**\n\n" if title else "") + "| " + " | ".join(rows[0]) + " |\n|" + "---|" * k + "\n"
    return md + "".join("| " + " | ".join(r + [""] * (k - len(r))) + " |\n" for r in rows[1:])


_CS_F = A / "preklad" / "pravidla_cs.json"
CS = json.load(open(_CS_F, encoding="utf-8")) if _CS_F.exists() else {}


def cs(x):
    x = x.strip()
    return CS.get(x, x)


def para(t):
    lines = [x for x in str(t).split("\n")]
    out, i = [], 0
    while i < len(lines):
        if lines[i].strip().startswith("|"):
            title = out.pop() if out and len(out[-1]) < 60 and not out[-1].endswith(".") else ""
            cells = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                cells.append(cs(lines[i].strip()[1:]).replace("|", "/")); i += 1
            out.append(_table(title, cells)); continue
        if lines[i].strip(): out.append(cs(lines[i]))
        i += 1
    return "\n\n".join(out)


def build(docs: Path):
    p = json.load(open(A / "pravidla2024.json", encoding="utf-8"))
    out = docs / "pravidla"
    out.mkdir(exist_ok=True)
    files = {}

    def w(rel, txt):
        f = out / rel
        f.parent.mkdir(parents=True, exist_ok=True)
        f.write_text(txt, encoding="utf-8")
        return "pravidla/" + rel

    def feature_sort(item):
        feature = item[1]
        level = feature.get("uroven", 0) if isinstance(feature, dict) else 0
        try:
            return (0, float(level), item[0])
        except (TypeError, ValueError):
            return (1, str(level), item[0])

    # PHB – odkazy na nové příručky povolání
    cls_nav = []
    for n in sorted(p["tridy"]):
        target = f"../../../14_Povolani/Povolani_{slug(n)}.md"
        body = f"Podrobný přehled pravidel se přesunul do nové [příručky povolání {n}]({target})."
        cls_nav.append({n: w(f"phb/povolani/{slug(n)}.md", page(n, body))})
    idx = "Příručky povolání podle pravidel 2024 jsou v novém katalogu.\n\n" + "".join(
        f"- [{n}](../../../14_Povolani/Povolani_{slug(n)}.md)\n" for n in sorted(p["tridy"]))
    cls_nav.insert(0, w("phb/povolani/index.md", page("Povolání", idx)))

    # PHB – druhy, pozadí, featy
    druhy = w("phb/druhy.md", page(
        "Druhy (Species)",
        "Katalog druhů a jejich pravidla jsou přesunuty do [Katalogu druhů](../../druhy.md)."
    ))
    b = "| Background | Ability Scores | Origin Feat | Skills | Tool |\n|---|---|---|---|---|\n" + "".join(
        f"| **{n}** | {s.get('atributy', '')} | {s.get('feat', '')} | {s.get('dovednosti', '')} | {s.get('nastroj', '')} |\n" for n, s in sorted(p["pozadi"].items()))
    b += "\n" + "".join(f"### {n}\n\n**Equipment:** {s.get('vybava', '')}\n\n" for n, s in sorted(p["pozadi"].items()))
    pozadi = w("phb/pozadi.md", page("Pozadí (Backgrounds)", b))
    srdf = {x["nazev"]: x for x in json.load(open(A / "srd/puvod_a_featy.json", encoding="utf-8")) if x.get("druh") == "feat"}
    b = ""
    for n, f in sorted(p["featy"].items()):
        b += f"### {n}\n\n" + para(f.get("text", "")) + "\n\n"
    featy = w("phb/featy.md", page("Featy", b))

    def kat(rel, title, intro, typ, pole="", hod=""):
        return w(rel, page(title, intro + "\n\n" + katalog(typ, pole, hod), True))

    K = json.load(open(A / "srd/kapitoly/index.json", encoding="utf-8"))
    def kap(slug):
        t = (A / "srd/kapitoly" / (slug + ".md")).read_text(encoding="utf-8")
        t = t.replace("\n# ", "\n## ", 0)
        return w(f"kap/{slug}.md", t + LIC)
    toolbox = [{x["nazev"]: kap(x["slug"])} for x in K if x["skupina"]]
    phb_kap = [{"Pravidla hry": kap("pravidla_hry")}, {"Tvorba postavy a level up": kap("tvorba_postavy")}]
    phb = phb_kap + [{"Povolání": cls_nav}, {"Druhy (Species)": druhy}, {"Pozadí (Backgrounds)": pozadi}, {"Featy": featy},
           {"Výbava": [
               {"Zbraně": kat("phb/zbrane.md", "Zbraně", "Zbraně a střelivo (SRD 5.2.1).", "predmety", "kategorie|druh", "Weapon,Ammunition|běžný")},
               {"Zbroje a štíty": kat("phb/zbroje.md", "Zbroje a štíty", "Zbroje a štíty (SRD 5.2.1).", "predmety", "kategorie|druh", "Armor|běžný")},
               {"Dobrodružná výbava": kat("phb/vybava.md", "Dobrodružná výbava", "Výbava, balíčky a ohniska (SRD 5.2.1).", "predmety", "kategorie", "Adventuring Gear,Equipment Pack,Spellcasting Focus")},
               {"Nástroje": kat("phb/nastroje.md", "Nástroje", "Nástroje (SRD 5.2.1).", "predmety", "kategorie", "Tools")},
               {"Zvířata a dopravní prostředky": kat("phb/doprava.md", "Zvířata a dopravní prostředky", "Jízdní zvířata a vozidla (SRD 5.2.1).", "predmety", "kategorie", "Mount,Land Vehicle,Waterborne Vehicle")}]},
           {"Kouzla": "kouzla.md"}, {"Glosář pravidel": "glosar.md"}]
    rar = ["Common", "Uncommon", "Rare", "Very Rare", "Legendary", "Artifact"]
    dmg = [{"Nástroje PJ": toolbox}, {"Pravidla kouzelných předmětů": kap("kouzelne_predmety_pravidla")}, {"Kouzelné předměty (vše)": kat("dmg/kouzelne_predmety.md", "Kouzelné předměty", "Všechny kouzelné předměty ze SRD 5.2.1.", "predmety", "druh", "kouzelný")}]
    dmg += [{f"Vzácnost: {r}": kat(f"dmg/predmety_{slug(r).lower()}.md", f"Kouzelné předměty – {r}", f"Kouzelné předměty vzácnosti {r}.", "predmety", "vzacnost", r)} for r in rar]
    for title, cats in [("Lektvary a svitky", "Potion,Scroll"), ("Prsteny", "Ring"), ("Hůlky, hole a žezla", "Wand,Staff,Rod"), ("Divotvorné předměty", "Wondrous Item")]:
        dmg.append({title: kat(f"dmg/{slug(title).lower()}.md", title, f"{title} (SRD 5.2.1).", "predmety", "kategorie", cats)})
    dmg.append({"Glosář pravidel": "glosar.md"})
    b = json.load(open(A / "srd/bestiar.json", encoding="utf-8"))
    typy = sorted({x["typ"] for x in b})
    mm = [{"Všichni netvoři": "bestiar.md"}]
    mm += [{t.capitalize(): kat(f"mm/{t}.md", f"Bestiář – {t.capitalize()}", f"Netvoři typu {t.capitalize()} (SRD 5.2.1).", "bestiar", "typ", t)} for t in typy]
    for lo, hi, n in [(0, 4, "CR 0–4"), (5, 10, "CR 5–10"), (11, 16, "CR 11–16"), (17, 30, "CR 17–30")]:
        mm.append({n: w(f"mm/cr_{lo}_{hi}.md", page(f"Bestiář – {n}", f"Netvoři s CR {lo}–{hi}.\n\n" + f'<div class="srd-katalog" data-typ="bestiar" data-crmin="{lo}" data-crmax="{hi}"></div>\n', True))})
    dmg.append({"Předměty a výbava (vše)": "predmety.md"})
    return [{"Příručka hráče": phb}, {"Příručka PJ": dmg}, {"Bestiář": mm}]
