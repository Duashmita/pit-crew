"""triage bridge: the prolog rulebook makes the call. json in on stdin, json out on stdout, via swipl."""
import json
import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
SWIPL = shutil.which("swipl") or "/opt/homebrew/bin/swipl"


def _run(file: str, payload: dict) -> dict:
    p = subprocess.run(
        [SWIPL, "-q", "-g", f"{file[:-3]}:main", "-t", "halt", str(HERE / file)],
        input=json.dumps(payload), capture_output=True, text=True, timeout=10,
    )
    if p.returncode != 0 or not p.stdout.strip():
        raise RuntimeError(f"{file}: {p.stderr.strip() or 'no output'}")
    return json.loads(p.stdout)


def triage(input: dict) -> dict:
    """car signals + her words in, the call and the rule that fired out. unknown counts as unsafe."""
    return _run("triage.pl", input)


def check_spec(spec: dict) -> dict:
    """does a step spec carry the precautions its parts require? approved/missing/required."""
    return _run("gate.pl", spec)


if __name__ == "__main__":
    if len(sys.argv) != 3 or sys.argv[1] not in ("triage", "gate"):
        sys.exit("usage: python -m triage.run triage|gate '<json>'")
    fn = triage if sys.argv[1] == "triage" else check_spec
    print(json.dumps(fn(json.loads(sys.argv[2]))))
