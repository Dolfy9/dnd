# Bestiář SRD 5.2.1 (CC-BY 4.0) z Open5e API (document srd-2024) -> web/assets/srd/bestiar.json
import os as _os
ROOT = _os.path.abspath(_os.path.join(_os.path.dirname(__file__), "..", ".."))
import json, urllib.request
url = "https://api.open5e.com/v2/creatures/?document__key=srd-2024&limit=100"; raw = []
while url:
    d = json.load(urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "curl/8"}), timeout=60)); raw += d["results"]; url = d.get("next")
def nm(x): return x.get("name", "") if isinstance(x, dict) else (x or "")
KIND = {"ACTION": "akce", "BONUS_ACTION": "bonusove_akce", "REACTION": "reakce", "LEGENDARY_ACTION": "legendarni"}
out = []
def lim(u):
    if not isinstance(u, dict): return ""
    if u.get("type") == "RECHARGE_ON_ROLL": return " (Recharge 6)" if u.get("param") == 6 else " (Recharge %s–6)" % u.get("param")
    return " (%s/%s)" % (u.get("param", ""), str(u.get("type", "")).replace("PER_", "").replace("_", " ").title())
for r in raw:
    cr = r.get("challenge_rating"); crs = {0.125: "1/8", 0.25: "1/4", 0.5: "1/2"}.get(cr, str(int(cr)) if isinstance(cr, (int, float)) else str(cr))
    m = {"nazev": r["name"], "cr": crs, "cr_num": cr, "typ": nm(r.get("type")).lower(), "velikost": nm(r.get("size")), "zarovnani": r.get("alignment", ""),
         "ac": r.get("armor_class"), "ac_detail": r.get("armor_detail", ""), "hp": r.get("hit_points"), "hp_vzorec": r.get("hit_dice", ""),
         "rychlost": {k: v for k, v in (r.get("speed") or {}).items() if isinstance(v, (int, float)) and v and k != "hover"},
         "atributy": {k[:3].upper(): v for k, v in (r.get("ability_scores") or {}).items()},
         "zachrany": [f"{k[:3].upper()} {v:+d}" for k, v in (r.get("saving_throws") or {}).items() if v is not None and v != ((r.get("ability_scores") or {}).get(k, 10) - 10) // 2],
         "dovednosti": [f"{k.replace('_', ' ').title()} +{v}" for k, v in (r.get("skill_bonuses") or {}).items()],
         "jazyky": (r.get("languages") or {}).get("as_string", "") if isinstance(r.get("languages"), dict) and "as_string" in r.get("languages") else nm(r.get("languages")) if isinstance(r.get("languages"), dict) else ", ".join(nm(x) for x in (r.get("languages") or [])) if isinstance(r.get("languages"), list) else str(r.get("languages") or ""),
         "imunity": "", "odolnosti": "", "smysly": {k.replace("_range", ""): r[k] for k in ("darkvision_range", "blindsight_range", "tremorsense_range", "truesight_range") if r.get(k)},
         "pasivni_vnimani": r.get("passive_perception"), "iniciativa": r.get("initiative_bonus"), "xp": r.get("experience_points"),
         "rysy": [{"nazev": t["name"], "text": t["desc"]} for t in r.get("traits", [])], "akce": [], "bonusove_akce": [], "reakce": [], "legendarni": [], "zdroj": "SRD 5.2.1"}
    ri = r.get("resistances_and_immunities") or {}
    if isinstance(ri, dict):
        m["imunity"] = "; ".join(str(ri.get(k)) for k in ("damage_immunities_display", "condition_immunities_display") if ri.get(k))
        m["odolnosti"] = str(ri.get("damage_resistances_display") or "")
    for a in sorted(r.get("actions", []), key=lambda a: a.get("order_in_statblock") or 0):
        m[KIND.get(a.get("action_type"), "akce")].append({"nazev": a["name"] + lim(a.get("usage_limits")), "text": a["desc"]})
    out.append(m)
out.sort(key=lambda m: m["nazev"])
json.dump(out, open(ROOT + "/web/assets/srd/bestiar.json", "w"), ensure_ascii=False)
print(len(out)); print(json.dumps([x for x in out if x["nazev"] == "Adult Red Dragon"][0], ensure_ascii=False)[:1200])
