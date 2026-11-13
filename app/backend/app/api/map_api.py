"""Mapa: místa, vrstvy (svet/vodstvo), bojové mapy, registr více map.

Výchozí mapa "montelien" žije přímo v 11_Mapy/ (mista.json + svet.json +
vodstvo.json) a zrcadlí se do DB (map_places, map_geo). Další mapy mají
vlastní složky v 11_Mapy/mapy/<id>/ se stejnou strukturou souborů —
soubory jsou kanonické, DB zrcadlí jen výchozí mapu.
"""
import json
import re
import subprocess
import sys
import threading

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from .. import db, render, security
from ..config import ROOT
from .pages import safe_path

router = APIRouter(prefix="/api/map", tags=["map"])
_render_lock = threading.Lock()

MAPY = ROOT / "11_Mapy"
DATA_FILES = ("mista.json", "svet.json", "vodstvo.json")
IMG_EXT = {".jpg", ".jpeg", ".png", ".webp"}
DEFAULT_MAP = "montelien"


# ---------------- registr map ----------------

def _registry() -> dict:
    f = MAPY / "mapy.json"
    reg = {"vychozi": DEFAULT_MAP, "mapy": []}
    if f.is_file():
        try:
            reg.update(json.loads(f.read_text(encoding="utf-8")))
        except ValueError:
            pass
    if not any(m.get("id") == DEFAULT_MAP for m in reg["mapy"]):
        reg["mapy"].insert(0, {
            "id": DEFAULT_MAP, "nazev": "Montelien",
            "mista": "mista.json", "svet": "svet.json", "vodstvo": "vodstvo.json",
        })
    return reg


def _save_registry(reg: dict) -> None:
    reg = {k: v for k, v in reg.items()}
    (MAPY / "mapy.json").write_text(
        json.dumps(reg, ensure_ascii=False, indent=1), encoding="utf-8")


def _map_dir(map_id: str) -> tuple[object, dict]:
    """Adresář mapy + položka registru."""
    reg = _registry()
    meta = next((m for m in reg["mapy"] if m.get("id") == map_id), None)
    if meta is None:
        if map_id == DEFAULT_MAP:
            meta = {"id": DEFAULT_MAP, "nazev": "Montelien"}
        else:
            raise HTTPException(404, "mapa nenalezena")
    d = MAPY if map_id == DEFAULT_MAP else MAPY / "mapy" / map_id
    return d, meta


def _jread(d, name: str, default):
    f = d / name
    if f.is_file():
        try:
            return json.loads(f.read_text(encoding="utf-8"))
        except ValueError:
            pass
    return default


def _jwrite(d, name: str, data) -> None:
    d.mkdir(parents=True, exist_ok=True)
    (d / name).write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")


def _podklady(d) -> list[dict]:
    """Rastrové podklady v adresáři mapy (pro výběr vrstvy)."""
    out = []
    for f in sorted(d.iterdir()) if d.is_dir() else []:
        if f.suffix.lower() in IMG_EXT:
            out.append({"soubor": f.name, "nazev": f.stem.replace("_", " ")})
    return out


# ---------------- místa ----------------

def _file_extras() -> dict:
    """Pole z mista.json, která map_places neukládá (hlavni_mesto apod.)."""
    data = _jread(MAPY, "mista.json", {})
    out = {}
    KNOWN = {"nazev", "x", "y", "typ", "jistota", "odkaz", "pozn", "popisek"}
    for m in data.get("mista", []):
        extra = {k: v for k, v in m.items() if k not in KNOWN}
        if extra:
            out[(m.get("nazev"), m.get("x"), m.get("y"))] = extra
    return out


def _places():
    rows = db.connect().execute("SELECT * FROM map_places ORDER BY nazev").fetchall()
    extras = _file_extras()
    out = []
    for r in rows:
        d = dict(r)
        d["popisek"] = db.jload(r["popisek"]) or None  # {} → None (jinak svet.js kreslí popisek)
        d["url"] = render.page_url(r["odkaz"]) if r["odkaz"] else ""
        d.update(extras.get((d["nazev"], d["x"], d["y"]), {}))
        out.append(d)
    return out


def _file_places(d) -> list[dict]:
    data = _jread(d, "mista.json", {})
    out = []
    for i, m in enumerate(data.get("mista", [])):
        m = dict(m)
        m["id"] = i
        m["popisek"] = m.get("popisek") or None
        m["url"] = render.page_url(m.get("odkaz", "")) if m.get("odkaz") else ""
        out.append(m)
    return out


# ---------------- data endpoint ----------------

@router.get("/list")
def map_list(u: dict | None = Depends(security.optional)):
    reg = _registry()
    out = []
    for m in reg["mapy"]:
        mid = m["id"]
        d = MAPY if mid == DEFAULT_MAP else MAPY / "mapy" / mid
        out.append({**m, "podklady": _podklady(d), "vychozi": mid == reg["vychozi"]})
    return {"vychozi": reg["vychozi"], "mapy": out}


@router.get("/data")
def map_data(mapa: str = DEFAULT_MAP, u: dict | None = Depends(security.optional)):
    d, meta = _map_dir(mapa)
    mista_file = _jread(d, "mista.json", {})
    svet = _jread(d, "svet.json", {})
    vodstvo = _jread(d, "vodstvo.json", {})

    if mapa == DEFAULT_MAP:
        mista = _places()
        geo = {}
        for r in db.connect().execute("SELECT dataset,key,data FROM map_geo"):
            geo.setdefault(r["dataset"], {}).setdefault(r["key"], []).append(db.jload(r["data"]))
        svet_g = geo.get("svet", {})
        vodstvo_g = geo.get("vodstvo", {})
        # meta pole ze souborů zachovat (editor ukládá celý objekt zpět)
        for src, dst in ((svet, svet_g), (vodstvo, vodstvo_g)):
            for k, v in src.items():
                if k.startswith("_"):
                    dst[k] = v
    else:
        mista = _file_places(d)
        svet_g = {k: (v if isinstance(v, list) else [v]) for k, v in svet.items()
                  if k not in ("sirka", "vyska")}
        vodstvo_g = {k: (v if isinstance(v, list) else [v]) for k, v in vodstvo.items()
                     if k not in ("sirka", "vyska")}

    con = db.connect()
    return {
        "mapa": meta["id"], "nazev": meta.get("nazev", meta["id"]),
        "sirka": mista_file.get("sirka") or svet.get("sirka", 2048),
        "vyska": mista_file.get("vyska") or svet.get("vyska", 1440),
        "mista": mista,
        "mista_raw": mista_file.get("mista", []),
        "popis_mista": mista_file.get("_popis", ""),
        "svet": svet_g,
        "vodstvo": vodstvo_g,
        "podklady": _podklady(d),
        "bojove_mapy": [dict(r, data=db.jload(r["data"]))
                        for r in con.execute("SELECT * FROM battle_maps")],
        "editable": security.can_edit(u),
    }


# ---------------- zrcadlení mista.json (výchozí mapa) ----------------

def _dump_mista() -> None:
    """map_places → 11_Mapy/mista.json (zrcadlo). Zachová pole navíc z původního souboru."""
    f = MAPY / "mista.json"
    meta = {}
    old = {}
    if f.is_file():
        try:
            meta = json.loads(f.read_text(encoding="utf-8"))
            old = {(m.get("nazev"), m.get("x"), m.get("y")): m for m in meta.get("mista", [])}
        except ValueError:
            meta, old = {}, {}
    mista = []
    for r in _places():
        m = {"nazev": r["nazev"], "x": r["x"], "y": r["y"], "typ": r["typ"],
             "jistota": r["jistota"], "odkaz": r["odkaz"], "pozn": r["pozn"]}
        if r["popisek"]:
            m["popisek"] = r["popisek"]
        # pole navíc (hlavni_mesto apod.) ze souboru zachovat
        prev = old.get((r["nazev"], r["x"], r["y"]), {})
        for k, v in prev.items():
            if k not in m:
                m[k] = v
        mista.append(m)
    out = {"_popis": meta.get("_popis", ""), "sirka": meta.get("sirka", 2048),
           "vyska": meta.get("vyska", 1440), "mista": mista}
    f.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")


def _render_map() -> tuple[bool, str]:
    if not _render_lock.acquire(blocking=False):
        return False, "překreslování už běží"
    try:
        r1 = subprocess.run([sys.executable, str(ROOT / "tools" / "mapa.py")], cwd=ROOT,
                            capture_output=True, text=True, timeout=300)
        r2 = subprocess.run([sys.executable, str(ROOT / "tools" / "mapa_ilustrace.py")],
                            cwd=ROOT / "tools", capture_output=True, text=True, timeout=300)
        if r1.returncode or r2.returncode:
            return False, (r1.stderr or r2.stderr or "")[-1500:]
        return True, ""
    except Exception as e:  # noqa: BLE001
        return False, str(e)
    finally:
        _render_lock.release()


class PlaceBody(BaseModel):
    nazev: str
    x: float
    y: float
    typ: str = "misto"
    jistota: str = "odhad"
    odkaz: str = ""
    pozn: str = ""
    popisek: dict = {}
    hlavni_mesto: bool | None = None


def _mista_extra(nazev: str, x: float, y: float, key: str, val) -> None:
    """Doplňkové pole (hlavni_mesto apod.) do 11_Mapy/mista.json — DB ho neukládá."""
    f = MAPY / "mista.json"
    data = _jread(MAPY, "mista.json", {})
    for m in data.get("mista", []):
        if m.get("nazev") == nazev and m.get("x") == x and m.get("y") == y:
            if val:
                m[key] = val
            else:
                m.pop(key, None)
            _jwrite(MAPY, "mista.json", data)
            return


def _file_place_write(d, body: PlaceBody, idx: int | None, delete: bool = False) -> dict:
    data = _jread(d, "mista.json", {"mista": []})
    mista = data.setdefault("mista", [])
    if idx is None:
        if delete:
            raise HTTPException(400, "chybí index")
        mista.append({})
        idx = len(mista) - 1
    if idx < 0 or idx >= len(mista):
        raise HTTPException(404, "místo nenalezeno")
    if delete:
        mista.pop(idx)
        _jwrite(d, "mista.json", data)
        return {"ok": True}
    m = dict(mista[idx]) if isinstance(mista[idx], dict) else {}
    for k in ("nazev", "x", "y", "typ", "jistota", "odkaz", "pozn"):
        m[k] = getattr(body, k)
    if body.popisek:
        m["popisek"] = body.popisek
    else:
        m.pop("popisek", None)
    if body.hlavni_mesto is not None:
        m["hlavni_mesto"] = body.hlavni_mesto
    mista[idx] = m
    _jwrite(d, "mista.json", data)
    return {"ok": True, "id": idx}


@router.post("/places")
def new_place(b: PlaceBody, mapa: str = DEFAULT_MAP, u: dict = Depends(security.require("editor"))):
    if mapa != DEFAULT_MAP:
        d, _ = _map_dir(mapa)
        db.audit(u["login"], "map.place.create", f"{mapa}:{b.nazev}")
        return _file_place_write(d, b, None)
    con = db.connect()
    con.execute("INSERT INTO map_places(nazev,x,y,typ,jistota,odkaz,pozn,popisek) VALUES(?,?,?,?,?,?,?,?)",
                (b.nazev, b.x, b.y, b.typ, b.jistota, b.odkaz, b.pozn, db.jdump(b.popisek)))
    con.commit()
    _dump_mista()
    if b.hlavni_mesto is not None:
        _mista_extra(b.nazev, b.x, b.y, "hlavni_mesto", b.hlavni_mesto)
    db.audit(u["login"], "map.place.create", b.nazev)
    return {"ok": True, "id": con.execute("SELECT last_insert_rowid() i").fetchone()["i"]}


@router.put("/places/{pid}")
def put_place(pid: int, b: PlaceBody, mapa: str = DEFAULT_MAP, u: dict = Depends(security.require("editor"))):
    if mapa != DEFAULT_MAP:
        d, _ = _map_dir(mapa)
        db.audit(u["login"], "map.place.save", f"{mapa}:{b.nazev}")
        return _file_place_write(d, b, pid)
    con = db.connect()
    cur = con.execute(
        "UPDATE map_places SET nazev=?,x=?,y=?,typ=?,jistota=?,odkaz=?,pozn=?,popisek=? WHERE id=?",
        (b.nazev, b.x, b.y, b.typ, b.jistota, b.odkaz, b.pozn, db.jdump(b.popisek), pid))
    if not cur.rowcount:
        raise HTTPException(404, "místo nenalezeno")
    con.commit()
    _dump_mista()
    if b.hlavni_mesto is not None:
        _mista_extra(b.nazev, b.x, b.y, "hlavni_mesto", b.hlavni_mesto)
    db.audit(u["login"], "map.place.save", b.nazev)
    return {"ok": True}


@router.delete("/places/{pid}")
def del_place(pid: int, mapa: str = DEFAULT_MAP, u: dict = Depends(security.require("editor"))):
    if mapa != DEFAULT_MAP:
        d, _ = _map_dir(mapa)
        r = _file_place_write(d, PlaceBody(nazev="", x=0, y=0), pid, delete=True)
        db.audit(u["login"], "map.place.delete", f"{mapa}:#{pid}")
        return r
    con = db.connect()
    row = con.execute("SELECT nazev FROM map_places WHERE id=?", (pid,)).fetchone()
    if not row:
        raise HTTPException(404, "místo nenalezeno")
    con.execute("DELETE FROM map_places WHERE id=?", (pid,))
    con.commit()
    _dump_mista()
    db.audit(u["login"], "map.place.delete", row["nazev"])
    return {"ok": True}


class GeoBody(BaseModel):
    dataset: str
    key: str
    items: list


@router.put("/geo")
def put_geo(b: GeoBody, mapa: str = DEFAULT_MAP, u: dict = Depends(security.require("editor"))):
    if b.dataset not in ("svet", "vodstvo"):
        raise HTTPException(400, "neznámý dataset")
    d, _ = _map_dir(mapa)
    name = {"svet": "svet.json", "vodstvo": "vodstvo.json"}[b.dataset]
    if mapa == DEFAULT_MAP:
        con = db.connect()
        con.execute("DELETE FROM map_geo WHERE dataset=? AND key=?", (b.dataset, b.key))
        for item in b.items:
            con.execute("INSERT INTO map_geo(dataset,key,data) VALUES(?,?,?)",
                        (b.dataset, b.key, db.jdump(item)))
        con.commit()
    data = _jread(d, name, {})
    data[b.key] = b.items
    _jwrite(d, name, data)
    db.audit(u["login"], "map.geo", f"{mapa}:{b.dataset}.{b.key}")
    return {"ok": True}


# ---------------- uložení celých souborů (editor atlasu) ----------------

class SouborBody(BaseModel):
    mapa: str = DEFAULT_MAP
    soubor: str = ""   # mista.json | svet.json | vodstvo.json
    obsah: str = ""    # JSON text


def _sync_default() -> None:
    """Po přímém zápisu mista.json/svet.json/vodstvo.json přesyncuj DB zrcadlo."""
    from ..ingest.importer import Importer
    imp = Importer()
    imp._mista()
    imp._geo("svet", MAPY / "svet.json")
    imp._geo("vodstvo", MAPY / "vodstvo.json")
    imp.con.commit()


@router.put("/soubor")
def put_soubor(b: SouborBody, u: dict = Depends(security.require("editor"))):
    name = b.soubor.lstrip("/").rsplit("/", 1)[-1]
    if name not in DATA_FILES:
        raise HTTPException(400, "nepovolený soubor")
    try:
        parsed = json.loads(b.obsah)
    except ValueError as e:
        raise HTTPException(400, f"neplatný JSON: {e}")
    d, _ = _map_dir(b.mapa)
    # pojistka proti ztrátě dat: klíče, které klient vůbec neposlal,
    # se převezou ze starého souboru (smazání musí být explicitní)
    old_path = (d / name)
    if old_path.is_file() and isinstance(parsed, dict):
        try:
            old = json.loads(old_path.read_text(encoding="utf-8"))
            for k, v in old.items():
                if k not in parsed:
                    parsed[k] = v
        except ValueError:
            pass
    _jwrite(d, name, parsed)
    if b.mapa == DEFAULT_MAP:
        _sync_default()
    db.audit(u["login"], "map.soubor", f"{b.mapa}:{name}")
    return {"ok": True}


# ---------------- správa map ----------------

class MapBody(BaseModel):
    id: str = ""
    nazev: str = ""
    sirka: int = 2048
    vyska: int = 1440


@router.post("/create")
def map_create(b: MapBody, u: dict = Depends(security.require("editor"))):
    mid = re.sub(r"[^a-z0-9_-]", "", b.id.lower().replace(" ", "_"))
    if not mid or mid == DEFAULT_MAP:
        raise HTTPException(400, "neplatné nebo obsazené id")
    d = MAPY / "mapy" / mid
    if d.exists():
        raise HTTPException(400, "mapa už existuje")
    reg = _registry()
    if any(m["id"] == mid for m in reg["mapy"]):
        raise HTTPException(400, "mapa už existuje")
    d.mkdir(parents=True)
    _jwrite(d, "mista.json", {"_popis": b.nazev, "sirka": b.sirka, "vyska": b.vyska, "mista": []})
    _jwrite(d, "svet.json", {"sirka": b.sirka, "vyska": b.vyska})
    _jwrite(d, "vodstvo.json", {})
    reg["mapy"].append({"id": mid, "nazev": b.nazev or mid,
                        "mista": "mista.json", "svet": "svet.json", "vodstvo": "vodstvo.json"})
    _save_registry(reg)
    db.audit(u["login"], "map.create", mid)
    return {"ok": True, "id": mid}


@router.delete("/{mid}")
def map_delete(mid: str, u: dict = Depends(security.require("admin"))):
    if mid == DEFAULT_MAP:
        raise HTTPException(400, "výchozí mapu nelze smazat")
    d, _ = _map_dir(mid)
    reg = _registry()
    reg["mapy"] = [m for m in reg["mapy"] if m["id"] != mid]
    _save_registry(reg)
    import shutil
    shutil.rmtree(d, ignore_errors=True)
    db.audit(u["login"], "map.delete", mid)
    return {"ok": True}


@router.post("/render")
def render_map(u: dict = Depends(security.require("editor"))):
    ok, err = _render_map()
    if not ok:
        raise HTTPException(500, err or "překreslení selhalo")
    db.audit(u["login"], "map.render")
    return {"ok": True}
