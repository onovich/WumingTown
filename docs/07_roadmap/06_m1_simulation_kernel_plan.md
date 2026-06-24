# M1 Simulation Kernel Execution Plan

Status: closed by WM-0030. The WM-0014 through WM-0030 task chain has been independently reviewed and integrated as the M1 simulation-kernel milestone. This closeout does not start M2 product implementation.

## Objective

M1 turns the M0 engineering foundation into an authoritative, deterministic simulation kernel that can run a first gameplay scenario in both Node headless and the browser Worker. The first vertical scenario is hauling materials into a build site and completing construction. Broad content production, production chains, town-life simulation, anomaly rules, combat, UI productization and balance expansion are out of scope.

The plan is intentionally split into small task packets for independent worktrees. All new tasks are `proposed`; none should be promoted to `ready` until their dependencies are done and project workflow explicitly allows promotion.

The executable contract for the first vertical scenario is `docs/02_systems/15_m1_hauling_building_scenario.md`. Downstream hauling, building, replay and benchmark tasks must treat that contract as the fixture source unless a reviewed task explicitly updates it.

## Non-Negotiable Boundaries

- Simulation Worker or Node headless owns all authoritative world state.
- UI, Pixi, Electron and React consume read models only.
- `sim-core` must not depend on DOM, React, PixiJS, Electron, Node filesystem, real time or ambient randomness.
- Pawn thinking and work selection must not scan the whole map or all entities.
- Jobs must be explicit serializable state machines, not Promise, Generator, coroutine or closure execution positions.
- Hot paths must not allocate per entity per tick.
- All important failures must produce structured reason codes and shared ReasonTrace data.
- Save, replay and Worker parity are first-class gates, not cleanup work after the scenario.

## Visible Architecture Gates

There is no hidden architecture blocker in this plan. The architecture decisions that must exist before implementation are made explicit as proposed tasks:

- `WM-0015`: proposed `ADR-0003` for M1 Entity/Store memory layout and state ownership.
- `WM-0016`: proposed `ADR-0005` for Save Container v1.
- `WM-0017`: proposed `ADR-0004` for Worker snapshot/read-model encoding.
- `WM-0018`: proposed `ADR-0006` for deterministic numeric and tick-phase contracts.

These ADR tasks must record alternatives, migration, rollback, verification and performance implications. They are not accepted by this document. No human approval blocker was found under `docs/08_codex/05_human_approval_gates.md`, because this plan stays inside the approved roadmap and does not change platform, language, renderer, simulation-thread model, server/account/telemetry policy, code-mod policy, public release status or save-compatibility commitments.

If any ADR cannot be accepted by project-director + systems-architect + reviewer, downstream implementation remains `proposed` and the responsible agent must block through `taskctl block`.

## DAG

```text
WM-0012
  -> WM-0014 scenario contract
  -> WM-0015 ADR-0003 entity/store layout
  -> WM-0016 ADR-0005 save container v1
  -> WM-0017 ADR-0004 Worker snapshot encoding
  -> WM-0018 ADR-0006 deterministic numeric/phase contracts

WM-0015 + WM-0018
  -> WM-0019 map grid + chunk dirty queues
  -> WM-0020 spatial indexes + lifecycle cleanup

WM-0019 + WM-0020
  -> WM-0021 region/room rebuild + navigation versions

WM-0018 + WM-0021
  -> WM-0022 versioned path request batching + Top-K pathing

WM-0015 + WM-0018 + WM-0020
  -> WM-0023 reservation ledger + atomic transactions

WM-0014 + WM-0020 + WM-0021 + WM-0023
  -> WM-0024 WorkOffer indexes + bounded ReasonTrace

WM-0016 + WM-0022 + WM-0023 + WM-0024
  -> WM-0025 serializable Job Driver state machines

WM-0014 + WM-0025
  -> WM-0026 minimal item/storage hauling jobs
  -> WM-0027 build-site delivery + construction completion

WM-0016 + WM-0017 + WM-0027
  -> WM-0028 save/replay + Worker/headless parity harness
  -> WM-0029 M1 benchmark suite + long-run invariants
  -> WM-0030 M1 closeout gate
```

Safe concurrency after WM-0012:

- `WM-0014` to `WM-0018` are documentation/decision tasks and may run in parallel in separate worktrees.
- `WM-0022` and `WM-0023` may run in parallel after their dependencies are accepted because pathing and reservation have separate ownership surfaces.
- Keep no more than three write-heavy tasks active at once, and do not run two tasks that both change the same package files without an explicit integration owner.

## Task Packets

### WM-0014 - Hauling/Building Scenario Contract

- Owner: `gameplay-designer`
- Depends on: `WM-0012`
- Allowed scope: scenario spec, fixture bounds, seed/command/tick horizon, invariant list, reason expectations, task acceptance refinements.
- Forbidden scope: runtime implementation, broad production chains, item/content catalog expansion beyond named test fixture needs.
- Observable acceptance: one concrete hauling/building scenario contract with map bounds, pawns, storage/source stacks, build site, command stream, expected end state, failure reasons, pillar guardrails and no-leak invariants.
- Required checks: `taskctl validate`, `validate-handoff`, `git diff --check`.
- Benchmark impact: defines scenario dimensions used by later benchmark filters; no baseline change.
- Docs update: `docs/02_systems/15_m1_hauling_building_scenario.md`, this plan, AI/jobs, logistics and testing docs if the scenario contract exposes gaps.

### WM-0015 - ADR-0003 Entity/Store Memory Layout

- Owner: `systems-architect`
- Depends on: `WM-0012`, `WM-0007`
- Allowed scope: proposed ADR only, public contracts, alternatives, migration and rollback plan.
- Forbidden scope: accepted decision without review, implementation, UI-owned state, hidden singleton stores.
- Observable acceptance: proposed ADR names authoritative owners for map location, item quantity, job core, reservation ledger and cleanup hooks.
- Required checks: `taskctl validate`, `validate-handoff`, `git diff --check`.
- Benchmark impact: must define what map/store/index benchmarks will measure and which hot-path allocations are forbidden.
- Docs update: ADR index and `coordination/decisions/ADR-0003.md`.

### WM-0016 - ADR-0005 Save Container v1

- Owner: `systems-architect`
- Depends on: `WM-0012`, `WM-0008`
- Allowed scope: proposed save container sections, schema/version ownership, validation and index rebuild sequence.
- Forbidden scope: implemented serializer, external codec dependency, accepted save compatibility promise beyond M1.
- Observable acceptance: proposed ADR covers `MapChunks`, `EntityStores`, `JobsReservations`, `RandomStreams` and `CommandLogTail`, with load validation before resumed ticks.
- Required checks: `taskctl validate`, `validate-handoff`, `git diff --check`.
- Benchmark impact: must state save/load size and migration timing measurements for later tasks.
- Docs update: ADR index and `coordination/decisions/ADR-0005.md`.

### WM-0017 - ADR-0004 Worker Snapshot Encoding

- Owner: `systems-architect`
- Depends on: `WM-0012`, `WM-0005`
- Allowed scope: proposed snapshot/read-model/metrics contract and stale sequence handling.
- Forbidden scope: protocol implementation, UI mutation privileges, SharedArrayBuffer requirement without deployment decision.
- Observable acceptance: proposed ADR keeps Worker authoritative, defines read-only projections and specifies Node/Worker hash parity tests.
- Required checks: `taskctl validate`, `validate-handoff`, `git diff --check`.
- Benchmark impact: must define snapshot size, dropped snapshot count, latency and backpressure measurements.
- Docs update: ADR index and `coordination/decisions/ADR-0004.md`.

### WM-0018 - ADR-0006 Deterministic Numeric and Phase Contracts

- Owner: `systems-architect`
- Depends on: `WM-0012`, `WM-0006`, `WM-0008`
- Allowed scope: proposed integer/fixed-point, command phase, stable ordering and async version contracts.
- Forbidden scope: new PRNG implementation, changing 30 TPS, changing existing accepted M0 determinism behavior without review.
- Observable acceptance: proposed ADR states numeric scales for map cost, job progress, quantities and scoring, plus stale async rejection rules.
- Required checks: `taskctl validate`, `validate-handoff`, `git diff --check`.
- Benchmark impact: must declare deterministic measurement points and where sorting/candidate caps are allowed.
- Docs update: ADR index and `coordination/decisions/ADR-0006.md`.

### WM-0019 - Map Grid and Chunk Dirty Queues

- Owner: `simulation-engineer`
- Depends on: `WM-0015`, `WM-0018`
- Allowed scope: `packages/sim-core`, focused benchmarks/tests, public exports, docs for map storage and dirty queues.
- Forbidden scope: renderer/UI maps, Pixi display objects, pathfinding, jobs, reservations, save container finalization.
- Observable acceptance: contiguous numeric map storage, chunk metadata, terrain/occupancy/walk/region/room/version fields, local dirty queues and stable world-hash input.
- Required checks: `pnpm typecheck`, `pnpm test --filter map-grid`, `pnpm bench --filter map-dirty`, `taskctl validate`, `git diff --check`.
- Benchmark impact: adds map dirty/rebuild budget benchmark and queue-length reporting.
- Docs update: map/space doc, performance budget notes and this plan if scope changes.

### WM-0020 - Spatial Indexes and Location Lifecycle

- Owner: `simulation-engineer`
- Depends on: `WM-0019`
- Allowed scope: location stores, cell/chunk/region indexes, lifecycle cleanup tests and benchmark.
- Forbidden scope: WorkOffer selection, reservation semantics, path search, UI overlays.
- Observable acceptance: entities have exactly one map or container membership, movement/despawn/destroy cleanup is explicit, indexed queries avoid global scans, 50k inert entities do not grow queues or memory.
- Required checks: `pnpm typecheck`, `pnpm test --filter spatial-index`, `pnpm bench --filter spatial-index`, `taskctl validate`, `git diff --check`.
- Benchmark impact: adds 50k spatial index benchmark and cleanup invariants.
- Docs update: entity/store, map/space and performance constitution references.

### WM-0021 - Region/Room Rebuild and Navigation Versions

- Owner: `simulation-engineer`
- Depends on: `WM-0019`, `WM-0020`
- Allowed scope: local invalidation, Region graph, Room ids, navigation version fields and rebuild budget.
- Forbidden scope: full-map synchronous rebuilds in normal ticks, path request queue, gameplay jobs.
- Observable acceptance: wall/door/terrain changes mark affected chunks/regions, Room remains consistent, navigation versions change deterministically and old versions can be detected.
- Required checks: `pnpm typecheck`, `pnpm test --filter region-room`, `pnpm bench --filter region-room`, `taskctl validate`, `git diff --check`.
- Benchmark impact: adds dirty-region/room rebuild benchmark with processed-cell and backlog metrics.
- Docs update: map/space doc and performance budget.

### WM-0022 - Versioned Path Request Batching and Top-K Pathing

- Owner: `simulation-engineer`
- Depends on: `WM-0018`, `WM-0021`
- Allowed scope: Region coarse paths, local A\*, batched requests, candidate caps, stale result rejection.
- Forbidden scope: Pawn world scans, long-lived complete path caches across navigation versions, reservation acquisition.
- Observable acceptance: path requests carry navigation versions, stale results are discarded, only bounded Top-K work candidates receive exact paths, 100-path stress benchmark reports queue behavior.
- Required checks: `pnpm typecheck`, `pnpm test --filter pathing`, `pnpm bench --filter pathing-100`, `taskctl validate`, `git diff --check`.
- Benchmark impact: adds 100-path benchmark, node expansion counts and stale-result counters.
- Docs update: AI/jobs/pathing, map/space and performance budget.

### WM-0023 - Reservation Ledger and Atomic Transactions

- Owner: `simulation-engineer`
- Depends on: `WM-0015`, `WM-0018`, `WM-0020`
- Allowed scope: reservation ledger, transaction API, explicit release, destroy/cancel cleanup, save fields and tests.
- Forbidden scope: work selection policy, pathfinding, job driver implementation beyond test harnesses.
- Observable acceptance: entity/cell/quantity/interaction/capacity reservations acquire atomically or leave no partial state; leases are recovery-only; reason codes distinguish conflicts.
- Required checks: `pnpm typecheck`, `pnpm test --filter reservations`, `pnpm bench --filter reservations`, `taskctl validate`, `git diff --check`.
- Benchmark impact: adds contention/capacity benchmark and leak counters.
- Docs update: AI/jobs/reservations and save/replay docs.

### WM-0024 - WorkOffer Indexes and Bounded ReasonTrace

- Owner: `simulation-engineer`
- Depends on: `WM-0014`, `WM-0020`, `WM-0021`, `WM-0023`
- Allowed scope: state-change-driven WorkOffer registration, indexed lookup, bounded candidate scoring input, shared ReasonTrace data.
- Forbidden scope: full content production, unbounded sorts, Pawn x WorkType x AllEntities scans, UI-only explanation logic.
- Observable acceptance: offers are indexed by work type, region, def, urgency and permission; reason traces record candidate counts, filters, rejection reasons and selected offer with bounded storage.
- Required checks: `pnpm typecheck`, `pnpm test --filter work-offers`, `pnpm bench --filter work-offers`, `taskctl validate`, `git diff --check`.
- Benchmark impact: adds 100-pawn/10k-offer thinking benchmark with candidate cap metrics.
- Docs update: AI/jobs/pathing, observability and performance docs.

### WM-0025 - Serializable Job Driver State Machines

- Owner: `simulation-engineer`
- Depends on: `WM-0016`, `WM-0022`, `WM-0023`, `WM-0024`
- Allowed scope: explicit Job/Driver state machine core, interruption policy, cleanup, structured failures and save/load fields.
- Forbidden scope: coroutine/promise/generator execution state, broad job catalog, production orders.
- Observable acceptance: every step defines enter/tick/complete/fail/cancel/save fields; interruption cleanup covers reservations and carried state; save/load resumes at the same explicit step and hash.
- Required checks: `pnpm typecheck`, `pnpm test --filter jobs`, `pnpm sim:replay-test`, `taskctl validate`, `git diff --check`.
- Benchmark impact: extends job-step metrics and replay checkpoint cost reporting.
- Docs update: AI/jobs/reservations, save/replay and observability docs.

### WM-0026 - Minimal Item, Storage and Hauling Jobs

- Owner: `simulation-engineer`
- Depends on: `WM-0014`, `WM-0025`
- Allowed scope: minimal item stacks, storage demand/supply indexes, hauling job path for the vertical scenario.
- Forbidden scope: broad economy, crafting, production orders, balance tuning, content catalog expansion beyond fixture needs.
- Observable acceptance: item quantities cannot duplicate or go negative; hauling reserves source amount, destination capacity and interaction cells before pickup; cancellation does not leak carried items; the hauling portions of `m1.hauling_building.road_lantern_frame.v1` satisfy the scenario contract.
- Required checks: `pnpm typecheck`, `pnpm test --filter hauling`, `pnpm bench --filter logistics-10k`, `taskctl validate`, `git diff --check`.
- Benchmark impact: adds 10k logistics benchmark and item/reservation leak counters.
- Docs update: logistics/production and AI/jobs docs.

Implementation note: WM-0026 adds `ItemStackStore`,
`StorageLogisticsIndex`, `HaulingJobStore`, `pnpm test --filter hauling` and
`pnpm bench --filter logistics-10k`. It remains inside the hauling half of the
vertical scenario; build-site completion and construction progress stay in
WM-0027.

### WM-0027 - Build-Site Delivery and Construction Completion

- Owner: `simulation-engineer`
- Depends on: `WM-0014`, `WM-0026`
- Allowed scope: minimal build-site demand, material delivery, deterministic build progress and map/entity result.
- Forbidden scope: production chains, building catalog, UI construction tools, balance/content expansion.
- Observable acceptance: build site demand creates WorkOffers, delivered material converts once, progress uses deterministic integer ticks, completion commits through command phases, failures are structured; `m1.hauling_building.road_lantern_frame.v1` reaches the expected tick-2400 end state.
- Required checks: `pnpm typecheck`, `pnpm test --filter building`, `pnpm sim:run -- --seed 1 --scenario hauling-building --ticks 100000`, `taskctl validate`, `git diff --check`.
- Benchmark impact: turns hauling/building into the first long-run scenario target.
- Docs update: logistics/production, AI/jobs and map/space docs.

Implementation note: WM-0027 adds `BuildSiteStore`,
`runHaulingBuildingScenario`, `pnpm test --filter building` and
`pnpm sim:run -- --seed 1 --scenario hauling-building --ticks 100000`. The
scope remains the M1 road-lantern-frame slice: build-site material buffers are
not general storage supply, and completion creates only an unlit pending-fuel
road lantern frame.

### WM-0028 - M1 Save/Replay and Worker/Headless Parity Harness

- Owner: `simulation-engineer`
- Depends on: `WM-0016`, `WM-0017`, `WM-0027`
- Allowed scope: save/load harness, replay checkpoints, Worker/headless parity tests, diagnostics.
- Forbidden scope: UI mutation, platform save UI, changing Worker authority, cross-version save promise beyond ADR scope.
- Observable acceptance: Node and browser Worker run the same hauling/building command stream to identical periodic hashes; save-interrupt-load-resume matches uninterrupted replay; diagnostics name seed, scenario, divergent tick and artifacts.
- Required checks: `pnpm typecheck`, `pnpm test --filter m1-save-replay`, `pnpm test:e2e --filter worker-smoke`, `pnpm sim:replay-test`, `taskctl validate`, `git diff --check`.
- Benchmark impact: measures save/load size, rebuild time, Worker latency and parity overhead.
- Docs update: Worker protocol, save/replay and CI observability docs.

Implementation note: WM-0028 adds the focused M1 save/replay harness,
`pnpm test --filter m1-save-replay`, Worker/headless parity coverage in
`worker-smoke`, and M1 artifacts in `pnpm sim:replay-test`. The implementation
uses the hauling-building scenario runner and a minimal validated M1 envelope;
it does not implement full save compatibility, platform save UI, WM-0029
benchmarks or WM-0030 closeout.

### WM-0029 - M1 Benchmark Suite and Long-Run Invariants

- Owner: `qa-performance`
- Depends on: `WM-0028`
- Allowed scope: benchmark filters, baseline artifact update, long-run invariants, CI artifact metadata.
- Forbidden scope: weakening thresholds, silent retries, product behavior changes to satisfy tests.
- Observable acceptance: benchmarks cover dirty map rebuild, spatial index, 100 paths, 10k logistics, reservations and hauling/building; long-run covers leaks, stale refs, negative resources, queue growth, save round-trip and hash divergence.
- Required checks: `pnpm typecheck`, `pnpm test --filter m1-invariants`, `pnpm bench`, `pnpm sim:run -- --seed 1 --scenario hauling-building --ticks 100000`, `taskctl validate`, `git diff --check`.
- Benchmark impact: updates `packages/benchmarks/baseline.json` through reviewed artifacts while preserving 10 percent warning and 20 percent blocking thresholds.
- Docs update: performance budget, testing/CI and this roadmap plan if gates change.

Implementation note: WM-0029 adds the `m1-hauling-building-long-run` benchmark,
`pnpm test --filter m1-invariants`, WM-0029 benchmark artifact metadata, and the
explicit artifact-backed `map-dirty` canonical hash refresh to `0xba7253ca`.
The benchmark artifact lives at
`coordination/artifacts/WM-0029/benchmarks/benchmark-results.json`; warning and
blocking thresholds remain 10 percent and 20 percent. The repaired WM-0029
evidence path samples the idle window after the tick-2400 terminal state so
long-run queue/reference invariants are sourced from repeated post-terminal
observations. WM-0030 closeout has not started.

### WM-0030 - M1 Simulation Kernel Closeout

- Owner: `project-director`
- Depends on: `WM-0029`
- Allowed scope: integration gate, roadmap/quality-gate status, M1 closeout report and next-entry criteria.
- Forbidden scope: implementing missed features during closeout, marking tasks done without independent review, hiding residual risk.
- Observable acceptance: headless 100k tick hauling/building is reproducible, browser Worker and Node hashes match, 50k inert entities show no sustained queue/memory growth, residual risks and benchmark artifacts are documented.
- Required checks: frozen install, `pnpm ci:local`, web/desktop builds, hauling/building 100k run, `pnpm bench`, `validate-handoff`, `taskctl validate`, `git diff --check`.
- Benchmark impact: final M1 benchmark comparison and closeout evidence.
- Docs update: roadmap, milestone quality gates and closeout report.

Implementation note: WM-0030 records the M1 gate evidence without adding new
simulation behavior. The closeout verifies the 100000-tick hauling/building
hash `0xf7815189`, browser Worker/Node parity, save/replay diagnostics,
50000-entity spatial-index pressure invariants, web and desktop builds, and
the final M1 benchmark artifact. It also prepares an M2 entry prompt for a
future reviewed planning task; M2 remains unstarted.

## Migration and Rollback Model

- Before ADR acceptance, rollback is abandoning the task branch or proposed ADR files.
- Before `WM-0016`, no external save file compatibility is promised for M1 state.
- After Save Container v1 is accepted, every state-bearing implementation must include version fields and load/migration tests or declare non-persistent scratch data.
- If a performance gate fails, rollback is reverting the task branch and keeping the benchmark artifact as evidence. Do not merge temporary global scans or unbounded queues with a promise to optimize later.
- If Worker parity fails, UI/client work remains blocked; do not move authority into the UI or allow UI-local corrections to world state.

## Test and Performance Gate Summary

Minimum M1 gate by closeout:

- Headless hauling/building: `100000` ticks, same seed and command stream, reproducible final hash.
- Worker parity: browser Worker and Node headless produce identical authoritative hashes.
- Empty/inert entity pressure: `50000` entities, no sustained queue or memory growth.
- Path pressure: 100 concurrent path requests with versioned stale-result rejection.
- Logistics pressure: 10k item/storage offers with no full-world work scan.
- Dirty map pressure: local wall/door/terrain invalidation with bounded rebuild backlog.
- Save/replay: interruption save, load, index rebuild and resume matches uninterrupted replay.
- Benchmarks preserve the current 10 percent warning and 20 percent blocking regression thresholds.

WM-0030 satisfied this M1 gate summary through the closeout checks and
artifacts recorded in `coordination/reports/WM-0030.md`. Any M2 work must start
from a new reviewed plan/task DAG rather than extending this closeout task.

## Spark Classification

WM-0012 and the early ADR tasks are not Spark-eligible because they define architecture, save format, Worker protocol, deterministic contracts and state ownership. Later small fixture or documentation repairs may be Spark-eligible only after an accepted spec exists and a separate proposed task lists allowed paths, forbidden paths and complete automated acceptance. Spark must never own final review.
