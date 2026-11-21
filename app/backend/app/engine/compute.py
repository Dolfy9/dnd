"""D&D 2024 charakterový engine – výpočet odvozených statů postavy.

Vstup: slovník `postava:` z frontmatteru. Výstup: kompletní sheet pro frontend –
zachovává všechny původní klíče (ac, hp, saves, skills, casting, slots, …) a
přidává efekty (rozpis, efekty_aplikovane, chybejici_volby, zdroje, rychlosti,
kouzleni, boj).

Efekty (oficiální web/assets/efekty2024.json + vlastní řádky rules s vlastni:true)
sbírá app/engine/efekty.py; výrazy vyhodnocuje app/engine/vyrazy.py.
"""
import json
import re as _re

from .. import db
from .efekty import oficialni, rules_rows, seber
from .vyrazy import vyhodnot

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
# oficiální spellcasting: třída → (dělitel multiclass caster levelu, atribut)
CASTER = {"Artificer": (2, "INT"), "Bard": (1, "CHA"), "Cleric": (1, "WIS"),
          "Druid": (1, "WIS"), "Sorcerer": (1, "CHA"), "Wizard": (1, "INT"),
          "Paladin": (2, "CHA"), "Ranger": (2, "WIS")}
THIRD = {"Eldritch Knight": "INT", "Arcane Trickster": "INT"}
# PHB 2024 tabulka slotů (single-class i multiclass caster level)
MULTI = [[], [2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1],
         [4, 3, 3, 2], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2], [4, 3, 3, 3, 2, 1],
         [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1],
         [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1],
         [4, 3, 3, 3, 2, 1, 1, 1, 1], [4, 3, 3, 3, 3, 1, 1, 1, 1],
         [4, 3, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 3, 2, 2, 1, 1]]
XP_LEVELS = [0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000,
             85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000,
             305000, 355000]

# CR tabulka (cr, ac, hp, atk, dpr, dc) + XP odměny
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
         "10": 5900, "11": 7200, "12": 8400, "13": 10000, "14": 115000 // 10000,
         "15": 13000, "16": 15000, "17": 18000, "18": 20000, "19": 22000,
         "20": 25000, "21": 33000, "22": 41000, "23": 50000, "24": 62000,
         "25": 75000, "26": 90000, "27": 105000, "28": 120000, "29": 135000,
         "30": 155000}
XP_CR["14"] = 11500

# mapování vlastního kouzlení → dělitel caster levelu
_KOUZLENI_DIV = {"full": 1, "half": 2, "third": 3, "pact": 0}


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


def _vals(v) -> list:
    if isinstance(v, list):
        return [str(x).strip() for x in v if str(x).strip()]
    return [x.strip() for x in str(v or "").replace("\n", ",").split(",") if x.strip()]


def _int(v, default=0) -> int:
    try:
        return int(v)
    except (TypeError, ValueError):
        return default


def _kouzleni_tridy(cl_data: dict, trida: str) -> tuple[int, str] | None:
    """Spellcasting třídy: oficiální přes CASTER, vlastní přes pole `kouzleni`."""
    if trida in CASTER:
        return CASTER[trida]
    kz = (cl_data or {}).get("kouzleni") or {}
    typ = kz.get("typ")
    if typ in _KOUZLENI_DIV and _KOUZLENI_DIV[typ]:
        return (_KOUZLENI_DIV[typ], kz.get("atribut") or "INT")
    return None


def _kouzleni_sub(sub_data: dict, sub_name: str) -> tuple[int, str] | None:
    """Third-caster podtřídy: oficiální přes THIRD, vlastní přes `kouzleni`."""
    if sub_name in THIRD:
        return (3, THIRD[sub_name])
    kz = (sub_data or {}).get("kouzleni") or {}
    typ = kz.get("typ")
    if typ in _KOUZLENI_DIV and _KOUZLENI_DIV[typ]:
        return (_KOUZLENI_DIV[typ], kz.get("atribut") or "INT")
    return None


def compute(c: dict) -> dict:
    """Odvozené staty postavy (exhaustion nastavuje klient – session stav)."""
    R_tridy = rules_rows("class")
    R_species = rules_rows("species")
    R_sub = rules_rows("subclass")
    R_feat = rules_rows("feat")
    R_spell = rules_rows("spell")
    R_bg = rules_rows("background")
    R_item = rules_rows("item")
    OF = oficialni()

    d: dict = {}
    rozpis: dict[str, list] = {}

    def rp(stat: str, zdroj: str, hodnota) -> None:
        rozpis.setdefault(stat, []).append({"zdroj": zdroj, "hodnota": hodnota})

    tridy = [t for t in (c.get("tridy") or []) if isinstance(t, dict)]
    d["lvl"] = sum(_int(t.get("uroven")) for t in tridy) or 1
    lvl = d["lvl"]
    exhaustion = _int(c.get("_exhaustion"))
    exhaust_pen = -2 * exhaustion
    d["exhaustion"] = exhaustion
    d["exhaust_penalty"] = exhaust_pen
    d["pb"] = 2 + (lvl - 1) // 4
    rp("pb", "úroveň", d["pb"])

    # ---------- sběr efektů ----------
    efekty, chybejici = seber(c)
    # legacy postavy (jen `atributy`) už mají ASI volby započtené v číslech —
    # nehlásíme volby, jejichž možnosti obsahují jen efekty `atribut`
    if not c.get("atributy_zaklad"):
        chybejici = [v for v in chybejici if not v.get("jen_atributy")]
    for v in chybejici:
        v.pop("jen_atributy", None)
    d["chybejici_volby"] = chybejici

    species0 = R_species.get(str(c.get("druh") or "")) or {}
    base_walk = _int(c.get("rychlost_rucne")) or _int(species0.get("rychlost"), 30)

    naladene = sum(1 for v in (c.get("vybava") or [])
                   if isinstance(v, dict) and v.get("naladeno"))

    def ctx_expr(uroven=None):
        return {"pb": d["pb"], "uroven": uroven if uroven is not None else lvl,
                "mods": mods, "walk": base_walk, "naladene": naladene,
                "uroven_v": lambda x: _lvl_of(c, x)}

    def hod(e, klic, default=0, uroven=None):
        v = e.get(klic)
        if v is None:
            return default
        try:
            return vyhodnot(v, ctx_expr(uroven))
        except Exception:
            return _int(v, default)

    def splnuje_podminku(e, armor_worn: bool | None = None, shield: bool | None = None) -> bool:
        od = e.get("od_urovne")
        if od is not None:
            try:
                if (e.get("_uroven") or lvl) < vyhodnot(od, ctx_expr(e.get("_uroven"))):
                    return False
            except Exception:
                if (e.get("_uroven") or lvl) < _int(od):
                    return False
        pod = e.get("podminka")
        if pod == "zbroj":
            return bool(armor_worn)
        if pod == "bez_zbroje":
            return not armor_worn
        if pod == "bez_teZke_zbroje" or pod == "no_heavy_armor":
            return z.get("typ") != "heavy"
        if pod == "bez_stredni_tezke_zbroje" or pod == "no_medium_heavy_armor":
            return z.get("typ") not in ("medium", "heavy")
        if pod == "stit":
            return bool(shield)
        if pod == "naladeni":
            return True  # naladění řeší sběr u předmětů
        return True

    # ---------- zbroj (ruční blok, jinak z vybavených předmětů) ----------
    z = dict(c.get("zbroj") or {})
    if not z:
        for v in c.get("vybava") or []:
            if not isinstance(v, dict) or not v.get("vybaveno"):
                continue
            nm = v.get("predmet") or v.get("nazev") or ""
            row = R_item.get(nm) or {}
            item_of = (OF.get("item") or {}).get(nm) or {}
            zd = row.get("zbroj") or item_of.get("zbroj")
            if not isinstance(zd, dict):
                continue
            if zd.get("typ") == "shield":
                z["stit"] = True
            elif "typ" not in z:
                z.update({"nazev": nm, "typ": zd.get("typ"),
                          "zakladni_ac": zd.get("zakladni_ac") or zd.get("ac"),
                          "max_dex": zd.get("max_dex")})
    armor_worn = bool(z.get("typ") and z.get("typ") not in ("none", "")) or bool(z.get("zakladni_ac") and z.get("typ"))
    shield = bool(z.get("stit"))

    # ---------- atributy ----------
    legacy_attrs = not c.get("atributy_zaklad")
    if legacy_attrs:
        atributy = {a: _int((c.get("atributy") or {}).get(a), 10) for a in AB}
    else:
        zaklad = c.get("atributy_zaklad") or {}
        bonusy = c.get("bonusy_pozadi") or {}
        atributy = {a: _int(zaklad.get(a), 10) + _int(bonusy.get(a)) for a in AB}
        for a in AB:
            rp(f"atribut:{a}", "základ + pozadí", atributy[a])
        for p in c.get("postup") or []:
            asi = (p or {}).get("asi") or {}
            for a, n in asi.items():
                if a in atributy:
                    atributy[a] += _int(n)
                    rp(f"atribut:{a}", f"postup {p.get('uroven')}", _int(n))
    mods = {a: mod(atributy[a]) for a in AB}

    ef_aplik: list[dict] = []
    # ---------- efekty: atributy (jen nový formát) + atribut_min ----------
    for e in efekty:
        t = e.get("typ")
        if t == "atribut" and not legacy_attrs and splnuje_podminku(e, armor_worn, shield):
            a = e.get("atribut")
            if a in atributy:
                cap = hod(e, "max", 20)
                delta = hod(e, "hodnota", 0, e.get("_uroven"))
                atributy[a] = min(cap, atributy[a] + delta)
                ef_aplik.append({"zdroj": e["_zdroj"], "typ": t,
                                 "popis": f"{a} {sg(delta)} (max {cap})"})
        elif t == "atribut_min" and splnuje_podminku(e, armor_worn, shield):
            a = e.get("atribut")
            if a in atributy:
                floor = hod(e, "hodnota", 0, e.get("_uroven"))
                if atributy[a] < floor:
                    atributy[a] = floor
                    ef_aplik.append({"zdroj": e["_zdroj"], "typ": t,
                                     "popis": f"{a} alespoň {floor}"})
    mods = {a: mod(atributy[a]) for a in AB}
    d["mods"] = mods
    d["check_mods"] = {a: mods[a] + exhaust_pen for a in AB}
    d["atributy"] = atributy

    # ---------- zdatnosti / zdroje / smysly / ostatní efekty ----------
    save_prof = list(c.get("zachrany_navic") or [])
    first = tridy[0] if tridy else None
    if first:
        core = (R_tridy.get(first.get("trida") or "") or {}).get("core") or {}
        stp = core.get("Saving Throw Proficiencies") or ""
        zachrany_custom = (R_tridy.get(first.get("trida") or "") or {}).get("zachrany") or []
        for en, ab in AB_EN.items():
            if en in stp and ab not in save_prof:
                save_prof.append(ab)
        for ab in zachrany_custom:
            if ab in AB and ab not in save_prof:
                save_prof.append(ab)
                rp("save_prof", first.get("trida") or "", ab)

    profs = {str(x) for x in (c.get("dovednosti") or [])}
    exps = {str(x) for x in (c.get("expertiza") or [])}
    half_skill = _lvl_of(c, "Bard") >= 2  # Jack of All Trades (fallback)
    bonus_map: dict[str, list] = {}
    ac_flat_bonus, ac_formulas = 0, []
    hp_extra = 0
    smysly_eff: dict[str, int] = {}
    odol, imun, zran, imun_stav = set(), set(), set(), set()
    zdroje: list[dict] = []
    kouzla_eff: list[dict] = []
    utoky_eff: list[dict] = []
    utoky_za_akci = 0
    nastroje_eff, jazyky_eff, zbrane_eff, zbroje_eff = [], [], [], []
    vyhody: list[dict] = []
    velikost_eff = ""
    speed_set = None
    speed_bonus: dict[str, int] = {}

    for e in efekty:
        t = e.get("typ")
        if t in ("atribut", "atribut_min"):
            continue
        zd = e.get("_zdroj") or ""
        if not splnuje_podminku(e, armor_worn, shield):
            continue
        uroven_e = e.get("_uroven")
        if t == "ac":
            ac_flat_bonus += hod(e, "hodnota", 0, uroven_e)
            rp("ac", zd, hod(e, "hodnota", 0, uroven_e))
        elif t == "ac_vzorec":
            ac_formulas.append(e)
        elif t == "hp":
            flat = hod(e, "hodnota", 0, uroven_e)
            perlvl = hod(e, "za_uroven", 0, uroven_e) * lvl
            hp_extra += flat + perlvl
            rp("hp", zd, flat + perlvl)
        elif t == "rychlost":
            druh_r = e.get("druh") or "walk"
            hv = e.get("hodnota")
            if isinstance(hv, str) and hv.startswith("@"):
                row = ((R_tridy.get(e.get("_trida") or "") or {}).get("tabulka") or {}).get(
                    str(uroven_e or lvl)) or {}
                v = _int(_re.sub(r"[^\d]", "", str(row.get(hv[1:]) or "0")))
            else:
                v = hod(e, "hodnota", 0, uroven_e)
            if e.get("nastavit"):
                speed_set = v if druh_r == "walk" else speed_set
                speed_bonus[druh_r] = v
            else:
                speed_bonus[druh_r] = speed_bonus.get(druh_r, 0) + v
            rp("speed", zd, v)
        elif t == "smysl":
            nm = str(e.get("nazev") or "")
            v = hod(e, "dosah", 0, uroven_e)
            if nm and v > smysly_eff.get(nm, 0):
                smysly_eff[nm] = v
        elif t == "odolnost":
            odol.add(str(e.get("hodnota") or ""))
        elif t == "imunita":
            imun.add(str(e.get("hodnota") or ""))
        elif t == "zranitelnost":
            zran.add(str(e.get("hodnota") or ""))
        elif t == "imunita_stav":
            imun_stav.add(str(e.get("hodnota") or ""))
        elif t == "zdatnost":
            oblast, hv = e.get("oblast"), str(e.get("hodnota") or "")
            if oblast == "dovednost":
                profs.add(hv)
            elif oblast == "zachrana":
                hv = hv.upper()
                if hv in AB and hv not in save_prof:
                    save_prof.append(hv)
                    rp("save_prof", zd, hv)
            elif oblast == "nastroj":
                nastroje_eff.append(hv)
            elif oblast == "jazyk":
                jazyky_eff.append(hv)
            elif oblast == "zbran":
                zbrane_eff.append(hv)
            elif oblast == "zbroj":
                zbroje_eff.append(hv)
        elif t == "expertiza":
            exps.add(str(e.get("hodnota") or ""))
        elif t == "polovicni_zdatnost":
            if e.get("oblast") == "dovednost":
                half_skill = True
        elif t == "bonus":
            bonus_map.setdefault(str(e.get("cil") or ""), []).append(e)
            rp(str(e.get("cil") or "bonus"), zd, e.get("hodnota"))
        elif t == "vyhoda":
            vyhody.append({"cil": e.get("cil") or "", "popis": e.get("popis") or "",
                           "zdroj": zd})
        elif t == "poznamka":
            pass  # jen se zapíše do efekty_aplikovane
        elif t == "kouzlo":
            kouzla_eff.append(e)
        elif t == "zdroj":
            pocet = e.get("pocet")
            if isinstance(pocet, str) and pocet.startswith("@"):
                col = pocet[1:]
                row = ((R_tridy.get(e.get("_trida") or "") or {}).get("tabulka") or {}).get(
                    str(uroven_e or lvl)) or {}
                maxv = _int(str(row.get(col) or "0").lstrip("+"))
            else:
                maxv = hod(e, "pocet", 0, uroven_e)
            kostka = e.get("kostka")
            if isinstance(kostka, str) and kostka.startswith("@"):
                row = ((R_tridy.get(e.get("_trida") or "") or {}).get("tabulka") or {}).get(
                    str(uroven_e or lvl)) or {}
                kostka = str(row.get(kostka[1:]) or "")
            nz = e.get("nazev") or zd
            zdroje[:] = [x for x in zdroje if x["nazev"] != nz]  # novější výskyt vyhrává
            zdroje.append({"nazev": nz, "max": maxv,
                           "obnova": e.get("obnova") or "long",
                           "kostka": kostka or "", "zdroj": zd})
        elif t == "utok":
            utoky_eff.append(e)
        elif t == "utoky_za_akci":
            utoky_za_akci = max(utoky_za_akci, hod(e, "hodnota", 0, uroven_e))
        elif t == "velikost":
            velikost_eff = str(e.get("hodnota") or "")
        ef_aplik.append({"zdroj": zd, "typ": t or "?",
                         "popis": e.get("popis") or e.get("nazev") or e.get("text") or ""})

    def bonus(cil: str, filtr: str = "") -> int:
        tot = 0
        for e in bonus_map.get(cil, []):
            f = str(e.get("filtr") or "")
            if filtr and f and f.lower() != filtr.lower():
                continue
            tot += hod(e, "hodnota", 0, e.get("_uroven"))
        return tot

    def bonus_utok(u: dict, cil: str) -> int:
        """Bonus k útoku/zranění s respektem k volitelnému filtru (ranged, thrown…)."""
        tot = 0
        for e in bonus_map.get(cil, []):
            f = str(e.get("filtr") or "").lower()
            if f:
                hay = " ".join(str(u.get(k) or "") for k in
                               ("nazev", "typ", "dosah", "vlastnosti", "mastery")).lower()
                if f not in hay:
                    continue
            tot += hod(e, "hodnota", 0, e.get("_uroven"))
        return tot

    d["save_prof"] = save_prof
    d["saves"] = {}
    for a in AB:
        val = mods[a] + (d["pb"] if a in save_prof else 0) + bonus("zachrana", a) + exhaust_pen
        d["saves"][a] = val
        rp(f"save:{a}", "mod+PB" if a in save_prof else "mod", val - exhaust_pen)
    prepis = c.get("prepis") or {}
    for a in AB:
        k = f"save:{a}"
        if k in prepis:
            d["saves"][a] = _int(prepis[k])
            rp(k, "ruční přepis", prepis[k])

    d["skills"] = {}
    for s, ab in SKILLS.items():
        prof, exp = s in profs, s in exps
        val = (mods[ab] + (d["pb"] if prof else 0) + (d["pb"] if exp else 0)
               + ((d["pb"] // 2) if (not prof and not exp and half_skill) else 0)
               + bonus("dovednost", s) + exhaust_pen)
        d["skills"][s] = {"val": val, "prof": prof, "exp": exp}
        rp(f"skill:{s}", "mod" + ("+PB" if prof else "") + ("+PB exp" if exp else ""), val - exhaust_pen)
        k = f"skill:{s}"
        if k in prepis:
            d["skills"][s]["val"] = _int(prepis[k])
            rp(k, "ruční přepis", prepis[k])

    d["passive"] = 10 + d["skills"]["Perception"]["val"] - exhaust_pen + bonus("pasivni")
    rp("passive", "10 + Perception", d["passive"])
    if "passive" in prepis:
        d["passive"] = _int(prepis["passive"])
        rp("passive", "ruční přepis", prepis["passive"])

    d["init"] = mods["DEX"] + bonus("iniciativa") + exhaust_pen
    rp("init", "DEX", d["init"] - exhaust_pen - bonus("iniciativa"))
    if bonus("iniciativa"):
        rp("init", "efekty", bonus("iniciativa"))
    if "init" in prepis:
        d["init"] = _int(prepis["init"])
        rp("init", "ruční přepis", prepis["init"])

    # ---------- AC ----------
    typ = z.get("typ", "none")
    if typ == "heavy":
        ac = _int(z.get("zakladni_ac"))
        rp("ac", z.get("nazev") or "těžká zbroj", ac)
    elif typ == "medium":
        md = _int(z.get("max_dex"), 2)
        ac = _int(z.get("zakladni_ac")) + min(mods["DEX"], md)
        rp("ac", z.get("nazev") or "střední zbroj", ac)
    elif typ == "light":
        ac = _int(z.get("zakladni_ac")) + mods["DEX"]
        rp("ac", z.get("nazev") or "lehká zbroj", ac)
    else:
        ac = 10 + mods["DEX"]
        rp("ac", "základ", ac)
        if z.get("zakladni_ac"):
            ac = max(ac, _int(z["zakladni_ac"]) + mods["DEX"])
            rp("ac", z.get("nazev") or "přirozená zbroj", ac)
    for e in ac_formulas:
        if e.get("bez_zbroje") and armor_worn:
            continue
        if not e.get("stit_povolen") and shield:
            continue
        base = hod(e, "zaklad", 10, e.get("_uroven"))
        cand = base + sum(mods.get(a, 0) for a in e.get("atributy") or [])
        if cand > ac:
            ac = cand
            rp("ac", e.get("_zdroj") or "vzorec", cand)
    if shield:
        ac += 2
        rp("ac", "štít", 2)
    if typ and typ != "none" and _has(c.get("featy"), "Defense") and not any(
            e.get("typ") == "ac" and e.get("_zdroj") == "Defense" for e in efekty):
        ac += 1  # fallback, kdyby feat neměl efekt v datech
        rp("ac", "Defense", 1)
    ac += _int(z.get("bonus"))
    ac += ac_flat_bonus + bonus("ac")
    d["ac"] = _int(c.get("ac_rucne"), 0) or ac
    if c.get("ac_rucne"):
        rp("ac", "ručně", c["ac_rucne"])
    if "ac" in prepis:
        d["ac"] = _int(prepis["ac"])
        rp("ac", "ruční přepis", prepis["ac"])

    # ---------- HP + hit dice ----------
    if c.get("hp_metoda") == "hody" and c.get("postup"):
        hp = 0
        postup_hp = {int(p.get("uroven") or 0): _int(p.get("hp")) for p in c["postup"]
                     if isinstance(p, dict) and p.get("hp") is not None}
        lv = 0
        for i, t in enumerate(tridy):
            cl = R_tridy.get(t.get("trida") or "") or {}
            hd = _int(cl.get("hit_die"), 8)
            for _ in range(_int(t.get("uroven"))):
                lv += 1
                hp += postup_hp.get(lv, hd if (i == 0 and lv == 1) else hd // 2 + 1)
    else:
        hp, dice = 0, {}
        for i, t in enumerate(tridy):
            cl = R_tridy.get(t.get("trida") or "") or {}
            hd = _int(cl.get("hit_die"), 8)
            n = _int(t.get("uroven"))
            hp += (hd + (n - 1) * (hd // 2 + 1)) if i == 0 else n * (hd // 2 + 1)
        hp += lvl * mods["CON"]
        rp("hp", "kostky + CON", hp)
    if c.get("hp_metoda") == "hody":
        hp += lvl * mods["CON"]
        rp("hp", "hody + CON", hp)
    hp += hp_extra
    d["hp_calc"] = hp
    d["hp"] = _int(c.get("hp_rucne"), 0) or hp
    if c.get("hp_rucne"):
        rp("hp", "ručně", c["hp_rucne"])
    if "hp" in prepis:
        d["hp"] = _int(prepis["hp"])
        rp("hp", "ruční přepis", prepis["hp"])
    dice = {}
    for t in tridy:
        cl = R_tridy.get(t.get("trida") or "") or {}
        hd = _int(cl.get("hit_die"), 8)
        dice[f"d{hd}"] = dice.get(f"d{hd}", 0) + _int(t.get("uroven"))
    d["dice"] = dice

    # ---------- spellcasting ----------
    d["casting"] = []
    single = []
    for t in tridy:
        tn, sub = t.get("trida"), t.get("podtrida") or ""
        cl_row = R_tridy.get(tn) or {}
        sc = _kouzleni_tridy(cl_row, tn or "")
        if sc and sc[0]:
            div, ab = sc
            single.append(div)
            d["casting"].append({"trida": tn, "ab": ab, "_div": div,
                                 "_uroven": _int(t.get("uroven"))})
        else:
            sub_row = R_sub.get(sub) or {}
            scs = _kouzleni_sub(sub_row, sub)
            if scs and scs[0]:
                single.append(scs[0])
                d["casting"].append({"trida": f"{tn} ({sub})", "ab": scs[1],
                                     "_div": scs[0], "_uroven": _int(t.get("uroven"))})
    if len(single) == 1:
        # úroveň té jediné kouzelnické třídy (ne nutně tridy[0])
        lvx = d["casting"][0]["_uroven"]
        clx = lvx if single[0] == 1 else (-(-lvx // single[0]))
    else:
        clx = 0
        for x in d["casting"]:
            clx += x["_uroven"] // x["_div"]
    d["slots"] = MULTI[min(clx, 20)] if d["casting"] else []
    dc_bonus = bonus("dc_kouzel")
    atk_bonus = bonus("utok_kouzel")
    for x in d["casting"]:
        x["dc"] = 8 + d["pb"] + mods[x["ab"]] + dc_bonus
        x["atk"] = d["pb"] + mods[x["ab"]] + atk_bonus + exhaust_pen
        rp("spell_dc", x["trida"], x["dc"])
        rp("spell_atk", x["trida"], x["atk"] - exhaust_pen)
    if "spell_dc" in prepis:
        for x in d["casting"]:
            x["dc"] = _int(prepis["spell_dc"])
        rp("spell_dc", "ruční přepis", prepis["spell_dc"])
    if "spell_atk" in prepis:
        for x in d["casting"]:
            x["atk"] = _int(prepis["spell_atk"]) + exhaust_pen
        rp("spell_atk", "ruční přepis", prepis["spell_atk"])
    pact = None
    for t in tridy:
        tn = t.get("trida") or ""
        cl_row = R_tridy.get(tn) or {}
        kz = cl_row.get("kouzleni") or {}
        if tn == "Warlock":
            wl = _int(t.get("uroven"))
            pact = {"pocet": min(4, 1 + (wl >= 2) + (wl >= 11) + (wl >= 17)),
                    "uroven": min(5, (wl + 1) // 2)}
        elif kz.get("typ") == "pact":
            row = (cl_row.get("tabulka") or {}).get(str(_int(t.get("uroven")))) or {}
            pact = {"pocet": _int(row.get("Spell Slots")), "uroven": _int(row.get("Slot Level"))}
    if pact:
        d["pact"] = pact
    elif "pact" in d:
        pass

    # ---------- kouzleni (rozšířený výstup) ----------
    d["kouzleni"] = []
    for x in d["casting"]:
        tn0 = x["trida"].split(" (")[0]
        cl_row = R_tridy.get(tn0) or {}
        tl = next((_int(t.get("uroven")) for t in tridy if t.get("trida") == tn0), lvl)
        row = (cl_row.get("tabulka") or {}).get(str(tl)) or {}
        sloty = [_int(row.get(f"{i}st" if i == 1 else f"{i}nd" if i == 2 else f"{i}rd" if i == 3 else f"{i}th"))
                 for i in range(1, 10)]
        if not any(sloty):
            sloty = d["slots"]
        d["kouzleni"].append({
            "trida": x["trida"], "atribut": x["ab"], "dc": x["dc"], "atk": x["atk"],
            "cantrips": _int(row.get("Cantrips")),
            "pripravena": _int(row.get("Prepared Spells")),
            "sloty": sloty,
            "vzdy_pripravena": [k.get("nazev") for k in kouzla_eff
                                if k.get("vzdy") and (k.get("trida") in (None, "", tn0))],
        })

    # ---------- útoky ----------
    mx = max(mods["STR"], mods["DEX"])
    d["attacks"] = []

    def _atk_mod(at: str) -> int:
        if at == "FIN":
            return mx
        if at == "SPELL" and d["casting"]:
            return mods[d["casting"][0]["ab"]]
        return mods.get(at, 0)

    for u in c.get("utoky") or []:
        if not isinstance(u, dict):
            continue
        at = u.get("atribut") or "STR"
        m = _atk_mod(at)
        b_ut, b_zr = bonus_utok(u, "utok"), bonus_utok(u, "zraneni")
        d["attacks"].append({
            "nazev": u.get("nazev") or "Útok",
            "atk": m + d["pb"] + _int(u.get("bonus")) + b_ut + exhaust_pen,
            "dmg": (u.get("kostka") or "") + ("" if u.get("bez_modu") else sg(m))
                   + sg(_int(u.get("bonus_zraneni")) + b_zr) if u.get("kostka") else "",
            "typ": u.get("typ") or "", "mastery": u.get("mastery") or "",
        })
    for e in utoky_eff:
        at = e.get("atribut") or "STR"
        m = _atk_mod(at)
        b_ut, b_zr = bonus_utok(e, "utok"), bonus_utok(e, "zraneni")
        ks = e.get("kostka") or ""
        d["attacks"].append({
            "nazev": e.get("nazev") or "Útok",
            "atk": m + d["pb"] + _int(e.get("bonus")) + b_ut + exhaust_pen,
            "dmg": ks + sg(m) + sg(b_zr) if ks else "",
            "typ": e.get("typ_zraneni") or "", "mastery": "",
            "zdroj": e.get("_zdroj") or "", "dosah": e.get("dosah") or "",
        })
    if not utoky_za_akci:
        utoky_za_akci = (4 if _lvl_of(c, "Fighter") >= 20 else
                         3 if _lvl_of(c, "Fighter") >= 11 else
                         2 if any(_lvl_of(c, x) >= 5 for x in
                                  ("Fighter", "Barbarian", "Monk", "Paladin", "Ranger")) else 1)
    d["utoky_za_akci"] = utoky_za_akci

    # ---------- XP ----------
    xp = c.get("xp")
    d["xp"] = int(xp) if str(xp or "").isdigit() else None
    d["xp_next"] = XP_LEVELS[lvl] if lvl < 20 else None

    # ---------- přehled ----------
    species = R_species.get(str(c.get("druh") or "")) or {}
    smysly = _vals(c.get("smysly"))
    for name, r in (species.get("rysy") or {}).items():
        if not _re.match(r"^(Darkvision|Blindsight|Tremorsense|Truesight)$", str(name), _re.I):
            continue
        text = r.get("text") if isinstance(r, dict) else str(r or "")
        m = _re.search(r"(\d+)\s*(?:feet|ft\.?|stop)", text or "")
        smysly.append(f"{name} {m.group(1)} ft" if m else name)
    for nm, dosah in smysly_eff.items():
        smysly = [s for s in smysly if not s.startswith(nm)]
        smysly.append(f"{nm} {dosah} ft")
    seen = set()
    smysly = [x for x in smysly if not (x in seen or seen.add(x))]

    odol |= set(_vals(c.get("odolnosti")))
    imun |= set(_vals(c.get("imunity")))
    zran |= set(_vals(c.get("zranitelnosti")))
    imun_stav |= set(_vals(c.get("imunity_stavu")))
    for s_ in (odol, imun, zran, imun_stav):
        s_.discard("")

    d["overview"] = {
        "titul": c.get("titul") or "",
        "druh": c.get("druh") or "", "druh_volby": c.get("druh_volby") or "",
        "pozadi": c.get("pozadi") or "", "zarovnani": c.get("zarovnani") or "",
        "velikost": velikost_eff or c.get("velikost") or species.get("velikost") or "",
        "rychlost": c.get("rychlost") or species.get("rychlost") or "",
        "jazyky": _vals(c.get("jazyky")) + [x for x in jazyky_eff if x not in _vals(c.get("jazyky"))],
        "smysly": smysly,
        "odolnosti": sorted(odol), "imunity": sorted(imun),
        "zranitelnosti": sorted(zran), "imunity_stavu": sorted(imun_stav),
        "nastroje": _vals(c.get("nastroje")) + [x for x in nastroje_eff
                                               if x not in _vals(c.get("nastroje"))],
        "species_typ": species.get("typ") or "",
    }
    d["odolnosti"] = sorted(odol)
    d["imunity"] = sorted(imun)
    d["zranitelnosti"] = sorted(zran)
    d["imunity_stavu"] = sorted(imun_stav)
    d["smysly"] = smysly

    # ---------- rysy tříd a podtříd ----------
    d["features"] = []
    for t in tridy:
        tlvl = _int(t.get("uroven"))
        cl = R_tridy.get(t.get("trida") or "") or {}
        rysy = cl.get("rysy") or {}
        items = rysy.items() if isinstance(rysy, dict) else [
            (r.get("nazev"), r) for r in rysy if isinstance(r, dict)]
        for name, r in items:
            rl = _int(r.get("uroven")) if isinstance(r, dict) else 0
            if rl and rl <= tlvl:
                d["features"].append({"zdroj": t.get("trida") or "", "uroven": rl,
                                      "nazev": name,
                                      "text": (r.get("text") or "") if isinstance(r, dict) else str(r)})
        sub_name = t.get("podtrida") or ""
        if sub_name:
            sub = R_sub.get(sub_name) or {}
            srysy = sub.get("rysy") or {}
            sitems = srysy.items() if isinstance(srysy, dict) else [
                (r.get("nazev"), r) for r in srysy if isinstance(r, dict)]
            for name, r in sitems:
                rl = _int(r.get("uroven")) if isinstance(r, dict) else 0
                if rl and rl <= tlvl:
                    d["features"].append({"zdroj": sub_name, "uroven": rl,
                                          "nazev": name,
                                          "text": (r.get("text") or "") if isinstance(r, dict) else str(r)})
    d["features"].sort(key=lambda x: (x["uroven"], x["zdroj"], x["nazev"]))

    sp_rysy = species.get("rysy") or {}
    sp_items = sp_rysy.items() if isinstance(sp_rysy, dict) else [
        (r.get("nazev"), r) for r in sp_rysy if isinstance(r, dict)]
    d["species_rysy"] = [
        {"nazev": k, "text": (v.get("text") or "") if isinstance(v, dict) else str(v or "")}
        for k, v in sp_items]

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
    known = set()

    def _pridej_kouzlo(k: dict, zdroj_eff: str = ""):
        nm = k.get("nazev") or ""
        if not nm or nm.lower() in known:
            return
        known.add(nm.lower())
        meta = R_spell.get(nm) or {}
        d["kouzla"].append({
            "nazev": nm, "uroven": k.get("uroven") if k.get("uroven") is not None else meta.get("uroven"),
            "trida": k.get("trida") or "", "vzdy": bool(k.get("vzdy")),
            "pripraveno": bool(k.get("pripraveno")),
            "obnova": k.get("obnova") or "", "pocet": k.get("pocet"),
            "zdroj": k.get("zdroj") or zdroj_eff,
            "poznamka": k.get("poznamka") or "",
            "skola": meta.get("skola") or "", "cas": meta.get("cas") or "",
            "dosah": meta.get("dosah") or "", "slozky": meta.get("slozky") or "",
            "trvani": meta.get("trvani") or "", "text": meta.get("text") or "",
            "cs": meta.get("cs") or ""})

    for k in c.get("kouzla") or []:
        if not isinstance(k, dict):
            k = {"nazev": str(k)}
        _pridej_kouzlo(k)
    for e in kouzla_eff:
        _pridej_kouzlo(e, e.get("_zdroj") or "")

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
    d["zbroj_info"] = c.get("zbroj") or z
    d["prilohy"] = c.get("prilohy") or []
    d["postup"] = c.get("postup")

    # ---------- rychlost ----------
    walk = speed_set or base_walk
    walk = walk + (0 if speed_set else speed_bonus.get("walk", 0))
    walk = max(0, walk - exhaustion * 5)
    d["speed"] = _int(c.get("rychlost_rucne")) or walk
    rp("speed", "základ", d["speed"])
    rychlosti = {"walk": d["speed"]}
    for druh_r, v in speed_bonus.items():
        if druh_r != "walk" and v:
            rychlosti[druh_r] = v
    d["rychlosti"] = rychlosti
    if "speed" in prepis:
        d["speed"] = _int(prepis["speed"])
        rychlosti["walk"] = d["speed"]
        rp("speed", "ruční přepis", prepis["speed"])

    # ---------- boj, zdroje, CR, trénink ----------
    d["bj"] = c.get("boj") or {}
    d["mastery"] = _vals(c.get("mastery"))
    d["naladeni"] = _vals(c.get("naladeni"))
    d["penize"] = c.get("penize") or {}
    d["concentration_spells"] = [
        k["nazev"] for k in d["kouzla"]
        if _re.search(r"concentration", k.get("trvani") or "", _re.I)]

    SKIP_COLS = {"Proficiency Bonus", "Features", "Class Features", "Cantrips",
                 "Prepared Spells", "1st", "2nd", "3rd", "4th", "5th", "6th",
                 "7th", "8th", "9th", "Spell Slots", "Slot Level"}
    d["res"] = []
    for t in tridy:
        row = ((R_tridy.get(t.get("trida") or "") or {}).get("tabulka") or {}).get(
            str(_int(t.get("uroven")))) or {}
        for k, v in row.items():
            if k not in SKIP_COLS and v and str(v) != "-":
                d["res"].append({"nazev": f"{t.get('trida')}: {k}", "hodnota": str(v)})
    d["zdroje"] = zdroje
    d["efekty_aplikovane"] = ef_aplik
    d["vyhody"] = vyhody
    d["rozpis"] = rozpis

    if tridy:
        core0 = (R_tridy.get(tridy[0].get("trida") or "") or {}).get("core") or {}
        cl0 = R_tridy.get(tridy[0].get("trida") or "") or {}
        d["train"] = {
            "armor": core0.get("Armor Training") or ", ".join(zbroje_eff) or "—",
            "weapons": core0.get("Weapon Proficiencies") or ", ".join(zbrane_eff) or "—",
        }
    else:
        d["train"] = {"armor": ", ".join(zbroje_eff) or "—",
                      "weapons": ", ".join(zbrane_eff) or "—"}

    # ---------- DPR + CR odhad ----------
    def _avg_dice(kostka: str) -> float:
        tot = 0.0
        for m in _re.finditer(r"(\d+)d(\d+)", str(kostka or "")):
            tot += int(m.group(1)) * (int(m.group(2)) + 1) / 2
        return tot

    n_atk = utoky_za_akci
    per = 0.0
    for u in c.get("utoky") or []:
        if not isinstance(u, dict) or not u.get("kostka"):
            continue
        at = u.get("atribut") or "STR"
        a = _atk_mod(at)
        per = max(per, _avg_dice(u["kostka"]) + (0 if u.get("bez_modu") else a)
                  + _int(u.get("bonus")) + _int(u.get("bonus_zraneni")))
    for e in utoky_eff:
        a = _atk_mod(e.get("atribut") or "STR")
        per = max(per, _avg_dice(e.get("kostka")) + a + _int(e.get("bonus")))
    monk = _lvl_of(c, "Monk")
    if monk:
        monk_row = ((R_tridy.get("Monk") or {}).get("tabulka") or {}).get(str(monk)) or {}
        per = max(per, _avg_dice(monk_row.get("Martial Arts") or "1d6") + mx)
    if not per and any(_lvl_of(c, x) for x in ("Fighter", "Barbarian", "Paladin", "Ranger", "Rogue")):
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
    elif _lvl_of(c, "Barbarian"):
        b_row = ((R_tridy.get("Barbarian") or {}).get("tabulka") or {}).get(
            str(_lvl_of(c, "Barbarian"))) or {}
        rd = _int(_re.sub(r"\D", "", str(b_row.get("Rage Damage") or "2")), 2)
        best += rd * n_atk
        popis.append(f"Rage +{rd}")
    rg = _lvl_of(c, "Rogue")
    if rg:
        sa = -(-rg // 2) * 3.5
        best += sa
        popis.append(f"Sneak Attack {-(-rg // 2)}d6")
    if _lvl_of(c, "Paladin") >= 11:
        best += n_atk * 4.5
        popis.append("Radiant Strikes")
    if d["casting"]:
        x = d["casting"][0]
        m = mods[x["ab"]]
        tier = 4 if lvl >= 17 else 3 if lvl >= 11 else 2 if lvl >= 5 else 1
        cant = tier * 5.5 + (tier * m if _lvl_of(c, "Warlock") >= 2 else 0)
        top = 0
        for i, n in enumerate(d["slots"]):
            if n:
                top = i + 1
        if d.get("pact"):
            top = max(top, _int(d["pact"].get("uroven")))
        slot = 7 + top * 5.5 if top else 0
        if max(cant, slot) > best:
            best = max(cant, slot)
            popis = [f"kouzlo {top}. úrovně" if slot > cant else "cantrip"]
            atk_est = max(atk_est, x["atk"])
    d["dpr_auto"] = round(best)
    d["dpr_popis"] = ", ".join(popis)
    d["dpr"] = _int((d["bj"] or {}).get("dpr"), 0) or d["dpr_auto"] or 0

    best_atk = atk_est + exhaust_pen
    for u in c.get("utoky") or []:
        if not isinstance(u, dict):
            continue
        at = u.get("atribut") or "STR"
        a = _atk_mod(at)
        best_atk = max(best_atk, a + d["pb"] + _int(u.get("bonus")) + exhaust_pen)
    best_dc = max((x["dc"] for x in d["casting"]), default=0)
    d["cr"] = _compute_cr(d["hp"], d["ac"], d["dpr"], best_atk, best_dc)
    d["best_atk"] = best_atk

    # ---------- kompaktní bojový souhrn pro editor bojů ----------
    d["boj"] = {
        "ac": d["ac"], "hp_max": d["hp"], "init": d["init"],
        "rychlosti": d["rychlosti"], "zachrany": d["saves"],
        "utoky": d["attacks"],
        "dc_kouzel": {x["trida"]: x["dc"] for x in d["casting"]},
        "odolnosti": d["odolnosti"], "imunity": d["imunity"],
        "imunity_stavu": d["imunity_stavu"], "smysly": d["smysly"],
        "zdroje": [{"nazev": z2["nazev"], "max": z2["max"], "obnova": z2["obnova"]}
                   for z2 in zdroje],
        "pb": d["pb"], "mods": mods, "utoky_za_akci": utoky_za_akci,
    }
    return d
