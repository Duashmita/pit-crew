"""python -m car.cli <tool> [arg]  -> one line of json"""
import json
import sys

from car import mock

TOOLS = {n: getattr(mock, n) for n in ("get_status", "read_dtcs", "read_pid", "misfire_counts", "freeze_frame", "events", "set_scenario", "apply_action")}


def main(argv: list[str]) -> int:
    try:
        out = TOOLS[argv[0]](*argv[1:2])
    except (IndexError, KeyError, TypeError):
        out = {"error": "usage: python -m car.cli <tool> [arg]", "tools": list(TOOLS)}
    print(json.dumps(out))
    return 0 if "error" not in out else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
