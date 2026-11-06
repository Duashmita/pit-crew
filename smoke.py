"""smoke: one PASS/FAIL line per feature number in ../pit-crew-features.md.
offline by default (DIAGNOSE_MODE=fixture); the backend runs on SMOKE_PORT (8002) for the duration. under 90 s."""
import json
import os
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PY = str(ROOT / ".venv/bin/python")
PORT = int(os.environ.get("SMOKE_PORT", "8002"))
BASE = f"http://127.0.0.1:{PORT}"
SPEC = {"id": "swap-coils-1-2", "title": "swap the coils on cylinders 1 and 2", "parts": ["coil 1", "coil 2", "coil connectors", "coil bolts"],
        "actions": [{"verb": "unclip", "target": "coil 1 connector"}, {"verb": "swap", "target": "coil 1 and coil 2"}],
        "tools": ["10 mm socket"], "precautions": ["engine_off", "engine_cool"], "expect": "misfire moves to cylinder 2"}
results: list[tuple[str, str, bool, str]] = []
sse_events: list[dict] = []


def check(fid: str, label: str, fn) -> None:
    try:
        fn()
        results.append((fid, label, True, ""))
        print(f"smoke {fid:<4} {label:<60} PASS", flush=True)
    except Exception as e:  # noqa: BLE001
        msg = str(e).replace("\n", " ")[:140]
        results.append((fid, label, False, msg))
        print(f"smoke {fid:<4} {label:<60} FAIL  {msg}", flush=True)


def http(method: str, path: str, body=None, timeout: float = 30):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method, headers={"content-type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        raw = r.read()
        return json.loads(raw) if raw else None


def cli(tool: str, arg: str | None = None):
    cmd = [PY, "-m", "car.cli", tool] + ([arg] if arg else [])
    out = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True, timeout=15)
    if out.returncode:
        raise RuntimeError(out.stderr.strip()[-200:] or "cli failed")
    return json.loads(out.stdout.strip().splitlines()[-1])


def expect(cond: bool, msg: str) -> None:
    if not cond:
        raise AssertionError(msg)


def listen_sse() -> None:
    try:
        with urllib.request.urlopen(BASE + "/api/events", timeout=120) as r:
            for line in r:
                if line.startswith(b"data:"):
                    try:
                        sse_events.append(json.loads(line[5:].strip()))
                    except json.JSONDecodeError:
                        pass
    except Exception:  # noqa: BLE001
        pass


def wait_for(pred, seconds: float):
    end = time.time() + seconds
    while time.time() < end:
        hit = [e for e in sse_events if pred(e)]
        if hit:
            return hit[-1]
        time.sleep(0.1)
    return None


def main() -> None:
    t0 = time.time()
    env = dict(os.environ)
    env.setdefault("DIAGNOSE_MODE", "fixture")
    env.setdefault("ALERT_COUNTDOWN_S", "1")
    server = subprocess.Popen([PY, "-m", "uvicorn", "agent.app:app", "--port", str(PORT), "--log-level", "warning"],
                              cwd=ROOT, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(80):
            try:
                http("GET", "/api/health", timeout=2)
                break
            except Exception:  # noqa: BLE001
                time.sleep(0.25)
        else:
            print("smoke: backend did not start on", PORT)
            sys.exit(1)
        threading.Thread(target=listen_sse, daemon=True).start()
        time.sleep(0.3)
        cli("set_scenario", "misfire_before_swap")

        def a2():
            d = cli("read_dtcs"); c = cli("misfire_counts")
            expect(d and d[0]["code"] == "P0301", f"dtcs {d}")
            expect(c.get("1", 0) > 0 and c.get("2", 0) == 0, f"counts {c}")
        check("A2", "car: misfire_before_swap -> P0301, counts on cyl 1", a2)

        def a3():
            cli("set_scenario", "misfire_after_swap")
            d = cli("read_dtcs"); c = cli("misfire_counts")
            cli("set_scenario", "misfire_before_swap")
            expect(d and d[0]["code"] == "P0302", f"dtcs {d}")
            expect(c.get("2", 0) > 0 and c.get("1", 0) == 0, f"counts {c}")
        check("A3", "car: misfire_after_swap -> P0302, counts on cyl 2", a3)

        def b1():
            out = subprocess.run(["swipl", "-g", "run_tests", "-t", "halt", "triage/test_triage.pl"], cwd=ROOT, capture_output=True, text=True, timeout=30)
            txt = out.stdout + out.stderr
            expect(out.returncode == 0 and "failed" not in txt.lower(), txt.strip()[-160:])
        check("B1", "triage: plunit green", b1)

        def b2():
            r = http("POST", "/api/triage", {"mil_on": True, "flashing": "yes", "dtcs": ["P0301"]})
            expect(r["call"] in ("stop_now", "short_trip_only"), f"call {r.get('call')}")
            expect(r.get("rule") and r.get("cite", {}).get("url"), f"rule/cite {r}")
        check("B2", "triage: flashing + P0301 -> not ok_to_drive, rule + source", b2)

        def b3():
            r = http("POST", "/api/triage", {"mil_on": True, "flashing": "unknown", "dtcs": ["P0301"]})
            expect(r["call"] != "ok_to_drive" and r.get("unknowns"), f"{r}")
        check("B3", "triage: flashing unknown -> unsafe, unknown listed", b3)

        def b4():
            r = http("POST", "/api/triage", {"mil_on": True, "flashing": "no", "dtcs": []})
            expect(r["call"] == "ok_to_drive", f"call {r.get('call')}")
        check("B4", "triage: steady light only -> ok_to_drive", b4)

        def b5():
            ok = http("POST", "/api/gate", SPEC)
            bare = http("POST", "/api/gate", dict(SPEC, precautions=[]))
            expect(ok["approved"] is True, f"full spec {ok}")
            expect(bare["approved"] is False and {"engine_off", "engine_cool"} <= set(bare["missing"]), f"bare spec {bare}")
        check("B5", "gate: full spec approved, bare spec rejected", b5)

        diag: dict = {}

        def c1():
            t = time.time()
            r = http("POST", "/api/diagnose", {"words": "it's shaking and the light is blinking", "delay_ms": 0}, timeout=80)
            diag["events"] = r["events"]; diag["secs"] = time.time() - t
            types = [e["type"] for e in r["events"]]
            expect(types.count("tool_call") >= 2, f"tool calls {types}")
            order = [types.index(k) for k in ("tool_call", "triage", "diagnosis", "step", "done") if k in types]
            expect(len(order) == 5 and order == sorted(order), f"order {types}")
        check("C1", "agent: tool calls -> triage -> diagnosis -> step -> done", c1)

        def c2():
            d = next(e for e in diag["events"] if e["type"] == "diagnosis")
            expect("coil" in d["causes"][0]["cause"].lower(), f"top cause {d['causes'][0]}")
        check("C2", "agent: top cause is the coil, with evidence", c2)

        def c3():
            s = next(e for e in diag["events"] if e["type"] == "step")
            expect(s["spec"]["id"] == "swap-coils-1-2" and s["gate"]["approved"], f"{s}")
        check("C3", "agent: cheapest test is swap-coils-1-2, gate approved", c3)

        def c5():
            r = http("POST", "/api/did-it", {"step": "swap-coils-1-2", "delay_ms": 0}, timeout=80)
            car = http("GET", "/api/car")
            d = next(e for e in r["events"] if e["type"] == "diagnosis")
            cli("set_scenario", "misfire_before_swap")
            expect(car["dtcs"][0]["code"] == "P0302" and car["misfire_counts"].get("2", 0) > 0, f"car {car['dtcs']} {car['misfire_counts']}")
            expect("coil" in d["summary"].lower() and d["causes"][0]["confidence"] >= 0.9, f"after-swap diagnosis {d}")
        check("C5", "loop: did-it -> car P0302, diagnosis names the coil", c5)

        check("C6", "fixture replay under 5 s", lambda: expect(diag.get("secs", 99) < 5 or env["DIAGNOSE_MODE"] == "live", f"{diag.get('secs')}s"))

        check("D1", "friends: Priya in the list", lambda: expect(any(f["name"] == "Priya" for f in http("GET", "/api/friends")), "no Priya"))

        def d3():
            a = http("POST", "/api/alerts", {"trigger": "sos", "include_location": True})
            expect(a["status"] == "delivered" and "Priya" in a["to"], f"{a}")
            expect(a["location"] and "lat" in a["location"], f"location {a.get('location')}")
        check("D3", "alert: sos -> delivered to Priya with location", d3)

        def d4():
            before = len(http("GET", "/api/alerts"))
            cli("set_scenario", "crash")
            ev = wait_for(lambda e: e.get("type") == "car_event", 4)
            expect(ev is not None, "no car_event within 4 s")
            al = wait_for(lambda e: e.get("type") == "alert" and e["alert"].get("auto"), 4)
            expect(al is not None, "no auto alert after the countdown")
            expect(len(http("GET", "/api/alerts")) == before + 1, "alert not stored")
            cli("set_scenario", "ok"); cli("set_scenario", "stall")
            ev2 = wait_for(lambda e: e.get("type") == "car_event" and e["event"]["type"] == "engine_stall", 4)
            expect(ev2 is not None, "no stall car_event")
            http("POST", "/api/alerts/cancel", {})
            time.sleep(float(env["ALERT_COUNTDOWN_S"]) + 1.0)
            cli("set_scenario", "misfire_before_swap")
            expect(len(http("GET", "/api/alerts")) == before + 1, "cancel did not suppress the stall alert")
        check("D4", "alert: crash -> auto alert; stall + cancel -> suppressed", d4)

        check("D5", "alert: location off -> null", lambda: expect(http("POST", "/api/alerts", {"trigger": "sos", "include_location": False})["location"] is None, "location not null"))

        def f1():
            p = http("GET", "/api/fair-price?dtc=P0301")
            expect(len(p["fair_range_usd"]) == 2 and p["fair_range_usd"][0] < p["fair_range_usd"][1], f"range {p.get('fair_range_usd')}")
            expect(any(s.startswith("http") for s in p["sources"]), f"sources {p.get('sources')}")
        check("F1", "fair price: range with at least one source url", f1)

        shops: list = []

        def f2():
            shops.extend(http("GET", "/api/shops"))
            expect(len(shops) == 3 and all(s.get("synthetic") for s in shops), f"{shops}")
        check("F2", "shops: 3, all synthetic", f2)

        def f4():
            ids = [s["id"] for s in shops]
            d = http("POST", "/api/quotes/draft", {"shop_ids": ids})
            expect("P0301" in d["draft"], "draft lacks the code")
            try:
                http("POST", "/api/quotes/send", {"shop_ids": ids, "approved": False})
                raise AssertionError("send without approval was accepted")
            except urllib.error.HTTPError as e:
                expect(e.code == 400, f"expected 400, got {e.code}")
            http("POST", "/api/quotes/send", {"shop_ids": ids, "approved": True})
            for _ in range(40):
                q = http("GET", "/api/inbox")
                if len(q) >= 3:
                    break
                time.sleep(0.25)
            expect(len(q) == 3, f"inbox has {len(q)}")
            expect(sum(1 for x in q if x["flag"] == "above_range") == 1, f"flags {[x['flag'] for x in q]}")
            expect(all(x.get("sources") for x in q), "quote without sources")
        check("F4", "quotes: draft has the code, approval required, 3 replies, 1 flagged", f4)

        def i2():
            r = http("POST", "/api/chat", {"messages": [{"role": "user", "content": "it shakes and the light blinks"}], "image": None}, timeout=80)
            expect(isinstance(r.get("reply"), str) and r["reply"], "no reply")
            expect(r.get("mode") in ("live", "fixture") and isinstance(r.get("annotations"), list), f"shape {list(r)}")
        check("I2", "chat: reply in the contract shape (" + env["DIAGNOSE_MODE"] + ")", i2)

        def g1():
            src = " ".join(p.read_text(errors="ignore") for p in (ROOT / "web/src").rglob("*.tsx"))
            expect("AI was used" in src, "no AI notice in web/src")
            expect("simulated" in src.lower(), "no simulated label in web/src")
        check("G1", "ui: AI notice and simulated label present", g1)
    finally:
        server.terminate()
        try:
            cli("set_scenario", "misfire_before_swap")
        except Exception:  # noqa: BLE001
            pass
    n = sum(1 for r in results if r[2])
    print(f"smoke {n}/{len(results)} PASS  ({time.time() - t0:.0f}s)")
    sys.exit(0 if n == len(results) else 1)


if __name__ == "__main__":
    main()
