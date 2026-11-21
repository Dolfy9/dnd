"""Načítání a sběr efektů pro výpočet postavy.

Efekty mají dvojí zdroj:
  * oficiální pravidla – web/assets/efekty2024.json (sekce species/feat/class/
    subclass/item/background),
  * vlastní obsah – řádek tabulky rules s `vlastni: true` a polem `efekty`
    (případně `rysy[*].efekty` u druhu/povolání/podtřídy).
Vlastní řádek má přednost před efekty2024.json.

Volby (volba + moznosti) se řeší z `postava.volby` pod klíčem
"<zdroj>|<volba>"; u druhu se jako fallback zkouší text `druh_volby`.
Nevyřešené volby se hlásí v `chybejici_volby`.
"""
import json
from functools import lru_cache
from pathlib import Path

from .. import db
from ..config import ROOT

EFEKTY_FILE = ROOT / "web" / "assets" / "efekty2024.json"


@lru_cache(maxsize=1)
def oficialni() -> dict:
    try:
        return json.loads(EFEKTY_FILE.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def clear_cache() -> None:
    oficialni.cache_clear()


def rules_rows(kind: str) -> dict:
    """kind → {key: data} z tabulky rules."""
    rows = db.connect().execute(
        "SELECT key,name,data FROM rules WHERE kind=?", (kind,)).fetchall()
    out = {}
    for r in rows:
        try:
            out[r["key"]] = json.loads(r["data"])
        except (TypeError, ValueError):
            pass
    return out


def _jako_seznam(ef) -> list:
    if isinstance(ef, list):
        return [e for e in ef if isinstance(e, dict)]
    return []


def efekty_pravidla(kind: str, key: str) -> dict | list:
    """Efekty z efekty2024.json pro daný kind/key (oficiální obsah)."""
    sec = oficialni().get(kind) or {}
    return sec.get(key) or ([] if kind in ("feat", "item", "background") else {})


def _rozsir_volby(efekty: list, zdroj: str, volby: dict, fallback: str,
                  chybejici: list) -> list:
    """Rozbalí efekty s volba/moznosti podle zvolené možnosti."""
    out: list = []
    for e in efekty:
        if not isinstance(e, dict):
            continue
        volba = e.get("volba")
        moznosti = e.get("moznosti") or {}
        if not volba or not isinstance(moznosti, dict):
            out.append(e)
            continue
        klíč = f"{zdroj}|{volba}"
        zvoleno = volby.get(klíč)
        if not zvoleno and fallback:
            fb = str(fallback).lower()
            for opt in moznosti:
                if opt.lower() in fb or fb in opt.lower():
                    zvoleno = opt
                    break
        zdedene = {k: e[k] for k in ("od_urovne", "podminka") if k in e}
        if zvoleno and zvoleno in moznosti:
            for oe in _jako_seznam(moznosti[zvoleno]):
                m = dict(zdedene)
                m.update(oe)
                out.append(m)
            base = {k: v for k, v in e.items() if k not in ("volba", "moznosti")}
            if base and base.get("typ") != "volba_slot":
                out.append(base)
        else:
            # volba, kde všechny možnosti jsou jen mechanicky-nečinné efekty
            # (`atribut` ASI, prázdné možnosti, textové poznamka/vyhoda) —
            # u legacy postav bez atributy_zaklad se nehlásí (už je v číslech)
            NEMECH = ("atribut", "poznamka", "vyhoda")
            jen_atributy = all(
                all(o.get("typ") in NEMECH for o in _jako_seznam(moznosti[o2]))
                for o2 in moznosti)
            chybejici.append({"zdroj": zdroj, "volba": volba,
                              "moznosti": sorted(moznosti.keys()),
                              "jen_atributy": jen_atributy})
            base = {k: v for k, v in e.items() if k not in ("volba", "moznosti")}
            if base and base.get("typ") != "volba_slot":
                out.append(base)
    return out


def seber(c: dict) -> tuple[list[dict], list[dict]]:
    """Sebere všechny efekty postavy.

    Vrací (efekty, chybejici_volby); každý efekt je doplněný o
    `_zdroj` (lidský název zdroje) a `_uroven` (úroveň pro od_urovne –
    úroveň ve třídě u třídních zdrojů, jinak úroveň postavy).
    """
    tridy = [t for t in (c.get("tridy") or []) if isinstance(t, dict)]
    lvl = sum(int(t.get("uroven") or 0) for t in tridy) or 1
    volby = c.get("volby") or {}
    chybejici: list[dict] = []
    out: list[dict] = []

    R_species = rules_rows("species")
    R_class = rules_rows("class")
    R_sub = rules_rows("subclass")
    R_feat = rules_rows("feat")
    R_item = rules_rows("item")
    R_bg = rules_rows("background")

    def pridat(efekty, zdroj: str, uroven: int, fallback_volby: str = "",
               trida: str = ""):
        if not efekty:
            return
        efekty = _jako_seznam(efekty)
        efekty = _rozsir_volby(efekty, zdroj, volby, fallback_volby, chybejici)
        for e in efekty:
            e2 = dict(e)
            e2["_zdroj"] = zdroj
            e2["_uroven"] = uroven
            if trida:
                e2["_trida"] = trida
            out.append(e2)

    # ---- druh (species) -------------------------------------------------
    druh = str(c.get("druh") or "")
    sp = R_species.get(druh) or {}
    sp_of = oficialni().get("species", {}).get(druh) or {}
    if sp.get("vlastni"):
        # vlastní druh: efekty na úrovni druhu + u jednotlivých rysů
        pridat(sp.get("efekty"), druh, lvl, c.get("druh_volby") or "")
        rysy = sp.get("rysy") or {}
        items = rysy.items() if isinstance(rysy, dict) else [
            (r.get("nazev"), r) for r in rysy if isinstance(r, dict)]
        for name, r in items:
            if isinstance(r, dict):
                pridat(r.get("efekty"), f"{druh}: {name}", lvl,
                       c.get("druh_volby") or "")
    else:
        for trait, ef in sp_of.items():
            pridat(ef, f"{druh}: {trait}" if len(sp_of) > 1 else druh, lvl,
                   c.get("druh_volby") or "")

    # ---- pozadí (jen vlastní efekty – oficiální mechaniky drží frontmatter)
    bg = R_bg.get(str(c.get("pozadi") or "")) or {}
    if bg.get("vlastni"):
        pridat(bg.get("efekty"), str(c.get("pozadi") or ""), lvl)

    # ---- třídy + podtřídy ------------------------------------------------
    for i, t in enumerate(tridy):
        tn, sub_name = t.get("trida") or "", t.get("podtrida") or ""
        tlvl = int(t.get("uroven") or 0)
        cl = R_class.get(tn) or {}
        cl_of = oficialni().get("class", {}).get(tn) or {}
        vlastni_trida = bool(cl.get("vlastni"))

        if i == 0:
            core_ef = cl.get("efekty_core") if vlastni_trida else cl_of.get("core")
            pridat(core_ef, tn, tlvl, trida=tn)
        else:
            # multiclass: jen zúžená sada zdatností (oficiální) / nic u vlastních
            multi_ef = cl.get("efekty_multiclass") if vlastni_trida else cl_of.get("multiclass")
            pridat(multi_ef, f"{tn} (multiclass)", tlvl, trida=tn)

        if vlastni_trida:
            pridat(cl.get("efekty"), tn, tlvl, trida=tn)

        rysy = cl.get("rysy") or {}
        items = rysy.items() if isinstance(rysy, dict) else [
            (r.get("nazev"), r) for r in rysy if isinstance(r, dict)]
        for name, r in items:
            if not isinstance(r, dict):
                continue
            rl = int(r.get("uroven") or 0)
            if not rl or rl > tlvl:
                continue
            ef = r.get("efekty") if vlastni_trida else (cl_of.get(name) or [])
            pridat(ef, f"{tn}: {name}", tlvl, trida=tn)

        if sub_name:
            sub = R_sub.get(sub_name) or {}
            sub_of = oficialni().get("subclass", {}).get(sub_name) or {}
            if sub.get("vlastni"):
                srysy = sub.get("rysy") or {}
                sitems = srysy.items() if isinstance(srysy, dict) else [
                    (r.get("nazev"), r) for r in srysy if isinstance(r, dict)]
                for name, r in sitems:
                    if not isinstance(r, dict):
                        continue
                    rl = int(r.get("uroven") or 0)
                    if rl and rl <= tlvl:
                        pridat(r.get("efekty"), f"{sub_name}: {name}", tlvl, trida=tn)
                # kouzla vždy připravená od úrovně
                for kk in sub.get("kouzla_vzdy") or []:
                    if int(kk.get("uroven") or 0) <= tlvl:
                        for kn in kk.get("kouzla") or []:
                            pridat([{"typ": "kouzlo", "nazev": kn, "vzdy": True,
                                     "trida": tn}], f"{sub_name} (kouzla)", tlvl, trida=tn)
            else:
                for name, ef in sub_of.items():
                    rl = int(((sub.get("rysy") or {}).get(name) or {}).get("uroven") or 0)
                    if rl and rl <= tlvl:
                        pridat(ef, f"{sub_name}: {name}", tlvl, trida=tn)

    # ---- featy ------------------------------------------------------------
    for f in c.get("featy") or []:
        nm = (f.get("nazev") if isinstance(f, dict) else str(f)) or ""
        # "Magic Initiate (Druid)" → základ "Magic Initiate", přesnost = volba
        base, presnost = nm, ""
        if "(" in nm:
            base, presnost = nm.split("(", 1)
            base, presnost = base.strip(), presnost.rstrip(")").strip()
            if base not in R_feat:
                base = nm
        row = R_feat.get(base) or {}
        # fallback pro volbu: "(Cleric)" v názvu, nebo text zdroje/poznámky,
        # nebo specifikace featu v pozadí (Acolyte → "Magic Initiate (Cleric)")
        fb = presnost
        if not fb and isinstance(f, dict):
            spec = " ".join(str(f.get(k) or "") for k in ("nazev", "zdroj", "poznamka"))
            bgf = str((R_bg.get(str(c.get("pozadi") or "")) or {}).get("feat") or "")
            fb = (spec + " " + bgf).strip()
        if row.get("vlastni"):
            pridat(row.get("efekty"), base, lvl, fb)
        else:
            pridat(efekty_pravidla("feat", base), base, lvl, fb)

    # ---- vlastní rysy + ruční efekty -------------------------------------
    for r in c.get("vlastni_rysy") or []:
        if isinstance(r, dict):
            pridat(r.get("efekty"), r.get("nazev") or "Vlastní rys", lvl)
    pridat(c.get("efekty"), "Ruční efekt", lvl)

    # ---- vybavené předměty -------------------------------------------------
    for v in c.get("vybava") or []:
        if not isinstance(v, dict):
            continue
        nm = v.get("predmet") or v.get("nazev") or ""
        row = R_item.get(nm) or {}
        item_of = oficialni().get("item", {}).get(nm) or {}
        vlastni_item = bool(row.get("vlastni"))
        efekty_item = row.get("efekty") if vlastni_item else item_of.get("efekty")
        if not efekty_item:
            continue
        nalad = bool(v.get("naladeno"))
        vybav = bool(v.get("vybaveno"))
        for e in _jako_seznam(efekty_item):
            req = e.get("vyzaduje")
            if req == "naladeni" and not nalad:
                continue
            if req == "vybaveno" and not vybav:
                continue
            if (row.get("naladeni") or item_of.get("naladeni")) and not nalad:
                continue  # předmět vyžadující naladění působí jen naladěný
            if not vybav and req != "noseno":
                continue  # nevybavené předměty mechanicky nepůsobí
            e2 = dict(e)
            e2["_zdroj"] = nm
            e2["_uroven"] = lvl
            out.append(e2)

    return out, chybejici
