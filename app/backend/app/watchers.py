"""Sledování repozitáře: watchdog → debounce → reingest → WS broadcast.

Píše-li změny aplikace sama (mirror, uložení stránky), watcher změnu také zachytí –
reimport je idempotentní. Debounce slučuje dávky (mkdocs build, git checkout…).
"""
import asyncio
import logging
import threading
import time
from pathlib import Path

from watchdog.events import FileSystemEventHandler
from watchdog.observers import Observer

from .config import CONTENT_DIRS, ROOT, ROOT_FILES
from .ingest import importer
from .ws import hub

log = logging.getLogger("montelien.watch")
WATCH_SUFFIXES = (".md", ".json")
WATCH_JSON_DIRS = ("11_Mapy",)  # mimo .md sledujeme jen json v mapách a web/assets
WATCH_JSON_EXTRA = ("web/assets/", "tools/heraldika.json")


class _Handler(FileSystemEventHandler):
    def __init__(self, loop: asyncio.AbstractEventLoop):
        self.loop = loop
        self.pending: set[str] = set()
        self.timer: threading.Timer | None = None
        self.lock = threading.Lock()

    def _accept(self, path: str) -> str | None:
        p = Path(path)
        try:
            rel = p.relative_to(ROOT).as_posix()
        except ValueError:
            return None
        first = rel.split("/", 1)[0]
        if rel.endswith(".md") and (first in CONTENT_DIRS or rel in ROOT_FILES):
            return rel
        if rel.endswith(".json") and (rel.startswith(WATCH_JSON_DIRS) or
                                     rel.startswith("web/assets/") or
                                     rel == "tools/heraldika.json"):
            return rel
        return None

    def on_any_event(self, event):
        if event.is_directory:
            return
        for src in ({event.src_path} | ({getattr(event, "dest_path", "")} if getattr(event, "dest_path", "") else set())):
            rel = self._accept(src)
            if rel:
                with self.lock:
                    self.pending.add(rel)
                self._arm()

    def _arm(self):
        with self.lock:
            if self.timer:
                self.timer.cancel()
            self.timer = threading.Timer(0.8, self._flush)
            self.timer.daemon = True
            self.timer.start()

    def _flush(self):
        with self.lock:
            paths = sorted(self.pending)
            self.pending.clear()
        asyncio.run_coroutine_threadsafe(self._apply(paths), self.loop)

    async def _apply(self, paths: list[str]):
        try:
            stats = importer.reingest(paths)
            removed = [p for p in paths if not (ROOT / p).exists()]
            for p in removed:
                importer.delete_page(p)
            await hub.broadcast("repo", "changed", {"paths": paths, "stats": stats})
        except Exception:
            log.exception("reingest selhal")


_observer: Observer | None = None


def start(loop: asyncio.AbstractEventLoop) -> None:
    global _observer
    if _observer:
        return
    _observer = Observer()
    _observer.schedule(_Handler(loop), str(ROOT), recursive=True)
    _observer.daemon = True
    _observer.start()
    log.info("watching %s", ROOT)


def stop() -> None:
    global _observer
    if _observer:
        _observer.stop()
        _observer.join(timeout=3)
        _observer = None
