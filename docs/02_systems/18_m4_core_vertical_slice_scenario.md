# M4 Core Vertical Slice Scenario

Status: WM-0067 adds the first deterministic headless integration for the
focused M4 owner-store slice. Save/replay, Worker parity, benchmark baseline
updates, public protocols, and UI remain later gates.

## Scenario Identity

- Scenario id: `m4.core_vertical_slice.borrowed_shadow_lamps.v1`
- Requested seed: `4`
- Planned authoritative scenario seed: implementation task must derive and
  record this from the existing seeded scenario rules.
- Target closeout horizon: at least one full dusk-to-dawn crisis chain plus a
  recovery window, with a long-run invariant horizon defined by the M4 benchmark
  task.
- Single player-understandable rule to prove: a borrowed shadow can only take a
  stable identity from a person who crosses an unclaimed dusk lamp gap without a
  confirmed Chronicle identity record; a maintained linked lamp boundary plus a
  confirmed name entry prevents that claim.

This rule is intentionally narrow. M4 must prove that Wuming Town's lamp,
Chronicle, obligation, anomaly, and director systems can compose without asking
the player to learn an entire bestiary or governance simulator.

## Playable Rule-Discovery Path

The scenario starts from the reviewed M3 ordinary-life baseline and adds one
east-road boundary lamp cluster, one traveler, one lampkeeper obligation, one
Chronicle case file, and one borrowed-shadow crisis state machine.

The intended player-readable path is:

1. Dusk approaches while ordinary M3 life continues. A road lamp has low fuel
   because a lampkeeper oil obligation is overdue.
2. Rain and the overdue obligation cause one boundary lamp to lose
   `humanClaim`, creating a bounded `shadowGap` between two linked lamps.
3. A traveler crosses the gap. The town has only weak testimony for the
   traveler's name, so Chronicle identity evidence remains unconfirmed.
4. The borrowed shadow creates low-risk evidence before harm: mismatched
   footprints at the lamp edge, an inconsistent witness statement, a duplicate
   name in the lodging register, and a cold lamp trace.
5. Residents do not automatically act on the hypothesis. They can obey only
   confirmed rules or an explicit temporary town rule accepted by the player.
6. The player can inspect the lamp, interview witnesses, preserve the trace,
   confirm the traveler's identity in the Chronicle, fulfill the oil
   obligation, and issue a temporary "confirm names before answering a third
   night knock" town rule.
7. If the player closes the lamp gap and confirms the name before the second
   night escalation, the borrowed shadow is revealed and contained without
   combat. If not, it can claim social standing, create a debt dispute, and
   trigger a crisis chain that still produces a structured accident review.
8. After the chain resolves or causes harm, the director enters a recovery
   window. During recovery it may surface repair opportunities, but it cannot
   erase evidence, forgive obligations, spawn unrelated pressure, or rewrite
   anomaly state.
9. Dawn review materializes the same structured facts used by tests: lamp
   status changes, evidence rows, hypothesis changes, obligation decisions,
   town-rule compliance or violation, resident choices, crisis transitions, and
   avoidable links in the chain.

## Included Systems

- Lamp network rule fields: linked boundary lamps, fuel/wick/damage facts,
  maintenance responsibility, `humanClaim`, `shadowGap`, and dirty-region
  updates. Visual brightness remains a projection.
- Chronicle evidence: case file, observations, testimony, traces, sources,
  hypotheses, contradictions, confirmed rule and dissemination rows. Evidence
  support is structured and tiered, not a hidden probability truth.
- Obligations and town rules: one lampkeeper oil obligation, one guesthouse
  witness duty, one temporary night-knock policy, explicit compliance and
  violation reasons, and visible costs.
- Anomaly and crisis chain: a borrowed-shadow rule graph with activation,
  trace, preference, constraint, exchange, propagation, resolution, and
  consequence state.
- Director recovery window: pressure and recovery timing based on aggregate
  metrics only, with no direct mutation of facts.
- Focused save/replay, Worker/headless parity, benchmarks, invariants, and
  read-only Worker projections for the scenario.

## Explicit Non-Goals

- No M5 content catalog, three-anomaly roster, faction campaign, broad
  governance simulation, season event pool, data-mod production, or alpha
  content framework.
- No combat-first resolution. Security and night watch may observe, contain,
  escort, or isolate, but broad combat systems are not the M4 proof.
- No public save compatibility promise, platform save UI, new save codec,
  public Worker protocol redesign, schema migration, package-boundary change,
  or new runtime dependency without a separate reviewed gate.
- No UI authority. React, Pixi, Electron, overlays, and read-model consumers
  may display lamp/evidence/crisis state only.
- No full-map, all-entity, all-evidence, all-obligation, all-crisis, or
  all-incident scan during normal ticks or actor thinking.
- No coroutine, Promise, closure, UI-local, or thread-local crisis progress.
  Crisis and job progress must be explicit serializable state.
- No M5 task creation or implementation from this scenario contract.

## Authority And State Boundaries

Simulation Worker or Node headless remains the only authoritative writer. The
scenario may introduce owner stores for M4 facts only through downstream
implementation tasks. Derived indexes, Worker projections, debug overlays,
ReasonTrace views, dawn review summaries, and UI panels rebuild from owner
stores and carry source versions.

The scenario must preserve the M3 baseline evidence:

- M3 scenario id `m3.ordinary_life.injured_caregiver.v1`
- requested seed `3`
- authoritative scenario seed `46`
- command stream hash `0x226832d2`
- content hash `0xdfe7107e`
- long-run final world hash `0x7eb81a69`
- final M3 benchmark read-model hash `0x82bf87d6`
- reviewed benchmark artifact
  `coordination/artifacts/WM-0059/benchmarks/benchmark-results.json`
- reviewed artifact SHA-256
  `63FAEA795D04934838C306DC99D9AA1152B56D52C38D123C3442DB496F82CEC3`

M4 may add new facts, but it must not regress M0-M3 invariants or weaken the
10 percent warning and 20 percent blocking benchmark thresholds.

## Required Evidence At M4 Closeout

- A deterministic headless run for
  `m4.core_vertical_slice.borrowed_shadow_lamps.v1` with recorded seed, content
  hash, command stream hash, final world hash, and final read-model hash.
- A replayable dusk-to-dawn chain where the rule can be inferred from
  structured evidence before irreversible harm.
- Focused save at a named tick and resume at the next tick, matching
  uninterrupted replay through the scenario horizon.
- Browser Worker and Node headless parity at M4 checkpoint ticks with read-only
  projection hashes.
- Benchmark artifact including lamp dirty backlogs, evidence case counts,
  obligation due/violation counts, crisis transition counts, director recovery
  windows, Worker projection bytes, save/load rebuild timing, and M0-M3
  regression evidence.
- Dawn review output whose facts are derived from the same ReasonTrace and
  owner-store rows asserted by tests.

## WM-0067 Headless Scenario Note

`pnpm sim:run -- --seed 4 --scenario m4-core-vertical-slice --ticks 36000`
now runs scenario id `m4.core_vertical_slice.borrowed_shadow_lamps.v1`.
The requested seed `4` derives authoritative scenario seed `50`; the current
fixture evidence hashes are:

- content hash `0x698f2c41`
- command stream hash `0x538d0e43`
- final world hash `0xc201a925`
- read-model hash `0xce261d9d`

The WM-0067 fixture composes the reviewed M4 owner stores directly. It queries
lamp gaps through the WM-0062 gap index, confirms the identity rule through
Chronicle evidence support, reads due obligation and town-rule compliance
candidates through bounded WM-0064 APIs, drives the borrowed-shadow crisis
state machine through prevention, low-risk evidence, containment and failure,
and selects a lamp-repair recovery descriptor through the WM-0066 director
recovery lane. Prevention, containment, and failure are separate branch
fixtures: containment and failure activation candidates are registered from
unconfirmed branch owner state before any later branch-local repair,
confirmation, or accident-review facts. Dawn-review rows are structured numeric
source rows with reason codes; they are not save authority or UI-only prose.

This implementation intentionally does not add focused save/resume, Worker
projection parity, benchmark baseline changes, public protocol/schema changes,
or M5 content. The deterministic artifact for this task is
`coordination/artifacts/WM-0067/m4-core-vertical-slice-summary.json`.
