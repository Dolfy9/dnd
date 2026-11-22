"""Bojové mapy: CRUD nad 11_Mapy/bojove_mapy.json + obrázky a vlastní assety.

Soubor je kanonický — DB (battle_maps) je jen zrcadlo. Zápis zachovává
formátování souboru (indent=1, ensure_ascii=False) → nezměněné položky
zůstávají byte-identické.
"""
import json
import re
import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile

from .. import db, security
from ..config import ROOT

router = APIRouter(prefix="/api/map/bojove", tags=["battle-maps"])

MAPY = ROOT / "11_Mapy"
JSON_F = MAPY / "bojove_mapy.json"
IMG_DIR = MAPY / "bojove"
ASSET_DIR = IMG_DIR / "assets"
IMG_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
ASSET_EXT = {".png", ".jpg", ".jpeg", ".webp", ".gif"}
MAX_IMG = 50 * 1024 * 1024
MAX_ASSET = 10 * 1024 * 1024
_ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,80}$")


def _load() -> dict:
    if not JSON_F.is_file():
        return {"mapy": []}
    try:
        return json.loads(JSON_F.read_text(encoding="utf-8", newline=""))
    except ValueError:
        return {"mapy": []}


def _save(doc: dict) -> None:
    JSON_F.write_bytes(json.dumps(doc, ensure_ascii=False, indent=1).encode("utf-8"))


def _find(doc: dict, mid: str) -> dict | None:
    return next((m for m in doc.get("mapy", []) if m.get("id") == mid), None)


def _db_upsert(m: dict) -> None:
    con = db.connect()
    con.execute("INSERT OR REPLACE INTO battle_maps(id,name,misto,data) VALUES(?,?,?,?)",
                (m.get("id", ""), m.get("nazev", ""), m.get("misto", ""), db.jdump(m)))
    con.commit()


def _db_delete(mid: str) -> None:
    con = db.connect()
    con.execute("DELETE FROM battle_maps WHERE id=?", (mid,))
    con.commit()


def _slug(nazev: str) -> str:
    import unicodedata
    s = unicodedata.normalize("NFKD", nazev).encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s).strip("-").lower()[:60] or "mapa"
    return s


def strip_for_player(m: dict) -> dict:
    """Verze mapy pro hráče: bez DM poznámek, dmOnly objektů/kreseb,
    secret zdi → obyčejné zdi (neviditelné, ale mechanicky zeď)."""
    m = dict(m)
    m.pop("poznamky", None)
    if m.get("objekty"):
        m["objekty"] = [o for o in m["objekty"] if not o.get("dmOnly")]
    if m.get("kresby"):
        m["kresby"] = [k for k in m["kresby"] if not k.get("dmOnly")]
    if m.get("svetla"):
        m["svetla"] = [l for l in m["svetla"] if not l.get("dmOnly")]
    if m.get("steny"):
        m["steny"] = [{**w, "typ": "wall"} if w.get("typ") == "secret" else w
                      for w in m["steny"]]
    return m


@router.post("")
def create_map(b: dict, u: dict = Depends(security.require("editor"))):
    nazev = (b.get("nazev") or "Nová mapa").strip()
    mid = _slug(nazev)
    doc = _load()
    ids = {m.get("id") for m in doc.get("mapy", [])}
    base = mid
    i = 2
    while mid in ids:
        mid = f"{base}-{i}"
        i += 1
    m = {
        "id": mid, "nazev": nazev, "podklad": b.get("podklad", "jine"),
        "osvetleni": b.get("osvetleni", "Bright Light"),
        "start": b.get("start", {"druzina": []}),
        "mrizka": b.get("mrizka") or ["." * 20 for _ in range(15)],
    }
    for k in ("mlha", "textury", "malba", "interiery", "trasy", "atmosfera", "pocasi", "vyska", "steny", "objekty", "kresby", "svetla",
              "poznamky", "mrizkaStyl", "kalibrace", "obrazek", "misto",
              "popis", "stretnuti"):
        if b.get(k) is not None:
            m[k] = b[k]
    doc.setdefault("mapy", []).append(m)
    _save(doc)
    _db_upsert(m)
    return {"ok": True, "id": mid, "mapa": m}


@router.put("/{mid}")
def update_map(mid: str, b: dict, u: dict = Depends(security.require("editor"))):
    doc = _load()
    m = _find(doc, mid)
    if m is None:
        raise HTTPException(404, "mapa nenalezena")
    b = dict(b)
    b.pop("id", None)  # id se nemění
    for k, v in b.items():
        if v is None and k in m:
            m.pop(k)
        else:
            m[k] = v
    _save(doc)
    _db_upsert(m)
    return {"ok": True, "mapa": m}


@router.delete("/{mid}")
def delete_map(mid: str, u: dict = Depends(security.require("editor"))):
    doc = _load()
    m = _find(doc, mid)
    if m is None:
        raise HTTPException(404, "mapa nenalezena")
    doc["mapy"] = [x for x in doc["mapy"] if x.get("id") != mid]
    _save(doc)
    _db_delete(mid)
    for ext in IMG_EXT:
        f = IMG_DIR / f"{mid}{ext}"
        if f.is_file():
            f.unlink()
    return {"ok": True}


@router.post("/{mid}/obrazek")
async def upload_obrazek(mid: str, file: UploadFile,
                         u: dict = Depends(security.require("editor"))):
    doc = _load()
    m = _find(doc, mid)
    if m is None:
        raise HTTPException(404, "mapa nenalezena")
    ext = ("." + (file.filename or "").rsplit(".", 1)[-1]).lower() if "." in (file.filename or "") else ""
    if ext not in IMG_EXT or not (file.content_type or "").startswith(("image/", "application/octet")):
        raise HTTPException(400, "jen obrázky (jpg/png/webp/gif)")
    data = await file.read()
    if len(data) > MAX_IMG:
        raise HTTPException(413, "obrázek je příliš velký (max 50 MB)")
    IMG_DIR.mkdir(exist_ok=True)
    for e in IMG_EXT:  # staré varianty pryč
        old = IMG_DIR / f"{mid}{e}"
        if old.is_file():
            old.unlink()
    (IMG_DIR / f"{mid}{ext}").write_bytes(data)
    rel = f"bojove/{mid}{ext}"
    m["obrazek"] = rel
    _save(doc)
    _db_upsert(m)
    return {"ok": True, "obrazek": rel}


@router.post("/{mid}/duplikat")
def duplicate_map(mid: str, u: dict = Depends(security.require("editor"))):
    doc = _load()
    m = _find(doc, mid)
    if m is None:
        raise HTTPException(404, "mapa nenalezena")
    ids = {x.get("id") for x in doc.get("mapy", [])}
    base = f"{mid}-kopie"
    nid, i = base, 2
    while nid in ids:
        nid = f"{base}-{i}"
        i += 1
    kopie = json.loads(json.dumps(m, ensure_ascii=False))
    kopie["id"] = nid
    kopie["nazev"] = f"{m.get('nazev', mid)} (kopie)"
    kopie.pop("obrazek", None)
    idx = doc["mapy"].index(m)
    doc["mapy"].insert(idx + 1, kopie)
    _save(doc)
    _db_upsert(kopie)
    return {"ok": True, "id": nid, "mapa": kopie}


@router.get("/assets")
def list_assets(u: dict | None = Depends(security.optional)):
    out = []
    if ASSET_DIR.is_dir():
        for f in sorted(ASSET_DIR.iterdir()):
            if f.suffix.lower() in ASSET_EXT:
                out.append({"id": f"img:assets/{f.name}", "nazev": f.stem,
                            "src": f"/repo/11_Mapy/bojove/assets/{f.name}"})
    return {"assets": out}


@router.post("/assets")
async def upload_asset(file: UploadFile, u: dict = Depends(security.require("editor"))):
    name = file.filename or f"asset-{uuid.uuid4().hex[:6]}"
    ext = ("." + name.rsplit(".", 1)[-1]).lower() if "." in name else ".png"
    if ext not in ASSET_EXT:
        raise HTTPException(400, "nepodporovaný typ souboru")
    data = await file.read()
    if len(data) > MAX_ASSET:
        raise HTTPException(413, "soubor je příliš velký (max 10 MB)")
    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    stem = _slug(name.rsplit(".", 1)[0]) or "asset"
    fn = f"{stem}{ext}"
    i = 2
    while (ASSET_DIR / fn).exists():
        fn = f"{stem}-{i}{ext}"
        i += 1
    (ASSET_DIR / fn).write_bytes(data)
    aid = f"img:{fn}"
    # zapsat do manifestu (custom položka — mapa_assety.py ji při reindexu zachová)
    mf = ASSET_DIR / "assety.json"
    doc2 = {"assety": []}
    if mf.is_file():
        try:
            doc2 = json.loads(mf.read_text(encoding="utf-8", newline=""))
        except ValueError:
            pass
    doc2.setdefault("assety", [e for e in doc2.get("assety", []) if e.get("id") != aid])
    doc2["assety"].append({"id": aid, "nazev": stem, "kategorie": "Vlastní",
                           "src": f"bojove/assets/{fn}", "custom": True})
    mf.write_bytes(json.dumps(doc2, ensure_ascii=False, indent=1).encode("utf-8"))
    return {"ok": True, "id": aid, "src": f"/repo/11_Mapy/bojove/assets/{fn}"}
