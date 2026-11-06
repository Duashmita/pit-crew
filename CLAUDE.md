# pit-crew

pit crew. anthropic code with claude: women in ai hackathon, nov 6 2026, economic mobility track.
submission (demo video + public github repo) due 12:45. feature freeze 12:00.

the build plan lives in plan.md: flow, contracts, lanes, scope, risks. read it before planning.

## rules of the day
- the demo path is the product. if a change doesn't make the 3-minute demo better, skip it.
- synthetic data only: the car is an emulator or a mock, the shops are fake, the persona is synthetic. say so on screen.
- claude never makes the safety call (stop now / short trip to a shop / ok to drive). the prolog triage does, and the ui shows the rule that fired.
- unknown critical signals count as unsafe.
- animations are drawn only from a step spec the triage has checked. schematic, labeled "diagram, not to scale".
- every outbound message (quote requests) needs her approval. nothing real is sent in the demo.
- every result screen says ai was used.
- small commits after every working step, conventional prefixes (feat:, fix:, chore:). judges read the history.
- no auth, database, docker or deployment unless asked.

## layout
- car/      MCP server over python-OBD (`obd`), ELM327 emulator or mock car, demo scenarios
- triage/   swi-prolog rules with cite facts, plunit tests
- agent/    claude agent sdk loop, step specs, two-call animation pipeline, fair-price research, fake inbox
- web/      vite + react + typescript. animated svgs render in a sandboxed iframe
- sources/  public owner's manual and manufacturer text, source url on line 1, text as published
- data/     synthetic persona, fake shops and their quotes
- eval/     claude alone vs the prolog triage, results.md

## contracts
copy the final versions from the approved plan here. change them only in this file, then tell the other lanes.

## commands (create these first)
- make dev     car server + agent + web
- make smoke   misfire scenario end to end. on main, claude can't stop while this fails
- make test    plunit + agent tests

## models
- ids live in agent/config.py: claude-opus-5-5 for the diagnosis loop, claude-sonnet-5-5 for rendering animations
- step specs and quotes use strict tool schemas
- fair-price claims keep their source urls

## gotchas
append one line every time you correct claude, so it doesn't happen twice.
