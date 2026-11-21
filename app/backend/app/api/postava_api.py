"""API pro průvodce postavou a editor efektů (backend část; frontend wizard později).

  POST /api/postava/nahled          – compute() náhled bez uložení
  POST /api/postava/postup-moznosti – co přinese další úroveň ve třídě
  GET  /api/postava/efekty-typy     – metadata typů efektů pro editor
  GET  /api/postava/obsah           – sloučený oficiální + vlastní obsah (vlastni)

Oficiální + vlastní obsah je sloučený v tabulce rules; vlastní řádky
mají `vlastni: true` a `stranka` (cesta .md). Totéž nabízí i
`/api/rules/list/{kind}?zdroj=vlastni|oficialni`.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from .. import charsheet, db, security
from ..engine.efekty import rules_rows
from .listing import paginate

router = APIRouter(prefix="/api/postava", tags=["postava"])

# PHB 2024 – primární atributy pro multiclass prerekvizity (13+ v obou třídách)
PRIMARNI = {
    "Artificer": ["INT"], "Barbarian": ["STR"], "Bard": ["CHA"],
    "Cleric": ["WIS"], "Druid": ["WIS"], "Fighter": ["STR", "DEX"],
    "Monk": ["DEX", "WIS"], "Paladin": ["STR", "CHA"], "Ranger": ["DEX", "WIS"],
    "Rogue": ["DEX"], "Sorcerer": ["CHA"], "Warlock": ["CHA"], "Wizard": ["INT"],
}
ASI_DEFAULT = [4, 8, 12, 16, 19]
PODTRIDA_UROVEN_DEFAULT = 3


def _int(v, default=0) -> int:
    try:
        return int(v)
    except (TypeError, ValueError):
        return default


def _primarni(cl_row: dict, trida: str) -> list[str]:
    p = cl_row.get("primarni_atribut")
    if isinstance(p, str) and p:
        return [p]
    if isinstance(p, list) and p:
        return [str(x) for x in p]
    return PRIMARNI.get(trida, [])


class NahledIn(BaseModel):
    data: dict


@router.post("/nahled")
def nahled(body: NahledIn, u: dict = Depends(security.require("editor"))):
    """Náhled dopočteného listu – nic se neukládá (live preview průvodce)."""
    return charsheet.compute(body.data or {})


class PostupIn(BaseModel):
    data: dict
    trida: str


@router.post("/postup-moznosti")
def postup_moznosti(body: PostupIn, u: dict = Depends(security.require("editor"))):
    """Co přinese další úroveň v dané třídě (včetně multiclass prerekvizit 2024)."""
    c = body.data or {}
    trida = body.trida
    if not trida:
        raise HTTPException(400, "chybí trida")
    R_class = rules_rows("class")
    R_sub = rules_rows("subclass")
    cl = R_class.get(trida)
    if cl is None:
        raise HTTPException(404, f"neznámá třída: {trida}")

    tridy = [t for t in (c.get("tridy") or []) if isinstance(t, dict)]
    stavajici = next((t for t in tridy if t.get("trida") == trida), None)
    lvl_v_tride = _int(stavajici.get("uroven")) if stavajici else 0
    nova = lvl_v_tride + 1
    nova_postava = sum(_int(t.get("uroven")) for t in tridy) + 1

    # multiclass prerekvizity – jen když třídu postava ještě nemá
    prerekvizity = None
    if stavajici is None and tridy:
        atributy = c.get("atributy") or {}

        def _ok(ab_list):
            if not ab_list:
                return None  # neznámý požadavek
            return any(_int(atributy.get(ab)) >= 13 for ab in ab_list)

        nove = _primarni(cl, trida)
        prerekvizity = {
            "nova_trida": {"atributy": nove, "splneno": _ok(nove)},
            "stavajici": {
                t.get("trida"): _ok(_primarni(
                    R_class.get(t.get("trida") or "") or {}, t.get("trida") or ""))
                for t in tridy},
            "vyhovuje": _ok(nove) is not False and all(
                _ok(_primarni(R_class.get(t.get("trida") or "") or {},
                              t.get("trida") or "")) is not False
                for t in tridy),
        }

    # nové rysy na této úrovni (oficiální i vlastní řádek)
    rysy = cl.get("rysy") or {}
    nove_rysy = [{"nazev": n, "uroven": nova,
                  "text": (v or {}).get("text") or "",
                  "efekty": (v or {}).get("efekty") or []}
                 for n, v in rysy.items()
                 if _int((v or {}).get("uroven")) == nova]

    # volby vyžadované novými rysy (volba + moznosti v efektech)
    volby_pozadovane = []
    for r in nove_rysy:
        for e in r["efekty"]:
            if isinstance(e, dict) and e.get("volba") and isinstance(e.get("moznosti"), dict):
                volby_pozadovane.append({"zdroj": f"{trida}: {r['nazev']}",
                                         "volba": e["volba"],
                                         "moznosti": sorted(e["moznosti"].keys())})

    # ASI / feat úroveň
    asi_urovne = cl.get("asi_urovne") or ASI_DEFAULT
    asi = nova in {_int(x) for x in asi_urovne}

    # výběr podtřídy?
    podtrida_uroven = _int(cl.get("podtrida_uroven"), PODTRIDA_UROVEN_DEFAULT)
    vybirat_podtridu = nova == podtrida_uroven and not (stavajici or {}).get("podtrida")
    podtridy = []
    if nova >= podtrida_uroven:
        for k, v in R_sub.items():
            if isinstance(v, dict) and v.get("trida") == trida:
                podtridy.append({"nazev": k, "vlastni": bool(v.get("vlastni")),
                                 "stranka": v.get("stranka")})
        podtridy.sort(key=lambda x: x["nazev"])

    # delty tabulky (Cantrips, Prepared Spells, sloty, resource sloupce…)
    tab = cl.get("tabulka") or {}
    pred, po = tab.get(str(lvl_v_tride)) or {}, tab.get(str(nova)) or {}
    delty = {}
    for col in set(pred) | set(po):
        if col in ("Class Features", "Features"):
            continue
        if pred.get(col) != po.get(col):
            delty[col] = {"pred": pred.get(col), "po": po.get(col)}

    # hit die + průměr HP za úroveň
    hd = _int(cl.get("hit_die"), 8)
    con_mod = (_int((c.get("atributy") or {}).get("CON"), 10) - 10) // 2

    # sloty po postupu – spočítá engine na kopii dat
    kopie = dict(c)
    tridy2 = [dict(t) for t in tridy]
    if stavajici:
        for t in tridy2:
            if t.get("trida") == trida:
                t["uroven"] = nova
    else:
        tridy2.append({"trida": trida, "uroven": 1})
    kopie["tridy"] = tridy2
    sheet = charsheet.compute(kopie)

    return {
        "trida": trida, "nova_uroven": nova, "uroven_postavy": nova_postava,
        "je_nova_trida": stavajici is None,
        "hit_die": hd, "hp_prumer": hd // 2 + 1 + con_mod,
        "nove_rysy": nove_rysy, "asi": asi,
        "vybirat_podtridu": vybirat_podtridu, "podtridy": podtridy,
        "delty_tabulky": delty,
        "cantrips": _int(po.get("Cantrips")),
        "pripravena": _int(po.get("Prepared Spells")),
        "sloty_po": sheet.get("slots"), "pact_po": sheet.get("pact"),
        "volby_pozadovane": volby_pozadovane,
        "prerekvizity": prerekvizity,
    }


# metadata typů efektů pro frontend editor efektů
EFEKTY_TYPY = [
    {"typ": "atribut", "label": "Atribut +", "pole": ["atribut", "hodnota", "max"]},
    {"typ": "atribut_min", "label": "Atribut alespoň", "pole": ["atribut", "hodnota"]},
    {"typ": "ac", "label": "AC bonus/nastavení", "pole": ["hodnota", "podminka"]},
    {"typ": "ac_vzorec", "label": "AC vzorec (Unarmored)",
     "pole": ["zaklad", "atributy", "stit_povolen", "bez_zbroje"]},
    {"typ": "hp", "label": "HP", "pole": ["hodnota", "za_uroven"]},
    {"typ": "rychlost", "label": "Rychlost", "pole": ["hodnota", "druh", "nastavit"]},
    {"typ": "smysl", "label": "Smysl", "pole": ["nazev", "dosah"]},
    {"typ": "odolnost", "label": "Odolnost", "pole": ["hodnota"]},
    {"typ": "imunita", "label": "Imunita", "pole": ["hodnota"]},
    {"typ": "zranitelnost", "label": "Zranitelnost", "pole": ["hodnota"]},
    {"typ": "imunita_stav", "label": "Imunita vůči stavu", "pole": ["hodnota"]},
    {"typ": "zdatnost", "label": "Zdatnost", "pole": ["oblast", "hodnota"]},
    {"typ": "expertiza", "label": "Expertíza", "pole": ["hodnota"]},
    {"typ": "polovicni_zdatnost", "label": "Poloviční zdatnost", "pole": ["oblast"]},
    {"typ": "bonus", "label": "Bonus", "pole": ["cil", "hodnota", "filtr"]},
    {"typ": "vyhoda", "label": "Výhoda (text)", "pole": ["cil", "popis"]},
    {"typ": "poznamka", "label": "Poznámka", "pole": ["text"]},
    {"typ": "kouzlo", "label": "Kouzlo navíc",
     "pole": ["nazev", "od_urovne", "atribut", "obnova", "pocet", "vzdy"]},
    {"typ": "zdroj", "label": "Zdroj (užití)",
     "pole": ["nazev", "pocet", "obnova", "kostka"]},
    {"typ": "utok", "label": "Útok",
     "pole": ["nazev", "kostka", "typ_zraneni", "atribut", "dosah", "bonus"]},
    {"typ": "utoky_za_akci", "label": "Útoky za akci", "pole": ["hodnota"]},
    {"typ": "velikost", "label": "Velikost", "pole": ["hodnota"]},
]
SPOLECNE_POLE = ["od_urovne", "podminka", "volba", "moznosti"]


@router.get("/efekty-typy")
def efekty_typy(u: dict | None = Depends(security.optional)):
    """Typy efektů + popisky polí pro editor efektů (výrazy: PB, uroven, mod:AB…)."""
    return {"typy": EFEKTY_TYPY, "spolecna_pole": SPOLECNE_POLE,
            "vyrazy": {"promenne": ["PB", "uroven", "uroven:<Trida>", "mod:<AB>",
                                    "<sloupec tabulky třídy>"],
                       "funkce": ["max(a,b)", "min(a,b)"],
                       "poznamka": "hodnota může být číslo nebo bezpečný výraz"}}


@router.get("/obsah")
def obsah(kind: str, q: str = "", page: int = 1, size: int = 0,
          u: dict | None = Depends(security.optional)):
    """Sloučený oficiální + vlastní obsah daného kindu (wizard pickery).

    kind: species|class|subclass|feat|spell|item|background
    """
    rows = rules_rows(kind)
    items = []
    for key, data in rows.items():
        name = str((data or {}).get("nazev") or data.get("name") or key)
        if q and q.lower() not in name.lower():
            continue
        items.append({"key": key, "name": name,
                      "vlastni": bool((data or {}).get("vlastni")),
                      "stranka": (data or {}).get("stranka"),
                      "data": data})
    items.sort(key=lambda x: x["name"])
    return paginate(items, page=page, size=size)
