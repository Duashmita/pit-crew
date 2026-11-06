# pit-crew

> This file was the frozen plan the parallel Claude Code lanes built against on Nov 6. The shipped UX moved on during the morning (one input instead of two tabs, a situation bar across the top, eight scenarios, live Ask mode); README.md describes what runs. The contracts below are still the API.

Pit Crew. Code with Claude: Women in AI hackathon, Nov 6 2026. Track: Safety and rights.
Submission (demo video + public repo) due 12:45. Feature freeze 12:00. Lanes stop adding at 11:30 (check `date`) and report.

When her car acts up, Claude questions the car's computer through an MCP server, a Prolog rulebook makes the safety call, and her people get the fault and her location the moment it is not safe to drive. Then Claude walks her through the cheapest test with an animated step, and when it is a shop job she picks a nearby shop and asks with the fault, her test result and the fair price in hand. The car, the shops, the friends and the persona are simulated, and the screen says so.

Feature list with a check and expected output per feature: `../pit-crew-features.md`. smoke.py implements it.

## rules of the day
- the 3-minute demo path is the product. if a change doesn't make it better, skip it.
- synthetic data only: the car is a mock, the shops, friends and persona are fake. say so on screen.
- claude never makes the safety call. the prolog triage does, and the ui shows the rule that fired and its source.
- unknown critical signals count as unsafe.
- the alert offer fires whenever the call is not ok_to_drive. sos is always on screen. crash or stall from the car fires an alert after a 10 s countdown with cancel (backend owns the countdown; env ALERT_COUNTDOWN_S overrides for tests).
- location in an alert is optional: per-alert toggle (default on) and a settings switch.
- friends are a json list. no accounts, no auth, no database, no docker, no deploy.
- the engine diagram and the coil-swap animation are hand-drawn svg driven by data. claude renders svg only for a step the diagram can't show, from a spec the gate approved, sanitized, in a sandboxed iframe, labeled "diagram, not to scale".
- nothing real leaves: quote requests and alerts stay in-app. she approves anything "sent".
- every result screen says AI was used.
- the demo path has no network dependency: no map tiles, web font with a system fallback, fixture mode when there is no api key. in fixture mode the car and the rulebook still run for real; only claude's text is recorded.
- lanes touch only their own paths (below). no git commits (the orchestrator commits). no npm install / pip install (deps are installed; if you need one, say so in your report and work around it).
- python is `.venv/bin/python` (3.14). never bare python3.

## layout and ownership
| path | lane | what |
| --- | --- | --- |
| car/ | car | mock car, state file, cli, mcp stdio server, pytest |
| triage/ sources/ | triage | prolog rules with cite facts, plunit, gate, python bridge |
| agent/app.py agent/state.py agent/events.py | orchestrator | skeleton. add keys to state.S, don't restructure |
| agent/diagnose.py agent/loop.py agent/render.py fixtures/ | backend-diagnose | car routes, triage/gate routes, diagnose loop (live + fixture), did-it, render |
| agent/safety.py agent/shops.py data/ | backend-safety | friends, settings, alerts, acks, countdown, car watcher, shops, drafts, inbox, fair price |
| web/src/App.tsx main.tsx styles/ state/ components/phone/ components/shell/ screens/Home.tsx screens/Checking.tsx | web-shell | app shell, phone frames, sse client, car poll, home, checking, safety banner, alert offer, sos, countdown, friend phone, car panel, settings |
| web/src/components/engine/ screens/Diagnosis.tsx StepPlayer.tsx Result.tsx DIY.tsx Shops.tsx Inbox.tsx web/preview.html web/src/preview.tsx | web-diagnosis | engine svg, flicker, coil swap, diagnosis board, step player, result, diy, shops, draft, inbox |
| web/src/types.ts web/src/lib/api.ts Makefile smoke.py README.md CLAUDE.md | orchestrator | contracts and checks |

## commands
- `make dev` backend on :8000 and web on :5173 (vite proxies /api to :8000)
- `make smoke` offline checks, under 90 s, fixture mode. `make smoke-live` the same with the real loop
- `make test` pytest + plunit
- backend alone: `.venv/bin/python -m uvicorn agent.app:app --port 8000 --reload` from the repo root. web alone: `cd web && npm run dev`

## models
- `claude-opus-5-5` for the diagnosis loop, `claude-sonnet-5-5` for svg render. anthropic python sdk, streaming, strict tool schemas. invoke the `claude-api` skill before writing sdk code.
- `ANTHROPIC_API_KEY` from `.env` (gitignored, loaded by agent/state.py). when absent, `DIAGNOSE_MODE=fixture`.

## contracts (frozen; change only here and tell the orchestrator)

### car (car/mock.py pure functions; car/cli.py `python -m car.cli <tool> [arg]` prints json; car/server.py mcp stdio server named `car` with the same tools)
state lives in car/state.json: `{"scenario": "...", "engine_running": true, "events": [...]}`. every process reads it fresh on each call, so the cli, the mcp server and the backend agree.
scenarios: misfire_before_swap (default), misfire_after_swap, stall, crash, ok.
- `get_status()` -> `{"mil_on": bool, "dtc_count": int, "rpm": int, "speed_kph": int, "coolant_c": int, "engine_running": bool, "scenario": str}`
  misfire_before_swap: mil_on true, dtc_count 1, rpm about 740 (jitter ±30 per read, rough idle), speed 0, coolant 92, running true.
  misfire_after_swap: same, the code moves. stall: mil_on true, rpm 0, speed 0, running false, events `[{"type":"engine_stall","speed_kph":45,"at":iso}]`. crash: rpm 0, running false, events `[{"type":"airbag_deployed","at":iso}]`. ok: mil_on false, dtc_count 0, rpm 800, coolant 90, no events.
- `read_dtcs()` -> `[{"code":"P0301","desc":"cylinder 1 misfire detected"}]`; after swap `P0302` cylinder 2; stall/crash keep P0301; ok `[]`
- `read_pid(name)` -> `{"name": name, "value": number, "unit": str}`; names RPM, SPEED, COOLANT_TEMP, SHORT_FUEL_TRIM_1, LONG_FUEL_TRIM_1, THROTTLE_POS; unknown -> `{"error":"unknown pid"}`
- `misfire_counts()` -> `{"1":12,"2":0,"3":0,"4":0}` before swap; `{"1":0,"2":11,"3":0,"4":0}` after; zeros for ok
- `freeze_frame()` -> `{"code":"P0301","rpm":740,"speed_kph":0,"coolant_c":92,"load_pct":22}` (code follows the scenario)
- `events()` -> list as above, `[]` otherwise
- `set_scenario(name)` -> `{"scenario": name}`; unknown -> `{"error":"unknown scenario","known":[...]}`
- `apply_action(name)` -> `get_status()`; actions: swap_coils_1_2 (before -> after swap), engine_off (running false, rpm 0), engine_on

### triage (triage/run.py: `triage(input: dict) -> dict`, `check_spec(spec: dict) -> dict`; swipl subprocess, json in on stdin, json out; works from any cwd; under 300 ms)
input `{"mil_on": bool, "flashing": "yes"|"no"|"unknown", "dtcs": ["P0301"], "coolant_c": int, "events": ["airbag_deployed"], "symptoms": ["shaking"]}`
output `{"call": "stop_now"|"short_trip_only"|"ok_to_drive", "rule": "mil_flashing_misfire", "why": "plain words", "cite": {"label": "...", "url": "...", "source_id": "sources/<file>.md"}, "unknowns": ["is the light flashing or steady?"]}`
rules, each cited to a sources/ file (url on line 1): flashing mil + misfire code -> stop_now (short_trip_only only if the source says so); flashing unknown -> treated as flashing, listed in unknowns; steady mil and nothing else -> ok_to_drive; coolant_c >= 110 -> stop_now; airbag_deployed -> stop_now; engine_stall -> stop_now; no mil, no codes -> ok_to_drive. strictest call wins. unknown critical signal -> stop_now.
gate `check_spec(spec)` -> `{"approved": bool, "missing": [...], "required": [...]}`. required by part family: ignition (coil, plug, connector) -> engine_off, engine_cool; fuel (injector, line, pump) -> engine_off, no_flame; battery -> key_out, negative_first. missing = required minus spec.precautions.

### agent (fastapi, every route under /api; every event below is also published on GET /api/events as `data: <json>`)
- `GET /api/health` -> `{"ok": true, "mode": "fixture"|"live"}`
- `GET /api/car` -> `{"status":{...},"dtcs":[...],"misfire_counts":{...},"events":[...]}` (web polls this every 1 s)
- `POST /api/car/scenario {"name"}` -> same snapshot; publishes `{"type":"car","status":{...},"misfire_counts":{...}}` only (car_event comes from the watcher)
- `POST /api/diagnose {"words": str, "delay_ms": 600}` -> runs the loop, publishes each event with delay_ms between them, responds `{"events":[...]}` at the end. event order for the misfire scenario:
  `{"type":"text","text":"..."}` (short narration, optional)
  `{"type":"tool_call","tool":"get_status","args":{},"result":{...}}` then read_dtcs, misfire_counts (live mode picks its own order; freeze_frame and read_pid allowed)
  `{"type":"triage", ...triage output}` (computed by triage/run.py, never canned)
  `{"type":"diagnosis","causes":[{"cause":"ignition coil 1","evidence":["P0301","12 misfires on cylinder 1"],"confidence":0.6},{"cause":"spark plug 1","evidence":[...],"confidence":0.25},{"cause":"fuel injector 1","evidence":[...],"confidence":0.1}],"summary":"..."}`
  `{"type":"step","spec":{...step spec},"gate":{"approved":true,"missing":[],"required":[...]}}` or `{"type":"step_blocked","spec":{...},"missing":[...]}`
  `{"type":"done"}`
  after did-it the loop runs again on the after-swap car: diagnosis names the coil with confidence >= 0.9 and summary "the misfire followed the coil, so it's the ignition coil from cylinder 1"; the step spec is `replace-coil-1` (text only, cost_usd from fair price if known).
- `POST /api/did-it {"step":"swap-coils-1-2","delay_ms":600}` -> applies swap_coils_1_2, publishes `{"type":"car",...}`, runs diagnose again -> `{"events":[...]}`
- `POST /api/triage {input}` -> triage output. `POST /api/gate {spec}` -> gate output
- `POST /api/render {spec}` -> `{"svg":"<svg ...>"}` sanitized (no script, foreignObject, external href, on* attributes); fixture mode returns fixtures/render_fallback.svg
- `GET/POST /api/friends`, `DELETE /api/friends/{id}`; friend `{"id","name","relation","phone","synthetic":true}`; seed data/friends.json with Priya, sister, +1 555 0100
- `GET/PUT /api/settings` -> `{"share_location": true}`
- `POST /api/alerts {"trigger":"verdict"|"sos"|"crash"|"stall","include_location":true,"auto":false}` -> alert; publishes `{"type":"alert","alert":{...}}`
  alert `{"id","trigger","auto","fault":"P0301 cylinder 1 misfire","call","rule","location":{"lat":37.8044,"lng":-122.2712,"label":"Elm St & 3rd Ave (synthetic)"}|null,"to":["Priya"],"sent_at":iso,"status":"delivered","acks":[]}`
  fault/call/rule from state.S["last_triage"] (set by the diagnose loop), else "unknown". include_location false or settings.share_location false -> location null.
- `GET /api/alerts` -> list. `POST /api/alerts/{id}/ack {"by":"Priya","action":"on_my_way"|"called"}` -> alert; publishes `{"type":"ack","alert_id","by","action"}`
- car watcher (backend-safety, background task): reads car.mock.events() every 1 s; for each new event (dedupe by `at`) publishes `{"type":"car_event","event":{...},"countdown_s":10}` and schedules an auto alert (trigger crash or stall, auto true) after countdown_s unless `POST /api/alerts/cancel` arrives (-> `{"cancelled": true}`, publishes `{"type":"alert_cancelled"}`). env ALERT_COUNTDOWN_S overrides 10.
- `GET /api/shops` -> three of `{"id","name","distance_km","open_until","phone","rating","synthetic":true}` from data/shops.json
- `GET /api/fair-price?dtc=P0301` -> `{"part":"ignition coil","parts_usd":[low,high],"labor_usd":[low,high],"fair_range_usd":[low,high],"sources":["https://..."],"as_of":"2026-11"}` from data/fair_price.json (real public sources, cached)
- `POST /api/quotes/draft {"shop_ids":[...]}` -> `{"draft": text}`: the code, the test result (misfire moved to cylinder 2 after the coil swap), the fair range and its first source, a request for parts and labor
- `POST /api/quotes/send {"shop_ids":[...],"approved":true}` -> `{"sent": n}`; approved false -> 400; generates replies into state.S["quotes"]; publishes `{"type":"quote","quote":{...}}` per reply with a 700 ms stagger (background task)
- `GET /api/inbox` -> quotes `{"id","shop","total_usd","parts_usd","labor_usd","fair_range_usd":[low,high],"flag":"in_range"|"above_range","note":"...","sources":[...]}`; exactly one above_range at about 2.1x the high end

### chat (conversational mode, live; agent/chat.py, lane backend-chat)
- `POST /api/chat {"messages":[{"role":"user"|"assistant","content":str}], "image": {"media_type":"image/jpeg"|"image/png"|"image/webp","data":base64}|null}` -> `{"reply": str, "annotations": [{"label": str, "x": 0..1, "y": 0..1, "w": 0..1, "h": 0..1, "note": str}], "mode": "live"|"fixture", "tool_calls": [{"tool": str, "result": any}], "triage": triage output|null}`
  annotations are boxes over the photo in normalized coordinates (x, y top-left; w, h), at most 6, numbered in order; the reply refers to them by number. the image is the last user message's photo, sent as an image content block.
  live: anthropic sdk, model claude-opus-5-5, tools get_status, read_dtcs, misfire_counts, events (car), triage (triage/run.py; sets state.S["last_triage"] and publishes the triage event), annotate_photo (strict schema: the annotations list; only when an image was sent). system prompt: a calm mechanic who puts safety first, says plainly when the rulebook says to stop, never states a price without a source, says this is a simulated demo when asked, keeps replies under 120 words.
  fixture (no key): a canned reply that says live chat needs an api key, and, if an image was sent, three canned annotations so the ui can be exercised; mode "fixture".
  while running, publishes `{"type":"chat_tool","tool","result"}` per tool call and `{"type":"chat_reply","reply","annotations","mode"}` at the end.

### step spec
`{"id":"swap-coils-1-2","title":"swap the coils on cylinders 1 and 2","parts":["coil 1","coil 2","coil connectors","coil bolts"],"actions":[{"verb":"unclip","target":"coil 1 connector"},{"verb":"remove","target":"coil 1 bolt"},{"verb":"lift","target":"coil 1"},{"verb":"swap","target":"coil 1 and coil 2"},{"verb":"reinstall","target":"both coils"}],"tools":["10 mm socket"],"precautions":["engine_off","engine_cool"],"expect":"misfire moves to cylinder 2","est_minutes":10,"cost_usd":0}`

### web
`web/src/types.ts` mirrors everything above and `web/src/lib/api.ts` wraps every route. import from there; never redefine.
screen components and their props (web-diagnosis exports, web-shell wires):
- `screens/Diagnosis.tsx` default `Diagnosis({ snapshot, diagnosis, step, onShowMe })`
- `screens/StepPlayer.tsx` default `StepPlayer({ spec, gate, onDidIt })` (onDidIt fires after the precautions are ticked)
- `screens/Result.tsx` default `Result({ snapshot, diagnosis, fairPrice, onDiy, onShops })`
- `screens/DIY.tsx` default `DIY({ fairPrice, spec })`
- `screens/Shops.tsx` default `Shops({ shops, onSent })` (owns the draft sheet: api.draft, api.send, then onSent)
- `screens/Inbox.tsx` default `Inbox({ quotes, fairPrice })`
- `components/engine/EngineSVG.tsx` default `EngineSVG({ counts, size? })`; `components/engine/CoilSwapAnimation.tsx` default `CoilSwapAnimation({})`
types: `snapshot: CarSnapshot`, `diagnosis: { causes: Cause[]; summary: string } | null`, `step: { spec: StepSpec; gate: GateResult } | null`, `fairPrice: FairPrice | null`, `shops: Shop[]`, `quotes: Quote[]`.

## ux spec (web)
Recorded in a desktop browser at 1440x900. Dark theme. Tokens live in web/src/styles/global.css: coral `--danger` for danger and alerts, amber `--caution`, teal `--ok` for ok and connected, `--ink` background, `--panel` cards, `--text`, `--muted`. Font Manrope with system-ui fallback (must look right offline). 16 px rounded cards, 1 px borders at 12% white, soft shadows. Motion: 200 ms ease for state changes, the flicker is a 1.2 s pulse, the coil swap loops in 2.5 s. Large type for the safety call (40 px). Every screen has the AI notice in small muted text.

Stage layout (`components/shell/Stage.tsx`): top bar with the Pit Crew wordmark, "AI was used" and "simulated car, shops and friends"; center Maya's phone (390x844 frame with notch and status bar with a live clock, scrollable screen inside); right Priya's phone (same frame at 0.85 scale, label "Priya, Maya's sister · simulated"); left the car panel (card "Simulated car · 2014 compact, inline-4": scenario pills misfire / after swap / stall / crash / ok, live rpm, the MIL lamp, four misfire bars, "car server: connected"). Below 1100 px width, stack vertically.

Maya's phone (`state/machine.ts`: screen = home | checking | banner | diagnosis | step | result | diy | shops | inbox; sos and countdown are overlays; events arrive from api.events, the car snapshot from api.car every 1 s):
1. home: "Hi Maya", car chip "Maya's car · connected", prompt "What's going on with the car?", chips "It's shaking and the light is blinking", "It just died on the freeway", "I hit something". A chip fills and sends. SOS pill pinned at the bottom of every screen. Gear icon opens the settings sheet (friends add/remove, share-location switch).
2. checking: narration and tool-call cards stream in (icon per tool, args and result on one line), the car chip pulses.
3. banner: the triage event slides a full-width block in: the call in 40 px ("Don't drive" / "Short trip only" / "OK to drive"), why in plain words, a rule chip "rule mil_flashing_misfire · source" that opens the cite url, the AI notice. When the call is not ok_to_drive the alert offer card sits under it: friend avatars, "Tell Priya where you are?", toggle "Include my location" (hidden when settings.share_location is off), [Send] [Not now]. Send posts trigger verdict; the card becomes "Sent to Priya · 10:53 · location included"; an ack event turns it into "Priya is on her way". Then [See what's wrong] goes to diagnosis.
4. diagnosis: EngineSVG on top (the cylinder with misfires pulses coral), "Likely causes" ranked with evidence chips and confidence bars, "Cheapest test" card from the step event (title, $0, 10 min) [Show me].
5. step: precaution checklist from spec.precautions (tap to tick), "checked by the rulebook" when gate.approved, a step_blocked shows the missing items in amber and draws nothing; CoilSwapAnimation (coils 1 and 2 lift, cross, drop; arrows; label "diagram, not to scale"); the action list; [I did it] enabled once every precaution is ticked, posts did-it.
6. result: the EngineSVG glow travels from cylinder 1 to 2 (600 ms), card "The misfire followed the coil. It's the ignition coil on cylinder 1." with a confidence bar, fair price card (part, parts range, labor range, sources), buttons [I'll replace it myself] and [Find a shop].
7. diy: part, price with source, the same animation, "parts store nearby" line (synthetic).
8. shops: three shop cards (name, distance, open until, rating), multi-select, [Draft a request] opens a sheet with the draft text, label "simulated send", [Approve and send].
9. inbox: three reply cards arrive staggered from quote events: total, parts, labor; flag chip coral "Above fair range · 2.1x" or teal "In range"; footer "Fair range from <source>". Closing line: "She walks in knowing what's wrong and what it should cost."
Overlays: SOS tap -> Countdown 3 s "Sending to Priya in 3 [Cancel]" -> post trigger sos. car_event -> full-screen Countdown with countdown_s "Are you OK? Alerting Priya in 10 [I'm OK, cancel]" -> cancel posts /api/alerts/cancel; otherwise the backend sends the alert and the alert event arrives.

Priya's phone (`components/shell/FriendPhone.tsx`): lock screen (time, soft gradient wallpaper). On an alert event a notification card slides down: "Pit Crew · now", "Maya needs you", the call and fault in plain words, a stylized svg map tile (no network) with a pin and a pulsing ring and the location label, "0.8 mi away", [Call her] [On my way] -> api.ack. After the ack the card shows "You're on your way". Location null -> "location not shared".

## ux: the two input states (web, lane web-ask)
Home gets a segmented control under the greeting: **Watch** | **Ask**. Watch is the observational state: everything above (chips, the car's data, alerts). Ask is the conversational state (`screens/Ask.tsx`, default `Ask({ onAlert })`): a chat thread inside Maya's phone. Input row at the bottom (above the SOS pill): a photo button (file input accept image/*, plus a "sample photo" button that loads /sample-engine.jpg when it exists), a text field "Tell it what's wrong", send. Photos are downscaled client-side to 1024 px max before sending as base64. Her bubble shows the photo. While the call runs, chat_tool events show as small "Reading the car…" chips under her bubble. Claude's reply is a bubble; when annotations come back, the photo bubble gets an SVG overlay (viewBox matches the image): coral boxes with numbered tags, and the reply's numbers match. If the response carries a triage that is not ok_to_drive, a compact coral strip appears above the input with the call and a [Tell Priya] button that calls onAlert (trigger verdict). A chip in the thread header says "live" or "offline demo" from the response mode. The AI notice stays on screen.

## gotchas
- uvicorn --reload does not reload on .env changes; restart it.
- an org-level api key needs ANTHROPIC_WORKSPACE_ID in .env (sent as the anthropic-workspace-id header by agent/state.py).
- car/state.json is shared; concurrent car tests and the click-through collide.
- git add -A while a lane is mid-edit sweeps its half-done files into the commit.
- port 5173 belongs to another project on this machine; the web app runs on 5174.
