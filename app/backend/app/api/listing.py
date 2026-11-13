"""Server-side filtrování, řazení a stránkování seznamů.

Parametry: q (fulltext nad vybranými poli), sort (klíč položky nebo "d.klíč"
pro rules data), order (asc|desc), page (1..n), size (položek na stránku).
"""
from typing import Any, Iterable


def _text(v: Any) -> str:
    if isinstance(v, (list, tuple)):
        return " ".join(_text(x) for x in v)
    if isinstance(v, dict):
        return " ".join(_text(x) for x in v.values())
    return "" if v is None else str(v)


def _sort_key(item: dict, sort: str):
    v: Any = item
    for part in sort.split("."):
        if isinstance(v, dict):
            v = v.get(part)
        else:
            v = None
            break
    if v is None:
        # rules položky: data.<klíč>
        v = (item.get("data") or {}).get(sort)
    if isinstance(v, (int, float)):
        return (0, v)
    return (1, str(v or "").lower())


def paginate(items: Iterable[dict], q: str = "", q_fields: tuple = ("name",),
             sort: str = "name", order: str = "asc", page: int = 1, size: int = 0) -> dict:
    items = list(items)
    if q:
        n = q.lower()
        items = [it for it in items
                 if n in " ".join(_text(it.get(f)) for f in q_fields).lower()
                 or n in _text(it).lower()]
    total = len(items)
    if sort:
        items.sort(key=lambda it: _sort_key(it, sort), reverse=(order == "desc"))
    if size and size > 0:
        start = (max(1, page) - 1) * size
        items = items[start:start + size]
    pages = max(1, -(-total // size)) if size else 1
    return {"items": items, "total": total, "page": page, "pages": pages}
