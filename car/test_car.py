import pytest

from car import mock


@pytest.fixture(autouse=True)
def tmp_state(tmp_path, monkeypatch):
    monkeypatch.setattr(mock, "STATE_PATH", tmp_path / "state.json")


def test_default_is_misfire_before_swap():
    s = mock.get_status()
    assert s["mil_on"] and s["dtc_count"] == 1 and s["engine_running"] and 710 <= s["rpm"] <= 770
    assert s["scenario"] == "misfire_before_swap" and s["coolant_c"] == 92
    assert mock.read_dtcs() == [{"code": "P0301", "desc": "cylinder 1 misfire detected"}]
    assert mock.misfire_counts() == {"1": 12, "2": 0, "3": 0, "4": 0}
    assert mock.freeze_frame()["code"] == "P0301"


def test_after_swap():
    assert mock.set_scenario("misfire_after_swap") == {"scenario": "misfire_after_swap"}
    assert mock.read_dtcs() == [{"code": "P0302", "desc": "cylinder 2 misfire detected"}]
    assert mock.misfire_counts() == {"1": 0, "2": 11, "3": 0, "4": 0}


def test_stall_and_crash_events():
    mock.set_scenario("stall")
    e = mock.events()
    assert e[0]["type"] == "engine_stall" and e[0]["speed_kph"] == 45 and e[0]["at"]
    st = mock.get_status()
    assert st["engine_running"] is False and st["rpm"] == 0 and st["mil_on"]
    mock.set_scenario("crash")
    assert mock.events()[0]["type"] == "airbag_deployed"
    assert mock.get_status()["engine_running"] is False


def test_actions():
    assert mock.apply_action("swap_coils_1_2")["scenario"] == "misfire_after_swap"
    assert mock.read_dtcs()[0]["code"] == "P0302"
    st = mock.apply_action("engine_off")
    assert st["engine_running"] is False and st["rpm"] == 0
    assert mock.apply_action("engine_on")["engine_running"] is True
    assert mock.apply_action("nope")["error"] == "unknown action"


def test_ok_and_errors():
    mock.set_scenario("ok")
    assert mock.read_dtcs() == [] and mock.get_status()["mil_on"] is False and mock.events() == []
    assert mock.misfire_counts() == {"1": 0, "2": 0, "3": 0, "4": 0}
    assert mock.set_scenario("nope")["error"] == "unknown scenario"
    assert mock.read_pid("NOPE") == {"error": "unknown pid"}
    assert mock.read_pid("COOLANT_TEMP") == {"name": "COOLANT_TEMP", "value": 90, "unit": "C"}


def test_small_fix_scenarios():
    mock.set_scenario("overheating")
    st = mock.get_status()
    assert st["mil_on"] and st["coolant_c"] == 118 and st["warnings"] == ["temperature"] and st["battery_v"] == 12.6
    assert mock.read_dtcs()[0]["code"] == "P0217" and mock.freeze_frame()["code"] == "P0217"
    mock.set_scenario("gas_cap")
    assert mock.get_status()["mil_on"] and mock.read_dtcs()[0]["code"] == "P0457" and mock.get_status()["warnings"] == []
    mock.set_scenario("flat_tire")
    assert mock.get_status()["mil_on"] is False and mock.read_dtcs() == [] and mock.get_status()["warnings"] == ["tire_pressure"]
    mock.set_scenario("weak_battery")
    st = mock.get_status()
    assert st["mil_on"] is False and st["battery_v"] == 11.6 and st["warnings"] == ["charging"] and mock.read_dtcs()[0]["code"] == "P0562"
    assert mock.misfire_counts() == {"1": 0, "2": 0, "3": 0, "4": 0}
