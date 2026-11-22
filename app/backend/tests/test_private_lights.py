import copy
import json

from app.api.battle_maps import strip_for_player
from app.api.battles import player_view


def test_private_light_definitions_do_not_reach_players():
    secret = {"id": "secret-lamp", "nazev": "Secret altar", "x": 2.5, "y": 1.5,
              "bright": 20, "dim": 10, "dmOnly": True}
    public = {"id": "public-lamp", "x": 4, "y": 1, "bright": 10, "dim": 0}
    original = {"svetla": [secret, public]}
    assert strip_for_player(original)["svetla"] == [public]
    assert original["svetla"] == [secret, public]
    state = {"stav_boje": {"tok": [], "log": [], "lights": [
        {**secret, "anchor": [2.5, 1.5]}, {**public, "anchor": [4, 1]}],
        "zdroje": {"secret-lamp": True, "public-lamp": False},
        "privateSourceIds": ["secret-lamp"], "lightCells": {"2,1": "bright", "3,1": "dim", "4,1": "dark"}}}
    before = copy.deepcopy(state)
    result = player_view(state)["stav_boje"]
    assert [l["id"] for l in result["lights"]] == ["public-lamp"]
    assert result["playerLightCells"] == state["stav_boje"]["lightCells"]
    assert "secret-lamp" not in json.dumps(result)
    assert "Secret altar" not in json.dumps(result)
    assert "lightCells" not in result and "privateSourceIds" not in result
    assert state == before


def test_empty_private_light_payload_is_safe():
    assert strip_for_player({}) == {}
    assert player_view({"stav_boje": {"tok": [], "log": []}})["stav_boje"].get("lights", []) == []


def test_battle_private_light_is_not_a_public_definition():
    state = {"stav_boje": {"tok": [], "lights": [{"id": "hidden", "dmOnly": True}]}}
    assert player_view(state)["stav_boje"]["lights"] == []


def test_public_illumination_does_not_reveal_unseen_rooms_or_invalid_levels():
    state = {"stav_boje": {"tok": [], "fog": {"on": True, "revealed": {"0,0": 1, "1,0": 1}, "visible": {"0,0": 1}},
                           "lightCells": {"0,0": "bright", "1,0": "dim", "2,0": "dark", "3,0": "invalid"}}}
    assert player_view(state)["stav_boje"]["playerLightCells"] == {"0,0": "bright"}
