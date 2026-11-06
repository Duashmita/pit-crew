"""mcp stdio server: the car's computer. run with `python -m car.server`; any mcp client can talk to it."""
from mcp.server.mcpserver import MCPServer

from car import mock

mcp = MCPServer("car", instructions="A simulated 2014 compact inline-4 car's OBD-II port. Read the warning lights, stored codes, freeze frame, live data and per-cylinder misfire counters. Nothing here is a real vehicle.")


@mcp.tool()
def get_status() -> dict:
    """Warning-light and engine summary: check-engine light on (mil_on), stored code count, rpm, speed, coolant temperature, whether the engine is running."""
    return mock.get_status()


@mcp.tool()
def read_dtcs() -> list:
    """Stored diagnostic trouble codes with plain-language descriptions, e.g. P0301 cylinder 1 misfire detected."""
    return mock.read_dtcs()


@mcp.tool()
def read_pid(name: str) -> dict:
    """One live OBD-II value. Names: RPM, SPEED, COOLANT_TEMP, SHORT_FUEL_TRIM_1, LONG_FUEL_TRIM_1, THROTTLE_POS."""
    return mock.read_pid(name)


@mcp.tool()
def misfire_counts() -> dict:
    """Per-cylinder misfire counters (mode 06) for cylinders 1 to 4 since the last reset."""
    return mock.misfire_counts()


@mcp.tool()
def freeze_frame() -> dict:
    """The snapshot the car stored at the moment the code set: rpm, speed, coolant temperature, engine load."""
    return mock.freeze_frame()


@mcp.tool()
def events() -> list:
    """Safety events since the last read: engine_stall (with speed) or airbag_deployed. Empty when nothing happened."""
    return mock.events()


@mcp.tool()
def set_scenario(name: str) -> dict:
    """Demo only: put the simulated car into a scenario: misfire_before_swap, misfire_after_swap, stall, crash, ok."""
    return mock.set_scenario(name)


@mcp.tool()
def apply_action(name: str) -> dict:
    """Tell the car something was done to it: swap_coils_1_2 (moves the misfire with the coil), engine_off, engine_on. Returns the new status."""
    return mock.apply_action(name)


if __name__ == "__main__":
    mcp.run()
