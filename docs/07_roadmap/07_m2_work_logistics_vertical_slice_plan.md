# M2 Work/Logistics Vertical Slice Plan

Status: proposed by WM-0032. This plan is a control-plane artifact only. It does not start M2 implementation, does not claim any implementation task, and does not start M3.

## Objective

M2 turns the M1 hauling/building foundation into a multi-actor work/logistics vertical slice. The slice must prove that indexed work selection, versioned pathing, reservations, storage hauling, build-order scaffolding, save/replay, Worker parity, and benchmarks hold together under contention.

The stricter M2 closeout target for this plan is:

- 20 actors hauling/building over a long-run scenario without reservation leaks, stale work offers, negative resources, unbounded queue growth, or hash divergence.
- 100 path requests under versioned invalidation, including stale-result rejection and bounded node/candidate budgets.
- Save interrupt/load/resume parity with uninterrupted replay.
- Browser Worker and Node headless authoritative parity.

## Non-Negotiable Boundaries

- Simulation Worker or Node headless remains the only authoritative world writer.
- UI, Pixi, React and Electron consume read models only.
- `sim-core` remains free of DOM, React, PixiJS, Electron, Node filesystem, real time and ambient randomness.
- Work selection must use spatial/work indexes and bounded Top-K candidate selection; no pawn full-map or all-entity scans.
- Jobs remain explicit serializable state machines; no Promise, Generator, coroutine, closure, or UI-held execution position.
- All important failures must produce structured reason codes and shared ReasonTrace data.
- Hot paths must not allocate per entity per tick.
- Save/replay and Worker parity are gates, not cleanup after implementation.
- Derived indexes and caches must be rebuilt from owner stores and versioned invalidation; no unversioned cache is authoritative.
- Implementer and final reviewer remain separate.

## Scope

Included:

- Region/A* integration into real work selection.
- Multi-pawn WorkOffer scoring with bounded candidate caps.
- Reservation behavior under contention.
- Item storage and hauling beyond the M1 fixture.
- Build orders and production-order scaffolding only as needed for the vertical slice.
- Save/replay and Worker parity for the M2 vertical slice.
- Benchmarks for 20 actors hauling/building plus 100 path requests under versioned invalidation.

Excluded:

- Broad economy simulation.
- Town-life needs, health, mood, relationships, day/night/weather simulation.
- Anomaly rules, combat, crisis chains, and M4 lamp/social gameplay.
- Platform save UI, public save compatibility promises beyond the focused harness, and cross-version migration commitments not approved by an ADR.
- Content catalog expansion and balance production beyond named fixtures.
- M3 task creation or implementation.

## Current M1 Facts

M1 closed with reviewed evidence for deterministic stores, map grids, spatial indexes, region/room rebuilds, versioned path requests, reservations, WorkOffer indexes, serializable JobCore, minimal hauling/building, save/replay, Worker parity, and benchmark-backed long-run invariants.

M2 must compose these pieces at scale instead of replacing owner stores or moving authority into UI/client layers.

## Architecture Gate

`WM-0034` is the visible M2 architecture gate. It must record state ownership, public contract boundaries, alternatives, migration, rollback, test, and performance implications before implementation tasks can run. If `WM-0034` cannot be accepted, downstream implementation remains `proposed` or blocked through `taskctl block`.

## DAG

```text
WM-0032 M2 plan
  -> WM-0033 M2 scenario contract
      -> WM-0034 M2 work/logistics architecture gate
          -> WM-0035 Region/A* work-selection integration
              -> WM-0036 multi-pawn WorkOffer scoring
          -> WM-0037 reservation contention hardening
          -> WM-0038 storage and hauling beyond M1 fixture
              -> WM-0039 build-order and production-order scaffold
                  -> WM-0040 M2 save/replay resume harness
                      -> WM-0041 M2 Worker/headless parity
                          -> WM-0042 M2 benchmarks and long-run invariants
                              -> WM-0043 M2 closeout gate

WM-0038 depends on WM-0036 and WM-0037.
WM-0039 depends on WM-0038.
```

The graph is acyclic and remains inside M2. No task creates or starts M3.

## Safe Concurrency

- `WM-0035` and `WM-0037` may run in parallel after `WM-0034` is done because path/work-selection integration and reservation contention touch separate ownership surfaces. Integration risk remains with downstream `WM-0038`.
- Do not run two write-heavy tasks that touch the same `packages/sim-core/src` files without a project-director integration decision.
- Keep the project limit: no more than three write-heavy tasks active at once.
- `reviewer` remains read-only and cannot be the implementer.

## Task Packet Field Contract

Every new task JSON includes:

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

The task JSONs are the durable control-plane packets. The summaries below mirror their intent.

## Task Packets

### WM-0033 - Define M2 Work/Logistics Scenario Contract

- Owner: `gameplay-designer`
- Reviewer: `reviewer`
- Dependencies: `WM-0032`
- Objective: define the executable M2 scenario contract and invariants for 20 actors hauling/building and 100 versioned path requests.
- Scenario contract: `docs/02_systems/16_m2_work_logistics_scenario.md` with id `m2.work_logistics.lantern_yard.v1`.
- Allowed paths: scenario/system docs, M2 roadmap plan, WM-0033 task/report.
- Forbidden paths: product/runtime/test implementation, package manifests, lockfiles, broad content/economy/town-life/anomaly/combat/UI implementation.
- Acceptance: fixture bounds, actor/item/storage/build-order setup, command stream, seeds, tick horizons, structured reason expectations, invariants, and non-goals are explicit.
- Required checks: `taskctl validate`, `validate-handoff`, `git diff --check`, `pnpm quality`.
- Benchmark impact: defines benchmark dimensions and invariant names without changing baselines.
- Review routing: owner completes to `reviewer`; project-director integrates only after verification.
- Rollback: revert docs/task/report; no runtime state exists.
- Spark eligibility: no. This is scenario/specification design.

### WM-0034 - Record M2 Work/Logistics Architecture Gate

- Owner: `systems-architect`
- Reviewer: `reviewer`
- Dependencies: `WM-0033`
- Objective: record the architecture decision surface for M2 owner stores, derived indexes, cache/version boundaries, save/replay scope, and Worker parity.
- Allowed paths: ADR/decision docs, M2 system/roadmap docs, WM-0034 task/report.
- Forbidden paths: runtime implementation, accepted public protocol/save format/schema changes without review, new dependencies, package manifests, UI authority.
- Acceptance: alternatives, chosen boundaries, migration, rollback, tests, benchmarks, and block conditions are documented.
- Required checks: `taskctl validate`, `validate-handoff`, `git diff --check`, `pnpm quality`.
- Benchmark impact: names required metrics and regression thresholds; no baseline update.
- Review routing: reviewer verifies; downstream implementation cannot proceed if rejected.
- Rollback: revert ADR/docs; downstream tasks stay proposed.
- Spark eligibility: no. This is architecture, state ownership, save/replay, and performance boundary work.

### WM-0035 - Integrate Region/A* Into Work Selection

- Owner: `simulation-engineer`
- Reviewer: `reviewer`
- Dependencies: `WM-0034`
- Objective: make real work selection consume region reachability, local A*, stale-result rejection, and bounded exact pathing.
- Allowed paths: focused `sim-core` pathing/work-offer/map surfaces, focused tests, benchmark filters, docs and report.
- Forbidden paths: UI mutation, Worker protocol changes, save format changes, broad job/economy features, unversioned path caches.
- Acceptance: only indexed caller-supplied candidates are path-resolved; stale version bases reject before job mutation; structured path/work reasons are emitted.
- Required checks: `pnpm typecheck`, focused path/work-selection tests, 100-path and M2 path benchmarks, `taskctl validate`, `git diff --check`.
- Benchmark impact: extends 100-path evidence under invalidation and records candidate/path node caps.
- Review routing: reviewer verifies; systems-architect blocks any public contract drift.
- Rollback: revert task branch and benchmark additions; do not merge global scans as temporary fixes.
- Spark eligibility: no. It touches deterministic pathing and work-selection architecture.

### WM-0036 - Scale WorkOffer Scoring For Multiple Pawns

- Owner: `simulation-engineer`
- Reviewer: `reviewer`
- Dependencies: `WM-0035`
- Objective: scale WorkOffer scoring/selection to multiple pawns with deterministic tie-breaking, bounded visits, and ReasonTrace evidence.
- Allowed paths: focused WorkOffer/job candidate code, focused tests/benchmarks, observability docs and report.
- Forbidden paths: broad town-life policy, unbounded sort/scans, UI-only explanations, production catalog expansion.
- Acceptance: 20 actors select work from indexed buckets within caps; contention rejections are structured; no actor scans all offers/entities.
- Required checks: `pnpm typecheck`, focused WorkOffer tests, M2 20-pawn scoring benchmark, `taskctl validate`, `git diff --check`.
- Benchmark impact: adds/extends 20-pawn work-selection metrics for visited/scored candidates, cap hits, selected offers and traces.
- Review routing: reviewer verifies; qa-performance must be able to reproduce metrics.
- Rollback: revert branch and benchmark artifact changes; preserve M1 WorkOffer behavior.
- Spark eligibility: no. It is deterministic simulation and performance-sensitive selection logic.

### WM-0037 - Harden Reservation Contention And Cleanup

- Owner: `simulation-engineer`
- Reviewer: `reviewer`
- Dependencies: `WM-0034`
- Objective: prove reservations remain atomic and leak-free under M2 multi-actor contention.
- Allowed paths: reservation ledger, job cleanup call sites, focused tests/benchmarks, docs and report.
- Forbidden paths: work policy selection, pathfinding redesign, UI-owned reservation state, lease-as-normal-control-flow behavior.
- Acceptance: multi-target claims are all-or-nothing; cancel/fail/load/destroy paths release claims; reasons distinguish conflict classes.
- Required checks: `pnpm typecheck`, focused reservation contention tests, reservation contention benchmark, `taskctl validate`, `git diff --check`.
- Benchmark impact: extends contention metrics for accepted/rejected transactions, conflicts, cleanup releases and final active claims.
- Review routing: reviewer verifies; systems-architect must review any owner-store or save-shape drift.
- Rollback: revert task branch; do not weaken atomicity or leak checks.
- Spark eligibility: no. It touches concurrency ownership and deterministic cleanup.

### WM-0038 - Expand Storage And Hauling Beyond The M1 Fixture

- Owner: `simulation-engineer`
- Reviewer: `reviewer`
- Dependencies: `WM-0036`, `WM-0037`
- Objective: support M2 storage supply/demand and hauling beyond the single M1 fixture while preserving integer quantity ownership.
- Allowed paths: item stack, storage logistics index, hauling jobs, scenario fixtures, focused tests/benchmarks, docs and report.
- Forbidden paths: broad economy, crafting/balance production, content catalog expansion, platform/UI save tools, duplicate quantity ownership.
- Acceptance: multiple sources/destinations update indexes from owner-state changes; hauling cannot duplicate, lose or go negative; cancellation restores carried quantities exactly once.
- Required checks: `pnpm typecheck`, focused storage/hauling tests, M2 logistics benchmark, `taskctl validate`, `git diff --check`.
- Benchmark impact: extends logistics metrics beyond 10k fixture with dirty backlog, conservation, reservation, and candidate cap evidence.
- Review routing: reviewer verifies; qa-performance confirms artifact reproducibility when benchmark baselines move.
- Rollback: revert branch and keep M1 hauling fixture intact.
- Spark eligibility: no. It touches state ownership, reservations, and deterministic logistics.

### WM-0039 - Add Build-Order And Production-Order Scaffold

- Owner: `simulation-engineer`
- Reviewer: `reviewer`
- Dependencies: `WM-0038`
- Objective: add only the build-order and production-order scaffolding required by the M2 vertical slice.
- Allowed paths: build-site/order scaffold code, scenario fixture, focused tests/benchmarks, docs and report.
- Forbidden paths: broad production chains, balance tables, building catalog expansion, rituals/investigation production, UI construction tools.
- Acceptance: build/order demand registers WorkOffers, reserves required inputs, stores serializable progress, emits structured reasons, and completes deterministically.
- Required checks: `pnpm typecheck`, focused build/order tests, M2 scenario sim run, `taskctl validate`, `git diff --check`.
- Benchmark impact: feeds the M2 long-run benchmark but does not independently bless a baseline.
- Review routing: reviewer verifies; gameplay-designer should be consulted only for fixture semantics, not broad content expansion.
- Rollback: revert branch; no persisted compatibility promise beyond focused harness.
- Spark eligibility: no. It defines serializable jobs and production-order scaffolding.

### WM-0040 - Add M2 Save/Replay Resume Harness

- Owner: `simulation-engineer`
- Reviewer: `reviewer`
- Dependencies: `WM-0039`
- Objective: extend focused save/replay diagnostics to the M2 vertical slice without promising platform save UI or broad compatibility.
- Allowed paths: focused save/replay harness, replay diagnostics, scenario artifacts, tests, docs and report.
- Forbidden paths: platform save UI, public save container compatibility promises, schema changes without architecture approval, unversioned derived cache persistence.
- Acceptance: interrupt/save/load/resume matches uninterrupted M2 replay; load validates versions and rebuilds derived indexes before ticks resume.
- Required checks: `pnpm typecheck`, focused M2 save/replay tests, M2 replay diagnostics, `taskctl validate`, `git diff --check`.
- Benchmark impact: records save size, rebuild time, resume divergence diagnostics and hash checkpoints.
- Review routing: reviewer verifies; systems-architect blocks any save-format or migration scope expansion.
- Rollback: revert focused M2 harness; M1 save/replay remains intact.
- Spark eligibility: no. It touches save/replay and migration boundaries.

### WM-0041 - Add M2 Worker/Headless Parity

- Owner: `simulation-engineer`
- Reviewer: `reviewer`
- Dependencies: `WM-0040`
- Objective: prove browser Worker and Node headless run the M2 scenario with matching authoritative hashes and read-only projections.
- Allowed paths: Worker/headless parity tests, read-model metrics, focused sim-core exports, docs and report.
- Forbidden paths: UI world mutation, Worker protocol redesign without architecture approval, Electron/preload expansion, platform save UI.
- Acceptance: Worker and Node consume the same command stream; authoritative hashes match; stale snapshots are read-only and cannot correct world state.
- Required checks: `pnpm typecheck`, focused M2 parity tests, `pnpm test:e2e --filter worker-smoke`, `taskctl validate`, `git diff --check`.
- Benchmark impact: records Worker latency, snapshot size and parity overhead for M2.
- Review routing: reviewer verifies; client-engineer may inspect read-model usage but not own simulation authority.
- Rollback: revert M2 parity additions; keep M1 Worker smoke intact.
- Spark eligibility: no. It touches Worker parity and authority boundaries.

### WM-0042 - Add M2 Benchmarks And Long-Run Invariants

- Owner: `qa-performance`
- Reviewer: `reviewer`
- Dependencies: `WM-0041`
- Objective: add the M2 benchmark and invariant gate for 20 actors hauling/building plus 100 path requests under invalidation.
- Allowed paths: benchmark suite, invariant tests, scenario artifacts, performance/testing docs, report and task packet.
- Forbidden paths: product behavior fixes, threshold weakening, silent retries, broad feature implementation.
- Acceptance: 20 actors and 100 paths pass with no leaks, stale offers, queue growth, negative resources, conservation failures, or hash divergence; artifact metadata is complete.
- Required checks: `pnpm typecheck`, focused M2 invariant tests, `pnpm bench`, M2 100000-tick sim run, `taskctl validate`, `git diff --check`.
- Benchmark impact: updates reviewed benchmark artifacts/baselines while preserving 10 percent warning and 20 percent blocking thresholds.
- Review routing: reviewer verifies artifact evidence; project-director integrates only after full gate evidence is present.
- Rollback: revert benchmark/baseline changes and leave M2 unclosed.
- Spark eligibility: no. It owns performance baselines and long-run evidence.

### WM-0043 - Close M2 Work/Logistics Gate

- Owner: `project-director`
- Reviewer: `reviewer`
- Dependencies: `WM-0042`
- Objective: close M2 only after independent evidence confirms the work/logistics vertical-slice gates.
- Allowed paths: roadmap/status docs, closeout report, coordination task state/report files.
- Forbidden paths: product/runtime implementation, hidden fixes during closeout, M3 task creation, M3 implementation claims.
- Acceptance: closeout names hashes, artifacts, benchmark results, residual risks, and confirms all M2 tasks are verified/integrated/done.
- Required checks: `pnpm ci:local`, `pnpm bench`, M2 100000-tick sim run, `validate-handoff`, `taskctl validate`, `taskctl status`, `git diff --check`, `pnpm quality`.
- Benchmark impact: final M2 artifact comparison and gate verdict; no threshold changes.
- Review routing: reviewer verifies; project-director integrates and closes only after review.
- Rollback: leave M2 open and do not promote M3.
- Spark eligibility: no. It is a milestone closeout and final coordination gate.

## Migration And Rollback Model

- Before `WM-0034`, rollback is reverting planning/spec documents and proposed tasks.
- After `WM-0034`, state-bearing implementation tasks must either use existing save sections safely or include versioned snapshot/load tests approved by that architecture gate.
- Derived indexes, path caches, WorkOffer rows, read models, and UI projections must rebuild from owner stores; they are never authoritative save payloads.
- If a performance gate fails, rollback is reverting the task branch and keeping the failed artifact as evidence. Do not merge temporary global scans, unbounded queues, or threshold weakening.
- If Worker parity fails, UI/client work remains blocked; do not move authority into UI or permit UI-local world correction.
- If M2 closeout cannot pass, the project remains in M2; no M3 work is promoted.

## Test And Performance Gate Summary

Minimum M2 gate by closeout:

- 20 actors hauling/building in the M2 scenario with deterministic final hash.
- 100 path requests under versioned invalidation, with stale rejects and queue metrics.
- Indexed work selection with bounded visits, no `Pawn x WorkType x AllEntities` behavior.
- Reservation contention with all-or-nothing transactions and terminal cleanup.
- Item/storage hauling with integer material conservation.
- Build/order scaffold with serializable progress and structured reasons.
- Save interrupt/load/resume equals uninterrupted replay.
- Browser Worker and Node headless authoritative hashes match.
- Benchmarks preserve 10 percent warning and 20 percent blocking regression thresholds.

## Spark Classification

WM-0032 did not use Spark. The first-wave M2 tasks are not Spark-eligible because they define or touch architecture, deterministic simulation, job/reservation ownership, save/replay, Worker parity, benchmark baselines, or milestone closeout. Future tiny documentation or fixture repair tasks may be split for `rapid-implementer` only if they satisfy the full Spark classifier and have their own task packet.
