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
