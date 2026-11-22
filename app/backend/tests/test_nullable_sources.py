from app.api import battles


def test_nullable_imported_source_arrays_do_not_crash(monkeypatch):
    class Connection:
        def execute(self, *args):
            return self

        def fetchone(self):
            return {"data": '{"svetla":null,"objekty":null}'}

    monkeypatch.setattr(battles.db, "connect", lambda: Connection())
    assert battles.player_view({"mapa": "null-map", "stav_boje": {"tok": [], "lights": []}})["stav_boje"]["lights"] == []
