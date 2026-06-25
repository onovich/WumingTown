# M3 Ordinary Life Simulation Plan

Status: proposed by WM-0045. Downstream tasks remain `proposed` until their
dependencies are reviewed, integrated, and marked done. No M3 runtime
implementation starts in WM-0045.

## Objective

M3 turns the M2 work/logistics foundation into ordinary town life simulation:
needs, rest, food, injury and illness, medical care, abilities, mood,
relationships, day/night, and weather basics.

The closeout target is deliberately concrete:

- One injured resident can lose work capacity, create medical care work,
  consume logistics support, change mood, and affect at least one relationship.
- Day/night and basic weather alter scheduling, needs, mood, and work context
  through deterministic owner-state and indexed projections.
- Every important decision, interruption, and failure is explainable through
  shared structured reason data.

## Non-Negotiable Boundaries

- Simulation Worker or Node headless remains the only authoritative world
  writer.
- UI, Pixi, React, and Electron consume read models only.
- `sim-core` remains free of DOM, React, PixiJS, Electron, Node filesystem,
  real time, and ambient randomness.
- The simulation remains fixed 30 TPS with seeded random streams, stable
  iteration order, and integer or fixed-point semantics.
- Actor thinking must use spatial indexes, work/need/medical/social candidate
  indexes, and bounded Top-K selection. No pawn may scan the full map or all
  entities during normal thinking.
- Jobs remain explicit serializable state machines. Coroutine, Promise chain,
  closure, UI, or thread-local execution position is not acceptable job state.
- Important failures produce structured reason codes and bounded ReasonTrace
  data. "No work", "path failed", and "condition failed" are not sufficient.
- Hot paths must not allocate objects, arrays, closures, or strings per entity
  per tick.
- Save/replay and Worker parity are gates, not cleanup tasks after feature
  completion.
- Derived indexes, caches, read models, and UI projections rebuild from owner
  stores and versioned invalidation. They are never authoritative state.
- Implementer and final reviewer remain separate.

## Scope

Included:

- Need state for hunger, rest, comfort, social, and safety on a 0-1000 integer
  scale with scheduled, phase-staggered updates.
- Rest and sleep jobs, including interruption rules and scheduling interaction
  with day/night.
- Food and eating jobs built on existing logistics/reservation foundations,
  without broad economy or content catalog expansion.
- Health condition owner stores for injury and illness, plus ability cache
  invalidation for consciousness, movement, manipulation, sight,
  communication, and stamina.
- Medical care work offers and explicit treatment jobs for the focused M3
  scenario.
- Mood, thought, and memory lanes that derive from facts and feed structured
  risk/status outputs.
- Relationship graph events and social thoughts needed to show ordinary life
  consequences.
- Day/night and basic weather owner state sufficient to affect schedules,
  needs, work context, and explanations.
- Focused M3 save/replay, Worker/headless parity, benchmarks, invariants, and
  closeout evidence.

Excluded:

- M4 lamp network, Chronicle evidence gameplay, anomaly rules, crisis chains,
  director product work, dawn replay productization, and strange visitor
  systems.
- Broad economy, production catalog expansion, platform save UI, and public
  save compatibility promises beyond focused M3 harnesses.
- Public Worker protocol redesign, schema migrations, new runtime
  dependencies, or cross-package architecture changes unless a separate
  reviewed gate approves them.
- Content production or balance beyond named fixtures needed for deterministic
  scenarios.

## Current M2 Facts

M2 closed with reviewed evidence for indexed work selection, Region/A*
integration, reservation contention cleanup, storage hauling, build/order
scaffolding, focused save/replay, Worker/headless parity, and long-run
benchmark invariants. The final M2 scenario
`m2.work_logistics.lantern_yard.v1` ran to 100000 ticks with seed `2` and final
world hash `0x9e689c8d`.

M3 must compose these capabilities. It must not replace owner stores with a
monolithic pawn brain, UI state, or unversioned derived caches.

## Architecture Gate

`WM-0047` is the visible M3 architecture gate. It must produce the M3 ADR before
implementation tasks run. The proposed ADR path is
`coordination/decisions/ADR-0008.md`, but WM-0045 does not create that decision
record because this task is only the planning package.

The M3 architecture gate must document:

- owner stores for needs, rest/sleep, food/eating, health conditions, ability
  cache, medical care, mood/thoughts/memory, relationships, day/night, and
  weather;
- derived indexes, dirty queues, candidate caps, Top-K limits, and versioned
  invalidation;
- serializable job-driver boundaries for rest, eating, and treatment;
- save/replay section scope for focused M3 harnesses and the block point for
  public save compatibility;
- Worker/headless parity expectations without UI authority;
- alternatives, migration, rollback, test, and performance implications.

Alternatives the ADR must evaluate:

- A monolithic per-pawn "life brain" that scans all facts each decision cycle.
  This is expected to be rejected because it hides state ownership and creates
  scan risk.
- UI-owned life/status state. This is expected to be rejected because authority
  belongs only to Simulation Worker or Node headless.
- Store-owned facts with derived indexes and bounded selection. This is the
  expected direction, but the ADR must name exact owner stores and block any
  owner gap before implementation.
- Persisting derived caches for faster resume. This is expected to be rejected
  unless a separate save-format gate approves it; load should rebuild derived
  indexes from owner stores.

Downstream implementation must block before coding if it needs a mutable fact
without a named owner store, a normal tick global scan, an unversioned cache,
public Worker protocol drift, public save/schema changes, new runtime
dependencies, package-boundary exceptions, or M4 scope.

## DAG

```text
WM-0045 M3 plan
  -> WM-0046 M3 scenario contract
      -> WM-0047 M3 architecture gate
          -> WM-0048 needs owner stores and urgency indexes
          -> WM-0049 day/night and weather basics
              -> WM-0050 rest and sleep job slice
              -> WM-0051 food and eating logistics slice
          -> WM-0052 health conditions and ability cache
              -> WM-0053 medical care job slice
          -> WM-0054 mood, thoughts, and memories
              -> WM-0055 relationship graph and social events
                  -> WM-0056 integrated ordinary-life scenario
                      -> WM-0057 M3 save/replay resume harness
                          -> WM-0058 M3 Worker/headless parity
                              -> WM-0059 M3 benchmarks and long-run invariants
                                  -> WM-0060 M3 closeout and future M4-entry prompt gate

WM-0050 depends on WM-0048 and WM-0049.
WM-0051 depends on WM-0048 and WM-0049.
WM-0053 depends on WM-0052.
WM-0054 depends on WM-0048, WM-0049, and WM-0052.
WM-0056 depends on WM-0050, WM-0051, WM-0053, and WM-0055.
```

The graph is acyclic. Scenario and architecture gates precede all runtime
implementation.

## Safe Concurrency

- After `WM-0047` is done, `WM-0048`, `WM-0049`, and `WM-0052` may run in
  parallel if the project-director assigns separate worktrees and confirms
  file ownership does not overlap.
- `WM-0050` and `WM-0051` may run in parallel after both `WM-0048` and
  `WM-0049` are done, but they must not share job-driver files without a
  project-director sequencing decision.
- `WM-0053`, `WM-0054`, and `WM-0055` should be sequenced if they touch shared
  condition/thought/reason surfaces.
- `WM-0056` is an integration scenario task and must wait for the focused
  slices. It is not a place to repair upstream owner-store design.
- Keep the project limit of no more than three write-heavy tasks active at
  once. `reviewer` remains read-only.

## Task Packet Field Contract

Each downstream task JSON includes:

- `objective`
- `allowedPaths`
- `forbiddenPaths`
- `dependsOn`
- `ownerRole`
- `reviewerRole`
- `acceptance`
- `requiredChecks`
- `benchmarkImpact`
- `reviewRouting`
- `rollbackModel`
- `ownerGate`
- `sparkEligibility`

Task JSON files are the durable control plane. The summaries below mirror their
intent; the JSON packets are authoritative for dispatch.

## Task Packets

### WM-0046 - Define M3 Ordinary-Life Scenario Contract

- Owner: `gameplay-designer`
- Reviewer: `reviewer`
- Dependencies: `WM-0045`
- Contract: `docs/02_systems/17_m3_ordinary_life_scenario.md`, scenario id
  `m3.ordinary_life.injured_caregiver.v1`
- Objective: define the executable M3 scenario contract, named fixtures, seeds,
  tick horizons, visible consequences, and non-goals.
- Acceptance focus: the scenario proves an injury affecting work, medical
  care, logistics, mood, and relationship state; day/night and weather are
  present as deterministic basics; scenario data remains small and focused.
- Benchmark impact: defines future invariant and benchmark dimensions without
  creating baselines.

### WM-0047 - Record M3 Ordinary-Life Architecture Gate

- Owner: `systems-architect`
- Reviewer: `reviewer`
- Dependencies: `WM-0046`
- Objective: record ADR-0008 for M3 state ownership, derived indexes, job
  boundaries, save/replay scope, Worker parity, migration, rollback, tests, and
  performance.
- Acceptance focus: alternatives are documented; owner stores are named before
  implementation; block conditions are explicit for scans, owner gaps,
  protocol/save/schema changes, dependencies, and M4 scope.
- Benchmark impact: names required metrics and invariant surfaces; no baseline
  update.

### WM-0048 - Add Needs Owner Stores And Urgency Indexes

- Owner: `simulation-engineer`
- Reviewer: `reviewer`
- Dependencies: `WM-0047`
- Objective: add integer need lanes, scheduled need updates, and derived
  urgency indexes for hunger, rest, comfort, social, and safety.
- Acceptance focus: updates are phase-staggered, deterministic, bounded, and
  explainable; derived indexes never own need facts.
- Benchmark impact: records candidate/index sizes and scheduled update costs.

### WM-0049 - Add Day/Night And Weather Basics

- Owner: `simulation-engineer`
- Reviewer: `reviewer`
- Dependencies: `WM-0047`
- Objective: add deterministic day/night and basic weather owner state that can
  affect schedules, needs, mood context, and work explanations.
- Acceptance focus: time derives from ticks, weather uses named seeded streams,
  and no real time or visual-only randomness enters authority.
- Benchmark impact: records scheduled system cost and read-model projection
  size.

### WM-0050 - Add Rest And Sleep Job Slice

- Owner: `simulation-engineer`
- Reviewer: `reviewer`
- Dependencies: `WM-0048`, `WM-0049`
- Objective: implement rest/sleep work selection and serializable sleep job
  drivers over existing reservation/pathing boundaries.
- Acceptance focus: tired actors seek rest through indexes, reserve valid rest
  spots, recover deterministically, and emit structured interruption reasons.
- Benchmark impact: extends need/job metrics with sleep candidate and
  interruption counters.

### WM-0051 - Add Food And Eating Logistics Slice

- Owner: `simulation-engineer`
- Reviewer: `reviewer`
- Dependencies: `WM-0048`, `WM-0049`
- Objective: implement hunger-driven eating jobs using existing item, storage,
  reservation, and pathing foundations.
- Acceptance focus: actors select food from bounded indexed candidates, reserve
  and consume integer quantities exactly once, and explain food failures.
- Benchmark impact: extends logistics conservation and candidate-cap metrics.

### WM-0052 - Add Health Conditions And Ability Cache

- Owner: `simulation-engineer`
- Reviewer: `reviewer`
- Dependencies: `WM-0047`
- Objective: add injury/illness condition owner stores and derived ability
  cache invalidation for ordinary-life ability effects.
- Acceptance focus: conditions are explicit serializable state; ability queries
  use cache invalidation rather than scanning all conditions every time.
- Benchmark impact: records condition update counts, cache invalidations, and
  ability query cost.

### WM-0053 - Add Medical Care Job Slice

- Owner: `simulation-engineer`
- Reviewer: `reviewer`
- Dependencies: `WM-0052`
- Objective: add patient and caregiver medical work offers plus explicit
  treatment job drivers for the focused M3 scenario.
- Acceptance focus: medical jobs respect ability limits, reservations, pathing,
  structured reasons, and deterministic condition changes.
- Benchmark impact: records medical offer counts, treatment job outcomes, and
  condition delta metrics.

### WM-0054 - Add Mood, Thoughts, And Memories

- Owner: `simulation-engineer`
- Reviewer: `reviewer`
- Dependencies: `WM-0048`, `WM-0049`, `WM-0052`
- Objective: add bounded thought/memory lanes and mood target/current state
  derived from ordinary-life facts.
- Acceptance focus: mood is fact-driven, deterministic, bounded, and uses
  shared structured reasons rather than UI-only strings or random event pools.
- Benchmark impact: records thought generation counts, retained trace capacity,
  and scheduled mood update cost.

### WM-0055 - Add Relationship Graph And Social Events

- Owner: `simulation-engineer`
- Reviewer: `reviewer`
- Dependencies: `WM-0054`
- Objective: add relationship edges and ordinary social event facts sufficient
  to show injury, care, food, rest, and mood consequences between residents.
- Acceptance focus: relationship changes are structured facts with stable
  ordering and bounded candidate queries; text remains presentation only.
- Benchmark impact: records relationship edge counts, event counts, and social
  candidate caps.

### WM-0056 - Integrate M3 Ordinary-Life Scenario

- Owner: `simulation-engineer`
- Reviewer: `reviewer`
- Dependencies: `WM-0050`, `WM-0051`, `WM-0053`, `WM-0055`
- Objective: compose the focused M3 scenario so one injury affects work,
  medical care, logistics, mood, and relationships under day/night/weather.
- Acceptance focus: the scenario has deterministic hashes, named reason traces,
  no leaks, no global scans, and no M4 product systems.
- Benchmark impact: establishes scenario metrics for save/replay, Worker
  parity, and long-run gates without updating baselines.

### WM-0057 - Add M3 Save/Replay Resume Harness

- Owner: `simulation-engineer`
- Reviewer: `reviewer`
- Dependencies: `WM-0056`
- Objective: add focused save/load/resume diagnostics for the M3 ordinary-life
  scenario without public save compatibility or platform save UI.
- Acceptance focus: owner-state snapshots validate before mutation, derived
  indexes rebuild before resumed ticks, and resumed hashes match uninterrupted
  replay.
- Benchmark impact: records save size, rebuild time, and divergence diagnostics.

### WM-0058 - Add M3 Worker/Headless Parity

- Owner: `simulation-engineer`
- Reviewer: `reviewer`
- Dependencies: `WM-0057`
- Objective: prove browser Worker and Node headless run the M3 scenario with
  matching authoritative hashes and read-only projections.
- Acceptance focus: UI/read models cannot mutate authority; parity diagnostics
  name seed, scenario id, checkpoint mismatches, snapshot bytes, and latency.
- Benchmark impact: records Worker parity overhead and snapshot/read-model
  sizes.

### WM-0059 - Add M3 Benchmarks And Long-Run Invariants

- Owner: `qa-performance`
- Reviewer: `reviewer`
- Dependencies: `WM-0058`
- Objective: add M3 long-run invariant and benchmark gates for ordinary-life
  simulation.
- Acceptance focus: no reservation leaks, stale offers, ability cache
  divergence, negative needs/resources, condition/mood/relationship drift, queue
  growth, hash divergence, or threshold weakening.
- Benchmark impact: creates reviewed artifacts/baselines while preserving the
  10 percent warning and 20 percent blocking regression thresholds.

### WM-0060 - Close M3 Ordinary-Life Simulation Gate

- Owner: `project-director`
- Reviewer: `reviewer`
- Dependencies: `WM-0059`
- Objective: close M3 only after scenario, architecture, implementation,
  save/replay, Worker parity, benchmark, and invariant evidence are verified
  and integrated, then produce a future M4 entry prompt handoff artifact for a
  later reviewed M4 planning task.
- Acceptance focus: closeout records hashes, artifacts, residual risks, known
  warnings, writes `coordination/reports/WM-0060-future-m4-entry-prompt.md` as
  a non-executable future handoff prompt, and confirms M4 remains unstarted.
- Benchmark impact: final M3 artifact comparison and gate verdict; no threshold
  changes.

## Migration And Rollback Model

- Before `WM-0047`, rollback is reverting planning/spec documents and proposed
  tasks.
- After `WM-0047`, implementation tasks must use owner stores and focused
  snapshot/load tests approved by the architecture gate.
- Derived indexes, caches, read models, UI projections, and benchmark summaries
  must rebuild from owner stores or artifacts; they are not authoritative save
  payloads.
- If a task discovers the need for public Worker protocol, save format, schema,
  package-boundary, dependency, or M4 work, the owner blocks instead of
  smuggling the change into an implementation branch.
- If a performance gate fails, rollback is reverting the branch and keeping the
  failed artifact as evidence. Do not merge global scans, unbounded queues, or
  threshold weakening.
- If Worker parity fails, UI/client work remains blocked. Do not move authority
  into UI or permit UI-local correction.
- If M3 closeout cannot pass, the project remains in M3 and M4 is not promoted.
- WM-0060 must create only a future M4 entry prompt handoff artifact. That
  prompt must explicitly require a later reviewed M4 planning task before any
  M4 implementation, and WM-0060 must not create, promote, claim, or implement
  M4 work.

## Test And Performance Gate Summary

Minimum M3 gate by closeout:

- Deterministic ordinary-life scenario with a named scenario id and seed.
- One injury affects work, medical care, logistics, mood, and relationships.
- Need/rest/food systems use bounded indexed thinking and integer lanes.
- Health conditions invalidate ability caches without per-query full scans.
- Mood/thought/relationship explanations use shared structured reasons.
- Day/night and weather derive from tick/seeded streams and remain
  replay-stable.
- Save interrupt/load/resume equals uninterrupted replay.
- Browser Worker and Node headless authoritative hashes match.
- Benchmarks preserve 10 percent warning and 20 percent blocking thresholds.
- M3 closeout writes a future M4 entry prompt handoff artifact while verifying
  that M4 task creation, promotion, claim, and implementation remain unstarted.

## Spark Classification

WM-0045 does not use Spark. Downstream M3 tasks are not Spark-eligible because
they define or touch architecture, deterministic simulation, job/reservation
ownership, save/replay, Worker parity, benchmark baselines, or milestone
closeout. A future tiny documentation or fixture repair may be split for
`rapid-implementer` only if it gets its own task packet and satisfies the full
classifier.
