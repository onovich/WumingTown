# Integrated GameSession Architecture

Status: WM-0162 PR-1 planning output. This document defines the architecture
and candidate task DAG only. It does not implement `GameSession`, mutate public
protocol/schema/save formats, promote PR-1 implementation tasks, or create PR-2
work.

## Scope

PR-1 creates one authoritative continuously running `GameSession` for the
default product path. The session must run in Simulation Worker and headless
with the same deterministic core. UI, Pixi, Electron and Web adapters remain
read-only consumers and explicit command senders.

Non-goals for PR-1 planning:

- no product feature implementation in WM-0162;
- no public save compatibility promise;
- no new protocol message family or schema bump in WM-0162;
- no PR-2+ autonomous-life, command-building expansion or product UX task;
- no release, telemetry, account, store, signing or public distribution action.

## Current Asset Inventory

| Surface | Existing assets | PR-1 disposition |
| --- | --- | --- |
| Deterministic basis | `deterministic-hash`, `deterministic-rng`, `world-hash`, `time`, `runner` | Reuse. `TICKS_PER_SECOND = 30`, named random streams, canonical hashes and explicit headless stepping are the foundation for session parity. |
| Entity/map/location | `EntityRegistry`, `LocationStore`, `SpatialIndex`, `MapGrid`, `RegionRoomRebuilder`, map hashing | Reuse. Compose into the session owner graph; do not expose references as persistent identity outside `EntityId(index,generation)`. |
| Pathing | `PathRequestBatcher`, `GridPathfinder`, `resolveTopKPathCandidates`, path basis versions | Reuse with caps. Path requests/results must retain map/navigation/region basis and reject stale results before mutation. |
| Work discovery | `WorkOfferIndex`, `ReasonTraceStore`, storage/lamp/rest/food/medical candidate indexes | Reuse. Work producers update indexed offers on owner changes; actor thinking must query buckets and Top-K candidates, never scan the whole world. |
| Job and reservation | `JobCoreStore`, `ReservationLedger`, `HaulingJobStore`, `BuildSiteStore`, M3 rest/eating/treatment drivers | Reuse. Job position remains explicit serializable state; reservations remain the only active claim authority. |
| Items/storage/building | `ItemStackStore`, `StorageLogisticsIndex`, build delivery/construction states | Reuse/adapt. PR-1 uses food, wood, stone and lamp oil/material lanes from owner stores; static product resource counts become projections. |
| M3 life systems | needs, health, ability, rest/sleep, food/eating, medical, mood/thought, relationship, day/night/weather/schedule | Adapt. Use minimum resident state, needs and day/night fields in PR-1; broader social/medical richness remains regression-protected until PR-2+. |
| M4 town systems | lamp network/gap, Chronicle/evidence, obligation, town rule, borrowed shadow, director pressure | Adapt/test-only. Lamp/build targets are PR-1 relevant; Chronicle/obligation/crisis remain protected regression assets unless explicitly connected later. |
| M5/M8 content | anomaly roster, factions/governance, seasons, old bridge, third knock, faction endgame | Test-only for PR-1. Preserve deterministic hashes and save/replay harnesses; do not pull broad content into the first integrated session. |
| Scenario runners | `runHaulingBuildingScenario`, `runM2WorkLogisticsScenario`, `runM3OrdinaryLifeScenario`, `runM4CoreVerticalSliceScenario`, `runM5AlphaContentScenario`, `runM8FactionEndgameScenario`, `runPlayableCommandSliceScenario` | Adapt/test-only. Mine initialization data and regression facts, but do not keep them as product runtimes. |
| Worker modes | `sim-worker` catalogVersion switches for M1-M5 and playable command slice | Retire for default product. Keep as parity/regression modes; PR-1 product route hosts a long-lived session instead of rerunning scenario summaries. |
| Worker browser/session helpers | root `@wuming-town/sim-worker` browser session, reliable subscriptions, explicit advance/wait/drain helpers | Adapt. Browser session remains transport; drain helpers stay tests/tools only, not normal product time. |
| Projections | M1-M5 read-only projections, M5 Worker projection, `PlayableProjectionV1`, Web projection adapter | Adapt. Build PR-1 render/UI projections from the session owner graph with basis hashes and structured reasons. |
| Save/replay | M1-M5/M8 focused save envelopes, focused command tails, `RequestSave` smoke, web storage gate | Test-only/boundary. PR-1 defines `GameSessionSaveSnapshot` authority but does not promise public compatibility. Existing focused saves remain regression harnesses. |
| Web product state | `WEB_PRODUCT_GATE_READ_MODEL`, `reviewed-playable-session`, `playable-worker-projection`, `shell-bootstrap` | Retire/adapt. Static fixture and reviewed playback are diagnostics/tests only; default gameplay reads Worker session projection. |

## Authority Contract

```text
Compiled Content + ScenarioDefinition
                 |
                 v
        GameSessionRuntime (sim-core)
        - owner stores and derived indexes
        - tick, speed, pause, RNG, command tail
        - jobs/reservations/pathing/work offers
        - PR-1 residents/resources/lamp/build/day-night
                 |
        Simulation Worker continuous 30 TPS host
                 |
       +---------+----------+
       |                    |
 RenderSnapshot/UiDelta   GameSessionSaveSnapshot
       |                    |
 Pixi interpolation       OPFS/Electron adapters later
 React HUD read model
```

Authoritative state exists only in `GameSessionRuntime` instances owned by
Simulation Worker or Node headless. UI-local state is limited to camera, hover,
selection, build-mode affordance, locale, settings and diagnostic visibility.

No authoritative session state may be stored in module globals, hidden
singletons, closure-only scheduler state or unversioned caches. Every derived
cache must name its owner-store version basis and rebuild path.

## Lifecycle

Lifecycle states:

- `uninitialized`: no world is attached; only `InitSession` or supported
  `LoadSession` can proceed.
- `initializing`: content, scenario definition and owner stores are built in a
  deterministic order.
- `running`: Worker scheduler may request ticks according to effective speed.
- `paused`: no automatic ticks; commands may queue and read-model requests may
  be served.
- `saving`: authority is snapshotted from owner stores; ticking is quiesced or
  performed at a deterministic boundary.
- `stopping`: session drains reliable terminal messages and rejects new
  commands.
- `fatal`: structured fatal reason; no silent fallback to static fixture.

`LoadSession` is not a license to hydrate `WEB_PRODUCT_GATE_READ_MODEL`. Until
a versioned PR-1 save snapshot exists, GameSession load must fail closed with a
structured unsupported reason or remain outside the default product path.

## Fixed 30 TPS Scheduling

`sim-core` advances by integer ticks only. Worker owns real-time scheduling
outside the core. Effective speed:

| Requested speed | Effective ticks per second |
| ---: | ---: |
| paused or speed 0 | 0 |
| 1 | 30 |
| 2 | 60 |
| 3 | 90 |

Pause preserves requested speed but sets effective speed to zero. `SetSpeed`
changes requested speed for future scheduling and does not retroactively alter
world state.

Worker may accumulate wall-time debt to decide how many integer ticks to ask
the runtime to advance. The runtime never reads wall-clock time. For tests and
headless, the same runtime is stepped by explicit tick counts.

Projection publication is decoupled from tick advancement:

- render snapshots are latest-wins and may drop stale frames under
  backpressure;
- `CommandResult`, `SaveReady`, `FatalSimulationError` and structured alerts
  are reliable and must not be dropped;
- metrics record dropped snapshots and reliable queue depth.

## Deterministic Tick Phases

Each tick follows this stable phase order:

1. Apply accepted command entries scheduled for the tick.
2. Refresh dirty owner-store indexes and derived candidate lanes.
3. Select work through indexed queries and bounded Top-K exact pathing.
4. Acquire reservations atomically before job transitions.
5. Advance explicit job drivers and owner stores.
6. Advance needs, day/night, lamp/build/resource state and PR-1 goals.
7. Release terminal reservations and record structured reasons.
8. Mark projection dirty keys, metrics and hash fields.

Every loop must iterate stable numeric ids or pre-sorted deterministic lanes.
Hot tick code must not allocate per entity, build strings, use regex, or use
unbounded `sort`/`map`/`filter`/`reduce`.

## Scenario Initialization

`ScenarioDefinition` owns initial facts only:

- content manifest identity and seed;
- map dimensions, terrain, regions and initial structures;
- resident roster and spawn locations;
- initial resources, storage and fixtures;
- PR-1 goals and optional setup commands.

It does not own runtime tick, path state, jobs, reservations, resident
positions after initialization, save snapshots or product projections.

Historical runners are migration sources:

- M1/M2 hauling/building/logistics inform storage, material and build initial
  facts.
- M3 ordinary-life informs needs, rest/food/medical and day/night minimums.
- M4 lamp network and gap indexes inform lamp/build targets and risk reasons.
- M5/M8 content remains regression-only until later PR phases.
- WM-0150 playable command slice informs command/projection tests but not the
  integrated product runtime.

## Product Read Model

The PR-1 read model must expose:

- session basis: tick, snapshot sequence, scenario id, content hash, world hash
  and read-model hash;
- at least eight authoritative residents, each with entity ref, display id,
  tile/cell, visible state, current job/order reference and structured reason;
- resources for food, wood, stone and lamp oil/materials from owner stores;
- job markers for idle, claiming, moving, working, blocked, completed and
  failed states;
- lamp/build/day-night fields from owner stores;
- concise alerts and selected-object details sourced from the same session.

React may localize labels from reason codes and parameters. It may not invent
action availability, blocked reasons, resource counts or job state.

## Presentation Interpolation

Pixi receives read-only snapshots with enough basis to interpolate between two
discrete authoritative positions. Interpolation is presentation-only:

- it may smooth screen position and animation state;
- it may not change authoritative cell, path progress, job step, resource
  quantity, build progress or reason;
- it must tolerate skipped render snapshots by snapping to the latest
  authoritative basis.

Non-instant work must produce visible `moving` and `working` projections across
multiple render publications. A job that starts and completes inside one
visible frame fails PR-1 product evidence.

## Save/Load Boundary

The authoritative future `GameSessionSaveSnapshot` consists of:

- magic/format version and content manifest identity;
- session id, current tick, requested speed, pause state and command tail;
- owner store snapshots for map/entity/location/spatial, residents, needs,
  items/storage, jobs, reservations, path basis, lamp/build and PR-1 goals;
- random stream positions;
- deterministic hash and rebuild diagnostics.

Not saved as authority:

- WorkOffer rows, path caches and read models;
- render snapshots, interpolation state and UI selection;
- debug payloads, screenshots, product-gate fixture prose or Web shell local
  state.

Load must validate unknown input in scratch state, rebuild derived surfaces,
verify invariants and only then resume. Public cross-version compatibility,
desktop/Web interoperability and player-facing save UI remain later owner-gated
work.

## Migration Plan

1. Freeze historical evidence. M1-M8 hashes, benchmarks, save/replay harnesses
   and platform gates stay regression facts.
2. Add `GameSessionRuntime` in `sim-core` as a state-composition and tick-runner
   surface with a PR-1 initializer.
3. Host the runtime in Worker and headless through the same advance surface.
4. Replace default Web gameplay truth with Worker session projection.
5. Keep static fixtures and scenario runners available only through tests,
   diagnostics or explicit historical gates.
6. Run PR-1 exit gates before any PR-2 planning or WM-0154 unblock.

## Rollback Plan

- Before implementation: remove ADR-0017, this document and proposed
  WM-0163..WM-0166 packets.
- After core scaffold: revert `GameSessionRuntime` files and keep historical
  scenario runners unchanged.
- After Worker host: switch default product route to a blocked diagnostic page
  or explicitly labeled fixture; do not use drain helpers as a normal clock.
- After Web route: revert to test-only fixture route and keep the product gate
  failed until PR-1 is reworked.

Rollback must not introduce UI authority, global scans, unversioned caches,
magic command strings, Promise/coroutine job progress or public save
compatibility as a bridge.

## Protected Regression Facts

PR-1 implementation must preserve:

- existing M1-M8 deterministic hashes and focused save/replay gates unless a
  task explicitly updates fixtures with reviewed evidence;
- reservation atomicity, explicit release and structured reservation reasons;
- job core explicit serializable driver state;
- WorkOffer and pathing indexed/capped selection;
- Worker public root import boundaries and reliable message separation;
- Electron/Web security boundaries and owner-gated release verdicts.

## PR-1 Exit Gates

PR-1 is not complete until all gates are reported by WM-0166:

1. Normal speed runs continuously for 10 minutes without UI advance helpers,
   drain helpers or command-drain loops driving normal time.
2. At least eight default visible residents, resources, alerts and selection
   details come from the same `GameSession`.
3. Worker and headless produce matching hashes and read-model hashes for a
   fixed seed and command stream.
4. A 100000 tick run has no job, reservation, queue or resource conservation
   leak.
5. Default product route does not read `WEB_PRODUCT_GATE_READ_MODEL` as town
   gameplay truth.
6. Moving and working states are visible across multiple projections for
   non-instant jobs.
7. All blocked/idle/failure states in the PR-1 path carry structured reason
   codes and actionable parameters.
8. The implementation report lists every reused store and every historical
   capability still unconnected to the product runtime.

## Proposed PR-1 DAG

| Task | Owner | Depends on | Write ownership | Purpose |
| --- | --- | --- | --- | --- |
| WM-0163 | simulation-engineer | WM-0162 | `packages/sim-core/src/game-session*`, `runner`, sim-core tests | Create the authoritative runtime scaffold, PR-1 initializer and headless parity surface. |
| WM-0164 | simulation-engineer | WM-0163 | `packages/sim-worker/src/**` focused session/scheduler files and Worker tests | Host the runtime in Worker with continuous 30 TPS scheduling, pause/speed and snapshot backpressure. |
| WM-0165 | client-engineer | WM-0163 | `apps/web/src/**` focused session/projection/bootstrap paths | Route default Web gameplay truth to Worker session projection and quarantine static fixtures. |
| WM-0166 | qa-performance | WM-0164, WM-0165 | focused tests/reports for integrated gates | Run the PR-1 exit gates and record residual risks. |

The maximum concurrent write-heavy width is two after WM-0163 completes
(WM-0164 and WM-0165). It never exceeds the project cap of three.

## Open Decisions

- Exact PR-1 scenario map/content values are implementation details of WM-0163,
  bounded by the roadmap minimum: at least 64 x 64 navigable map, eight
  residents, food/wood/stone/lamp oil, inventory, beds, lamp post and one
  buildable structure.
- Public protocol/schema changes are not approved. If implementation needs
  them, it must block for a new ADR.
- Public save compatibility is not approved. PR-1 may define and test internal
  snapshot authority only if the task keeps it versioned and non-public.
