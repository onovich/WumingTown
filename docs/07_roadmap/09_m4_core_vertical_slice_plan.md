# M4 Core Vertical Slice Plan

Status: planning package created by WM-0061 and awaiting independent review.
Runtime implementation remains unstarted. No M5 task is created by this plan.

## Objective

M4 proves the first distinct Wuming Town product loop: the player can infer and
respond to one lamp-network anomaly rule through Chronicle evidence,
obligations, town rules, crisis state, director recovery windows, save/replay,
Worker/headless parity, and benchmarked invariants.

The closeout target is concrete:

- Scenario id `m4.core_vertical_slice.borrowed_shadow_lamps.v1`.
- The player can understand that a borrowed shadow can claim identity only from
  an unclaimed dusk lamp gap plus an unconfirmed Chronicle identity record.
- The chain can be prevented or explained through lamp maintenance, evidence
  confirmation, temporary town rules, and obligation fulfillment.
- Dawn review explains the causal chain with structured facts, not prose-only
  UI logic.

## Non-Negotiable Boundaries

- Simulation Worker or Node headless remains the only authoritative world
  writer.
- UI, Pixi, React, Electron, overlays, and read-model consumers are read-only.
- `sim-core` remains free of DOM, React, PixiJS, Electron, Node filesystem,
  real time, and ambient randomness.
- M4 must not replace M0-M3 owner stores with a monolithic director brain.
- Actor, crisis, obligation, and director choices use bounded indexed
  candidates and stable Top-K ordering.
- Job and crisis progress are explicit serializable state machines.
- Key failures produce structured reasons and bounded ReasonTrace rows.
- Hot paths do not allocate per entity, lamp, evidence row, obligation, crisis,
  or tick.
- Focused save/replay and Worker parity are gates, not cleanup tasks.
- Public Worker protocol, public save compatibility, schema migration, package
  boundary changes, new runtime dependencies, and M5 content remain blocked
  unless a separate reviewed gate approves them.

## Scope

Included:

- Lamp network owner state for linked lamps, maintenance, `humanClaim`, and
  bounded `shadowGap` dirty propagation.
- Chronicle evidence owner state for case files, observations, testimony,
  traces, sources, hypotheses, contradictions, confirmed rules, and
  dissemination.
- Obligations and one temporary town-rule slice for lamp oil duty, lodging
  witness duty, name confirmation, and night-knock compliance.
- A borrowed-shadow anomaly/crisis state machine with low-risk evidence,
  escalation, non-combat containment, failure, and dawn review rows.
- Story director pressure and recovery windows that schedule legal commands
  but cannot mutate owner facts directly.
- Integrated scenario, focused save/replay, Worker projection parity,
  benchmarks, invariants, and closeout evidence.

Excluded:

- M5 alpha content framework, multiple anomaly roster, faction campaign, season
  event pool, broad governance system, production content catalog, and data-mod
  pipeline expansion.
- Combat-first resolution or broad security systems beyond focused watch and
  containment hooks needed for the scenario.
- Product UI implementation beyond read-only projections required by Worker
  parity evidence.
- Public save compatibility, platform save UI, public Worker protocol redesign,
  schema migration, package-boundary exceptions, dependencies, or broad
  migration promises.

## Current M3 Baseline

M3 closed with reviewed evidence:

- ordinary-life scenario id `m3.ordinary_life.injured_caregiver.v1`
- requested seed `3`
- authoritative scenario seed `46`
- command stream hash `0x226832d2`
- content hash `0xdfe7107e`
- long-run final world hash `0x7eb81a69`
- final read-model hash `0x82bf87d6`
- save tick/load tick `12000` / `12001`
- Worker parity checkpoints `0`, `3600`, `7200`, `12000`, `18000`, `36000`
- benchmark artifact
  `coordination/artifacts/WM-0059/benchmarks/benchmark-results.json`
- benchmark artifact SHA-256
  `63FAEA795D04934838C306DC99D9AA1152B56D52C38D123C3442DB496F82CEC3`

M4 implementation must compose this baseline. Any M0-M3 regression blocks M4
closeout unless a separate reviewed task explains and accepts the change.

## Architecture Gate

`coordination/decisions/ADR-0009.md` is the M4 architecture gate. Downstream
tasks must cite it and block rather than code through:

- owner-store gaps;
- normal-tick global scans;
- hidden shared state or unversioned caches;
- UI authority;
- direct director mutation of facts;
- coroutine, Promise, closure, UI-local, or thread-local crisis/job progress;
- public Worker protocol, save/schema, package-boundary, dependency, or M5
  needs.

## DAG

```text
WM-0061 M4 planning package
  -> WM-0062 lamp network owner stores and rule fields
      -> WM-0063 Chronicle evidence owner stores
          -> WM-0064 obligations and town-rule slice
              -> WM-0065 borrowed-shadow anomaly and crisis chain
                  -> WM-0066 director pressure and recovery windows
                      -> WM-0067 integrated M4 core scenario
                          -> WM-0068 M4 focused save/replay
                              -> WM-0069 M4 Worker projections and parity
                                  -> WM-0070 M4 benchmarks and invariants
                                      -> WM-0071 M4 closeout and future M5 prompt
```

The graph is acyclic. `WM-0062` depends on this reviewed planning task. No
runtime M4 implementation starts inside WM-0061.

## Safe Concurrency

The first M4 chain is intentionally mostly serial because each owner surface is
used by the next one. The project-director may split small read-only review or
research work in parallel, but write tasks should not overlap until the owning
stores and public exports are stable. `reviewer` remains read-only.

`rapid-implementer` is not appropriate for the planned M4 tasks because they
touch deterministic simulation ownership, architecture gates, save/replay,
Worker projections, benchmarks, or milestone closeout. A later tiny fixture or
documentation repair may be split only if it gets its own task and satisfies
the Spark classifier.

## Task Packet Field Contract

Each M4 task JSON includes:

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

Task JSON files are the durable dispatch authority. Summaries below mirror the
packet intent.

## Task Packets

### WM-0062 - Add M4 Lamp Network Owner Stores

- Owner: `simulation-engineer`
- Reviewer: `reviewer`
- Dependencies: `WM-0061`
- Objective: add authoritative lamp network state for linked lamps,
  maintenance, `humanClaim`, `shadowGap`, dirty queues, metrics, and structured
  reasons.
- Acceptance focus: lamp rule fields are simulation-owned integers, visual
  light is derived, dirty updates are bounded, and no full-map diffusion enters
  normal ticks.
- Benchmark impact: focused metrics only; baseline update waits for WM-0070.

### WM-0063 - Add Chronicle Evidence Owner Stores

- Owner: `simulation-engineer`
- Reviewer: `reviewer`
- Dependencies: `WM-0062`
- Objective: add case files, evidence facts, hypotheses, contradictions,
  confirmed-rule gates, dissemination, and evidence reason traces.
- Acceptance focus: evidence is structured and versioned, not probability truth
  or UI-only prose; residents act only on known confirmed rules or explicit
  temporary policies.
- Benchmark impact: records evidence row counts and candidate caps.

### WM-0064 - Add Obligations And Town-Rule Slice

- Owner: `simulation-engineer`
- Reviewer: `reviewer`
- Dependencies: `WM-0063`
- Objective: add focused obligation and town-rule owner state for lampkeeper
  oil duty, lodging witness duty, name confirmation, and night-knock
  compliance.
- Acceptance focus: due windows, fulfillment, violation, compliance, and
  enforcement are explicit facts with structured reasons and bounded indexes.
- Benchmark impact: records due-obligation and compliance candidate metrics.

### WM-0065 - Add Borrowed-Shadow Anomaly And Crisis Chain

- Owner: `simulation-engineer`
- Reviewer: `reviewer`
- Dependencies: `WM-0064`
- Objective: add the borrowed-shadow anomaly rule graph and explicit crisis
  state machine for the focused scenario.
- Acceptance focus: activation depends on lamp gap plus Chronicle identity
  state, escalation creates low-risk evidence before harm, and resolution is
  non-combat-capable.
- Benchmark impact: records crisis transition counts and state-machine
  invariants.

### WM-0066 - Add Director Recovery Windows

- Owner: `simulation-engineer`
- Reviewer: `reviewer`
- Dependencies: `WM-0065`
- Objective: add bounded director pressure sampling, incident/recovery
  candidate selection, cooldowns, and recovery windows.
- Acceptance focus: director schedules legal commands only, emits rejection
  reasons, and cannot mutate owner facts or hide consequences.
- Benchmark impact: records director candidate/rejection/recovery metrics.

### WM-0067 - Integrate M4 Core Scenario

- Owner: `simulation-engineer`
- Reviewer: `reviewer`
- Dependencies: `WM-0066`
- Objective: compose the focused dusk-to-dawn M4 scenario and headless command
  path.
- Acceptance focus: scenario proves the rule-discovery path, records hashes,
  explains prevention and failure, and preserves M0-M3 invariants.
- Benchmark impact: produces scenario metrics for save/replay, Worker parity,
  and benchmark tasks without baseline updates.

### WM-0068 - Add M4 Save/Replay Resume Harness

- Owner: `simulation-engineer`
- Reviewer: `reviewer`
- Dependencies: `WM-0067`
- Objective: add focused save/load/resume diagnostics for the M4 scenario.
- Acceptance focus: owner-state snapshots validate before mutation, all
  derived M4 surfaces rebuild before resumed ticks, and hashes match
  uninterrupted replay.
- Benchmark impact: records save bytes, load validation, rebuild time, and
  divergence diagnostics.

### WM-0069 - Add M4 Worker Projections And Parity

- Owner: `simulation-engineer`
- Reviewer: `reviewer`
- Dependencies: `WM-0068`
- Objective: prove Node Worker and browser Worker parity for M4 read-only
  projections.
- Acceptance focus: Worker projections include lamp/evidence/obligation/crisis
  basis metadata and hashes while UI remains read-only.
- Benchmark impact: records projection bytes and Worker message latency.

### WM-0070 - Add M4 Benchmarks And Invariants

- Owner: `qa-performance`
- Reviewer: `reviewer`
- Dependencies: `WM-0069`
- Objective: add M4 benchmark and long-run invariant gates while preserving
  the 10 percent warning and 20 percent blocking thresholds.
- Acceptance focus: artifact-backed evidence covers lamp dirty backlogs,
  evidence drift, obligation leaks, crisis validity, director recovery windows,
  save/replay, Worker parity, and M0-M3 regression protection.
- Benchmark impact: creates reviewed M4 artifact and baseline changes only.

### WM-0071 - Close M4 And Write Future M5 Prompt

- Owner: `project-director`
- Reviewer: `reviewer`
- Dependencies: `WM-0070`
- Objective: close M4 after all implementation, parity, replay, benchmark, and
  invariant evidence is reviewed, then write a non-executable future M5 entry
  prompt.
- Acceptance focus: closeout records hashes, artifacts, residual risks, known
  warnings, M0-M3 regression status, and confirms no M5 task is created or
  implemented.
- Benchmark impact: final M4 gate verdict; no threshold changes.

## Performance And Invariant Plan

M4 adds measurement surfaces without weakening existing thresholds. Every
benchmark comparison keeps the current policy: more than 10 percent P95
regression requires explanation, and more than 20 percent blocks merge by
default.

M4 invariant categories:

- M0-M3 regression: existing headless hashes, focused tests, Worker parity
  expectations, save/replay discipline, and benchmark thresholds remain valid.
- Lamp network: no sustained dirty backlog, no visual-authority mutation, no
  invalid `humanClaim` range, no stale `shadowGap` after maintenance.
- Chronicle: no evidence row drift, invalid support tier, unresolved fatal
  contradiction on confirmed rule, or dissemination mismatch.
- Obligations and rules: no due-index leak, fulfillment double-apply,
  violation without source event, compliance without knowledge, or hidden
  mechanical condition in text.
- Crisis: no invalid transition, no escalation without required lamp/evidence
  basis, no terminal-state resurrection, and no hidden progress state.
- Director: no recovery-window violation, direct fact mutation, unbounded
  candidate list, or unnamed random draw.
- Save/replay and Worker: no divergent hash, stale projection acceptance,
  unrebuilt derived surface, or UI repair path.

## Migration And Rollback Model

- Before implementation, rollback is reverting the WM-0061 planning files,
  ADR-0009, roadmap/project-state markers, and proposed WM-0062 through WM-0071
  packets.
- Downstream implementation adds owner stores incrementally. Derived indexes,
  Worker projections, dawn review rows, and UI summaries rebuild from owner
  facts and are not authoritative save payloads.
- If a task discovers a need for public Worker protocol, public save/schema,
  dependency, package-boundary, UI authority, global scans, hidden shared
  state, or M5 content, it blocks and routes to systems-architect/project-
  director instead of coding through it.
- If M4 closeout cannot pass, the project remains in M4 and no M5 task is
  promoted. WM-0071 may write only a future M5 entry prompt.
