# car/ — the simulated car

A mock 2014 compact inline-4 behind an OBD-II-shaped set of tools. State lives in `car/state.json` (created on first write; the default is `misfire_before_swap`). Every process reads it fresh, so the CLI, the MCP server and the backend always agree.

| tool | reads |
| --- | --- |
| `get_status()` | check-engine light, code count, rpm, speed, coolant, engine running, scenario |
| `read_dtcs()` | stored codes with descriptions |
| `read_pid(name)` | RPM, SPEED, COOLANT_TEMP, SHORT_FUEL_TRIM_1, LONG_FUEL_TRIM_1, THROTTLE_POS |
| `misfire_counts()` | per-cylinder misfire counters |
| `freeze_frame()` | the snapshot stored when the code set |
| `events()` | engine_stall or airbag_deployed since the scenario was set |
| `set_scenario(name)` | demo only: `misfire_before_swap`, `misfire_after_swap`, `stall`, `crash`, `ok` |
| `apply_action(name)` | `swap_coils_1_2`, `engine_off`, `engine_on` |

```bash
.venv/bin/python -m car.cli get_status
.venv/bin/python -m car.cli set_scenario crash
.venv/bin/python -m car.cli events
```

MCP server (stdio), so any Claude client can talk to the car:

```bash
claude mcp add car -- /Users/duashmi/Documents/Anthropic-Hack/pit-crew/.venv/bin/python -m car.server
```

## more scenarios (small fixes and warnings that are not a misfire)

`get_status()` also returns `warnings` (list: temperature, tire_pressure, charging) and `battery_v` (12.6 unless the scenario says otherwise).

| scenario | light | codes | warnings | other |
| --- | --- | --- | --- | --- |
| overheating | on | P0217 engine coolant over temperature | temperature | coolant 118 C |
| gas_cap | on, steady | P0457 evaporative leak, fuel cap loose or off | none | the fix is tightening the cap |
| flat_tire | off | none | tire_pressure | |
| weak_battery | off | P0562 system voltage low | charging | battery_v 11.6 |
