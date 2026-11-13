"""Graf vazeb: okolí entity/stránky (2 hoppy), přehled pro grafický náhled."""
from fastapi import APIRouter, Depends, HTTPException

from .. import db, render, security

router = APIRouter(prefix="/api/graph", tags=["graph"])


@router.get("/neighborhood")
def neighborhood(path: str = "", entity: int = 0, u: dict | None = Depends(security.optional)):
    con = db.connect()
    if entity:
        row = con.execute("SELECT path FROM entities WHERE id=?", (entity,)).fetchone()
        if not row:
            raise HTTPException(404, "entita nenalezena")
        path = row["path"]
    if not path:
        raise HTTPException(400, "chybí path nebo entity")
    editor = security.can_edit(u)

    def page(path_):
        return con.execute("SELECT path,title,type,secret FROM pages WHERE path=?", (path_,)).fetchone()

    nodes: dict[str, dict] = {}
    edges: list[dict] = []
    seen = {path}
    frontier = [path]
    for hop in range(2):
        nxt = []
        for src in frontier:
            rows = con.execute(
                "SELECT src,dst,kind FROM links WHERE src=? OR dst=?", (src, src)).fetchall()
            for r in rows:
                other = r["dst"] if r["src"] == src else r["src"]
                p = page(other)
                if not p or (p["secret"] and not editor):
                    continue
                nodes[other] = {"id": other, "title": p["title"], "type": p["type"],
                                "url": render.page_url(other)}
                direction = "out" if r["src"] == src else "in"
                edges.append({"src": r["src"], "dst": r["dst"], "kind": r["kind"], "dir": direction})
                if other not in seen:
                    seen.add(other)
                    nxt.append(other)
        frontier = nxt
    center = page(path)
    nodes[path] = {"id": path, "title": center["title"] if center else path,
                   "type": center["type"] if center else "stranka",
                   "url": render.page_url(path), "center": True}
    return {"nodes": list(nodes.values()), "edges": edges}


@router.get("/stats")
def stats(u: dict = Depends(security.require("editor"))):
    con = db.connect()
    out = {}
    for t, in con.execute("SELECT type FROM pages GROUP BY type"):
        out[t] = con.execute("SELECT count(*) c FROM pages WHERE type=?", (t,)).fetchone()["c"]
    edges = {k: con.execute("SELECT count(*) c FROM links WHERE kind=?", (k,)).fetchone()["c"]
             for k in ("link", "fm", "mention")}
    orphans = con.execute(
        "SELECT p.path,p.title FROM pages p WHERE p.type!='stranka' AND p.path!='README.md'"
        " AND NOT EXISTS(SELECT 1 FROM links l WHERE l.dst=p.path OR l.src=p.path)"
        " ORDER BY p.title LIMIT 200").fetchall()
    return {"pages_by_type": out, "edges": edges,
            "orphans": [dict(o) for o in orphans]}
