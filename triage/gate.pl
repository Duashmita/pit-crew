% precaution gate: a step spec may be drawn only if it carries the precautions its parts require.
:- module(gate, [check_spec/2]).
:- use_module(library(json)).
:- use_module(library(lists)).
:- use_module(library(apply)).

family_keyword(ignition, coil).  family_keyword(ignition, plug).  family_keyword(ignition, connector).
family_keyword(fuel, injector).  family_keyword(fuel, line).      family_keyword(fuel, pump).
family_keyword(battery, battery).
required(ignition, [engine_off, engine_cool]).
required(fuel, [engine_off, no_flame]).
required(battery, [key_out, negative_first]).

to_atom(X, A) :- ( atom(X) -> A = X ; string(X) -> atom_string(A, X) ; term_to_atom(X, A) ).
part_family(Part, Family) :- to_atom(Part, A), downcase_atom(A, L), family_keyword(Family, K), sub_atom(L, _, _, _, K).

check_spec(Spec, Out) :-
    ( get_dict(parts, Spec, P0), is_list(P0) -> Parts = P0 ; Parts = [] ),
    ( get_dict(precautions, Spec, Pre0), is_list(Pre0) -> maplist(to_atom, Pre0, Pre) ; Pre = [] ),
    findall(F, ( member(P, Parts), part_family(P, F) ), Fs0), sort(Fs0, Fs),
    findall(R, ( member(F, Fs), required(F, Rs), member(R, Rs) ), Req0), list_to_set(Req0, Required),
    subtract(Required, Pre, Missing),
    ( Missing == [] -> Approved = true ; Approved = false ),
    Out = _{approved: Approved, missing: Missing, required: Required}.

main :-
    json_read_dict(user_input, Spec, [value_string_as(atom)]),
    check_spec(Spec, Out),
    json_write_dict(user_output, Out, [width(0)]), nl.
