from app.api import battles


def test_player_view_treats_null_imported_source_arrays_as_empty(monkeypatch):
    class Connection:
        def execute(self, *args):
            return self

        def fetchone(self):
            return {"data": '{"svetla":null,"objekty":null}'}

    monkeypatch.setattr(battles.db, "connect", lambda: Connection())
    assert battles.player_view({"stav_boje": {"map": "nullable", "lights": []}})["stav_boje"]["lights"] == []
