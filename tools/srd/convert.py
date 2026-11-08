# SRD 5.2 (CC-BY 4.0) z foundryvtt/dnd5e packs/_source -> web/assets/srd/*.json
import os as _os
ROOT = _os.path.abspath(_os.path.join(_os.path.dirname(__file__), "..", ".."))
import yaml, json, re, glob, os
SRC = os.path.expanduser("~/srd/foundry/packs/_source"); OUT = ROOT + "/web/assets/srd"; os.makedirs(OUT, exist_ok=True)
NAME = "the creature"
def clean(h):
    h = h or ""
    h = re.sub(r"\[\[lookup @name[^\]]*\]\]\{[^}]*\}", NAME, h).replace("the " + NAME, NAME).replace("The " + NAME, NAME[0].upper() + NAME[1:])
    h = re.sub(r"\[\[/[a-z]+ ([^\]]+)\]\](\{([^}]*)\})?", lambda m: m.group(3) or m.group(1), h)
    h = re.sub(r"@\w+\[[^\]]*\]\{([^}]*)\}", r"\1", h); h = re.sub(r"@\w+\[([^\]]*)\]", lambda m: m.group(1).split(".")[-1], h)
    h = re.sub(r"&Reference\[([^\]\s]+)[^\]]*\]", r"\1", h)
    h = re.sub(r"\[\[[^\]]*\]\]", "", h)
    h = re.sub(r"<(br|/p|/li|/h\d)[^>]*>", "\n", h); h = re.sub(r"<[^>]+>", "", h)
    return re.sub(r"\n\s*\n+", "\n", h).replace("&nbsp;", " ").strip()
SK = {"acr":"Acrobatics","ani":"Animal Handling","arc":"Arcana","ath":"Athletics","dec":"Deception","his":"History","ins":"Insight","itm":"Intimidation","inv":"Investigation","med":"Medicine","nat":"Nature","prc":"Perception","prf":"Performance","per":"Persuasion","rel":"Religion","slt":"Sleight of Hand","ste":"Stealth","sur":"Survival"}
AB = ["str", "dex", "con", "int", "wis", "cha"]
mon = []
for f in glob.glob(SRC + "/actors24/**/*.yml", recursive=True):
    if f.endswith("_folder.yml"): continue
    d = yaml.safe_load(open(f)); s = d.get("system", {})
    if d.get("type") != "npc": continue
    NAME = d["name"].lower()
    a = s.get("attributes", {}); det = s.get("details", {}); tr = s.get("traits", {})
    mv = a.get("movement", {}) or {}
    feats = {"trait": [], "action": [], "bonus": [], "reaction": [], "legendary": []}
    for it in d.get("items", []):
        isys = it.get("system", {}); act = (isys.get("activities") or {})
        kind = "trait"
        for v in (act.values() if isinstance(act, dict) else []):
            t = (v.get("activation") or {}).get("type", "")
            if t in ("action", "bonus", "reaction", "legendary"): kind = t; break
        if it.get("type") == "spell": continue
        feats[kind].append({"nazev": it["name"], "text": clean((isys.get("description") or {}).get("value"))[:1500]})
    cr = det.get("cr"); crs = {0.125: "1/8", 0.25: "1/4", 0.5: "1/2"}.get(cr, str(int(cr)) if isinstance(cr, (int, float)) else str(cr))
    mon.append({"nazev": d["name"], "cr": crs, "cr_num": cr, "typ": (det.get("type") or {}).get("value", ""), "velikost": {"tiny":"Tiny","sm":"Small","med":"Medium","lg":"Large","huge":"Huge","grg":"Gargantuan"}.get(tr.get("size",""), tr.get("size","")),
                "zarovnani": det.get("alignment", ""), "ac": (a.get("ac") or {}).get("flat"), "hp": (a.get("hp") or {}).get("max"), "hp_vzorec": (a.get("hp") or {}).get("formula"),
                "rychlost": {k: int(float(v)) for k, v in mv.items() if k in ("walk","fly","swim","climb","burrow") and str(v).replace(".","",1).isdigit() and float(v)},
                "atributy": {k.upper(): s["abilities"][k]["value"] for k in AB}, "zachrany": [k.upper() for k in AB if s["abilities"][k].get("proficient")],
                "dovednosti": [SK.get(k, k) for k, v in (s.get("skills") or {}).items() if v.get("value")],
                "jazyky": ", ".join((tr.get("languages") or {}).get("value", [])), "imunity": ", ".join((tr.get("di") or {}).get("value", [])), "odolnosti": ", ".join((tr.get("dr") or {}).get("value", [])),
                "smysly": {k: v for k, v in ((a.get("senses") or {}).get("ranges") or a.get("senses") or {}).items() if isinstance(v, (int, float)) and v},
                "rysy": feats["trait"], "akce": feats["action"], "bonusove_akce": feats["bonus"], "reakce": feats["reaction"], "legendarni": feats["legendary"],
                "zdroj": "SRD 5.2"})
mon.sort(key=lambda m: m["nazev"])
json.dump(mon, open(OUT + "/bestiar.json", "w"), ensure_ascii=False)
items = []
for f in glob.glob(SRC + "/equipment24/**/*.yml", recursive=True):
    if f.endswith("_folder.yml"): continue
    d = yaml.safe_load(open(f)); s = d.get("system", {})
    items.append({"nazev": d["name"], "druh": d.get("type"), "kategorie": f.split("equipment24/")[1].split("/")[0], "vzacnost": s.get("rarity", ""),
                  "cena": (s.get("price") or {}), "vaha": (s.get("weight") or {}).get("value") if isinstance(s.get("weight"), dict) else s.get("weight"),
                  "attunement": bool(s.get("attunement")), "text": clean((s.get("description") or {}).get("value"))[:3000], "zdroj": "SRD 5.2"})
items.sort(key=lambda m: m["nazev"]); json.dump(items, open(OUT + "/predmety.json", "w"), ensure_ascii=False)
ft = []
for f in glob.glob(SRC + "/feats24/**/*.yml", recursive=True) + glob.glob(SRC + "/origins24/**/*.yml", recursive=True):
    if f.endswith("_folder.yml"): continue
    d = yaml.safe_load(open(f)); ft.append({"nazev": d["name"], "druh": d.get("type"), "text": clean((d.get("system", {}).get("description") or {}).get("value"))[:3000]})
json.dump(ft, open(OUT + "/puvod_a_featy.json", "w"), ensure_ascii=False)
print(len(mon), "netvorů,", len(items), "předmětů,", len(ft), "featů/původů")
print(json.dumps(mon[0], ensure_ascii=False)[:800])
