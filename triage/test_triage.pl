:- use_module(triage).
:- use_module(gate).
:- use_module(library(plunit)).

in(Extra, In) :-
    Base = _{mil_on: true, flashing: yes, dtcs: ['P0301'], coolant_c: 92, events: [], symptoms: [shaking]},
    In = Base.put(Extra).

:- begin_tests(triage).
test(flashing_misfire_stop) :- in(_{}, In), triage(In, O), O.call == stop_now, O.rule == mil_flashing_misfire.
test(flashing_unknown_unsafe) :- in(_{flashing: unknown}, In), triage(In, O), O.call \== ok_to_drive, memberchk('is the light flashing or steady?', O.unknowns).
test(steady_only_ok) :- in(_{flashing: no, dtcs: []}, In), triage(In, O), O.call == ok_to_drive, O.rule == mil_steady.
test(steady_misfire_short_trip) :- in(_{flashing: no}, In), triage(In, O), O.call == short_trip_only.
test(overheat_stop) :- in(_{flashing: no, dtcs: [], coolant_c: 112}, In), triage(In, O), O.call == stop_now, O.rule == engine_overheating.
test(airbag_stop) :- in(_{mil_on: false, flashing: no, dtcs: [], events: [airbag_deployed]}, In), triage(In, O), O.call == stop_now, O.rule == airbag_deployed.
test(stall_stop) :- in(_{flashing: no, events: [engine_stall]}, In), triage(In, O), O.call == stop_now, O.rule == engine_stalled.
test(nothing_ok) :- in(_{mil_on: false, flashing: no, dtcs: [], symptoms: []}, In), triage(In, O), O.call == ok_to_drive, O.rule == no_warning.
test(unknown_mil_unsafe) :- triage(_{flashing: unknown, dtcs: []}, O), O.call == stop_now, memberchk('is the check-engine light on?', O.unknowns).
test(dtc_objects_accepted) :- in(_{dtcs: [_{code: 'P0301', desc: 'cylinder 1 misfire detected'}]}, In), triage(In, O), O.rule == mil_flashing_misfire.
test(every_rule_cited) :- rule_ids(Ids), forall(member(Id, Ids), cite(Id, _, _, _)).
test(strictest_wins) :- in(_{flashing: no, coolant_c: 115}, In), triage(In, O), O.call == stop_now.
test(temperature_warning_stop) :- in(_{flashing: no, dtcs: [], warnings: [temperature]}, In), triage(In, O), O.call == stop_now, O.rule == engine_overheating.
test(overheat_beats_flashing_unknown) :- in(_{flashing: unknown, dtcs: ['P0217'], coolant_c: 118, warnings: [temperature]}, In), triage(In, O), O.rule == engine_overheating.
test(tire_pressure_short_trip) :- in(_{mil_on: false, flashing: no, dtcs: [], warnings: [tire_pressure]}, In), triage(In, O), O.call == short_trip_only, O.rule == tire_pressure_warning.
test(charging_warning_short_trip) :- in(_{mil_on: false, flashing: no, dtcs: ['P0562'], warnings: [charging], battery_v: 11.6}, In), triage(In, O), O.call == short_trip_only, O.rule == charging_warning.
test(low_voltage_alone_short_trip) :- in(_{mil_on: false, flashing: no, dtcs: [], battery_v: 11.8}, In), triage(In, O), O.call == short_trip_only.
test(fuel_cap_ok) :- in(_{flashing: no, dtcs: ['P0457']}, In), triage(In, O), O.call == ok_to_drive, O.rule == fuel_cap_loose.
test(fuel_cap_flashing_still_stop) :- in(_{flashing: yes, dtcs: ['P0457']}, In), triage(In, O), O.call == stop_now.
:- end_tests(triage).

:- begin_tests(gate).
test(full_spec_approved) :- check_spec(_{parts: ['coil 1', 'coil 2', 'coil connectors', 'coil bolts'], precautions: [engine_off, engine_cool]}, O), O.approved == true, O.missing == [].
test(bare_spec_rejected) :- check_spec(_{parts: ['coil 1', 'coil 2', 'coil connectors', 'coil bolts'], precautions: []}, O), O.approved == false, msort(O.missing, [engine_cool, engine_off]).
test(fuel_family) :- check_spec(_{parts: ['fuel injector 1'], precautions: [engine_off]}, O), O.missing == [no_flame].
test(unknown_part_nothing_required) :- check_spec(_{parts: ['cabin air filter'], precautions: []}, O), O.approved == true, O.required == [].
:- end_tests(gate).
