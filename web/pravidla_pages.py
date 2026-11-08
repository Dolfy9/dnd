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


def para(t):
    return "\n\n".join(x.strip() for x in str(t).split("\n") if x.strip())


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

    # PHB – povolání
    cls_nav = []
    for n, c in sorted(p["tridy"].items()):
        b = f"**Hit Die:** d{c.get('hit_die')}\n\n| | |\n|---|---|\n" + "".join(
            f"| **{k}** | {str(v).replace('|', '/')} |\n" for k, v in c.get("core", {}).items())
        tab = c.get("tabulka") or {}
        if tab:
            cols = list(next(iter(tab.values())).keys())
            b += f"\n## Tabulka povolání {n}\n\n| Level | " + " | ".join(cols) + " |\n|" + "---|" * (len(cols) + 1) + "\n"
            for lv, row in sorted(tab.items(), key=lambda x: int(x[0])):
                b += f"| {lv} | " + " | ".join(str(row.get(k, "")).replace("|", "/") for k in cols) + " |\n"
        b += "\n## Rysy povolání\n\n"
        for fn, fv in sorted((c.get("rysy") or {}).items(), key=lambda x: (x[1].get("uroven", 0) if isinstance(x[1], dict) else 0, x[0])):
            lv = fv.get("uroven", "") if isinstance(fv, dict) else ""
            b += f"### {fn}" + (f" <small>(Level {lv})</small>" if lv else "") + "\n\n" + para(fv.get("text", "") if isinstance(fv, dict) else fv) + "\n\n"
        subs = sorted((sn, sv) for sn, sv in p["podtridy"].items() if sv.get("trida") == n)
        if subs:
            b += "## Subclassy\n\n"
            for sn, sv in subs:
                b += f'??? note "{sn} – {sv.get("zdroj", "")}"\n'
                for fn, fv in sorted((sv.get("rysy") or {}).items(), key=lambda x: x[1].get("uroven", 0) if isinstance(x[1], dict) else 0):
                    lv = fv.get("uroven", "") if isinstance(fv, dict) else ""
                    txt = para(fv.get("text", "") if isinstance(fv, dict) else fv).replace("\n", "\n    ")
                    b += f"    **{fn}**" + (f" (Level {lv})" if lv else "") + f"\n\n    {txt}\n\n"
        cls_nav.append({n: w(f"phb/povolani/{slug(n)}.md", page(n, b))})
    idx = "Povolání podle pravidel 2024 (PHB 2024): rysy po úrovních, tabulky a subclassy.\n\n" + "".join(
        f"- [{list(x)[0]}]({slug(list(x)[0])}.md)\n" for x in cls_nav)
    cls_nav.insert(0, w("phb/povolani/index.md", page("Povolání", idx)))

    # PHB – druhy, pozadí, featy
    b = ""
    for n, s in sorted(p["druhy"].items()):
        b += f"## {n}\n\n*{s.get('zdroj', '')}* · Size: {s.get('velikost', '')} · Speed: {s.get('rychlost', '')} ft\n\n"
        for tn, tt in (s.get("rysy") or {}).items():
            b += f"**{tn}.** " + para(tt if isinstance(tt, str) else tt.get("text", "")) + "\n\n"
    druhy = w("phb/druhy.md", page("Druhy (Species)", b))
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
    return [{"Příručka hráče (PHB)": phb}, {"Příručka Pána jeskyně (DMG)": dmg}, {"Bestiář (Monster Manual)": mm}]
