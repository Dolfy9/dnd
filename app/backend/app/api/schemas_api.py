"""Schémata entit – čtení a úprava (admin)."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from .. import schemas, security
from ..config import TYPE_LABELS

router = APIRouter(prefix="/api/schemas", tags=["schemas"])


@router.get("")
def list_schemas(u: dict | None = Depends(security.optional)):
    out = []
    for f in sorted(schemas.SCHEMA_DIR.glob("*.json")) if schemas.SCHEMA_DIR.is_dir() else []:
        s = schemas.schema_for(f.stem)
        n = sum(len(sec.get("fields", [])) for sec in s.get("sections", []))
        out.append({"type": f.stem, "label": s.get("label") or TYPE_LABELS.get(f.stem, f.stem),
                    "fields": n, "sections": len(s.get("sections", []))})
    return {"items": out}


@router.get("/{type_}")
def get_schema(type_: str, u: dict | None = Depends(security.optional)):
    s = schemas.schema_for(type_)
    if not s.get("sections") and type_ not in TYPE_LABELS:
        raise HTTPException(404, "neznámý typ")
    return s


class SchemaBody(BaseModel):
    data: dict


@router.put("/{type_}")
def put_schema(type_: str, b: SchemaBody, u: dict = Depends(security.require("admin"))):
    if not isinstance(b.data.get("sections", []), list):
        raise HTTPException(400, "sections musí být seznam")
    b.data.setdefault("type", type_)
    schemas.save_schema(type_, b.data)
    return {"ok": True}
