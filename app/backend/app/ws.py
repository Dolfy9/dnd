"""WebSocket hub: kanály pro změny repozitáře a živé boje.

Klient se přihlásí na /api/ws a posílá {"op":"sub","channel":"repo"} /
{"op":"sub","channel":"battle:<id>"} / {"op":"unsub","channel":…}.
Server vysílá {"channel":…,"event":…,"data":…}. Připojení bez přihlášení → player scope:
nedostává tajné kanály (repo dostává jen pokud má editor+ roli? – repo eventy neobsahují
tajná data, jen informaci "změněno", takže je posíláme všem přihlášeným).
"""
import asyncio
import json
import logging
from typing import Optional

from fastapi import WebSocket

from . import db

log = logging.getLogger("montelien.ws")


class Hub:
    def __init__(self) -> None:
        self._subs: dict[str, set[WebSocket]] = {}
        self._lock = asyncio.Lock()
        self._editors: dict[WebSocket, bool] = {}

    async def subscribe(self, ws: WebSocket, channel: str, *, editor: bool = False) -> None:
        async with self._lock:
            self._editors[ws] = editor
            self._subs.setdefault(channel, set()).add(ws)

    async def unsubscribe(self, ws: WebSocket, channel: str) -> None:
        async with self._lock:
            if channel in self._subs:
                self._subs[channel].discard(ws)

    async def disconnect(self, ws: WebSocket) -> None:
        async with self._lock:
            self._editors.pop(ws, None)
            for subs in self._subs.values():
                subs.discard(ws)

    async def broadcast(self, channel: str, event: str, data: Optional[dict] = None) -> None:
        msg = json.dumps({"channel": channel, "event": event, "data": data or {}},
                         ensure_ascii=False)
        async with self._lock:
            if channel.startswith("battle:"):
                row = db.connect().execute("SELECT shared FROM battles WHERE id=?", (channel.split(":", 1)[1],)).fetchone()
                if not row or not row["shared"]:
                    subs = self._subs.get(channel, set())
                    subs.difference_update(ws for ws in list(subs) if not self._editors.get(ws, False))
            targets = list(self._subs.get(channel, ()))
        for ws in targets:
            try:
                await ws.send_text(msg)
            except Exception:
                await self.disconnect(ws)


hub = Hub()
