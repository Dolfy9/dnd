# Předměty SRD 5.2.1 (CC-BY 4.0) z Open5e API -> web/assets/srd/predmety.json
import os as _os
ROOT = _os.path.abspath(_os.path.join(_os.path.dirname(__file__), "..", ".."))
import json, urllib.request
def get(ep):
    url, raw = f"https://api.open5e.com/v2/{ep}/?document__key=srd-2024&limit=200", []
    while url:
        d = json.load(urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "curl/8"}), timeout=60)); raw += d["results"]; url = d.get("next")
    return [r for r in raw if "srd-2024" in json.dumps(r.get("document"))]
def nm(x): return x.get("name", "") if isinstance(x, dict) else (x or "")
out = []
for r in get("items") + get("magicitems"):
    w, a = r.get("weapon") or {}, r.get("armor") or {}
    extra = ""
    if isinstance(w, dict) and w:
        props = ", ".join(nm(p.get("property")) + (f" ({p['detail']})" if p.get("detail") else "") for p in w.get("properties", []) if isinstance(p, dict))
        extra = f"Zbraň: {w.get('damage_dice','')} {nm(w.get('damage_type'))}" + (f", dostřel {w.get('range')}/{w.get('long_range')}" if w.get("range") else "") + (f", vlastnosti: {props}" if props else "")
    if isinstance(a, dict) and a:
        extra = f"Zbroj: AC {a.get('ac_display','')} ({a.get('category','')})" + (", nevýhoda na Stealth" if a.get("grants_stealth_disadvantage") else "") + (f", STR {a['strength_score_required']}" if a.get("strength_score_required") else "")
    out.append({"nazev": r["name"], "kategorie": nm(r.get("category")), "vzacnost": nm(r.get("rarity")), "druh": "kouzelný" if r.get("rarity") else "běžný",
                "cena": r.get("cost"), "vaha": r.get("weight"), "attunement": bool(r.get("requires_attunement")),
                "text": ((extra + "\n") if extra else "") + (r.get("desc") or ""), "zdroj": "SRD 5.2.1"})
seen, res = set(), []
for o in sorted(out, key=lambda o: o["nazev"]):
    if o["nazev"] in seen: continue
    seen.add(o["nazev"]); res.append(o)
json.dump(res, open(ROOT + "/web/assets/srd/predmety.json", "w"), ensure_ascii=False)
print(len(res)); print([x for x in res if x["nazev"] == "Longsword"][:1])
