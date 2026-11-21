"""Upload obrázků: portréty postav, ilustrace, tokeny.

Ukládá se do příslušné složky */obrazky/ v repu (formát webp/png/jpg, max 8 MB).
"""
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile

from .. import db, security
from ..config import ROOT

router = APIRouter(prefix="/api/media", tags=["media"])

ALLOWED = {".webp", ".png", ".jpg", ".jpeg", ".gif", ".svg"}
MAX_SIZE = 8 * 1024 * 1024
IMG_DIRS = ("04_Postavy/obrazky", "13_Druhy/obrazky", "14_Povolani/obrazky",
            "15_Podtridy/obrazky", "02_Zeme/obrazky", "03_Mesta/obrazky", "11_Mapy")


@router.post("/upload")
async def upload(file: UploadFile, dir: str = "04_Postavy/obrazky",
                 u: dict = Depends(security.require("editor"))):
    dir = dir.strip("/")
    if dir not in IMG_DIRS and not dir.endswith("/obrazky"):
        raise HTTPException(400, "nepovolená cílová složka")
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED:
        raise HTTPException(400, "nepodporovaný typ souboru")
    data = await file.read()
    if len(data) > MAX_SIZE:
        raise HTTPException(400, "soubor je příliš velký (max 8 MB)")
    name = Path(file.filename or "obrazek" + ext).name
    target = (ROOT / dir / name).resolve()
    if target.parent != (ROOT / dir).resolve():
        raise HTTPException(400, "neplatný název souboru")
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
    rel = target.relative_to(ROOT).as_posix()
    db.audit(u["login"], "media.upload", rel, str(len(data)))
    return {"ok": True, "path": rel, "url": "/repo/" + rel}


# ---------- přílohy entit (libovolný typ souboru) ----------
import mimetypes
import re
import time
import unicodedata

from fastapi.responses import FileResponse

from ..ingest import importer, mirror
from .pages import safe_path

MAX_PRILOHA = 50 * 1024 * 1024
INLINE_MIME = ("image/", "audio/", "video/")
INLINE_EXACT = {"application/pdf", "text/plain"}


def _sanitizuj(filename: str) -> str:
    """Bezpečný název souboru (žádné složky, žádné zvláštní znaky)."""
    name = Path(filename or "priloha").name
    name = unicodedata.normalize("NFKC", name)
    name = re.sub(r"[^\w.\- ()]", "_", name, flags=re.UNICODE).strip(" .")
    return name or "priloha"


def _dir_priloh(entita: Path) -> Path:
    """Složka příloh vedle .md entity: <složka>/prilohy/<slug>."""
    return entita.parent / "prilohy" / importer.slug_of(entita.stem)


def _entita_md(entita: str) -> Path:
    p = safe_path(entita)
    if not p.is_file():
        raise HTTPException(404, "entita nenalezena")
    return p


def _rel(p: Path) -> str:
    return p.resolve().relative_to(ROOT).as_posix()


def _uloz_prilohy(entita_rel: str, prilohy: list, login: str) -> None:
    """Zapíše pole prilohy do entity: DB → mirror do .md → reimport."""
    con = db.connect()
    e = con.execute("SELECT type,data FROM entities WHERE path=?", (entita_rel,)).fetchone()
    if not e:
        raise HTTPException(404, "entita není v indexu")
    data = db.jload(e["data"]) or {}
    data["prilohy"] = prilohy
    key = mirror.type_key_for(e["type"])
    if key:
        mirror.write_frontmatter(entita_rel, key, data)
    con.execute("UPDATE entities SET data=?,updated_at=? WHERE path=?",
                (db.jdump(data), db.now(), entita_rel))
    con.commit()
    importer.reingest([entita_rel])


def _prilohy(entita_rel: str) -> list:
    row = db.connect().execute(
        "SELECT data FROM entities WHERE path=?", (entita_rel,)).fetchone()
    data = (db.jload(row["data"]) or {}) if row else {}
    pr = data.get("prilohy")
    return pr if isinstance(pr, list) else []


@router.post("/prilohy")
async def upload_priloha(file: UploadFile, entita: str, tajne: bool = False,
                         u: dict = Depends(security.require("editor"))):
    """Nahraje přílohu k entitě (libovolný typ, max 50 MB)."""
    md = _entita_md(entita)
    entita_rel = _rel(md)
    data = await file.read()
    if len(data) > MAX_PRILOHA:
        raise HTTPException(400, "soubor je příliš velký (max 50 MB)")
    name = _sanitizuj(file.filename or "")
    target_dir = _dir_priloh(md)
    target_dir.mkdir(parents=True, exist_ok=True)
    target = target_dir / name
    stem, ext = target.stem, target.suffix
    i = 2
    while target.exists():  # kolize → přípona _2, _3…
        target = target_dir / f"{stem}_{i}{ext}"
        i += 1
    target.write_bytes(data)
    cesta = _rel(target)
    pr = _prilohy(entita_rel)
    pr.append({"nazev": name, "cesta": cesta,
               "typ": mimetypes.guess_type(name)[0] or "application/octet-stream",
               "velikost": len(data),
               "pridano": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
               "tajne": bool(tajne)})
    _uloz_prilohy(entita_rel, pr, u["login"])
    db.audit(u["login"], "media.priloha.upload", cesta, str(len(data)))
    return {"ok": True, "cesta": cesta}


@router.delete("/prilohy")
def delete_priloha(entita: str, cesta: str,
                   u: dict = Depends(security.require("editor"))):
    """Smaže přílohu: soubor na disku + záznam v entitě."""
    md = _entita_md(entita)
    entita_rel = _rel(md)
    p = (ROOT / cesta.replace("\\", "/").lstrip("/")).resolve()
    if p != ROOT and ROOT not in p.parents:
        raise HTTPException(400, "cesta mimo repozitář")
    if _dir_priloh(md) not in p.parents:
        raise HTTPException(400, "cesta není příloha této entity")
    pr = _prilohy(entita_rel)
    nove = [a for a in pr if a.get("cesta") != cesta.replace("\\", "/")]
    if len(nove) == len(pr):
        raise HTTPException(404, "příloha nenalezena")
    if p.is_file():
        p.unlink()
    _uloz_prilohy(entita_rel, nove, u["login"])
    db.audit(u["login"], "media.priloha.delete", cesta, "")
    return {"ok": True}


@router.get("/prilohy/{path:path}")
def get_priloha(path: str, u: dict = Depends(security.require("player"))):
    """Stažení přílohy (jen přihlášení; `tajne` přílohy jen pro editory)."""
    rel = path.replace("\\", "/").lstrip("/")
    p = (ROOT / rel).resolve()
    if p == ROOT or ROOT not in p.parents or not p.is_file():
        raise HTTPException(404, "příloha nenalezena")
    parts = p.relative_to(ROOT).parts
    if "prilohy" not in parts:
        raise HTTPException(400, "soubor není ve složce příloh")
    # tajné přílohy – ověřit v záznamu vlastnící entity
    idx = parts.index("prilohy")
    ent_dir = ROOT.joinpath(*parts[:idx])
    slug_dir = parts[idx + 1] if idx + 1 < len(parts) else ""
    md = next((f for f in ent_dir.glob("*.md")
               if importer.slug_of(f.stem) == slug_dir), None)
    if md:
        for a in _prilohy(_rel(md)):
            if a.get("cesta") == rel and a.get("tajne") and not security.can_edit(u):
                raise HTTPException(404, "příloha nenalezena")
    mime = mimetypes.guess_type(p.name)[0] or "application/octet-stream"
    # SVG se nikdy nezobrazuje inline – same-origin XSS vektor
    inline = (any(mime.startswith(t) for t in INLINE_MIME) or mime in INLINE_EXACT) \
        and mime != "image/svg+xml"
    headers = {"X-Content-Type-Options": "nosniff"}
    if not inline:
        headers["Content-Disposition"] = f'attachment; filename="{p.name}"'
    return FileResponse(p, media_type=mime, headers=headers,
                        filename=p.name if not inline else None)
