# triage: the safety call

The drive / don't drive call comes from this rulebook, never from the LLM. `run.py` runs `swipl` as a subprocess with json on stdin and stdout; the backend calls `triage(input)` and `check_spec(spec)`.

Policy: the strictest call wins. Unknown critical signals count as unsafe. Where two manufacturer sources disagree, the stricter reading is encoded and the softer one is noted here.

| signal | call | rule id | source |
| --- | --- | --- | --- |
| check-engine light flashing + misfire code (P030x) | stop_now | mil_flashing_misfire | Ram 1500 manual, MIL (paraphrase, page blocks fetches); Mazda3 manual says "do not drive at high speeds ... as soon as possible" (softer, verbatim) |
| check-engine light flashing, no stored misfire code | stop_now | mil_flashing | same |
| she can't tell if it's flashing | treated as flashing, listed in unknowns | mil_flashing_misfire / mil_flashing | policy |
| light on steady + misfire code | short_trip_only | mil_steady_misfire | Mazda3 manual, check engine light (verbatim) |
| light on steady, nothing else | ok_to_drive | mil_steady | Mazda3 manual (verbatim) |
| coolant_c >= 110 | stop_now | engine_overheating | Mazda CX-30 manual, high coolant temperature warning (verbatim); Nissan X-Trail manual (verbatim). 110 C is the project's proxy for the warning indication in the mock car, not a figure from the source |
| airbag_deployed event | stop_now | airbag_deployed | Mazda3 manual, air bag systems (verbatim) |
| engine_stall event | stop_now | engine_stalled | 2011 Chevrolet Equinox manual (paraphrase, page blocks fetches); Consumer Reports (paraphrase) |
| mil_on missing from the input | stop_now | mil_unknown | policy |
| no light, no codes, no events | ok_to_drive | no_warning | policy |
| light off, codes stored | ok_to_drive | codes_no_mil | policy |

Gate (`gate.pl`): a step spec is approved only if it lists every precaution its parts require. ignition parts (coil, plug, connector) need engine_off and engine_cool; fuel parts (injector, line, pump) need engine_off and no_flame; battery needs key_out and negative_first. Parts outside those families require nothing.

## open questions
- The flashing-light call. Mazda's text supports short_trip_only ("do not drive at high speeds ... as soon as possible"); the Ram text supports stop_now ("immediate service is required", "power loss will soon occur"). Encoded as stop_now. A mentor or mechanic should confirm which reading the demo car's own manual uses.
- The overheating threshold 110 C is a mock-car proxy for the warning light, not a published number.
- The Ram and Chevrolet pages refused automated fetches, so their lines are paraphrases from search summaries. Verify against the pages before quoting them to a judge.

## sources
- sources/ram-1500-malfunction-indicator-lamp.md, https://www.manualslib.com/manual/826356/Ram-1500.html?page=300 (paraphrase)
- sources/mazda3-check-engine-light.md, https://owners-manual.mazda.com/gen/en/mazda3/mazda3_8jr6ee20e/contents/08070314.html (verbatim)
- sources/mazda-cx30-coolant-temperature.md, https://owners-manual.mazda.com/gen/en/cx-30/cx-30_8hp8eo19k/contents/08070309.html (verbatim) and the Nissan X-Trail e-POWER 2024 manual (verbatim)
- sources/mazda3-air-bag-systems.md, https://owners-manual.mazda.com/gen/en/mazda3/mazda3_8fj4ee16e/contents/03040100.html (verbatim)
- sources/engine-stall.md, https://www.manualowl.com/am/Chevrolet/2011-Equinox/Manual/510?page=226 (paraphrase) and Consumer Reports (paraphrase)

## run
```
swipl -g run_tests -t halt triage/test_triage.pl
.venv/bin/python -m triage.run triage '{"mil_on":true,"flashing":"yes","dtcs":["P0301"]}'
.venv/bin/python -m triage.run gate '{"parts":["coil 1","coil 2"],"precautions":["engine_off","engine_cool"]}'
```
