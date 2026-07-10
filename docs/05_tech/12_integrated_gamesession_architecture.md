# Integrated GameSession Architecture

Status: ADR-0017 architecture record, updated through the WM-0165 Web default
route. WM-0162 authored the plan; WM-0163 and WM-0164 implemented the runtime,
schema-v3 projection, and Worker scheduler; WM-0165 consumes those public roots.
This document does not approve PR-2 work or public save compatibility.

## Scope

PR-1 creates one authoritative continuously running `GameSession` for the
default product path. The session must run in Simulation Worker and headless
with the same deterministic core. UI, Pixi, Electron and Web adapters remain
read-only consumers and explicit command senders.

Non-goals for PR-1 planning:

- no product feature implementation in WM-0162;
- no public save compatibility promise;
- no new protocol message family and no protocol code change in WM-0162;
- no PR-2+ autonomous-life, command-building expansion or product UX task;
- no release, telemetry, account, store, signing or public distribution action.

## Current Asset Inventory

| Surface                        | Existing assets                                                                                                                                                                                                          | PR-1 disposition                                                                                                                                                                                                                                                           |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Deterministic basis            | `deterministic-hash`, `deterministic-rng`, `world-hash`, `time`, `runner`                                                                                                                                                | Reuse. `TICKS_PER_SECOND = 30`, named random streams, canonical hashes and explicit headless stepping are the foundation for session parity.                                                                                                                               |
| Entity/map/location            | `EntityRegistry`, `LocationStore`, `SpatialIndex`, `MapGrid`, `RegionRoomRebuilder`, map hashing                                                                                                                         | Reuse. Compose into the session owner graph; do not expose references as persistent identity outside `EntityId(index,generation)`.                                                                                                                                         |
| Pathing                        | `PathRequestBatcher`, `GridPathfinder`, `resolveTopKPathCandidates`, path basis versions                                                                                                                                 | Reuse with caps. Path requests/results must retain map/navigation/region basis and reject stale results before mutation.                                                                                                                                                   |
| Work discovery                 | `WorkOfferIndex`, `ReasonTraceStore`, storage/lamp/rest/food/medical candidate indexes                                                                                                                                   | Reuse. Work producers update indexed offers on owner changes; actor thinking must query buckets and Top-K candidates, never scan the whole world.                                                                                                                          |
| Job and reservation            | `JobCoreStore`, `ReservationLedger`, `HaulingJobStore`, `BuildSiteStore`, M3 rest/eating/treatment drivers                                                                                                               | Reuse. Job position remains explicit serializable state; reservations remain the only active claim authority.                                                                                                                                                              |
| Items/storage/building         | `ItemStackStore`, `StorageLogisticsIndex`, build delivery/construction states                                                                                                                                            | Reuse/adapt. PR-1 uses food, wood, stone and lamp oil/material lanes from owner stores; static product resource counts become projections.                                                                                                                                 |
| M3 life systems                | needs, health, ability, rest/sleep, food/eating, medical, mood/thought, relationship, day/night/weather/schedule                                                                                                         | Adapt. Use minimum resident state, needs and day/night fields in PR-1; broader social/medical richness remains regression-protected until PR-2+.                                                                                                                           |
| M4 town systems                | lamp network/gap, Chronicle/evidence, obligation, town rule, borrowed shadow, director pressure                                                                                                                          | Adapt/test-only. Lamp/build targets are PR-1 relevant; Chronicle/obligation/crisis remain protected regression assets unless explicitly connected later.                                                                                                                   |
| M5/M8 content                  | anomaly roster, factions/governance, seasons, old bridge, third knock, faction endgame                                                                                                                                   | Test-only for PR-1. Preserve deterministic hashes and save/replay harnesses; do not pull broad content into the first integrated session.                                                                                                                                  |
| Scenario runners               | `runHaulingBuildingScenario`, `runM2WorkLogisticsScenario`, `runM3OrdinaryLifeScenario`, `runM4CoreVerticalSliceScenario`, `runM5AlphaContentScenario`, `runM8FactionEndgameScenario`, `runPlayableCommandSliceScenario` | Adapt/test-only. Mine initialization data and regression facts, but do not keep them as product runtimes.                                                                                                                                                                  |
| Worker modes                   | `sim-worker` catalogVersion switches for M1-M5 and playable command slice                                                                                                                                                | Retire for default product. Keep as parity/regression modes; PR-1 product route hosts a long-lived session instead of rerunning scenario summaries.                                                                                                                        |
| Worker browser/session helpers | root `@wuming-town/sim-worker` browser session, reliable subscriptions, explicit advance/wait/drain helpers                                                                                                              | Adapt. Browser session remains transport; drain helpers stay tests/tools only, not normal product time.                                                                                                                                                                    |
| Projections                    | schema-v2 `RenderSnapshotPayload`/`UiDeltaPayload`, M1-M5 read-only projections, M5 Worker projection, `PlayableProjectionV1`, Web projection adapter                                                                    | Adapt with reviewed schema bump. Existing render payloads cannot carry positions and the focused playable model cannot carry the integrated resident/resource/time/alert/detail surface. WM-0164 alone owns schema-v3 `GameSession*ProjectionV1` protocol files and tests. |
| Save/replay                    | M1-M5/M8 focused save envelopes, focused command tails, `RequestSave` smoke, web storage gate                                                                                                                            | Test-only/boundary. PR-1 defines `GameSessionSaveSnapshot` authority but does not promise public compatibility. Existing focused saves remain regression harnesses.                                                                                                        |
| Web product state              | `WEB_PRODUCT_GATE_READ_MODEL`, `reviewed-playable-session`, `playable-worker-projection`, `shell-bootstrap`                                                                                                              | Retire/adapt. Static fixture and reviewed playback are diagnostics/tests only; default gameplay reads Worker session projection.                                                                                                                                           |

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
 schema-v3 projection v1 GameSessionSaveSnapshot
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

|   Requested speed | Effective ticks per second |
| ----------------: | -------------------------: |
| paused or speed 0 |                          0 |
|                 1 |                         30 |
|                 2 |                         60 |
|                 3 |                         90 |

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

## Minimum Versioned Projection Protocol

ADR-0017 approves one protocol change for PR-1. The existing message families
remain unchanged, `protocolVersion` stays at 1, envelope `schemaVersion` moves
from 2 to 3, and the nested GameSession projection contract starts at version

1. Schema and projection versions are separate so future payload evolution does
   not overload transport-family identity.

### Negotiation

- `InitSessionPayload.projectionRequest` is optional for legacy regression
  sessions and exactly `{ kind: "game_session", version: 1 }` for the PR-1
  product route.
- `ReadyPayload.projectionContract` must echo that exact pair before the
  GameSession client enters running state.
- A negotiated GameSession session must include a version-1 GameSession payload
  on every applicable `RenderSnapshot` and `UiDelta`; legacy payloads are not a
  product fallback.

### Shared basis

Both GameSession payloads carry a coherent basis with:

- `projectionVersion = 1`;
- `tick`, `snapshotSequence` and `previousSnapshotSequence` where applicable;
- `worldHash`, `readModelHash` and `contentManifestHash`;
- `mapVersion`, `reservationVersion` and `jobVersion` needed to reject stale
  detail/action facts.

Render and UI publications may arrive independently, but a UI projection may
only reference a known current or newer bounded-pending render snapshot. When a
pair names the same snapshot sequence, tick and shared hashes must agree.

### RenderSnapshot.gameSession

`GameSessionRenderProjectionV1` contains map width/height/tile size plus a
bounded stable-id render lane. Every row contains:

- `EntityId(index,generation)` and kind: resident, resource, structure, lamp or
  build site;
- numeric render-def id;
- authoritative X/Y Q16 world position for the snapshot tick;
- facing, animation-state enum and numeric render flags.

The client retains the preceding accepted snapshot for interpolation. It may
smooth only presentation position/animation and must snap to the newest
authoritative row after a dropped snapshot or entity-generation change.

### UiDelta.gameSession

`GameSessionUiProjectionV1` contains only structured, localizable facts:

- session pause/requested-speed state;
- day index, tick-of-day, ticks-per-day, day phase and daylight Q16;
- resident rows keyed by `EntityId`, including def ids, cell, activity/job
  state, progress and optional structured reason;
- resource rows keyed by def id with total, available and reserved integer
  quantities, including food, wood, stone and lamp oil;
- job markers and alerts with stable ids, severity, reason code, source,
  optional subject and ordered scalar parameters;
- `selectionDetail = null` or a versioned resident/resource/structure detail
  for the latest `RequestUiDetail`, with its own owner-version basis. The Web
  owns which id is selected; the Worker owns every displayed detail fact.

No localized label, prose summary, camera, hover state, selected-id state or
Pixi interpolation value becomes protocol authority.

### Compatibility And Failure Closure

- Schema 3 accepts only envelope schema 3. Schema 2 peers are rejected with
  `UnsupportedSchemaVersion`; mixed-build hot connections and down-conversion
  are unsupported.
- An unknown requested projection version is rejected during initialization.
- Missing or mismatched `Ready` contract, missing negotiated render/UI payload,
  malformed entity/version lanes, wrong session id, or incoherent basis closes
  the browser session as a structured fatal/lifecycle error. The default route
  must remain blocked and must not read `WEB_PRODUCT_GATE_READ_MODEL`.
- A lower stale render sequence may be dropped by latest-wins backpressure. A
  newer malformed or contract-incompatible message must not be ignored.
- M0-M8 scenario modes may omit `projectionRequest` and continue as same-build
  regression/test sessions under schema 3. They are ineligible for the default
  PR-1 route.

WM-0164 is the sole writer for these exact protocol surfaces:

- `packages/sim-protocol/src/constants.ts`;
- `packages/sim-protocol/src/types.ts`;
- `packages/sim-protocol/src/payload-validation.ts`;
- `packages/sim-protocol/src/protocol-validation.test.ts`;
- `packages/sim-protocol/src/game-session-projection.ts`;
- `packages/sim-protocol/src/game-session-projection-validation.ts`;
- `packages/sim-protocol/src/game-session-projection.test.ts`;
- `packages/sim-protocol/src/index.ts`.

WM-0163, WM-0165 and WM-0166 are forbidden from editing the wire-protocol
surfaces above; they consume the package public root after their declared
dependency completes. WM-0165 has one exact presentation-only exception:
`packages/sim-protocol/src/web-read-model.ts` may add `"resource"` to the
existing `WorldEntityKind` union so the already-approved GameSession render
kind is not mislabeled as a structure. This additive consumer completion does
not change schema 3, projection v1, validators, messages or package exports.

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
3. Implement schema-v3 GameSession projection v1 and host the runtime in Worker
   through the same advance surface.
4. After the protocol/Worker task completes, replace default Web gameplay truth
   with that validated Worker session projection.
5. Keep static fixtures and scenario runners available only through tests,
   diagnostics or explicit historical gates.
6. Run PR-1 exit gates before any PR-2 planning or WM-0154 unblock.

### WM-0165 Web default route status

WM-0165 completes migration step 4 for the default Web shell. The route calls
`createBrowserSimulationWorkerSession()` through the Web-local adapter and
starts `session.initGameSession()` from the `@wuming-town/sim-worker` package
root. That public method sends the PR-1 catalog, seed, and exact
`{ kind: "game_session", version: 1 }` projection request. The shell does not
enter projected gameplay until the public browser session reaches `active`
after the exact schema-3 Ready contract.

The Web projection adapter retains at most one pending RenderSnapshot and one
pending UiDelta. It publishes a product frame only when both name the same
snapshot sequence and `validateCoherentGameSessionProjectionPair()` from the
`@wuming-town/sim-protocol` root accepts their complete basis. Map dimensions
and entity positions come only from that frame's RenderSnapshot. Residents,
resources, alerts, generic job-marker state/progress, lamp/build facts, and
requested selection detail come only from its UiDelta. The current Pixi bridge
snaps to each accepted RenderSnapshot; WM-0165 adds no client-side simulation
or interpolation clock.

The public presentation path preserves resource identity end to end:
`GameSessionRenderKindV1.resource -> WorldEntityKind.resource -> Pixi resource
marker/selection -> localized HUD resource label`. The client may format the
already-projected resource kind and quantities, but it may not alias a resource
to another entity kind, invent a trend/count, or replace the inspector through
shell-local DOM/CSS. The default 1424 x 861 framing must leave at least one
authoritative resource marker reachable by real mouse input, with Web E2E
covering both resident and resource selection.

Before the first coherent frame, and after any protocol/session fatal, the
shell uses an empty lifecycle read model with no entities, resource counts,
alerts, jobs, resident positions, build progress, blocked reasons, or command
outcomes. A malformed or mismatched newer message terminates/closes the public
browser session, clears the last product frame, and never falls back to a
fixture. Normal time is the WM-0164 Worker scheduler; the default bootstrap
does not import or call playable advance, wait, or drain helpers.

Historical surfaces remain quarantined as follows:

- `product-gate-fixture.ts` remains fixture data for
  `product-gate-harness.test.ts`, `smoke-read-model.ts`, and the historical
  `reviewed-playable-session.ts`; `shell-bootstrap.ts` does not import it.
- `product-gate-harness.ts` remains release-gate metadata for the explicit
  `wmDiagnostics=1` overlay, local diagnostic package, and shell-evidence
  storage envelope. It is not a town-state source.
- `reviewed-playable-session.ts` remains the explicit WM-0151 historical
  projection-playback module and has no default-shell import.
- WM-0150 playable start/advance/wait/drain exports remain in
  `simulation-worker-session.ts` for focused regression tests and tools;
  default bootstrap imports only the GameSession start/read functions.
- `smoke-read-model.ts` and the app-root fixture export remain historical smoke
  gates. Product E2E mechanically scans the default bootstrap to prevent these
  sources from returning to gameplay.

GameSession authoritative save/load remains unsupported. The diagnostics-only
OPFS envelope can restore a local selected id and shell evidence, but it cannot
restore runtime tick, stores, jobs, reservations, resource state, projections,
or Worker scheduling.

## Rollback Plan

- Before implementation: remove ADR-0017, this document and proposed
  WM-0163..WM-0166 packets.
- After core scaffold: revert `GameSessionRuntime` files and keep historical
  scenario runners unchanged.
- After Worker host: switch default product route to a blocked diagnostic page
  or explicitly labeled fixture and revert Worker/Web consumers together to
  schema 2; mixed schema 2/3 components are not supported. Do not use drain
  helpers as a normal clock.
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
9. Schema-v3 negotiation, exact projection-version acceptance, malformed/newer
   fail-closed behavior and legacy-regression exclusion from the product route
   are covered by protocol, Worker and Web tests.

## Proposed PR-1 DAG

| Task    | Owner               | Depends on | Write ownership                                                                                                                  | Purpose                                                                                                                                                                      |
| ------- | ------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WM-0163 | simulation-engineer | WM-0162    | `packages/sim-core/src/game-session*`, `runner`, sim-core tests                                                                  | Create the authoritative runtime scaffold, PR-1 initializer and headless parity surface.                                                                                     |
| WM-0164 | simulation-engineer | WM-0163    | exact `packages/sim-protocol` projection files listed above plus focused `packages/sim-worker` session/scheduler files and tests | Implement the ADR-approved schema-v3 projection contract as sole protocol writer, then host the runtime with continuous scheduling, fail-closed validation and backpressure. |
| WM-0165 | client-engineer     | WM-0164    | focused `apps/web/src` paths plus exact presentation enum, Pixi resource marker, and HUD localization consumers; wire protocol remains consume-only | Route default Web gameplay truth to the validated Worker session projection and quarantine static fixtures.                                                                  |
| WM-0166 | qa-performance      | WM-0165    | focused integrated tests/reports; protocol and feature code are consume-only                                                     | Run the PR-1 exit gates and record residual risks.                                                                                                                           |

The critical path is
`WM-0162 -> WM-0163 -> WM-0164 -> WM-0165 -> WM-0166`. The maximum concurrent
write-heavy width is one. This makes protocol production, Worker validation and
Web consumption executable in dependency order and gives every product-code
surface one active owner.

## Open Decisions

- Exact PR-1 scenario map/content values are implementation details of WM-0163,
  bounded by the roadmap minimum: at least 64 x 64 navigable map, eight
  residents, food/wood/stone/lamp oil, inventory, beds, lamp post and one
  buildable structure.
- ADR-0017 approves only schema 3 and `GameSession*ProjectionV1` in WM-0164.
  Any new message family, projection v2, command-contract change or additional
  protocol surface must block for another reviewed ADR.
- The additive `WorldEntityKind.resource` presentation correction recorded in
  ADR-0017 is not another wire-protocol surface. It permits only the lossless
  consumer mapping and exhaustive Pixi/HUD localization needed by WM-0165.
- Public save compatibility is not approved. PR-1 may define and test internal
  snapshot authority only if the task keeps it versioned and non-public.
