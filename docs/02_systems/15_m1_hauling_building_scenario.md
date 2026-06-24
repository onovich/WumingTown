# M1 Hauling/Building Scenario Contract

Status: proposed by WM-0014. This is a testable scenario contract, not runtime implementation.

Scenario id: `m1.hauling_building.road_lantern_frame.v1`

## Purpose And Non-Goals

This is the first real M1 vertical slice: pawns haul named materials from storage into a build site, then complete construction through deterministic job state machines.

Canon boundary:

- Canon pillar: the built object is a road-lantern frame because lantern boundaries are a core Wuming Town system.
- Provisional M1 fixture: the frame is unlit and does not spread `visualLight`, `humanClaim`, anomaly risk, social effects, or night path risk in this scenario.
- Provisional balance: all map dimensions, quantities, carry limits, progress costs, candidate caps, and tick horizons below exist for automated tests and may be retuned by a later balance task.

Explicit non-goals:

- No broad item catalog, production chain, crafting order, fuel economy, UI construction tool, town-life simulation, combat, anomaly rule, faction simulation, chronicle case, or obligation resolution is implemented here.
- Do not solve a missing mechanic by adding a prose-only event, arbitrary stat bonus, hidden faction delta, or hand-authored final state.
- Scenario-specific fixture defs are allowed, but core hauling, reservation, pathing, and building logic must remain generic and data-driven.

## Fixture Bounds

Simulation rate: fixed `30` TPS.

Seed:

- Primary seed: `1`.
- Random stream ids used by the scenario: `scenario.fixture`, `pawn.think`, `job.selection`. The fixture must still be deterministic if no random draw is needed.

Map:

- Size: `16 x 12` cells.
- Coordinates: `x = 0..15`, `y = 0..11`.
- Out-of-bounds cells are forbidden for pathing, placement, storage, and reservations.
- All in-bounds cells are flat walkable terrain unless the test variant says otherwise.
- Chunk size for this fixture may be `8 x 6` or the accepted M1 map default; tests must assert local dirty queues do not grow after completion.

Named cells:

| Id                     |  Cell(s) | Purpose                                                          |
| ---------------------- | -------: | ---------------------------------------------------------------- |
| `slot.wood.0`          |  `(2,4)` | Source storage slot for wood                                     |
| `slot.stone.0`         |  `(3,4)` | Source storage slot for stone                                    |
| `slot.decoy.0`         |  `(2,5)` | Nearby counterevidence item that must not satisfy the build site |
| `pawn.start.alder`     |  `(5,4)` | Pawn start                                                       |
| `pawn.start.bell`      |  `(5,5)` | Pawn start                                                       |
| `build.anchor`         | `(12,7)` | Build-site anchor and final building cell                        |
| `build.interact.west`  | `(11,7)` | Build interaction cell                                           |
| `build.interact.south` | `(12,8)` | Build interaction cell                                           |

Lantern boundary fixture data:

- `build.anchor` carries `lanternClaimKind = road_lantern_frame_pending`.
- The completed building carries `lanternState = unlit_pending_fuel`.
- M1 hauling/building tests assert these fields survive completion; they do not assert light spread or social ownership.

## Initial Entities

Items:

| Entity id            | Def                   | Location       | Count |
| -------------------- | --------------------- | -------------- | ----: |
| `item.wood.0`        | `m1.item.wood`        | `slot.wood.0`  |   `6` |
| `item.stone.0`       | `m1.item.stone`       | `slot.stone.0` |   `2` |
| `item.paper.decoy.0` | `m1.item.paper_decoy` | `slot.decoy.0` |   `1` |

Storage:

- `storage.source.0` owns the three source slots above.
- Each source slot capacity is `8` units.
- Source storage accepts only its initial item def in this fixture.
- Build-site material buffers are not general storage slots and accept only required materials for `build.site.0`.

Build site:

- Entity id: `build.site.0`.
- Def: `m1.build.road_lantern_frame`.
- Anchor: `build.anchor`.
- Required material sockets:
  - `m1.item.wood`: `6`
  - `m1.item.stone`: `2`
- Required build progress: `120` integer work ticks after all materials are delivered.
- Progress must stay `0` until all material sockets are full.
- Completion result: one `m1.building.road_lantern_frame` entity at `build.anchor`; `build.site.0` is removed or marked terminal, but not both active and complete.

Pawns:

| Entity id    |   Start | Carry capacity | Allowed work    |
| ------------ | ------: | -------------: | --------------- |
| `pawn.alder` | `(5,4)` |      `4` units | `haul`, `build` |
| `pawn.bell`  | `(5,5)` |      `4` units | `haul`, `build` |

Pawn constraints:

- Pawns may reserve at most one active job each.
- Pawns may carry only one item def at a time in this fixture.
- Pawns must use explicit serializable Job Driver steps; no Promise, Generator, coroutine, or closure may hold execution position.

## Command Stream And Horizons

The command stream is part of the replay contract. There are no UI-originated mutations outside these commands.

|           Tick | Command                                                           |
| -------------: | ----------------------------------------------------------------- |
|            `0` | `LoadScenario(m1.hauling_building.road_lantern_frame.v1, seed=1)` |
|            `1` | `SetWorkPermission(pawn.alder, haul=true, build=true)`            |
|            `1` | `SetWorkPermission(pawn.bell, haul=true, build=true)`             |
|            `2` | `ActivateBuildSite(build.site.0)`                                 |
|      `3..2400` | no commands                                                       |
| `2401..100000` | no commands; long-run idle invariant window                       |

Primary functional horizon:

- By tick `2400`, the expected end state below must hold.

Long-run M1 horizon:

- By tick `100000`, the completed state must remain stable with no sustained queue, reservation, carried item, resource, dirty-work, or trace growth.

Completion target:

- A conforming implementation should complete by tick `1800` in the primary seed. This is a provisional balance value, not an excuse to hardcode exact tick counts before pathing and phase ADRs are accepted.

## Expected End State At Tick 2400

Required state:

- Exactly one completed `m1.building.road_lantern_frame` exists at `(12,7)`.
- No active `build.site.0` remains available for work.
- `build.site.0` material buffers are either absent with an auditable consumed total, or terminal with `wood=6`, `stone=2`, `progress=120`, and `completed=true`.
- `item.wood.0` count is `0`.
- `item.stone.0` count is `0`.
- `item.paper.decoy.0` count is `1`.
- No pawn is carrying an item.
- No pawn has an active job, active path request, active interaction reservation, or unreleased item/capacity/cell reservation.
- No work offer remains open for `build.site.0`.
- Map occupancy has one building occupant at `build.anchor`; source slots and interaction cells are not occupied by stale job markers.
- `lanternState = unlit_pending_fuel` is present on the completed building and no light-spread assertion is made.

Forbidden end state:

- Duplicate completed buildings.
- Negative item counts.
- Any consumed decoy paper.
- A completed building plus a still-actionable build site.
- A pawn carrying material after completion.
- An active reservation whose owner job is terminal.
- A queued build or haul offer that can never complete.

## Invariants

Material conservation:

- For each required item def, `source_count + build_buffer_count + carried_count + consumed_by_completed_building = initial_count`.
- For non-required items, `source_count + carried_count = initial_count`; the decoy paper must never enter a build buffer.

Reservation:

- Pickup requires an atomic reservation over source item quantity, source interaction cell if needed, pawn carry channel, and destination build-site capacity.
- Delivery requires an atomic reservation over destination material socket and one build interaction cell.
- Build work requires an atomic reservation over the build site and one build interaction cell.
- Failed atomic acquisition leaves no partial reservation.
- Normal job completion and cancellation explicitly release reservations; lease expiry is recovery-only.
- During any tick, total reserved amount for an item stack is `<=` current stack count plus amount already carried by the same reservation owner.

Carried items:

- Carried material is authoritative world state, not a visual-only field.
- A pawn cannot reserve or carry two defs at once in this fixture.
- Cancellation while carrying must either return the material to a valid storage/build buffer through a transaction or create a structured recoverable drop entity; it must not delete or duplicate material.

Build progress:

- Progress is integer tick work and cannot use floating-point probability accumulation.
- Progress starts only after all material sockets are filled.
- Completion commits once through the accepted tick phase contract.
- The final building inherits only declared fixture fields; no arbitrary quality, morale, faction, safety, or productivity bonus is added.

ReasonTrace and explainability:

- At least one trace records selected hauling work for `m1.item.wood`.
- At least one trace records selected hauling work for `m1.item.stone`.
- At least one trace records selected build work after material delivery.
- The decoy paper must appear as counterevidence in a bounded trace or fixture audit with semantic reason `material.def_not_required`.
- If a candidate loses due to reservation conflict, missing material, path failure, permission, or invalid target state, the trace must record the semantic reason class.
- Traces must include candidate counts, filter stages, selected offer id, rejected reason classes, and Top-K/path candidate counts.
- Trace storage is bounded. Default assertion: keep the latest `16` important traces per scenario run, or the accepted observability default if lower.

No queue growth:

- WorkOffer, path request, reservation, dirty chunk, job, command, and trace queues must return to an idle steady state after completion.
- During ticks `2401..100000`, queue lengths may fluctuate only due to scheduled diagnostics; they must not grow monotonically and must not retain stale references to terminal jobs, destroyed build sites, or completed reservations.

Bounded work selection:

- Pawn thinking may query indexed offers by work type, region, def, urgency, and permission.
- Provisional candidate cap: each pawn may score at most `8` offers before exact pathing.
- Forbidden complexity: `Pawn x WorkType x AllEntities` scans, unbounded sorts, or per-entity per-tick allocation in hot paths.

## Required Failure Variants

Later implementation tasks should turn these into data-driven scenario variants or focused unit tests. They are part of the contract even if WM-0014 adds no test code.

| Variant id                | Change                                                          | Expected reason and state                                                                                              |
| ------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `missing_wood`            | Set `item.wood.0` count to `4`                                  | Build never progresses; reason includes `material.insufficient_required_amount`; no leaked reservation or carried item |
| `decoy_only`              | Remove wood and stone, keep paper decoy                         | Paper is rejected as `material.def_not_required`; no build buffer fill; no arbitrary substitute material               |
| `blocked_source_path`     | Make cells `(6,4)..(11,4)` non-walkable without alternate route | Reason includes `path.no_route_to_source` or `path.no_route_to_destination`; any acquired reservation is released      |
| `destination_reserved`    | Pre-reserve the wood material socket for a recovery test owner  | Reason includes `reservation.destination_capacity_conflict`; failed acquisition leaves no partial reservation          |
| `invalid_blueprint_state` | Mark `build.site.0` inactive before work selection              | Reason includes `target.invalid_state`; no hauling offer remains open for that site                                    |
| `cancel_mid_haul`         | Cancel a pawn after pickup and before delivery                  | Material conservation holds; carried state resolves through explicit cancellation cleanup                              |

Failure UX requirements:

- Every failure must expose a noncombat resolution path: add required material, unblock path, release/cancel conflicting reservation, reactivate or remove the blueprint, or cancel the job.
- No failure may be resolved by combat, faction stat bonuses, hidden morale boosts, or prose-only story text.

## Pillar Guardrails

Lantern boundaries:

- The scenario may create only an unlit road-lantern frame.
- It must preserve lantern-related data fields so later lighting, human-claim, and night-risk tasks can consume them.
- It must not run full-map light diffusion, spawn anomaly rules, or grant safety/morale bonuses.

Chronicle knowledge:

- No `CaseFile`, `ConfirmedRule`, hypothesis, testimony, or public knowledge record changes in the M1 scenario.
- If a future extension claims the new lantern frame proves a rule, it must add observable clues, independent counterevidence checks, and a structured contradiction path. A prose discovery popup is not enough.

Obligations and social consequences:

- M1 asserts zero obligation, pact, faction, reputation, and land-use deltas.
- Future social consequences for lantern placement must be data-driven records with source event, visible parties, due terms, violation conditions, and explainable legal basis.
- A hidden faction adjustment or arbitrary approval bonus is forbidden.

## Allowed Implementation Paths For Later Tasks

Allowed:

- A scenario fixture file or typed scenario builder consumed by both Node headless and browser Worker runs.
- Public `sim-core` APIs for map, entity, item, storage, build site, WorkOffer, reservation, Job Driver, command log, and ReasonTrace state.
- State-change-driven WorkOffer registration and indexed lookup.
- Atomic reservation transactions with explicit release and structured failure reasons.
- Serializable Job Driver states such as `Reserve`, `PathToSource`, `Pickup`, `PathToDestination`, `Deliver`, `Build`, `Complete`, `Cancel`, and `Fail`.
- Integer quantities, integer progress, fixed tick phases, stable iteration order, and seeded random streams.
- Scenario assertions that compare world hash, fixture counters, reason traces, and invariant reports.

Forbidden:

- Renderer, Pixi, React, Electron, UI, or preload code mutating authoritative world state.
- Direct imports across package internals instead of public package entry points.
- Runtime dependencies or content catalogs added only for this fixture without an ADR or task approval.
- Hardcoded special cases that detect `m1.hauling_building.road_lantern_frame.v1` inside generic hauling/building logic.
- Promise chains, generators, coroutines, closures, or ambient timers as saved job execution state.
- `Math.random()`, `Date.now()`, `performance.now()`, floating probability accumulation, unbounded sorting, regex/string construction, or object allocation in hot per-entity tick loops.
- Broad production, crafting, economy balancing, chronicle, obligation, social, combat, anomaly, or UI feature expansion.

## Review Checklist

An implementation claiming this contract must provide evidence for:

- Fixture loaded with the declared map bounds, entities, seed, command stream, and horizons.
- End state and forbidden end states at tick `2400`.
- Long-run idle invariants through tick `100000`.
- Reservation, material, carried item, build progress, and queue-growth invariants.
- Required failure variants or equivalent focused tests.
- ReasonTrace coverage, including the decoy counterevidence.
- Headless determinism now, and Worker/headless parity once the Worker harness task is active.
