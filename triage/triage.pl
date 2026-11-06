% pit crew triage rulebook. the safety call comes from here, never from the llm.
% policy: strictest call wins; unknown critical signals are unsafe; where two sources
% disagree the stricter reading is encoded and the softer one is listed in README.md.
:- module(triage, [triage/2, rule_ids/1, cite/4]).
:- use_module(library(json)).
:- use_module(library(lists)).
:- use_module(library(apply)).

severity(stop_now, 3).
severity(short_trip_only, 2).
severity(ok_to_drive, 1).

%% ---- signals (json read with value_string_as(atom): strings are atoms, true/false/null are atoms)
get(In, Key, Default, Value) :- ( get_dict(Key, In, V), V \== null -> Value = V ; Value = Default ).
mil_known(In) :- get(In, mil_on, unknown, V), V \== unknown.
mil_on(In) :- get(In, mil_on, unknown, true).
flashing(In, F) :- get(In, flashing, unknown, F0), ( memberchk(F0, [yes, no, unknown]) -> F = F0 ; F = unknown ).
mil_flashing(In) :- flashing(In, yes), !.
mil_flashing(In) :- mil_on(In), flashing(In, unknown).   % unknown counts as flashing
codes(In, Codes) :- get(In, dtcs, [], L), maplist(code_of, L, Codes).
code_of(D, C) :- is_dict(D), !, get_dict(code, D, C).
code_of(C, C).
misfire_code(C) :- atom(C), atom_concat('P030', _, C).      % P0300 random, P0301..P0312 per cylinder
has_misfire(In) :- codes(In, Cs), member(C, Cs), misfire_code(C), !.
events(In, Es) :- get(In, events, [], L), maplist(event_type, L, Es).
event_type(E, T) :- is_dict(E), !, get_dict(type, E, T).
event_type(T, T).
has_event(In, T) :- events(In, Es), memberchk(T, Es).
coolant(In, C) :- get(In, coolant_c, unknown, C), number(C).

%% ---- rules: rule(Id, Call, Why, In). the source sentence sits above each rule.

% sources/ram-1500-malfunction-indicator-lamp.md (paraphrase): "If the MIL flashes, severe catalytic
% converter damage and power loss will soon occur. Immediate service is required."
% sources/mazda3-check-engine-light.md (verbatim, softer): "If the check engine light remains on, or it
% flashes continuously, do not drive at high speeds and consult an expert repairer ... as soon as possible."
rule(mil_flashing_misfire, stop_now,
     'The check-engine light is flashing and the car reports a misfire. A flashing light means unburned fuel is reaching the catalytic converter, which can be damaged quickly, and power loss can follow. Stop as soon as it is safe and do not keep driving.',
     In) :- mil_flashing(In), has_misfire(In).

% same sources: a flashing light without a stored misfire code is still the flashing case.
rule(mil_flashing, stop_now,
     'The check-engine light is flashing. That is the severe case in the manual: stop as soon as it is safe and have the car looked at before driving on.',
     In) :- mil_flashing(In), \+ has_misfire(In).

% sources/mazda3-check-engine-light.md: "If the check engine light remains on ... do not drive at high
% speeds and consult an expert repairer ... as soon as possible."
rule(mil_steady_misfire, short_trip_only,
     'The check-engine light is on steady and the car reports a misfire. Avoid high speeds and get to a shop soon; do not plan a long drive on it.',
     In) :- mil_on(In), flashing(In, no), has_misfire(In).

% sources/mazda3-check-engine-light.md: "If this light illuminates while driving, the vehicle may have a
% problem. It is important to note the driving conditions when the light illuminated and consult an expert repairer."
rule(mil_steady, ok_to_drive,
     'The check-engine light is on steady with no other warning. Note how the car is driving and have the code read soon.',
     In) :- mil_on(In), flashing(In, no), \+ has_misfire(In).

% sources/mazda-cx30-coolant-temperature.md: "Park the vehicle in a safe place immediately and stop the
% engine." and "Do not drive the vehicle with the high engine coolant temperature warning light illuminated."
% 110 C is the project's proxy for that warning indication in the mock car (CLAUDE.md contract), not a figure from the source.
rule(engine_overheating, stop_now,
     'The engine is overheating. Park in a safe place immediately and stop the engine; driving on can destroy it.',
     In) :- coolant(In, C), C >= 110.

% sources/mazda3-air-bag-systems.md: "Do not operate a vehicle with damaged air bag/seat belt pretensioner
% system components: Expended or damaged ... components must be replaced after any collision which caused them to deploy."
rule(airbag_deployed, stop_now,
     'An airbag has deployed. Do not drive the car: expended airbags must be replaced before they can protect you again, and the car needs to be checked after a collision.',
     In) :- has_event(In, airbag_deployed).

% sources/engine-stall.md (paraphrase): "If the engine stops while driving, brake normally but do not pump
% the brakes." Power steering and brake assist fade without the engine running.
rule(engine_stalled, stop_now,
     'The engine stalled while driving. Steering and brake assist fade without the engine; steer to a safe stop and do not continue the trip.',
     In) :- has_event(In, engine_stall).

% policy: unknown critical signals count as unsafe.
rule(mil_unknown, stop_now,
     'Whether the check-engine light is on could not be read. Unknown critical signals count as unsafe until someone checks.',
     In) :- \+ mil_known(In).

% policy: nothing on, nothing stored, nothing happened.
rule(no_warning, ok_to_drive,
     'No warning light, no stored codes and no critical events.',
     In) :- mil_known(In), \+ mil_on(In), \+ mil_flashing(In), codes(In, []),
            \+ has_event(In, airbag_deployed), \+ has_event(In, engine_stall).

% the light is off but codes are stored (pending or history).
rule(codes_no_mil, ok_to_drive,
     'The check-engine light is off but the car has stored codes. Have them read when convenient.',
     In) :- mil_known(In), \+ mil_on(In), \+ mil_flashing(In), codes(In, Cs), Cs \== [],
            \+ has_event(In, airbag_deployed), \+ has_event(In, engine_stall).

rule_ids([mil_flashing_misfire, mil_flashing, mil_steady_misfire, mil_steady, engine_overheating,
          airbag_deployed, engine_stalled, mil_unknown, no_warning, codes_no_mil]).

%% ---- cites: cite(RuleId, Label, Url, SourceId)
cite(mil_flashing_misfire, 'Ram 1500 owner\'s manual, malfunction indicator light (flashing)', 'https://www.manualslib.com/manual/826356/Ram-1500.html?page=300', 'sources/ram-1500-malfunction-indicator-lamp.md').
cite(mil_flashing,         'Ram 1500 owner\'s manual, malfunction indicator light (flashing)', 'https://www.manualslib.com/manual/826356/Ram-1500.html?page=300', 'sources/ram-1500-malfunction-indicator-lamp.md').
cite(mil_steady_misfire,   'Mazda3 owner\'s manual, check engine light', 'https://owners-manual.mazda.com/gen/en/mazda3/mazda3_8jr6ee20e/contents/08070314.html', 'sources/mazda3-check-engine-light.md').
cite(mil_steady,           'Mazda3 owner\'s manual, check engine light', 'https://owners-manual.mazda.com/gen/en/mazda3/mazda3_8jr6ee20e/contents/08070314.html', 'sources/mazda3-check-engine-light.md').
cite(engine_overheating,   'Mazda CX-30 owner\'s manual, high engine coolant temperature warning', 'https://owners-manual.mazda.com/gen/en/cx-30/cx-30_8hp8eo19k/contents/08070309.html', 'sources/mazda-cx30-coolant-temperature.md').
cite(airbag_deployed,      'Mazda3 owner\'s manual, air bag systems', 'https://owners-manual.mazda.com/gen/en/mazda3/mazda3_8fj4ee16e/contents/03040100.html', 'sources/mazda3-air-bag-systems.md').
cite(engine_stalled,       '2011 Chevrolet Equinox owner\'s manual, if the engine stops while driving', 'https://www.manualowl.com/am/Chevrolet/2011-Equinox/Manual/510?page=226', 'sources/engine-stall.md').
cite(mil_unknown,          'Pit Crew policy: unknown critical signals count as unsafe', 'https://github.com/', 'triage/README.md').
cite(no_warning,           'Pit Crew policy: no signal, no warning', 'https://github.com/', 'triage/README.md').
cite(codes_no_mil,         'Pit Crew policy: stored codes without the light', 'https://github.com/', 'triage/README.md').

%% ---- unknowns the caller should resolve
unknowns(In, Us) :- findall(U, unknown(In, U), Us).
unknown(In, 'is the check-engine light on?') :- \+ mil_known(In).
unknown(In, 'is the light flashing or steady?') :- mil_on(In), flashing(In, unknown).
unknown(In, 'what does the temperature gauge show?') :- \+ coolant(In, _).

%% ---- the call
triage(In, Out) :-
    findall(Sev-r(Id, Call, Why), ( rule(Id, Call, Why, In), severity(Call, Sev) ), Fired),
    Fired \== [],
    findall(S, member(S-_, Fired), Sevs), max_list(Sevs, Max),
    member(Max-r(Id, Call, Why), Fired), !,
    cite(Id, Label, Url, SourceId),
    unknowns(In, Us),
    Out = _{call: Call, rule: Id, why: Why,
            cite: _{label: Label, url: Url, source_id: SourceId}, unknowns: Us}.
triage(_, Out) :-   % nothing matched at all: unsafe by policy
    cite(mil_unknown, Label, Url, SourceId),
    Out = _{call: stop_now, rule: mil_unknown, why: 'No rule matched the input. Unknown counts as unsafe.',
            cite: _{label: Label, url: Url, source_id: SourceId}, unknowns: ['is the check-engine light on?']}.

main :-
    json_read_dict(user_input, In, [value_string_as(atom)]),
    triage(In, Out),
    json_write_dict(user_output, Out, [width(0)]), nl.
