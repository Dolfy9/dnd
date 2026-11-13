"""D&D 2024 charakterový engine – serverový port z postava.js.

Počítá odvozené staty postavy z frontmatter dat (postava:) a knihovny
pravidel (rules tabulka): úroveň, PB, modifikátory, záchrany, dovednosti,
AC, HP, hit dice, iniciativa, pasivní Perception, spellcasting DC/attack,
sloty, XP postup.
"""
import json

from . import db

AB = ["STR", "DEX", "CON", "INT", "WIS", "CHA"]
AB_EN = {"Strength": "STR", "Dexterity": "DEX", "Constitution": "CON",
         "Intelligence": "INT", "Wisdom": "WIS", "Charisma": "CHA"}
SKILLS = {
    "Acrobatics": "DEX", "Animal Handling": "WIS", "Arcana": "INT",
    "Athletics": "STR", "Deception": "CHA", "History": "INT",
    "Insight": "WIS", "Intimidation": "CHA", "Investigation": "INT",
    "Medicine": "WIS", "Nature": "INT", "Perception": "WIS",
    "Performance": "CHA", "Persuasion": "CHA", "Religion": "INT",
    "Sleight of Hand": "DEX", "Stealth": "DEX", "Survival": "WIS",
}
CASTER = {"Artificer": (2, "INT"), "Bard": (1, "CHA"), "Cleric": (1, "WIS"),
          "Druid": (1, "WIS"), "Sorcerer": (1, "CHA"), "Wizard": (1, "INT"),
          "Paladin": (2, "CHA"), "Ranger": (2, "WIS")}
THIRD = {"Eldritch Knight": "INT", "Arcane Trickster": "INT"}
MULTI = [[], [2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1],
         [4, 3, 3, 2], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2], [4, 3, 3, 3, 2, 1],
         [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1],
         [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1],
         [4, 3, 3, 3, 2, 1, 1, 1, 1], [4, 3, 3, 3, 3, 1, 1, 1, 1],
         [4, 3, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 3, 2, 2, 1, 1]]
XP_LEVELS = [0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000,
             85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000,
             305000, 355000]

# CR tabulka (cr, ac, hp, atk, dpr, dc) + XP odměny – jako v postava.js
CRT = [("0", 13, 6, 3, 1, 13), ("1/8", 13, 35, 3, 3, 13), ("1/4", 13, 49, 3, 5, 13),
       ("1/2", 13, 70, 3, 8, 13), ("1", 13, 85, 3, 14, 13), ("2", 13, 100, 3, 20, 13),
       ("3", 13, 115, 4, 26, 13), ("4", 14, 130, 5, 32, 14), ("5", 15, 145, 6, 38, 15),
       ("6", 15, 160, 6, 44, 15), ("7", 15, 175, 6, 50, 15), ("8", 16, 190, 7, 56, 16),
       ("9", 16, 205, 7, 62, 16), ("10", 17, 220, 7, 68, 16), ("11", 17, 235, 8, 74, 17),
       ("12", 17, 250, 8, 80, 17), ("13", 18, 265, 8, 86, 18), ("14", 18, 280, 8, 92, 18),
       ("15", 18, 295, 8, 98, 18), ("16", 18, 310, 9, 104, 18), ("17", 19, 325, 10, 110, 19),
       ("18", 19, 340, 10, 116, 19), ("19", 19, 355, 10, 122, 19), ("20", 19, 400, 10, 140, 19),
       ("21", 19, 445, 11, 158, 20), ("22", 19, 490, 11, 176, 20), ("23", 19, 535, 11, 194, 20),
       ("24", 19, 580, 12, 212, 21), ("25", 19, 625, 12, 230, 21), ("26", 19, 670, 12, 248, 21),
       ("27", 19, 715, 13, 266, 22), ("28", 19, 760, 13, 284, 22), ("29", 19, 805, 13, 302, 22),
       ("30", 19, 850, 14, 320, 23)]
XP_CR = {"0": 10, "1/8": 25, "1/4": 50, "1/2": 100, "1": 200, "2": 450, "3": 700,
         "4": 1100, "5": 1800, "6": 2300, "7": 2900, "8": 3900, "9": 5000,
         "10": 5900, "11": 7200, "12": 8400, "13": 10000, "14": 11500,
         "15": 13000, "16": 15000, "17": 18000, "18": 20000, "19": 22000,
         "20": 25000, "21": 33000, "22": 41000, "23": 50000, "24": 62000,
         "25": 75000, "26": 90000, "27": 105000, "28": 120000, "29": 135000,
         "30": 155000}


def _cr_idx(v: float, col: int) -> int:
    for i, row in enumerate(CRT):
        if v <= row[col]:
            return i
    return len(CRT) - 1


def _compute_cr(hp: int, ac: int, dpr: float, atk: float, dc: float) -> dict:
    di = _cr_idx(hp, 2)
    di = max(0, min(len(CRT) - 1, di + int((ac - CRT[di][1]) / 2)))
    oi = _cr_idx(dpr, 4)
    use_dc = dc and (not atk or dc - 8 > atk)
    dif = (dc - CRT[oi][5]) if use_dc else (atk - CRT[oi][3])
    oi = max(0, min(len(CRT) - 1, oi + int(dif / 2)))
    fi = round((di + oi) / 2)
    return {"cr": CRT[fi][0], "def": CRT[di][0], "off": CRT[oi][0],
            "xp": XP_CR[CRT[fi][0]]}


def mod(score) -> int:
    try:
        return (int(score) - 10) // 2
    except (TypeError, ValueError):
        return 0


def sg(n: int) -> str:
    return f"+{n}" if n >= 0 else str(n)


def _has(list_, name: str) -> bool:
    for f in list_ or []:
        if (f.get("nazev") if isinstance(f, dict) else f) == name:
            return True
    return False


def _lvl_of(c: dict, trida: str) -> int:
    return sum(int(t.get("uroven") or 0) for t in c.get("tridy") or []
               if isinstance(t, dict) and t.get("trida") == trida)


def _rules(kind: str) -> dict:
    """kind → {key: data} z rules tabulky."""
    rows = db.connect().execute("SELECT key,name,data FROM rules WHERE kind=?", (kind,)).fetchall()
    out = {}
    for r in rows:
        try:
            out[r["key"]] = json.loads(r["data"])
        except Exception:
            pass
    return out


def compute(c: dict) -> dict:
    """Odvozené staty postavy (exhaustion nastavuje klient – session stav)."""
    R_tridy = _rules("class")
    d: dict = {}
    tridy = [t for t in (c.get("tridy") or []) if isinstance(t, dict)]
    d["lvl"] = sum(int(t.get("uroven") or 0) for t in tridy) or 1
    exhaustion = int(c.get("_exhaustion") or 0)
    exhaust_pen = -2 * exhaustion
    d["exhaustion"] = exhaustion
    d["exhaust_penalty"] = exhaust_pen
    d["pb"] = 2 + (d["lvl"] - 1) // 4
    d["mods"] = {a: mod((c.get("atributy") or {}).get(a)) for a in AB}
    d["check_mods"] = {a: d["mods"][a] + exhaust_pen for a in AB}

    # záchrany: extra ze zachrany_navic + základní z první třídy
    save_prof = list(c.get("zachrany_navic") or [])
    first = tridy[0] if tridy else None
    if first:
        core = (R_tridy.get(first.get("trida") or "") or {}).get("core") or {}
        stp = core.get("Saving Throw Proficiencies") or ""
        for en, ab in AB_EN.items():
            if en in stp and ab not in save_prof:
                save_prof.append(ab)
    d["save_prof"] = save_prof
    d["saves"] = {a: d["mods"][a] + (d["pb"] if a in save_prof else 0) + exhaust_pen for a in AB}

    # dovednosti
    profs = {str(x) for x in (c.get("dovednosti") or [])}
    exps = {str(x) for x in (c.get("expertiza") or [])}
    jack = _lvl_of(c, "Bard") >= 2
    d["skills"] = {}
    for s, ab in SKILLS.items():
        prof, exp = s in profs, s in exps
        val = (d["mods"][ab] + (d["pb"] if prof else 0) + (d["pb"] if exp else 0)
               + ((d["pb"] // 2) if (not prof and not exp and jack) else 0) + exhaust_pen)
        d["skills"][s] = {"val": val, "prof": prof, "exp": exp}
    d["passive"] = 10 + d["skills"]["Perception"]["val"] - exhaust_pen

    d["init"] = d["mods"]["DEX"] + (d["pb"] if _has(c.get("featy"), "Alert") else 0) + exhaust_pen

    # AC
    z = c.get("zbroj") or {}
    typ = z.get("typ", "none")
    if typ == "heavy":
        ac = int(z.get("zakladni_ac") or 0)
    elif typ == "medium":
        ac = int(z.get("zakladni_ac") or 0) + min(d["mods"]["DEX"], 2)
    elif typ == "light":
        ac = int(z.get("zakladni_ac") or 0) + d["mods"]["DEX"]
    else:
        ac = 10 + d["mods"]["DEX"]
        if _lvl_of(c, "Barbarian"):
            ac = max(ac, 10 + d["mods"]["DEX"] + d["mods"]["CON"])
        if _lvl_of(c, "Monk") and not z.get("stit"):
            ac = max(ac, 10 + d["mods"]["DEX"] + d["mods"]["WIS"])
        if z.get("zakladni_ac"):
            ac = max(ac, int(z["zakladni_ac"]) + d["mods"]["DEX"])
    if z.get("stit"):
        ac += 2
    if typ and typ != "none" and _has(c.get("featy"), "Defense"):
        ac += 1
    ac += int(z.get("bonus") or 0)
    d["ac"] = int(c.get("ac_rucne") or ac)

    # HP + hit dice
    hp, dice = 0, {}
    for i, t in enumerate(tridy):
        cl = R_tridy.get(t.get("trida") or "") or {}
        hd = int(cl.get("hit_die") or 8)
        n = int(t.get("uroven") or 0)
        dice[f"d{hd}"] = dice.get(f"d{hd}", 0) + n
        hp += (hd + (n - 1) * (hd // 2 + 1)) if i == 0 else n * (hd // 2 + 1)
    hp += d["lvl"] * d["mods"]["CON"]
    if _has(c.get("featy"), "Tough"):
        hp += 2 * d["lvl"]
    if "Dwarf" in str(c.get("druh") or ""):
        hp += d["lvl"]
    if _has(c.get("featy"), "Boon of Fortitude"):
        hp += 40
    d["hp_calc"] = hp
    d["hp"] = int(c.get("hp_rucne") or hp)
    d["dice"] = dice

    # spellcasting
    d["casting"] = []
    single = []
    for t in tridy:
        tn, sub = t.get("trida"), t.get("podtrida") or ""
        if tn in CASTER:
            div, ab = CASTER[tn]
            single.append(div)
            d["casting"].append({"trida": tn, "ab": ab})
        elif sub in THIRD:
            single.append(3)
            d["casting"].append({"trida": f"{tn} ({sub})", "ab": THIRD[sub]})
    if len(single) == 1:
        lv = int(tridy[0].get("uroven") or 1) if tridy else 1
        cl = lv if single[0] == 1 else (-(-lv // single[0]))
    else:
        cl = sum(int(t.get("uroven") or 0) // (CASTER[t["trida"]][0] if t.get("trida") in CASTER
                 else (3 if t.get("podtrida") in THIRD else 10**9))
                 for t in tridy)
    d["slots"] = MULTI[min(cl, 20)] if d["casting"] else []
    for x in d["casting"]:
        x["dc"] = 8 + d["pb"] + d["mods"][x["ab"]]
        x["atk"] = d["pb"] + d["mods"][x["ab"]] + exhaust_pen
    if _lvl_of(c, "Warlock"):
        wl = _lvl_of(c, "Warlock")
        d["pact"] = {"pocet": min(4, 1 + (wl >= 2) + (wl >= 11) + (wl >= 17)),
                     "uroven": min(5, (wl + 1) // 2)}

    # útoky (pro přehled)
    d["attacks"] = []
    for u in c.get("utoky") or []:
        if not isinstance(u, dict):
            continue
        at = u.get("atribut") or "STR"
        m = (max(d["mods"]["STR"], d["mods"]["DEX"]) if at == "FIN"
             else (d["mods"][d["casting"][0]["ab"]] if at == "SPELL" and d["casting"]
                   else d["mods"].get(at, 0)))
        d["attacks"].append({
            "nazev": u.get("nazev") or "Útok",
            "atk": m + d["pb"] + int(u.get("bonus") or 0) + exhaust_pen,
            "dmg": (u.get("kostka") or "") + ("" if u.get("bez_modu") else sg(m))
                   + sg(int(u.get("bonus_zraneni") or 0)) if u.get("kostka") else "",
            "typ": u.get("typ") or "", "mastery": u.get("mastery") or "",
        })

    # XP
    xp = c.get("xp")
    d["xp"] = int(xp) if str(xp or "").isdigit() else None
    d["xp_next"] = XP_LEVELS[d["lvl"]] if d["lvl"] < 20 else None

    # ---------- obohacené sekce pro stránku postavy ----------
    R_species = _rules("species")
    R_sub = _rules("subclass")
    R_feat = _rules("feat")
    R_spell = _rules("spell")
    R_bg = _rules("background")

    def _lv(t: dict) -> int:
        return int(t.get("uroven") or 0)

    def _vals(v) -> list:
        if isinstance(v, list):
            return [str(x).strip() for x in v if str(x).strip()]
        return [x.strip() for x in str(v or "").replace("\n", ",").split(",") if x.strip()]

    species = R_species.get(str(c.get("druh") or "")) or {}
    # smysly: ruční pole + smysly druhu (Darkvision 60 ft …)
    import re as _re
    smysly = _vals(c.get("smysly"))
    for name, r in (species.get("rysy") or {}).items():
        if not _re.match(r"^(Darkvision|Blindsight|Tremorsense|Truesight)$", str(name), _re.I):
            continue
        text = r.get("text") if isinstance(r, dict) else str(r or "")
        m = _re.search(r"(\d+)\s*(?:feet|ft\.?)", text or "")
        smysly.append(f"{name} {m.group(1)} ft" if m else name)
    seen = set()
    smysly = [x for x in smysly if not (x in seen or seen.add(x))]

    d["overview"] = {
        "titul": c.get("titul") or "",
        "druh": c.get("druh") or "", "druh_volby": c.get("druh_volby") or "",
        "pozadi": c.get("pozadi") or "", "zarovnani": c.get("zarovnani") or "",
        "velikost": c.get("velikost") or species.get("velikost") or "",
        "rychlost": c.get("rychlost") or species.get("rychlost") or "",
        "jazyky": _vals(c.get("jazyky")), "smysly": smysly,
        "odolnosti": _vals(c.get("odolnosti")), "imunity": _vals(c.get("imunity")),
        "zranitelnosti": _vals(c.get("zranitelnosti")),
        "nastroje": _vals(c.get("nastroje")),
        "species_typ": species.get("typ") or "",
    }

    # rysy tříd a subclassů dle dosažené úrovně
    d["features"] = []
    for t in tridy:
        tlvl = _lv(t)
        cl = R_tridy.get(t.get("trida") or "") or {}
        for name, r in (cl.get("rysy") or {}).items():
            rl = int(r.get("uroven") or 0) if isinstance(r, dict) else 0
            if rl and rl <= tlvl:
                d["features"].append({"zdroj": t.get("trida") or "", "uroven": rl,
                                      "nazev": name, "text": (r.get("text") or "") if isinstance(r, dict) else str(r)})
        sub_name = t.get("podtrida") or ""
        if sub_name:
            sub = R_sub.get(sub_name) or {}
            for name, r in (sub.get("rysy") or {}).items():
                rl = int(r.get("uroven") or 0) if isinstance(r, dict) else 0
                if rl and rl <= tlvl:
                    d["features"].append({"zdroj": sub_name, "uroven": rl,
                                          "nazev": name, "text": (r.get("text") or "") if isinstance(r, dict) else str(r)})
    d["features"].sort(key=lambda x: (x["uroven"], x["zdroj"], x["nazev"]))

    d["species_rysy"] = [
        {"nazev": k, "text": (v.get("text") or "") if isinstance(v, dict) else str(v or "")}
        for k, v in (species.get("rysy") or {}).items()]

    d["feats_info"] = []
    for f in c.get("featy") or []:
        nm = (f.get("nazev") if isinstance(f, dict) else str(f)) or ""
        r = R_feat.get(nm) or {}
        d["feats_info"].append({
            "nazev": nm,
            "zdroj": (f.get("zdroj") if isinstance(f, dict) else "") or r.get("zdroj") or "",
            "poznamka": (f.get("poznamka") if isinstance(f, dict) else "") or "",
            "text": r.get("text") or "", "kategorie": r.get("kategorie") or ""})

    d["kouzla"] = []
    for k in c.get("kouzla") or []:
        if not isinstance(k, dict):
            k = {"nazev": str(k)}
        meta = R_spell.get(k.get("nazev") or "") or {}
        d["kouzla"].append({
            "nazev": k.get("nazev") or "", "uroven": k.get("uroven") if k.get("uroven") is not None else meta.get("uroven"),
            "trida": k.get("trida") or "", "vzdy": bool(k.get("vzdy")), "poznamka": k.get("poznamka") or "",
            "skola": meta.get("skola") or "", "cas": meta.get("cas") or "",
            "dosah": meta.get("dosah") or "", "slozky": meta.get("slozky") or "",
            "trvani": meta.get("trvani") or "", "text": meta.get("text") or "",
            "cs": meta.get("cs") or ""})

    bg = R_bg.get(str(c.get("pozadi") or "")) or {}
    d["pozadi_info"] = {
        "feat": bg.get("feat") or "", "dovednosti": bg.get("dovednosti") or "",
        "nastroj": bg.get("nastroj") or "", "vybava": bg.get("vybava") or "",
    } if bg else None

    d["vybava"] = c.get("vybava")
    d["osobnost"] = c.get("osobnost")
    d["vzhled"] = c.get("vzhled")
    d["vlastni_rysy"] = c.get("vlastni_rysy")
    d["prevod_2024"] = c.get("prevod_2024")
    d["statblok"] = c.get("statblok")
    d["zbroj_info"] = c.get("zbroj")

    # ---------- boj, zdroje, CR, trénink ----------
    d["speed"] = max(0, int(c.get("rychlost_rucne") or species.get("rychlost") or 30)
                     - exhaustion * 5)
    d["bj"] = c.get("boj") or {}
    d["atributy"] = {a: int((c.get("atributy") or {}).get(a) or 10) for a in AB}
    d["mastery"] = _vals(c.get("mastery"))
    d["naladeni"] = _vals(c.get("naladeni"))
    d["penize"] = c.get("penize") or {}
    d["concentration_spells"] = [
        k["nazev"] for k in d["kouzla"]
        if _re.search(r"concentration", k.get("trvani") or "", _re.I)]

    # zdroje povolání z tabulky třídy (sloupce mimo standard)
    SKIP_COLS = {"Proficiency Bonus", "Features", "Class Features", "Cantrips",
                 "Prepared Spells", "1st", "2nd", "3rd", "4th", "5th", "6th",
                 "7th", "8th", "9th", "Spell Slots", "Slot Level"}
    d["res"] = []
    for t in tridy:
        row = ((R_tridy.get(t.get("trida") or "") or {}).get("tabulka") or {}).get(
            str(int(t.get("uroven") or 0))) or {}
        for k, v in row.items():
            if k not in SKIP_COLS and v and str(v) != "-":
                d["res"].append({"nazev": f"{t.get('trida')}: {k}", "hodnota": str(v)})

    # trénink z první třídy
    if tridy:
        core0 = (R_tridy.get(tridy[0].get("trida") or "") or {}).get("core") or {}
        d["train"] = {"armor": core0.get("Armor Training") or "—",
                      "weapons": core0.get("Weapon Proficiencies") or "—"}
    else:
        d["train"] = {"armor": "—", "weapons": "—"}

    # odhad DPR + CR (převzato z postava.js)
    def _avg_dice(kostka: str) -> float:
        tot = 0.0
        for m in _re.finditer(r"(\d+)d(\d+)", str(kostka or "")):
            tot += int(m.group(1)) * (int(m.group(2)) + 1) / 2
        return tot

    def _lvl_of_local(trida: str) -> int:
        return _lvl_of(c, trida)

    mx = max(d["mods"]["STR"], d["mods"]["DEX"])
    n_atk = (4 if _lvl_of_local("Fighter") >= 20 else 3 if _lvl_of_local("Fighter") >= 11
             else 2 if any(_lvl_of_local(x) >= 5 for x in ("Fighter", "Barbarian", "Monk", "Paladin", "Ranger"))
             else 1)
    per = 0.0
    for u in c.get("utoky") or []:
        if not isinstance(u, dict) or not u.get("kostka"):
            continue
        at = u.get("atribut") or "STR"
        a = (mx if at == "FIN" else
             (d["mods"][d["casting"][0]["ab"]] if at == "SPELL" and d["casting"]
              else d["mods"].get(at, 0)))
        per = max(per, _avg_dice(u["kostka"]) + (0 if u.get("bez_modu") else a)
                  + int(u.get("bonus") or 0) + int(u.get("bonus_zraneni") or 0))
    monk = _lvl_of_local("Monk")
    if monk:
        monk_row = ((R_tridy.get("Monk") or {}).get("tabulka") or {}).get(str(monk)) or {}
        per = max(per, _avg_dice(monk_row.get("Martial Arts") or "1d6") + mx)
    if not per and any(_lvl_of_local(x) for x in ("Fighter", "Barbarian", "Paladin", "Ranger", "Rogue")):
        per = 4.5 + mx
    best, popis, atk_est = 0.0, [], d["pb"] + mx
    if per:
        best = per * n_atk
        popis.append(f"{n_atk}× útok ~{per:.1f}")
    if monk >= 2:
        fb = 3 if monk >= 10 else 2
        monk_row = ((R_tridy.get("Monk") or {}).get("tabulka") or {}).get(str(monk)) or {}
        ma2 = _avg_dice(monk_row.get("Martial Arts") or "1d6") + mx
        best += fb * ma2
        popis.append(f"Flurry of Blows {fb}×")
    elif _lvl_of_local("Barbarian"):
        b_row = ((R_tridy.get("Barbarian") or {}).get("tabulka") or {}).get(str(_lvl_of_local("Barbarian"))) or {}
        rd = int(_re.sub(r"\D", "", str(b_row.get("Rage Damage") or "2")) or 2)
        best += rd * n_atk
        popis.append(f"Rage +{rd}")
    rg = _lvl_of_local("Rogue")
    if rg:
        sa = -(-rg // 2) * 3.5
        best += sa
        popis.append(f"Sneak Attack {-(-rg // 2)}d6")
    if _lvl_of_local("Paladin") >= 11:
        best += n_atk * 4.5
        popis.append("Radiant Strikes")
    if d["casting"]:
        x = d["casting"][0]
        m = d["mods"][x["ab"]]
        tier = 4 if d["lvl"] >= 17 else 3 if d["lvl"] >= 11 else 2 if d["lvl"] >= 5 else 1
        cant = tier * 5.5 + (tier * m if _lvl_of_local("Warlock") >= 2 else 0)
        top = 0
        for i, n in enumerate(d["slots"]):
            if n:
                top = i + 1
        if d.get("pact"):
            top = max(top, int(d["pact"].get("uroven") or 0))
        slot = 7 + top * 5.5 if top else 0
        if max(cant, slot) > best:
            best = max(cant, slot)
            popis = [f"kouzlo {top}. úrovně" if slot > cant else "cantrip"]
            atk_est = max(atk_est, x["atk"])
    d["dpr_auto"] = round(best)
    d["dpr_popis"] = ", ".join(popis)
    d["dpr"] = int((d["bj"] or {}).get("dpr") or d["dpr_auto"] or 0)

    best_atk = atk_est + exhaust_pen
    for u in c.get("utoky") or []:
        if not isinstance(u, dict):
            continue
        at = u.get("atribut") or "STR"
        a = (mx if at == "FIN" else
             (d["mods"][d["casting"][0]["ab"]] if at == "SPELL" and d["casting"]
              else d["mods"].get(at, 0)))
        best_atk = max(best_atk, a + d["pb"] + int(u.get("bonus") or 0) + exhaust_pen)
    best_dc = max((x["dc"] for x in d["casting"]), default=0)
    d["cr"] = _compute_cr(d["hp"], d["ac"], d["dpr"], best_atk, best_dc)
    d["best_atk"] = best_atk
    return d
