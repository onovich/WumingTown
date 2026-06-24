# M2 Work/Logistics Scenario Contract

Status: proposed by WM-0033. This is a testable scenario contract, not runtime implementation.

Scenario id: `m2.work_logistics.lantern_yard.v1`

## Purpose And Non-Goals

This scenario is the executable M2 contract for multi-actor work and logistics.
It expands the M1 hauling/building fixture into a bounded 20-actor yard where
workers move materials from source stacks into a depot, feed four lantern
boundary build sites, complete deterministic build work, and exercise 100
versioned path requests while navigation versions change.

Canon boundary:

- Canon pillar: the build targets are road-lantern boundary frames. The scenario
  preserves lantern boundary data so later lighting, human-claim and night-risk
  systems can consume it.
- Canon pillar: chronicle knowledge is not advanced by this logistics scenario.
  Observable clues and counterevidence exist only to make work selection and
  rejection explainable; they do not create case files or confirmed rules.
- Canon pillar: obligations and social consequences stay at zero in this
  scenario. Future tasks that add consequences must create data records with
  source event, visible parties, due terms, violation conditions and legal basis.

Provisional fixture and balance:

- All map dimensions, quantities, path budgets, candidate caps, participation
  counters, progress costs and tick horizons below are provisional M2 fixture
  values for automated tests. They are not production balance.
- No final world hash value is fixed by WM-0033. Implementation tasks must
  record deterministic hashes once the scenario runner exists, then compare
  replay, save/resume and Worker/headless hashes for equality.

Explicit non-goals:

- No broad economy simulation, town-life needs, health, mood, relationships,
  day/night/weather, anomaly rules, combat, crisis chains, platform save UI,
  content catalog expansion, balance production or M3 work.
- No arbitrary stat bonuses, hidden faction deltas, prose-only events, scripted
  terminal states, or hand-authored queue cleanup.
- No implementation work starts from this document. Downstream work remains
  gated by WM-0034 architecture review and the M2 implementation task DAG.

## Fixture Bounds

Simulation rate: fixed `30` TPS.

Seeds:

- Primary seed: `33`.
- Required secondary seeds for deterministic replay smoke: `34`, `35`.
- Random stream ids: `scenario.fixture`, `actor.think`, `work.selection`,
  `path.probe`, `reservation.tie_break`. The fixture must be deterministic if
  no random draw is needed.

Map:

- Size: `40 x 24` cells.
- Coordinates: `x = 0..39`, `y = 0..23`.
- Out-of-bounds cells are forbidden for pathing, placement, storage, build sites
  and reservations.
- Fixed walkable yard bounds are cells inside `x=1..38`, `y=1..22` except named
  blocked cells and invalidation gates below.
- Static blocked cells: `x=18`, `y=2..21`, except openings `(18,6)`, `(18,12)`
  and `(18,18)`. These openings force meaningful route choice without requiring
  full-map scanning.
- Versioned invalidation gates:
  - `gate.north`: cells `(18,6)`, `(18,7)`.
  - `gate.center`: cells `(18,12)`, `(18,13)`.
  - `gate.south`: cells `(18,18)`, `(18,19)`.
  Toggling any gate updates map, navigation, region, room and region-graph
  versions. Stale path results with an older basis must be rejected before job
  mutation.

Named cells:

| Id                         | Cell(s)              | Purpose |
| -------------------------- | -------------------- | ------- |
| `source.wood.west.*`       | `(3,4)..(3,7)`       | Wood source stack slots |
| `source.stone.west.*`      | `(5,4)..(5,7)`       | Stone source stack slots |
| `source.paper.west.0`      | `(4,8)`              | Binding-paper source stack |
| `source.decoy.0`           | `(6,8)`              | Counterevidence item that must not satisfy any build socket |
| `depot.boundary.*`         | `(13,9)..(15,14)`    | Intermediate storage destination |
| `build.nw.anchor`          | `(28,5)`             | Lantern boundary build site |
| `build.ne.anchor`          | `(34,6)`             | Lantern boundary build site |
| `build.sw.anchor`          | `(27,17)`            | Lantern boundary build site |
| `build.se.anchor`          | `(35,18)`            | Lantern boundary build site |
| `inspect.old_marker`       | `(31,12)`            | Decoy old marker, not a build order |
| `path.probe.origin.*`      | `(8,3)..(8,22)`      | Deterministic path request origins |
| `path.probe.target.*`      | `(32,3)..(32,22)`    | Deterministic path request targets |

Build interaction cells:

- Each build anchor owns its four cardinal interaction cells if in bounds and
  walkable.
- At least two interaction cells per build site must remain reachable in the
  primary scenario.
- Interaction cell reservations are exclusive per tick owner/job pair and must
  be released on completion, cancellation, failure, target invalidation and load.

## Initial Entities

Items:

| Entity id                 | Def                         | Location group          | Count |
| ------------------------- | --------------------------- | ----------------------- | ----: |
| `item.wood.0`             | `m2.item.wood`              | `source.wood.west.0`    |  `32` |
| `item.wood.1`             | `m2.item.wood`              | `source.wood.west.1`    |  `32` |
| `item.wood.2`             | `m2.item.wood`              | `source.wood.west.2`    |  `32` |
| `item.wood.3`             | `m2.item.wood`              | `source.wood.west.3`    |  `32` |
| `item.stone.0`            | `m2.item.stone`             | `source.stone.west.0`   |  `16` |
| `item.stone.1`            | `m2.item.stone`             | `source.stone.west.1`   |  `16` |
| `item.stone.2`            | `m2.item.stone`             | `source.stone.west.2`   |  `16` |
| `item.stone.3`            | `m2.item.stone`             | `source.stone.west.3`   |  `16` |
| `item.paper.0`            | `m2.item.binding_paper`     | `source.paper.west.0`   |   `8` |
| `item.decoy.oil_tag.0`    | `m2.item.oil_tag_decoy`     | `source.decoy.0`        |   `1` |

Storage:

- `storage.source.west` owns all source slots. Source slots accept only their
  initial item def in this fixture.
- `storage.boundary.depot` owns `depot.boundary.*`, accepts only
  `m2.item.wood`, `m2.item.stone` and `m2.item.binding_paper`, and is the only
  general storage destination.
- Depot target terminal remainder after all builds complete:
  - `m2.item.wood`: `32`
  - `m2.item.stone`: `16`
  - `m2.item.binding_paper`: `0`
- Build-site material buffers are not general storage supply. They accept only
  materials declared by their owning build order.

Build/order targets:

- Order id: `order.boundary_lantern_row.0`.
- The order activates four build sites: `build.site.nw`, `build.site.ne`,
  `build.site.sw`, `build.site.se`.
- Each site def: `m2.build.road_lantern_frame`.
- Each completed building def: `m2.building.road_lantern_frame`.
- Each site requires:
  - `m2.item.wood`: `24`
  - `m2.item.stone`: `12`
  - `m2.item.binding_paper`: `2`
- Each site requires `240` integer build work ticks after all sockets are full.
- Completion result: one unlit lantern boundary frame at the anchor with
  `lanternClaimKind = road_lantern_boundary_frame` and
  `lanternState = unlit_pending_fuel`.
- No site may consume `m2.item.oil_tag_decoy`, `inspect.old_marker`, or any
  material not declared by the build order.

Actors:

| Entity id          | Start   | Carry capacity | Allowed work |
| ------------------ | ------- | -------------: | ------------ |
| `actor.worker.00`  | `(9,4)` |            `4` | haul, build  |
| `actor.worker.01`  | `(9,5)` |            `4` | haul, build  |
| `actor.worker.02`  | `(9,6)` |            `4` | haul, build  |
| `actor.worker.03`  | `(9,7)` |            `4` | haul, build  |
| `actor.worker.04`  | `(9,8)` |            `4` | haul, build  |
| `actor.worker.05`  | `(9,9)` |            `4` | haul, build  |
| `actor.worker.06`  | `(9,10)` |           `4` | haul, build  |
| `actor.worker.07`  | `(9,11)` |           `4` | haul, build  |
| `actor.worker.08`  | `(9,12)` |           `4` | haul, build  |
| `actor.worker.09`  | `(9,13)` |           `4` | haul, build  |
| `actor.worker.10`  | `(9,14)` |           `4` | haul, build  |
| `actor.worker.11`  | `(9,15)` |           `4` | haul, build  |
| `actor.worker.12`  | `(9,16)` |           `4` | haul, build  |
| `actor.worker.13`  | `(9,17)` |           `4` | haul, build  |
| `actor.worker.14`  | `(9,18)` |           `4` | haul, build  |
| `actor.worker.15`  | `(9,19)` |           `4` | haul, build  |
| `actor.worker.16`  | `(10,8)` |           `4` | haul, build  |
| `actor.worker.17`  | `(10,10)` |          `4` | haul, build  |
| `actor.worker.18`  | `(10,14)` |          `4` | haul, build  |
| `actor.worker.19`  | `(10,16)` |          `4` | haul, build  |

Actor constraints:

- Each actor may reserve at most one active job.
- Each actor may carry only one item def at a time in this fixture.
- Each actor must use explicit serializable Job Driver steps. Promise,
  Generator, coroutine, closure, UI state or ambient timer execution positions
  are forbidden.
- Participation assertion: by the functional horizon every actor has accepted
  at least one haul or build job, and at least `12` actors have completed one or
  more build-work ticks. This is a workload distribution assertion, not social
  favoritism or mood simulation.

## Command Stream And Horizons

The command stream is part of the replay contract. UI, Pixi, React, Electron
and preload code cannot mutate authoritative state outside these commands.

| Tick | Command |
| ---: | ------- |
| `0` | `LoadScenario(m2.work_logistics.lantern_yard.v1, seed=33)` |
| `1` | `SetWorkPermission(actor.worker.00..19, haul=true, build=true)` |
| `2` | `ActivateStorageDemand(storage.boundary.depot, wood=32, stone=16, binding_paper=0 terminal remainder)` |
| `3` | `ActivateBuildOrder(order.boundary_lantern_row.0)` |
| `10` | `SubmitPathProbeBatch(path.probe.batch.00, requests=0..24, resultDelayTicks=8)` |
| `12` | `ToggleGate(gate.center, blocked=true)` |
| `14` | `SubmitPathProbeBatch(path.probe.batch.01, requests=25..49, resultDelayTicks=8)` |
| `18` | `ToggleGate(gate.center, blocked=false)` |
| `20` | `SubmitPathProbeBatch(path.probe.batch.02, requests=50..74, resultDelayTicks=8)` |
| `21` | `ToggleGate(gate.north, blocked=true)` |
| `24` | `ToggleGate(gate.south, blocked=true)` |
| `28` | `SubmitPathProbeBatch(path.probe.batch.03, requests=75..99, resultDelayTicks=8)` |
| `30` | `ToggleGate(gate.north, blocked=false)` |
| `36` | `ToggleGate(gate.south, blocked=false)` |
| `6000` | `SaveCheckpoint(checkpoint.m2.midrun.6000)` |
| `6001` | `LoadCheckpoint(checkpoint.m2.midrun.6000)` in the resume run only |
| `6002..20000` | no external commands |
| `20001..100000` | no external commands; long-run idle invariant window |

Path probe contract:

- Exactly `100` path requests are submitted by the four batches above.
- Every request carries a full `PathVersionBasis` containing map, navigation,
  region, room and region-graph versions.
- Requests `0..99` are deterministic pairs from `path.probe.origin.*` to
  `path.probe.target.*`, cycling by ascending y then stable request id.
- At least `20` delayed results must be rejected as stale because a gate toggle
  changed the version basis before result commit.
- Non-stale results may succeed or fail with structured path reasons, but total
  exact A* node visits must respect the accepted per-request node budget.
- Path probes are diagnostics and cannot mutate jobs, reservations, items,
  build sites or actor state except for bounded metrics and ReasonTrace output.

Horizons:

- Path stress horizon: by tick `240`, all 100 path requests have either
  committed or been rejected as stale with structured reasons.
- Primary logistics horizon: by tick `20000`, the expected terminal state below
  must hold.
- Long-run M2 horizon: through tick `100000`, the completed state remains
  stable with no sustained queue, reservation, carried item, resource,
  dirty-work, path, trace or hash divergence growth.

## Expected Terminal State At Tick 20000

Required state:

- Exactly four completed `m2.building.road_lantern_frame` entities exist at
  `(28,5)`, `(34,6)`, `(27,17)` and `(35,18)`.
- Each completed building has `lanternClaimKind = road_lantern_boundary_frame`
  and `lanternState = unlit_pending_fuel`.
- No active build site remains actionable for the four anchors.
- Consumed-by-completed-building totals are:
  - `m2.item.wood`: `96`
  - `m2.item.stone`: `48`
  - `m2.item.binding_paper`: `8`
- All source stacks for wood, stone and binding paper are empty.
- `storage.boundary.depot` contains exactly `32` wood and `16` stone, with no
  binding paper.
- `item.decoy.oil_tag.0` remains count `1` at `source.decoy.0` or an equivalent
  unchanged source slot.
- `inspect.old_marker` remains a non-actionable marker and never becomes a
  build site, storage slot or chronicle record.
- No actor is carrying an item.
- No actor has an active job, active path request, active interaction
  reservation, active item reservation, active capacity reservation or stale
  cell reservation.
- No work offer remains open for completed build sites, consumed material
  sockets, fulfilled depot remainder, or decoy marker work.
- Dirty storage, WorkOffer, path and region queues have returned to idle steady
  state after final invalidation rebuilds.
- Authoritative Node/headless, save/resume and Worker runs report matching
  checkpoint hashes for the same command stream.

Forbidden terminal state:

- Fewer or more than four completed lantern frames.
- A completed building and a still-actionable build site at the same anchor.
- Negative item counts, duplicated material, missing material, or hidden
  material creation.
- Any consumed decoy item or old marker promoted into a valid target.
- Any active reservation owned by a terminal, canceled or missing job.
- Any queued work offer whose owner store says the target is terminal,
  consumed, invalid or unreachable.
- A Worker/client correction that changes authoritative world state to hide
  divergence.

## Invariants

Material conservation:

- For each required def:
  `source_count + depot_count + build_buffer_count + carried_count +
  consumed_by_completed_building = initial_count`.
- For the decoy def:
  `source_count + carried_count + depot_count + build_buffer_count = 1`.
- Build buffers are either terminal audit records or absent with consumed totals;
  they cannot also remain as active storage supply.
- Cancellation after pickup returns carried material exactly once to a valid
  owner store or creates a structured recoverable drop through an approved
  transaction. It cannot delete or duplicate material.

Reservation:

- Hauling from source to depot reserves source item quantity, source
  interaction spot, actor carry channel, destination capacity and destination
  interaction spot atomically.
- Hauling from depot to build site reserves depot item quantity, depot
  interaction spot, actor carry channel, build-site material capacity and build
  interaction spot atomically.
- Build work reserves the build site and one build interaction spot atomically.
- Failed acquisition leaves no partial reservation.
- Normal completion, cancellation, target invalidation, actor invalidation,
  save/load cleanup and failure explicitly release reservations. Lease expiry is
  recovery-only and cannot be normal control flow.
- Terminal assertion: active reservation count is `0`, leaked reservation count
  is `0`, and every released reservation has a structured release reason.

Stale work offers and indexes:

- WorkOffer rows are derived from owner stores and rebuildable indexes. They do
  not own item, job, reservation, actor or build-site facts.
- A WorkOffer whose owner target changes version must either refresh to a valid
  row or be removed before an actor can reserve it.
- Stale offer rejection reasons must distinguish owner target terminal, owner
  version mismatch, material unavailable, capacity unavailable, permission
  denied, region unreachable, exact path failed and reservation conflict.

Bounded work selection:

- Actor thinking queries indexed offers by work type, region, def, urgency and
  permission. Full-map, all-entity or `Actor x WorkType x AllEntities` scans are
  forbidden.
- Provisional M2 candidate caps:
  - per actor think: visit at most `24` indexed offers;
  - score at most `12` offers;
  - exact-path at most `4` Top-K candidates;
  - keep at most `64` important ReasonTrace entries per scenario run.
- Cap hits are acceptable only when traces record `candidate_cap_hit` or
  `path_topk_cap_hit`; they cannot silently skip all actionable work.

Pathing and invalidation:

- Path requests and path results carry map, navigation, region, room and
  region-graph version basis values.
- Result commit rejects stale basis before job mutation, reservation mutation or
  actor movement.
- Region reachability can reject impossible candidates before exact A*.
- Exact pathing runs only for bounded Top-K candidates already supplied by
  indexed work selection or by the diagnostic path probe stream.

Queue growth:

- WorkOffer, path request, reservation, dirty storage slot, dirty region, job,
  command, ReasonTrace and read-model queues must return to idle steady state.
- During ticks `20001..100000`, scheduled diagnostics may sample queues, but no
  queue may grow monotonically or retain references to terminal jobs, destroyed
  build sites, completed reservations or stale path requests.

Hash, replay and parity:

- Uninterrupted Node/headless replay for seed `33` is the authoritative baseline.
- Save at tick `6000`, load at tick `6001`, and resume to tick `20000` must
  match the uninterrupted run at every required checkpoint.
- Browser Worker and Node/headless runs consume the same command stream and must
  report equal authoritative hashes. Worker snapshots and UI projections are
  read-only and cannot repair divergence.
- On divergence, diagnostics must name scenario id, seed, command index, first
  divergent tick, last matching hash, path/artifact ids and structured reason
  traces around the divergence.

ReasonTrace and explainability:

- At least one trace records selected source-to-depot hauling for wood.
- At least one trace records selected source-to-depot hauling for stone.
- At least one trace records selected depot-to-build-site hauling for each
  required def.
- At least one trace records selected build work after all sockets are filled.
- The decoy oil tag appears as counterevidence with semantic reason
  `material.def_not_required`.
- The old marker appears as counterevidence with semantic reason
  `target.not_active_build_order`.
- At least one stale path result trace records `path.version_basis_stale`.
- At least one reservation contention trace records the conflicting channel and
  owner class without leaking private implementation details.
- Traces include candidate totals, visited counts, scored counts, cap hits,
  selected offer id, rejected reason classes, Top-K/path candidate counts and
  path version basis.

## Required Failure Variants

Later implementation tasks should turn these into data-driven scenario variants
or focused tests. They are part of the contract even though WM-0033 adds no
runtime test code.

| Variant id | Change | Expected reason and state |
| ---------- | ------ | ------------------------- |
| `missing_depot_wood` | Reduce total wood to `80` | Build order stalls with `material.insufficient_required_amount`; no negative resources, leaked reservations or arbitrary substitutes |
| `decoy_only_for_site` | Remove binding paper, keep `item.decoy.oil_tag.0` | Decoy rejected as `material.def_not_required`; build sockets do not fill |
| `old_marker_order` | Point one build offer at `inspect.old_marker` | Rejected as `target.not_active_build_order`; no chronicle record or building appears |
| `blocked_all_gates` | Block all three gates after path requests submit | Non-stale work candidates reject as `region.unreachable` or `path.no_route`; stale results reject by version before mutation |
| `destination_capacity_reserved` | Pre-reserve one depot slot and one build socket for a recovery test owner | Conflict reports `reservation.destination_capacity_conflict`; failed acquisition leaves no partial claim |
| `cancel_mid_haul_loaded` | Cancel an actor after pickup and before delivery | Material conservation holds and carried state resolves through explicit cleanup |
| `destroy_site_mid_build` | Invalidate one build site after materials arrive | Job fails with `target.invalid_state`; reservations release and site buffers remain auditable |
| `save_resume_dirty_indexes` | Save while storage/work/path indexes are dirty | Load rebuilds derived indexes from owner stores before ticks resume; resumed hash matches uninterrupted replay |

Failure resolution requirements:

- Every failure exposes a noncombat resolution path: add required material,
  unblock gates, release/cancel conflicting reservations, remove or reactivate a
  target, or cancel and clean up the job.
- No failure may be resolved by combat, hidden morale, faction bonuses,
  unexplained productivity boosts, prose-only story text or direct UI mutation.
- If a future social or legal consequence is added to a logistics failure, it
  must be a data-driven obligation/social-consequence record and is out of scope
  for M2.

## Authority And Implementation Guardrails

This contract preserves the M2 architecture boundaries before implementation:

- Simulation Worker or Node headless remains the only authoritative world
  writer.
- UI, Pixi, React and Electron consume read models only.
- `sim-core` remains free of DOM, React, PixiJS, Electron, Node filesystem,
  real time and ambient randomness.
- Work selection uses spatial/work indexes and bounded Top-K candidate
  selection.
- Jobs are explicit serializable state machines. No Promise, Generator,
  coroutine, closure or UI-held execution position may store job progress.
- Derived indexes, path caches, WorkOffer rows, read models and UI projections
  rebuild from owner stores and versioned invalidation. They are never
  authoritative save payloads.
- Scenario data must be consumed by both Node/headless and browser Worker runs
  through public package entry points only.
- Hot paths cannot allocate objects, arrays, closures or strings per entity per
  tick, and cannot use unbounded sort, regex or string construction.

## Review Checklist

An implementation claiming this contract must provide evidence for:

- Fixture loaded with the declared map bounds, entities, seeds, command stream
  and horizons.
- 20 actors active in hauling/building with bounded indexed work selection.
- Exactly 100 path requests under versioned invalidation, including stale-result
  rejection before mutation.
- Terminal state and forbidden terminal states at tick `20000`.
- Long-run idle invariants through tick `100000`.
- Reservation leak, stale work offer, negative resource, queue growth, material
  conservation, hash divergence and structured reason trace invariants.
- Save interrupt/load/resume parity with uninterrupted replay.
- Browser Worker and Node headless authoritative parity.
- Required failure variants or equivalent focused tests.
- Explicit confirmation that broad economy, town-life, anomaly, combat,
  platform save UI, content expansion, balance production and M3 remain out of
  scope.
