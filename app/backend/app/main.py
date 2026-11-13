"""Montelien – FastAPI backend.

Lokálně: uvicorn app.main:app --port 8001 --reload  (z app/backend)
Produkce: v Dockeru na :8000, frontend build se servíruje z app/static.
"""
import asyncio
import contextlib
import logging
import mimetypes
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from . import config, db, seed, security, watchers
from .api import routers
from .ws import hub

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
log = logging.getLogger("montelien")

STATIC = Path(__file__).resolve().parent / "static"


@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    seed.run()
    loop = asyncio.get_running_loop()
    watchers.start(loop)
    yield
    watchers.stop()


app = FastAPI(title="Montelien", lifespan=lifespan)
for r in routers:
    app.include_router(r)


@app.websocket("/api/ws")
async def websocket(ws: WebSocket):
    u = security.get_user(ws.cookies.get(config.COOKIE_NAME))
    if not u:
        await ws.close(code=4401)
        return
    await ws.accept()
    editor = security.can_edit(u)
    con = db.connect()
    try:
        while True:
            msg = await ws.receive_json()
            if msg.get("op") not in ("sub", "unsub"):
                continue
            ch = str(msg.get("channel", ""))[:100]
            allowed = True
            if ch == "repo":
                allowed = editor
            elif ch.startswith("battle:"):
                bid = ch.split(":", 1)[1]
                row = con.execute("SELECT shared FROM battles WHERE id=?", (bid,)).fetchone()
                allowed = editor or bool(row and row["shared"])
            if not allowed:
                await ws.send_json({"channel": ch, "event": "denied"})
                continue
            if msg["op"] == "sub":
                await hub.subscribe(ws, ch)
            else:
                await hub.unsubscribe(ws, ch)
    except WebSocketDisconnect:
        pass
    finally:
        await hub.disconnect(ws)


# --- statika z repa (obrázky, média) – jen čtení, pouze přípony médií ---
MEDIA_EXT = {".webp", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".json", ".pdf",
             ".mp3", ".ogg", ".woff2", ".woff", ".ttf", ".otf", ".js", ".css"}


@app.get("/repo/{path:path}")
async def repo_file(path: str):
    p = (config.ROOT / path).resolve()
    if config.ROOT not in p.parents or not p.is_file() or p.suffix.lower() not in MEDIA_EXT:
        return JSONResponse({"chyba": "nenalezeno"}, 404)
    return FileResponse(p, media_type=mimetypes.guess_type(str(p))[0])


@app.get("/api/health")
def health():
    return {"ok": True, "name": "Montelien"}


# --- frontend build (produkce) ---
if STATIC.is_dir():
    app.mount("/assets", StaticFiles(directory=STATIC / "assets"), name="assets")

    @app.get("/{full:path}")
    async def spa(full: str):
        if full.startswith(("api/", "repo/")):
            return JSONResponse({"chyba": "nenalezeno"}, 404)
        f = STATIC / full
        if full and f.is_file():
            return FileResponse(f)
        return FileResponse(STATIC / "index.html")
