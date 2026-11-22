import asyncio
import sys
import threading

import pytest
from watchdog.events import (
    DirModifiedEvent, FileCreatedEvent, FileDeletedEvent, FileModifiedEvent,
    FileMovedEvent, FileOpenedEvent, FileClosedEvent, FileClosedNoWriteEvent,
)
from watchdog.observers import Observer

from app import watchers


@pytest.mark.parametrize("event", [FileOpenedEvent, FileClosedEvent, FileClosedNoWriteEvent, DirModifiedEvent])
def test_ignores_read_and_directory_events(monkeypatch, event):
    handler = watchers._Handler(asyncio.new_event_loop())
    armed = []
    monkeypatch.setattr(handler, "_arm", lambda: armed.append(True))
    try:
        handler.dispatch(event(str(watchers.ROOT / "11_Mapy" / "test.json")))
        assert not armed
        assert not handler.pending
    finally:
        handler.loop.close()


@pytest.mark.parametrize("event", [FileCreatedEvent, FileModifiedEvent, FileDeletedEvent])
def test_write_events_are_debounced(monkeypatch, event):
    handler = watchers._Handler(asyncio.new_event_loop())
    armed = []
    monkeypatch.setattr(handler, "_arm", lambda: armed.append(True))
    try:
        for _ in range(3):
            handler.dispatch(event(str(watchers.ROOT / "11_Mapy" / "test.json")))
        assert handler.pending == {"11_Mapy/test.json"}
        assert len(armed) == 3
    finally:
        handler.loop.close()


def test_moves_cover_both_paths_and_ignore_unrelated_files(monkeypatch):
    handler = watchers._Handler(asyncio.new_event_loop())
    monkeypatch.setattr(handler, "_arm", lambda: None)
    try:
        handler.dispatch(FileMovedEvent(str(watchers.ROOT / "11_Mapy/a.json"),
                                        str(watchers.ROOT / "11_Mapy/b.json")))
        handler.dispatch(FileModifiedEvent(str(watchers.ROOT / "node_modules/test.json")))
        assert handler.pending == {"11_Mapy/a.json", "11_Mapy/b.json"}
    finally:
        handler.loop.close()


@pytest.mark.skipif(sys.platform != "linux", reason="Linux inotify read events")
def test_linux_read_does_not_schedule_reingest(monkeypatch, tmp_path):
    monkeypatch.setattr(watchers, "ROOT", tmp_path)
    folder = tmp_path / "11_Mapy"
    folder.mkdir()
    source = folder / "test.json"
    source.write_text("{}")
    opened, closed, modified = threading.Event(), threading.Event(), threading.Event()

    class Handler(watchers._Handler):
        def on_any_event(self, event):
            super().on_any_event(event)
            if event.event_type == "opened":
                opened.set()
            if event.event_type == "closed_no_write":
                closed.set()
            if event.event_type == "modified" and not event.is_directory:
                modified.set()

    handler = Handler(asyncio.new_event_loop())
    armed = []
    monkeypatch.setattr(handler, "_arm", lambda: armed.append(True))
    observer = Observer()
    observer.schedule(handler, str(folder))
    observer.start()
    try:
        assert source.read_text() == "{}"
        assert opened.wait(3) and closed.wait(3)
        assert not armed
        assert not handler.pending
        source.write_text('{"changed":true}')
        assert modified.wait(3)
        assert armed
        assert handler.pending == {"11_Mapy/test.json"}
    finally:
        observer.stop()
        observer.join(3)
        handler.loop.close()
